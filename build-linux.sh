#!/usr/bin/env bash
# ============================================================================
#  LLM Graph Builder - one-shot builder for the OFFLINE Linux installer.
#
#  Run this ONCE on any Linux machine with internet access. It produces a
#  fully self-contained AppImage (and .deb) under  desktop/dist-app/  that runs
#  with NO internet on first launch (Python runtime + all deps are bundled).
#
#  Prerequisites on the BUILD machine (internet required during build):
#    * Node.js 18+         https://nodejs.org
#    * Python 3.12         (python3.12 on PATH)
#  uv and yarn are installed automatically if missing.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")"

echo
echo "=== LLM Graph Builder : building the offline Linux installer ==="
echo

command -v node >/dev/null 2>&1 || { echo "[ERROR] Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 not found."; exit 1; }

if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found - installing ..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

if ! command -v yarn >/dev/null 2>&1; then
  echo "yarn not found - installing globally ..."
  npm install -g yarn
fi

echo
echo "[1/3] Installing frontend dependencies ..."
( cd frontend && yarn install --frozen-lockfile )

echo
echo "[2/3] Installing desktop dependencies ..."
( cd desktop && npm install )

echo
echo "[3/3] Bundling runtime + building installer (downloads ~1-2 GB once) ..."
( cd desktop && npm run dist:linux )

echo
echo "Done! Your offline installer(s):"
ls -1 desktop/dist-app/*.AppImage desktop/dist-app/*.deb 2>/dev/null || true
echo
echo "The .AppImage runs with no internet on first launch."
