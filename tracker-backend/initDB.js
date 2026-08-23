require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbDir = process.env.DATABASE_DIR || __dirname;
const dbPath = path.join(dbDir, 'database.sqlite');
let jsonPath = path.join(__dirname, 'contacts_data.json');
if (!fs.existsSync(jsonPath)) {
  jsonPath = path.join(__dirname, '../contacts_data.json');
}

// Check if JSON data file exists
if (!fs.existsSync(jsonPath)) {
  console.error(`Error: contacts_data.json not found at ${jsonPath}`);
  process.exit(1);
}

// Read contacts data
const contacts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`Loaded ${contacts.length} contacts from contacts_data.json`);

const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  console.log('Connecting to PostgreSQL database for initialization...');
  let sslConfig = { rejectUnauthorized: false };
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (['localhost', '127.0.0.1', '::1', ''].includes(dbUrl.hostname)) {
      sslConfig = false;
    }
  } catch (e) {}

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
  });

  (async () => {
    try {
      await pool.query('DROP TABLE IF EXISTS contacts');
      await pool.query('DROP TABLE IF EXISTS volunteers');

      console.log('Creating contacts table in PostgreSQL...');
      await pool.query(`
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
          account_status TEXT DEFAULT 'Active',
          area TEXT
        )
      `);

      console.log('Creating volunteers table in PostgreSQL...');
      await pool.query(`
        CREATE TABLE volunteers (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL
        )
      `);

      console.log('Inserting contacts in batches into PostgreSQL...');
      const batchSize = 200;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const valueRows = [];
        const params = [];
        let paramIndex = 1;

        for (const contact of batch) {
          valueRows.push(`(
            $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
            $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
            $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
            $${paramIndex++}, $${paramIndex++}, $${paramIndex++}
          )`);
          params.push(
            contact.sNo || 0,
            contact.accCode || '',
            contact.name || '',
            contact.mobile || '',
            contact.email || '',
            contact.emailStatus || 'Pending',
            contact.emailSentDate || '',
            contact.waStatus || 'Pending',
            contact.waSentDate || '',
            contact.callStatus || 'Not Called',
            contact.callSentDate || '',
            contact.callNotes || '',
            'Unknown',
            'Pending',
            contact.emirate || '',
            contact.district || '',
            contact.assigned_to || 'Unassigned',
            contact.area || ''
          );
        }

        const bulkQuery = `
          INSERT INTO contacts (
            s_no, acc_code, account_name, mobile_number, email_id,
            email_status, email_sent_date,
            whatsapp_status, whatsapp_sent_date,
            call_status, call_sent_date, notes,
            member_reaction, exit_poll_status,
            emirate, district, assigned_to, area
          ) VALUES ${valueRows.join(', ')}
        `;
        await pool.query(bulkQuery, params);
      }

      console.log('Auto-seeding volunteers from contacts...');
      await pool.query(`
        INSERT INTO volunteers (name)
        SELECT DISTINCT assigned_to FROM contacts
        WHERE assigned_to IS NOT NULL AND assigned_to != '' AND assigned_to != 'Unassigned'
        ON CONFLICT (name) DO NOTHING
      `);

      console.log(`Successfully initialized PostgreSQL database with ${contacts.length} contacts.`);
      await pool.end();
      process.exit(0);
    } catch (err) {
      console.error('Error during PostgreSQL auto-initialization:', err.message);
      if (pool) await pool.end();
      process.exit(1);
    }
  })();

} else {
  // Connect to SQLite
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      process.exit(1);
    }
    console.log('Connected to SQLite database.');
  });

  db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS contacts`);
    db.run(`DROP TABLE IF EXISTS volunteers`);

    db.run(`
      CREATE TABLE contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        account_status TEXT DEFAULT 'Active',
        area TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Error creating contacts table:', err.message);
        db.close();
        process.exit(1);
      }
      console.log('Created contacts table.');

      db.run(`
        CREATE TABLE volunteers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL
        )
      `, (volErr) => {
        if (volErr) {
          console.error('Error creating volunteers table:', volErr.message);
        }

        // Prepare statement for bulk insert
        const stmt = db.prepare(`
          INSERT INTO contacts (
            s_no, acc_code, account_name, mobile_number, email_id, 
            email_status, email_sent_date, 
            whatsapp_status, whatsapp_sent_date, 
            call_status, call_sent_date, notes,
            member_reaction, exit_poll_status,
            emirate, district, assigned_to, area
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.parallelize(() => {
          for (const contact of contacts) {
            stmt.run(
              contact.sNo || 0,
              contact.accCode || '',
              contact.name || '',
              contact.mobile || '',
              contact.email || '',
              contact.emailStatus || 'Pending',
              contact.emailSentDate || '',
              contact.waStatus || 'Pending',
              contact.waSentDate || '',
              contact.callStatus || 'Not Called',
              contact.callSentDate || '',
              contact.callNotes || '',
              'Unknown', // member_reaction
              'Pending',  // exit_poll_status
              contact.emirate || '',
              contact.district || '',
              contact.assigned_to || 'Unassigned',
              contact.area || ''
            );
          }
        });

        stmt.finalize((err) => {
          if (err) {
            console.error('Error finalising statement:', err.message);
          } else {
            console.log(`Successfully imported ${contacts.length} contacts into SQLite database.`);
            
            // Seed volunteers table
            db.run(`
              INSERT OR IGNORE INTO volunteers (name)
              SELECT DISTINCT assigned_to FROM contacts
              WHERE assigned_to IS NOT NULL AND assigned_to != '' AND assigned_to != 'Unassigned'
            `, (err) => {
              if (err) console.error("Error seeding SQLite volunteers table:", err.message);
              else console.log("SQLite volunteers table seeded.");
              db.close();
            });
          }
        });
      });
    });
  });
}
