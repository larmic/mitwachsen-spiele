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
   * Pilzgarten links: Mooswiese mit kleinen Leuchtpilzen und `beds` Beeten (je drei Leuchtpilze zum Sammeln) im Kreis
   * mit Radius `ring` um seine Mitte
   */
  garden: { across: -24, out: 47, r: 10, beds: 6, ring: 5 },
  /**
   * Kristallhalle rechts: fünf geschliffene Säulen in einer Reihe (`columns`, Höhen 2 bis 5, je zwei Felder Abstand),
   * dahinter der Kristallbogen (fünf Felder breit), ringsum hohe Kristalle
   */
  hall: { across: 25, out: 57, r: 12, columns: [2, 3, 5, 4, 3], arch: 8 },
  /**
   * Tropfsteingrotte in der Mitte: Stalagmiten in drei Höhen, dazu ein Felsbecken 3 × 2 mit Moosrand (`basin`: seine Mitte,
   * quer von der Mitte der Zone); hinten über dem Becken die Tropfquelle, auf dem Rand ringsum Tropfmoos
   */
  drip: { across: 0, out: 88, r: 11, basin: -6 },
  /** Stiller See hinten: flaches Wasser (Ellipse), ein Steg zur Kristallinsel (Radius `isle`) in seiner Mitte */
  lake: { across: 0, out: 118, rx: 13, ry: 8, isle: 2.5 },
  /** Geröllhang seitlich am See: drei Stufen (Höhe 2, 3, 4), jede `step` Felder tief */
  scree: { across: 27, out: 116, half: 6, step: 3 },
  /** Mitte der Plattform des Portals `hoehlensee` [quer, vom Tor weg]: hinter dem See am Ende der Grotte */
  portal: [0, 134],
  /** Dichte der Dinge auf dem freien Boden: Kristalle, Stalagmiten, Leuchtpilze (Anteile) */
  things: { crystal: 0.03, stalagmite: 0.015, shroom: 0.02 },
} as const;

/**
 * Farben der Grotte. Höhlenhimmel (oben offen, nie dunkler als die Dämmerung der Lichtung) und Nebel-Maske über dem
 * Unerkundeten; Schichten der Klippen und des Bodens (wie am Höhlentor); Kristalle in Lila, Türkis und Rosa; Leuchtpilze
 * in Rosa, Türkis und Gelb; Moos; Holz des Dachs an der Kristallwand. Kein Gold: Das ist die Aktionsfarbe.
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
  roof: ['#8d86a8', '#a59fbf'],
  rock: ['#9a96b0', '#b8b4cc'],
  water: ['#5fc8d8', '#8fe0ea'],
} as const;
