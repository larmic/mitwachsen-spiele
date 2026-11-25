// Kristallgrotte der Höhlenwelt: Maße, Zonen, Lichtschächte und Farben. Nur das Welt-Paket der Höhlenwelt
// (src/scripts/games/worlds/hoehle/) liest diese Daten; es wird nachgeladen.
// Konzept: docs/games/mitwachsen.md (Höhlenwelt) · Spec: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { SHROOM_COLORS } from '../../mitwachsen-hoehle';

/**
 * Die Grotte: eine große, oben offene Höhle hinter dem Höhlentor. Lagen quer zum Gang (`across`, links negativ) und vom
 * Tor weg (`out`), gemessen von der Mündung aus (dem inneren Rand der Klippen, wo der Gang hereinkommt).
 */
export const GROTTE = {
  /** Halbachsen der Grotte innen: quer und vom Tor weg (etwa 92 × 144 Felder, etwa 10.000 Bodenfelder; das Konzept schätzte 9.000) */
  shape: { rx: 46, ry: 72 },
  /** so dick sind die Felsklippen ringsum (mindestens, der Rand innen ist leicht gewellt) */
  cliff: 5,
  /** so viele Felder Abstand hält die Grotte vom Felsring, von anderen Gängen und Welten */
  gap: 2,
  /** so viele Felder hinter der Mündung steht das Höhlenbett (unter dem ersten Lichtschacht) */
  bed: 28,
  /** so weit um das Bett bleibt der Boden eben und frei: Mooswiese und Unterstand an der Kristallwand */
  flat: 6,
  /** Lampengang: bis so weit hinter der Mündung stehen links und rechts Kristall-Lampen, alle `every` Felder */
  lamps: { to: 6, every: 2 },
  /**
   * Platz für den Bahnhof Fledermaus (kommt mit dem Zug): ein ebener, freier Streifen neben dem Weg, `out` Felder hinter
   * der Mündung, `long` Felder lang (vom Tor weg) und `wide` breit, `side` Felder neben der Mitte
   */
  station: { out: 10, long: 7, wide: 2, side: 5 },
  /**
   * Platz für den Lokschuppen neben dem Bahnhof (kommt mit dem Zug: vorn offen, Unterstand wie das Iglu, Toks Zuhause):
   * ebener, freier Grund, zwei Felder neben dem Bahnsteig, gemessen wie `station`
   */
  shed: { out: 11, long: 5, wide: 4, side: 9 },
  /** Drei Lichtschächte [quer, vom Tor weg]: über dem Bett, in der Kristallhalle, am stillen See */
  shafts: [
    [0, 28],
    [27, 58],
    [-6, 118],
  ],
  /** Lichtfleck unter einem Schacht: Radius und wie viel heller in der Mitte (0,35: um 35 %) */
  shaft: { r: 2.5, light: 0.35 },
  /** Kristalle und Leuchtpilze machen ihr Feld und die acht Nachbarn so viel heller */
  glow: 0.15,
  /**
   * Ränder im Dunkel (mitwachsen-glow.ts): Felswände um `wall` dunkler, der Boden direkt an der Wand um `floor`, nach
   * innen weniger, `reach` Felder von der Wand nichts mehr. Wege, Bett, Lichtschächte und Leuchtendes bleiben hell
   */
  edge: { wall: 0.3, floor: 0.25, reach: 6 },
  /**
   * Lichtkreis um die Figur in der Grotte (Ebene über der Welt, kein Punktlicht): Radius in Feldern und Stärke, mit der
   * Kristall-Laterne größer und etwas heller; wächst in `grow` ms (bei reduzierter Bewegung sofort)
   */
  circle: { r: 2.5, lantern: 4.5, alpha: 0.16, lanternAlpha: 0.22, grow: 600 },
  /**
   * Dunkelmaske über dem Bild (mitwachsen-mask.ts, Entscheidung des Vaters vom 24.11.2026): Stärke `mask` abseits der
   * Figur, „Höhle hell“ `bright`; die Grenzen stehen als Helligkeit (relative Luminanz): nichts unter der Maske unter
   * `floor` (so hell ist ihre Farbe `GROTTE_COLORS.dark`; der Grottenboden liegt dann bei etwa 0,12), um die Figur, auf
   * dem Weg zum Bett und an allem, was leuchtet, nie unter `dusk` (die Dämmerung von heute). Die 0,62 des Vaters galten
   * für ein tiefes Nachtlila, unter dem Fels und Nebel unter 0,08 fielen; die hellere Farbe braucht 0,87 für denselben
   * Boden. Lichtloch um die Figur `hole` Felder, mit Laterne `lantern` (wächst in `circle.grow` ms), im Fahrzeug um den
   * Sitz `seat`, an den Lampen vorn `lamp`. Feste Löcher (`fixed`, Radius in Feldern): Lichtschächte, Wiese am Bett,
   * Bahnhof Fledermaus, Mündung des Gangs, jedes Netz der Tupfspinnen (`web`). Kleine Löcher (`small`) nur bis `near` Felder um die Figur (die letzten zwei
   * weich; Leuchtmoos `moss`, die Mitte eines Kristallfelds `field`, der Wasserfall `fall`); Wege als Bänder, `band` Felder breit. Höchstens `most` Löcher je Bild. Im Gang blendet sie mit dem Weg aus,
   * `gang` Felder von der Mündung ist sie weg, und nie schneller als in `fade` ms; ist die Nacht bei `night`, ist sie ganz
   * weg (Maske × (1 − Nacht / `night`))
   */
  dark: {
    mask: 0.87,
    bright: 0.3,
    floor: 0.08,
    dusk: 0.16,
    hole: 3,
    lantern: 6.5,
    seat: 3.5,
    lamp: 1.2,
    fixed: { shaft: 3.5, meadow: 6, station: 4, mouth: 3, web: 2 },
    small: { crystal: 0.8, column: 1, lamp: 1, bed: 1.2, spring: 1.2, animal: 1, moss: 0.6, field: 1.1, fall: 1.2 },
    near: 9,
    band: 2.5,
    most: 48,
    fade: 1000,
    gang: 12,
    night: 0.496,
  },
  /**
   * Flecken im Grottenboden (`GROTTE_COLORS.patches`): wo das weiche Rauschen des Bodens (`Cell.shade`, −1 … 1) unter
   * `cool` liegt, ein kühl lila Fleck, über `warm` ein zart roséner
   */
  patch: { cool: -0.35, warm: 0.5 },
  /** Sockel der Kristall-Laterne, relativ zum Höhlenbett: rechts vorn, gespiegelt zum Platz des Klangsteins (−3, 1) */
  lantern: [3, 1],
  /**
   * Pilzgarten links: Mooswiese mit `beds` Beeten (je ein Büschel aus fünf Leuchtpilzen zum Sammeln) im Kreis mit
   * Radius `ring` um seine Mitte; kleine weiß-blaue Deko-Pilze nur am Rand der Wiese, ab `edge` Feldern von der Mitte
   */
  garden: { across: -24, out: 47, r: 10, beds: 4, ring: 4, edge: 8 },
  /**
   * Zwei Pilzbeete näher am Bett (Entscheidung des Vaters vom 24.11.2026): [quer, vom Tor weg] von der Mündung, etwa 12
   * Felder vom Höhlenbett auf dem Weg zum Pilzgarten, je auf einem kleinen Moosfleck (`moss` Felder Radius), damit das
   * Kind in der ersten Minute eine Quelle findet
   */
  nearBeds: {
    at: [
      [-11, 33],
      [-8, 37],
    ],
    moss: 1.5,
  },
  /**
   * Ein Funke über den Sammelstellen (Schritt 9 der Rückmeldung): alle `every` ms höchstens ein kleiner Funke auf dem
   * ganzen Bild, `show` ms lang, abwechselnd über den `of` nächsten vollen Pilzbeeten bis `near` Felder um die Figur; bei
   * reduzierter Bewegung keiner
   */
  spark: { every: 3500, show: 700, near: 12, of: 3 },
  /**
   * Kristallhalle rechts: fünf geschliffene, freistehende Säulen in einer Reihe, je zwei Felder Abstand, das
   * Säulen-Glockenspiel (Töne C5, D5, E5, G5, A5 von links nach rechts, `Cell.note` 0 bis 4); `columns` ihre Höhen je
   * Ton, die tiefste die höchste wie bei einem Xylofon. Dahinter der Kristallbogen (fünf Felder breit), ringsum hohe Kristalle
   */
  hall: { across: 25, out: 57, r: 12, columns: [5, 4.5, 4, 3.5, 3], arch: 8 },
  /**
   * Kleine Lichtgeister in der Kristallhalle (Schritt 11 der Rückmeldung, Regeln in mitwachsen-ghost.ts): `count` Geister,
   * jeder in einem Versteck seitlich an einer Säule (`side` Felder neben ihrer Mitte nach Osten oder Westen, `back` ein
   * wenig dahinter, nie im Norden); zu sehen nur im Licht (Laterne: `circle.lantern`), ein- und ausblenden in `fade` ms;
   * kommt die Figur auf `near` Felder heran, schwebt er in `float` ms zum nächsten Versteck höchstens `hop` Felder von
   * ihr; nach `after` Verstecken eine Freudenrunde von `joy` ms; gekichert wird höchstens alle `gap` ms. Klangstein
   * „lichtgeister“ an `stone` [quer, vom Tor weg], links vor den Säulen
   */
  ghost: {
    count: 2,
    side: 0.62,
    back: 0.15,
    fade: 400,
    near: 2,
    hop: 3.5,
    float: 1000,
    after: 3,
    joy: 1600,
    gap: 1200,
    stone: [18, 52],
  },
  /**
   * Tupfspinnen (Schritt 12 der Rückmeldung, Regeln in mitwachsen-spider.ts): `least` bis `most` Netze je Welt, jedes ein
   * Ding auf einem Feld an Stelle eines Stalagmiten der Füllung, mindestens `away` Felder von Bett, Bahnhof Fledermaus und
   * Wegen, `apart` Felder voneinander, mit eigenem festen Lichtloch (`dark.fixed.web`). Die Spinne hängt `rest` über dem
   * Boden; läuft das Kind gegen das Netz, seilt sie sich in `down` ms um `drop` ab, winkt `wave` ms (die Beine wechseln
   * alle `beat` ms) und klettert in `up` ms zurück; die Harfe klingt höchstens alle `gap` ms. Mit der Laterne bis `lamp`
   * Felder glitzern die Perlen reihum, je Perle `twinkle` ms; beim Harfen leuchtet jede Perle `flash` ms mit ihrem Ton
   */
  web: {
    least: 3,
    most: 4,
    away: 8,
    apart: 14,
    rest: 0.85,
    drop: 0.35,
    down: 500,
    wave: 1000,
    beat: 150,
    up: 600,
    gap: 500,
    lamp: 4.5,
    twinkle: 180,
    flash: 300,
  },
  /**
   * Tropfsteingrotte in der Mitte: Stalagmiten in drei Höhen, dazu ein Felsbecken 3 × 2 mit Moosrand (`basin`: seine Mitte,
   * quer von der Mitte der Zone); hinten über dem Becken die Tropfquelle, auf dem Rand ringsum Tropfmoos
   */
  drip: { across: 0, out: 88, r: 11, basin: -6 },
  /**
   * Stiller See hinten: flaches Wasser (Ellipse), ein Holzsteg (drei Planken breit, `'jetty'`) vom vorderen Ufer zur
   * Kristallinsel (Radius `isle`) in seiner Mitte; neben seinem Ende taucht der Grottenolm auf. Am Ufer helle Steine auf
   * dem Anteil `shore` der freien Felder am Wasser
   */
  lake: { across: 0, out: 118, rx: 13, ry: 8, isle: 2.5, shore: 0.4 },
  /** Geröllhang seitlich am See: drei Stufen (Höhe 2, 3, 4), jede `step` Felder tief */
  scree: { across: 27, out: 116, half: 6, step: 3 },
  /** Mitte der Plattform des Portals `hoehlensee` [quer, vom Tor weg]: hinter dem See am Ende der Grotte */
  portal: [0, 134],
  /** Dichte der Dinge auf dem freien Boden: Kristalle, Stalagmiten, Leuchtpilze (Anteile) */
  things: { crystal: 0.03, stalagmite: 0.015, shroom: 0.02 },
  /**
   * Lehmhang des Dachses links neben dem Pilzgarten (`'clay'`, begehbar): `long` Felder lang (vom Tor weg), nach außen
   * zwei Stufen Lehm (Höhe 2 und 3), jede `step` Felder breit; `across` ist seine Innenkante
   */
  clay: { across: -35, out: 43, long: 9, step: 2 },
  /**
   * Füllung der Grotte, damit sie nicht leer wirkt (wie Bäume und Büsche auf der Lichtung; mitwachsen-fill.ts).
   * `groups`: Stalagmiten-Gruppen zu 3 bis 5 in drei Höhen, fest wie Bäume, mit begehbaren Lücken (ein Feld); je Feld
   * eines Rasters von `every` Feldern eine Gruppe mit der Chance je Zone (`rim` am Rand, `drip` in der Tropfsteingrotte,
   * `side` sonst). `bush`: niedrige leuchtende Kristallbüsche (fest wie ein Busch), `boulder`: Felsbrocken (fest),
   * `puddle`: kleine türkise Pfützen (begehbar), je als Anteil der freien Felder. `islands`: flache Felsinseln mit Moos
   * obenauf (eine Stufe hoch, begehbar), je Feld eines Rasters von `every` Feldern mit der Chance `chance`. `shade`: Farn
   * und Moos nur unter den Lichtschächten, bis `r` Felder um ihre Mitte, Farn auf dem Anteil `fern` des Mooses, Leuchtmoos
   * auf dem Anteil `glow` des übrigen.
   * Fülle (Schritt 8 der Rückmeldung, alles flach und begehbar): `fields` Kristallfelder, je Feld eines Rasters von `every`
   * Feldern mit der Chance `chance` ein Feld aus 3 bis 6 Feldern niedriger Kristallsplitter in der Farbe der Zone;
   * `veins` Adern im Boden, je Feld eines Rasters von `every` Feldern mit der Chance `chance` ein flacher Streifen, `long`
   * Felder lang (von, bis), nur Rosa oder Lila; `moss` Leuchtmoos am Fuß der Felswände auf dem Anteil `wall` der Felder
   * dort, es wächst an der Wand hoch.
   */
  fill: {
    groups: { every: 7, rim: 1, drip: 1, side: 0.55 },
    bush: 0.02,
    boulder: 0.012,
    puddle: 0.005,
    islands: { every: 12, chance: 0.5 },
    shade: { r: 5, fern: 0.3, glow: 0.3 },
    fields: { every: 9, chance: 0.45 },
    veins: { every: 8, chance: 0.4, long: [4, 7] },
    moss: { wall: 0.15 },
  },
  /**
   * Ein kleiner Wasserfall am stillen See, das Merkzeichen für „hier gibt es Wasser“: ein Fels am Nordufer (von der Kamera
   * aus hinten), das Wasser fällt nach vorn in den See. Gesucht von der Mitte des Sees `side` Felder seitlich (sonst auf
   * der anderen Seite), damit er nie auf Steg oder Kristallinsel trifft; `h` so hoch über dem Ufer fällt es
   */
  waterfall: { side: 4, h: 2.2 },
} as const;

/**
 * Farben der Grotte. Höhlenhimmel (oben offen, nie dunkler als die Dämmerung der Lichtung) und Nebel-Maske über dem
 * Unerkundeten; Schichten der Klippen und des Bodens (wie am Höhlentor), Flecken im Boden; Kristalle in Lila, Türkis und Rosa;
 * Stalagmiten und Felsbrocken mit dunklem Fuß und der Farbe ihrer Zone an der Spitze; Leuchtpilze
 * in Rosa, Türkis und Gelb; Moos; Holz des Dachs an der Kristallwand; türkises Wasser; Lehm; Schatten der Ränder und
 * Licht des Lichtkreises. Kein Gold: Das ist die Aktionsfarbe (nur die Kristall-Laterne trägt es, solange man sie nehmen kann).
 */
export const GROTTE_COLORS = {
  sky: '#4a4370',
  mist: '#8a82b0',
  /** Himmel in 2D, drei Streifen von oben (dort scheint er durch den Nebel) */
  heaven: ['#7f77a8', '#8a82b0', '#968fba'],
  bands: ['#f0ecfa', '#d6d2e6', '#e6e2f2', '#ccc8de'],
  /**
   * Oberseite des Grottenbodens in 3D: etwas dunkler als früher (#e6e2f2), damit er nicht wie Schnee wirkt, und hell
   * genug für die Maske (2D zeichnet ihn im Kern, `flatColors`, noch etwas dunkler)
   */
  floor: '#d6d2e6',
  /**
   * Flecken im Grottenboden (große, weiche Flecken aus `Cell.shade`), nur in 2D: kühl lila und zart rosé, kaum dunkler
   * als der Boden (sonst verlöre Gold an Kontrast); nie auf Licht, Randschatten, Moos oder Steg
   */
  patches: ['#c6c4e2', '#d8c6d8'],
  /**
   * Leuchtendes (Kristalle in Lila, Türkis, Rosa): so hell, dass es gegen den Boden unter der Maske mindestens 3 : 1
   * hat (Lila und Rosa heller als am Höhlentor, #b48cf0 und #f08cc8 hätten nur 2,3 und 2,7)
   */
  crystals: ['#cbacff', '#6fd6f0', '#ff9cd4'],
  /** Stalagmiten und Felsbrocken: dunkler Fuß und Mitte (gegen den Boden mindestens 3 : 1), die Spitze in der Farbe der Zone */
  stal: ['#5a5478', '#6e6690'],
  /**
   * Farbe der Spitzen je Zone (`tipOf` in mitwachsen-fill.ts): Pilzgarten grün, Kristallhalle lila, Tropfsteingrotte rosa,
   * Lehmhang ocker. Türkis bleibt dem Wasser, Gelb und Orange bleiben weg (sie läsen sich als Gold)
   */
  tips: { garden: '#86b45a', hall: '#8f6ad8', drip: '#c0609a', clay: '#a9825e' },
  shrooms: SHROOM_COLORS,
  /**
   * Deko-Pilze (Schritt 9 der Rückmeldung): kleine Leuchtpilze in Weiß-Blau, einer Farbe, die nie gesammelt wird (nie in
   * `SHROOM_COLORS`): Was nach Sammelpilz aussieht, kann man sammeln
   */
  decoShroom: '#cfe8ff',
  /** Dunkler Felsrand der Pilzbeete: Das Büschel hebt sich vom Moos ab */
  bedRim: ['#4a3f6b', '#5c5080'],
  /** Heller Fels der Tropfquelle und die hellen Steine am Ufer des Sees: Seite und Oberseite */
  bright: ['#d4d0e6', '#f1eefb'],
  moss: ['#6f9a4a', '#86b45a'],
  wood: ['#8a5a34', '#a8723f'],
  /** Planken des Holzstegs am stillen See */
  jetty: ['#9a6a3e', '#b9864f'],
  roof: ['#8d86a8', '#a59fbf'],
  rock: ['#9a96b0', '#b8b4cc'],
  /** Wasser in der Grotte (Becken, See, Pfützen, Steintrog), türkis: Farbe und Glanz */
  water: ['#5fc8d8', '#8fe0ea'],
  /** Lehm des Dachshangs: Seite und Oberseite */
  clay: ['#a8794c', '#c39462'],
  /** Schatten an den Rändern (2D halb durchsichtig über dem Boden; 3D dunkelt die Farbe ab) */
  shadow: '#2e2848',
  /** Dunkelmaske: Nachtlila, so hell wie ihre Untergrenze `GROTTE.dark.floor` (0,084): darunter wird nichts dunkler als sie */
  dark: '#534b7e',
  /** Lichtkreis um die Figur: kühles, helles Licht */
  circle: [240, 238, 255],
  /** Abendlicht in den Lichtschächten (ab 20 min Spielzeit): golden-orange, halb durchsichtig über dem Lichtfleck */
  dusk: '#ffa65c',
  /**
   * Leuchtmoos (Fülle): Polster und Tupfen, hellgrün #86e05a, leuchtet in der Dunkelmaske schwach (kleines Loch); der
   * Fuß dunkler, damit es auf hellem Boden Kontur hat
   */
  glowmoss: ['#4f9a34', '#86e05a'],
  /**
   * Adern im Boden (Fülle): flache Streifen, nur Lila (Kristallhalle und sonst) und Rosa (Tropfsteingrotte), nie Türkis
   * oder Blau (das läse sich neben Wasser als Wasser, und Wasser füllt die Kanne); etwas dunkler als der Boden, leuchten nicht
   */
  veins: ['#a68ee0', '#d98ab8'],
  /**
   * Kleine Lichtgeister: milchiges Pfirsich mit dunklerem, warmem Rand (sonst ginge er im hellen Licht unter), oben heller,
   * kräftige Wangen, geschlossene lachende Augen in warmem Braun, Glimmerpünktchen ohne Licht, Sternenkranz der
   * Freudenrunde in Weiß, Rosa und Lila (kein Gold: Gold ist nur, wo das Kind etwas tun kann)
   */
  ghost: {
    body: '#ffe3d0',
    top: '#fff0e4',
    rim: '#d98b70',
    cheek: '#f08a96',
    eye: '#6b4034',
    glimmer: '#fff3e8',
    stars: ['#ffffff', '#ffd6ec', '#e3d6ff'],
  },
  /**
   * Tupfspinne: dunkles Grün (ein helles Mint hätte auf dem Boden nur 1,07 : 1), oben etwas heller, Beine noch dunkler,
   * cremefarbene Tupfen, rosa Wangen, große Augen mit Pupille und Glanzpunkt. Kein Rot, kein Schwarz mit roten Augen
   */
  spider: {
    body: '#2f7a5a',
    top: '#3b8c69',
    leg: '#1c5038',
    dot: '#fff4dc',
    cheek: '#f08a96',
    eye: '#ffffff',
    pupil: '#1d2233',
  },
  /**
   * Netz der Tupfspinne, kein weißes Gitter: dicke, gestufte Fäden in Creme mit dunklem Rand, zwei Felsnasen in den Farben
   * der Stalagmiten, darauf fünf Perlen aus Tau in Rosa, Türkis, Lila, Hellgrün und Weiß-Blau (von unten nach oben, je
   * ein Ton der Harfe; kein Gold)
   */
  web: {
    thread: '#f1e6d0',
    rim: '#4a3f6b',
    beads: ['#ff9cd4', '#6fd6f0', '#cbacff', '#86e05a', '#cfe8ff'],
  },
} as const;
