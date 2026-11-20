// Nur für Tests: alle Welt-Pakete und Welten mit ihnen, je Seed einmal gebaut (eine Welt ändert sich nie, die Tests
// teilen sie sich, so steigt die Laufzeit nicht). Das Spiel lädt die Pakete per import() (larmic-mitwachsen.ts).

import { pack as eis } from './worlds/eis';
import { createWorld, type World } from './mitwachsen-world';

export const PACKS = [eis] as const;
export const EIS_PACK = eis;

const worlds = new Map<number, World>();
/** Die Welt eines Seeds mit allen Paketen, wie im Spiel */
export function worldOf(seed: number): World {
  let w = worlds.get(seed);
  if (!w) worlds.set(seed, (w = createWorld(seed, PACKS)));
  return w;
}
