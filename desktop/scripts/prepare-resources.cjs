'use strict';

// Stages everything electron-builder needs under desktop/resources:
//   resources/frontend  <- built Vite app (frontend/dist)
//   resources/backend   <- backend source (no venv / caches / secrets)
//   resources/bin/uv    <- uv binary for the current platform (bootstraps Python)

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');
const os = require('os');
const zlib = require('zlib');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..');
const resourcesDir = path.join(desktopDir, 'resources');
const IS_WIN = process.platform === 'win32';

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyFrontend() {
  const src = path.join(repoRoot, 'frontend', 'dist');
  const dest = path.join(resourcesDir, 'frontend');
  if (!fs.existsSync(path.join(src, 'index.html'))) {
    throw new Error(`frontend/dist not found. Run "npm run build:frontend" first.`);
  }
  rimraf(dest);
  fs.cpSync(src, dest, { recursive: true });
  console.log('Staged frontend ->', dest);
}

function copyBackend() {
  const src = path.join(repoRoot, 'backend');
  const dest = path.join(resourcesDir, 'backend');
  rimraf(dest);
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (s) => {
      const base = path.basename(s);
      return base !== 'venv' && base !== '__pycache__' && base !== '.env' && !base.endsWith('.pyc');
    },
  });
  console.log('Staged backend ->', dest);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { 'User-Agent': 'lgb-desktop' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', reject);
  });
}

// Map node platform/arch to the uv release asset triple.
function uvAsset() {
  const arch = os.arch();
  if (process.platform === 'darwin') {
    return arch === 'arm64' ? 'uv-aarch64-apple-darwin' : 'uv-x86_64-apple-darwin';
  }
  if (process.platform === 'win32') {
    return arch === 'arm64' ? 'uv-aarch64-pc-windows-msvc' : 'uv-x86_64-pc-windows-msvc';
  }
  // linux
  return arch === 'arm64' ? 'uv-aarch64-unknown-linux-gnu' : 'uv-x86_64-unknown-linux-gnu';
}

async function stageUv() {
  const binDir = path.join(resourcesDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const target = path.join(binDir, IS_WIN ? 'uv.exe' : 'uv');
  if (fs.existsSync(target)) {
    console.log('uv already staged ->', target);
    return;
  }

  // 1) Reuse an existing uv on PATH (fast path for dev / CI that pre-installs uv).
  const which = spawnSync(IS_WIN ? 'where' : 'which', ['uv'], { encoding: 'utf8' });
  if (which.status === 0) {
    const found = which.stdout.split(/\r?\n/)[0].trim();
    if (found && fs.existsSync(found)) {
      fs.copyFileSync(found, target);
      if (!IS_WIN) fs.chmodSync(target, 0o755);
      console.log('Copied uv from PATH ->', target);
      return;
    }
  }

  // 2) Otherwise download the standalone uv binary for this platform.
  const asset = uvAsset();
  const ext = IS_WIN ? 'zip' : 'tar.gz';
  const url = `https://github.com/astral-sh/uv/releases/latest/download/${asset}.${ext}`;
  const tmp = path.join(os.tmpdir(), `${asset}.${ext}`);
  console.log('Downloading uv from', url);
  await download(url, tmp);

  if (IS_WIN) {
    // Extract uv.exe from the zip using PowerShell (available on Windows runners).
    const extractDir = path.join(os.tmpdir(), asset);
    rimraf(extractDir);
    spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force '${tmp}' '${extractDir}'`], {
      stdio: 'inherit',
    });
    const exe = findFile(extractDir, 'uv.exe');
    fs.copyFileSync(exe, target);
  } else {
    const extractDir = path.join(os.tmpdir(), asset + '-x');
    rimraf(extractDir);
    fs.mkdirSync(extractDir, { recursive: true });
    spawnSync('tar', ['-xzf', tmp, '-C', extractDir], { stdio: 'inherit' });
    const bin = findFile(extractDir, 'uv');
    fs.copyFileSync(bin, target);
    fs.chmodSync(target, 0o755);
  }
  console.log('Staged uv ->', target);
}

function findFile(dir, name) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (e.name === name) {
      return full;
    }
  }
  return null;
}

// Guarantee the offline-runtime resource dirs exist so electron-builder's
// extraResources never fails. CI populates resources/python (a relocatable
// standalone CPython) and resources/wheelhouse (every dependency as a wheel)
// before packaging; when they are empty the app falls back to the online
// (uv-managed) bootstrap, which is convenient for `--dir` dev builds.
function ensureOfflineDirs() {
  const pythonDir = path.join(resourcesDir, 'python');
  const wheelhouseDir = path.join(resourcesDir, 'wheelhouse');
  fs.mkdirSync(pythonDir, { recursive: true });
  fs.mkdirSync(wheelhouseDir, { recursive: true });
  const wheelCount = fs.readdirSync(wheelhouseDir).length;
  const hasPython = fs.readdirSync(pythonDir).length > 0;
  console.log(
    `Offline runtime: python=${hasPython ? 'bundled' : 'absent'}, wheelhouse=${wheelCount} files ` +
      `(${wheelCount > 0 ? 'OFFLINE install' : 'ONLINE install fallback'})`
  );
}

async function main() {
  fs.mkdirSync(resourcesDir, { recursive: true });
  copyFrontend();
  copyBackend();
  await stageUv();
  ensureOfflineDirs();
  console.log('Resources prepared.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
