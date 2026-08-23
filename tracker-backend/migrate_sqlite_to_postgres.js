require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const dbDir = process.env.DATABASE_DIR || __dirname;
const sqlitePath = path.join(dbDir, 'database.sqlite');

if (!fs.existsSync(sqlitePath)) {
  console.log(`SQLite database not found at ${sqlitePath}. Nothing to migrate.`);
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes('YOUR_PASSWORD_HERE')) {
  console.error('ERROR: DATABASE_URL is not configured in your .env file.');
  console.error('Please configure your PostgreSQL password in tracker-backend/.env first.');
  process.exit(1);
}

const runMigration = async () => {
  console.log('--- Starting SQLite to PostgreSQL Data Migration ---');
  
  // 1. Parse connection string to check/create the target database
  let targetDbName = '';
  let baseConnectionString = '';
  try {
    const dbUrl = new URL(connectionString);
    targetDbName = dbUrl.pathname.replace(/^\//, '');
  } catch (err) {
    console.error('Error parsing DATABASE_URL:', err.message);
    process.exit(1);
  }

  let sslConfig = { rejectUnauthorized: false };
  try {
    const dbUrl = new URL(connectionString);
    if (['localhost', '127.0.0.1', '::1', ''].includes(dbUrl.hostname)) {
      sslConfig = false;
    }
  } catch (e) {}

  console.log(`Target Database: ${targetDbName}`);

  // Try connecting to target database first to see if it exists
  const checkPool = new Pool({
    connectionString: connectionString,
    ssl: sslConfig
  });
  let dbExists = false;
  try {
    await checkPool.query('SELECT 1');
    dbExists = true;
    console.log(`Database "${targetDbName}" already exists and is accessible.`);
  } catch (err) {
    if (err.code === '3D000' || err.message.includes('does not exist')) {
      console.log(`Database "${targetDbName}" does not exist. Attempting to create it...`);
    } else {
      console.error('Database connection error:', err.message);
      process.exit(1);
    }
  } finally {
    await checkPool.end();
  }

  if (!dbExists) {
    // Attempt to connect to standard default databases to create targetDbName
    const fallbackDbs = ['/postgres', '/template1'];
    let created = false;
    for (const fallback of fallbackDbs) {
      try {
        const dbUrl = new URL(connectionString);
        dbUrl.pathname = fallback;
        const basePool = new Pool({
          connectionString: dbUrl.toString(),
          ssl: sslConfig
        });
        console.log(`Trying to connect to fallback database "${fallback}" to create "${targetDbName}"...`);
        await basePool.query(`CREATE DATABASE "${targetDbName}"`);
        console.log(`Successfully created database "${targetDbName}".`);
        await basePool.end();
        created = true;
        break;
      } catch (err) {
        if (err.code === '42P04') { // duplicate_database
          console.log(`Database "${targetDbName}" already exists.`);
          created = true;
          break;
        } else {
          console.log(`Failed using fallback "${fallback}":`, err.message);
        }
      }
    }
    if (!created) {
      console.error(`❌ Could not create database "${targetDbName}". Please create it manually.`);
      process.exit(1);
    }
  }

  // 3. Connect to the actual target PostgreSQL database
  const pgPool = new Pool({
    connectionString: connectionString,
    ssl: sslConfig
  });

  // 4. Connect to source SQLite database
  const sqliteDb = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
      process.exit(1);
    }
  });

  // Helper to query SQLite
  const querySqlite = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  try {
    // 5. Read volunteers and contacts from SQLite
    console.log('Reading data from SQLite...');
    const sqliteVolunteers = await querySqlite('SELECT * FROM volunteers').catch(() => []);
    const sqliteContacts = await querySqlite('SELECT * FROM contacts').catch(() => []);

    console.log(`Found ${sqliteVolunteers.length} volunteers and ${sqliteContacts.length} contacts in SQLite.`);

    // 6. Setup PostgreSQL Schema
    console.log('Recreating PostgreSQL tables...');
    await pgPool.query('DROP TABLE IF EXISTS contacts CASCADE');
    await pgPool.query('DROP TABLE IF EXISTS volunteers CASCADE');

    await pgPool.query(`
      CREATE TABLE volunteers (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);

    await pgPool.query(`
      CREATE TABLE contacts (
        id SERIAL PRIMARY KEY,
        s_no INTEGER,
        acc_code TEXT,
        account_name TEXT,
        mobile_number TEXT,
        email_id TEXT,
        email_status TEXT DEFAULT 'Pending',
        email_sent_date TEXT DEFAULT '',
        whatsapp_status TEXT DEFAULT 'Pending',
        whatsapp_sent_date TEXT DEFAULT '',
        call_status TEXT DEFAULT 'Not Called',
        call_sent_date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        member_reaction TEXT DEFAULT 'Unknown',
        exit_poll_status TEXT DEFAULT 'Pending',
        emirate TEXT,
        district TEXT,
        assigned_to TEXT DEFAULT 'Unassigned',
        account_status TEXT DEFAULT 'Active'
      )
    `);

    // 7. Migrate Volunteers
    if (sqliteVolunteers.length > 0) {
      console.log('Migrating volunteers...');
      for (const vol of sqliteVolunteers) {
        await pgPool.query(
          'INSERT INTO volunteers (id, name) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
          [vol.id, vol.name]
        );
      }
    }

    // 8. Migrate Contacts
    if (sqliteContacts.length > 0) {
      console.log('Migrating contacts...');
      const batchSize = 100;
      for (let i = 0; i < sqliteContacts.length; i += batchSize) {
        const batch = sqliteContacts.slice(i, i + batchSize);
        for (const contact of batch) {
          await pgPool.query(`
            INSERT INTO contacts (
              id, s_no, acc_code, account_name, mobile_number, email_id,
              email_status, email_sent_date, whatsapp_status, whatsapp_sent_date,
              call_status, call_sent_date, notes, member_reaction, exit_poll_status,
              emirate, district, assigned_to, account_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          `, [
            contact.id,
            contact.s_no,
            contact.acc_code,
            contact.account_name,
            contact.mobile_number,
            contact.email_id,
            contact.email_status,
            contact.email_sent_date,
            contact.whatsapp_status,
            contact.whatsapp_sent_date,
            contact.call_status,
            contact.call_sent_date,
            contact.notes,
            contact.member_reaction,
            contact.exit_poll_status,
            contact.emirate,
            contact.district,
            contact.assigned_to,
            contact.account_status
          ]);
        }
      }
    }

    // 9. Reset sequences for SERIAL fields in Postgres
    console.log('Resetting serial sequences...');
    if (sqliteVolunteers.length > 0) {
      await pgPool.query("SELECT setval(pg_get_serial_sequence('volunteers', 'id'), COALESCE(max(id), 1)) FROM volunteers");
    }
    if (sqliteContacts.length > 0) {
      await pgPool.query("SELECT setval(pg_get_serial_sequence('contacts', 'id'), COALESCE(max(id), 1)) FROM contacts");
    }

    console.log('✅ Migration completed successfully!');
    sqliteDb.close();
    await pgPool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    sqliteDb.close();
    await pgPool.end();
    process.exit(1);
  }
};

runMigration();
