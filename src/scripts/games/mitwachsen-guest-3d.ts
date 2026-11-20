// Der verlaufene Pinguin am Tor in der 3D-Ansicht: die golden markierte Bucht vor der Tür, solange er die Figur dorthin
// führt (den Umriss auf der Tür baut mitwachsen-gatehouse.ts mit den Türflügeln). Gehört zur 3D-Ansicht und wird nur
// mit ihr nachgeladen.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“)

import { GOLD } from '../../data/games/mitwachsen-portals';
import { W, block, type Parts } from './mitwachsen-gatehouse';

/**
 * Goldene Bucht vor dem Tor, solange der verlaufene Pinguin die Figur dorthin führt: ein schmaler Goldrand um die drei
 * Reihen vor der Tür, so breit wie das Tor, vorn vor dem Sockel der Türme. Er liegt je Feld knapp über dessen Boden:
 * `rise(u, t)` ist die Höhe des Felds u (−2 … 2 entlang des Tors) in Reihe t (1 … 3) gegenüber der Tormitte. Felder
 * gleicher Höhe teilen sich ein Stück Rand, an einer Stufe setzt er ab.
 */
export function goldenBay(p: Parts, rise: (u: number, t: number) => number = () => 0) {
  const [w, depth] = [0.12, 3];
  const strip = (x0: number, x1: number, z0: number, z1: number, y: number) =>
    block(p.bright, x0, y + 0.02, z0, x1, y + 0.07, z1, GOLD.side, GOLD.top);
  /** Felder `from` … `to` als Stücke gleicher Höhe: [erstes, letztes, Höhe] */
  const runs = (from: number, to: number, h: (i: number) => number) => {
    const out: [number, number, number][] = [];
    for (let i = from; i <= to; i++) {
      const last = out[out.length - 1];
      if (last && last[2] === h(i)) last[1] = i;
      else out.push([i, i, h(i)]);
    }
    return out;
  };
  const front = (t: number) => (t === 1 ? 0.85 : t - 0.5); // vordere Kante der Reihe t
  for (const [a, b, y] of runs(-2, 2, (u) => rise(u, 1))) strip(a - 0.5, b + 0.5, 0.85, 0.85 + w, y);
  for (const [a, b, y] of runs(-2, 2, (u) => rise(u, depth))) strip(a - 0.5, b + 0.5, depth + 0.5 - w, depth + 0.5, y);
  for (const [u, x0] of [
    [-2, -W],
    [2, W - w],
  ] as const)
    for (const [a, b, y] of runs(1, depth, (t) => rise(u, t)))
      strip(x0, x0 + w, a === 1 ? front(1) + w : front(a), b === depth ? depth + 0.5 - w : b + 0.5, y);
}
