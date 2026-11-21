// Lieblingsorte der Eis-Tiere im Gletschertal – rein und deterministisch: Derselbe Seed ergibt dieselben Orte.
// Je Art sucht das Tal das Feld mit ihrem Thema (`ICE_ANIMALS`: See, Tannen, Eisblöcke, Eisfall, Iglu), das ihrem
// Platz im Tal am nächsten liegt; dort wohnt das erste Tier der Art (`findSpawns`). Teil des Welt-Pakets der Eis-Welt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Gletscherkessel“)

import { REGIONS, type Point, type Region } from '../../../../data/games/mitwachsen';
import { ICE_ANIMALS, KESSEL_COLORS, type IceHaunt } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell } from '../../mitwachsen-cell';

/**
 * Gehört ein Feld zum Thema? Seen: das offene Wasser ihrer Eislöcher (nur die drei Seen haben eins; glattes Eis liegt
 * auch auf kleinen Tümpeln und im Becken des Eisfalls); Eisblöcke: Eis eine Stufe höher (nicht die gefärbten Stufen des
 * Eisbergs)
 */
export const HAUNTS: Record<IceHaunt, (c: Cell) => boolean> = {
  lake: (c) => c.region === 'eis' && c.ground === 'water',
  pines: (c) => c.tree === 'snowpine',
  blocks: (c) => c.region === 'eis' && !c.solid && c.ground === 'ice' && c.h >= 2 && !c.color,
  fall: (c) => c.color === KESSEL_COLORS.fall,
  igloo: (c) => c.deco === 'igloo',
};

const EIS = REGIONS.find((r) => r.id === 'eis')!; // die Eis-Welt steht fest in REGIONS

/**
 * Die Eis-Welt mit den Lieblingsorten ihrer Tiere relativ zum Schneebett (`bed`), wie `findSpawns` sie braucht: je Art das
 * Feld ihres Themas unter `cells`, das ihrem Platz im Tal (`toWorld(at)`) am nächsten liegt; gibt es keins, der Platz
 * selbst.
 */
export function haunts(
  cells: readonly Point[],
  map: ReadonlyMap<string, Cell>,
  toWorld: (at: readonly [number, number]) => Point,
  bed: Point,
): Region {
  const animals = ICE_ANIMALS.map(({ species, near, at }) => {
    const [tx, ty] = toWorld(at);
    let best: Point = [tx, ty],
      bestD = Infinity;
    for (const [x, y] of cells) {
      const c = map.get(`${x},${y}`);
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (c && d < bestD && HAUNTS[near](c)) [best, bestD] = [[x, y], d];
    }
    return { species, at: [best[0] - bed[0], best[1] - bed[1]] as Point };
  });
  return { ...EIS, animals };
}
