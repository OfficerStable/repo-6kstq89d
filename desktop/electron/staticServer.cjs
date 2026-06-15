'use strict';

// Minimal dependency-free static file server used to serve the built Vite
// frontend over http://127.0.0.1 inside Electron. Serving over http (instead of
// file://) keeps react-router's BrowserRouter and relative asset paths working.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function safeJoin(rootDir, requestPath) {
  // Prevent path traversal: resolve and ensure the result stays under rootDir.
  const resolved = path.normalize(path.join(rootDir, requestPath));
  if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
    return null;
  }
  return resolved;
}

/**
 * Start a static SPA server.
 * @param {string} rootDir absolute path to the directory containing index.html
 * @param {number} port port to listen on (0 = random free port)
 * @returns {Promise<{server: http.Server, port: number, url: string}>}
 */
function startStaticServer(rootDir, port) {
  return new Promise((resolve, reject) => {
    const indexFile = path.join(rootDir, 'index.html');

    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      } catch (e) {
        pathname = '/';
      }
      if (pathname === '/') pathname = '/index.html';

      const candidate = safeJoin(rootDir, pathname);
      if (!candidate) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.stat(candidate, (err, stat) => {
        if (!err && stat.isFile()) {
          serveFile(candidate, res);
          return;
        }
        // SPA fallback: any path without a file extension serves index.html so
        // client-side routing (e.g. /chat-only, /readonly) works on refresh.
        if (!path.extname(pathname)) {
          serveFile(indexFile, res);
          return;
        }
        res.writeHead(404);
        res.end('Not Found');
      });
    });

    function serveFile(filePath, res) {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Internal Server Error');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        res.end(data);
      });
    }

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      resolve({ server, port: actualPort, url: `http://127.0.0.1:${actualPort}` });
    });
  });
}

module.exports = { startStaticServer };
