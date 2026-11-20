// Was hinter dem Gang eines Tors liegt – rein und deterministisch: die Welt aus ihrem Paket (worlds/<welt>/) oder,
// wenn das Paket fehlt (Laden gescheitert), eine Eisklippe am Ende des Gangs. Teil von mitwachsen-world.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { Point } from '../../data/games/mitwachsen';
import type { StoryId } from '../../data/games/mitwachsen-stories';
import type { Cell } from './mitwachsen-cell';
import type { Beyond, Gang, Kessel, WorldPack } from './mitwachsen-pack';
import type { Portal, PortalId } from './mitwachsen-portal';

/** Was hinter dem Tor liegt: die Welt aus dem Paket mit Portal und Klangstein, ohne Paket nur eine Klippe (ohne beide) */
export type Behind = Omit<Kessel, 'stone' | 'portal'> & {
  portals: [PortalId, Portal][];
  stones: [StoryId, Point][];
};

const CLOSED = [3, 4, 5]; // Eisklippe am Ende des Gangs ohne Welt-Paket: Reihe für Reihe höher, wie die Kesselklippen

/**
 * Die Welt hinter dem Gang in die Karte bauen (`map`, dort liegt schon der Gang). Ohne Paket steht hinter dem Gang eine
 * Eisklippe, die Welt hat keine Felder, keine Wohnorte und kein Portal; ihr Bett liegt in der Klippe, nur damit jede
 * Gegend ein Zuhause hat.
 */
export function behind(
  pack: WorldPack | undefined,
  seed: number,
  gang: Gang,
  beyond: Beyond,
  passage: (x: number, y: number) => Cell,
  map: Map<string, Cell>,
): Behind {
  if (pack) {
    const { stone, portal, ...rest } = pack.build(seed, gang, beyond, passage, map);
    return { ...rest, portals: [portal], stones: [['eis-offen', stone]] }; // Klangstein mit der Eis-Geschichte
  }
  const span = gang.half + gang.wall;
  CLOSED.forEach((h, i) => {
    for (let u = -span; u <= span; u++) {
      const [x, y] = gang.at(u, gang.end + 1 + i);
      map.set(`${x},${y}`, { h, ground: 'ice', deco: 'rock', region: 'border', solid: true, biome: 'eis' });
    }
  });
  const bed = gang.at(0, gang.end + CLOSED.length);
  return { bed, realm: new Set(), spots: [], spawns: new Map(), portals: [], stones: [] };
}
