// Bucht vor einem großen Tor – rein, ohne DOM, für jedes Tor gleich: die Felder vor der Tür, die Reihe der Torplatte und
// der Platz eines Boten neben ihr. Genutzt von den Welt-Paketen (beim Eistor wartet dort der verlaufene Pinguin,
// worlds/eis/mitwachsen-bay.ts, und der Schlitten hält daneben); nur von ihnen importiert, darum nicht im Kern.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“, Regel 8a)

import type { Point } from '../../data/games/mitwachsen';
import { PLATE_HALF, PLATE_ROW } from './mitwachsen-plate';
import type { GatePlace } from './mitwachsen-world';

type Door = Pick<GatePlace, 'cells' | 'mid' | 'out'>;

const BAY_DEPTH = 3; // die Bucht reicht so viele Reihen vor die Tür

/** Bucht vor der Tür eines Tors: so breit wie die Tür, `BAY_DEPTH` Reihen davor, die vorderste Reihe zuerst */
export function bay(g: Pick<GatePlace, 'cells' | 'out'>): Point[] {
  const out: Point[] = [];
  for (let t = 1; t <= BAY_DEPTH; t++) for (const [x, y] of g.cells) out.push([x - g.out[0] * t, y - g.out[1] * t]);
  return out;
}

/** Feld in der Reihe der Torplatte (`PLATE_ROW`), quer zum Tor bei u (u wächst nach [−out.y, out.x]; die Platte: −1 … 1) */
export const plateRow = (g: Pick<GatePlace, 'mid' | 'out'>, u: number): Point => [
  g.mid[0] - g.out[0] * PLATE_ROW - g.out[1] * u,
  g.mid[1] - g.out[1] * PLATE_ROW + g.out[0] * u,
];
/** Platz eines Boten neben der Torplatte (`plateRow(g, BESIDE)`): u = +2 */
export const BESIDE = PLATE_HALF + 1;
/** Liegt (x, y) in der Bucht vor der Tür? */
export const inBay = (g: Door, x: number, y: number) => bay(g).some(([a, b]) => a === x && b === y);
