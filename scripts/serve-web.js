/**
 * Tiny static server for the exported web build (`dist/`).
 *
 * expo-sqlite on web stores its database in OPFS via a Web Worker, which needs
 * the page to be "cross-origin isolated" — so every response must carry the
 * COOP + COEP headers below. `npx serve` and most static hosts do NOT set these,
 * which is why the DB silently fails there; this server does.
 *
 *   npm run web:export   # build dist/
 *   npm run web:serve    # serve it on http://localhost:8080
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'dist');
const port = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.css': 'text/css',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
};

const send = (res, status, type, data) => {
  res.writeHead(status, {
    'Content-Type': type,
    // Required for OPFS / SharedArrayBuffer (web SQLite).
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.end(data);
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
    fs.readFile(file, (err, data) => {
      if (err) {
        // SPA fallback to index.html for client-side routes.
        fs.readFile(path.join(root, 'index.html'), (e2, d2) => {
          if (e2) return send(res, 404, 'text/plain', 'Not found');
          send(res, 200, MIME['.html'], d2);
        });
        return;
      }
      send(res, 200, MIME[path.extname(file)] || 'application/octet-stream', data);
    });
  })
  .listen(port, () => console.log(`Serving dist/ on http://localhost:${port}`));
