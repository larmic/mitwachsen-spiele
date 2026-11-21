// Gletscherkessel (Gletschertal) der Eis-Welt: Maße, Lage von Eisloch, Fischkisten, Moosfleck und Eis-Portal, Wohnorte der zehn
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
  /** Eisloch: rundes Wasserloch (Radius in Feldern) seitlich hinter dem Bett, ringsum ebenes Ufer */
  hole: { across: 13, out: 5, r: 1.6 },
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
 * Wohnorte der Eis-Tiere, relativ zum Schneebett: im Kreis (Radius 11) um die Schneewiese, gut verteilt. Die Welt sucht
 * das nächste erreichbare Feld im Tal (wie der Kessel gedreht ist, würfelt der Seed mit dem Eistor).
 */
export const ICE_ANIMALS: readonly { species: IceSpeciesId; at: readonly [number, number] }[] = [
  { species: 'pinguin', at: [3, 10] },
  { species: 'eisbaer', at: [-9, -6] },
  { species: 'robbe', at: [11, 0] },
  { species: 'schneeeule', at: [-3, -10] },
  { species: 'walross', at: [9, 6] },
  { species: 'rentier', at: [-11, 0] },
  { species: 'polarfuchs', at: [9, -6] },
  { species: 'moschusochse', at: [-9, 6] },
  { species: 'papageitaucher', at: [3, -10] },
  { species: 'lemming', at: [-3, 10] },
];
