const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbDir = process.env.DATABASE_DIR || __dirname;
const dbPath = path.join(dbDir, 'database.sqlite');
const jsonPath = path.join(__dirname, '../contacts_data.json');

// Check if JSON data file exists
if (!fs.existsSync(jsonPath)) {
  console.error(`Error: contacts_data.json not found at ${jsonPath}`);
  process.exit(1);
}

// Read contacts data
const contacts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`Loaded ${contacts.length} contacts from contacts_data.json`);

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
      exit_poll_status TEXT DEFAULT 'Pending'
    )
  `, (err) => {
    if (err) {
      console.error('Error creating contacts table:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('Created contacts table with Sentiment and Exit Poll columns.');

    // Prepare statement for bulk insert
    const stmt = db.prepare(`
      INSERT INTO contacts (
        s_no, acc_code, account_name, mobile_number, email_id, 
        email_status, email_sent_date, 
        whatsapp_status, whatsapp_sent_date, 
        call_status, call_sent_date, notes,
        member_reaction, exit_poll_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          'Pending'  // exit_poll_status
        );
      }
    });

    stmt.finalize((err) => {
      if (err) {
        console.error('Error finalising statement:', err.message);
      } else {
        console.log(`Successfully imported ${contacts.length} contacts into SQLite database.`);
      }
      db.close();
    });
  });
});
