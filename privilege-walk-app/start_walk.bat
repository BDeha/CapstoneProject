@echo off
echo Starting Privilege Walk Backend and Frontend...
start "Backend Server" cmd /k "cd /d "%~dp0privilege-backend" && npm start"
start "Frontend Client" cmd /k "cd /d "%~dp0privilege-frontend" && npm start"