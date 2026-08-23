require('dotenv').config();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const excelPath = path.join(__dirname, 'IAS Election Campaign Dashboard.xlsx');
const dbDir = process.env.DATABASE_DIR || __dirname;
const dbPath = path.join(dbDir, 'database.sqlite');
const backupPath = path.join(dbDir, 'database_backup.sqlite');

console.log('Starting Cloud Database Safe Sync...');
console.log('Excel Path:', excelPath);
console.log('Database Path:', dbPath);

if (!fs.existsSync(excelPath)) {
  console.error('Error: Excel file not found at', excelPath);
  process.exit(1);
}

const isPostgres = !!process.env.DATABASE_URL;
let db = null;
let pgPool = null;

if (isPostgres) {
  const { Pool } = require('pg');
  const { URL } = require('url');
  
  let sslConfig = { rejectUnauthorized: false };
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (['localhost', '127.0.0.1', '::1', ''].includes(dbUrl.hostname)) {
      sslConfig = false;
    }
  } catch (e) {}

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
  });
  console.log('PostgreSQL configuration detected for sync. Connecting to PostgreSQL...');
} else {
  if (!fs.existsSync(dbPath)) {
    console.error('Error: SQLite database not found at', dbPath);
    process.exit(1);
  }

  // 1. Safety backup (SQLite only)
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log('Safety backup created at:', backupPath);
  } catch (err) {
    console.warn('Warning: Could not create safety backup:', err.message);
  }

  // 2. Connect to SQLite database
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error connecting to SQLite:', err.message);
      process.exit(1);
    }
    // Ensure table columns exist
    db.serialize(() => {
      db.run("ALTER TABLE contacts ADD COLUMN emirate TEXT", (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Migration error adding emirate:", alterErr.message);
        }
      });
      db.run("ALTER TABLE contacts ADD COLUMN district TEXT", (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Migration error adding district:", alterErr.message);
        }
      });
      db.run("ALTER TABLE contacts ADD COLUMN assigned_to TEXT DEFAULT 'Unassigned'", (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name")) {
          console.error("Migration error adding assigned_to:", alterErr.message);
        }
      });
      db.run("ALTER TABLE contacts ADD COLUMN area TEXT", (alterErr) => {
        if (alterErr && !alterErr.message.includes("duplicate column name") && !alterErr.message.includes("duplicate column")) {
          console.error("Migration error adding area:", alterErr.message);
        }
      });
    });
  });
}

// Convert SQLite '?' parameter placeholder to Postgres '$1, $2'
const convertSql = (sql) => {
  let converted = sql;
  let index = 1;
  converted = converted.replace(/\?/g, () => `$${index++}`);
  return converted;
};

// Database abstraction helpers
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (isPostgres) {
      pgPool.query(convertSql(sql), params, (err, result) => {
        if (err) reject(err);
        else resolve(result.rows[0] || null);
      });
    } else {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    }
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (isPostgres) {
      pgPool.query(convertSql(sql), params, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    } else {
      db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }
  });
};

const dbClose = () => {
  if (isPostgres) {
    pgPool.end();
  } else {
    db.close();
  }
};

// 3. Load Excel
const workbook = xlsx.readFile(excelPath);
const sheet = workbook.Sheets['Members'];
const rows = xlsx.utils.sheet_to_json(sheet, { range: 2 });
console.log(`Loaded ${rows.length} rows from Excel Members sheet.`);

// Helper to format mobile numbers
const formatMobile = (mobileRaw) => {
  if (!mobileRaw) return '';
  const cleaned = String(mobileRaw).replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('05')) {
    return '971' + cleaned.substring(1);
  }
  if (cleaned.startsWith('5')) {
    return '971' + cleaned;
  }
  return cleaned;
};

let newCount = 0;
let updateCount = 0;
let activeRows = [];

// Filter empty rows first
rows.forEach((row) => {
  const iasId = String(row['IAS ID'] || '').trim().replace(/\.0$/, '');
  if (iasId && iasId !== 'undefined') {
    activeRows.push(row);
  }
});

console.log(`Found ${activeRows.length} active member records to process.`);

if (activeRows.length === 0) {
  console.log('No active records to process. Exiting.');
  dbClose();
  process.exit(0);
}

// Run sequentially or track callbacks to ensure proper termination
const processNext = (index) => {
  if (index >= activeRows.length) {
    console.log('\n--- Sync Completed ---');
    console.log(`- Safety Backup: ${isPostgres ? 'N/A (Cloud Backup)' : backupPath}`);
    console.log(`- New contacts added to DB: ${newCount}`);
    console.log(`- Existing contacts updated in DB: ${updateCount}`);
    dbClose();
    return;
  }

  const row = activeRows[index];
  const iasId = String(row['IAS ID'] || '').trim().replace(/\.0$/, '');
  const type = String(row['Type'] || '').trim();
  const accCode = `${type}${iasId}`;
  
  const name = String(row['Member Name'] || '').trim();
  const mobile = formatMobile(row['Mobile (UAE)']);
  const email = String(row['Email'] || '').trim();
  const sNo = String(row['S.No'] || '').trim().replace(/\.0$/, '');
  
  const emirate = String(row['Emirate'] || '').trim();
  const district = String(row['District'] || '').trim();
  const assignedTo = String(row['Assigned To'] || 'Unassigned').trim();

  dbGet("SELECT id, account_name, mobile_number, email_id, emirate, district, assigned_to FROM contacts WHERE acc_code = ?", [accCode])
    .then((dbMatch) => {
      if (!dbMatch) {
        dbRun(`
          INSERT INTO contacts (
            s_no, acc_code, account_name, mobile_number, email_id,
            email_status, email_sent_date,
            whatsapp_status, whatsapp_sent_date,
            call_status, call_sent_date, notes,
            member_reaction, exit_poll_status,
            emirate, district, assigned_to
          ) VALUES (?, ?, ?, ?, ?, 'Pending', '', 'Pending', '', 'Not Called', '', '', 'Unknown', 'Pending', ?, ?, ?)
        `, [sNo, accCode, name, mobile, email, emirate, district, assignedTo])
          .then(() => {
            newCount++;
            processNext(index + 1);
          })
          .catch((insertErr) => {
            console.error(`Error inserting ${accCode}:`, insertErr.message);
            processNext(index + 1);
          });
      } else {
        const updateFields = [];
        const params = [];

        if (dbMatch.account_name !== name && name !== '') {
          updateFields.push("account_name = ?");
          params.push(name);
        }
        if (dbMatch.mobile_number !== mobile && mobile !== '') {
          updateFields.push("mobile_number = ?");
          params.push(mobile);
        }
        if (dbMatch.email_id !== email && email !== '') {
          updateFields.push("email_id = ?");
          params.push(email);
        }
        if (dbMatch.emirate !== emirate && emirate !== '') {
          updateFields.push("emirate = ?");
          params.push(emirate);
        }
        if (dbMatch.district !== district && district !== '') {
          updateFields.push("district = ?");
          params.push(district);
        }
        if (dbMatch.assigned_to !== assignedTo && assignedTo !== '') {
          updateFields.push("assigned_to = ?");
          params.push(assignedTo);
        }

        if (updateFields.length > 0) {
          params.push(accCode);
          const updateQuery = `UPDATE contacts SET ${updateFields.join(', ')} WHERE acc_code = ?`;
          dbRun(updateQuery, params)
            .then(() => {
              updateCount++;
              processNext(index + 1);
            })
            .catch((updateErr) => {
              console.error(`Error updating ${accCode}:`, updateErr.message);
              processNext(index + 1);
            });
        } else {
          processNext(index + 1);
        }
      }
    })
    .catch((err) => {
      console.error(`Error checking acc_code ${accCode}:`, err.message);
      processNext(index + 1);
    });
};

// Start sequential processing
processNext(0);
