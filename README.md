# Privilege Walk App

An interactive classroom polling web and desktop application built with a **React** frontend, **Node.js / Express** backend, **MySQL** database, and **Electron** desktop wrapper for real-time local-network deployment.

## Project Structure

```text
CapstoneProject/
├── .gitignore
├── README.md
└── privilege-walk-app/
    ├── main.js               # Electron main process entry point
    ├── package.json          # Electron & electron-builder configuration
    ├── privilege-backend/    # Node.js & Express API server
    ├── privilege-frontend/   # React client application
    ├── capstone table.sql    # MySQL database schema
    ├── start_walk.bat        # Windows launcher for standalone web mode
    └── stop_walk.bat         # Windows shutdown script
```

## Setup & Local Usage (Web Mode)

1. **Database Setup:** Import `privilege-walk-app/capstone table.sql` into your local MySQL server (`privilege_walk` database on port `3306`).
2. **Install Dependencies:** Run `npm install` inside both `privilege-backend` and `privilege-frontend`.
3. **Build Frontend:** Run `npm run build` inside `privilege-frontend` so Express can serve the production UI.
4. **Start the Application:** Double-click `privilege-walk-app/start_walk.bat` to launch the server on port `3000`.
5. **Stop the Application:** Double-click `privilege-walk-app/stop_walk.bat` to terminate running Node processes.

## Desktop Application (Electron)

1. **Install Electron Dependencies:**
   ```powershell
   cd privilege-walk-app
   npm install
   ```
2. **Run Desktop App in Development:**
   ```powershell
   cd privilege-walk-app
   npm start
   ```
3. **Build Windows Installer (`.exe`):**
   ```powershell
   cd privilege-walk-app
   npm run build
   ```
   The compiled NSIS installer (`Privilege Walk App Setup 1.0.0.exe`) is generated in `privilege-walk-app/dist/`.