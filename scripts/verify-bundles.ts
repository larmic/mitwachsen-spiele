// Guard-Gate nach dem Build (Teil von npm run verify): Die Startseite bleibt schnell und ohne Ballast.
// Die Startseite lädt gar kein JavaScript, weder als Datei noch eingebettet. Seiten außerhalb von /spielen/ laden kein Spiel und kein Three.js und bleiben unter einem festen Budget.
// Die Spielseite lädt beim Start nur ihren eigenen Code (den Kern); Three.js darf nur nachträglich (import()) kommen.
// Die 3D-Ansicht (samt Three.js, im Build _astro/three.<hash>.js) misst eine eigene Regel und enthält nichts, was nur
// eine Welt hinter einem Tor braucht. Jedes Welt-Paket (src/scripts/games/worlds/, im Build _astro/welt-<welt>.<hash>.js)
// und sein 3D-Teil (_astro/welt-<welt>-3d.<hash>.js) messen je eine eigene Regel.
// Logik und Tests: scripts/bundles.ts, scripts/bundles.test.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, type Rule, type Usage } from './bundles.ts';

const DIST = 'dist';
// Spielcode, Three.js und die Anmeldung des Service Workers (die gibt es nur auf der Spielseite)
const GAME_CODE = /larmic-mitwachsen|Mitwachsen|WebGLRenderer|three\.module|serviceWorker/;

export const RULES: Rule[] = [
  // Die Startseite holt kein JavaScript: keine Datei, kein eingebettetes Skript (Budget 0)
  { name: 'Startseite ohne JavaScript', pages: /^index\.html$/, budget: 0, forbidden: GAME_CODE },
  { name: 'Startseite ohne Spiel', pages: /^(?!spielen\/)/, budget: 32 * 1024, forbidden: GAME_CODE },
  {
    name: 'Spiel lädt 3D erst bei Bedarf',
    pages: /^spielen\//,
    // Regeln, Welt, 2D-Ansicht und Daten des Spiels; 3D (Three.js) und die Welt-Pakete kommen erst per import().
    // Gemessen 122,1 KB, seit die Eis-Welt nur bei Bedarf lädt und ihre Zeichenteile (Iglu, Fischkisten, Wetter) und
    // die Modelle ihrer Tiere mitbringt (vorher 125,7 KB bei 132 KB); 122,3 KB, seit die 3D-Ansicht den Haken drawDeco
    // mitnutzt; dazu knapp 4 KB Luft
    budget: 126 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Welt-Paket Eis',
    pages: /^spielen\/index\.html$/, // nur die Spielseite lädt Welt-Pakete
    chunks: /\/welt-eis\.[\w-]+\.js$/,
    // Gletscherkessel (Gelände, Zuhause, Wohnorte der Eis-Tiere, Eis-Portal), die Regeln des Pinguins, Zeichenteile
    // der 2D-Ansicht (Iglu, Fischkisten, Rutschspur, Wetter, Bild der Weltgrenze, Pinguin am Tor) und die Modelle der
    // zehn Eis-Tiere: gemessen 25,1 KB; 25,5 KB, seit der Umriss des Pinguins (für die Tür in 3D) mit ihm kommt statt
    // mit der 3D-Ansicht; dazu etwa 3,5 KB Luft
    budget: 29 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: '3D-Ansicht',
    pages: /^spielen\/index\.html$/,
    chunks: /\/mitwachsen-3d\.[\w-]+\.js$/,
    // Three.js (517,7 KB in three.<hash>.js) und die 3D-Ansicht samt Zugängen, ohne die Teile der Eis-Welt: gemessen
    // 589,5 KB (vorher 591,9 KB in einer Datei mit Iglu, Fischkisten, Tür und Eiszapfen des Eistors), dazu 6 KB Luft
    budget: 595 * 1024,
    // Probe: Das Leuchten der Eiszapfen gibt es nur im 3D-Teil der Eis-Welt (ICE_GLOW in worlds/eis/view-3d-gate.ts)
    forbidden: /#7fd6ff/,
  },
  {
    name: 'Welt-Paket Eis 3D',
    pages: /^spielen\/index\.html$/,
    chunks: /\/welt-eis-3d\.[\w-]+\.js$/,
    // kommt erst nach der 3D-Ansicht (Three.js, Baukasten der Zugänge) und dem Paket der Eis-Welt (Quader von Iglu und
    // Fischkisten): was die mitbringen, zählt nicht
    after: /\/(mitwachsen-3d|welt-eis)\.[\w-]+\.js$/,
    // Iglu, Eisschale, Eistrog, Fischkiste, Schnee und Eis im Kessel, Rutschspur, Bett aus Schnee, Tür, Eiszapfen und
    // goldene Bucht des Eistors: gemessen 2,1 KB, dazu etwa 4 KB Luft
    budget: 6 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
];

const pagesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pagesIn(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );

const read = (path: string) => {
  try {
    return readFileSync(join(DIST, path), 'utf8');
  } catch {
    return null;
  }
};

const pages = pagesIn(DIST);
const usage: Usage[] = [];
const problems = pages.flatMap((file) => check(relative(DIST, file), readFileSync(file, 'utf8'), read, RULES, usage));
const kib = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const budgetOf = (name: string) => RULES.find((r) => r.name === name)?.budget ?? 0;
for (const u of usage.filter((x) => x.page.startsWith('spielen/')))
  console.log(`  ${u.rule}: ${u.file ?? u.page} ${kib(u.bytes)} von ${kib(budgetOf(u.rule))}`);
if (problems.length) {
  console.error(`Bundle-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(
  `✓ Bundle-Gate: ${pages.length} Seiten geprüft, Startseite ohne Spiel, Kern, 3D-Ansicht und Welt-Pakete im Budget`,
);
