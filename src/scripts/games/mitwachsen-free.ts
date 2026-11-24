// Freie Felder für die Regeln – rein, ohne DOM: ob ein Feld besetzt ist, das nächste freie Feld und wohin ein Wesen
// schaut. Gemeinsam für die Spielregeln (mitwachsen-state.ts) und die Weltgrenze am Tor (mitwachsen-border.ts).
// Spezifikation: docs/specs/mitwachsen.md

import { DIRS, type Dir } from '../../lib/games/front';
import type { GateId } from '../../data/games/mitwachsen';
import { standHeight, type World } from './mitwachsen-world';

/** Was die Regeln über Figur, Tiere und offene Tore wissen müssen, um freie Felder zu finden (Teil des Zustands) */
export type Crowd = {
  sleeping: boolean;
  player: { x: number; y: number };
  animals: readonly { id: string; x: number; y: number }[];
  openGates: readonly GateId[];
};

/** Richtung, in die man von einem Feld aus auf (dx, dy) schaut */
export const dirTo = (dx: number, dy: number): Dir =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';

/** Steht auf (x, y) die wache Figur oder ein Tier (außer `except`)? */
export const occupied = (s: Crowd, x: number, y: number, except?: string) =>
  (!s.sleeping && s.player.x === x && s.player.y === y) ||
  s.animals.some((a) => a.id !== except && a.x === x && a.y === y);

/** Nächstes freies Feld (Breitensuche), auf dem man stehen kann und das `ok` erfüllt */
export function freeNear(
  s: Crowd,
  world: World,
  from: readonly [number, number],
  ok: (x: number, y: number) => boolean,
  except?: string,
): [number, number] | null {
  const seen = new Set<string>();
  const queue: [number, number][] = [[from[0], from[1]]];
  while (queue.length && seen.size < 600) {
    const [x, y] = queue.shift()!;
    const k = `${x},${y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (ok(x, y) && standHeight(world, s.openGates, x, y) !== null && !occupied(s, x, y, except)) return [x, y];
    for (const [dx, dy] of Object.values(DIRS)) queue.push([x + dx, y + dy]);
  }
  return null;
}

type Placed = { id: string; x: number; y: number; spawn: readonly [number, number] };

/**
 * Nach einem Neubau der Welt im Spiel (`World.relay`, etwa Bau 1 der Bahn: Häuschen und Tunnelportal sind fest): Wer auf
 * einem Feld steht, auf dem man nicht mehr stehen kann, kommt auf das nächste freie Feld derselben Gegend; ein Wohnort
 * dort wird zu dem, den die neue Welt kennt (`World.spawns`), sonst zum neuen Feld. Die Figur genauso. Gibt `s` selbst
 * zurück, wenn niemand im Weg stand
 */
export function unstick<A extends Placed, S extends Omit<Crowd, 'animals'> & { animals: readonly A[] }>(
  s: S,
  world: World,
): S {
  const stands = (x: number, y: number) => standHeight(world, s.openGates, x, y) !== null;
  const inRealm = (x: number, y: number) => (u: number, v: number) => world.realm(u, v) === world.realm(x, y);
  let next = s;
  const { x: px, y: py } = s.player;
  if (!stands(px, py)) {
    const to = freeNear({ ...s, sleeping: true }, world, [px, py], inRealm(px, py));
    if (to) next = { ...next, player: { ...next.player, x: to[0], y: to[1] } };
  }
  const animals = next.animals.map((a): A => {
    let b = a;
    if (!stands(a.x, a.y)) {
      const to = freeNear(next, world, [a.x, a.y], inRealm(a.x, a.y), a.id);
      if (to) b = { ...b, x: to[0], y: to[1] };
    }
    if (!stands(...b.spawn)) b = { ...b, spawn: world.spawns.get(b.id) ?? [b.x, b.y] };
    return b;
  });
  return animals.some((a, i) => a !== next.animals[i]) ? { ...next, animals } : next;
}
