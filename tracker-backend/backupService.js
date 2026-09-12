const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const xlsx = require('xlsx');

class BackupService {
  constructor(options = {}) {
    this.options = options;
    this.getDb = typeof options.getDb === 'function' ? options.getDb : () => options.db;
    this.query = options.query;
    this.getIsPostgres = typeof options.getIsPostgres === 'function' ? options.getIsPostgres : () => !!options.isPostgres;
    this.dbPath = options.dbPath || path.join(__dirname, 'database.sqlite');
    this.backupsDir = options.backupsDir || path.join(__dirname, 'backups');
    this.getEmailTransporter = options.getEmailTransporter || (() => null);

    // Ensure backups directory exists
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  // Helper: Format current timestamp for filenames
  getTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
  }

  // 1. Create Atomic SQLite Snapshot & Compress with Gzip
  async createDatabaseBackup() {
    const timestamp = this.getTimestamp();
    const rawBackupFilename = `backup_${timestamp}.sqlite`;
    const gzBackupFilename = `${rawBackupFilename}.gz`;
    const rawBackupPath = path.join(this.backupsDir, rawBackupFilename);
    const gzBackupPath = path.join(this.backupsDir, gzBackupFilename);

    if (this.getIsPostgres()) {
      // In PostgreSQL mode, export all tables as JSON/SQL dump
      const contacts = await this.query('SELECT * FROM contacts ORDER BY id ASC');
      const users = await this.query('SELECT id, username, volunteer_name, role, created_at FROM users ORDER BY id ASC');
      const dumpData = {
        exportDate: new Date().toISOString(),
        tables: { contacts, users }
      };
      const jsonDumpPath = path.join(this.backupsDir, `backup_${timestamp}_postgres.json`);
      fs.writeFileSync(jsonDumpPath, JSON.stringify(dumpData, null, 2));

      // Gzip compress
      const gzip = zlib.createGzip();
      const source = fs.createReadStream(jsonDumpPath);
      const destination = fs.createWriteStream(gzBackupPath);

      await new Promise((resolve, reject) => {
        source.pipe(gzip).pipe(destination).on('finish', resolve).on('error', reject);
      });

      fs.unlinkSync(jsonDumpPath);
      const stats = fs.statSync(gzBackupPath);
      return {
        filename: gzBackupFilename,
        path: gzBackupPath,
        size: stats.size,
        type: 'PostgreSQL JSON (Gzip)'
      };
    }

    // SQLite mode: Use atomic VACUUM INTO for zero-corruption live snapshot
    const safeTargetPath = rawBackupPath.replace(/\\/g, '/');
    const activeDb = this.getDb();
    if (!activeDb) {
      throw new Error('Active SQLite database instance is not available.');
    }
    await new Promise((resolve, reject) => {
      activeDb.run(`VACUUM INTO '${safeTargetPath}'`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Compress with Gzip
    await new Promise((resolve, reject) => {
      const gzip = zlib.createGzip({ level: 9 });
      const source = fs.createReadStream(rawBackupPath);
      const destination = fs.createWriteStream(gzBackupPath);
      source.pipe(gzip).pipe(destination).on('finish', resolve).on('error', reject);
    });

    // Remove uncompressed raw snapshot to conserve disk space
    if (fs.existsSync(rawBackupPath)) {
      fs.unlinkSync(rawBackupPath);
    }

    const stats = fs.statSync(gzBackupPath);
    return {
      filename: gzBackupFilename,
      path: gzBackupPath,
      size: stats.size,
      type: 'SQLite Database (Gzip)'
    };
  }

  // 2. Generate Rich Multi-Sheet Master Campaign Excel Workbook
  async createExcelMasterSnapshot() {
    const timestamp = this.getTimestamp();
    const excelFilename = `master_snapshot_${timestamp}.xlsx`;
    const excelPath = path.join(this.backupsDir, excelFilename);

    // Fetch contacts
    const contacts = await this.query(`
      SELECT 
        s_no AS "S.No",
        acc_code AS "IAS ID / Code",
        account_name AS "Member Name",
        mobile_number AS "Mobile (UAE)",
        email_id AS "Email",
        emirate AS "Emirate",
        district AS "District",
        area AS "Area / Location",
        blood_group AS "Blood Group",
        date_of_birth AS "Date of Birth",
        date_of_join AS "Date of Join",
        account_status AS "Account Status",
        assigned_to AS "Assigned Volunteer",
        call_status AS "Call Status",
        call_sent_date AS "Last Called Date",
        member_reaction AS "Voter Reaction",
        exit_poll_status AS "Exit Poll Status",
        notes AS "Notes",
        whatsapp_status AS "WhatsApp Status",
        sms_status AS "SMS Status",
        email_status AS "Email Status"
      FROM contacts
      ORDER BY id ASC
    `);

    // Fetch summary statistics
    const totalContacts = contacts.length;
    const emirateCounts = {};
    const districtCounts = {};
    const reactionCounts = { Strong: 0, Leaning: 0, Undecided: 0, Opposed: 0, Unknown: 0 };
    const exitPollCounts = { Secured: 0, Lost: 0, Pending: 0, Unknown: 0 };
    const callStatusCounts = {};

    contacts.forEach(c => {
      // Emirate
      const em = c['Emirate'] || 'Not Specified';
      emirateCounts[em] = (emirateCounts[em] || 0) + 1;

      // District
      const dist = c['District'] || 'Not Specified';
      districtCounts[dist] = (districtCounts[dist] || 0) + 1;

      // Reaction
      const rx = c['Voter Reaction'] || 'Unknown';
      reactionCounts[rx] = (reactionCounts[rx] || 0) + 1;

      // Exit Poll
      const ep = c['Exit Poll Status'] || 'Pending';
      exitPollCounts[ep] = (exitPollCounts[ep] || 0) + 1;

      // Call
      const cs = c['Call Status'] || 'Not Called';
      callStatusCounts[cs] = (callStatusCounts[cs] || 0) + 1;
    });

    const summaryRows = [
      { Metric: 'Total Registered Voters', Value: totalContacts },
      { Metric: 'Export Timestamp (GST)', Value: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }) },
      { Metric: '--- Voter Sentiments ---', Value: '' },
      { Metric: 'Strong Supporters', Value: reactionCounts['Strong'] || 0 },
      { Metric: 'Leaning Supporters', Value: reactionCounts['Leaning'] || 0 },
      { Metric: 'Undecided Voters', Value: reactionCounts['Undecided'] || 0 },
      { Metric: 'Opposed Voters', Value: reactionCounts['Opposed'] || 0 },
      { Metric: 'Unknown / Not Logged', Value: reactionCounts['Unknown'] || 0 },
      { Metric: '--- Exit Poll Status ---', Value: '' },
      { Metric: 'Secured Votes', Value: exitPollCounts['Secured'] || 0 },
      { Metric: 'Lost Votes', Value: exitPollCounts['Lost'] || 0 },
      { Metric: 'Pending Votes', Value: exitPollCounts['Pending'] || 0 }
    ];

    const emirateRows = Object.entries(emirateCounts).map(([emirate, count]) => ({
      Emirate: emirate,
      'Voter Count': count,
      'Percentage (%)': totalContacts > 0 ? ((count / totalContacts) * 100).toFixed(1) + '%' : '0%'
    }));

    const districtRows = Object.entries(districtCounts).map(([district, count]) => ({
      District: district,
      'Voter Count': count,
      'Percentage (%)': totalContacts > 0 ? ((count / totalContacts) * 100).toFixed(1) + '%' : '0%'
    }));

    // Fetch team accounts
    let users = [];
    try {
      users = await this.query(`
        SELECT id AS "User ID", username AS "Username", volunteer_name AS "Volunteer Name", role AS "Role", created_at AS "Created At"
        FROM users
        ORDER BY id ASC
      `);
    } catch (e) {
      users = [];
    }

    // Build Workbook
    const wb = xlsx.utils.book_new();

    const wsSummary = xlsx.utils.json_to_sheet(summaryRows);
    xlsx.utils.book_append_sheet(wb, wsSummary, 'Campaign Overview');

    const wsVoters = xlsx.utils.json_to_sheet(contacts);
    xlsx.utils.book_append_sheet(wb, wsVoters, 'Voters & Contacts');

    const wsEmirates = xlsx.utils.json_to_sheet(emirateRows);
    xlsx.utils.book_append_sheet(wb, wsEmirates, 'By Emirate');

    const wsDistricts = xlsx.utils.json_to_sheet(districtRows);
    xlsx.utils.book_append_sheet(wb, wsDistricts, 'By District');

    if (users.length > 0) {
      const wsUsers = xlsx.utils.json_to_sheet(users);
      xlsx.utils.book_append_sheet(wb, wsUsers, 'Campaign Volunteers');
    }

    xlsx.writeFile(wb, excelPath);
    const stats = fs.statSync(excelPath);

    return {
      filename: excelFilename,
      path: excelPath,
      size: stats.size,
      type: 'Master Campaign Excel (.xlsx)'
    };
  }

  // 3. Automated Retention Pruning: Keep last N backups
  cleanOldBackups(retentionCount = 15) {
    try {
      const files = fs.readdirSync(this.backupsDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup_') || f.startsWith('master_snapshot_'))
        .map(f => {
          const filePath = path.join(this.backupsDir, f);
          const stat = fs.statSync(filePath);
          return { name: f, path: filePath, mtime: stat.mtime.getTime() };
        })
        .sort((a, b) => b.mtime - a.mtime); // Newest first

      if (backupFiles.length > retentionCount) {
        const toDelete = backupFiles.slice(retentionCount);
        toDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
            console.log(`[BACKUP PRUNE] Removed old backup file: ${file.name}`);
          } catch (delErr) {
            console.warn(`[BACKUP PRUNE] Could not delete ${file.name}:`, delErr.message);
          }
        });
      }
    } catch (err) {
      console.warn('[BACKUP PRUNE ERROR]', err.message);
    }
  }

  // 4. Off-Site Cloud Delivery: Email & Telegram Bot
  async dispatchCloudBackup({ sqliteFile, excelFile, totalVoters }) {
    const results = { email: null, telegram: null };

    // --- Email Cloud Delivery ---
    const recipientEmail = process.env.BACKUP_EMAIL || process.env.SMTP_USER;
    const transporter = this.getEmailTransporter();

    if (transporter && recipientEmail) {
      try {
        const attachments = [];
        if (sqliteFile && fs.existsSync(sqliteFile.path)) {
          attachments.push({ filename: sqliteFile.filename, path: sqliteFile.path });
        }
        if (excelFile && fs.existsSync(excelFile.path)) {
          attachments.push({ filename: excelFile.filename, path: excelFile.path });
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const mailOptions = {
          from: process.env.SMTP_FROM || `"IAS Campaign Tracker" <${process.env.SMTP_USER}>`,
          to: recipientEmail,
          subject: `[IAS Campaign Backup] Automated Snapshot - ${dateStr} (${totalVoters || 0} Voters)`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #4338ca; margin-top: 0;">🗳️ IAS Election Campaign Backup Snapshot</h2>
              <p>An automated cloud backup of the Indian Association Sharjah Election Campaign Tracker has been generated successfully.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; font-weight: bold;">Timestamp:</td>
                  <td style="padding: 8px;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; font-weight: bold;">Total Voter Records:</td>
                  <td style="padding: 8px;">${totalVoters || 0}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; font-weight: bold;">Database Archive:</td>
                  <td style="padding: 8px;">${sqliteFile ? sqliteFile.filename + ' (' + (sqliteFile.size / 1024).toFixed(1) + ' KB)' : 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold;">Master Excel Snapshot:</td>
                  <td style="padding: 8px;">${excelFile ? excelFile.filename + ' (' + (excelFile.size / 1024).toFixed(1) + ' KB)' : 'N/A'}</td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 13px;">Attachments include both the compressed SQLite database (.sqlite.gz) and the complete Excel report (.xlsx).</p>
            </div>
          `,
          attachments
        };

        const info = await transporter.sendMail(mailOptions);
        results.email = { success: true, messageId: info.messageId, to: recipientEmail };
        console.log(`[BACKUP EMAIL] Successfully dispatched backup email to ${recipientEmail}`);
      } catch (emailErr) {
        results.email = { success: false, error: emailErr.message };
        console.warn(`[BACKUP EMAIL ERROR] Failed to send backup email:`, emailErr.message);
      }
    } else {
      results.email = { success: false, error: 'SMTP or BACKUP_EMAIL not configured' };
    }

    // --- Telegram Cloud Delivery ---
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      try {
        const sendDoc = async (fileObj) => {
          if (!fileObj || !fs.existsSync(fileObj.path)) return null;
          const fileBuffer = fs.readFileSync(fileObj.path);
          const formData = new FormData();
          formData.append('chat_id', chatId);
          formData.append('caption', `🗳️ IAS Election Backup: ${fileObj.filename} (${(fileObj.size / 1024).toFixed(1)} KB)`);
          formData.append('document', new Blob([fileBuffer]), fileObj.filename);

          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            body: formData
          });
          return await res.json();
        };

        const tgResults = [];
        if (sqliteFile) tgResults.push(await sendDoc(sqliteFile));
        if (excelFile) tgResults.push(await sendDoc(excelFile));

        results.telegram = { success: true, details: tgResults };
        console.log(`[BACKUP TELEGRAM] Successfully uploaded backups to Telegram chat ${chatId}`);
      } catch (tgErr) {
        results.telegram = { success: false, error: tgErr.message };
        console.warn(`[BACKUP TELEGRAM ERROR] Failed to upload to Telegram:`, tgErr.message);
      }
    } else {
      results.telegram = { success: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured' };
    }

    return results;
  }

  // 5. Orchestrate Complete Full Backup Cycle
  async executeFullBackupCycle() {
    console.log('[BACKUP] Starting automated backup cycle...');
    const startTime = Date.now();

    // 1. Create DB snapshot
    const sqliteFile = await this.createDatabaseBackup();
    console.log(`[BACKUP] Database snapshot created: ${sqliteFile.filename} (${(sqliteFile.size / 1024).toFixed(1)} KB)`);

    // 2. Create Master Excel snapshot
    const excelFile = await this.createExcelMasterSnapshot();
    console.log(`[BACKUP] Master Excel snapshot created: ${excelFile.filename} (${(excelFile.size / 1024).toFixed(1)} KB)`);

    // Get total voter count for notification
    let totalVoters = 0;
    try {
      const countRes = await this.query('SELECT count(*) AS count FROM contacts');
      totalVoters = countRes[0]?.count || 0;
    } catch (e) {
      totalVoters = 0;
    }

    // 3. Prune old backups (Retention limit: 15)
    this.cleanOldBackups(15);

    // 4. Dispatch off-site to cloud channels (Email / Telegram)
    const cloudResults = await this.dispatchCloudBackup({ sqliteFile, excelFile, totalVoters });

    const durationMs = Date.now() - startTime;
    console.log(`[BACKUP] Full backup cycle completed in ${durationMs}ms`);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      sqliteFile,
      excelFile,
      cloudResults
    };
  }

  // 6. List All Existing Historical Backups
  listBackups() {
    if (!fs.existsSync(this.backupsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.backupsDir);
    return files
      .filter(f => f.startsWith('backup_') || f.startsWith('master_snapshot_'))
      .map(f => {
        const filePath = path.join(this.backupsDir, f);
        const stat = fs.statSync(filePath);
        const isDb = f.includes('.sqlite') || f.includes('.json');
        return {
          filename: f,
          size: stat.size,
          sizeFormatted: (stat.size / 1024).toFixed(1) + ' KB',
          createdAt: stat.birthtime || stat.mtime,
          type: isDb ? 'Database Snapshot' : 'Master Campaign Excel'
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // 7. Get Backup Status & Disk Usage
  getStatus() {
    const backups = this.listBackups();
    const totalBytes = backups.reduce((acc, b) => acc + b.size, 0);
    const lastBackup = backups.length > 0 ? backups[0].createdAt : null;

    return {
      totalBackups: backups.length,
      totalDiskUsage: (totalBytes / (1024 * 1024)).toFixed(2) + ' MB',
      lastBackupTime: lastBackup,
      cloudChannels: {
        emailConfigured: !!(process.env.SMTP_USER && (process.env.BACKUP_EMAIL || process.env.SMTP_USER)),
        telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
      },
      schedule: process.env.BACKUP_SCHEDULE_CRON || '0 23 * * * (Daily at 23:00 GST)'
    };
  }
}

module.exports = BackupService;
