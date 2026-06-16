# LLM Graph Builder — Desktop App (一键桌面应用)

A cross-platform desktop wrapper for [neo4j-labs/llm-graph-builder](https://github.com/neo4j-labs/llm-graph-builder).
Double-click to launch — it boots the bundled Python backend, serves the React UI,
and shows a **bilingual (中文 / English) interface that defaults to Chinese**.

The installer is **fully offline**: it bundles its own runtime (a standalone
CPython + every backend dependency as a local wheelhouse), so the end user needs
**no internet** to set up the app on first launch.

---

## 下载 / Download (普通用户直接用)

普通用户无需自己构建，直接到 Release 下载对应平台的安装包即可（界面默认中文，右上角可切 English）：

**Release 页面 / Release page:** <https://github.com/gaosichun888/llm-graph-builder/releases/tag/v1.0.0-win>

| 平台 / Platform | 下载 / Download |
|---|---|
| Windows 10/11 (x64) | [LLM-Graph-Builder-Setup-1.0.0.exe](https://github.com/gaosichun888/llm-graph-builder/releases/download/v1.0.0-win/LLM-Graph-Builder-Setup-1.0.0.exe) |
| Linux (x64, 免安装 AppImage) | [LLM-Graph-Builder-1.0.0.AppImage](https://github.com/gaosichun888/llm-graph-builder/releases/download/v1.0.0-win/LLM-Graph-Builder-1.0.0.AppImage) |
| Linux (Debian/Ubuntu) | [llm-graph-builder-desktop_1.0.0_amd64.deb](https://github.com/gaosichun888/llm-graph-builder/releases/download/v1.0.0-win/llm-graph-builder-desktop_1.0.0_amd64.deb) |
| macOS (Apple Silicon / arm64) | [LLM-Graph-Builder-1.0.0-arm64.dmg](https://github.com/gaosichun888/llm-graph-builder/releases/download/v1.0.0-win/LLM-Graph-Builder-1.0.0-arm64.dmg) |

安装后双击启动，首次会**离线**装好运行环境（第一次稍慢，之后秒开）。macOS 仅 Apple Silicon，且安装包未签名，首次需「右键 → 打开」，或执行 `xattr -dr com.apple.quarantine "/Applications/LLM Graph Builder.app"`。

---

## 系统设置面板 / In-app System Settings

点右上角的齿轮「**系统设置**」即可在界面里直接配置，无需手改环境变量；保存后**离线持久化**（升级不丢）。

**大模型 / LLM models** — 支持 OpenAI、Anthropic (Claude)、Google Gemini、Azure OpenAI、AWS Bedrock、Groq、Fireworks、Ollama、Diffbot，以及 **OpenAI 兼容 / 自定义**（DeepSeek、Kimi、智谱、本地模型等）。配置好的模型会出现在底部「用于处理与对话的 LLM 模型」下拉里。

例：接入 **DeepSeek**（提供商选「OpenAI 兼容 / 自定义」）：

| 字段 | 值 |
|---|---|
| 显示名称 / Display name | `deepseek`（任意） |
| 模型名 / Model name | `deepseek-chat` |
| API Endpoint | `https://api.deepseek.com/v1` |
| API Key | `sk-...` |

**系统配置 / System options** — Neo4j 默认连接（URI / 用户名 / 密码 / 库）、嵌入模型与开关、图谱清洗模型、分块大小等。

> 设置保存到用户数据目录下的 `app_settings.json`（含 API Key，请勿外传）。后端启动时自动读入并注入运行环境，因此 `get_llm` 等逻辑无需任何改动即可用上你配置的模型。

---

## What you get

| Platform | Installer produced            | One-click? |
|----------|-------------------------------|------------|
| Windows  | `LLM Graph Builder-1.0.0.exe` (NSIS) | ✔ |
| Linux    | `LLM Graph Builder-1.0.0.AppImage` (+ `.deb`) | ✔ |
| macOS    | `LLM Graph Builder-1.0.0.dmg` | ✔ |

All built installers land in `desktop/dist-app/`.

> **Note on Neo4j:** the app does not embed a Neo4j *database* (that needs Java and
> is multi-GB). On first run, use the in-app connection dialog to connect to a free
> [Neo4j Aura](https://console.neo4j.io/) instance or a local Neo4j. Everything else
> (Python runtime + all ML/LLM dependencies) is bundled and offline.

---

## How to build

You need a build machine **with internet** (the bundle is downloaded once at build
time). The produced installer is then offline for end users. **A Windows `.exe` must
be built on Windows; a macOS `.dmg` on macOS** — native ML wheels (torch, etc.) are
platform-specific and cannot be cross-compiled reliably.

Pick one of the three options:

### Option A — GitHub Actions (recommended, no local setup)

1. Push this repository to your own GitHub repo (any repo you control — this does
   **not** touch the upstream neo4j-labs repo).
2. Go to **Actions → "Build Desktop App (offline installers)" → Run workflow**.
3. Choose a platform (`windows`, `linux`, `mac`, or `all`).
4. When the run finishes, download the installer from the run's **Artifacts**
   section.

The workflow lives at [`.github/workflows/build-desktop.yml`](../.github/workflows/build-desktop.yml)
and runs the exact same steps as the scripts below on a clean cloud runner.

### Option B — build locally with one command

Prerequisites on the build machine (install once, internet required):

- **Node.js 18+** — <https://nodejs.org>
- **Python 3.12** — <https://www.python.org/downloads/> (on Windows tick
  *"Add python.exe to PATH"*)

`uv` and `yarn` are installed automatically by the scripts if missing.

Then, from the repository root:

- **Windows:** double-click **`build-win.bat`** (or run it in a terminal).
- **Linux:** `./build-linux.sh`
- **macOS:** `cd desktop && npm install && npm run dist:mac`

The finished installer is printed at the end and saved under `desktop/dist-app/`.

### Option C — manual / step by step

```bash
# from the repo root
cd frontend && yarn install --frozen-lockfile && cd ..
cd desktop
npm install
npm run dist:win      # or dist:linux / dist:mac / dist (current OS)
```

`npm run dist:*` runs, in order:

1. `build:frontend`   — builds the React UI (Vite) with desktop defaults.
2. `prepare:resources`— stages the frontend build, backend source, and the `uv` binary.
3. `stage:offline`    — downloads a standalone CPython and the **offline wheelhouse**
   (every backend dependency **pre-built as a `.whl`** via `pip wheel`) into
   `desktop/resources/`. The build fails loudly if any source archive (`.tar.gz`/`.zip`)
   remains, so end users never need a compiler on first launch.
4. `electron-builder` — packages everything into the platform installer.

---

## How the offline runtime works

At **build time** (`stage:offline`), three things are bundled into the installer
under `resources/`:

- `resources/python/`    — a relocatable standalone CPython 3.12 (via `uv python install`).
- `resources/wheelhouse/`— every backend dependency **pre-built as a wheel** via
  `pip wheel` (torch CPU, unstructured, sentence-transformers, langchain, …), so
  first-launch setup only unpacks and never compiles.
- `resources/bin/`       — the `uv` binary.

On the user's **first launch**, the Electron main process:

1. Copies the backend source into a writable per-user folder (`userData/backend`).
2. Creates a virtualenv from the bundled Python:
   `uv venv --python <bundled python> <userData>/backend/venv`
3. Installs all dependencies **completely offline** (wheels only, no compiling):
   `uv pip install --no-index --find-links <resources/wheelhouse> -r requirements.txt`
4. Writes a `.deps_installed` marker (sha256 of `requirements.txt`) so setup only
   happens once. Subsequent launches start instantly.
5. Starts `uvicorn score:app` on a free local port, waits for `/health`, then loads
   the UI from a local static server.

Because the venv is created **on the user's machine**, internal paths stay correct
regardless of where the app is installed. No network access is required at any point
during setup.

---

## Project layout

```
desktop/
  electron/
    main.cjs            # app lifecycle: ports, splash, backend, static server
    backendManager.cjs  # offline/online backend bootstrap (venv + uv install)
    staticServer.cjs    # serves the built frontend over http://127.0.0.1:<port>
    preload.cjs         # exposes window.__BACKEND_URL__ to the renderer
    splash.html         # bilingual loading splash
  scripts/
    build-frontend.cjs        # builds frontend/dist with desktop env
    prepare-resources.cjs     # stages frontend, backend, uv
    stage-offline-runtime.cjs # stages standalone python + offline wheelhouse
  electron-builder.yml  # packaging config (win/linux/mac targets)
  build/                # app icons (icon.ico / icon.icns / icon.png)
```

---

## Bilingual UI (中英双语)

- Default language is **Chinese**; a toggle in the header switches to English.
- Choice is persisted in `localStorage` under `lgb.language`.
- Translations live in `frontend/src/i18n/locales/{zh,en}.ts`.
