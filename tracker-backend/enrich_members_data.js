require('dotenv').config();
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();

const dbDir = process.env.DATABASE_DIR || __dirname;
const sqlitePath = path.join(dbDir, 'database.sqlite');
let excelPath = path.join(__dirname, 'Members_Database.xlsx');
if (!fs.existsSync(excelPath)) {
  excelPath = path.join(__dirname, '../../PDFConverter/Members_Database.xlsx');
}
const photosDir = path.join(__dirname, 'extracted_photos');
const jsonPath = path.join(__dirname, 'contacts_data.json');

console.log('--- STARTING MEMBERS DATA ENRICHMENT ---');
console.log('Database Path:', sqlitePath);
console.log('Excel Source:', excelPath);
console.log('Photos Dir:', photosDir);

if (!fs.existsSync(excelPath)) {
  console.error('ERROR: Members_Database.xlsx not found at', excelPath);
  process.exit(1);
}

// 1. Helpers
function normalizeBloodGroup(bgRaw) {
  if (!bgRaw) return 'Unknown';
  let s = String(bgRaw).trim().toUpperCase();
  if (s === 'N/A' || s === 'UNKNOWN' || s === 'A N' || s.includes('@')) return 'Unknown';
  s = s.replace(/POSITIVE/g, '+').replace(/NEGATIVE/g, '-');
  s = s.replace(/-VE/g, '-').replace(/_VE/g, '-').replace(/\+VE/g, '+');
  s = s.replace(/-V/g, '-').replace(/_V/g, '-');
  s = s.replace(/--/g, '-');
  s = s.replace(/_/, '-');
  s = s.replace(/\s+/g, '');
  s = s.replace(/^0\+/, 'O+');
  if (['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(s)) {
    return s;
  }
  return 'Unknown';
}

function formatDate(raw) {
  if (!raw || raw === 'N/A') return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${day}/${month}/${year}`;
    }
    return trimmed;
  }
  if (typeof raw === 'number') {
    const dateObj = new Date(Math.round((raw - 25569) * 86400 * 1000));
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(raw).trim();
}

// 2. Build Photo Map
const photoMap = new Map(); // acc_code -> filename
if (fs.existsSync(photosDir)) {
  const photoFiles = fs.readdirSync(photosDir);
  console.log(`Found ${photoFiles.length} photo files in extracted_photos`);

  const edgeCases = {
    'HARI KUMAR CHAKKALAYIL NARAYANLAN N31A6I6R.png': 'L3166',
    'MANOJ DHAMODHARAN GIRIJA KUMALRY 4226.png': 'L4226',
    'MOHAMED RIYAZ K.V. (RIYAZ KILTONL) 3981.png': 'L3981',
    'PRAMOD VARILKOLILTHARAYIL GOVILNDA 3N319.png': 'L3319',
    'SHABBIR AHMED ALI MOIDEEN KUNHLI 3622.png': 'L3622'
  };

  for (const f of photoFiles) {
    if (edgeCases[f]) {
      photoMap.set(edgeCases[f], f);
      continue;
    }
    const m1 = f.match(/_([A-Za-z0-9]+)\.[a-zA-Z]+$/);
    if (m1) {
      photoMap.set(m1[1].toUpperCase(), f);
      continue;
    }
    const m2 = f.match(/[LlDd]\s*(\d+)/);
    if (m2) {
      photoMap.set('L' + m2[1], f);
      continue;
    }
  }
  console.log(`Mapped ${photoMap.size} photos to member account codes`);
} else {
  console.warn('WARNING: extracted_photos directory not found.');
}

// 3. Read Excel Data
const wb = xlsx.readFile(excelPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const excelRows = xlsx.utils.sheet_to_json(sheet);
console.log(`Read ${excelRows.length} member rows from Excel`);

const excelMap = new Map();
for (const r of excelRows) {
  const idRaw = r['ID No'] || r['acc_code'] || r['AccCode'];
  if (!idRaw) continue;
  const cleanId = String(idRaw).replace(/\s+/g, '').toUpperCase();
  excelMap.set(cleanId, {
    dob: formatDate(r['DATE OF BIRTH']),
    doj: formatDate(r['DATE OF JOIN']),
    bloodGroup: normalizeBloodGroup(r['BLOOD GROUP'])
  });
}
console.log(`Indexed ${excelMap.size} records from Excel by ID`);

// 4. Update SQLite Database
async function enrichSQLite() {
  if (!fs.existsSync(sqlitePath)) {
    console.log('SQLite database does not exist yet at', sqlitePath);
    return;
  }

  const db = new sqlite3.Database(sqlitePath);

  const runSql = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

  const querySql = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log('Running SQLite schema migrations (adding columns if missing)...');
  const addColumnSafe = async (col, type) => {
    try {
      await runSql(`ALTER TABLE contacts ADD COLUMN ${col} ${type}`);
      console.log(`Added column ${col} to contacts table`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.warn(`Note on column ${col}:`, e.message);
      }
    }
  };

  await addColumnSafe('date_of_birth', 'TEXT DEFAULT ""');
  await addColumnSafe('date_of_join', 'TEXT DEFAULT ""');
  await addColumnSafe('blood_group', 'TEXT DEFAULT ""');
  await addColumnSafe('photo_filename', 'TEXT DEFAULT ""');
  await addColumnSafe('birthday_sent_year', 'INTEGER DEFAULT 0');

  const contacts = await querySql('SELECT id, acc_code, account_name FROM contacts');
  console.log(`Enriching ${contacts.length} SQLite contacts...`);

  let updatedCount = 0;
  let photoCount = 0;
  let excelMatchCount = 0;

  await runSql('BEGIN TRANSACTION');
  const updateStmt = db.prepare(`
    UPDATE contacts 
    SET date_of_birth = ?, date_of_join = ?, blood_group = ?, photo_filename = ?
    WHERE id = ?
  `);

  for (const c of contacts) {
    const code = (c.acc_code || '').replace(/\s+/g, '').toUpperCase();
    const excelInfo = excelMap.get(code);
    const photo = photoMap.get(code) || '';

    let dob = '';
    let doj = '';
    let bloodGroup = '';

    if (excelInfo) {
      dob = excelInfo.dob || '';
      doj = excelInfo.doj || '';
      bloodGroup = excelInfo.bloodGroup || '';
      excelMatchCount++;
    }

    if (photo) photoCount++;

    updateStmt.run(dob, doj, bloodGroup, photo, c.id);
    updatedCount++;
  }

  await new Promise((resolve, reject) => {
    updateStmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await runSql('COMMIT');
  console.log(`SQLite Enrichment Completed!`);
  console.log(`- Total contacts updated: ${updatedCount}`);
  console.log(`- Matched with Excel (DOB/DOJ/Blood Group): ${excelMatchCount}`);
  console.log(`- Photos attached: ${photoCount}`);

  await new Promise(r => db.close(r));
}

// 5. Update contacts_data.json
function enrichJsonFile() {
  if (!fs.existsSync(jsonPath)) {
    console.warn('contacts_data.json not found, skipping json file update.');
    return;
  }

  const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let matched = 0;
  let photos = 0;

  for (const c of list) {
    const code = (c.accCode || c.acc_code || '').replace(/\s+/g, '').toUpperCase();
    const excelInfo = excelMap.get(code);
    const photo = photoMap.get(code) || '';

    if (excelInfo) {
      c.date_of_birth = excelInfo.dob || '';
      c.date_of_join = excelInfo.doj || '';
      c.blood_group = excelInfo.bloodGroup || '';
      matched++;
    } else {
      c.date_of_birth = c.date_of_birth || '';
      c.date_of_join = c.date_of_join || '';
      c.blood_group = c.blood_group || '';
    }

    if (photo) {
      c.photo_filename = photo;
      photos++;
    } else {
      c.photo_filename = c.photo_filename || '';
    }
  }

  fs.writeFileSync(jsonPath, JSON.stringify(list, null, 2), 'utf8');
  console.log(`Updated contacts_data.json with ${matched} Excel matches and ${photos} photos.`);
}

// Execute
(async () => {
  try {
    await enrichSQLite();
    enrichJsonFile();
    console.log('--- ENRICHMENT COMPLETE SUCCESSFULLY ---');
    process.exit(0);
  } catch (err) {
    console.error('Fatal enrichment error:', err);
    process.exit(1);
  }
})();
