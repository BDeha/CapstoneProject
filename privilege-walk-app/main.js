const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');

let mainWindow;
let backendProcess;
const SERVER_PORT = 3000; // Update if your Express server uses a different port
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

function startBackend() {
    const baseDir = __dirname.replace('app.asar', 'app.asar.unpacked');
    const backendDir = path.join(baseDir, 'privilege-backend');
    const backendPath = path.join(backendDir, 'index.js');

    backendProcess = spawn(process.execPath, [backendPath], {
        cwd: backendDir,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: 'inherit'
    });
}

async function createWindow() {
    startBackend();

    // Wait until Express is listening before opening the window
    await waitOn({ resources: [SERVER_URL], timeout: 15000 });

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadURL(SERVER_URL);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});