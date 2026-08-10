const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

const dbDir = process.env.DATABASE_DIR || __dirname;
const dbPath = path.join(dbDir, 'database.sqlite');

// Auto-initialize DB if it doesn't exist (e.g. fresh Railway Persistent Volume)
const fs = require('fs');
if (!fs.existsSync(dbPath)) {
  console.log('SQLite database file not found. Auto-initializing database...');
  try {
    let jsonPath = path.join(__dirname, '../contacts_data.json');
    if (!fs.existsSync(jsonPath)) {
      const fallbacks = [
        path.join(__dirname, 'contacts_data.json'),
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
          call_status TEXT DEFAULT 'Not Called',
          call_sent_date TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          member_reaction TEXT DEFAULT 'Unknown',
          exit_poll_status TEXT DEFAULT 'Pending'
        )`);
        
        const stmt = initDb.prepare(`INSERT INTO contacts (
          s_no, acc_code, account_name, mobile_number, email_id, 
          email_status, email_sent_date, 
          whatsapp_status, whatsapp_sent_date, 
          call_status, call_sent_date, notes,
          member_reaction, exit_poll_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
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
            'Pending'
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

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper for query execution
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// GET all contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await query(`
      SELECT id, s_no, acc_code, account_name, mobile_number, email_id, 
             email_status, email_sent_date, 
             whatsapp_status, whatsapp_sent_date, 
             call_status, call_sent_date, notes,
             member_reaction, exit_poll_status
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
  const { s_no, acc_code, account_name, mobile_number, email_id } = req.body;
  try {
    const result = await run(`
      INSERT INTO contacts (s_no, acc_code, account_name, mobile_number, email_id)
      VALUES (?, ?, ?, ?, ?)
    `, [s_no, acc_code, account_name, mobile_number, email_id]);
    
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
    call_status,
    call_sent_date,
    notes,
    member_reaction,
    exit_poll_status
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
      call_status: call_status !== undefined ? call_status : existing.call_status,
      call_sent_date: call_sent_date !== undefined ? call_sent_date : existing.call_sent_date,
      notes: notes !== undefined ? notes : existing.notes,
      member_reaction: member_reaction !== undefined ? member_reaction : existing.member_reaction,
      exit_poll_status: exit_poll_status !== undefined ? exit_poll_status : existing.exit_poll_status
    };

    await run(`
      UPDATE contacts 
      SET email_status = ?, email_sent_date = ?, 
          whatsapp_status = ?, whatsapp_sent_date = ?, 
          call_status = ?, call_sent_date = ?, notes = ?,
          member_reaction = ?, exit_poll_status = ?
      WHERE id = ?
    `, [
      updated.email_status,
      updated.email_sent_date,
      updated.whatsapp_status,
      updated.whatsapp_sent_date,
      updated.call_status,
      updated.call_sent_date,
      updated.notes,
      updated.member_reaction,
      updated.exit_poll_status,
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
  const { ids, status, date } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid ids array' });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      UPDATE contacts 
      SET whatsapp_status = ?, whatsapp_sent_date = ? 
      WHERE id IN (${placeholders})
    `;
    const result = await run(sql, [status, date, ...ids]);
    res.json({ success: true, updated: result.changes });
  } catch (error) {
    console.error('Error in bulk whatsapp update:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET campaign analytics / stats
app.get('/api/stats', async (req, res) => {
  const today = req.query.today || new Date().toISOString().split('T')[0];
  try {
    // Total contacts
    const [totalRow] = await query('SELECT count(*) as total FROM contacts');
    const total = totalRow.total;

    // Missing Email and Phone
    const [missingEmailRow] = await query("SELECT count(*) as count FROM contacts WHERE email_id = '' OR email_id IS NULL");
    const [missingMobileRow] = await query("SELECT count(*) as count FROM contacts WHERE mobile_number = '' OR mobile_number IS NULL");

    // Duplicate statistics (Email/Mobile counts sharing same address, excluding blanks)
    const [dupEmailRow] = await query(`
      SELECT count(*) as count FROM contacts 
      WHERE email_id != '' AND email_id IS NOT NULL 
      AND email_id IN (
        SELECT email_id FROM contacts 
        WHERE email_id != '' AND email_id IS NOT NULL 
        GROUP BY email_id HAVING count(*) > 1
      )
    `);
    
    const [dupMobileRow] = await query(`
      SELECT count(*) as count FROM contacts 
      WHERE mobile_number != '' AND mobile_number IS NOT NULL 
      AND mobile_number IN (
        SELECT mobile_number FROM contacts 
        WHERE mobile_number != '' AND mobile_number IS NOT NULL 
        GROUP BY mobile_number HAVING count(*) > 1
      )
    `);

    // Email campaigns status counts
    const emailStatuses = await query('SELECT email_status, count(*) as count FROM contacts GROUP BY email_status');
    // WhatsApp campaign status counts
    const whatsappStatuses = await query('SELECT whatsapp_status, count(*) as count FROM contacts GROUP BY whatsapp_status');
    // Call campaign status counts
    const callStatuses = await query('SELECT call_status, count(*) as count FROM contacts GROUP BY call_status');

    // Sentiment breakdown (member_reaction)
    const reactionRows = await query('SELECT member_reaction, count(*) as count FROM contacts GROUP BY member_reaction');
    
    // Exit Poll status breakdown
    const exitPollRows = await query('SELECT exit_poll_status, count(*) as count FROM contacts GROUP BY exit_poll_status');

    // Counts for TODAY
    const [emailTodayRow] = await query('SELECT count(*) as count FROM contacts WHERE email_status = "Sent" AND email_sent_date = ?', [today]);
    const [whatsappTodayRow] = await query('SELECT count(*) as count FROM contacts WHERE whatsapp_status = "Sent" AND whatsapp_sent_date = ?', [today]);
    const [callTodayRow] = await query('SELECT count(*) as count FROM contacts WHERE call_status != "Not Called" AND call_sent_date = ?', [today]);

    // Format outputs
    const stats = {
      totalContacts: total,
      missingEmail: missingEmailRow.count,
      missingMobile: missingMobileRow.count,
      duplicateEmail: dupEmailRow.count,
      duplicateMobile: dupMobileRow.count,
      email: {
        pending: 0,
        sent: 0,
        undelivered: 0,
        sentToday: emailTodayRow.count
      },
      whatsapp: {
        pending: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        sentToday: whatsappTodayRow.count
      },
      call: {
        notCalled: 0,
        connected: 0,
        busy: 0,
        noAnswer: 0,
        leftMessage: 0,
        failed: 0,
        calledToday: callTodayRow.count
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
        votedUnknown: 0
      }
    };

    // Fill counts
    emailStatuses.forEach(r => {
      const status = r.email_status.toLowerCase();
      if (status === 'pending') stats.email.pending = r.count;
      else if (status === 'sent') stats.email.sent = r.count;
      else if (status === 'undelivered') stats.email.undelivered = r.count;
    });

    whatsappStatuses.forEach(r => {
      const status = r.whatsapp_status.toLowerCase();
      if (status === 'pending') stats.whatsapp.pending = r.count;
      else if (status === 'sent') stats.whatsapp.sent = r.count;
      else if (status === 'delivered') stats.whatsapp.delivered = r.count;
      else if (status === 'failed') stats.whatsapp.failed = r.count;
    });

    callStatuses.forEach(r => {
      const status = r.call_status.toLowerCase();
      if (status === 'not called') stats.call.notCalled = r.count;
      else if (status === 'connected') stats.call.connected = r.count;
      else if (status === 'busy') stats.call.busy = r.count;
      else if (status === 'no answer') stats.call.noAnswer = r.count;
      else if (status === 'left message') stats.call.leftMessage = r.count;
      else if (status === 'failed') stats.call.failed = r.count;
    });

    reactionRows.forEach(r => {
      const reaction = r.member_reaction;
      if (reaction === 'Strong Support (Panel)') stats.reactions.strong = r.count;
      else if (reaction === 'Leaning Support (Anil Kumar only)') stats.reactions.leaning = r.count;
      else if (reaction === 'Undecided / Needs Follow-up') stats.reactions.undecided = r.count;
      else if (reaction === 'Opposed') stats.reactions.opposed = r.count;
      else stats.reactions.unknown += r.count;
    });

    exitPollRows.forEach(r => {
      const status = r.exit_poll_status;
      if (status === 'Pending') stats.exitPoll.pending = r.count;
      else if (status === 'Secured') stats.exitPoll.secured = r.count;
      else if (status === 'Lost') stats.exitPoll.lost = r.count;
      else if (status === 'Voted-Unknown') stats.exitPoll.votedUnknown = r.count;
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching analytics stats:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Campaign Tracker Backend listening on http://localhost:${PORT}`);
});
