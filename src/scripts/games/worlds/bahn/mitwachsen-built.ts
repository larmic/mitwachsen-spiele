// Ausbau des Gleises im Spielstand der Pakete (`packs.bahn.built`) – rein: 0 nichts, 1 die Lichtung bis zum Prellbock vor
// dem Höhlentor, 2 die ganze Linie bis zum Bahnhof Fledermaus. Danach legt das Paket das Gleis (mitwachsen-line.ts: erst
// ab 1, vorher bleibt die Lichtung, wie sie ist) und zeichnet es (mitwachsen-rail-look.ts). Teil des Pakets der Bahn.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden)

/** Ausbau des Gleises im Spielstand der Pakete (`packs.bahn.built`): 0 bis 2, fehlt er, 0 */
export function builtOf(packs: Readonly<Record<string, unknown>>): 0 | 1 | 2 {
  const b = (packs.bahn as { built?: unknown } | undefined)?.built;
  return b === 1 || b === 2 ? b : 0;
}
