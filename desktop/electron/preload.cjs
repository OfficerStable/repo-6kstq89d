'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The backend URL is passed from the main process as a launch argument so it is
// available synchronously to both the splash screen and the frontend renderer.
function readArg(prefix) {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : '';
}

const backendUrl = readArg('--backend-url=');

// Exposed as a plain global so the existing frontend (utils/Utils.ts -> url())
// can pick up the backend address without importing the Electron bridge.
contextBridge.exposeInMainWorld('__BACKEND_URL__', backendUrl);

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  backendUrl,
  // Splash screen subscribes to setup progress events from the main process.
  onSetupProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('setup-progress', handler);
    return () => ipcRenderer.removeListener('setup-progress', handler);
  },
  onSetupError: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('setup-error', handler);
    return () => ipcRenderer.removeListener('setup-error', handler);
  },
  retrySetup: () => ipcRenderer.send('retry-setup'),
});
