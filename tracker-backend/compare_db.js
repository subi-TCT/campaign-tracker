require('dotenv').config();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const excelPath = path.join(__dirname, 'IAS Election Campaign Dashboard.xlsx');
const dbDir = process.env.DATABASE_DIR || __dirname;
const dbPath = path.join(dbDir, 'database.sqlite');

const isPostgres = !!process.env.DATABASE_URL;
let db = null;
let pgPool = null;

const formatMobile = (mobileRaw) => {
  if (!mobileRaw) return '';
  const cleaned = String(mobileRaw).replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('05')) return '971' + cleaned.substring(1);
  if (cleaned.startsWith('5')) return '971' + cleaned;
  return cleaned;
};

// Convert SQLite '?' parameter placeholder to Postgres '$1, $2'
const convertSql = (sql) => {
  let converted = sql;
  let index = 1;
  converted = converted.replace(/\?/g, () => `$${index++}`);
  return converted;
};

const initDB = () => {
  return new Promise((resolve, reject) => {
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
      console.log('Connected to PostgreSQL for comparison.');
      resolve();
    } else {
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) reject(err);
        else {
          console.log('Connected to local SQLite for comparison.');
          resolve();
        }
      });
    }
  });
};

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

const closeDB = () => {
  if (isPostgres) {
    pgPool.end();
  } else {
    db.close();
  }
};

const runComparison = async () => {
  try {
    await initDB();
    
    if (!fs.existsSync(excelPath)) {
      console.error('Error: Excel file not found at', excelPath);
      closeDB();
      return;
    }
    
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets['Members'];
    const rows = xlsx.utils.sheet_to_json(sheet, { range: 2 });
    
    const excelRows = rows.filter(row => {
      const iasId = String(row['IAS ID'] || '').trim().replace(/\.0$/, '');
      return iasId && iasId !== 'undefined';
    });
    
    console.log(`Excel 'Members' Sheet has ${excelRows.length} active records.`);
    
    // Fetch all database records
    const dbRows = await query("SELECT acc_code, account_name, mobile_number, email_id, emirate, district, assigned_to FROM contacts");
    console.log(`Database has ${dbRows.length} total records.`);
    
    const dbMap = {};
    dbRows.forEach(r => {
      dbMap[r.acc_code] = r;
    });
    
    let perfectMatchCount = 0;
    let mismatchCount = 0;
    let missingInDb = 0;
    const mismatches = [];
    const missingKeys = [];
    
    excelRows.forEach(row => {
      const iasId = String(row['IAS ID'] || '').trim().replace(/\.0$/, '');
      const type = String(row['Type'] || '').trim();
      const accCode = `${type}${iasId}`;
      
      const name = String(row['Member Name'] || '').trim();
      const mobile = formatMobile(row['Mobile (UAE)']);
      const email = String(row['Email'] || '').trim();
      const emirate = String(row['Emirate'] || '').trim();
      const district = String(row['District'] || '').trim();
      const assignedTo = String(row['Assigned To'] || 'Unassigned').trim();
      
      const dbMatch = dbMap[accCode];
      
      if (!dbMatch) {
        missingInDb++;
        missingKeys.push(accCode);
      } else {
        const diffs = [];
        if ((dbMatch.account_name || '') !== name) diffs.push(`Name: DB="${dbMatch.account_name}" vs Excel="${name}"`);
        if ((dbMatch.mobile_number || '') !== mobile) diffs.push(`Mobile: DB="${dbMatch.mobile_number}" vs Excel="${mobile}"`);
        if ((dbMatch.email_id || '') !== email) diffs.push(`Email: DB="${dbMatch.email_id}" vs Excel="${email}"`);
        if ((dbMatch.emirate || '') !== emirate) diffs.push(`Emirate: DB="${dbMatch.emirate}" vs Excel="${emirate}"`);
        if ((dbMatch.district || '') !== district) diffs.push(`District: DB="${dbMatch.district}" vs Excel="${district}"`);
        if ((dbMatch.assigned_to || '') !== assignedTo) diffs.push(`AssignedTo: DB="${dbMatch.assigned_to}" vs Excel="${assignedTo}"`);
        
        if (diffs.length === 0) {
          perfectMatchCount++;
        } else {
          mismatchCount++;
          mismatches.push({ accCode, name, diffs });
        }
      }
    });
    
    console.log('\n========================================================');
    console.log('               DATABASE VS EXCEL CROSS-CHECK REPORT');
    console.log('========================================================');
    console.log(`1. Total Excel Rows:       ${excelRows.length}`);
    console.log(`2. Total Database Rows:    ${dbRows.length}`);
    console.log(`3. Perfectly Matching:     ${perfectMatchCount}`);
    console.log(`4. Mismatched Fields:      ${mismatchCount}`);
    console.log(`5. Missing in Database:    ${missingInDb}`);
    console.log('========================================================');
    
    if (missingInDb > 0) {
      console.log(`\n⚠️ Missing in Database keys (First 10):`);
      console.log(missingKeys.slice(0, 10).join(', '));
    }
    
    if (mismatchCount > 0) {
      console.log(`\n⚠️ Sample Field Mismatches (First 5):`);
      mismatches.slice(0, 5).forEach(m => {
        console.log(`- Contact Code: ${m.accCode} (${m.name})`);
        m.diffs.forEach(d => console.log(`  * ${d}`));
      });
    } else {
      console.log('\n✅ All matching records contain identical details across all fields!');
    }
    
    closeDB();
  } catch (err) {
    console.error('Comparison error:', err.message);
    closeDB();
  }
};

runComparison();
