# Privilege Walk App

An interactive classroom polling web and cross-platform desktop application built with a **React** frontend, **Node.js / Express** backend, embedded **SQLite** database, and **Electron** desktop wrapper for zero-setup, real-time local-network deployment.

## Project Structure

```text
CapstoneProject/
├── .github/
│   └── workflows/
│       └── build-release.yml # GitHub Actions CI/CD workflow for cross-platform builds
├── .gitignore
├── README.md
└── privilege-walk-app/
    ├── main.js               # Electron main process entry point
    ├── package.json          # Electron & electron-builder configuration
    ├── privilege-backend/    # Node.js & Express API server (with embedded SQLite)
    ├── privilege-frontend/   # React client application
    ├── capstone table.sql    # Legacy MySQL reference schema & 29 prompts
    ├── start_walk.bat        # Windows launcher for standalone web mode
    └── stop_walk.bat         # Windows shutdown script
```

## Quick Start (End Users — Zero Setup)

Download the pre-built installer for your operating system from the **[GitHub Releases](https://github.com/BDeha/CapstoneProject/releases)** page—no Node.js, terminal commands, or external database server required:

* **Windows:** `Privilege Walk App Setup 1.0.0.exe`
* **macOS:** `Privilege Walk App-1.0.0.dmg`
* **Linux:** `Privilege Walk App-1.0.0.AppImage`

### Running a Classroom Session
1. **Facilitator / Host Computer:**
   * Install and open **Privilege Walk App** (on Windows, click **More info → Run anyway** if SmartScreen prompts; on macOS, right-click the app in Applications → **Open** on first launch).
   * The embedded SQLite database (`privilege_walk.db`) initializes automatically on first startup and pre-loads all 29 Privilege Walk prompts.
   * Log in to the Facilitator Dashboard (`admin` / `admin123`) to create a timed session and generate a Session Code.
2. **Students / Participants:**
   * No installation is needed. Connect any phone, tablet, or laptop to the **same Wi-Fi / local network** as the host computer.
   * Open a browser and navigate to `http://<HOST-LOCAL-IP>:3000` (for example, `http://192.168.1.42:3000`), register with the active Session Code, and participate in real time.

## Setup & Local Usage (Developer Web Mode)

If you want to run the Express server and React frontend directly without the Electron desktop wrapper:

1. **Install Dependencies:** Run `npm install` inside both `privilege-walk-app/privilege-backend` and `privilege-walk-app/privilege-frontend`.
2. **Build Frontend:** Run `npm run build` inside `privilege-walk-app/privilege-frontend` so Express can serve the production UI.
3. **Start the Application:** Double-click `privilege-walk-app/start_walk.bat` (or run `node index.js` inside `privilege-backend`) to launch the server on port `3000`.
   * *Note:* The SQLite database (`privilege_walk.db`) is created automatically inside `privilege-backend/` on first run.
4. **Stop the Application:** Double-click `privilege-walk-app/stop_walk.bat` to terminate running Node processes.

## Building the Desktop Application (Electron)

To run or compile the Electron desktop wrapper from source:

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
3. **Build Platform Installers:**
   * **Windows (`.exe`):**
     ```powershell
     cd privilege-walk-app
     npm run build
     ```
   * **macOS (`.dmg`):**
     ```bash
     cd privilege-walk-app
     npm run build:mac
     ```
   * **Linux (`.AppImage`):**
     ```bash
     cd privilege-walk-app
     npm run build:linux
     ```
   Compiled installers are output to `privilege-walk-app/dist/`. Pushing a `v*` tag (e.g., `v1.0.0`) automatically builds and attaches all three platform installers to a GitHub Release via `.github/workflows/build-release.yml`.