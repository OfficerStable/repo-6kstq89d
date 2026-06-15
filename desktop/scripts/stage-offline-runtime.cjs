'use strict';

// Stages the fully-offline backend runtime under desktop/resources:
//   resources/python      <- a relocatable standalone CPython 3.12
//                            (fetched via `uv python install`, then copied)
//   resources/wheelhouse  <- every backend dependency as a wheel/sdist
//                            (fetched via `pip download`, matching the build
//                            host's platform — run this on the OS you target)
//
// Run this on the SAME OS/arch you are packaging for: the wheelhouse and the
// standalone Python must be native to the target machine. On Windows this
// produces win_amd64 wheels + a windows python; on Linux, linux wheels + a
// linux python; etc.
//
// Env overrides:
//   LGB_PIP_PYTHON   python executable used to drive `pip download`
//                    (defaults to `python` on Windows, `python3` elsewhere)
//   LGB_UV           path to the uv binary (defaults to `uv` on PATH)
//   LGB_PYTHON_VERSION  CPython version to bundle (defaults to 3.12)

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..');
const resourcesDir = path.join(desktopDir, 'resources');
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

const PY_VERSION = process.env.LGB_PYTHON_VERSION || '3.12';
const UV = process.env.LGB_UV || 'uv';
const PIP_PYTHON = process.env.LGB_PIP_PYTHON || (IS_WIN ? 'python' : 'python3');

function run(cmd, args, opts) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
  }
}

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

// Recursively copy a directory's *contents* into dest.
function copyDirContents(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    fs.cpSync(path.join(src, entry), path.join(dest, entry), { recursive: true });
  }
}

// Fetch a relocatable standalone CPython via uv and copy it to resources/python.
function stagePython() {
  const dest = path.join(resourcesDir, 'python');
  const exe = IS_WIN
    ? path.join(dest, 'python.exe')
    : path.join(dest, 'bin', 'python3');
  if (fs.existsSync(exe)) {
    console.log('Standalone Python already staged ->', dest);
    return;
  }
  const installDir = path.join(os.tmpdir(), 'lgb-uv-python');
  rimraf(installDir);
  fs.mkdirSync(installDir, { recursive: true });
  run(UV, ['python', 'install', PY_VERSION], {
    env: { ...process.env, UV_PYTHON_INSTALL_DIR: installDir },
  });
  // uv installs into <installDir>/cpython-<ver>-<platform>/
  const entries = fs.readdirSync(installDir).filter((e) => e.startsWith('cpython-'));
  if (!entries.length) {
    throw new Error(`No standalone CPython found under ${installDir}`);
  }
  const pyRoot = path.join(installDir, entries[0]);
  rimraf(dest);
  copyDirContents(pyRoot, dest);
  if (!fs.existsSync(exe)) {
    throw new Error(`Staged Python is missing its interpreter at ${exe}`);
  }
  console.log('Staged standalone Python ->', dest);
}

// macOS has no `+cpu` local-version torch wheels (those exist only for
// Linux/Windows on download.pytorch.org). The plain macOS wheels on PyPI are
// already CPU/MPS builds, so drop the `+cpu` suffix and the pytorch CPU index
// when targeting macOS.
function adjustRequirementsForMac(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(torch|torchvision|torchaudio)==([0-9][0-9.]*)\+cpu\s*$/);
      if (m) return `${m[1]}==${m[2]}`;
      if (/^\s*--extra-index-url\s+https:\/\/download\.pytorch\.org\/whl\/cpu/.test(line)) {
        return null;
      }
      return line;
    })
    .filter((line) => line !== null)
    .join('\n');
}

// Download every backend dependency as a wheel/sdist into resources/wheelhouse.
function stageWheelhouse() {
  const dest = path.join(resourcesDir, 'wheelhouse');
  let requirements = path.join(repoRoot, 'backend', 'requirements.txt');
  fs.mkdirSync(dest, { recursive: true });

  // The torch CPU wheels live on a dedicated index referenced by
  // requirements.txt; pass it explicitly too in case the host pip ignores the
  // in-file directive.
  const extraArgs = ['--extra-index-url', 'https://download.pytorch.org/whl/cpu'];

  if (IS_MAC) {
    const adjusted = adjustRequirementsForMac(fs.readFileSync(requirements, 'utf8'));
    const macReq = path.join(os.tmpdir(), 'lgb-requirements-macos.txt');
    fs.writeFileSync(macReq, adjusted);
    requirements = macReq;
    // Keep the bundled backend's requirements.txt in sync so the first-launch
    // offline install (`uv pip install --no-index --find-links wheelhouse`)
    // resolves against the macOS wheels we are about to download.
    const stagedReq = path.join(resourcesDir, 'backend', 'requirements.txt');
    if (fs.existsSync(stagedReq)) {
      fs.writeFileSync(stagedReq, adjusted);
      console.log('Rewrote macOS requirements (stripped +cpu torch pins) ->', stagedReq);
    }
    // No pytorch CPU index on macOS; the plain wheels come from PyPI.
    extraArgs.length = 0;
  }

  run(PIP_PYTHON, ['-m', 'pip', 'download', '-r', requirements, '-d', dest, ...extraArgs]);
  const count = fs.readdirSync(dest).length;
  console.log(`Staged wheelhouse (${count} files) ->`, dest);
}

function main() {
  fs.mkdirSync(resourcesDir, { recursive: true });
  stagePython();
  stageWheelhouse();
  console.log('Offline runtime staged.');
}

main();
