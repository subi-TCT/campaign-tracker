require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const excelPath = path.join(__dirname, '../master contact list.xls');
const dbDir = process.env.DATABASE_DIR || __dirname;
const sqlitePath = path.join(dbDir, 'database.sqlite');

if (!fs.existsSync(excelPath)) {
  console.error(`Error: Excel file not found at ${excelPath}`);
  process.exit(1);
}

const isPostgres = !!process.env.DATABASE_URL;

// Parse Host from DATABASE_URL to configure SSL dynamically
let sslConfig = { rejectUnauthorized: false };
if (isPostgres) {
  try {
    const { URL } = require('url');
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (['localhost', '127.0.0.1', '::1', ''].includes(dbUrl.hostname)) {
      sslConfig = false;
    }
  } catch (e) {}
}

const formatMobile = (mobileRaw) => {
  if (!mobileRaw) return '';
  const cleaned = String(mobileRaw).replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('05')) return '971' + cleaned.substring(1);
  if (cleaned.startsWith('5')) return '971' + cleaned;
  return cleaned;
};

// Database abstraction helpers
let sqliteDb = null;
let pgPool = null;

const initConnections = () => {
  return new Promise((resolve, reject) => {
    // 1. Connect to SQLite if file exists
    if (fs.existsSync(sqlitePath)) {
      sqliteDb = new sqlite3.Database(sqlitePath, (err) => {
        if (err) {
          console.error('Error connecting to SQLite:', err.message);
          return reject(err);
        }
        console.log('Connected to SQLite database.');
        checkConnectionsPart2(resolve, reject);
      });
    } else {
      checkConnectionsPart2(resolve, reject);
    }
  });
};

const checkConnectionsPart2 = (resolve, reject) => {
  // 2. Connect to Postgres if URL is configured
  if (isPostgres) {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig
    });
    pgPool.query('SELECT 1', (err) => {
      if (err) {
        console.error('Error connecting to PostgreSQL:', err.message);
        return reject(err);
      }
      console.log('Connected to PostgreSQL database.');
      resolve();
    });
  } else {
    resolve();
  }
};

const runMigration = async () => {
  console.log('Running database schema migrations (adding area column)...');
  
  if (sqliteDb) {
    await new Promise((resolve) => {
      sqliteDb.run('ALTER TABLE contacts ADD COLUMN area TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('SQLite schema migration error:', err.message);
        } else {
          console.log('SQLite schema is ready (area column verified).');
        }
        resolve();
      });
    });
  }

  if (pgPool) {
    try {
      await pgPool.query('ALTER TABLE contacts ADD COLUMN area TEXT');
      console.log('PostgreSQL schema is ready (area column created).');
    } catch (err) {
      if (err.code === '42701') { // duplicate_column
        console.log('PostgreSQL schema is ready (area column already exists).');
      } else {
        console.error('PostgreSQL schema migration error:', err.message);
      }
    }
  }
};

const queryDb = async (sql, params = [], isWrite = false) => {
  // Run on SQLite
  if (sqliteDb) {
    await new Promise((resolve, reject) => {
      if (isWrite) {
        sqliteDb.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }
    });
  }

  // Run on Postgres
  if (pgPool) {
    let pgSql = sql;
    if (!isWrite) {
      // Convert SQLite '?' parameter placeholder to Postgres '$1, $2'
      let index = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${index++}`);
      const res = await pgPool.query(pgSql, params);
      return res.rows;
    } else {
      let index = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${index++}`);
      await pgPool.query(pgSql, params);
    }
  }
};

const runMerge = async () => {
  try {
    await initConnections();
    await runMigration();

    console.log('Reading Excel file...');
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets['Working'];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Loaded ${rows.length} rows from Excel Working sheet.`);

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of rows) {
      const accCodeRaw = row['AccCode'] || '';
      const accCode = String(accCodeRaw).trim().replace(/\.0$/, '');
      if (!accCode || accCode === 'undefined') continue;

      const name = String(row['AccountName'] || '').trim();
      const mobile = formatMobile(row['Mobile Number']);
      const email = String(row['Email ID'] || '').trim();
      const area = String(row['AREA'] || '').trim();
      const district = String(row['District'] || '').trim();
      const sNoRaw = row['S.No'] || 0;
      const sNo = parseInt(sNoRaw, 10) || 0;

      // Query database for matching acc_code (check PostgreSQL or SQLite)
      let dbMatch = [];
      if (pgPool) {
        const res = await pgPool.query('SELECT * FROM contacts WHERE acc_code = $1', [accCode]);
        dbMatch = res.rows;
      } else if (sqliteDb) {
        dbMatch = await new Promise((resolve) => {
          sqliteDb.all('SELECT * FROM contacts WHERE acc_code = ?', [accCode], (err, rows) => {
            resolve(rows || []);
          });
        });
      }

      if (dbMatch.length === 0) {
        // Insert new contact
        const insertSql = `
          INSERT INTO contacts (
            s_no, acc_code, account_name, mobile_number, email_id, area, district,
            email_status, whatsapp_status, call_status, member_reaction, exit_poll_status, account_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', 'Pending', 'Not Called', 'Unknown', 'Pending', 'Active')
        `;
        const params = [sNo, accCode, name, mobile, email, area, district];
        await queryDb(insertSql, params, true);
        inserted++;
      } else {
        // Merge updates
        const match = dbMatch[0];
        const updates = [];
        const params = [];

        if (name && match.account_name !== name) {
          updates.push('account_name = ?');
          params.push(name);
        }
        if (mobile && match.mobile_number !== mobile) {
          updates.push('mobile_number = ?');
          params.push(mobile);
        }
        if (email && match.email_id !== email) {
          updates.push('email_id = ?');
          params.push(email);
        }
        if (area && match.area !== area) {
          updates.push('area = ?');
          params.push(area);
        }
        if (district && match.district !== district) {
          updates.push('district = ?');
          params.push(district);
        }
        if (sNo && match.s_no !== sNo) {
          updates.push('s_no = ?');
          params.push(sNo);
        }

        if (updates.length > 0) {
          params.push(accCode);
          const updateSql = `UPDATE contacts SET ${updates.join(', ')} WHERE acc_code = ?`;
          await queryDb(updateSql, params, true);
          updated++;
        } else {
          unchanged++;
        }
      }
    }

    // Reset sequences in Postgres if we did inserts
    if (pgPool && inserted > 0) {
      await pgPool.query("SELECT setval(pg_get_serial_sequence('contacts', 'id'), COALESCE(max(id), 1)) FROM contacts");
    }

    console.log('--- Merge Process Complete ---');
    console.log(`- New contacts inserted: ${inserted}`);
    console.log(`- Existing contacts updated: ${updated}`);
    console.log(`- Unchanged contacts: ${unchanged}`);

    // Close connections
    if (sqliteDb) sqliteDb.close();
    if (pgPool) await pgPool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Merge failed:', err.message);
    if (sqliteDb) sqliteDb.close();
    if (pgPool) await pgPool.end().catch(() => {});
    process.exit(1);
  }
};

runMerge();
