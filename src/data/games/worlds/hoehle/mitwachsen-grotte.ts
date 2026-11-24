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
  /** Sockel der Kristall-Laterne, relativ zum Höhlenbett: rechts vorn, gespiegelt zum Platz des Klangsteins (−3, 1) */
  lantern: [3, 1],
  /**
   * Pilzgarten links: Mooswiese mit kleinen Leuchtpilzen und `beds` Beeten (je drei Leuchtpilze zum Sammeln) im Kreis
   * mit Radius `ring` um seine Mitte
   */
  garden: { across: -24, out: 47, r: 10, beds: 6, ring: 5 },
  /**
   * Kristallhalle rechts: fünf geschliffene, freistehende Säulen in einer Reihe, je zwei Felder Abstand, das
   * Säulen-Glockenspiel (Töne C5, D5, E5, G5, A5 von links nach rechts, `Cell.note` 0 bis 4); `columns` ihre Höhen je
   * Ton, die tiefste die höchste wie bei einem Xylofon. Dahinter der Kristallbogen (fünf Felder breit), ringsum hohe Kristalle
   */
  hall: { across: 25, out: 57, r: 12, columns: [5, 4.5, 4, 3.5, 3], arch: 8 },
  /**
   * Tropfsteingrotte in der Mitte: Stalagmiten in drei Höhen, dazu ein Felsbecken 3 × 2 mit Moosrand (`basin`: seine Mitte,
   * quer von der Mitte der Zone); hinten über dem Becken die Tropfquelle, auf dem Rand ringsum Tropfmoos
   */
  drip: { across: 0, out: 88, r: 11, basin: -6 },
  /**
   * Stiller See hinten: flaches Wasser (Ellipse), ein Holzsteg (drei Planken breit, `'jetty'`) vom vorderen Ufer zur
   * Kristallinsel (Radius `isle`) in seiner Mitte; neben seinem Ende taucht der Grottenolm auf
   */
  lake: { across: 0, out: 118, rx: 13, ry: 8, isle: 2.5 },
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
   * und Moos nur unter den Lichtschächten, bis `r` Felder um ihre Mitte, Farn auf dem Anteil `fern` des Mooses.
   */
  fill: {
    groups: { every: 7, rim: 1, drip: 1, side: 0.55 },
    bush: 0.02,
    boulder: 0.012,
    puddle: 0.005,
    islands: { every: 12, chance: 0.5 },
    shade: { r: 5, fern: 0.3 },
  },
} as const;

/**
 * Farben der Grotte. Höhlenhimmel (oben offen, nie dunkler als die Dämmerung der Lichtung) und Nebel-Maske über dem
 * Unerkundeten; Schichten der Klippen und des Bodens (wie am Höhlentor); Kristalle in Lila, Türkis und Rosa; Leuchtpilze
 * in Rosa, Türkis und Gelb; Moos; Holz des Dachs an der Kristallwand; türkises Wasser; Lehm; Schatten der Ränder und
 * Licht des Lichtkreises. Kein Gold: Das ist die Aktionsfarbe (nur die Kristall-Laterne trägt es, solange man sie nehmen kann).
 */
export const GROTTE_COLORS = {
  sky: '#4a4370',
  mist: '#8a82b0',
  /** Himmel in 2D, drei Streifen von oben (dort scheint er durch den Nebel) */
  heaven: ['#7f77a8', '#8a82b0', '#968fba'],
  bands: ['#f0ecfa', '#d6d2e6', '#e6e2f2', '#ccc8de'],
  floor: ['#d6d2e6', '#e6e2f2'],
  crystals: ['#b48cf0', '#6fd6f0', '#f08cc8'],
  shrooms: SHROOM_COLORS,
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
  /** Lichtkreis um die Figur: kühles, helles Licht */
  circle: [240, 238, 255],
  /** Abendlicht in den Lichtschächten (ab 20 min Spielzeit): golden-orange, halb durchsichtig über dem Lichtfleck */
  dusk: '#ffa65c',
} as const;
