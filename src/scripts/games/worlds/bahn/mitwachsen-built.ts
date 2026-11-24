// Ausbau des Gleises im Spielstand der Pakete (`packs.bahn.built`, steigt nur: `withBuilt`) – rein: 0 nichts, 1 die
// Lichtung bis zum Prellbock vor dem Höhlentor (Bau 1, mitwachsen-build.ts), 2 die ganze Linie bis zum Bahnhof
// Fledermaus. Danach legt das Paket das Gleis (mitwachsen-line.ts: erst ab 1, vorher bleibt die Lichtung, wie sie ist)
// und zeichnet es (mitwachsen-rail-look.ts). Teil des Pakets der Bahn.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden)

/** Ausbau des Gleises im Spielstand der Pakete (`packs.bahn.built`): 0 bis 2, fehlt er, 0 */
export function builtOf(packs: Readonly<Record<string, unknown>>): 0 | 1 | 2 {
  const b = (packs.bahn as { built?: unknown } | undefined)?.built;
  return b === 1 || b === 2 ? b : 0;
}

/**
 * Neuer Zustand der Pakete mit dem Ausbau `built`: Der Ausbau steigt nur (ein kleinerer Wert ändert nichts); alles
 * andere im Eintrag der Bahn und die anderen Pakete bleiben
 */
export function withBuilt(packs: Readonly<Record<string, unknown>>, built: 1 | 2): Record<string, unknown> {
  const own = typeof packs.bahn === 'object' && packs.bahn !== null && !Array.isArray(packs.bahn) ? packs.bahn : {};
  return { ...packs, bahn: { ...own, built: Math.max(builtOf(packs), built) } };
}
