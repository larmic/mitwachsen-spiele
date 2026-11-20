// Gletscherkessel der Eis-Welt: Maße, Lage von Eisloch, Fischkisten, Moosfleck und Eis-Portal, Wohnorte der zehn
// Eis-Tiere. Nur das Welt-Paket der Eis-Welt (src/scripts/games/worlds/eis/) liest diese Daten; es wird nachgeladen.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und Gletscherkessel)

import type { IceSpeciesId } from '../../mitwachsen-eis';

/** Gletscherkessel: Lagen quer zum Tor (`across`) und vom Tor weg (`out`), von der Mitte (dem Schneebett) aus */
export const KESSEL = {
  /** Halbachsen des Kessels innen: quer zum Tor und vom Tor weg (etwa 44 × 38 Felder) */
  shape: { rx: 22, ry: 19 },
  /** so dick sind die Eisklippen ringsum (mindestens, der Rand innen ist leicht gewellt) */
  cliff: 5,
  /** so weit um das Bett bleibt der Boden eben und frei: Wiese, Iglu, Platz für Klangstein und Portal */
  flat: 11,
  /** so viele Felder Abstand hält der Kessel mindestens vom Felsring der Lichtung */
  gap: 2,
  /** Eisloch: rundes Wasserloch (Radius in Feldern) seitlich hinter dem Bett, ringsum ebenes Ufer */
  hole: { across: 13, out: 5, r: 1.6 },
  /**
   * Fischkisten [quer, vom Tor weg]: am Ende der Rutschspur nahe dem Tor, am Fuß der Klippe gegenüber und nahe dem
   * Eisloch; jede 8 bis 14 Felder von der Schneewiese, einzeln mit freiem Platz ringsum
   */
  crates: [
    [-4, -15],
    [0, 15],
    [17, 1],
  ],
  /** Moosfleck: grünes Moos und Flechten unter dem Schnee (nur Kulisse, begehbar) */
  moss: { across: -14, out: 3, r: 1.8 },
  /**
   * Mitte der Plattform des Eis-Portals [quer, vom Tor weg]: gleich hinter der Gangmündung neben der Rutschspur, auf
   * der anderen Seite als die Fischkiste am Tor. Ihr Gegenstück steht im Kreis um das Schneebett in Richtung des Tors.
   */
  portal: [5, -14],
} as const;

/**
 * Wohnorte der Eis-Tiere, relativ zum Schneebett: im Kreis (Radius 11) um die Schneewiese, gut verteilt. Die Welt sucht
 * das nächste erreichbare Feld im Kessel (wie der Kessel gedreht ist, würfelt der Seed mit dem Eistor).
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
