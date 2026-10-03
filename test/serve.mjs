// A local-only, dependency-free preview for browser tests. Node is already
// required by Playwright; avoid platform DNS lookup delays in Python HTTPServer.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.SHELF_PREVIEW_PORT || 4175);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid SHELF_PREVIEW_PORT');
// Browser tests must never reach the real Supabase project, so this server
// hands out an empty cloud config unless SHELF_REAL_CLOUD_CONFIG=1. Tests that
// want a cloud inject a fake one through SHELFLIFE_CLOUD_CONFIG.
const realCloud = process.env.SHELF_REAL_CLOUD_CONFIG === '1';
const CLOUD_CONFIG_LINE = /export const CLOUD_CONFIG = \{[^}]*\};/;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg'
};
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
    if (!filename.startsWith(root + path.sep) || filename.includes('\0')) { res.writeHead(403); res.end(); return; }
    const info = await stat(filename);
    if (!info.isFile()) { res.writeHead(404); res.end(); return; }
    let bytes = req.method === 'HEAD' ? null : await readFile(filename);
    let length = bytes?.byteLength ?? info.size;
    if (!realCloud && pathname === '/src/cloud/config.js') {
      const source = (await readFile(filename, 'utf8')).replace(CLOUD_CONFIG_LINE, "export const CLOUD_CONFIG = { url: '', anonKey: '' };");
      bytes = req.method === 'HEAD' ? null : Buffer.from(source);
      length = Buffer.byteLength(source);
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': length, 'Cache-Control': 'no-cache' });
    res.end(bytes);
  } catch (error) {
    const status = error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : error instanceof URIError ? 400 : 500;
    if (status === 500) console.error(error);
    res.writeHead(status); res.end();
  }
});
server.listen(port, '127.0.0.1', () => console.log('Shelf Life preview at http://localhost:' + port));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
