# Campaign Tracker - Support Anil Kumar K G Pillai (Managing Committee Candidate #3)

A full-stack tracking command center for Email Campaign, Call Center, and WhatsApp outreach, with countdown, templates editor, and bulk sent/bounce copy-paste importers.

---

## 🚀 How to Run the Application

You can launch the entire project instantly with a single click:

1. **One-Click Startup**:
   Double-click the **[`run_campaign_tracker.bat`](file:///c:/Users/Subi/LAB-SOFT/HomeApp/AnilKumarIAS/run_campaign_tracker.bat)** file in the root directory.
   
2. **Accessing the App**:
   The batch file will automatically boot the backend database server, start the frontend developer host, and launch your default browser to:
   - **Frontend UI**: [http://localhost:5173/](http://localhost:5173/)
   - **Backend API Stats**: [http://localhost:3001/api/stats](http://localhost:3001/api/stats)

---

## 💻 Manual Commands

If you prefer launching the servers manually in your terminal, run the following commands:

### Step 1: Start Backend (Express & SQLite)
Open a terminal in the root workspace and run:
```bash
cd tracker-backend
npm start
```
*Starts database listeners on http://localhost:3001.*

### Step 2: Start Frontend (Vite & React)
Open a second terminal window in the root workspace and run:
```bash
cd tracker-app
npm run dev
```
*Serves the glassmorphic tracker dashboard on http://localhost:5173.*

---

## 📂 Project Architecture

- **`tracker-backend/`**: Express API powered by SQLite (`database.sqlite`). Contains the auto-initialized 1,954 master contact database.
- **`tracker-app/`**: React application featuring custom SVG graphs, countdown widgets, bulk sent/bounce text importers, custom template scripts, and light/dark theme toggles.
- **`master contact list.xls`**: Original master database import source.
- **`Name List.docx`**: Original candidate lists reference.
