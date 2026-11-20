// Platz vor einem Zugang – rein, ohne DOM: die freie Bucht vor der Torreihe und darin das Vorfeld. Im Vorfeld fächert
// sich der Boden seiner Welt von der Torreihe in die Lichtung, nach vorn schmaler, mit ausgefranstem Rand. Von oben
// sieht man es in jeder Lage im Felsring, auch wenn die Kamera den Zugang von der Seite sieht. Nur Boden: Höhen, Deko
// und Regeln bleiben (nur Blumen und Grasbüschel weichen). Teil des Weltbaus (mitwachsen-world.ts).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore)

import { rand01 } from '../../lib/games/rng';
import type { GateId, Point } from '../../data/games/mitwachsen';
import type { Cell, Ground } from './mitwachsen-cell';

/** Vorfeld je Welt: Boden in ihrem Material vor dem Zugang (der Wald legt einen schmalen Waldweg) */
export const APRON: Record<GateId, Ground> = {
  eis: 'snow',
  sand: 'sand',
  wasser: 'sand',
  lava: 'basalt',
  hoehle: 'cave',
  wald: 'path',
  wolken: 'cloud',
  pilze: 'moss',
};
const APRON_ROWS = 6; // so viele Reihen reicht das Vorfeld in die Lichtung
/** So viele Reihen des Gangs hinter der Torreihe gehören zum Zugang (Steg, Platten, Bach …): ohne Blumen und Büschel */
export const GATE_FLOOR = 4;

type Place = { id: GateId; at: (u: number, t: number) => Point; depth: number };

/**
 * Bucht vor dem Zugang `p` frei machen (Gras der Lichtung, quer zum Tor von u0 bis u1, nach vorn bis dorthin, wo
 * schon Lichtung ist) und das Vorfeld darauf legen
 */
export function forecourt(seed: number, map: Map<string, Cell>, p: Place, [u0, u1]: readonly [number, number]) {
  for (let u = u0; u <= u1; u++)
    for (let t = p.depth - 1; t >= p.depth - 60; t--) {
      const [x, y] = p.at(u, t);
      if (map.get(`${x},${y}`)?.region === 'lichtung' && t < p.depth - 2) break; // weiter innen ist schon Lichtung
      map.set(`${x},${y}`, { h: 1, ground: 'grass', deco: null, region: 'lichtung', solid: false });
    }
  apron(seed, map, p.id, p.at, p.depth);
}

/** Vorfeld des Zugangs `id` in `map` legen: `at(u, t)` Feld quer zum Tor (u) und nach außen (t), Torreihe bei `depth` */
function apron(seed: number, map: Map<string, Cell>, id: GateId, at: (u: number, t: number) => Point, depth: number) {
  const [half, shrink] = id === 'wald' ? [1.6, 0.15] : [4, 0.55]; // halbe Breite an der Torreihe, Abnahme je Reihe
  for (let r = 0; r < APRON_ROWS; r++)
    for (let u = -6; u <= 6; u++) {
      const [x, y] = at(u, depth - 1 - r);
      const c = map.get(`${x},${y}`);
      if (!c || c.region !== 'lichtung' || c.ground === 'water' || c.solid) continue;
      if (Math.abs(u) > half - r * shrink + (rand01(seed, x, y, 61) - 0.5) * 1.4) continue;
      map.set(`${x},${y}`, { ...c, ground: APRON[id], tufts: undefined, deco: c.deco === 'flower' ? null : c.deco });
    }
}
