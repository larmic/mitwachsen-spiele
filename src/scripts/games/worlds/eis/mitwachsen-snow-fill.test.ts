// Fülle im Schnee des Gletschertals (Issue 16): dicht genug, nie im Weg, nichts neu gewürfelt, nicht auf der Karte
import { describe, expect, it } from 'vitest';
import type { Cell } from '../../mitwachsen-cell';
import { mapColor } from '../../mitwachsen-map';
import { kesselPlace, type World } from '../../mitwachsen-world';
import { EIS_PACK, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { SNOW_FILL_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import { soft } from './mitwachsen-prints';
import { SNOW_FILLS, adornKessel } from './mitwachsen-snow-fill';
import { fillBoxes } from './mitwachsen-snow-fill-look';
import { view } from './view-2d';
import { view3d } from './view-3d';

const key = (x: number, y: number) => `${x},${y}`;
const isFill = (c: Cell) => SNOW_FILLS.includes(c.deco!);
/** Felder des Tals (ohne die Klippen) */
const valley = (seed: number, w: World) =>
  kesselPlace(seed, EIS_PACK)
    .cells.map(([x, y]) => [x, y, w.cell(x, y)] as const)
    .filter(([, , c]) => c.region === 'eis');

/**
 * Anteil leerer Kacheln im Tal. Eine Kachel ist 4×4 Felder groß und zählt nur, wenn alle 16 Felder im Tal liegen. Leer
 * heißt: kein Ding, keine Strecke, keine Rutschspur, keine Wiese, kein Eis und kein Wasser. Schneewehen zählen nicht
 * (so war es vor der Fülle gemessen: 49 bis 50 %), die Fülle zählt.
 */
function emptyShare(seed: number, w: World): number {
  const cells = valley(seed, w);
  const busy = (c: Cell) =>
    (!!c.deco && c.deco !== 'snowdrift') || !!c.ride || !!c.slide || !!c.garden || c.ground !== 'snow';
  const tiles = new Set(cells.map(([x, y]) => key(Math.floor(x / 4), Math.floor(y / 4))));
  let all = 0;
  let empty = 0;
  for (const t of tiles) {
    const [tx, ty] = t.split(',').map(Number) as [number, number];
    const inside: Cell[] = [];
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) inside.push(w.cell(tx * 4 + dx, ty * 4 + dy));
    if (inside.some((c) => c.region !== 'eis')) continue;
    all++;
    if (!inside.some(busy)) empty++;
  }
  return empty / all;
}

describe('Fülle im Schnee', () => {
  it.each([1, 7, 42])('Seed %i: höchstens ein Viertel der Kacheln ist leer, etwa 10 Dinge je 100 Felder', (seed) => {
    const w = worldOf(seed, [EIS_PACK]);
    expect(emptyShare(seed, w)).toBeLessThanOrEqual(0.25);
    const snow = valley(seed, w).filter(([, , c]) => c.ground === 'snow');
    const per100 = (snow.filter(([, , c]) => c.deco).length / snow.length) * 100;
    expect(per100).toBeGreaterThanOrEqual(9);
    expect(per100).toBeLessThanOrEqual(13);
    for (const kind of SNOW_FILLS)
      expect(
        snow.some(([, , c]) => c.deco === kind),
        kind,
      ).toBe(true);
  });

  it.each(seedsFor(seedRange(1, 6)))(
    'Seed %i: nie auf Strecke, Spur, Wiese, Plattform, Eis oder Wasser, nichts Festes, keine Farbe',
    (seed) => {
      const w = worldOf(seed, [EIS_PACK]);
      const bad: string[] = [];
      let count = 0;
      for (const [x, y, c] of valley(seed, w)) {
        if (!isFill(c)) continue;
        count++;
        if (c.solid || c.ground !== 'snow' || c.ride || c.slide || c.garden || c.portal || c.color || c.tree)
          bad.push(`${x},${y}: ${c.deco}`);
        if (c.deco === 'tundra') {
          const near = [-2, -1, 0, 1, 2].some((dy) =>
            [-2, -1, 0, 1, 2].some((dx) => {
              const n = w.cell(x + dx, y + dy);
              return n.tree === 'snowpine' || !!n.garden;
            }),
          );
          if (!near) bad.push(`${x},${y}: Tundra fern von Tanne und Wiese`);
        }
      }
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
      expect(count).toBeGreaterThan(300);
    },
  );

  // Gemessen auf main vor der Fülle: Schneehaufen, Kristalle, Tannen, Schneewehen, Eiszapfen. Seit dem Rodelberg
  // (Issue 50) weichen ihm ein paar Tannen samt ihren Schneewehen; Schneehaufen, Kristalle und Eiszapfen weichen nie
  it.each([
    [1, 14, 65, 175, 234, 6],
    [7, 14, 65, 152, 201, 6],
    [42, 14, 63, 138, 188, 5],
  ])('Seed %i: nichts ist neu gewürfelt', (seed, heaps, crystals, pines, drifts, icicles) => {
    const w = worldOf(seed, [EIS_PACK]);
    const n = (is: (c: Cell) => boolean) => valley(seed, w).filter(([, , c]) => is(c)).length;
    expect(n((c) => c.deco === 'snowheap')).toBe(heaps);
    expect(n((c) => c.deco === 'crystal')).toBe(crystals);
    expect(n((c) => c.deco === 'icicle')).toBe(icicles);
    const gone = pines - n((c) => c.tree === 'snowpine');
    expect(gone).toBeGreaterThanOrEqual(0);
    expect(gone).toBeLessThanOrEqual(8);
    const lost = drifts - n((c) => c.deco === 'snowdrift');
    expect(lost).toBeGreaterThanOrEqual(0);
    expect(lost).toBeLessThanOrEqual(2 * gone + 12); // je Tanne bis zu zwei, dazu Wehen auf dem Berg selbst
  });

  it('adornKessel fasst nur blanken Schnee an und ändert dort nur Deko und Sorte', () => {
    const snow = (more: Partial<Cell> = {}): Cell => ({
      h: 1,
      ground: 'snow',
      deco: null,
      region: 'eis',
      solid: false,
      biome: 'eis',
      ...more,
    });
    const map = new Map<string, Cell>();
    const cells: [number, number][] = [];
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        cells.push([x, y]);
        map.set(
          key(x, y),
          x < 4
            ? snow({ slide: true })
            : x < 8
              ? snow({ garden: true })
              : x < 12
                ? snow({ ground: 'ice' })
                : x === 12
                  ? snow({ ground: 'water' })
                  : x === 16 && y % 6 === 0
                    ? snow({ deco: 'tree', tree: 'snowpine', solid: true })
                    : snow(),
        );
      }
    const shut = new Set([key(20, 3), key(20, 4), key(21, 4)]);
    const before = new Map(map);
    adornKessel(5, cells, map, shut);
    let filled = 0;
    for (const [k, c] of map) {
      const was = before.get(k)!;
      if (c === was) continue;
      filled++;
      expect(isFill(c), k).toBe(true);
      expect(shut.has(k), k).toBe(false);
      expect(was).toEqual(snow());
      expect({ ...c, deco: null, note: undefined }).toEqual({ ...was, note: undefined });
    }
    expect(filled).toBeGreaterThan(10);
    const again = new Map(before);
    adornKessel(5, cells, again, shut);
    expect([...again]).toEqual([...map]); // derselbe Seed, dieselbe Fülle
  });

  it('Karte zeigt Schnee, Fußspuren bleiben', () => {
    const w = worldOf(1, [EIS_PACK]);
    for (const kind of [...SNOW_FILLS, 'snowdrift'] as const) {
      const c = valley(1, w).find(([, , cell]) => cell.deco === kind)![2];
      expect(mapColor(c), kind).toBe(mapColor({ ...c, deco: null }));
      expect(soft(c), kind).toBe(true);
    }
  });

  it('Aussehen: jede Sorte hat flache Quader im Feld, ohne Gold; nur der Funke des Eisflecks blitzt', () => {
    const colors = new Set<string>(Object.values(SNOW_FILL_COLORS).flat());
    for (const kind of [...SNOW_FILLS, 'snowdrift'] as const)
      for (const note of [0, 1, 2, 3])
        for (const [x, y] of [
          [3, 4],
          [4, 4],
        ] as const) {
          const c: Cell = { h: 2, ground: 'snow', deco: kind, region: 'eis', solid: false, note };
          const boxes = fillBoxes(c, x, y)!;
          expect(boxes.length, kind).toBeGreaterThan(0);
          for (const [bx, by, bz, bw, bd, bh, side, top] of boxes) {
            expect(bx).toBeGreaterThanOrEqual(x);
            expect(bx + bw).toBeLessThanOrEqual(x + 1);
            expect(by).toBeGreaterThanOrEqual(y);
            expect(by + bd).toBeLessThanOrEqual(y + 1);
            expect(bz).toBeGreaterThanOrEqual(2);
            expect(bz + bh).toBeLessThanOrEqual(2.5);
            expect(colors.has(side) && colors.has(top), `${kind}: ${side} ${top}`).toBe(true);
          }
          const lit = fillBoxes(c, x, y, 1)!;
          if (kind === 'iceglint') expect(lit.at(-1)![3]).toBeGreaterThan(boxes.at(-1)![3]);
          else expect(lit).toEqual(boxes);
        }
    expect(fillBoxes({ h: 1, ground: 'snow', deco: 'crystal', region: 'eis', solid: true }, 0, 0)).toBeNull();
  });

  it('beide Ansichten zeichnen jede Sorte, in 2D blitzt der Eisfleck nur ohne reduzierte Bewegung', () => {
    const w = worldOf(1, [EIS_PACK]);
    const at = { now: 0, reduced: false, picked: {}, packs: {} } as never;
    for (const kind of [...SNOW_FILLS, 'snowdrift'] as const) {
      const [x, y, c] = valley(1, w).find(([, , cell]) => cell.deco === kind)!;
      expect(view.decos[kind]!(w, c, x, y, at), kind).toEqual(fillBoxes(c, x, y));
      expect(view3d.decos[kind]!(w, c, x, y, at), kind).toEqual(fillBoxes(c, x, y));
    }
    const [x, y, c] = valley(1, w).find(([, , cell]) => cell.deco === 'iceglint')!;
    const widths = (reduced: boolean) =>
      new Set(
        Array.from(
          { length: 80 },
          (_, i) => view.decos.iceglint!(w, c, x, y, { ...(at as object), now: i * 100, reduced } as never)!.at(-1)![3],
        ),
      );
    expect(widths(false).size).toBeGreaterThan(1);
    expect(widths(true).size).toBe(1);
  });
});
