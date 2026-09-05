require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// E.164 Phone number formatting helper for SMS gateway (Textbee)
const formatE164Mobile = (mobileRaw) => {
  if (!mobileRaw) return '';
  let cleaned = String(mobileRaw).replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('05')) cleaned = '971' + cleaned.substring(1);
  else if (cleaned.startsWith('5')) cleaned = '971' + cleaned;
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
};

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Capture rawBody for HMAC-SHA256 webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const fs = require('fs');
let dbDir = process.env.DATABASE_DIR || __dirname;

// Test write access to dbDir, fallback to __dirname if not writable
try {
  fs.mkdirSync(dbDir, { recursive: true });
  const testFile = path.join(dbDir, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
} catch (e) {
  console.warn(`WARNING: Database directory "${dbDir}" is not writable. Falling back to local directory.`);
  dbDir = __dirname;
}

const dbPath = path.join(dbDir, 'database.sqlite');

let isPostgres = !!process.env.DATABASE_URL;
let db = null;
let pgPool = null;

// Convert SQLite '?' parameter placeholder to Postgres '$1, $2'
const convertSql = (sql) => {
  let converted = sql;
  let index = 1;
  converted = converted.replace(/\?/g, () => `$${index++}`);
  return converted;
};

// Helper for query execution
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (isPostgres) {
      pgPool.query(convertSql(sql), params, (err, result) => {
        if (err) reject(err);
        else resolve(result.rows);
      });
    } else {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (isPostgres) {
      let querySql = convertSql(sql);
      let isInsert = querySql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !querySql.toUpperCase().includes('RETURNING')) {
        querySql += ' RETURNING id';
      }
      pgPool.query(querySql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          const lastID = isInsert && result.rows && result.rows[0] ? result.rows[0].id : null;
          resolve({ id: lastID, changes: result.rowCount });
        }
      });
    } else {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    }
  });
};

// Automated Excel-to-Database Sync Utility
const syncExcelDataOnStartup = async () => {
  try {
    let excelPath = path.join(__dirname, 'IAS Election Campaign Dashboard.xlsx');
    if (!fs.existsSync(excelPath)) {
      excelPath = path.join(__dirname, '../IAS Election Campaign Dashboard.xlsx');
    }
    
    if (!fs.existsSync(excelPath)) {
      console.log('Sync Excel file not found on startup.');
      return;
    }
    
    console.log('Starting automatic Excel to database sync on startup...');
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets['Members'];
    if (!sheet) {
      console.log('Excel sheet "Members" not found.');
      return;
    }
    
    const rows = xlsx.utils.sheet_to_json(sheet, { range: 2 });
    const activeRows = rows.filter(row => {
      const iasId = String(row['IAS ID'] || '').trim().replace(/\.0$/, '');
      return iasId && iasId !== 'undefined';
    });
    
    console.log(`Processing ${activeRows.length} active records from Excel...`);
    
    const formatMobile = (mobileRaw) => {
      if (!mobileRaw) return '';
      const cleaned = String(mobileRaw).replace(/\D/g, '');
      if (!cleaned) return '';
      if (cleaned.startsWith('05')) return '971' + cleaned.substring(1);
      if (cleaned.startsWith('5')) return '971' + cleaned;
      return cleaned;
    };

    let newCount = 0;
    let updateCount = 0;

    for (const row of activeRows) {
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

      const dbMatch = await query("SELECT id, account_name, mobile_number, email_id, emirate, district, assigned_to FROM contacts WHERE acc_code = ?", [accCode]);
      
      if (dbMatch.length === 0) {
        await run(`
          INSERT INTO contacts (
            s_no, acc_code, account_name, mobile_number, email_id,
            email_status, email_sent_date,
            whatsapp_status, whatsapp_sent_date,
            call_status, call_sent_date, notes,
            member_reaction, exit_poll_status,
            emirate, district, assigned_to
          ) VALUES (?, ?, ?, ?, ?, 'Pending', '', 'Pending', '', 'Not Called', '', '', 'Unknown', 'Pending', ?, ?, ?)
        `, [sNo, accCode, name, mobile, email, emirate, district, assignedTo]);
        newCount++;
      } else {
        // Contact already exists. Do not overwrite or update to protect active campaign edits.
      }
    }
    
    console.log(`Auto Excel Sync complete on startup: ${newCount} added, ${updateCount} updated.`);
  } catch (syncErr) {
    console.error('Error during startup Excel sync:', syncErr.message);
  }
};

// Postgres Auto-Initialization helper
const initPostgresDB = async () => {
  try {
    // 1. Create volunteers table first to guarantee it exists before any data/sync operations
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS volunteers (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);
    console.log('PostgreSQL volunteers table schema ready.');

    const checkTable = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contacts'
      )
    `);
    
    const tableExists = checkTable.rows[0].exists;
    if (!tableExists) {
      console.log('PostgreSQL contacts table not found. Creating table...');
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
          sms_status TEXT DEFAULT 'Pending',
          sms_sent_date TEXT DEFAULT '',
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
      console.log('PostgreSQL contacts table created.');
    } else {
      console.log('PostgreSQL contacts table is ready.');
      try {
        await pgPool.query("ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_acc_code_key");
      } catch (e) {
        console.log("Unique constraint contacts_acc_code_key drop attempted.");
      }
      try {
        await pgPool.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS emirate TEXT");
        await pgPool.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS district TEXT");
        await pgPool.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT 'Unassigned'");
        await pgPool.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'Active'");
        await pgPool.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS area TEXT");
        await pgPool.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sms_status TEXT DEFAULT 'Pending'");
        await pgPool.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sms_sent_date TEXT DEFAULT ''");
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS incoming_sms (
            id SERIAL PRIMARY KEY,
            sms_id TEXT,
            sender TEXT,
            contact_id INTEGER,
            contact_name TEXT,
            message TEXT,
            received_at TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (migrateErr) {
        console.log("PostgreSQL schema migrations ran successfully.");
      }
    }

    // Verify row count to decide on pre-seeding
    const countRes = await pgPool.query("SELECT count(*) FROM contacts");
    const rowCount = parseInt(countRes.rows[0].count, 10);
    
    if (rowCount === 0) {
      let jsonPath = path.join(__dirname, 'contacts_data.json');
      if (!fs.existsSync(jsonPath)) {
        jsonPath = path.join(__dirname, '../contacts_data.json');
      }
      if (fs.existsSync(jsonPath)) {
        const contacts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log(`Pre-seeding PostgreSQL with ${contacts.length} default records...`);
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
              $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}
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
              'Pending'
            );
          }
          
          const bulkQuery = `
            INSERT INTO contacts (
              s_no, acc_code, account_name, mobile_number, email_id,
              email_status, email_sent_date,
              whatsapp_status, whatsapp_sent_date,
              call_status, call_sent_date, notes,
              member_reaction, exit_poll_status
            ) VALUES ${valueRows.join(', ')}
          `;
          await pgPool.query(bulkQuery, params);
        }
        console.log('PostgreSQL database successfully pre-seeded!');
      } else {
        console.warn('Warning: contacts_data.json not found for pre-seeding.');
      }
      // Auto-seed volunteers from contacts table prior to running Excel sync (to make sure it exists)
      await pgPool.query(`
        INSERT INTO volunteers (name)
        SELECT DISTINCT assigned_to FROM contacts
        WHERE assigned_to IS NOT NULL AND assigned_to != '' AND assigned_to != 'Unassigned'
        ON CONFLICT (name) DO NOTHING
      `);
      console.log('PostgreSQL volunteers table seeded.');

      // Run Excel synchronization once database table and seeding are fully completed
      await syncExcelDataOnStartup();
    } else {
      console.log('PostgreSQL database already contains records. Skipping startup seeding and Excel sync to protect active campaign data.');
    }
  } catch (err) {
    console.error('Error during PostgreSQL auto-initialization:', err.message);
  }
};

const initSqliteDB = () => {
  console.log('Defaulting to local SQLite database setup...');
  
  // Auto-initialize DB if it doesn't exist (e.g. fresh Railway Persistent Volume)
  if (!fs.existsSync(dbPath)) {
    console.log('SQLite database file not found. Auto-initializing database...');
    try {
      let jsonPath = path.join(__dirname, 'contacts_data.json');
      if (!fs.existsSync(jsonPath)) {
        const fallbacks = [
          path.join(__dirname, '../contacts_data.json'),
          '/app/contacts_data.json'
        ];
        for (const p of fallbacks) {
          if (fs.existsSync(p)) {
            jsonPath = p;
            break;
          }
        }
      }

      if (fs.existsSync(jsonPath)) {
        const contacts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const initDb = new sqlite3.Database(dbPath);
        initDb.serialize(() => {
          initDb.run(`CREATE TABLE IF NOT EXISTS contacts (
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
            sms_status TEXT DEFAULT 'Pending',
            sms_sent_date TEXT DEFAULT '',
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
          )`);
          
          const stmt = initDb.prepare(`INSERT INTO contacts (
            s_no, acc_code, account_name, mobile_number, email_id, 
            email_status, email_sent_date, 
            whatsapp_status, whatsapp_sent_date, 
            call_status, call_sent_date, notes,
            member_reaction, exit_poll_status,
            emirate, district, assigned_to
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          
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
              'Unknown',
              'Pending',
              contact.emirate || '',
              contact.district || '',
              contact.assigned_to || 'Unassigned'
            );
          }
          stmt.finalize();
        });
        initDb.close();
        console.log(`SQLite database successfully initialized with ${contacts.length} records.`);
      } else {
        console.error('Error: contacts_data.json was not found in any search path.');
      }
    } catch (dbErr) {
      console.error('Failed to auto-initialize SQLite database:', dbErr.message);
    }
  }

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error connecting to SQLite database:', err.message);
    } else {
      console.log('Connected to SQLite database at:', dbPath);
      // Run self-healing schema migrations on startup to add new columns and tables if they are missing
      db.serialize(() => {
        // Create volunteers table first
        db.run(`CREATE TABLE IF NOT EXISTS volunteers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL
        )`, (err) => {
          if (err) console.error("Error creating SQLite volunteers table:", err.message);
        });

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
        db.run("ALTER TABLE contacts ADD COLUMN account_status TEXT DEFAULT 'Active'", (alterErr) => {
          if (alterErr && !alterErr.message.includes("duplicate column name")) {
            console.error("Migration error adding account_status:", alterErr.message);
          }
        });
        db.run("ALTER TABLE contacts ADD COLUMN area TEXT", (alterErr) => {
          if (alterErr && !alterErr.message.includes("duplicate column name") && !alterErr.message.includes("duplicate column")) {
            console.error("Migration error adding area:", alterErr.message);
          }
        });
        db.run("ALTER TABLE contacts ADD COLUMN sms_status TEXT DEFAULT 'Pending'", (alterErr) => {
          if (alterErr && !alterErr.message.includes("duplicate column name") && !alterErr.message.includes("duplicate column")) {
            console.error("Migration error adding sms_status:", alterErr.message);
          }
        });
        db.run("ALTER TABLE contacts ADD COLUMN sms_sent_date TEXT DEFAULT ''", (alterErr) => {
          if (alterErr && !alterErr.message.includes("duplicate column name") && !alterErr.message.includes("duplicate column")) {
            console.error("Migration error adding sms_sent_date:", alterErr.message);
          }
        });
        db.run(`CREATE TABLE IF NOT EXISTS incoming_sms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sms_id TEXT,
          sender TEXT,
          contact_id INTEGER,
          contact_name TEXT,
          message TEXT,
          received_at TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) console.error("Error creating SQLite incoming_sms table:", err.message);
        });

        // Run volunteers seeding and Excel sync ONLY if SQLite database is completely empty on startup
        db.get("SELECT count(*) as count FROM contacts", (countErr, row) => {
          if (!countErr && row && row.count === 0) {
            console.log("SQLite database is empty. Running auto-seeding and Excel sync...");
            db.run(`INSERT OR IGNORE INTO volunteers (name)
              SELECT DISTINCT assigned_to FROM contacts
              WHERE assigned_to IS NOT NULL AND assigned_to != '' AND assigned_to != 'Unassigned'`, (err) => {
                if (err) console.error("Error seeding SQLite volunteers table:", err.message);
                else console.log("SQLite volunteers table ready and seeded.");
              });
            syncExcelDataOnStartup().catch(err => {
              console.error("Error during SQLite startup Excel sync:", err.message);
            });
          } else {
            console.log("SQLite database already contains records. Skipping startup seeding and Excel sync to protect active campaign data.");
          }
        });
      });
    }
  });
};

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
  console.log('PostgreSQL configuration detected. Testing connection...');
  
  pgPool.query('SELECT 1')
    .then(() => {
      console.log('PostgreSQL connection successful. Initializing Postgres...');
      initPostgresDB();
    })
    .catch((err) => {
      console.warn('PostgreSQL connection failed. Falling back to local SQLite database...', err.message);
      isPostgres = false;
      initSqliteDB();
    });
} else {
  initSqliteDB();
}

// GET all volunteers
app.get('/api/volunteers', async (req, res) => {
  try {
    const list = await query("SELECT name FROM volunteers ORDER BY name ASC");
    res.json(list.map(r => r.name));
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST add a volunteer
app.post('/api/volunteers', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Volunteer name is required' });
  }
  const cleanName = name.trim();
  try {
    const match = await query("SELECT id FROM volunteers WHERE name = ?", [cleanName]);
    if (match.length > 0) {
      return res.status(400).json({ error: 'Volunteer name already exists' });
    }
    await run("INSERT INTO volunteers (name) VALUES (?)", [cleanName]);
    res.status(201).json({ success: true, name: cleanName });
  } catch (error) {
    console.error('Error adding volunteer:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE a volunteer
app.delete('/api/volunteers/:name', async (req, res) => {
  const { name } = req.params;
  try {
    await run("DELETE FROM volunteers WHERE name = ?", [name]);
    await run("UPDATE contacts SET assigned_to = 'Unassigned' WHERE assigned_to = ?", [name]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST bulk assign contacts to volunteer
app.post('/api/contacts/bulk-assign', async (req, res) => {
  const { ids, assigned_to } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid ids array' });
  }
  const volunteerName = assigned_to || 'Unassigned';
  try {
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      UPDATE contacts 
      SET assigned_to = ?
      WHERE id IN (${placeholders})
    `;
    const result = await run(sql, [volunteerName, ...ids]);
    res.json({ success: true, updated: result.changes });
  } catch (error) {
    console.error('Error in bulk volunteer assign:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST bulk import / update contacts matching by acc_code
app.post('/api/contacts/bulk-import', async (req, res) => {
  const { contacts: incomingContacts, insertNew = true } = req.body;
  if (!Array.isArray(incomingContacts) || incomingContacts.length === 0) {
    return res.status(400).json({ error: 'No contacts provided in array' });
  }

  try {
    // 1. Fetch existing contacts to match by acc_code in-memory
    const existingList = await query(`
      SELECT id, s_no, acc_code, account_name, mobile_number, email_id,
             district, area, emirate, assigned_to, member_reaction, notes, account_status
      FROM contacts
    `);

    const existingMap = new Map();
    for (const c of existingList) {
      if (c.acc_code) {
        existingMap.set(String(c.acc_code).trim().toUpperCase(), c);
      }
    }

    let updatedCount = 0;
    let insertedCount = 0;
    let unchangedCount = 0;
    let skippedNoCode = 0;

    for (let i = 0; i < incomingContacts.length; i++) {
      const row = incomingContacts[i];
      const accCodeRaw = row.acc_code !== undefined && row.acc_code !== null ? String(row.acc_code).trim().replace(/\.0$/, '') : '';
      if (!accCodeRaw) {
        skippedNoCode++;
        continue;
      }

      const match = existingMap.get(accCodeRaw.toUpperCase());

      // Format mobile if provided
      let formattedMobile = undefined;
      if (row.mobile_number !== undefined && row.mobile_number !== null) {
        const rawMob = String(row.mobile_number).trim();
        if (rawMob) {
          let cleaned = rawMob.replace(/\D/g, '');
          if (cleaned.startsWith('00971')) cleaned = '971' + cleaned.substring(5);
          else if (cleaned.startsWith('05') && cleaned.length === 10) cleaned = '971' + cleaned.substring(1);
          else if (cleaned.startsWith('5') && cleaned.length === 9) cleaned = '971' + cleaned;
          formattedMobile = cleaned;
        }
      }

      if (match) {
        // Build updates for non-empty provided fields
        const updates = [];
        const params = [];

        const checkAndUpdate = (colName, incomingVal, currentVal) => {
          if (incomingVal !== undefined && incomingVal !== null) {
            const strVal = String(incomingVal).trim();
            if (strVal && strVal !== String(currentVal || '').trim()) {
              updates.push(`${colName} = ?`);
              params.push(strVal);
            }
          }
        };

        checkAndUpdate('account_name', row.account_name, match.account_name);
        if (formattedMobile && formattedMobile !== (match.mobile_number || '')) {
          updates.push('mobile_number = ?');
          params.push(formattedMobile);
        }
        checkAndUpdate('email_id', row.email_id, match.email_id);
        checkAndUpdate('district', row.district, match.district);
        checkAndUpdate('area', row.area, match.area);
        checkAndUpdate('emirate', row.emirate, match.emirate);
        checkAndUpdate('assigned_to', row.assigned_to, match.assigned_to);
        checkAndUpdate('member_reaction', row.member_reaction, match.member_reaction);
        checkAndUpdate('notes', row.notes, match.notes);
        checkAndUpdate('account_status', row.account_status, match.account_status);

        if (row.s_no !== undefined && row.s_no !== null && Number(row.s_no) > 0) {
          const snoNum = parseInt(row.s_no, 10);
          if (snoNum !== match.s_no) {
            updates.push('s_no = ?');
            params.push(snoNum);
          }
        }

        if (updates.length > 0) {
          params.push(match.id);
          const updateSql = `UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`;
          await run(updateSql, params);
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } else if (insertNew) {
        // Insert new contact
        const name = row.account_name ? String(row.account_name).trim() : 'Unknown';
        const mobile = formattedMobile || '';
        const email = row.email_id ? String(row.email_id).trim() : '';
        const district = row.district ? String(row.district).trim() : '';
        const area = row.area ? String(row.area).trim() : '';
        const emirate = row.emirate ? String(row.emirate).trim() : '';
        const assigned_to = row.assigned_to ? String(row.assigned_to).trim() : 'Unassigned';
        const reaction = row.member_reaction ? String(row.member_reaction).trim() : 'Unknown';
        const notes = row.notes ? String(row.notes).trim() : '';
        const status = row.account_status ? String(row.account_status).trim() : 'Active';
        const sNo = row.s_no ? parseInt(row.s_no, 10) || 0 : 0;

        const insertSql = `
          INSERT INTO contacts (
            s_no, acc_code, account_name, mobile_number, email_id, 
            district, area, emirate, assigned_to, member_reaction, notes, account_status,
            email_status, whatsapp_status, sms_status, call_status, exit_poll_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Pending', 'Pending', 'Not Called', 'Pending')
        `;
        const insertParams = [
          sNo, accCodeRaw, name, mobile, email,
          district, area, emirate, assigned_to, reaction, notes, status
        ];
        const resInsert = await run(insertSql, insertParams);
        insertedCount++;

        // Cache in existingMap
        existingMap.set(accCodeRaw.toUpperCase(), {
          id: resInsert.id,
          acc_code: accCodeRaw,
          account_name: name,
          mobile_number: mobile,
          email_id: email,
          district, area, emirate, assigned_to, member_reaction: reaction, notes, account_status: status, s_no: sNo
        });
      } else {
        unchangedCount++;
      }
    }

    // Reset Postgres sequence if new contacts were inserted
    if (isPostgres && insertedCount > 0) {
      await pgPool.query("SELECT setval(pg_get_serial_sequence('contacts', 'id'), COALESCE(max(id), 1)) FROM contacts");
    }

    res.json({
      success: true,
      total: incomingContacts.length,
      updated: updatedCount,
      inserted: insertedCount,
      unchanged: unchangedCount,
      skippedNoCode
    });
  } catch (error) {
    console.error('Error in bulk contacts import:', error);
    res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

// GET all contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await query(`
      SELECT id, s_no, acc_code, account_name, mobile_number, email_id, 
             email_status, email_sent_date, 
             whatsapp_status, whatsapp_sent_date, 
             sms_status, sms_sent_date,
             call_status, call_sent_date, notes,
             member_reaction, exit_poll_status,
             emirate, district, assigned_to, account_status, area
      FROM contacts 
      ORDER BY s_no ASC
    `);
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST create a new contact
app.post('/api/contacts', async (req, res) => {
  const { s_no, acc_code, account_name, mobile_number, email_id, area } = req.body;
  try {
    const result = await run(`
      INSERT INTO contacts (s_no, acc_code, account_name, mobile_number, email_id, area)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [s_no, acc_code, account_name, mobile_number, email_id, area]);
    
    const [row] = await query('SELECT * FROM contacts WHERE id = ?', [result.id]);
    res.status(201).json(row);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT update contact status
app.put('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const {
    email_status,
    email_sent_date,
    whatsapp_status,
    whatsapp_sent_date,
    sms_status,
    sms_sent_date,
    call_status,
    call_sent_date,
    notes,
    member_reaction,
    exit_poll_status,
    emirate,
    district,
    assigned_to,
    account_status,
    area
  } = req.body;

  try {
    // Get existing contact to merge values if some are undefined
    const [existing] = await query('SELECT * FROM contacts WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updated = {
      email_status: email_status !== undefined ? email_status : existing.email_status,
      email_sent_date: email_sent_date !== undefined ? email_sent_date : existing.email_sent_date,
      whatsapp_status: whatsapp_status !== undefined ? whatsapp_status : existing.whatsapp_status,
      whatsapp_sent_date: whatsapp_sent_date !== undefined ? whatsapp_sent_date : existing.whatsapp_sent_date,
      sms_status: sms_status !== undefined ? sms_status : existing.sms_status,
      sms_sent_date: sms_sent_date !== undefined ? sms_sent_date : existing.sms_sent_date,
      call_status: call_status !== undefined ? call_status : existing.call_status,
      call_sent_date: call_sent_date !== undefined ? call_sent_date : existing.call_sent_date,
      notes: notes !== undefined ? notes : existing.notes,
      member_reaction: member_reaction !== undefined ? member_reaction : existing.member_reaction,
      exit_poll_status: exit_poll_status !== undefined ? exit_poll_status : existing.exit_poll_status,
      emirate: emirate !== undefined ? emirate : existing.emirate,
      district: district !== undefined ? district : existing.district,
      assigned_to: assigned_to !== undefined ? assigned_to : existing.assigned_to,
      account_status: account_status !== undefined ? account_status : existing.account_status,
      area: area !== undefined ? area : existing.area
    };

    await run(`
      UPDATE contacts 
      SET email_status = ?, email_sent_date = ?, 
          whatsapp_status = ?, whatsapp_sent_date = ?, 
          sms_status = ?, sms_sent_date = ?,
          call_status = ?, call_sent_date = ?, notes = ?,
          member_reaction = ?, exit_poll_status = ?,
          emirate = ?, district = ?, assigned_to = ?,
          account_status = ?, area = ?
      WHERE id = ?
    `, [
      updated.email_status,
      updated.email_sent_date,
      updated.whatsapp_status,
      updated.whatsapp_sent_date,
      updated.sms_status,
      updated.sms_sent_date,
      updated.call_status,
      updated.call_sent_date,
      updated.notes,
      updated.member_reaction,
      updated.exit_poll_status,
      updated.emirate,
      updated.district,
      updated.assigned_to,
      updated.account_status,
      updated.area,
      id
    ]);

    // Fetch the updated contact row
    const [row] = await query('SELECT * FROM contacts WHERE id = ?', [id]);
    res.json(row);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST bulk update email status
app.post('/api/contacts/bulk-email', async (req, res) => {
  const { ids, status, date } = req.body; // ids: [1, 2, 3], status: 'Sent', date: '2026-08-09'
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid ids array' });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      UPDATE contacts 
      SET email_status = ?, email_sent_date = ? 
      WHERE id IN (${placeholders})
    `;
    const result = await run(sql, [status, date, ...ids]);
    res.json({ success: true, updated: result.changes });
  } catch (error) {
    console.error('Error in bulk email update:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST bulk update whatsapp status
app.post('/api/contacts/bulk-whatsapp', async (req, res) => {
  const { ids, status, date, sentiment } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid ids array' });
  }

  try {
    const batchSize = 500;
    let totalUpdated = 0;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const placeholders = batch.map(() => '?').join(',');
      let sql;
      let params;
      if (sentiment && sentiment.trim() && sentiment !== 'Keep Current' && sentiment !== 'All') {
        sql = `
          UPDATE contacts 
          SET whatsapp_status = ?, whatsapp_sent_date = ?, member_reaction = ? 
          WHERE id IN (${placeholders})
        `;
        params = [status, date, sentiment, ...batch];
      } else {
        sql = `
          UPDATE contacts 
          SET whatsapp_status = ?, whatsapp_sent_date = ? 
          WHERE id IN (${placeholders})
        `;
        params = [status, date, ...batch];
      }
      const result = await run(sql, params);
      totalUpdated += (result.changes || 0);
    }
    res.json({ success: true, updated: totalUpdated });
  } catch (error) {
    console.error('Error in bulk whatsapp update:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST bulk update call status
app.post('/api/contacts/bulk-call', async (req, res) => {
  const { ids, status, date } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid ids array' });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      UPDATE contacts 
      SET call_status = ?, call_sent_date = ? 
      WHERE id IN (${placeholders})
    `;
    const result = await run(sql, [status, date, ...ids]);
    res.json({ success: true, updated: result.changes });
  } catch (error) {
    console.error('Error in bulk call update:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST bulk update voter sentiment
app.post('/api/contacts/bulk-sentiment', async (req, res) => {
  const { ids, sentiment } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid ids array' });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      UPDATE contacts 
      SET member_reaction = ? 
      WHERE id IN (${placeholders})
    `;
    const result = await run(sql, [sentiment, ...ids]);
    res.json({ success: true, updated: result.changes });
  } catch (error) {
    console.error('Error in bulk sentiment update:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET check if Textbee API key and webhook are configured
app.get('/api/sms/config', (req, res) => {
  res.json({
    isConfigured: !!(process.env.TEXTBEE_API_KEY && process.env.TEXTBEE_API_KEY.trim()),
    hasDeviceId: !!(process.env.TEXTBEE_DEVICE_ID && process.env.TEXTBEE_DEVICE_ID.trim()),
    hasWebhookSecret: !!(process.env.TEXTBEE_WEBHOOK_SECRET && process.env.TEXTBEE_WEBHOOK_SECRET.trim()),
    webhookUrl: '/api/sms/webhook'
  });
});

// POST send single SMS via Textbee
app.post('/api/sms/send', async (req, res) => {
  const { id, mobileNumber, message } = req.body;
  const apiKey = (process.env.TEXTBEE_API_KEY || '').trim();
  const deviceId = (process.env.TEXTBEE_DEVICE_ID || '').trim();

  if (!apiKey) {
    return res.status(400).json({ error: 'TEXTBEE_API_KEY is not configured in backend .env file.' });
  }

  let targetPhone = mobileNumber;
  let finalMessage = message;
  let contact = null;

  if (id) {
    const [row] = await query('SELECT * FROM contacts WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    contact = row;
    targetPhone = row.mobile_number;
    if (message) {
      finalMessage = message
        .replace(/{Name}/g, row.account_name || '')
        .replace(/{AccCode}/g, row.acc_code || '')
        .replace(/{SerialNo}/g, String(row.s_no || ''));
    }
  }

  const e164 = formatE164Mobile(targetPhone);
  if (!e164 || e164.length < 8) {
    if (contact) {
      await run("UPDATE contacts SET sms_status = 'Failed' WHERE id = ?", [contact.id]);
    }
    return res.status(400).json({ error: 'Invalid or missing mobile number' });
  }

  try {
    const payload = {
      recipients: [e164],
      message: finalMessage
    };
    if (deviceId) {
      payload.deviceId = deviceId;
    }

    const response = await axios.post('https://api.textbee.dev/api/v1/gateway/send-sms', payload, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const today = new Date().toISOString().split('T')[0];
    if (contact) {
      await run("UPDATE contacts SET sms_status = 'Sent', sms_sent_date = ? WHERE id = ?", [today, contact.id]);
      const [updated] = await query('SELECT * FROM contacts WHERE id = ?', [contact.id]);
      return res.json({ success: true, data: response.data, contact: updated });
    }

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error sending SMS via Textbee:', error.response?.data || error.message);
    if (contact) {
      await run("UPDATE contacts SET sms_status = 'Failed' WHERE id = ?", [contact.id]);
    }
    res.status(500).json({ 
      error: error.response?.data?.message || error.message || 'Failed to trigger Android SMS' 
    });
  }
});

// POST bulk broadcast SMS via Textbee with carrier pacing delay
app.post('/api/sms/broadcast', async (req, res) => {
  const { ids, messageTemplate, delayMs = 2000 } = req.body;
  const apiKey = (process.env.TEXTBEE_API_KEY || '').trim();
  const deviceId = (process.env.TEXTBEE_DEVICE_ID || '').trim();

  if (!apiKey) {
    return res.status(400).json({ error: 'TEXTBEE_API_KEY is not configured in backend .env file.' });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No contact IDs provided for broadcast.' });
  }

  if (!messageTemplate || !messageTemplate.trim()) {
    return res.status(400).json({ error: 'Message template is required.' });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const contacts = await query(`SELECT * FROM contacts WHERE id IN (${placeholders})`, ids);
    const today = new Date().toISOString().split('T')[0];

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const e164 = formatE164Mobile(contact.mobile_number);

      if (!e164 || e164.length < 8) {
        await run("UPDATE contacts SET sms_status = 'Failed' WHERE id = ?", [contact.id]);
        failedCount++;
        results.push({ id: contact.id, name: contact.account_name, status: 'Failed', reason: 'Invalid phone number' });
        continue;
      }

      const finalMsg = messageTemplate
        .replace(/{Name}/g, contact.account_name || '')
        .replace(/{AccCode}/g, contact.acc_code || '')
        .replace(/{SerialNo}/g, String(contact.s_no || ''));

      try {
        const payload = {
          recipients: [e164],
          message: finalMsg
        };
        if (deviceId) {
          payload.deviceId = deviceId;
        }

        await axios.post('https://api.textbee.dev/api/v1/gateway/send-sms', payload, {
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        await run("UPDATE contacts SET sms_status = 'Sent', sms_sent_date = ? WHERE id = ?", [today, contact.id]);
        sentCount++;
        results.push({ id: contact.id, name: contact.account_name, status: 'Sent' });
      } catch (err) {
        console.error(`Error sending SMS to ${contact.account_name} (${e164}):`, err.response?.data || err.message);
        await run("UPDATE contacts SET sms_status = 'Failed' WHERE id = ?", [contact.id]);
        failedCount++;
        results.push({ id: contact.id, name: contact.account_name, status: 'Failed', reason: err.response?.data?.message || err.message });
      }

      // Carrier pacing delay between messages (if more messages remain)
      if (i < contacts.length - 1 && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    res.json({
      success: true,
      total: contacts.length,
      sentCount,
      failedCount,
      results
    });
  } catch (error) {
    console.error('Error in SMS broadcast:', error);
    res.status(500).json({ error: 'Database or server error during SMS broadcast' });
  }
});

// POST bulk update sms status manually
app.post('/api/contacts/bulk-sms', async (req, res) => {
  const { ids, status, date } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid ids array' });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      UPDATE contacts 
      SET sms_status = ?, sms_sent_date = ? 
      WHERE id IN (${placeholders})
    `;
    const result = await run(sql, [status, date, ...ids]);
    res.json({ success: true, updated: result.changes });
  } catch (error) {
    console.error('Error in bulk sms update:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Helper: Webhook signature verification (HMAC-SHA256)
const verifyTextbeeSignature = (rawBody, signatureHeader, secret) => {
  if (!secret) {
    return { valid: true, warning: 'TEXTBEE_WEBHOOK_SECRET is not set in .env. Skipping HMAC verification.' };
  }
  if (!signatureHeader) {
    return { valid: false, error: 'Missing X-Signature header' };
  }
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = hmac.update(rawBody || '').digest('hex');

    const cleanSig = signatureHeader.trim().toLowerCase();
    const sigBuf = Buffer.from(cleanSig, 'hex');
    const expBuf = Buffer.from(expectedSignature, 'hex');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Invalid HMAC-SHA256 signature' };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Signature verification exception: ${err.message}` };
  }
};

// Helper: Robust phone search matching local & international formats
const findContactByPhone = async (phoneNumber) => {
  if (!phoneNumber) return null;
  const digits = String(phoneNumber).replace(/\D/g, '');
  if (!digits || digits.length < 7) return null;

  const last9 = digits.slice(-9);
  const last7 = digits.slice(-7);
  const e164 = formatE164Mobile(phoneNumber);

  const rows = await query(`
    SELECT * FROM contacts 
    WHERE mobile_number = ? 
       OR mobile_number = ? 
       OR mobile_number LIKE ? 
       OR mobile_number LIKE ?
    LIMIT 1
  `, [phoneNumber, e164, `%${last9}%`, `%${last7}%`]);

  return rows && rows.length > 0 ? rows[0] : null;
};

// POST /api/sms/webhook - Textbee Webhook endpoint
app.post('/api/sms/webhook', async (req, res) => {
  const signature = req.headers['x-signature'] || req.headers['x-hub-signature'];
  const secret = (process.env.TEXTBEE_WEBHOOK_SECRET || '').trim();

  // Signature check
  const verification = verifyTextbeeSignature(req.rawBody, signature, secret);
  if (!verification.valid) {
    console.warn(`[Textbee Webhook] Rejected: ${verification.error}`);
    return res.status(401).json({ error: verification.error });
  }

  if (verification.warning) {
    console.warn(`[Textbee Webhook] Notice: ${verification.warning}`);
  }

  const payload = req.body || {};
  const eventType = payload.webhookEvent || payload.event || '';
  console.log(`[Textbee Webhook] Received event: ${eventType || 'UNKNOWN'}`);

  // Return 200 OK immediately (< 50ms) to satisfy Textbee 10-second timeout window
  res.status(200).json({ success: true, message: 'Webhook event received' });

  // Process event in background
  try {
    const today = new Date().toISOString().split('T')[0];

    // Case 1: Status Update Events (MESSAGE_DELIVERED, MESSAGE_SENT, MESSAGE_FAILED, SMS_STATUS_UPDATED)
    if (
      eventType === 'MESSAGE_DELIVERED' ||
      eventType === 'MESSAGE_SENT' ||
      eventType === 'MESSAGE_FAILED' ||
      eventType === 'SMS_STATUS_UPDATED' ||
      payload.status
    ) {
      const recipientPhone = payload.recipient || payload.recipients?.[0] || payload.to || payload.phone || payload.sender;
      const statusRaw = (payload.status || eventType || '').toUpperCase();

      let targetStatus = 'Sent';
      if (statusRaw.includes('FAIL') || statusRaw.includes('REJECT') || statusRaw.includes('UNDELIV')) {
        targetStatus = 'Failed';
      } else if (statusRaw.includes('DELIVER') || statusRaw.includes('SENT') || statusRaw.includes('SUCCESS')) {
        targetStatus = 'Sent';
      }

      if (recipientPhone) {
        const contact = await findContactByPhone(recipientPhone);
        if (contact) {
          await run(
            "UPDATE contacts SET sms_status = ?, sms_sent_date = ? WHERE id = ?",
            [targetStatus, today, contact.id]
          );
          console.log(`[Textbee Webhook] Updated #${contact.id} (${contact.account_name}) SMS status to ${targetStatus}`);
        }
      }
    }

    // Case 2: Incoming Message Events (MESSAGE_RECEIVED)
    if (eventType === 'MESSAGE_RECEIVED' || (!eventType && payload.sender && payload.message)) {
      const senderPhone = payload.sender;
      const messageText = payload.message || '';
      const smsId = payload.smsId || payload.id || '';
      const receivedAt = payload.receivedAt || new Date().toISOString();

      const contact = await findContactByPhone(senderPhone);
      const contactId = contact ? contact.id : null;
      const contactName = contact ? contact.account_name : 'Unknown';

      await run(`
        INSERT INTO incoming_sms (sms_id, sender, contact_id, contact_name, message, received_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [smsId, senderPhone, contactId, contactName, messageText, receivedAt]);

      console.log(`[Textbee Webhook] Recorded incoming SMS from ${contactName} (${senderPhone}): "${messageText}"`);

      // Append note to contact record
      if (contact) {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date().toLocaleDateString('en-GB');
        const noteEntry = `[SMS In ${dateStr} ${timeStr}]: ${messageText}`;
        const updatedNotes = contact.notes ? `${contact.notes}\n${noteEntry}` : noteEntry;
        await run("UPDATE contacts SET notes = ? WHERE id = ?", [updatedNotes, contact.id]);
      }
    }
  } catch (err) {
    console.error('[Textbee Webhook] Error processing event:', err);
  }
});

// GET /api/sms/inbox - Retrieve recent incoming SMS messages
app.get('/api/sms/inbox', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const rows = await query(`
      SELECT * FROM incoming_sms 
      ORDER BY id DESC 
      LIMIT ?
    `, [limit]);
    res.json(rows || []);
  } catch (error) {
    console.error('Error fetching incoming SMS inbox:', error);
    res.status(500).json({ error: 'Failed to fetch incoming SMS inbox' });
  }
});

// GET campaign analytics / stats
app.get('/api/stats', async (req, res) => {
  const today = req.query.today || new Date().toISOString().split('T')[0];
  try {
    // Total contacts
    const [totalRow] = await query("SELECT count(*) as total FROM contacts WHERE account_status = 'Active'");
    const total = totalRow.total;

    // Missing Email and Phone
    const [missingEmailRow] = await query("SELECT count(*) as count FROM contacts WHERE (email_id = '' OR email_id IS NULL) AND account_status = 'Active'");
    const [missingMobileRow] = await query("SELECT count(*) as count FROM contacts WHERE (mobile_number = '' OR mobile_number IS NULL) AND account_status = 'Active'");

    // Duplicate statistics (Email/Mobile counts sharing same address, excluding blanks)
    const [dupEmailRow] = await query(`
      SELECT count(*) as count FROM contacts 
      WHERE email_id != '' AND email_id IS NOT NULL AND account_status = 'Active'
      AND email_id IN (
        SELECT email_id FROM contacts 
        WHERE email_id != '' AND email_id IS NOT NULL AND account_status = 'Active'
        GROUP BY email_id HAVING count(*) > 1
      )
    `);
    
    const [dupMobileRow] = await query(`
      SELECT count(*) as count FROM contacts 
      WHERE mobile_number != '' AND mobile_number IS NOT NULL AND account_status = 'Active'
      AND mobile_number IN (
        SELECT mobile_number FROM contacts 
        WHERE mobile_number != '' AND mobile_number IS NOT NULL AND account_status = 'Active'
        GROUP BY mobile_number HAVING count(*) > 1
      )
    `);

    // Email campaigns status counts
    const emailStatuses = await query("SELECT email_status, count(*) as count FROM contacts WHERE account_status = 'Active' GROUP BY email_status");
    // WhatsApp campaign status counts
    const whatsappStatuses = await query("SELECT whatsapp_status, count(*) as count FROM contacts WHERE account_status = 'Active' GROUP BY whatsapp_status");
    // Call campaign status counts
    const callStatuses = await query("SELECT call_status, count(*) as count FROM contacts WHERE account_status = 'Active' GROUP BY call_status");
    // SMS campaign status counts
    const smsStatuses = await query("SELECT sms_status, count(*) as count FROM contacts WHERE account_status = 'Active' GROUP BY sms_status");

    // Sentiment breakdown (member_reaction)
    const reactionRows = await query("SELECT member_reaction, count(*) as count FROM contacts WHERE account_status = 'Active' GROUP BY member_reaction");
    
    // Exit Poll status breakdown
    const exitPollRows = await query("SELECT exit_poll_status, count(*) as count FROM contacts WHERE account_status = 'Active' GROUP BY exit_poll_status");

    // Counts for TODAY
    const [emailTodayRow] = await query("SELECT count(*) as count FROM contacts WHERE email_status = 'Sent' AND email_sent_date = ? AND account_status = 'Active'", [today]);
    const [whatsappTodayRow] = await query("SELECT count(*) as count FROM contacts WHERE whatsapp_status = 'Sent' AND whatsapp_sent_date = ? AND account_status = 'Active'", [today]);
    const [callTodayRow] = await query("SELECT count(*) as count FROM contacts WHERE call_status != 'Not Called' AND call_sent_date = ? AND account_status = 'Active'", [today]);
    const [smsTodayRow] = await query("SELECT count(*) as count FROM contacts WHERE sms_status = 'Sent' AND sms_sent_date = ? AND account_status = 'Active'", [today]);

    // Emirate grouping
    const emirateRows = await query(`
      SELECT COALESCE(NULLIF(emirate, ''), 'Not recorded') as emirate,
             count(*) as total,
             sum(case when call_status != 'Not Called' then 1 else 0 end) as contacted,
             sum(case when member_reaction in ('Strong Support (Panel)', 'Leaning Support (Anil Kumar only)') then 1 else 0 end) as positive
      FROM contacts
      WHERE account_status = 'Active'
      GROUP BY emirate
      ORDER BY total DESC
    `);

    // District grouping
    const districtRows = await query(`
      SELECT COALESCE(NULLIF(district, ''), 'Unmatched - check') as district,
             count(*) as total,
             sum(case when call_status != 'Not Called' then 1 else 0 end) as contacted,
             sum(case when member_reaction in ('Strong Support (Panel)', 'Leaning Support (Anil Kumar only)') then 1 else 0 end) as positive
      FROM contacts
      WHERE account_status = 'Active'
      GROUP BY district
      ORDER BY total DESC
    `);

    // Volunteer grouping
    const volunteerRows = await query(`
      SELECT COALESCE(NULLIF(assigned_to, ''), 'Unassigned') as assigned_to,
             count(*) as assigned,
             sum(case when call_status != 'Not Called' then 1 else 0 end) as done,
             sum(case when member_reaction in ('Strong Support (Panel)', 'Leaning Support (Anil Kumar only)') then 1 else 0 end) as positive
      FROM contacts
      WHERE account_status = 'Active'
      GROUP BY assigned_to
      ORDER BY assigned DESC
    `);

    // Response breakdown counts
    const [breakdownPositive] = await query("SELECT count(*) as count FROM contacts WHERE member_reaction IN ('Strong Support (Panel)', 'Leaning Support (Anil Kumar only)') AND account_status = 'Active'");
    const [breakdownFollowup] = await query("SELECT count(*) as count FROM contacts WHERE call_status IN ('Busy', 'Reminder Request', 'Left Message') AND (member_reaction IS NULL OR member_reaction NOT IN ('Strong Support (Panel)', 'Leaning Support (Anil Kumar only)')) AND account_status = 'Active'");
    const [breakdownUndecided] = await query("SELECT count(*) as count FROM contacts WHERE member_reaction = 'Undecided / Needs Follow-up' AND account_status = 'Active'");
    const [breakdownNegative] = await query("SELECT count(*) as count FROM contacts WHERE member_reaction = 'Opposed' AND account_status = 'Active'");
    const [breakdownUnreachable] = await query("SELECT count(*) as count FROM contacts WHERE call_status IN ('No Response', 'Switched Off', 'No Answer', 'Failed') AND account_status = 'Active'");
    const [breakdownNotContacted] = await query("SELECT count(*) as count FROM contacts WHERE call_status = 'Not Called' AND account_status = 'Active'");

    // Format outputs
    const stats = {
      totalContacts: parseInt(total || 0, 10),
      missingEmail: parseInt(missingEmailRow.count || 0, 10),
      missingMobile: parseInt(missingMobileRow.count || 0, 10),
      duplicateEmail: parseInt(dupEmailRow.count || 0, 10),
      duplicateMobile: parseInt(dupMobileRow.count || 0, 10),
      email: {
        pending: 0,
        sent: 0,
        undelivered: 0,
        sentToday: parseInt(emailTodayRow.count || 0, 10)
      },
      whatsapp: {
        pending: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        totalSent: 0,
        sentToday: parseInt(whatsappTodayRow.count || 0, 10)
      },
      sms: {
        pending: 0,
        sent: 0,
        failed: 0,
        sentToday: parseInt(smsTodayRow.count || 0, 10)
      },
      call: {
        notCalled: 0,
        connected: 0,
        busy: 0,
        noAnswer: 0,
        leftMessage: 0,
        failed: 0,
        noResponse: 0,
        outOfCountry: 0,
        switchedOff: 0,
        reminderRequest: 0,
        totalSent: 0,
        totalCalled: 0,
        calledToday: parseInt(callTodayRow.count || 0, 10)
      },
      reactions: {
        strong: 0,
        leaning: 0,
        undecided: 0,
        opposed: 0,
        unknown: 0
      },
      exitPoll: {
        pending: 0,
        secured: 0,
        lost: 0,
        votedUnknown: 0,
        totalLogged: 0
      },
      byEmirate: emirateRows.map(r => ({
        emirate: r.emirate,
        total: parseInt(r.total || 0, 10),
        contacted: parseInt(r.contacted || 0, 10),
        positive: parseInt(r.positive || 0, 10)
      })),
      byDistrict: districtRows.map(r => ({
        district: r.district,
        total: parseInt(r.total || 0, 10),
        contacted: parseInt(r.contacted || 0, 10),
        positive: parseInt(r.positive || 0, 10)
      })),
      byVolunteer: volunteerRows.map(r => ({
        assigned_to: r.assigned_to,
        assigned: parseInt(r.assigned || 0, 10),
        done: parseInt(r.done || 0, 10),
        positive: parseInt(r.positive || 0, 10)
      })),
      excelBreakdown: {
        positive: parseInt(breakdownPositive.count || 0, 10),
        followup: parseInt(breakdownFollowup.count || 0, 10),
        undecided: parseInt(breakdownUndecided.count || 0, 10),
        negative: parseInt(breakdownNegative.count || 0, 10),
        unreachable: parseInt(breakdownUnreachable.count || 0, 10),
        notContacted: parseInt(breakdownNotContacted.count || 0, 10),
      }
    };

    // Fill counts
    emailStatuses.forEach(r => {
      const status = (r.email_status || '').toLowerCase();
      const count = parseInt(r.count || 0, 10);
      if (status === 'pending') stats.email.pending = count;
      else if (status === 'sent') stats.email.sent = count;
      else if (status === 'undelivered') stats.email.undelivered = count;
    });

    whatsappStatuses.forEach(r => {
      const status = (r.whatsapp_status || '').toLowerCase();
      const count = parseInt(r.count || 0, 10);
      if (status === 'pending') stats.whatsapp.pending = count;
      else if (status === 'sent') stats.whatsapp.sent = count;
      else if (status === 'delivered') stats.whatsapp.delivered = count;
      else if (status === 'failed') stats.whatsapp.failed = count;
    });
    stats.whatsapp.totalSent = stats.whatsapp.sent + stats.whatsapp.delivered;

    smsStatuses.forEach(r => {
      const status = (r.sms_status || '').toLowerCase();
      const count = parseInt(r.count || 0, 10);
      if (status === 'pending') stats.sms.pending = count;
      else if (status === 'sent') stats.sms.sent = count;
      else if (status === 'failed') stats.sms.failed = count;
    });

    callStatuses.forEach(r => {
      const status = (r.call_status || '').toLowerCase();
      const count = parseInt(r.count || 0, 10);
      if (status === 'not called') stats.call.notCalled = count;
      else if (status === 'connected') stats.call.connected = count;
      else if (status === 'busy') stats.call.busy = count;
      else if (status === 'no answer') stats.call.noAnswer = count;
      else if (status === 'left message') stats.call.leftMessage = count;
      else if (status === 'failed') stats.call.failed = count;
      else if (status === 'no response') stats.call.noResponse = count;
      else if (status === 'out of country') stats.call.outOfCountry = count;
      else if (status === 'switched off') stats.call.switchedOff = count;
      else if (status === 'reminder request') stats.call.reminderRequest = count;
    });
    stats.call.totalSent = Math.max(0, stats.totalContacts - stats.call.notCalled);
    stats.call.totalCalled = stats.call.totalSent;

    reactionRows.forEach(r => {
      const reaction = (r.member_reaction || '').trim();
      const count = parseInt(r.count || 0, 10);
      if (reaction === 'Strong Support (Panel)') stats.reactions.strong = count;
      else if (reaction === 'Leaning Support (Anil Kumar only)') stats.reactions.leaning = count;
      else if (reaction === 'Undecided / Needs Follow-up') stats.reactions.undecided = count;
      else if (reaction === 'Opposed') stats.reactions.opposed = count;
      else stats.reactions.unknown += count;
    });

    exitPollRows.forEach(r => {
      const rawStatus = (r.exit_poll_status || '').trim();
      const status = rawStatus.toLowerCase();
      const count = parseInt(r.count || 0, 10);
      if (status === 'secured') {
        stats.exitPoll.secured += count;
      } else if (status === 'lost') {
        stats.exitPoll.lost += count;
      } else if (status === 'voted-unknown' || status === 'votedunknown' || status === 'voted_unknown' || status === 'voted but secretive') {
        stats.exitPoll.votedUnknown += count;
      } else if (status === 'pending' || status === '' || status === 'unknown') {
        stats.exitPoll.pending += count;
      } else {
        stats.exitPoll.votedUnknown += count;
      }
    });
    stats.exitPoll.totalLogged = stats.exitPoll.secured + stats.exitPoll.lost + stats.exitPoll.votedUnknown;

    res.json(stats);
  } catch (error) {
    console.error('Error fetching analytics stats:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Campaign Tracker Backend listening on http://localhost:${PORT}`);
});
