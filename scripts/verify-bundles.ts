// Guard-Gate nach dem Build (Teil von npm run verify): Die Startseite bleibt schnell und ohne Ballast.
// Die Startseite lädt gar kein JavaScript, weder als Datei noch eingebettet. Seiten außerhalb von /spielen/ laden kein Spiel und kein Three.js und bleiben unter einem festen Budget.
// Die Spielseite lädt beim Start nur ihren eigenen Code (den Kern); Three.js darf nur nachträglich (import()) kommen.
// Die 3D-Ansicht (samt Three.js, im Build _astro/three.<hash>.js) misst eine eigene Regel und enthält nichts, was nur
// eine Welt hinter einem Tor braucht. Jedes Welt-Paket (src/scripts/games/worlds/, im Build _astro/welt-<welt>.<hash>.js)
// und sein 3D-Teil (_astro/welt-<welt>-3d.<hash>.js) messen je eine eigene Regel, ebenso „noch nicht“ an den Toren
// (_astro/mitwachsen-hint-look.<hash>.js, nachgeladen) und die Drehung zur Torfront (_astro/mitwachsen-turn-3d.<hash>.js,
// nachgeladen von der 3D-Ansicht).
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
    // 2D-Zeichnung mit Schmuck aus dem Paket, Klonk, Plopp und Motiv je Welt: gut 2 KB); 125,9 KB, seit die Platte das
    // Eistor öffnet (Stehzeit im Zustand, nur ohne gedrückten Pfeil, `InputPace.held`; goldener Rand der Platte,
    // stilles Hüpfen des Pinguins), die Bucht des Eistors aber mit dem Paket kommt (`bay`, nur der Pinguin braucht sie)
    // und Aufwachen und Einschlafen die Figur in einem Zug setzen: gemessen 129 020 Bytes, also nur 4 Bytes Luft. Die
    // vereinbarte, begründete Anhebung um höchstens 1 KB ist für die nächsten Schritte der Torplatte (Drehung) gedacht;
    // was dort mehr kommt, braucht sie. 126,5 KB mit „noch nicht“ am Eistor: bewusst um 0,5 KB angehoben, die erste
    // Hälfte der vereinbarten Anhebung (gemessen 129 482 Bytes, 54 Bytes Luft). Im Kern steht nur, was der Auftrag dort
    // will und jede Welt fragen kann: was fehlt (`missing`, `hint` neben `wanted` in mitwachsen-guide.ts, gegen den
    // Spielstand), der Blick durch den Nebel bis zur Mündung des Gangs (`lookAround`, `GatePlace.deep`), der Haken
    // `View2D.hint` und das Zeichnen des Umrisses (`Scene.hint`). Wann es zeigt und das Holen des Bilds liegen im Paket
    // der Eis-Welt (worlds/eis/mitwachsen-plate-hint.ts), Bild, Ton und Live-Region in einer eigenen, nachgeladenen
    // Datei (Regel unten), das Wackeln der Flügel in der 3D-Ansicht. Für die nächsten Schritte bleiben 0,5 KB der
    // Anhebung. 127,0 KB mit der Postkarte der Torfront und dem Elternschalter „Kamera bewegen“: bewusst um die zweite
    // Hälfte angehoben, damit ist die vereinbarte Anhebung um 1 KB für die Torplatte (Platte, Stehzähler, Klänge,
    // Postkarte, Schalter; vorher Eis-Teile ins Paket verschoben und das Menü nachgeladen) aufgebraucht. Im Kern steht
    // nur, wann die Postkarte kommt und geht (`postcard` in mitwachsen-plate.ts, samt „nicht vor Toren im Norden“) und
    // das Nachladen dessen, der sie zeichnet; alles andere lädt erst mit der ersten Postkarte (mitwachsen-card.ts samt
    // 2D-Zeichnung mitwachsen-postcard.ts), das Standbild in 3D liegt in der 3D-Ansicht (mitwachsen-card-3d.ts),
    // Schalter und Speichern im nachgeladenen Menü (mitwachsen-menu.ts); im Kern nur der Klick darauf. Gemessen
    // 129 895 Bytes, also 153 Bytes Luft; was die nächsten Schritte der Torplatte im Kern brauchen (Blinzeln, Kamera
    // vor den Flügeln, Wirkung des Schalters, „noch nicht“ an den anderen Toren), muss dort erst Platz machen. Mit der
    // Drehung zur Torfront unverändert 127,0 KB (gemessen 130 002 Bytes, 46 Bytes Luft): Im Kern steht nur die Frage
    // an die 3D-Ansicht vor jedem Schritt (`blink`, danach der Takt wie nach einem frischen Druck) und die 3D-Ansicht
    // als Argument für „noch nicht“ (wartet, bis die Kamera vorn ist). Abdunkeln und Blickfächer setzt die 3D-Ansicht
    // als CSS-Variablen, den Schalter liest sie selbst. Kamera vor den Flügeln und „noch nicht“ an den anderen Toren
    // brauchen im Kern Platz: dafür die bewusste Anhebung um höchstens 1 KB aus dem Konzept „Torplatte“. Mit dem
    // Eistor von vorn (`opening` zählt das Vorspiel mit, so gilt auch der Umriss in `guideGate`; die Flügel nach `at`
    // aus dem Ereignis `gate`, in Takten der Regeln statt nach der Uhr, damit sie bei offenem Menü mitwarten)
    // 130 033 Bytes, 15 Bytes Luft. Eine Taktuhr als eigene Klasse kostete gut 0,2 KB und passte nicht. Platz ohne
    // Anheben für die Platten der anderen Welten: Die Anmeldung des Service Workers wartet ohnehin aufs Laden der
    // Seite und kommt nachgeladen (pwa-register.ts), die Postkarte holt das generische `later` (lib/games/later.ts):
    // 128 462 Bytes, 1586 Bytes Luft. 126,3 KB (129 347 Bytes) mit den Platten der anderen Welten: Klang je Welt
    // (`PLATE_SOUND` mit Pentatonik je Welt in sfx.ts, eine kleine Tabelle), in 2D das Bild der Portal-Plattform als
    // Zeichen der Platte (keine neue Grafik; aufrecht und ohne Rot, `plateSign`), wann ein Tor, das nie aufgeht, „noch
    // nicht“ zeigt (`nope` in mitwachsen-guide.ts) und das Nachladen von Bild und Ton dazu (mitwachsen-hint-look.ts):
    // knapp 0,9 KB; 701 Bytes Luft
    budget: 127 * 1024,
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
    // `ICE_FLOE` für 2D und 3D); 43,0 KB, seit die Platte das Eistor öffnet (Bucht samt Warten an der Platte und
    // Sicherheitsnetz, Stehzeit in `opens`, goldener Rand statt goldener Bucht), Platz gemacht ohne Anheben: Wege und
    // Feld-Schlüssel des Pakets je einmal (worlds/eis/mitwachsen-flood.ts), Regeln des Pinguins als schlichtes Objekt
    // statt Modul-Namensraum, gefüllter Umriss ohne doppelten Goldrahmen; gemessen 44 010 Bytes, also 22 Bytes Luft.
    // 43,5 KB mit „noch nicht“ am Eistor: bewusst um 0,5 KB angehoben, wie für diesen Schritt vereinbart. Wann das Tor
    // zeigt, was fehlt, und das frühe Holen von Bild und Ton (worlds/eis/mitwachsen-plate-hint.ts, `View2D.hint`) gehört
    // nur zur Eis-Welt und liegt darum hier statt im Kern (dort sparte es gut 0,3 KB); gemessen 44 453 Bytes, also
    // 91 Bytes Luft. Die nächsten Schritte der Torplatte brauchen hier Platz oder eine begründete, knappe Anhebung.
    // 43,6 KB, seit das Eistor von vorn aufgeht: Vorspiel je Torlage (`preTicks`, doppelt zu `leadTicks`, damit
    // mitwachsen-turn-pace.ts keine eigene, von Kern, Paket und Drehung nachgeladene Datei wird; die kostete im Kern
    // den Eintrag in der Liste zum Vorladen, und der Kern hat keine Luft), Hüpfen im Vorspiel, wann die Flügel
    // aufschwingen (`at`), Rumms und Akkord erst dann (`gateScore`): 0,17 KB, das liegt nur in der Eis-Welt.
    // Bewusst knapp um 0,1 KB angehoben; gemessen 44 628 Bytes, 18 Bytes Luft. 43,8 KB nach der Prüfung des Schritts:
    // Im Vorspiel läuft niemand durch die noch geschlossenen Flügel (Regel `shut` in `rules.bump`, der Pinguin rutscht
    // nicht und tauscht nicht), die Sperre prüft das Vorspiel selbst (`hold`), der Umriss füllt sich schon im Vorspiel
    // (`ritualGlow`, geteilt mit der 3D-Ansicht) und die Eis-Melodie liegt beim Leuchten der Eiszapfen. Das gehört nur
    // zur Eis-Welt, der Kern hat keine Luft; bewusst knapp um 0,2 KB angehoben, gemessen 44 823 Bytes, 28 Bytes Luft
    budget: 43.8 * 1024,
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
    // 596,8 KB mit ihrem goldenen, pulsierenden Rand statt der goldenen Bucht; 597,1 KB, seit die Flügel eines Tors bei
    // „noch nicht“ wackeln (`MovingGates.wing`, `hintShake`; bewusst für alle Tore gleich, kein Sonderfall einer Welt);
    // 600,0 KB mit der Drehung zur Torfront: Kamera aus Winkel, Neigung, Abstand und Blickhöhe (mitwachsen-camera.ts),
    // Sonne dreht mit, Zugang vor der Platte zur Front mit allen Flächen (`all`), Tiere auf den Tafeln und die lesende
    // Figur schauen zur Kamera, Nachladen der Drehung nah am Tor, Torhäuser je Tor neu gebaut statt alle
    // zusammen (mitwachsen-gatehouses-3d.ts). Der Drehregler selbst samt Blinzeln und Fächer kommt
    // erst dann (Regel „Drehung zur Torfront“ unten), sonst wäre die Grenze um 1,4 KB überschritten. 600,9 KB (615 310
    // Bytes), seit die Fassungen zur Front im Leerlauf entstehen und beim Betreten der Bucht nichts umspringt (zwei
    // Fassungen je Tor, alle Takte der bewegten Teile vorab, `MovingGates.fill`); 114 Bytes Luft. 615 400 Bytes mit dem
    // Eistor von vorn (Umriss füllt sich schon im Vorspiel, `ritualGlow`; wann die Eiszapfen leuchten, `iceGlow`, liegt
    // im 3D-Teil der Eis-Welt), 24 Bytes Luft. 602 KB mit den Platten der anderen Welten: bewusst um 1 KB angehoben,
    // wie im Konzept „Torplatte“ vereinbart. Ihr Aussehen (Fläche, Zeichen aus `PALETTE`, Lage darunter, Federn,
    // Wippen) gehört zum Bauplan ihres Zugangs (`plate` in mitwachsen-gate-<welt>.ts), es gibt für diese Welten noch
    // kein Welt-Paket, in das es ausweichen könnte. Sieben kleine Raster (doppelte Zeilen geteilt) und das Bauen
    // in mitwachsen-plate-3d.ts kosten knapp 1 KB; gemessen 616 428 Bytes. Mit `Vox.voxels()` aus main (Lesezugriff
    // für die Tests im Zeitbudget) 616 464 Bytes: um 0,1 KB angehoben, 86 Bytes Luft
    budget: 602.1 * 1024,
    // Probe: Das Leuchten der Eiszapfen gibt es nur im 3D-Teil der Eis-Welt (ICE_GLOW in worlds/eis/view-3d-gate.ts)
    forbidden: /#7fd6ff/,
  },
  {
    name: '„Noch nicht“ am Tor',
    pages: /^spielen\/index\.html$/,
    chunks: /\/mitwachsen-hint-look\.[\w-]+\.js$/,
    // Bild, Ton und Live-Region, wenn ein Tor zeigt, was noch fehlt: leerer goldener Umriss aus dem Modell der Art
    // gerastert, Puls, „hm-hm?“ mit Riegel und Klangstein. Kommt erst, wenn die Figur das erste Mal auf die Platte des
    // Eistors tritt (`import()` aus dem Paket der Eis-Welt, worlds/eis/mitwachsen-plate-hint.ts), nie mit der
    // Spielseite: gemessen 1,6 KB. 2,2 KB, seit auch die Tore, die nie aufgehen, „noch nicht“ zeigen (`never`: das
    // Zeichen ihrer Welt als goldener Umriss aus dem Bild ihrer Portal-Plattform, „Noch nicht.“ in der Live-Region);
    // die Spielseite lädt es beim ersten Schritt auf eine Torplatte; in 3D liegt der Umriss entlang der Tür, von vorn
    // richtig herum. Liegt hier statt im Kern, bewusst knapp angehoben: gemessen 2241 Bytes, 11 Bytes Luft
    budget: 2.2 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Drehung zur Torfront',
    pages: /^spielen\/index\.html$/,
    chunks: /\/mitwachsen-turn-3d\.[\w-]+\.js$/,
    // kommt erst nach der 3D-Ansicht, wenn die Figur einem Tor nah ist (`NEAR_GATE` in mitwachsen-3d.ts)
    after: /\/mitwachsen-3d\.[\w-]+\.js$/,
    // Drehregler (mitwachsen-turn.ts: Fortschritt, Feder, Pendeln, Heranrücken, Blinzeln, Bucht) und sein Einbau
    // (mitwachsen-turn-3d.ts: Platte, Schritt und Pfeile je Bild, Elternschalter, Abdunkeln und Blickfächer als
    // CSS-Variablen, welcher Zugang zur Front gebaut ist, ob mehr als halb gedreht): gemessen 3,9 KB (3951 Bytes);
    // 4094 Bytes mit dem Eistor von vorn (Vorspiel ohne Wartezeit, Ritual vorn nur auf der Platte, Rückfahrt in den
    // letzten 0,6 s, Süd blinzelt zurück). 4,1 KB, bewusst knapp angehoben: Nach einem Blinzeln im Vorspiel dreht das
    // Ritual nicht neu und blinzelt nicht zweimal (`mode`), und `busy` gilt erst ab Beginn des Rituals, seit `opening`
    // das Vorspiel mitzählt; gemessen 4165 Bytes, 33 Bytes Luft. Das liegt nur hier, nicht im Kern
    budget: 4.1 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
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
    // Eisscholle mit Schneeflocke (`GateLook.plate`, Farben und Zeichen aus `ICE_FLOE`); 3,0 KB ohne die goldene Bucht
    // (den goldenen Rand der Torplatte baut die 3D-Ansicht); dazu 3 KB Luft
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
