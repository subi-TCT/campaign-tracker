@echo off
echo ========================================================
echo         STARTING CAMPAIGN OUTREACH TRACKER
echo ========================================================
echo.

echo 1. Starting Backend Service (Express + SQLite on Port 3001)...
start "Campaign Backend" cmd /c "cd tracker-backend && npm start"

echo 2. Starting Frontend App (Vite + React on Port 5173)...
start "Campaign Frontend" cmd /c "cd tracker-app && npm run dev"

echo.
echo Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo 3. Opening Campaign Command Center in browser...
start http://localhost:5173/

echo.
echo ========================================================
echo Done! Please keep the backend and frontend terminal windows open.
echo ========================================================
pause
