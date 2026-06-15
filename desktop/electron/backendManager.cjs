'use strict';

// Manages the bundled FastAPI backend lifecycle for the desktop app:
//  - copies the backend source into a writable per-user directory
//  - bootstraps a self-contained Python environment via `uv` on first launch
//  - installs the backend requirements
//  - spawns `uvicorn` and waits for the /health endpoint
//
// Two bootstrap modes are supported:
//  * OFFLINE (default for shipped installers): the installer bundles a
//    relocatable standalone CPython (resources/python) and a wheelhouse of
//    every dependency (resources/wheelhouse). First launch creates the venv
//    from the bundled Python and installs from the local wheelhouse with
//    --no-index, so NO internet access is required. The venv is created on the
//    user's machine, which keeps its internal paths correct regardless of where
//    the app was installed.
//  * ONLINE (used during development when no wheelhouse is bundled): uv creates
//    the venv (downloading a managed CPython if needed) and installs the
//    requirements from PyPI.

const { app } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const IS_WIN = process.platform === 'win32';

let backendProcess = null;

function isDev() {
  return !app.isPackaged || process.env.ELECTRON_DEV === '1';
}

// Absolute path to the bundled backend source. In dev it lives in the repo;
// in a packaged app it is shipped under resources/backend.
function bundledBackendDir() {
  if (isDev()) {
    return path.resolve(__dirname, '..', '..', 'backend');
  }
  return path.join(process.resourcesPath, 'backend');
}

function userBackendDir() {
  // Allow overriding the working backend dir (used for development/testing to
  // point at an already-prepared backend checkout).
  if (process.env.LGB_BACKEND_DIR) return process.env.LGB_BACKEND_DIR;
  return path.join(app.getPath('userData'), 'backend');
}

function venvDir() {
  // Allow overriding the venv location (used for development/testing to reuse an
  // existing virtual environment instead of rebuilding the 3GB+ env).
  if (process.env.LGB_VENV_DIR) return process.env.LGB_VENV_DIR;
  return path.join(userBackendDir(), 'venv');
}

function venvPython() {
  return IS_WIN
    ? path.join(venvDir(), 'Scripts', 'python.exe')
    : path.join(venvDir(), 'bin', 'python');
}

// Root of bundled resources (resources/ in dev, process.resourcesPath when
// packaged).
function resourcesRoot() {
  return isDev() ? path.resolve(__dirname, '..', 'resources') : process.resourcesPath;
}

// Directory of the bundled relocatable standalone CPython (offline mode).
function bundledPythonDir() {
  if (process.env.LGB_PYTHON_DIR) return process.env.LGB_PYTHON_DIR;
  return path.join(resourcesRoot(), 'python');
}

// The python executable inside the bundled standalone CPython, if present.
// python-build-standalone lays this out as <root>/python.exe on Windows and
// <root>/bin/python3 on macOS/Linux.
function bundledPythonExe() {
  const root = bundledPythonDir();
  const candidates = IS_WIN
    ? [path.join(root, 'python.exe'), path.join(root, 'Scripts', 'python.exe')]
    : [path.join(root, 'bin', 'python3'), path.join(root, 'bin', 'python')];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// Directory of the bundled wheelhouse (every dependency as a wheel/sdist) used
// for fully-offline installs.
function wheelhouseDir() {
  if (process.env.LGB_WHEELHOUSE_DIR) return process.env.LGB_WHEELHOUSE_DIR;
  return path.join(resourcesRoot(), 'wheelhouse');
}

// Offline mode is active when a wheelhouse has been bundled with the app.
function isOfflineBundle() {
  const dir = wheelhouseDir();
  return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
}

// Locate the `uv` binary: prefer the one bundled under resources/bin, then any
// uv on PATH (useful for development).
function locateUv() {
  const exe = IS_WIN ? 'uv.exe' : 'uv';
  const candidates = [];
  if (isDev()) {
    candidates.push(path.resolve(__dirname, '..', 'resources', 'bin', exe));
  } else {
    candidates.push(path.join(process.resourcesPath, 'bin', exe));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return exe; // fall back to PATH lookup
}

function requirementsHash() {
  const reqPath = path.join(userBackendDir(), 'requirements.txt');
  const data = fs.readFileSync(reqPath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function depsMarkerPath() {
  return path.join(userBackendDir(), '.deps_installed');
}

// Copy the bundled backend into the writable user directory. The backend writes
// uploaded/merged files relative to its own folder, so it must run from a
// writable location (resources are read-only / packed in a packaged app).
function ensureBackendCopied(onProgress) {
  const src = bundledBackendDir();
  const dest = userBackendDir();
  fs.mkdirSync(dest, { recursive: true });
  onProgress && onProgress('copy', 'Preparing backend files…');
  // Copy everything except the venv and any cached runtime data.
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (s) => {
      const base = path.basename(s);
      return base !== 'venv' && base !== '__pycache__' && base !== '.env';
    },
  });
  // Preserve an existing user .env across upgrades; otherwise seed from example.
  const userEnv = path.join(dest, '.env');
  const exampleEnv = path.join(dest, 'example.env');
  if (!fs.existsSync(userEnv) && fs.existsSync(exampleEnv)) {
    fs.copyFileSync(exampleEnv, userEnv);
  }
}

function runCommand(cmd, args, opts, onProgress, label) {
  return new Promise((resolve, reject) => {
    onProgress && onProgress('install', `${label}…`);
    const child = spawn(cmd, args, { ...opts, shell: false });
    let stderrTail = '';
    const onData = (buf) => {
      const text = buf.toString();
      stderrTail = (stderrTail + text).slice(-4000);
      // Surface the last meaningful line as progress detail.
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length) onProgress && onProgress('install-detail', lines[lines.length - 1]);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (exit ${code}).\n${stderrTail}`));
    });
  });
}

// Create the Python virtual environment and install dependencies if needed.
async function ensureEnvironment(onProgress) {
  // Development/testing shortcut: assume the backend dir + venv are already set
  // up (via LGB_BACKEND_DIR / LGB_VENV_DIR) and skip copying/installing.
  if (process.env.LGB_SKIP_SETUP === '1') {
    if (!fs.existsSync(venvPython())) {
      throw new Error(`LGB_SKIP_SETUP=1 but no Python found at ${venvPython()}`);
    }
    return;
  }

  ensureBackendCopied(onProgress);

  const uv = locateUv();
  const cwd = userBackendDir();
  const py = venvPython();
  const marker = depsMarkerPath();
  const currentHash = requirementsHash();

  const venvExists = fs.existsSync(py);
  let depsUpToDate = false;
  if (venvExists && fs.existsSync(marker)) {
    try {
      depsUpToDate = fs.readFileSync(marker, 'utf8').trim() === currentHash;
    } catch (e) {
      depsUpToDate = false;
    }
  }

  if (venvExists && depsUpToDate) {
    return; // environment is ready
  }

  const offline = isOfflineBundle();
  const bundledPy = bundledPythonExe();

  if (!venvExists) {
    // Prefer the bundled standalone CPython so no download is required. When it
    // is missing (development), fall back to a uv-managed CPython 3.12.
    const venvArgs = bundledPy
      ? ['venv', '--python', bundledPy, venvDir()]
      : ['venv', '--python', '3.12', venvDir()];
    await runCommand(uv, venvArgs, { cwd }, onProgress, 'Creating Python environment');
  }

  const installArgs = ['pip', 'install', '--python', py];
  if (offline) {
    // Fully offline: resolve only from the bundled wheelhouse.
    installArgs.push('--no-index', '--find-links', wheelhouseDir());
  } else {
    installArgs.push('--index-strategy', 'unsafe-best-match');
  }
  installArgs.push('-r', 'requirements.txt');

  await runCommand(
    uv,
    installArgs,
    { cwd },
    onProgress,
    offline
      ? 'Setting up the bundled runtime (first launch only)'
      : 'Installing backend dependencies (first launch only, this can take several minutes)'
  );

  fs.writeFileSync(marker, currentHash);
}

// Spawn the uvicorn server. Resolves once the process has been started; callers
// should poll waitForHealth() for readiness.
function startBackend(port, onLog) {
  const cwd = userBackendDir();
  const py = venvPython();
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    // Keep model/tokenizer caches inside userData so they persist & are writable.
    HF_HOME: path.join(app.getPath('userData'), 'hf-cache'),
    NLTK_DATA: path.join(app.getPath('userData'), 'nltk_data'),
  };
  fs.mkdirSync(env.HF_HOME, { recursive: true });
  fs.mkdirSync(env.NLTK_DATA, { recursive: true });

  backendProcess = spawn(
    py,
    ['-m', 'uvicorn', 'score:app', '--host', '127.0.0.1', '--port', String(port)],
    { cwd, env, shell: false }
  );
  backendProcess.stdout.on('data', (d) => onLog && onLog(d.toString()));
  backendProcess.stderr.on('data', (d) => onLog && onLog(d.toString()));
  backendProcess.on('close', (code) => {
    onLog && onLog(`[backend exited with code ${code}]`);
    backendProcess = null;
  });
  return backendProcess;
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    try {
      if (IS_WIN) {
        spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t']);
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (e) {
      /* ignore */
    }
    backendProcess = null;
  }
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(port, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (backendProcess === null) {
      throw new Error('Backend process exited before becoming healthy.');
    }
    // eslint-disable-next-line no-await-in-loop
    if (await checkHealth(port)) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Backend did not become healthy in time.');
}

module.exports = {
  ensureEnvironment,
  startBackend,
  stopBackend,
  waitForHealth,
  userBackendDir,
  venvPython,
};
