// Fundorte der Höhlen-Tiere in der Kristallgrotte – rein und deterministisch: Derselbe Seed ergibt dieselben Orte.
// Je Art sucht die Grotte das Feld mit ihrem Thema (`CAVE_ANIMALS`: Grottenboden, Leuchtpilze, Lehmhang, Steg, Geröllhang,
// Kristallbogen), das ihrem Platz in der Grotte am nächsten liegt; dort wohnt das erste Tier der Art (`findSpawns`).
// Teil des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Höhlen-Tiere“)

import { REGIONS, type Point, type Region } from '../../../../data/games/mitwachsen';
import { CAVE_ANIMALS, type CaveHaunt } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import type { Cell } from '../../mitwachsen-cell';
import { onClay } from './mitwachsen-lane';

/** Gehört ein Feld der Grotte zum Thema? Nur Felder, auf denen man stehen kann (das Tier wohnt auf dem Feld selbst) */
export const HAUNTS: Record<CaveHaunt, (c: Cell) => boolean> = {
  floor: (c) => c.ground === 'grotto' && (!c.deco || FLAT.has(c.deco)),
  shrooms: (c) => c.deco === 'glowshroom' && c.ground === 'grass',
  clay: (c) => c.deco === 'clay',
  jetty: (c) => c.ground === 'path',
  scree: (c) => c.ground === 'stone',
  arch: (c) => c.perch !== undefined,
};

/** Flache Fülle auf dem Grottenboden (Kristallfeld, Ader, Leuchtmoos, Ufersteine): zählt wie freier Boden, so bleiben die Fundorte */
const FLAT: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>(['crystalfield', 'vein', 'glowmoss', 'shore']);

const HOEHLE = REGIONS.find((r) => r.id === 'hoehle')!; // die Höhlenwelt steht fest in REGIONS

/**
 * Die Höhlenwelt mit den Fundorten ihrer Tiere relativ zum Höhlenbett (`bed`), wie `findSpawns` sie braucht: je Art das
 * Feld ihres Themas unter `cells`, das ihrem Platz in der Grotte (`toWorld(at)`) am nächsten liegt und auf dem man
 * stehen kann; gibt es keins, der Platz selbst. Der Lehmhang rückt mit der Schleife der Grubenbahn (`side` −1:
 * gespiegelt, `clayOf` in mitwachsen-lane.ts), der Platz des Dachses mit ihm
 */
export function caveHaunts(
  cells: readonly Point[],
  map: ReadonlyMap<string, Cell>,
  toWorld: (at: readonly [number, number]) => Point,
  bed: Point,
  side: 1 | -1 = 1,
  arch?: Point,
): Region {
  const animals = CAVE_ANIMALS.map(({ species, near, at }) => {
    // der Bogen steht auf der Bühne der Halle in Weltrichtung (`arch`), nicht im Raster der Grotte
    const [tx, ty] = near === 'arch' && arch ? arch : toWorld(near === 'clay' ? onClay(at, side) : at);
    let best: Point = [tx, ty],
      bestD = Infinity;
    for (const [x, y] of cells) {
      const c = map.get(`${x},${y}`);
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (c && d < bestD && c.region === 'hoehle' && !c.solid && HAUNTS[near](c)) [best, bestD] = [[x, y], d];
    }
    return { species, at: [best[0] - bed[0], best[1] - bed[1]] as Point };
  });
  return { ...HOEHLE, animals };
}
