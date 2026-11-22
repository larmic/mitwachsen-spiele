// Guard-Gate nach dem Build (Teil von npm run verify): Das Spiel als App – installierbar und ohne Netz spielbar.
// Manifest und Icons stimmen, jede Seite verweist auf das Manifest, und der Service Worker des Spiels speichert alles,
// was die Spielseite braucht (auch das nachträglich geladene Three.js und alle Welt-Pakete samt ihren 3D-Teilen: Das
// Kind muss ohne Netz in jede offene Welt gehen können, ein Paket erst bei Bedarf zu holen, scheiterte offline), nur von
// der eigenen Seite, in einer Version, die zum Inhalt passt, und alles zusammen im Budget. Die Ausgabe zeigt Kern,
// 3D-Ansicht, Three.js und je Welt-Paket getrennt. Logik und Tests: scripts/pwa.ts, scripts/pwa.test.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Script } from 'node:vm';
import {
  checkManifest,
  checkManifestLinks,
  checkPrecacheSize,
  checkServiceWorker,
  parseServiceWorker,
  precacheBytes,
  precacheParts,
  type PwaOptions,
} from './pwa.ts';
import { distFile } from '../src/lib/pwa/precache.ts';
import { SERVICE_WORKER } from '../src/data/pwa.ts';
import { SITE } from '../src/data/site.ts';

const DIST = 'dist';
/**
 * Höchstens so viele Bytes speichert der Service Worker vorab – jedes Gerät lädt sie mit jeder neuen Version ganz.
 * Knapp über dem Stand von heute (rund 1002 KiB, davon knapp 518 KiB Three.js, gut 35 KiB das Paket der Eis-Welt und
 * gut 3 KiB sein 3D-Teil): Wächst es, bewusst anheben. 1024 statt 960 KiB seit den eigenen Zugängen je Welt
 * (mitwachsen-gate-<welt>.ts, gut 35 KiB im 3D-Teil). Das Schneiden in Kern, Three.js und Welt-Pakete kostete nur
 * knapp 2 KiB (Importe zwischen den Dateien), das Budget bleibt. Mit den Fußspuren im Schnee (gut 4 KiB im Paket der
 * Eis-Welt und seinem 3D-Teil) rund 1002 KiB: Das Budget reicht noch, es bleibt; gut 22 KiB Luft. Mit den
 * Schneemännern (knapp 2 KiB im Paket der Eis-Welt) knapp 1005 KiB, das Budget bleibt; gut 19 KiB Luft. Mit dem
 * Eiszapfen-Glockenspiel (knapp 2 KiB im Paket der Eis-Welt) gut 1007 KiB: Das Budget reicht, es bleibt; gut 16 KiB
 * Luft. Mit der Torplatte bis „noch nicht“ am Eistor (Platten, Öffnen auf der Platte, die nachgeladene Datei
 * mitwachsen-hint-look.<hash>.js) gut 1020 KiB: knapp 4 KiB Luft für die nächsten Schritte der Torplatte (Drehung,
 * Blinzeln, Kamera vor den Flügeln, Elternschalter, Platten der anderen Welten). Reicht das nicht, bewusst und
 * begründet anheben. Mit der Postkarte der Torfront (nachgeladene 2D-Zeichnung mitwachsen-postcard.<hash>.js,
 * Standbild in der 3D-Ansicht) und dem Elternschalter 1023,6 KiB: Das Budget reicht noch, es bleibt; 0,4 KiB
 * Luft. Die Drehung in 3D wird es bewusst und knapp anheben müssen: Mit ihr (Drehregler und Einbau in der nachgeladenen
 * Datei mitwachsen-turn-3d.<hash>.js, Kamera, Sonne und Zugang zur Front in der 3D-Ansicht) 1029,8 KiB, darum bewusst
 * auf 1032 KiB angehoben; gut 2 KiB Luft für die Kamera vor den Flügeln und die Platten der anderen Welten. Die
 * nachgeladene Anmeldung des Service Workers (eigene Datei pwa-register.<hash>.js, macht im Kern Platz für die Platten)
 * kostet mit den Importen zwischen den Dateien knapp 0,1 KiB: 1032,03 KiB, darum bewusst auf 1033 KiB angehoben. Mit
 * den Platten der anderen Welten (sieben Platten in der 3D-Ansicht, „noch nicht“ an den Toren, die nie aufgehen, in
 * der nachgeladenen Datei mitwachsen-hint-look.<hash>.js, Klang und Zeichen je Welt im Kern) 1034,5 KiB: bewusst und
 * knapp auf 1035 KiB angehoben; 0,5 KiB Luft.
 */
const PRECACHE_BUDGET = 1035 * 1024;
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

const swFile = distFile(SERVICE_WORKER.url);
const precached = parseServiceWorker(read(swFile)?.toString('utf8') ?? '')?.files ?? [];
const bytes = precacheBytes(precached, read);

const problems = [
  ...checkServiceWorker(read, scripts, OPTS),
  ...checkPrecacheSize(precached, read, PRECACHE_BUDGET),
  ...checkManifest(read, OPTS),
  ...checkManifestLinks(pages, OPTS.manifest),
];
try {
  new Script(readFileSync(join(DIST, swFile), 'utf8'));
} catch (e) {
  problems.push(`${SERVICE_WORKER.url}: kein gültiges JavaScript (${(e as Error).message})`);
}

if (problems.length) {
  console.error(`App-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
console.log(`✓ App-Gate: Manifest und Icons gültig, Service Worker speichert alles für ${SERVICE_WORKER.entry}`);
console.log(`  vorab gespeichert: ${precached.length} Dateien, ${kib(bytes)} von ${kib(PRECACHE_BUDGET)} Budget`);
for (const part of precacheParts(precached, read)) console.log(`    ${part.name}: ${kib(part.bytes)}`);
