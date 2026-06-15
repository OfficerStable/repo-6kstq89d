'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const getPort = require('get-port');

const { startStaticServer } = require('./staticServer.cjs');
const backend = require('./backendManager.cjs');

const IS_DEV = !app.isPackaged || process.env.ELECTRON_DEV === '1';

let mainWindow = null;
let staticServer = null;
let backendPort = 0;
const backendLogs = [];

function frontendDistDir() {
  if (IS_DEV) {
    return path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  }
  return path.join(process.resourcesPath, 'frontend');
}

function sendProgress(stage, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('setup-progress', { stage, message });
  }
}

function sendError(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('setup-error', { message });
  }
}

async function runSetupPipeline() {
  try {
    sendProgress('start');

    // 1. Ensure the Python environment exists and dependencies are installed.
    await backend.ensureEnvironment((stage, message) => sendProgress(stage, message));

    // 2. Launch the backend and wait until it is healthy.
    sendProgress('starting');
    backend.startBackend(backendPort, (line) => {
      backendLogs.push(line);
      if (backendLogs.length > 500) backendLogs.shift();
      if (IS_DEV) process.stdout.write(`[backend] ${line}`);
    });
    sendProgress('waiting');
    await backend.waitForHealth(backendPort);

    // 3. Serve the built frontend and load it in the window.
    if (!fs.existsSync(path.join(frontendDistDir(), 'index.html'))) {
      throw new Error(
        `Frontend build not found at ${frontendDistDir()}. Run "npm run build:frontend" first.`
      );
    }
    const frontendPort = await getPort();
    staticServer = await startStaticServer(frontendDistDir(), frontendPort);

    sendProgress('ready');
    await mainWindow.loadURL(staticServer.url);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Setup failed:', err);
    sendError(`${err && err.message ? err.message : err}\n\n--- backend log ---\n${backendLogs.slice(-25).join('')}`);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b1020',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--backend-url=http://127.0.0.1:${backendPort}`],
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external links (docs, GitHub, Neo4j Aura) in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(__dirname, 'splash.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View / 视图',
      submenu: [
        { role: 'reload', label: 'Reload / 刷新' },
        { role: 'forceReload' },
        { role: 'toggleDevTools', label: 'Developer Tools / 开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  buildMenu();
  backendPort = await getPort({ port: getPort.makeRange(8000, 8100) });
  createWindow();
  runSetupPipeline();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      runSetupPipeline();
    }
  });
});

ipcMain.on('retry-setup', () => {
  runSetupPipeline();
});

function cleanup() {
  backend.stopBackend();
  if (staticServer && staticServer.server) {
    try {
      staticServer.server.close();
    } catch (e) {
      /* ignore */
    }
  }
}

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', cleanup);
process.on('exit', cleanup);
