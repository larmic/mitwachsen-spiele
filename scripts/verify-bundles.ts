// Guard-Gate nach dem Build (Teil von npm run verify): Die Startseite bleibt schnell und ohne Ballast.
// Die Startseite lädt gar kein JavaScript, weder als Datei noch eingebettet. Seiten außerhalb von /spielen/ laden kein Spiel und kein Three.js und bleiben unter einem festen Budget.
// Die Spielseite lädt beim Start nur ihren eigenen Code (den Kern); Three.js darf nur nachträglich (import()) kommen.
// Jedes Welt-Paket (src/scripts/games/worlds/, im Build _astro/welt-<welt>.<hash>.js) misst eine eigene Regel.
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
    // Regeln, Welt, 2D-Ansicht und Daten des Spiels; 3D (Three.js) kommt erst per import(). 132 statt 128 KB seit dem
    // gemeinsamen Einziehen an der Wiese (Wegsuche der Tiere auf die Wiese, mitwachsen-arrive.ts)
    budget: 132 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Welt-Paket Eis',
    pages: /^spielen\/index\.html$/, // nur die Spielseite lädt Welt-Pakete
    chunks: /\/welt-eis\.[\w-]+\.js$/,
    // Gletscherkessel (Gelände, Zuhause, Wohnorte der Eis-Tiere, Eis-Portal) und die Regeln des Pinguins: gemessen
    // 12,3 KB, dazu etwa 4 KB Luft
    budget: 16 * 1024,
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
console.log(`✓ Bundle-Gate: ${pages.length} Seiten geprüft, Startseite ohne Spiel, Kern und Welt-Pakete im Budget`);
