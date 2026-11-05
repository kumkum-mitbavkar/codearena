// Local stand-in for Vercel: serves public/ (falling back to index.html for app routes)
// and runs api/*.js handlers. Without DATA_READ_WRITE_TOKEN the data lives in .data/.
//   node scripts/dev-server.mjs [port]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.wasm': 'application/wasm', '.zip': 'application/zip', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

async function serveStatic(pathname, res) {
  const pub = path.join(root, 'public');
  const file = path.join(pub, path.normalize(decodeURIComponent(pathname)));
  if (file.startsWith(pub)) {
    try {
      if ((await stat(file)).isFile()) {
        const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' };
        if (pathname.startsWith('/vendor/')) headers['Cache-Control'] = 'public, max-age=86400';
        res.writeHead(200, headers);
        return res.end(await readFile(file));
      }
    } catch { /* fall through to the app shell */ }
  }
  // files with an extension that don't exist are real 404s; everything else is an app route
  if (path.extname(pathname)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types['.html'] });
  res.end(await readFile(path.join(pub, 'index.html')));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!url.pathname.startsWith('/api/')) return serveStatic(url.pathname, res);
  const name = url.pathname.slice(5).replace(/[^a-z-]/g, '');
  let body = '';
  for await (const chunk of req) body += chunk;
  req.query = Object.fromEntries(url.searchParams);
  try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
  let mod;
  try { mod = await import(pathToFileURL(path.join(root, 'api', `${name}.js`)).href); } catch (err) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND') console.error(err);
    res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"Not found"}');
  }
  await mod.default(req, res);
}).listen(port, () => console.log(`CodeArena running on http://localhost:${port}`));
