// Eis-Welt von Mitwachsen: Maße des Gletscherkessels hinter dem Eistor, Lage des Eislochs und Farben der Eis-Dinge.
// Die Gegend selbst steht in `REGIONS` (Gegend 'eis'), ihr Zuhause (Bett, Wiese, Tröge, Iglu) in `HOMES.eis`.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

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
} as const;

/** Farben im Kessel (Spielgrafik): Seite und Oberseite */
export const ICE_COLORS = {
  snow: ['#d5e4f0', '#f6f9fc'],
  block: ['#e8f0f7', '#ffffff'], // hellere Schneeblöcke des Iglus (im Wechsel mit `snow`)
  ice: ['#9fd6ef', '#d4f1ff'],
  cliff: ['#9fd6ef', '#f4f8fb'], // Eisklippen: Eis an der Seite, Schnee obenauf
  bowl: ['#8fc6e9', '#cdeaf8'], // Futterschale aus Eis
  bowlIn: '#6fb3df',
  slide: ['#bfe6f5', '#e8f8ff'], // glänzende Rutschspur
} as const;
