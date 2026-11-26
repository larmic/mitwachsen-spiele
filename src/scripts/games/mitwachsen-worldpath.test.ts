// Weltpfade der Lichtung (Issue 61): gerade Linie, Umweg um Hindernisse, nur der Boden ändert sich; in echten Welten
// führt von jedem Portalstein am Bett ein Pfad im Material der Welt zu seinem Tor
import { describe, expect, it } from 'vitest';
import type { GateId, Point } from '../../data/games/mitwachsen';
import { APRON } from './mitwachsen-apron';
import type { Cell } from './mitwachsen-cell';
import { mapColor } from './mitwachsen-map';
import { LICHTUNG_HOME } from './mitwachsen-home';
import { PATHS, layPaths, line, route } from './mitwachsen-worldpath';
import { standHeight } from './mitwachsen-world';
import { SAMPLE_SEEDS, bareOf } from './test-worlds';

const key = (x: number, y: number) => `${x},${y}`;
const grass = (more: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grass',
  deco: null,
  region: 'lichtung',
  solid: false,
  ...more,
});
/** Wiese von (0, 0) bis (w − 1, h − 1), mit Ausnahmen je Feld */
function field(w: number, h: number, special: Record<string, Partial<Cell>> = {}): Map<string, Cell> {
  const map = new Map<string, Cell>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) map.set(key(x, y), grass(special[key(x, y)]));
  return map;
}
const adjacent = (path: readonly Point[]) =>
  path.every((p, i) => i === 0 || Math.abs(p[0] - path[i - 1]![0]) + Math.abs(p[1] - path[i - 1]![1]) === 1);

describe('Weltpfade: Linie und Umweg', () => {
  it('die Linie verbindet beide Enden Feld an Feld, nie schräg, in jeder Richtung so kurz wie möglich', () => {
    for (const [a, b] of [
      [
        [0, 0],
        [9, 0],
      ],
      [
        [0, 0],
        [0, -7],
      ],
      [
        [2, 3],
        [11, 8],
      ],
      [
        [5, 5],
        [-4, 9],
      ],
      [
        [0, 0],
        [-6, -6],
      ],
      [
        [3, 3],
        [3, 3],
      ],
    ] as [Point, Point][]) {
      const l = line(a, b);
      expect(l[0]).toEqual(a);
      expect(l.at(-1)).toEqual(b);
      expect(adjacent(l)).toBe(true);
      expect(l).toHaveLength(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) + 1);
    }
  });

  it('über freie Wiese läuft der Weg auf der Linie; um einen Teich, einen Baum und eine hohe Stufe macht er den kürzesten Umweg', () => {
    expect(route(field(12, 5), [0, 2], [11, 2])).toEqual(line([0, 2], [11, 2]));
    const pond = field(12, 7, {
      '5,2': { ground: 'water', h: 0 },
      '5,3': { ground: 'water', h: 0 },
      '5,4': { ground: 'water', h: 0 },
      '8,3': { deco: 'tree', solid: true },
    });
    const around = route(pond, [0, 3], [11, 3]);
    expect(around[0]).toEqual([0, 3]);
    expect(around.at(-1)).toEqual([11, 3]);
    expect(adjacent(around)).toBe(true);
    expect(around.every(([x, y]) => !pond.get(key(x, y))!.solid && pond.get(key(x, y))!.ground !== 'water')).toBe(true);
    expect(around.length).toBeLessThanOrEqual(12 + 8); // zwei kleine Umwege
    const step = field(8, 3, { '4,0': { h: 3 }, '4,1': { h: 3 }, '4,2': { h: 3 } });
    expect(route(step, [0, 1], [7, 1])).toEqual([]); // eine Wand quer durch: kein Weg
    const ramp = field(8, 3, { '3,1': { h: 2 }, '4,1': { h: 3 }, '5,1': { h: 2 } });
    expect(route(ramp, [0, 1], [7, 1])).toEqual(line([0, 1], [7, 1])); // eine Stufe je Schritt geht
  });
});

describe('Weltpfade: legen', () => {
  const portals = new Map<GateId, { gate: Point; home: Point }>([
    ['eis', { home: [10, 30], gate: [70, 30] }],
    ['hoehle', { home: [10, 28], gate: [10, 2] }],
  ]);

  it('ändert nur den Boden freier Wiese: Material der Welt, flache Zierde weicht; nichts wird fest, höher oder nass', () => {
    const map = field(80, 40, {
      '40,30': { deco: 'flower', color: '#f00' },
      '50,30': { garden: true },
      '55,30': { ground: 'sand' },
      '60,30': { deco: 'tree', solid: true },
      '10,10': { plate: 'hoehle' },
    });
    const before = new Map(map);
    const laid = layPaths(map, [10, 30], portals);
    expect([...laid.keys()]).toEqual(['eis', 'hoehle']);
    for (const [k, c] of map) {
      const was = before.get(k)!;
      if (c === was) continue;
      expect(c.way, k).toBeDefined();
      expect(c).toEqual({ ...was, ground: APRON[c.way!], deco: null, tufts: 0, way: c.way });
      expect(was.ground).toBe('grass');
      expect(was.solid || was.garden || was.plate).toBeFalsy();
    }
    expect(map.get('40,30')).toMatchObject({ ground: 'snow', deco: null, way: 'eis' }); // die Blume weicht
    for (const k of ['50,30', '55,30', '60,30', '10,10']) expect(map.get(k)).toBe(before.get(k)); // Wiese, Sand, Baum, Platte bleiben
    expect(laid.get('eis')!.every(([x, y]) => map.get(key(x, y))!.way === 'eis')).toBe(true);
  });

  it('nah am Bett Trittsteine (jedes zweite Feld), ab 20 Feldern durchgehend', () => {
    const map = field(80, 40);
    const eis = layPaths(map, [10, 30], portals).get('eis')!;
    const near = eis.filter(([x]) => x - 10 < PATHS.solid);
    const far = eis.filter(([x]) => x - 10 >= PATHS.solid);
    expect(near.length).toBeGreaterThanOrEqual(8);
    expect(near.every(([x], i) => i === 0 || x - near[i - 1]![0] === PATHS.every)).toBe(true);
    expect(far.every(([x], i) => i === 0 || x - far[i - 1]![0] === 1)).toBe(true);
    expect(far.at(-1)![0]).toBe(70);
  });

  it('ein zweiter Pfad überschreibt keinen ersten', () => {
    const cross = new Map<GateId, { gate: Point; home: Point }>([
      ['eis', { home: [0, 20], gate: [60, 20] }],
      ['lava', { home: [30, 0], gate: [30, 39] }],
    ]);
    const map = field(80, 40);
    layPaths(map, [-100, -100], cross);
    expect(map.get('30,20')!.way).toBe('eis');
    expect(map.get('30,10')!.way).toBe('lava');
  });
});

describe('Weltpfade: in echten Welten', () => {
  it.each(SAMPLE_SEEDS)(
    'Seed %i: von jedem Portalstein ein Pfad im Material der Welt zum Tor, begehbar, auf der Karte zu sehen',
    (seed) => {
      const w = bareOf(seed);
      const [bx, by] = LICHTUNG_HOME.bed;
      const ways = new Map<GateId, Point[]>();
      for (let y = by - 90; y <= by + 90; y++)
        for (let x = bx - 100; x <= bx + 100; x++) {
          const c = w.cell(x, y);
          if (c.way) ways.set(c.way, [...(ways.get(c.way) ?? []), [x, y]]);
        }
      expect([...ways.keys()].sort()).toEqual([...w.gates.keys()].sort());
      for (const [id, cells] of ways) {
        const p = w.portals.get(id)!;
        const far = (q: Point, [x, y]: Point) => Math.hypot(q[0] - x, q[1] - y);
        const span = far(p.home, p.gate);
        expect(cells.length, `${id}`).toBeGreaterThan(span * 0.5);
        // er reicht vom Bett bis ans Tor: ein Feld nah am Portalstein, eines nah an der Plattform am Tor
        expect(Math.min(...cells.map((c) => far(c, p.home))), `${id} am Bett`).toBeLessThanOrEqual(6);
        expect(Math.min(...cells.map((c) => far(c, p.gate))), `${id} am Tor`).toBeLessThanOrEqual(8);
        for (const [x, y] of cells) {
          const c = w.cell(x, y);
          expect(c.ground).toBe(APRON[id]);
          expect(c.region).toBe('lichtung');
          expect(standHeight(w, [], x, y), `${id} ${x},${y}`).not.toBeNull();
          expect(c.garden || c.portal || c.plate).toBeFalsy();
          expect(mapColor(c)).not.toBe(mapColor({ ...c, ground: 'grass', way: undefined })); // die Karte zeigt ihn
        }
        // ab 20 Feldern vom Bett durchgehend: Jedes Feld dort hat einen Nachbarn auf demselben Pfad
        const on = new Set(cells.map(([x, y]) => key(x, y)));
        const alone = cells.filter(
          ([x, y]) =>
            far([x, y], [bx, by]) >= PATHS.solid + 2 &&
            ![
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([dx, dy]) => on.has(key(x + dx!, y + dy!))),
        );
        expect(alone.length, `${id}: einzelne Felder weit draußen`).toBeLessThanOrEqual(3);
      }
    },
  );
});
