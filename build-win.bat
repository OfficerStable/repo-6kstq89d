@echo off
setlocal enabledelayedexpansion
REM ============================================================================
REM  LLM Graph Builder - one-shot builder for the OFFLINE Windows installer.
REM
REM  Run this ONCE on any Windows PC that has internet access. It produces a
REM  fully self-contained .exe under  desktop\dist-app\  that your end users can
REM  install and run with NO internet (the Python runtime + all dependencies are
REM  bundled inside the installer).
REM
REM  Prerequisites on the BUILD machine (one-time install, internet required):
REM    * Node.js 18 or newer     https://nodejs.org/en/download
REM    * Python 3.12             https://www.python.org/downloads/
REM        (during install, tick "Add python.exe to PATH")
REM  uv is installed automatically below if it is missing.
REM
REM  Just double-click this file, or run it from a terminal.
REM ============================================================================

cd /d "%~dp0"
echo(
echo === LLM Graph Builder : building the offline Windows installer ===
echo(

REM --- check Node ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install it from https://nodejs.org and re-run.
  pause
  exit /b 1
)

REM --- check Python ---
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3.12 was not found on PATH. Install it from
  echo         https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^) and re-run.
  pause
  exit /b 1
)

REM --- ensure uv is available (used to bundle a standalone Python) ---
where uv >nul 2>nul
if errorlevel 1 (
  echo uv not found - installing it via pip ...
  python -m pip install --upgrade uv || (
    echo [ERROR] Failed to install uv.
    pause
    exit /b 1
  )
)

REM --- ensure yarn (classic) is available for the frontend ---
where yarn >nul 2>nul
if errorlevel 1 (
  echo yarn not found - installing it globally ...
  call npm install -g yarn || (
    echo [ERROR] Failed to install yarn.
    pause
    exit /b 1
  )
)

echo(
echo [1/4] Installing frontend dependencies ...
pushd frontend
call yarn install --frozen-lockfile || (echo [ERROR] frontend install failed & popd & pause & exit /b 1)
popd

echo(
echo [2/4] Installing desktop dependencies ...
pushd desktop
call npm install || (echo [ERROR] desktop install failed & popd & pause & exit /b 1)

echo(
echo [3/4] Bundling runtime + building installer ^(this downloads ~1-2 GB once, then works offline^) ...
call npm run dist:win || (echo [ERROR] build failed & popd & pause & exit /b 1)
popd

echo(
echo [4/4] Done!
echo(
echo Your offline installer is here:
for %%f in (desktop\dist-app\*.exe) do echo     %%~ff
echo(
echo Hand that .exe to any Windows user - it installs and runs with no internet.
echo(
pause
