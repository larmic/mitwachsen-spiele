// Rand der Eis-Welt (Issue 37): innerste Reihe der Klippen als Tiefeis mit Zackenkamm, Höhen und Felder unverändert
import { describe, expect, it } from 'vitest';
import type { Cell } from '../../mitwachsen-cell';
import { mapColor } from '../../mitwachsen-map';
import { RIM_COLORS } from '../../mitwachsen-rim-look';
import { kesselPlace } from '../../mitwachsen-world';
import { EIS_PACK, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { DEEP_ICE, crestBoxes, markIceRim } from './mitwachsen-ice-rim';
import { view } from './view-2d';
import { view3d } from './view-3d';

const N8 = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const)).filter(([dx, dy]) => dx || dy);

describe('Rand der Eis-Welt: Tiefeis mit Zacken', () => {
  it.each(seedsFor(seedRange(1, 6)))(
    'Seed %i: jedes Klippenfeld mit begehbarem Nachbarn ist Tiefeis, sonst keins; fest wie zuvor',
    (seed) => {
      const w = worldOf(seed, [EIS_PACK]);
      const bad: string[] = [];
      let rims = 0;
      for (const [x, y] of kesselPlace(seed, EIS_PACK).cells) {
        const c = w.cell(x, y);
        const cliff = c.region === 'border' && c.deco === 'rock' && c.ground === 'ice' && !c.color;
        const beside = N8.some(([dx, dy]) => {
          const n = w.cell(x + dx, y + dy);
          return n.region === 'eis' && !n.solid;
        });
        if (!!c.rim !== (cliff && beside)) bad.push(`${x},${y}: rim ${!!c.rim}`);
        if (!c.rim) continue;
        rims++;
        if (!c.solid || c.h < 3) bad.push(`${x},${y}: nicht fest oder zu niedrig`);
      }
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
      expect(rims).toBeGreaterThan(200);
    },
  );

  it('markIceRim ändert nur das Merkmal: Höhen, Boden und der Eisfall bleiben', () => {
    const cliff = (h: number, more: Partial<Cell> = {}): Cell => ({
      h,
      ground: 'ice',
      deco: 'rock',
      region: 'border',
      solid: true,
      biome: 'eis',
      ...more,
    });
    const snow: Cell = { h: 1, ground: 'snow', deco: null, region: 'eis', solid: false, biome: 'eis' };
    const map = new Map<string, Cell>([
      ['0,0', snow],
      ['1,0', cliff(3)],
      ['2,0', cliff(4)],
      ['0,1', cliff(5, { color: '#abc' })], // Eisfall: behält sein Bild
      ['1,1', cliff(3)],
    ]);
    expect(
      markIceRim(
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 1],
          [1, 1],
        ],
        map,
      ).map((p) => p.join()),
    ).toEqual(['1,0', '1,1']);
    expect(map.get('1,0')).toEqual({ ...cliff(3), rim: true });
    expect(map.get('2,0')).toEqual(cliff(4));
    expect(map.get('0,1')).toEqual(cliff(5, { color: '#abc' }));
    expect(map.get('0,0')).toEqual(snow);
  });

  it('Bild: Tiefeis statt Schnee in 3D und 2D, Zacken nach oben mit heller Spitze, eigene Kartenfarbe', () => {
    const rim: Cell = { h: 3, ground: 'ice', deco: 'rock', region: 'border', solid: true, biome: 'eis', rim: true };
    const plain: Cell = { ...rim, rim: undefined };
    expect(view3d.ground(rim, [])).toMatchObject({
      tiles: ['ice', 'ice', 'ice'],
      top: DEEP_ICE.top,
      side: DEEP_ICE.side,
    });
    expect(view3d.ground(plain, [])!.tiles[0]).toBe('snowTop'); // dahinter liegt Schnee wie bisher
    expect(view.ground(rim, 4, 5, false)).toEqual([4, 5, 0, 1, 1, 3, DEEP_ICE.side, DEEP_ICE.top]);
    expect(view.ground(plain, 4, 5, false)).toBeNull();
    expect(mapColor(rim)).toBe(RIM_COLORS.map.ice);
    expect(crestBoxes(plain, 4, 5)).toEqual([]);
    for (let x = 0; x < 6; x++) {
      const boxes = crestBoxes(rim, x, 5);
      expect(boxes).toHaveLength(6); // drei Zacken, je Schaft und Spitze
      expect(crestBoxes(rim, x, 5)).toEqual(boxes);
      for (const [bx, by, bz, bw, bd, bh] of boxes) {
        expect(bx).toBeGreaterThanOrEqual(x);
        expect(bx + bw).toBeLessThanOrEqual(x + 1);
        expect(by).toBeGreaterThanOrEqual(5);
        expect(by + bd).toBeLessThanOrEqual(6);
        expect(bz).toBeGreaterThanOrEqual(3); // nach oben, nichts hängt herab (keine Zapfen)
        expect(bh).toBeGreaterThan(0);
      }
      expect(boxes.some((b) => b[7] === DEEP_ICE.tip)).toBe(true);
    }
    expect(
      view3d.decos.rock!(worldOf(1, [EIS_PACK]), rim, 1, 1, { now: 0, reduced: false, picked: {}, packs: {} }),
    ).toHaveLength(6);
  });
});
