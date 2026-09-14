@echo off
echo Starting Privilege Walk Backend and Frontend...
start cmd /k "cd privilege-backend && npx nodemon index.js"
start cmd /k "cd privilege-frontend && npm start"