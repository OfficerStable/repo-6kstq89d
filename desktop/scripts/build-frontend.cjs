'use strict';

// Builds the Vite frontend with desktop-appropriate defaults. The backend URL is
// resolved at runtime from window.__BACKEND_URL__ (injected by preload), so it is
// intentionally left unset here.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..', '..', 'frontend');

const DESKTOP_VITE_ENV = {
  // Leave VITE_BACKEND_API_URL empty: resolved at runtime via window.__BACKEND_URL__.
  VITE_REACT_APP_SOURCES: 'local,youtube,wiki,s3,web',
  VITE_LLM_MODELS: 'openai_gpt_5_mini,gemini_flash_latest,anthropic_claude_4.5_haiku,diffbot,ollama_llama3,deepseek_chat',
  VITE_LLM_MODELS_PROD: 'openai_gpt_5_mini,gemini_flash_latest,anthropic_claude_4.5_haiku,diffbot',
  VITE_CHAT_MODES: 'vector,graph_vector,graph,fulltext,graph_vector_fulltext,entity_vector,global_vector',
  VITE_ENV: 'DEV',
  VITE_SKIP_AUTH: 'true',
  VITE_CHUNK_SIZE: '5242880',
  VITE_LARGE_FILE_SIZE: '5242880',
  VITE_TIME_PER_PAGE: '50',
  VITE_BATCH_SIZE: '2',
  VITE_CHUNK_OVERLAP: '20',
  VITE_TOKENS_PER_CHUNK: '100',
  VITE_CHUNK_TO_COMBINE: '1',
  VITE_BLOOM_URL:
    'https://workspace-preview.neo4j.io/workspace/explore?connectURL={CONNECT_URL}&search=Show+me+a+graph&featureGenAISuggestions=true&featureGenAISuggestionsInternal=true',
};

function run(cmd, args, opts) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (res.status !== 0) {
    process.exit(res.status === null ? 1 : res.status);
  }
}

const env = { ...process.env, ...DESKTOP_VITE_ENV };

if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
  console.log('Installing frontend dependencies…');
  run('yarn', ['install', '--frozen-lockfile'], { cwd: frontendDir, env });
}

console.log('Building frontend (Vite)…');
run('yarn', ['build'], { cwd: frontendDir, env });

console.log('Frontend build complete:', path.join(frontendDir, 'dist'));
