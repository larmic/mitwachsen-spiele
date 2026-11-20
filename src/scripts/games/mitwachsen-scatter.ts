// Tiere der Gegenden an neue Plätze verteilen – rein, ohne DOM: beim Öffnen einer Welt und an jedem neuen Morgen
// laufen die Tiere, die noch frei umherlaufen, woanders herum. Teil der Regeln (mitwachsen-state.ts).
// Spezifikation: docs/specs/mitwachsen.md

import { hash, nextRandom, pick } from '../../lib/games/rng';
import type { RegionId } from '../../data/games/mitwachsen';
import { occupied, type Crowd } from './mitwachsen-free';
import { atHome, type Home } from './mitwachsen-meadow';
import type { Mode } from './mitwachsen-border';
import type { World } from './mitwachsen-world';

/** Was das Verteilen vom Zustand braucht (Teil des Zustands der Regeln) */
type Scattered = Crowd & {
  animals: {
    id: string;
    x: number;
    y: number;
    mode: Mode;
    home: Home;
    realm: RegionId;
    spawn: readonly [number, number];
  }[];
};

const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Wechselnde Plätze je Gegend: so weit mindestens vom Bett und voneinander (der Gletscherkessel ist klein) */
export const SCATTER: Record<RegionId, { bed: number; apart: number }> = {
  lichtung: { bed: 8, apart: 5 },
  eis: { bed: 6, apart: 4 },
};

/**
 * Tiere der Gegenden, die frei umherlaufen, an neue Plätze verteilen (beim Öffnen und an jedem neuen Morgen):
 * zufällige erreichbare Felder ihrer Gegend, mit Abstand zu deren Bett und zueinander (`SCATTER`). Gleicher Zustand,
 * gleiche Plätze.
 */
export function scatter(s: Scattered, world: World, random: () => number) {
  const placed: [number, number][] = []; // die Gegenden liegen weit auseinander: eine Liste für alle genügt
  for (const a of s.animals) {
    if (a.mode !== 'wander' || a.home.kind !== 'region') continue;
    const spots = world.spotsOf(a.realm);
    const [bx, by] = world.homes[a.realm].bed;
    const { bed, apart } = SCATTER[a.realm];
    if (!spots.length) continue;
    for (let tries = 0; tries < 80; tries++) {
      const [x, y] = pick(spots, random());
      if (cheb(x, y, bx, by) < bed || !atHome(world, a.home, x, y)) continue; // nicht an Toren
      if (placed.some(([px, py]) => cheb(x, y, px, py) < apart) || occupied(s, x, y, a.id)) continue;
      [a.x, a.y] = [x, y];
      a.spawn = [x, y];
      placed.push([x, y]);
      break;
    }
  }
}

const ARRIVE_SALT = 0xa77ac4; // eigener Zufall für Tiere, die mit einem Welt-Paket einziehen

/**
 * Tiere, die mit einem Welt-Paket mitten im Spiel einziehen (`attachPack`), verteilen wie beim Öffnen; mit eigenem
 * Zufall aus Seed und Tag, so bleibt der Zufall des Spielstands unberührt. Gleiche Welt, gleicher Tag: gleiche Plätze.
 */
export function scatterArrivals<T extends Scattered['animals'][number]>(
  s: Crowd,
  animals: T[],
  world: World,
  day: number,
) {
  let r = hash(world.seed, day, ARRIVE_SALT);
  const random = () => {
    const [v, next] = nextRandom(r);
    r = next;
    return v;
  };
  scatter({ ...s, animals }, world, random);
  return animals;
}
