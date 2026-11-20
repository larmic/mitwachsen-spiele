// Tiere der endlosen Landschaft – rein und deterministisch: je Stück immer dieselben an derselben Stelle, nie in der
// Eis-Welt und ihrem Land (dort wohnen nur Eis-Tiere). Die Regeln holen sie in die Nähe der Figur (mitwachsen-state.ts).
// Spezifikation: docs/specs/mitwachsen.md (Regel 12)

import { CHUNK } from '../../lib/games/chunks';
import { cycle, hash, rand01 } from '../../lib/games/rng';
import { WILD_SPECIES, type SpeciesId } from '../../data/games/mitwachsen';
import { standHeight, type World } from './mitwachsen-world';

export type WildSpawn = { id: string; species: SpeciesId; x: number; y: number };

/** Kann ein Tier bleiben, wo es steht, wenn sich die Welt ändert (Einbau eines Pakets)? Tiere der Landschaft nur dort */
export const canStay = (world: World, { home, x, y }: { home: { kind: string }; x: number; y: number }) =>
  home.kind !== 'wild' || (world.cell(x, y).region === 'wild' && standHeight(world, [], x, y) !== null);

/** Tiere eines Stücks der Landschaft – immer dieselben an derselben Stelle; Kennung aus Stück und Nummer */
export function wildAnimals(world: World, cx: number, cy: number): WildSpawn[] {
  const roll = rand01(world.seed, cx, cy, 3);
  const count = roll < 0.4 ? 1 : roll < 0.55 ? 2 : 0;
  const out: WildSpawn[] = [];
  for (let n = 0; n < count; n++) {
    for (let t = 0; t < 16; t++) {
      const h = hash(world.seed, cx, cy, n, t);
      const x = cx * CHUNK + (h % CHUNK),
        y = cy * CHUNK + ((h >>> 8) % CHUNK);
      const c = world.cell(x, y);
      // Nicht in der Eis-Welt und ihrem Land: Dort wohnen nur Eis-Tiere
      const taken = out.some((o) => o.x === x && o.y === y);
      if (c.region !== 'wild' || c.biome === 'eis' || standHeight(world, [], x, y) === null || taken) continue;
      out.push({ id: `wild:${cx}:${cy}:${n}`, species: cycle(WILD_SPECIES, h >>> 16), x, y });
      break;
    }
  }
  return out;
}
