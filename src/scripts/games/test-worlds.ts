// Nur für Tests: alle Welt-Pakete und Welten mit ihnen, je Seed einmal gebaut (eine Welt ändert sich nie, die Tests
// teilen sie sich, so steigt die Laufzeit nicht). Das Spiel lädt die Pakete per import() (larmic-mitwachsen.ts).
// Achtung, Seiteneffekt beim Import: Er trägt die Modelle der Eis-Tiere in `SPECIES` ein (`addModels`, wie im Spiel beim
// Ankommen des Pakets). Ein Test, der Eis-Tiere zeichnet oder vermisst, importiert diesen Helfer, sonst sind ihre
// Modelle leer (geprüft in mitwachsen-packs.test.ts).

import { pack as eis } from './worlds/eis';
import { createWorld, type World } from './mitwachsen-world';
import { addModels } from './mitwachsen-packs';

addModels(eis.models); // wie im Spiel, wenn das Paket ankommt: Modelle der Eis-Tiere
export const PACKS = [eis] as const;
export const EIS_PACK = eis;

const worlds = new Map<number, World>();
/** Die Welt eines Seeds mit allen Paketen, wie im Spiel */
export function worldOf(seed: number): World {
  let w = worlds.get(seed);
  if (!w) worlds.set(seed, (w = createWorld(seed, PACKS)));
  return w;
}

const bare = new Map<number, World>();
/**
 * Die Welt eines Seeds ohne Pakete, wie im Spiel, solange kein Paket geladen ist; je Seed einmal gebaut. Nur für Tests,
 * die sie lesen (auch `attach` lässt sie, wie sie ist); wer sie für einen Vergleich frisch braucht, baut selbst
 */
export function bareOf(seed: number): World {
  let w = bare.get(seed);
  if (!w) bare.set(seed, (w = createWorld(seed, [])));
  return w;
}
