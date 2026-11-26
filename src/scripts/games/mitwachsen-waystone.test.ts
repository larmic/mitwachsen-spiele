// Wegsteine an den Weltpfaden (Weltpfade, Schritt 3): Abstand, Seite, nur auf freier Wiese; Lichterkette; in echten
// Welten liegen an jedem Pfad Steine neben dem Pfad, begehbar und vom Bett zum Tor geordnet
import { describe, expect, it } from 'vitest';
import { THEME_COLORS, type GateId, type Point } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';
import { WAYSTONES, due, layStones, stoneOf } from './mitwachsen-waystone';
import { WAYSTONE_COLORS, waystoneBoxes } from './mitwachsen-waystone-look';
import { layPaths } from './mitwachsen-worldpath';
import { standHeight } from './mitwachsen-world';
import { BAHN_PACK, BUILT, SAMPLE_SEEDS, bareOf, worldOf } from './test-worlds';

const key = (x: number, y: number) => `${x},${y}`;
const grass = (more: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grass',
  deco: null,
  region: 'lichtung',
  solid: false,
  ...more,
});
function field(w: number, h: number, special: Record<string, Partial<Cell>> = {}): Map<string, Cell> {
  const map = new Map<string, Cell>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) map.set(key(x, y), grass(special[key(x, y)]));
  return map;
}
const portals = new Map<GateId, { gate: Point; home: Point }>([['eis', { home: [10, 20], gate: [70, 20] }]]);
const lay = (special: Record<string, Partial<Cell>> = {}) => {
  const map = field(80, 40, special);
  const before = new Map(map);
  const paths = layPaths(map, [10, 20], portals);
  const mid = new Map(map);
  return { map, before, mid, stones: layStones(map, paths).get('eis')! };
};

describe('Wegsteine: legen', () => {
  it('alle 6 bis 8 Felder einer, direkt neben dem Pfad, abwechselnd auf beiden Seiten', () => {
    const { stones } = lay();
    expect(stones.length).toBeGreaterThanOrEqual(7);
    stones.forEach(([x, y], i) => {
      expect(Math.abs(y - 20)).toBe(1);
      expect(y).toBe(i % 2 ? 21 : 19);
      // nah am Bett liegen nur Trittsteine (jedes zweite Feld): Der Abstand kann dort um eins wachsen
      const gap = i ? x - stones[i - 1]![0] - WAYSTONES.gaps[i % 3]! : 0;
      expect(gap === 0 || gap === 1, `Stein ${i}`).toBe(true);
    });
    expect(stones.map(([x]) => x)).toEqual([...stones.map(([x]) => x)].sort((a, b) => a - b)); // vom Bett zum Tor
  });

  it('nur der Stein kommt dazu: Boden, Höhe und Begehbarkeit bleiben', () => {
    const { map, mid, stones } = lay();
    for (const [k, c] of map) {
      const was = mid.get(k)!;
      if (c === was) continue;
      expect(c).toEqual({ ...was, tufts: 0, waystone: 'eis' });
      expect(stoneOf(c)).toBe('eis');
    }
    expect([...map.values()].filter((c) => c.waystone)).toHaveLength(stones.length);
  });

  it('weicht auf die andere Seite aus und lässt Blumen, Bäume, Wiese am Bett und andere Höhen in Ruhe', () => {
    const block: Record<string, Partial<Cell>> = {};
    for (let x = 0; x < 80; x++) block[key(x, 19)] = { deco: 'flower', color: '#f00' };
    const { map, before, stones } = lay(block);
    expect(stones.length).toBeGreaterThanOrEqual(7);
    expect(stones.every(([, y]) => y === 21)).toBe(true);
    for (let x = 0; x < 80; x++) expect(map.get(key(x, 19))).toBe(before.get(key(x, 19)));
    for (const special of [{ deco: 'tree', solid: true }, { garden: true }, { h: 2 }, { ground: 'sand' }] as const) {
      const both: Record<string, Partial<Cell>> = {};
      for (let x = 0; x < 80; x++) both[key(x, 19)] = both[key(x, 21)] = special;
      expect(lay(both).stones, JSON.stringify(special)).toEqual([]);
    }
  });

  it('unter Gleis, Bahnsteig oder Zierde sieht man ihn nicht', () => {
    const stone = grass({ waystone: 'eis', tufts: 0 });
    expect(stoneOf(stone)).toBe('eis');
    expect(stoneOf({ ...stone, ride: 'hoehle' })).toBeUndefined();
    expect(stoneOf({ ...stone, stop: 'hoehle' })).toBeUndefined();
    expect(stoneOf({ ...stone, deco: 'flower' })).toBeUndefined();
    expect(stoneOf({ ...stone, ground: 'stone', solid: true })).toBeUndefined();
    expect(stoneOf({ ...stone, ground: 'snow' })).toBe('eis'); // Fleck der Welt dahinter nah am Rand
    expect(stoneOf(grass())).toBeUndefined();
    expect(stoneOf(undefined)).toBeUndefined();
  });
});

describe('Wegsteine: Lichterkette und Bild', () => {
  it('läuft vom Bett zum Tor, ein Stein je zwei Takte, jeder genau einmal', () => {
    const stones: Point[] = [
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    expect(due(stones, 100, 99)).toEqual([]);
    expect(due(stones, 100, 100)).toEqual([[1, 0]]);
    expect(due(stones, 100, 101)).toEqual([]);
    expect(due(stones, 100, 100 + WAYSTONES.pace)).toEqual([[2, 0]]);
    expect(due(stones, 100, 100 + 2 * WAYSTONES.pace)).toEqual([[3, 0]]);
    const all = Array.from({ length: 40 }, (_, t) => due(stones, 100, 90 + t)).flat();
    expect(all).toEqual(stones);
  });

  it('schlafend matt und grau, wach in der Farbe der Welt; flach und innerhalb des Felds', () => {
    for (const id of Object.keys(THEME_COLORS) as GateId[]) {
      const [asleep, awake] = [waystoneBoxes(3, 4, 1, id, false), waystoneBoxes(3, 4, 1, id, true)];
      expect(asleep[1]![7]).toBe(WAYSTONE_COLORS.asleep);
      expect(awake[1]![7]).toBe(THEME_COLORS[id].portal);
      expect(asleep[0]).toEqual(awake[0]); // die Platte bleibt, nur die Einlage ändert sich
      for (const [x, y, z, w, d, h] of awake) {
        expect(x).toBeGreaterThanOrEqual(3);
        expect(x + w).toBeLessThanOrEqual(4);
        expect(y).toBeGreaterThanOrEqual(4);
        expect(y + d).toBeLessThanOrEqual(5);
        expect(z + h).toBeLessThanOrEqual(1.11); // flach: Man läuft darüber
      }
    }
  });
});

describe('Wegsteine: in echten Welten', () => {
  it.each(SAMPLE_SEEDS)('Seed %i: an jedem Pfad Steine neben dem Pfad, begehbar, geordnet vom Bett zum Tor', (seed) => {
    const w = bareOf(seed);
    expect([...w.waystones.keys()].sort()).toEqual([...w.gates.keys()].sort());
    for (const [id, stones] of w.waystones) {
      expect(stones.length, id).toBeGreaterThanOrEqual(4);
      const home = w.portals.get(id)!.home;
      const far = ([x, y]: Point) => Math.hypot(x - home[0], y - home[1]);
      stones.forEach(([x, y], i) => {
        const c = w.cell(x, y);
        expect(stoneOf(c), `${id} ${x},${y}`).toBe(id);
        expect(standHeight(w, [], x, y), `${id} ${x},${y}`).toBe(c.h);
        expect(c.tufts ?? 0).toBe(0);
        // direkt neben einem Feld seines Pfads
        const beside = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => w.cell(x + dx!, y + dy!).way === id);
        expect(beside, `${id} ${x},${y}`).toBe(true);
        if (i) expect(far([x, y]), `${id} ${i}`).toBeGreaterThan(far(stones[i - 1]!) - 12);
      });
    }
  });

  it('mit gebauter Bahn liegt kein Stein unter dem Gleis', () => {
    const w = worldOf(SAMPLE_SEEDS[0]!, [BAHN_PACK], BUILT);
    for (const stones of w.waystones.values())
      for (const [x, y] of stones) {
        expect(w.cell(x, y).ride).toBeUndefined();
        expect(stoneOf(w.cell(x, y))).toBeDefined();
      }
  });
});
