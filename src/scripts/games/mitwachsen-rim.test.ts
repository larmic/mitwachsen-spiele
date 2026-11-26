// Rand der Lichtung (Issue 36): Kante statt Treppe, Hecke innen, Fels ragt dahinter; Buchten der Tore und Gleis bleiben
import { describe, expect, it } from 'vitest';
import type { Cell } from './mitwachsen-cell';
import { mapColor } from './mitwachsen-map';
import { GATE_KEEP, RAIL_KEEP, RIM_UP, isRing, sharpenRim } from './mitwachsen-rim';
import { PAL_RING, RIM_COLORS, rimBlossoms } from './mitwachsen-rim-look';
import { standHeight, type World } from './mitwachsen-world';
import { BAHN_PACK, HOEHLE_PACK, SAMPLE_SEEDS, bareOf, seedRange, seedsFor, worldOf } from './test-worlds';

const R = 80;
const N8 = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const)).filter(([dx, dy]) => dx || dy);
const open = (c: Cell) => c.region === 'lichtung' && c.deco !== 'rock';
/** Liegt (x, y) in der Bucht eines Tors oder am Gleis: Dort bleibt der Rand, wie er war */
function kept(w: World, x: number, y: number): boolean {
  for (const { mid, out } of w.gates.values()) {
    const [dx, dy] = [x - mid[0], y - mid[1]];
    if (Math.abs(dx * out[1] - dy * out[0]) <= GATE_KEEP.across && dx * out[0] + dy * out[1] >= -GATE_KEEP.inward)
      return true;
  }
  for (let j = -RAIL_KEEP; j <= RAIL_KEEP; j++)
    for (let i = -RAIL_KEEP; i <= RAIL_KEEP; i++)
      if (w.cell(x + i, y + j).ride || w.cell(x + i, y + j).rail) return true;
  return false;
}

describe('Rand der Lichtung: Kante statt Treppe', () => {
  it.each(seedsFor(seedRange(1, 6)))(
    'Seed %i: innen Hecke, zwei Stufen über jedem Nachbarn, dahinter höherer Fels; kein Ringfeld mehr als Stufe',
    (seed) => {
      const w = worldOf(seed);
      let rims = 0;
      const bad: string[] = [];
      for (let y = -R; y <= R; y++)
        for (let x = -R; x <= R; x++) {
          const c = w.cell(x, y);
          if (!isRing(c)) {
            if (c.rim && !c.biome) bad.push(`Hecke ohne Fels ${x},${y}`); // `rim` mit Welt: Tiefeis der Eis-Welt (Issue 37)
            continue;
          }
          const beside = N8.map(([dx, dy]) => w.cell(x + dx, y + dy)).filter(open);
          if (kept(w, x, y)) {
            if (c.rim) bad.push(`Hecke in Bucht oder am Gleis ${x},${y}`);
            continue;
          }
          if (!beside.length) {
            if (c.rim) bad.push(`Hecke ohne Nachbar ${x},${y}`);
            continue;
          }
          rims++;
          if (!c.rim) bad.push(`keine Hecke ${x},${y}`);
          if (c.h !== Math.max(...beside.map((n) => n.h)) + RIM_UP) bad.push(`Höhe ${c.h} bei ${x},${y}`);
          if (!c.solid || standHeight(w, [], x, y) !== null) bad.push(`begehbar ${x},${y}`);
          // dahinter ragt der Fels über die Hecke
          for (const [dx, dy] of N8) {
            const n = w.cell(x + dx, y + dy);
            if (isRing(n) && !n.rim && !kept(w, x + dx, y + dy) && n.h < c.h + 1)
              bad.push(`Fels zu niedrig ${x + dx},${y + dy}`);
          }
        }
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
      expect(rims).toBeGreaterThan(250);
    },
  );

  it('die Welt bleibt begehbar wie zuvor: Der Rand war und bleibt fest, kein Feld der Lichtung ändert sich', () => {
    const w = bareOf(SAMPLE_SEEDS[0]!);
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const c = w.cell(x, y);
        if (c.rim) expect([c.deco, c.region, c.ground, c.solid]).toEqual(['rock', 'border', 'stone', true]);
        if (c.region === 'lichtung') expect(c.rim).toBeUndefined();
      }
  });

  it('am Gleis der Bahn und in den Buchten der Tore steht keine Hecke', () => {
    const w = worldOf(1, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 2 } });
    let rail = 0;
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const c = w.cell(x, y);
        if (c.rail) rail++;
        if (c.rim) expect(kept(w, x, y), `${x},${y}`).toBe(false);
      }
    expect(rail).toBeGreaterThan(10);
    for (const { mid } of w.gates.values()) expect(w.cell(...mid).rim).toBeUndefined();
  });

  it('sharpenRim an einem kleinen Beispiel: Hecke am Hügel höher, Wasser zählt als Nachbar, ohne Nachbarn nichts', () => {
    const rock = (h: number): Cell => ({ h, ground: 'stone', deco: 'rock', region: 'border', solid: true });
    const grass = (h: number): Cell => ({ h, ground: 'grass', deco: null, region: 'lichtung', solid: false });
    const map = new Map<string, Cell>();
    for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) map.set(`${x},${y}`, rock(3));
    map.set('0,0', grass(1));
    map.set('1,0', grass(3)); // Hügel am Rand: vorher ebenerdig mit dem Fels
    map.set('2,0', { ...grass(0), ground: 'water' });
    const rim = sharpenRim(map, []);
    expect(rim.map(([x, y]) => `${x},${y}`).sort()).toEqual(['0,1', '1,1', '2,1', '3,0', '3,1']);
    expect(map.get('0,1')).toMatchObject({ h: 5, rim: true }); // neben dem Hügel: 3 + 2
    expect(map.get('3,1')).toMatchObject({ h: 2, rim: true }); // nur das Wasser daneben: 0 + 2
    expect(map.get('3,0')!.h).toBe(2);
    expect(map.get('1,2')!.h).toBeGreaterThanOrEqual(6); // der Fels dahinter ragt über die Hecke
    expect(map.get('5,3')).toEqual(rock(3)); // weit weg: wie er war
    expect(map.get('1,0')).toEqual(grass(3)); // die Lichtung selbst bleibt
    // in der Bucht eines Tors bleibt alles, wie es war
    const bay = new Map<string, Cell>([
      ['0,0', grass(1)],
      ['0,1', rock(3)],
    ]);
    expect(sharpenRim(bay, [{ mid: [0, 2], out: [0, 1] }])).toEqual([]);
    expect(bay.get('0,1')).toEqual(rock(3));
  });
});

describe('Rand der Lichtung: Bild', () => {
  it('eigene Farben, die es auf begehbarem Boden nicht gibt; Blüten ohne Rot, fest aus der Lage', () => {
    const rock: Cell = { h: 4, ground: 'stone', deco: 'rock', region: 'border', solid: true };
    expect(mapColor({ ...rock, rim: true })).toBe(RIM_COLORS.map.hedge);
    expect(mapColor(rock)).toBe(RIM_COLORS.map.rock);
    const boulder: Cell = { h: 2, ground: 'stone', deco: null, region: 'lichtung', solid: false };
    expect(mapColor(boulder)).not.toBe(RIM_COLORS.map.rock);
    expect(mapColor({ ...rock, h: 1 })).not.toBe(RIM_COLORS.map.rock); // flache Reihen am Torhaus bleiben heller Stein
    expect(Object.keys(PAL_RING).sort()).toEqual(['S', 'r', 's']);
    let some = 0;
    for (let x = 0; x < 12; x++)
      for (let y = 0; y < 12; y++) {
        const b = rimBlossoms(x, y, 3);
        expect(rimBlossoms(x, y, 3)).toEqual(b);
        some += b.length;
        for (const [bx, by, bz, w, d, h, color] of b) {
          expect(bx).toBeGreaterThanOrEqual(x);
          expect(bx + w).toBeLessThanOrEqual(x + 1);
          expect(by + d).toBeLessThanOrEqual(y + 1.04);
          expect(bz + h).toBeLessThanOrEqual(3.1);
          expect(RIM_COLORS.blossoms as readonly string[]).toContain(color);
        }
      }
    expect(some).toBeGreaterThan(100);
    for (const c of RIM_COLORS.blossoms) expect(parseInt(c.slice(3, 5), 16)).toBeGreaterThan(0x90); // kein Rot: viel Grün darin
  });
});
