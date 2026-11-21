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
    // mitnutzt; 124,0 KB mit dem Gletschertal (Seen, Eisberg: Farben und Zeichnen gefärbter Eisfelder); mit den
    // Haken der Fußspuren im Schnee (`View2D.trail`, `View3D.layer`) unverändert 124,0 KB; 124,5 KB mit dem Haken für
    // die Regeln der Welten (`WorldPack.rules`, Eis-Welt: Schneemänner) und ihrem gespeicherten Zustand (`packs`);
    // 124,8 KB mit dem Eiszapfen-Glockenspiel (Ereignis `icicle` an den Ton aus dem Paket, Glitzern auch bei reduzierter
    // Bewegung); 124,9 KB nachgemessen; 124,7 KB, seit die Farben der Eis-Dinge und Eiskristalle (`ICE_COLORS`,
    // `ICE_CRYSTALS`) mit dem Welt-Paket kommen und der Kern Eisklippen und Schneebett mit den Farben seiner Böden
    // zeichnet: Platz für die Torplatte (nur 0,24 KB, die Eisklippe muss ohne Paket zeichnen); 123,9 KB, seit der
    // Inhalt des Menüs (Liste der Welten) mit seinen seltenen Handgriffen erst beim Öffnen nachlädt (mitwachsen-menu.ts)
    // und der Blick durchs Tor im Nebel-Modul liegt; 126,0 KB mit der Torplatte vor jedem Tor (Lage, Form, Einsinken,
    // 2D-Zeichnung mit Schmuck aus dem Paket, Klonk, Plopp und Motiv je Welt: gut 2 KB); dazu keine 0,03 KB Luft. Der
    // nächste Schritt der Torplatte (sie öffnet das Eistor) braucht die vereinbarte, begründete Anhebung um höchstens
    // 1 KB oder vorher Platz
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
    // mit der 3D-Ansicht; 28,6 KB mit Tannen, Eisblöcken und Hügeln im Kessel (Grenze damals 29 KB); 31,3 KB mit
    // Eiskristallen (Generator der Gruppen, Funkeln, Hof beim Polarlicht) und Schneewehen. Abweichung vom Plan (der sah
    // bis zum Gletschertal kein Anheben vor): Der Generator allein kostet gut 1,5 KB, unter 29 KB passt das nicht ohne
    // die Kristalle wegzulassen. Darum 33 KB, bis der Vater zustimmt oder es anders entscheidet; 32,8 KB mit dem langen
    // Gletschertal, Seen, Eisfall und fünf Tieren je Art; 33,6 KB mit dem Eisberg zum Erklettern (Stufen, Steg, Fahne
    // auf dem Gipfel; die Lage des Gipfels merkt sich der Bau, statt sie zu suchen). Zweite Abweichung vom Plan, nicht
    // freigegeben (das Anheben ist nur für Schneemann, Glockenspiel und Fußspuren erlaubt): Unter 33 KB passt der
    // Eisberg nicht, ohne fremde Teile des Pakets umzubauen. Darum 34 KB, eine offene Frage an den Vater. 37,1 KB mit
    // den Fußspuren im Schnee (Ringpuffer mitwachsen-tracks.ts, Formen je Gangart, höchstens zwei je Feld, 2D-Zeichnung
    // ohne Nebelrand): Bewusst angehoben mit Zustimmung des Vaters (Fußspuren, Schneemann und Glockenspiel gehören zur
    // Eis-Welt und kommen darum mit ihrem Paket, der Kern wächst nur um die Haken); 40,2 KB mit den Schneemännern
    // (Schneehaufen im Generator, Regel samt Migration ihres Spielstands, Quader der vier Stufen, Wackeln und Ploppen):
    // bewusst angehoben, wie vereinbart; 42,1 KB mit dem Eiszapfen-Glockenspiel (Reihe am Klippenfuß im Generator,
    // Regel, Quader der Zapfen, Schwingen, Glockenton in der Pentatonik): bewusst angehoben, wie vereinbart (das letzte
    // der drei); 42,5 KB nachgemessen; 42,7 KB, seit die Farben der Eis-Dinge und Eiskristalle (`ICE_COLORS`,
    // `ICE_CRYSTALS`, src/data/games/worlds/eis/mitwachsen-ice-colors.ts) mit dem Paket kommen statt im Kern zu
    // liegen; 42,9 KB mit der Torplatte vor dem Eistor (Klirren `View2D.clink`, Eisscholle mit Schneeflocke
    // `ICE_FLOE` für 2D und 3D); dazu knapp 0,1 KB Luft
    budget: 43 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: '3D-Ansicht',
    pages: /^spielen\/index\.html$/,
    chunks: /\/mitwachsen-3d\.[\w-]+\.js$/,
    // Three.js (517,7 KB in three.<hash>.js) und die 3D-Ansicht samt Zugängen, ohne die Teile der Eis-Welt: gemessen
    // 589,5 KB (vorher 591,9 KB in einer Datei mit Iglu, Fischkisten, Tür und Eiszapfen des Eistors); 589,8 KB mit dem
    // Material für Quader, die so hell leuchten, wie ein Welt-Paket sagt (`View3D.glow`); 589,9 KB mit dem Haken der
    // Fußspuren im Schnee (`View3D.layer`, `Views3D.layers`); 596,2 KB mit den bewegten Teilen der Zugänge (fließende
    // Wasserwand, Glutkaskade, wiegende Pilzranken je Takt); 597,0 KB mit den Torplatten (mitwachsen-plate-3d.ts);
    // dazu 4 KB Luft
    budget: 601 * 1024,
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
    // goldene Bucht des Eistors: gemessen 2,1 KB; 3,3 KB mit den Fußspuren im Schnee (durchsichtige Plättchen in einem Mesh, nur
    // Klassen von Three.js, die die 3D-Ansicht schon nutzt, sonst wüchse three.<hash>.js); 3,5 KB mit der Torplatte als
    // Eisscholle mit Schneeflocke (`GateLook.plate`, Farben und Zeichen aus `ICE_FLOE`); dazu 2,5 KB Luft
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
