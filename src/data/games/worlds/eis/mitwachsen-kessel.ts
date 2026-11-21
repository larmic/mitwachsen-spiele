// Gletscherkessel (Gletschertal) der Eis-Welt: Maße, Lage von Seen und Eislöchern, Eisberg, Fischkisten, Moosfleck,
// Eisfall und Eis-Portal, Lieblingsorte der zehn
// Eis-Tiere. Nur das Welt-Paket der Eis-Welt (src/scripts/games/worlds/eis/) liest diese Daten; es wird nachgeladen.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und Gletscherkessel)

import type { IceSpeciesId } from '../../mitwachsen-eis';

/**
 * Gletschertal (der Gletscherkessel): ein langes Tal vom Tor weg. Lagen quer zum Tor (`across`) und vom Tor weg (`out`),
 * gemessen vom Schneebett aus, das nah an der Mündung liegt.
 */
export const KESSEL = {
  /** Halbachsen des Tals innen: quer zum Tor und vom Tor weg (etwa 88 × 160 Felder, gut 10.000 Bodenfelder) */
  shape: { rx: 44, ry: 80 },
  /** so dick sind die Eisklippen ringsum (mindestens, der Rand innen ist leicht gewellt) */
  cliff: 5,
  /** so viele Felder hinter dem inneren Rand der Klippen an der Mündung (vom Tor weg) liegt das Schneebett */
  bed: 30,
  /** so weit um das Bett bleibt der Boden eben und frei: Wiese und Iglu */
  flat: 6,
  /** so viele Felder Abstand hält das Tal mindestens vom Felsring der Lichtung */
  gap: 2,
  /**
   * Drei zugefrorene Seen [quer, vom Tor weg, Radius]: ein kleiner seitlich hinter dem Bett, zwei große weiter hinten
   * im Tal (ihre Mitte würfelt der Seed bis `lakeJitter` Felder weit, den Rand wellt ein Rauschen). Glattes Eis auf
   * Höhe 1, begehbar; in der Mitte jedes Sees ein Eisloch
   */
  lakes: [
    [13, 5, 4],
    [20, 42, 10],
    [-19, 76, 8],
  ],
  lakeJitter: 3,
  /** Eisloch in der Mitte jedes Sees: rundes Wasserloch (Radius in Feldern), ringsum `shore` Felder ebenes Ufer aus Eis */
  hole: { r: 1.6, shore: 2 },
  /**
   * Eisfall am Talende: `half` Felder links und rechts der Mitte werden die Klippen zu einer glatten Wand aus gefrorenem
   * Wasser, alle `h` hoch (so hoch wie die höchsten Klippen, eine Wand statt Stufen); davor liegt `foot` Felder breit
   * ein gefrorenes Becken aus Eis auf dem Boden (von oben sichtbar, gleich wie das Tal gedreht ist)
   */
  fall: { half: 7, h: 6, foot: 2 },
  /**
   * Eisberg zum Erklettern am ersten großen See (`lake`, Index in `lakes`): `out` Felder hinter seinem Eisloch (vom Tor
   * weg, er wandert mit dem See). Runde Stufen aus Eis, jede eine Ebene höher (Höhe 2 bis `top`), jede `step` Felder
   * breit, oben ein ebener Gipfel (Radius `plateau`) mit Fahne; ringsum `girdle` Felder glattes Eis des Sees, und von
   * dort ein Steg aus Eis (drei Felder breit) quer zur Mitte des Tals, bis `steg` Felder neben der Achse (dem Hauptweg
   * vom Schneebett zum Eis-Portal)
   */
  berg: { lake: 1, out: 12, top: 5, plateau: 1.5, step: 1.2, girdle: 2, steg: 4 },
  /**
   * Sechs Fischkisten [quer, vom Tor weg]: drei nah am Zuhause (am Ende der Rutschspur nahe dem Tor, hinter dem Bett
   * und nahe dem Eisloch, jede 8 bis 14 Felder von der Schneewiese), drei weiter hinten im Tal (links, rechts, ganz
   * hinten vor dem Eis-Portal); einzeln mit freiem Platz ringsum
   */
  crates: [
    [-4, -15],
    [0, 15],
    [17, 1],
    [-24, 45],
    [22, 75],
    [-9, 102],
  ],
  /** Moosfleck: grünes Moos und Flechten unter dem Schnee (nur Kulisse, begehbar) */
  moss: { across: -14, out: 3, r: 1.8 },
  /**
   * Mitte der Plattform des Eis-Portals [quer, vom Tor weg]: ganz hinten am Talende, der Heimweg nach dem langen Weg.
   * Ihr Gegenstück steht im Kreis um das Schneebett in Richtung des Tors.
   */
  portal: [0, 114],
} as const;

/**
 * Farben, die nur das Tal kennt (der Kern liest sie als `color` des Felds): Seite des Eisfalls, Seite der Stufen des
 * Eisbergs, Eisscholle (Seite, oben; oben auch auf der Karte)
 */
export const KESSEL_COLORS = {
  fall: '#6fbde6',
  berg: '#7ac3ea',
  floe: ['#d9e6f0', '#ffffff'],
} as const;

/**
 * Farben der Schneemänner (Seite, oben): Kohle für Augen und Knöpfe, Möhrennase, roter Schal, blaue Wollmütze mit
 * weißem Bommel (kein Gold: das ist die Aktionsfarbe). Dazu, was einen Schneehaufen von den begehbaren Schneewehen
 * unterscheidet: ein bläulicher Schattenrand, eine kleine Kugel daneben und ein Zweig obenauf.
 */
export const SNOWMAN_COLORS = {
  coal: '#2b2f3a',
  carrot: ['#e8892a', '#f2a043'],
  scarf: ['#d9473a', '#e8504a'],
  hat: ['#3f8fd8', '#5aa6e8'],
  bommel: '#ffffff',
  shadow: ['#a9c6dd', '#c3d9ea'],
  twig: ['#6b4a2b', '#7d5a36'],
} as const;

/**
 * Lieblingsorte der Eis-Tiere: Seen (glattes Eis und Eislöcher), Tannen, Eisblöcke, der Eisfall am Talende, das Iglu
 */
export type IceHaunt = 'lake' | 'pines' | 'blocks' | 'fall' | 'igloo';

/**
 * Lieblingsorte der Eis-Tiere über das ganze Tal, in der Reihenfolge der Leiste: `at` [quer, vom Tor weg] vom
 * Schneebett aus sagt, wo im Tal; dort sucht die Welt das nächste Feld mit dem Thema `near` (Tannen und Eisblöcke
 * würfelt der Seed) und darum das nächste erreichbare Feld. Das erste Tier jeder Art wohnt dort, die anderen vier
 * verteilt der Seed über das Tal. Robben und Walrosse an den beiden großen Seen, Rentiere und Moschusochsen bei den
 * Tannen vorn und hinten, Polarfuchs und Lemming zwischen Eisblöcken, der Eisbär hinten am Eisfall, der Pinguin nahe
 * dem Iglu, die Schneeeule in den Tannen hinten, der Papageitaucher am kleinen See neben dem Bett.
 */
export const ICE_ANIMALS: readonly { species: IceSpeciesId; near: IceHaunt; at: readonly [number, number] }[] = [
  { species: 'pinguin', near: 'igloo', at: [0, 0] },
  { species: 'eisbaer', near: 'fall', at: [-9, 124] },
  { species: 'robbe', near: 'lake', at: [16, 40] },
  { species: 'schneeeule', near: 'pines', at: [-22, 100] },
  { species: 'walross', near: 'lake', at: [-16, 76] },
  { species: 'rentier', near: 'pines', at: [-26, 18] },
  { species: 'polarfuchs', near: 'blocks', at: [20, 62] },
  { species: 'moschusochse', near: 'pines', at: [26, 92] },
  { species: 'papageitaucher', near: 'lake', at: [13, 9] },
  { species: 'lemming', near: 'blocks', at: [-18, 50] },
];
