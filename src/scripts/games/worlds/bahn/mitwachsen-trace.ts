// Trassen-Suche für ein Gleis – rein und deterministisch: der günstigste Weg über ein Raster freier Felder mit den Regeln
// eines Gleises: nur rechtwinklige Kurven mit mindestens `straight` Feldern Gerade dazwischen, Rampen mit höchstens einer
// Stufe je `ramp` Felder, nie mehr als eine Stufe auf einmal; wo das Gelände zu bucklig ist, darf es tiefer liegen
// (Einschnitt, `cut`). A* über Zustände (Feld, Richtung, Felder seit der letzten Kurve, Felder seit der letzten Stufe,
// Höhe des Gleises); eine Kurve kostet `turn` Felder mehr, eine Stufe eines. Teil des Pakets der Bahn.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden)

import { Heap } from '../../../../lib/games/heap';
import type { Point } from '../../../../data/games/mitwachsen';

export { Heap }; // der Haufen liegt im Unterbau (src/lib/games/heap.ts), auch die Wegsuche des Kerns nutzt ihn

/** Richtungen 0 rechts (e), 1 unten (s), 2 links (w), 3 oben (n) */
export const STEPS: readonly Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
/** Buchstabe einer Richtung (`Rail.to`) */
export const LETTERS = 'eswn';
/** Richtung von a nach b (Nachbarn) */
export const dirOf = (a: Point, b: Point): number =>
  STEPS.findIndex(([dx, dy]) => a[0] + dx === b[0] && a[1] + dy === b[1]);

/**
 * Raster der Suche: Rechteck ab (x0, y0), `open` je Feld 1, wenn das Gleis dort liegen darf, `height` seine Höhe,
 * `extra` was ein Feld zusätzlich kostet (ein Damm durch einen Teich)
 */
export type Grid = {
  x0: number;
  y0: number;
  w: number;
  h: number;
  open: Uint8Array;
  height: Int8Array;
  extra: Uint8Array;
};
/**
 * Regeln: Gerade zwischen Kurven, Felder je Stufe, Kosten einer Kurve und je Stufe Einschnitt (ohne: keiner); alle
 * Kosten ganze Zahlen (die Suche packt Kosten und Zustand in eine Zahl)
 */
export type TraceRules = { straight: number; ramp: number; turn: number; cut?: number };
/**
 * Anfang und Ziel: Die Suche steht auf `from` (das Gleis auf Höhe `z`) und schaut in Richtung `dir`; `run` Felder liegen
 * schon gerade hinter ihr, `flat` auf dieser Höhe (das Feld `from` muss nicht frei sein). Ziel: auf `to` ankommen, in
 * Richtung `toDir`, auf der Höhe dieses Felds
 */
export type Leg = { from: Point; z: number; dir: number; run: number; flat: number; to: Point; toDir: number };

/**
 * Ein Raster über dem Rechteck [x0, x1] × [y0, y1]; `cell` sagt je Feld, ob frei, wie hoch und was es zusätzlich kostet
 * (null: zu)
 */
export function gridOf(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cell: (x: number, y: number) => readonly [height: number, extra: number] | null,
): Grid {
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1;
  const open = new Uint8Array(w * h);
  const height = new Int8Array(w * h);
  const extra = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const v = cell(x, y);
      if (v === null) continue;
      const i = (y - y0) * w + (x - x0);
      open[i] = 1;
      [height[i], extra[i]] = v;
    }
  return { x0, y0, w, h, open, height, extra };
}

/** Höchste Höhe, die ein Gleis haben kann (Hügel bis 3, ein Stein darauf eine mehr) */
const TOP = 4;

/** Ein Zustand der Suche: Feld (Index im Raster), Richtung, Felder seit der Kurve, Felder auf der Höhe, Höhe */
type State = { i: number; d: number; run: number; flat: number; z: number };

/** Zustände als Zahlen: so viele gibt es, und hin und zurück */
function states(g: Grid, rules: TraceRules) {
  const R = rules.straight + 2; // Felder seit der letzten Kurve: 0 … straight + 1 (dann darf es abbiegen)
  const F = rules.ramp + 1; // Felder auf derselben Höhe: 1 … ramp (dann darf es eine Stufe nehmen)
  const Z = TOP + 1;
  return {
    R,
    F,
    n: g.w * g.h * 4 * R * F * Z,
    id: ({ i, d, run, flat, z }: State) => (((i * 4 + d) * R + run) * F + flat) * Z + z,
    of: (s: number): State => ({
      z: s % Z,
      flat: Math.floor(s / Z) % F,
      run: Math.floor(s / Z / F) % R,
      d: Math.floor(s / Z / F / R) % 4,
      i: Math.floor(s / Z / F / R / 4),
    }),
  };
}

/**
 * Die Züge aus einem Zustand: geradeaus oder (nach genug Gerade) rechtwinklig abbiegen, auf ein freies Feld, eine
 * Stufe höchstens je `ramp` Felder; mit `cut` auch tiefer als das Gelände. Je Zug `go` mit dem neuen Zustand und was er
 * kostet
 */
function moves(g: Grid, rules: TraceRules, R: number, F: number, s: State, go: (t: State, cost: number) => void) {
  const x = s.i % g.w,
    y = Math.floor(s.i / g.w);
  for (const nd of [s.d, (s.d + 1) % 4, (s.d + 3) % 4]) {
    if (nd !== s.d && s.run < R - 1) continue; // zu früh für die nächste Kurve
    const [dx, dy] = STEPS[nd]!;
    const qx = x + dx,
      qy = y + dy;
    if (qx < 0 || qy < 0 || qx >= g.w || qy >= g.h || !g.open[qy * g.w + qx]) continue;
    const q = qy * g.w + qx;
    const h = g.height[q]!;
    for (let z = Math.max(1, s.z - 1); z <= Math.min(s.z + 1, h); z++) {
      if (z < h && rules.cut === undefined) continue; // ohne Einschnitt liegt das Gleis auf dem Gelände
      if (z !== s.z && s.flat < F - 1) continue; // höchstens eine Stufe je `ramp` Felder
      const run = nd === s.d ? Math.min(s.run + 1, R - 1) : 1;
      const flat = z !== s.z ? 1 : Math.min(s.flat + 1, F - 1);
      const c = 1 + g.extra[q]! + (nd !== s.d ? rules.turn : 0) + (z !== s.z ? 1 : 0) + (h - z) * (rules.cut ?? 0);
      go({ i: q, d: nd, run, flat, z }, c);
    }
  }
}

/**
 * Der günstigste Weg von `leg.from` nach `leg.to` nach den Regeln eines Gleises, samt Anfang und Ziel: je Feld seine Lage
 * und die Höhe des Gleises dort (`z`, höchstens die des Felds: Mit `rules.cut` darf das Gleis tiefer liegen als das
 * Gelände, ein Einschnitt, jede Stufe tiefer kostet `cut`; ohne liegt es auf dem Gelände). Das Gleis beginnt auf der Höhe
 * des Anfangs (`leg.z`) und endet auf der des Ziels. Dazu die Kosten; null, wenn es keinen Weg gibt oder die Suche
 * mehr als `budget` Zustände anschauen müsste (so dauert eine Suche nie lange)
 */
export function trace(
  g: Grid,
  leg: Leg,
  rules: TraceRules,
  budget = Infinity,
): { cells: Point[]; z: number[]; cost: number } | null {
  const { R, F, n, id, of } = states(g, rules);
  const inside = ([x, y]: Point) => x >= g.x0 && y >= g.y0 && x < g.x0 + g.w && y < g.y0 + g.h;
  const idx = ([x, y]: Point) => (y - g.y0) * g.w + (x - g.x0);
  if (!inside(leg.from) || !inside(leg.to)) return null;
  const goal = idx(leg.to);
  const goalZ = g.height[goal]!;
  const cost = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const heap = new Heap();
  const est = (i: number) =>
    Math.abs((i % g.w) - (goal % g.w)) + Math.abs(Math.floor(i / g.w) - Math.floor(goal / g.w));
  const first = {
    i: idx(leg.from),
    d: leg.dir,
    run: Math.min(leg.run, R - 1),
    flat: Math.min(Math.max(leg.flat, 1), F - 1),
    z: leg.z,
  };
  const start = id(first);
  cost[start] = 0;
  heap.push(est(first.i) * n + start);
  for (let seen = 0; heap.size;) {
    const top = heap.pop();
    const sid = top % n;
    const s = of(sid);
    if ((top - sid) / n > cost[sid]! + est(s.i) + 1e-9) continue; // überholt
    if (++seen > budget) return null;
    if (s.i === goal && s.d === leg.toDir && s.z === goalZ && sid !== start)
      return walkBack(g, of, from, sid, cost[sid]!);
    moves(g, rules, R, F, s, (t, c) => {
      const tid = id(t);
      if (cost[sid]! + c >= cost[tid]!) return;
      cost[tid] = cost[sid]! + c;
      from[tid] = sid;
      heap.push((cost[tid] + est(t.i)) * n + tid);
    });
  }
  return null;
}

/** Den gefundenen Weg vom Ziel zurück zum Anfang lesen */
function walkBack(g: Grid, of: (s: number) => State, from: Int32Array, end: number, cost: number) {
  const cells: Point[] = [];
  const z: number[] = [];
  for (let k = end; k >= 0; k = from[k]!) {
    const s = of(k);
    cells.push([g.x0 + (s.i % g.w), g.y0 + Math.floor(s.i / g.w)]);
    z.push(s.z);
  }
  return { cells: cells.reverse(), z: z.reverse(), cost };
}
