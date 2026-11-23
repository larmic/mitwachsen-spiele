// Fundorte der Höhlen-Tiere in der Kristallgrotte – rein und deterministisch: Derselbe Seed ergibt dieselben Orte.
// Je Art sucht die Grotte das Feld mit ihrem Thema (`CAVE_ANIMALS`: Grottenboden, Leuchtpilze, Moos, Steg, Geröllhang,
// Kristallbogen), das ihrem Platz in der Grotte am nächsten liegt; dort wohnt das erste Tier der Art (`findSpawns`).
// Teil des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Höhlen-Tiere“)

import { REGIONS, type Point, type Region } from '../../../../data/games/mitwachsen';
import { CAVE_ANIMALS, type CaveHaunt } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import type { Cell } from '../../mitwachsen-cell';

/** Gehört ein Feld der Grotte zum Thema? Nur Felder, auf denen man stehen kann (das Tier wohnt auf dem Feld selbst) */
export const HAUNTS: Record<CaveHaunt, (c: Cell) => boolean> = {
  floor: (c) => c.ground === 'grotto' && !c.deco,
  shrooms: (c) => c.deco === 'glowshroom' && c.ground === 'grass',
  moss: (c) => c.ground === 'grass' && !c.deco && !c.garden,
  jetty: (c) => c.ground === 'path',
  scree: (c) => c.ground === 'stone',
  arch: (c) => c.perch !== undefined,
};

const HOEHLE = REGIONS.find((r) => r.id === 'hoehle')!; // die Höhlenwelt steht fest in REGIONS

/**
 * Die Höhlenwelt mit den Fundorten ihrer Tiere relativ zum Höhlenbett (`bed`), wie `findSpawns` sie braucht: je Art das
 * Feld ihres Themas unter `cells`, das ihrem Platz in der Grotte (`toWorld(at)`) am nächsten liegt und auf dem man
 * stehen kann; gibt es keins, der Platz selbst.
 */
export function caveHaunts(
  cells: readonly Point[],
  map: ReadonlyMap<string, Cell>,
  toWorld: (at: readonly [number, number]) => Point,
  bed: Point,
): Region {
  const animals = CAVE_ANIMALS.map(({ species, near, at }) => {
    const [tx, ty] = toWorld(at);
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
