import os
import shutil
import sqlite3
import pandas as pd

# Define dynamic paths
backend_dir = os.path.dirname(os.path.abspath(__file__))
excel_path = os.path.join(backend_dir, 'IAS Election Campaign Dashboard.xlsx')

db_dir = os.environ.get('DATABASE_DIR', backend_dir)
db_path = os.path.join(db_dir, 'database.sqlite')
backup_path = os.path.join(db_dir, 'database_backup.sqlite')

print(f"Excel Path: {excel_path}")
print(f"Database Path: {db_path}")

if not os.path.exists(excel_path):
    print(f"Error: Excel file not found at {excel_path}")
    exit(1)

if not os.path.exists(db_path):
    print(f"Error: SQLite database not found at {db_path}")
    exit(1)

# 1. Create a safety backup
try:
    shutil.copyfile(db_path, backup_path)
    print(f"Safety backup created at: {backup_path}")
except Exception as backup_err:
    print(f"Warning: Could not create safety backup: {backup_err}")

# 2. Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 3. Load Excel Sheet (header on row 2)
try:
    df_excel = pd.read_excel(excel_path, sheet_name='Members', header=2)
    df_excel = df_excel.dropna(subset=['IAS ID'])
except Exception as e:
    print(f"Error reading Excel sheet: {e}")
    conn.close()
    exit(1)

# Helper to clean text
def clean(val):
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
    return val_str

# Helper to format mobile numbers consistently
def format_mobile(mobile_raw):
    cleaned = ''.join(filter(str.isdigit, mobile_raw))
    if not cleaned:
        return ""
    if cleaned.startswith('05'):
        return '971' + cleaned[1:]
    if cleaned.startswith('5'):
        return '971' + cleaned
    return cleaned

new_count = 0
update_count = 0

for index, row in df_excel.iterrows():
    ias_id = clean(row.get('IAS ID', ''))
    member_type = clean(row.get('Type', ''))
    acc_code = f"{member_type}{ias_id}"
    
    name = clean(row.get('Member Name', ''))
    mobile = format_mobile(clean(row.get('Mobile (UAE)', '')))
    email = clean(row.get('Email', ''))
    s_no = clean(row.get('S.No', ''))
    
    # Check if contact exists in SQLite
    cursor.execute("SELECT id, account_name, mobile_number, email_id FROM contacts WHERE acc_code = ?", (acc_code,))
    db_match = cursor.fetchone()
    
    if db_match is None:
        # Insert as a new member with default campaign status (No data loss of existing)
        cursor.execute("""
            INSERT INTO contacts (
                s_no, acc_code, account_name, mobile_number, email_id,
                email_status, email_sent_date,
                whatsapp_status, whatsapp_sent_date,
                call_status, call_sent_date, notes,
                member_reaction, exit_poll_status
            ) VALUES (?, ?, ?, ?, ?, 'Pending', '', 'Pending', '', 'Not Called', '', '', 'Unknown', 'Pending')
        """, (s_no, acc_code, name, mobile, email))
        new_count += 1
    else:
        # Update existing contact details ONLY
        db_id, db_name, db_mobile, db_email = db_match
        
        # Merge if different (only overwrite if Excel has non-empty values)
        update_fields = []
        params = []
        
        if db_name != name and name != "":
            update_fields.append("account_name = ?")
            params.append(name)
        if db_mobile != mobile and mobile != "":
            update_fields.append("mobile_number = ?")
            params.append(mobile)
        if db_email != email and email != "":
            update_fields.append("email_id = ?")
            params.append(email)
            
        if update_fields:
            params.append(acc_code)
            query = f"UPDATE contacts SET {', '.join(update_fields)} WHERE acc_code = ?"
            cursor.execute(query, tuple(params))
            update_count += 1

# Commit changes and close
conn.commit()
conn.close()

print("\n--- Sync Completed ---")
print(f"- Safety Backup: {backup_path}")
print(f"- New contacts added to DB: {new_count}")
print(f"- Existing contacts updated in DB: {update_count}")
