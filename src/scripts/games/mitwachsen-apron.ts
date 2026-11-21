// Platz vor einem Zugang – rein, ohne DOM: die freie Bucht vor der Torreihe und darin das Vorfeld. Im Vorfeld fächert
// sich der Boden seiner Welt von der Torreihe in die Lichtung, nach vorn schmaler, mit ausgefranstem Rand. Von oben
// sieht man es in jeder Lage im Felsring, auch wenn die Kamera den Zugang von der Seite sieht. Nur Boden: Höhen, Deko
// und Regeln bleiben (nur Blumen und Grasbüschel weichen). Mitten in der Bucht liegt die Torplatte (mitwachsen-plate.ts).
// Teil des Weltbaus (mitwachsen-world.ts).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore)

import { rand01 } from '../../lib/games/rng';
import type { GateId, Point } from '../../data/games/mitwachsen';
import type { Cell, Ground } from './mitwachsen-cell';
import { PLATE_HALF, PLATE_ROW } from './mitwachsen-plate';

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
/** So viele Reihen des Gangs hinter der Torreihe gehören zum Zugang (Becken, Stufen, Platten …): ohne Blumen und Büschel */
export const GATE_FLOOR = 4;

type Place = { id: GateId; at: (u: number, t: number) => Point; depth: number };

/**
 * Bucht vor dem Zugang `p` frei machen (Gras der Lichtung, quer zum Tor von u0 bis u1, nach vorn bis dorthin, wo
 * schon Lichtung ist; vor der Platte auch Reihe 3, wo sie höher, versperrt oder Wasser ist: So verdeckt nichts davor
 * die Platte und man kommt geradeaus hin, Blumen dort bleiben), das Vorfeld darauf legen und die Torplatte hinein: Reihe `PLATE_ROW` vor der Tür, quer von −`PLATE_HALF`
 * bis `PLATE_HALF`, alle Felder auf Höhe 1, begehbar, ohne Deko und Büschel
 */
export function forecourt(seed: number, map: Map<string, Cell>, p: Place, [u0, u1]: readonly [number, number]) {
  for (let u = u0; u <= u1; u++)
    for (let t = p.depth - 1; t >= p.depth - 60; t--) {
      const [x, y] = p.at(u, t);
      const c = map.get(`${x},${y}`);
      // weiter innen ist schon Lichtung; vor der Platte (Reihe 3) nur, wenn man dort eben und frei auf sie zugeht
      // (Wasser der Lichtung liegt auf Höhe 0)
      const flat = c?.h === 1 && !c.solid;
      if (
        c?.region === 'lichtung' &&
        t < p.depth - 2 &&
        (flat || Math.abs(u) > PLATE_HALF || t < p.depth - (PLATE_ROW + 1))
      )
        break;
      map.set(`${x},${y}`, { h: 1, ground: 'grass', deco: null, region: 'lichtung', solid: false });
    }
  apron(seed, map, p.id, p.at, p.depth);
  for (let u = -PLATE_HALF; u <= PLATE_HALF; u++) {
    const [x, y] = p.at(u, p.depth - PLATE_ROW);
    const c = map.get(`${x},${y}`)!; // eben gesetzt: Die Bucht reicht immer bis Reihe 2
    map.set(`${x},${y}`, { ...c, h: 1, deco: null, solid: false, tufts: 0, plate: p.id });
  }
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
