// Zu Hause ankommen – rein, ohne DOM: wann folgende Tiere einziehen (die Figur ist nah an der Wiese ihrer Gegend),
// welcher Platz der Wiese ihrer wird und wie ein Tier, das noch draußen steht, selbst hinläuft. Teil der Regeln
// (mitwachsen-state.ts).
// Spezifikation: docs/specs/mitwachsen.md (Regel 7, Wiese ums Bett)

import { DIRS, type Dir } from '../../lib/games/front';
import { cycle } from '../../lib/games/rng';
import type { GateId, RegionId } from '../../data/games/mitwachsen';
import { atHome, meadowSpots, passages, type Home } from './mitwachsen-meadow';
import { occupied, type Crowd } from './mitwachsen-free';
import { canStep, type World } from './mitwachsen-world';

/** So nah (in Feldern, auch schräg) muss die Figur an die Wiese einer Gegend kommen, dann ziehen ihre Tiere ein */
export const NEAR_MEADOW = 2;
/** So weit sucht ein Tier, das draußen eingezogen ist, seinen Weg auf die Wiese (in Feldern) */
const WAY_HOME = 40;

type Walker = { x: number; y: number; dir: Dir; rest: number; mode: string; home: Home; realm: RegionId };

/** Gegend, deren Wiese höchstens `NEAR_MEADOW` Felder von (x, y) entfernt ist, sonst null */
export function nearMeadow(world: World, x: number, y: number): RegionId | null {
  for (let dy = -NEAR_MEADOW; dy <= NEAR_MEADOW; dy++)
    for (let dx = -NEAR_MEADOW; dx <= NEAR_MEADOW; dx++)
      if (world.cell(x + dx, y + dy).garden) return world.realm(x + dx, y + dy);
  return null;
}

/**
 * Zieht ein folgendes Tier ein? Ja, wenn die Figur nah an der Wiese seiner Gegend ist (dann alle zugleich, auch die
 * hinteren der Kette) oder wenn es selbst auf der Wiese seiner Gegend steht (etwa nach einem Platztausch).
 */
export function comesHome(world: World, a: Walker, player: { x: number; y: number }): boolean {
  if (world.cell(a.x, a.y).garden && world.realm(a.x, a.y) === a.realm) return true;
  return nearMeadow(world, player.x, player.y) === a.realm;
}

/** Ein Tier der Wiese, das noch draußen steht und auf dem Weg dorthin ist */
export const homeward = (world: World, a: Walker) => a.mode === 'home' && !atHome(world, a.home, a.x, a.y);

/**
 * Eigener Platz für ein eingezogenes Tier: ein Platz der Wiese, den noch kein anderes Tier der Wiese als Platz hat,
 * ab einer zufälligen Stelle der Liste (`r`, 0 … 1)
 */
export function ownSpot(
  world: World,
  animals: readonly { mode: string; spawn: readonly [number, number] }[],
  a: Walker & { spawn: readonly [number, number] },
  r: number,
) {
  const spots = meadowSpots(world, a.realm);
  const taken = new Set(animals.filter((o) => o.mode === 'home' && o !== a).map((o) => `${o.spawn[0]},${o.spawn[1]}`));
  const start = Math.floor(r * spots.length);
  for (let k = 0; k < spots.length; k++) {
    const spot = cycle(spots, start + k);
    if (taken.has(`${spot[0]},${spot[1]}`)) continue;
    a.spawn = spot;
    return;
  }
}

/**
 * Ein Tier der Wiese, das noch draußen steht, geht einen Schritt auf dem kürzesten Weg zu `goal`; ist das Feld gerade
 * besetzt, versucht es es gleich noch einmal. Liefert false, wenn das Tier nicht draußen ist oder keinen Weg findet.
 */
export function walkHome(s: Crowd, world: World, a: Walker, goal: readonly [number, number]): boolean {
  const way = homeward(world, a) ? wayHome(world, s.openGates, [a.x, a.y], goal) : null;
  if (!way) return false;
  const [tx, ty] = [a.x + DIRS[way][0], a.y + DIRS[way][1]];
  a.dir = way;
  if (occupied(s, tx, ty)) a.rest = 1;
  else [a.x, a.y] = [tx, ty];
  return true;
}

/**
 * Erster Schritt auf dem kürzesten Weg zu `goal`: Breitensuche über Felder, auf die man steigen kann, nicht über
 * Durchgänge (außer auf der Wiese). Andere Tiere zählen nicht, sie gehen ja weiter. Ohne Weg null.
 */
export function wayHome(
  world: World,
  open: readonly GateId[],
  from: readonly [number, number],
  goal: readonly [number, number],
): Dir | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const first = new Map<string, Dir | null>([[key(from[0], from[1]), null]]);
  const queue: [number, number][] = [[from[0], from[1]]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (x === goal[0] && y === goal[1]) return first.get(key(x, y)) ?? null;
    for (const d of ['n', 'e', 's', 'w'] as const) {
      const [tx, ty] = [x + DIRS[d][0], y + DIRS[d][1]];
      if (first.has(key(tx, ty)) || Math.max(Math.abs(tx - from[0]), Math.abs(ty - from[1])) > WAY_HOME) continue;
      if (!world.cell(tx, ty).garden && passages(world).has(key(tx, ty))) continue;
      if (!canStep(world, open, x, y, tx, ty)) continue;
      first.set(key(tx, ty), first.get(key(x, y)) ?? d);
      queue.push([tx, ty]);
    }
  }
  return null;
}
