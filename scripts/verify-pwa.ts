// Guard-Gate nach dem Build (Teil von npm run verify): Das Spiel als App – installierbar und ohne Netz spielbar.
// Manifest und Icons stimmen, jede Seite verweist auf das Manifest, und der Service Worker des Spiels speichert alles,
// was die Spielseite braucht (auch das nachträglich geladene Three.js), nur von der eigenen Seite, in einer Version,
// die zum Inhalt passt. Logik und Tests: scripts/pwa.ts, scripts/pwa.test.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Script } from 'node:vm';
import { checkManifest, checkManifestLinks, checkServiceWorker, type PwaOptions } from './pwa.ts';
import { distFile } from '../src/lib/pwa/precache.ts';
import { SERVICE_WORKER } from '../src/data/pwa.ts';
import { SITE } from '../src/data/site.ts';

const DIST = 'dist';
const OPTS: PwaOptions = { origin: SITE.url, manifest: '/manifest.webmanifest', sw: SERVICE_WORKER };

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(join(dir, e.name)) : [join(dir, e.name)],
  );
const read = (path: string) => {
  try {
    return readFileSync(join(DIST, path));
  } catch {
    return null;
  }
};

const all = filesIn(DIST).map((f) => relative(DIST, f));
const pages: [string, string][] = all
  .filter((f) => f.endsWith('.html'))
  .map((f) => [f, readFileSync(join(DIST, f), 'utf8')]);
// Die Startseite lädt kein JavaScript: Jede JavaScript-Datei gehört zum Spiel und muss offline da sein
const scripts = all.filter((f) => /\.m?js$/.test(f) && f !== distFile(SERVICE_WORKER.url)).map((f) => `/${f}`);

const problems = [
  ...checkServiceWorker(read, scripts, OPTS),
  ...checkManifest(read, OPTS),
  ...checkManifestLinks(pages, OPTS.manifest),
];
try {
  new Script(readFileSync(join(DIST, distFile(SERVICE_WORKER.url)), 'utf8'));
} catch (e) {
  problems.push(`${SERVICE_WORKER.url}: kein gültiges JavaScript (${(e as Error).message})`);
}

if (problems.length) {
  console.error(`App-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ App-Gate: Manifest und Icons gültig, Service Worker speichert alles für ${SERVICE_WORKER.entry}`);
