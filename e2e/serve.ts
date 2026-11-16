// Statischer Server für die fertige Seite (dist/) – für den Smoke-Test im Browser, ohne Astro.
// Ordner liefern ihre index.html, Unbekanntes die 404-Seite mit Status 404 (wie GitHub Pages).
// Für den Test der App-Updates (e2e/pwa.spec.ts): Mit dem Cookie `mw-sw=<n>` bekommt der Browser einen Service Worker
// mit anderer Version (`<Version>-<n>`), so als wäre eine neue Fassung der Seite erschienen. Ohne Cookie wie gebaut.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist';
const PORT = Number(process.env.PORT ?? 4321);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

/** Andere Version des Service Workers je Browser-Kontext (Cookie), sonst unverändert */
function variant(req: IncomingMessage, path: string, body: Buffer): Buffer {
  const n = /(?:^|;\s*)mw-sw=(\w+)/.exec(req.headers.cookie ?? '')?.[1];
  if (!n || path !== '/spielen/sw.js') return body;
  return Buffer.from(body.toString('utf8').replace(/^(const CACHE = PREFIX \+ "[^"]+)"/m, `$1-${n}"`));
}

async function serve(req: IncomingMessage, res: ServerResponse) {
  let path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (path.includes('..')) path = '/';
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = variant(req, path, await readFile(join(ROOT, path)));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(await readFile(join(ROOT, '404.html')).catch(() => 'Nicht gefunden'));
  }
}

createServer((req, res) => void serve(req, res)).listen(PORT, () => console.log(`dist/ auf http://localhost:${PORT}`));
