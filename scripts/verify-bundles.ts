// Guard-Gate nach dem Build (Teil von npm run verify): Die Startseite bleibt schnell und ohne Ballast.
// Die Startseite lädt gar kein JavaScript, weder als Datei noch eingebettet. Seiten außerhalb von /spielen/ laden kein Spiel und kein Three.js und bleiben unter einem festen Budget.
// Die Spielseite lädt beim Start nur ihren eigenen Code (den Kern); Three.js (im Build _astro/three.<hash>.js) kommt
// nur nachträglich per import() und hat eine eigene Grenze, an seine Version gebunden. Die 3D-Ansicht ohne Three.js
// (samt der nachgeladenen Drehung zur Torfront) enthält nichts, was nur eine Welt hinter einem Tor braucht. Jedes
// Welt-Paket (src/scripts/games/worlds/, im Build _astro/welt-<welt>.<hash>.js) misst samt seinem 3D-Teil
// (_astro/welt-<welt>-3d.<hash>.js) eine eigene Grenze, ebenso alles, was der Kern selbst nachlädt.
// Grenzen mit Luft statt Tretmühle: Jede Grenze liegt bei gemessen + gut 10 % (Three.js + 5 %). Angehoben wird erst,
// wenn weniger als 3 % Luft bleiben, und dann wieder auf gemessen + 10 %, mit einem Satz Begründung in der
// Commit-Nachricht. Kein Tagebuch neben den Zahlen: Die Geschichte steht in git. Die wahren/falschen Regeln (kein
// JavaScript auf der Startseite, kein Spiel und kein Three.js außerhalb, Three.js nur per import(), Proben) bleiben fest.
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
    // Kern: Regeln, Welt, 2D-Ansicht und Daten des Spiels; 3D (Three.js) und die Welt-Pakete kommen erst per import().
    // Gemessen 139 756 Bytes (136,5 KB)
    budget: 151 * 1024,
    // Probe: Der Höhlenhimmel der Grotte steht nur in ihrem Welt-Paket (GROTTE_COLORS.sky)
    forbidden: /WebGLRenderer|three\.module|#4a4370/,
  },
  {
    name: 'Three.js',
    pages: /^spielen\/index\.html$/,
    // nur per import() erreichbar (kommt es beim Laden, meldet das Gate es), in eigener Datei three.<hash>.js
    chunks: /\/three\.[\w-]+\.js$/,
    // An die Version von Three.js gebunden (0.187): gemessen 530 152 Bytes (517,7 KB), dazu 5 % Luft.
    // Wächst es mit einem Update von Three.js, hier neu messen und wieder auf gemessen + 5 % setzen
    budget: 544 * 1024,
    forbidden: /larmic-mitwachsen|Mitwachsen/,
  },
  {
    name: '3D-Ansicht',
    pages: /^spielen\/index\.html$/,
    parts: [
      // 3D-Ansicht samt Zugängen, ohne Three.js (eigene Regel oben)
      { chunks: /\/mitwachsen-3d\.[\w-]+\.js$/, after: /\/three\.[\w-]+\.js$/ },
      // Drehung zur Torfront: kommt erst nach der 3D-Ansicht, wenn die Figur einem Tor nah ist (`NEAR_GATE`)
      { chunks: /\/mitwachsen-turn-3d\.[\w-]+\.js$/, after: /\/mitwachsen-3d\.[\w-]+\.js$/ },
    ],
    // Gemessen 91 693 Bytes (89,5 KB)
    budget: 97 * 1024,
    // Three.js liegt nur in seiner eigenen Datei. Proben: Das Leuchten der Eiszapfen gibt es nur im 3D-Teil der
    // Eis-Welt (ICE_GLOW in worlds/eis/view-3d-gate.ts), den Höhlenhimmel nur im Paket der Grotte
    forbidden: /WebGLRenderer|three\.module|#7fd6ff|#4a4370/,
  },
  {
    name: 'Welt-Paket Eis',
    pages: /^spielen\/index\.html$/, // nur die Spielseite lädt Welt-Pakete
    parts: [
      // Gletscherkessel, Regeln des Pinguins und des Schlittens, Zeichenteile der 2D-Ansicht und Modelle der Eis-Tiere
      { chunks: /\/welt-eis\.[\w-]+\.js$/ },
      // 3D-Teil: kommt erst nach der 3D-Ansicht (Three.js, Baukasten der Zugänge) und dem Paket der Welt
      { chunks: /\/welt-eis-3d\.[\w-]+\.js$/, after: /\/(mitwachsen-3d|welt-eis)\.[\w-]+\.js$/ },
    ],
    // Gemessen 68 872 Bytes (67,3 KB)
    budget: 74 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Welt-Paket Höhle',
    pages: /^spielen\/index\.html$/,
    parts: [
      // Kristallgrotte (Lage, Gelände, Zuhause, Licht, Portal am See, Fundorte der Höhlen-Tiere, Pilzbeete, Tropfquelle,
      // Tropfmoos), Zeichenteile der 2D-Ansicht und Modelle der Höhlen-Tiere; nur der Entwickler-Schalter holt sie (das
      // Höhlentor geht vorerst nie auf)
      { chunks: /\/welt-hoehle\.[\w-]+\.js$/ },
      // 3D-Teil: kommt erst nach der 3D-Ansicht und dem Paket der Welt
      { chunks: /\/welt-hoehle-3d\.[\w-]+\.js$/, after: /\/(mitwachsen-3d|welt-hoehle)\.[\w-]+\.js$/ },
    ],
    // Gemessen 19 582 Bytes (19,1 KB)
    budget: 21.5 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Nachgeladen vom Kern',
    pages: /^spielen\/index\.html$/,
    // Seltenes, das der Kern erst bei Bedarf holt: „noch nicht“ an den Toren (Bild, Ton, Live-Region), Inhalt des
    // Menüs, Postkarte der Torfront, Anmeldung des Service Workers
    parts: [{ chunks: /\/(mitwachsen-(hint-look|menu|card)|pwa-register)\.[\w-]+\.js$/ }],
    // Gemessen 7697 Bytes (7,5 KB)
    budget: 8.2 * 1024,
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
