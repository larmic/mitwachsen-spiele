import { describe, expect, it } from 'vitest';
import { VOX, parts, type GateCtx } from './mitwachsen-gate-kit';
import { build, treeAt, voxels } from './mitwachsen-gate-lava';

const CAMS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
];
const ctx = (open: number, cam: readonly [number, number] = [0, 1]): GateCtx => ({ open, outline: false, lit: 0, cam });

/** Ecken aller Flächen eines Zugangs, je Teil */
function corners(g: GateCtx) {
  const p = parts();
  build(p, g);
  return Object.entries(p).flatMap(([part, geo]) => {
    if (geo.empty) return [];
    const pos = geo.build().getAttribute('position').array;
    const out: { part: string; x: number; y: number; z: number }[] = [];
    for (let i = 0; i < pos.length; i += 3) out.push({ part, x: pos[i]!, y: pos[i + 1]!, z: pos[i + 2]! });
    return out;
  });
}

describe('Zugang der Lavaberge: erkaltender Glutbach unter dem Glutbaum', () => {
  it('bleibt in jedem Zustand und jeder Lage unter der Voxel-Grenze', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.3, 0.5, 0.7, 1]) expect(voxels(ctx(open, cam)).size).toBeLessThanOrEqual(6000);
  });

  it('baut nichts in die Bucht (z > 0,5)', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1]) {
        const z = Math.max(...corners(ctx(open, cam)).map((c) => c.z));
        expect(z).toBeLessThanOrEqual(0.51);
      }
  });

  it('offen ist der Durchgang über dem erkalteten Bach bis 3 Felder Höhe frei, auch hinter der Torreihe', () => {
    for (const cam of CAMS) {
      const inside = corners(ctx(1, cam)).filter((c) => Math.abs(c.x) < 2.4 && c.z < 0.5 && c.y > 0.26 && c.y < 3);
      expect(inside).toEqual([]);
    }
  });

  it('zu glüht der Bach quer durch die Torreihe, offen liegt dort Stein, eben mit dem Rand der Rinne', () => {
    const stone = (open: number) =>
      corners(ctx(open)).filter((c) => c.part === 'solid' && Math.abs(c.x) < 2.4 && Math.abs(c.z) < 0.2 && c.y < 1);
    expect(stone(0)).toEqual([]); // zu: nur Glut zwischen den Rändern
    expect(Math.max(...stone(1).map((c) => c.y))).toBeCloseTo(2 / VOX + 0.004, 3);
  });

  it('erkaltet von außen zur Mitte: halb offen sind die äußeren Felder Stein, die Mitte glüht noch', () => {
    const v = voxels(ctx(0.5));
    const raised = (i: number) => [-2, -1, 0, 1].filter((k) => v.has(i, 1, k)).length;
    expect(raised(-17)).toBe(4); // Oberseite des Steins im äußeren Feld
    expect(raised(-15)).toBe(4);
    expect(raised(1)).toBeLessThan(4); // in der Mitte noch flache Glut (höchstens ein Bläschen)
  });

  it('das Flammenzeichen schaut in jeder Lage zur Kamera, vor dem Baum neben dem Gang', () => {
    for (const cam of CAMS) {
      const t = treeAt(cam);
      const v = voxels(ctx(0, cam));
      const [i, k] = [Math.round((t.x + cam[0] * 1.125) * VOX), Math.round((t.z + cam[1] * 1.125) * VOX)];
      const j = Math.round(3.375 * VOX) + 6; // Mitte des Schilds
      expect(v.has(i, j, k), `Schild bei ${cam.join(',')}`).toBe(true);
      expect(v.has(i + cam[0], j, k + cam[1]), `davor frei bei ${cam.join(',')}`).toBe(false);
      expect(Math.abs(t.x)).toBeGreaterThanOrEqual(2.75);
    }
  });
});
