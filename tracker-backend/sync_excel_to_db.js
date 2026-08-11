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

if (!fs.existsSync(dbPath)) {
  console.error('Error: SQLite database not found at', dbPath);
  process.exit(1);
}

// 1. Safety backup
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log('Safety backup created at:', backupPath);
} catch (err) {
  console.warn('Warning: Could not create safety backup:', err.message);
}

// 2. Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
});

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
  db.close();
  process.exit(0);
}

// Run sequentially or track callbacks to ensure proper termination
const processNext = (index) => {
  if (index >= activeRows.length) {
    console.log('\n--- Sync Completed ---');
    console.log(`- Safety Backup: ${backupPath}`);
    console.log(`- New contacts added to DB: ${newCount}`);
    console.log(`- Existing contacts updated in DB: ${updateCount}`);
    db.close();
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

  db.get("SELECT id, account_name, mobile_number, email_id FROM contacts WHERE acc_code = ?", [accCode], (err, dbMatch) => {
    if (err) {
      console.error(`Error checking acc_code ${accCode}:`, err.message);
      processNext(index + 1);
      return;
    }

    if (!dbMatch) {
      // Insert new contact with default campaign statuses (no data loss)
      db.run(`
        INSERT INTO contacts (
          s_no, acc_code, account_name, mobile_number, email_id,
          email_status, email_sent_date,
          whatsapp_status, whatsapp_sent_date,
          call_status, call_sent_date, notes,
          member_reaction, exit_poll_status
        ) VALUES (?, ?, ?, ?, ?, 'Pending', '', 'Pending', '', 'Not Called', '', '', 'Unknown', 'Pending')
      `, [sNo, accCode, name, mobile, email], (insertErr) => {
        if (insertErr) {
          console.error(`Error inserting ${accCode}:`, insertErr.message);
        } else {
          newCount++;
        }
        processNext(index + 1);
      });
    } else {
      // Check if detail updates are needed
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

      if (updateFields.length > 0) {
        params.push(accCode);
        const updateQuery = `UPDATE contacts SET {updateFields.join(', ')} WHERE acc_code = ?`;
        
        // Correct syntax bug in template string
        const updateQueryCorrected = `UPDATE contacts SET ${updateFields.join(', ')} WHERE acc_code = ?`;
        
        db.run(updateQueryCorrected, params, (updateErr) => {
          if (updateErr) {
            console.error(`Error updating ${accCode}:`, updateErr.message);
          } else {
            updateCount++;
          }
          processNext(index + 1);
        });
      } else {
        processNext(index + 1);
      }
    }
  });
};

// Start sequential processing
processNext(0);
