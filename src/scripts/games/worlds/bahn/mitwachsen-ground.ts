// Boden für das Gleis der Höhlenbahn – rein: Wege zu Fuß über die feste Karte (wer wohin kommt, der Fußweg vom Bett
// zur Torplatte), Gelände absenken, damit nirgends mehr als eine Stufe entsteht, und einen freien Gang vor der Bucht,
// wenn man ohne die Spur des Gleises nicht zur Torplatte käme. Teil des Pakets der Bahn (mitwachsen-line.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden)

import type { Point } from '../../../../data/games/mitwachsen';
import type { Cell } from '../../mitwachsen-cell';
import { footpath, standable } from '../../mitwachsen-footpath';
import { STEPS } from './mitwachsen-trace';

export const key = (x: number, y: number) => `${x},${y}`;
/** Die acht Nachbarn und das Feld selbst */
export const N8: readonly Point[] = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy): Point => [dx, dy]));

export { footpath, standable }; // im Kern (mitwachsen-footpath.ts): Auch die Weltpfade der Lichtung nutzen sie

/** Ein Ding, von dem Gleis und Bahnhöfe Abstand halten: Plattform, Wiese samt Trögen und Unterstand, Torplatte, Klangstein */
export const kept = (c: Cell) => !!c.portal || !!c.garden || !!c.plate || c.deco === 'klangstein';

/** Felder, die vom Bett (`wake`) aus zu Fuß erreichbar sind, ohne `blocked` */
export function walk(map: Map<string, Cell>, wake: readonly Point[], blocked: ReadonlySet<string> = new Set()) {
  const seen = new Set<string>();
  const queue: Point[] = [];
  for (const [x, y] of wake)
    if (standable(map.get(key(x, y))) && !blocked.has(key(x, y))) {
      seen.add(key(x, y));
      queue.push([x, y]);
    }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const h = map.get(key(x, y))!.h;
    for (const [dx, dy] of STEPS) {
      const k = key(x + dx, y + dy);
      const c = map.get(k);
      if (seen.has(k) || blocked.has(k) || !standable(c) || c.h - h > 1) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return seen;
}

/** So viele Schritte braucht man vom Bett (`wake`) bis zum nächsten Feld aus `goal` (−1: gar nicht) */
export function stepsTo(map: Map<string, Cell>, wake: readonly Point[], goal: ReadonlySet<string>) {
  const dist = new Map<string, number>();
  const queue: Point[] = [];
  for (const [x, y] of wake)
    if (standable(map.get(key(x, y))) && !dist.has(key(x, y))) {
      dist.set(key(x, y), 0);
      queue.push([x, y]);
    }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const d = dist.get(key(x, y))!;
    if (goal.has(key(x, y))) return d;
    const h = map.get(key(x, y))!.h;
    for (const [dx, dy] of STEPS) {
      const k = key(x + dx, y + dy);
      const c = map.get(k);
      if (dist.has(k) || !standable(c) || c.h - h > 1) continue;
      dist.set(k, d + 1);
      queue.push([x + dx, y + dy]);
    }
  }
  return -1;
}

/** Nur absenken: Felder der Lichtung um `cells` (Rand `r`) liegen höchstens eine Stufe über jedem Nachbarn (wie beim Bau) */
export function settle(map: Map<string, Cell>, cells: readonly Point[], r = 6) {
  const land = (c: Cell | undefined): c is Cell => !!c && c.region === 'lichtung' && c.ground !== 'water' && !c.gate;
  const box: Point[] = [];
  const xs = cells.map((p) => p[0]),
    ys = cells.map((p) => p[1]);
  for (let y = Math.min(...ys) - r; y <= Math.max(...ys) + r; y++)
    for (let x = Math.min(...xs) - r; x <= Math.max(...xs) + r; x++) box.push([x, y]);
  for (let changed = true; changed;) {
    changed = false;
    for (const [x, y] of box) {
      const c = map.get(key(x, y));
      if (!land(c)) continue;
      const low = Math.min(
        ...STEPS.map(([dx, dy]) => map.get(key(x + dx, y + dy)))
          .filter(land)
          .map((n) => n.h),
      );
      if (c.h > low + 1) {
        map.set(key(x, y), { ...c, h: low + 1 });
        changed = true;
      }
    }
  }
}

/**
 * Kommt man ohne die Spur (`reserved`) nicht zur Torplatte, wird wie beim Bau der Lichtung ein freier Gang vor der Bucht
 * gelegt (drei Felder breit, mitten vor der Tür), bis er auf Land trifft, das man so erreicht: Wasser wird Gras, Fels,
 * Bäume und Büsche weichen, die Höhen bleiben (danach höchstens eine Stufe zum Nachbarn)
 */
export function clearWay(
  map: Map<string, Cell>,
  at: (u: number, t: number) => Point,
  wake: readonly Point[],
  reserved: ReadonlySet<string>,
) {
  const reach = walk(map, wake, reserved);
  if (reach.has(key(...at(0, -2)))) return;
  const cleared: Point[] = [];
  for (let t = -3; t > -60 && !reach.has(key(...at(0, t))); t--)
    for (const u of [-1, 0, 1]) {
      const p = at(u, t);
      const c = map.get(key(...p));
      if (!c || !(c.region === 'lichtung' || c.deco === 'rock')) continue;
      map.set(key(...p), {
        h: Math.max(1, c.h),
        ground: c.ground === 'water' ? 'grass' : c.ground,
        deco: null,
        region: 'lichtung',
        solid: false,
      });
      cleared.push(p);
    }
  if (cleared.length) settle(map, cleared);
}

/** Nähe zu etwas: Liegt ein Feld höchstens `r` Felder (Chebyshev) von einem Feld, für das `hit` gilt? */
export function near(map: Map<string, Cell>, [x, y]: Point, r: number, hit: (c: Cell, k: string) => boolean) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const k = key(x + dx, y + dy);
      const c = map.get(k);
      if (c && hit(c, k)) return true;
    }
  return false;
}
