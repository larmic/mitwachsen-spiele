// Tiere der Gegenden an neue Plätze verteilen – rein, ohne DOM: beim Öffnen einer Welt und an jedem neuen Morgen
// laufen die Tiere, die noch frei umherlaufen, woanders herum. Teil der Regeln (mitwachsen-state.ts).
// Spezifikation: docs/specs/mitwachsen.md

import { hash, nextRandom, pick } from '../../lib/games/rng';
import { speciesOf, type Point, type RegionId } from '../../data/games/mitwachsen';
import { occupied, type Crowd } from './mitwachsen-free';
import { atHome, type Home } from './mitwachsen-meadow';
import type { Mode } from './mitwachsen-border';
import type { World } from './mitwachsen-world';

/** Was das Verteilen vom Zustand braucht (Teil des Zustands der Regeln) */
type Wild = {
  id: string;
  x: number;
  y: number;
  mode: Mode;
  home: Home;
  realm: RegionId;
  spawn: readonly [number, number];
};
type Scattered = Crowd & { animals: Wild[] };

const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/**
 * Wechselnde Plätze je Gegend: so weit mindestens vom Bett und voneinander (das Gletschertal ist so weit wie die
 * Lichtung). `haunt`: Das erste Tier jeder Art bleibt so nah (in Feldern, nach Chebyshev) an seinem Wohnort
 * (`World.spawns`, im Gletschertal sein Lieblingsort), auch nah am Bett (der Pinguin am Iglu); fehlt es, wandert auch
 * das erste Tier durch die ganze Gegend (Lichtung wie bisher).
 */
export const SCATTER: Record<RegionId, { bed: number; apart: number; haunt?: number }> = {
  lichtung: { bed: 8, apart: 5 },
  eis: { bed: 8, apart: 5, haunt: 4 },
  hoehle: { bed: 8, apart: 5 },
};

/** Erreichbare Felder je Welt und Gegend als Menge, einmal gebaut (das Tal hat über 10.000) */
const spotSets = new WeakMap<World, Map<RegionId, Set<string>>>();
function spotSet(world: World, realm: RegionId): Set<string> {
  const sets = spotSets.get(world) ?? new Map<RegionId, Set<string>>();
  spotSets.set(world, sets);
  const set = sets.get(realm) ?? new Set(world.spotsOf(realm).map(([x, y]) => `${x},${y}`));
  sets.set(realm, set);
  return set;
}

/** Das erste Tier seiner Art (Kennung ohne Nummer, `animalId`)? */
const isFirst = (id: string) => speciesOf(id) !== null && id.split(':').length === 2;

/**
 * Tiere der Gegenden, die frei umherlaufen, an neue Plätze verteilen (beim Öffnen und an jedem neuen Morgen):
 * zufällige erreichbare Felder ihrer Gegend, mit Abstand zu deren Bett und zueinander (`SCATTER`); das erste Tier
 * jeder Art bleibt, wo die Gegend es will (`haunt`), nah an seinem Lieblingsort. Gleicher Zustand, gleiche Plätze.
 */
export function scatter(s: Scattered, world: World, random: () => number) {
  const placed: Point[] = []; // die Gegenden liegen weit auseinander: eine Liste für alle genügt
  const free = (a: Wild, [x, y]: Point) =>
    atHome(world, a.home, x, y) && // nicht an Toren
    !placed.some(([px, py]) => cheb(x, y, px, py) < SCATTER[a.realm].apart) &&
    !occupied(s, x, y, a.id);
  const put = (a: Wild, at: Point) => {
    [a.x, a.y] = at;
    a.spawn = at;
    placed.push(at);
  };
  const wild: Wild[] = [];
  for (const a of s.animals) if (a.mode === 'wander' && a.home.kind === 'region') wild.push(a);
  const done = new Set<string>();
  // Zuerst die ersten Tiere jeder Art an ihren Lieblingsorten (die anderen nehmen ihnen den Platz nicht weg)
  for (const a of wild) {
    const radius = SCATTER[a.realm].haunt;
    const home = isFirst(a.id) ? world.spawns.get(a.id) : undefined;
    if (radius === undefined || !home) continue;
    const spots = spotSet(world, a.realm);
    const near: Point[] = [];
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        if (spots.has(`${home[0] + dx},${home[1] + dy}`)) near.push([home[0] + dx, home[1] + dy]);
    for (let tries = 0; tries < 40 && near.length; tries++) {
      const at = pick(near, random());
      if (!free(a, at)) continue;
      put(a, at);
      done.add(a.id);
      break;
    }
  }
  for (const a of wild) {
    if (done.has(a.id)) continue;
    const spots = world.spotsOf(a.realm);
    const [bx, by] = world.homes[a.realm].bed;
    if (!spots.length) continue;
    for (let tries = 0; tries < 80; tries++) {
      const at = pick(spots, random());
      if (cheb(at[0], at[1], bx, by) < SCATTER[a.realm].bed || !free(a, at)) continue;
      put(a, at);
      break;
    }
  }
}

const ARRIVE_SALT = 0xa77ac4; // eigener Zufall für Tiere, die mit einem Welt-Paket einziehen

/**
 * Tiere, die mit einem Welt-Paket mitten im Spiel einziehen (`attachPack`), verteilen wie beim Öffnen; mit eigenem
 * Zufall aus Seed und Tag, so bleibt der Zufall des Spielstands unberührt. Gleiche Welt, gleicher Tag: gleiche Plätze.
 */
export function scatterArrivals<T extends Wild>(s: Crowd, animals: T[], world: World, day: number) {
  let r = hash(world.seed, day, ARRIVE_SALT);
  const random = () => {
    const [v, next] = nextRandom(r);
    r = next;
    return v;
  };
  scatter({ ...s, animals }, world, random);
  return animals;
}
