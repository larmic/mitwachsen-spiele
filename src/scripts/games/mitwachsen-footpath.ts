// Fußwege über die feste Karte – rein, im Kern: der kürzeste Weg zu Fuß von einem Start zu einem Ziel, nah am Strahl
// dazwischen. Die Bahn sucht damit den Fußweg vom Bett zur Torplatte, den ihr Gleis frei lässt
// (worlds/bahn/mitwachsen-line.ts); die Weltpfade der Lichtung (Issue 59) nutzen dieselbe Suche. Pakete importieren
// einander nicht, darum liegt sie hier.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden; „Weltpfade“)

import { fromKey } from '../../lib/games/chunks';
import { Heap } from '../../lib/games/heap';
import type { Point } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';

const key = (x: number, y: number) => `${x},${y}`;
const STEPS: readonly Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Kann man auf dem Feld stehen (Boden, kein Wasser, nichts Festes, kein Tor)? */
export const standable = (c: Cell | undefined): c is Cell => !!c && !c.solid && c.ground !== 'water' && !c.gate;

const SHIFT = 2 ** 20; // Kosten und Nummer eines Felds in einer Zahl (höchstens so viele Felder)

/**
 * Fußweg vom Bett zum Ziel `goal`: der kürzeste Weg zu Fuß, der sich nah am Strahl vom Bett zum Ziel hält (jedes Feld
 * kostet etwas mehr, je weiter es vom Strahl liegt), ohne `blocked`; leer, wenn es keinen gibt
 */
export function footpath(map: Map<string, Cell>, wake: readonly Point[], goal: Point, blocked: ReadonlySet<string>) {
  const [bx, by] = wake[0] ?? goal;
  const [gx, gy] = goal;
  const len = Math.hypot(gx - bx, gy - by) || 1;
  const off = (x: number, y: number) => Math.round(Math.abs((x - bx) * (gy - by) - (y - by) * (gx - bx)) / len);
  const keys: string[] = [];
  const ids = new Map<string, number>();
  const dist: number[] = [];
  const prev: number[] = [];
  const heap = new Heap();
  const visit = (k: string, d: number, from: number) => {
    let id = ids.get(k);
    if (id === undefined) {
      ids.set(k, (id = keys.length));
      keys.push(k);
      dist.push(Infinity);
      prev.push(-1);
    }
    if (d >= dist[id]!) return;
    dist[id] = d;
    prev[id] = from;
    heap.push(d * SHIFT + id);
  };
  for (const p of wake) if (standable(map.get(key(...p)))) visit(key(...p), 0, -1);
  const target = key(gx, gy);
  while (heap.size) {
    const top = heap.pop();
    const id = top % SHIFT;
    if ((top - id) / SHIFT > dist[id]!) continue;
    const k = keys[id]!;
    if (k === target) {
      const out: Point[] = [];
      for (let i = id; i >= 0; i = prev[i]!) out.push(fromKey(keys[i]!));
      return out.reverse();
    }
    const [x, y] = fromKey(k);
    const h = map.get(k)!.h;
    for (const [dx, dy] of STEPS) {
      const nk = key(x + dx, y + dy);
      const c = map.get(nk);
      if (c && !blocked.has(nk) && (standable(c) || nk === target) && c.h - h <= 1)
        visit(nk, dist[id]! + 50 + off(x + dx, y + dy), id);
    }
  }
  return [];
}
