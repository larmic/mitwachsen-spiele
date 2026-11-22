import { describe, expect, it } from 'vitest';
import { BEATS, parts, type Parts } from './mitwachsen-gate-kit';
import { build, level, model, motion, moving, wallTop, plate } from './mitwachsen-gate-wasser';
import { checkPlate } from './test-plates';
import { GLOW } from '../../data/games/mitwachsen-portals';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const ctx = (open: number, cam: readonly [number, number] = [0, 1]) => ({ open, outline: false, lit: 0, cam });

type Quad = { part: string; n: number[]; min: number[]; max: number[] };

/** Alle Flächen in `p` mit Normale und Grenzen (x, y, z) */
function quadsOf(p: Parts): Quad[] {
  return Object.entries(p).flatMap(([part, g]) => {
    if (g.empty) return [];
    const geo = g.build();
    const pos = geo.getAttribute('position').array,
      nor = geo.getAttribute('normal').array;
    const out: Quad[] = [];
    for (let v = 0; v < pos.length / 3; v += 4) {
      const pts = [0, 1, 2, 3].map((q) => [0, 1, 2].map((a) => pos[(v + q) * 3 + a]!));
      const axis = (a: number) => pts.map((pt) => pt[a]!);
      out.push({
        part,
        n: [nor[v * 3]!, nor[v * 3 + 1]!, nor[v * 3 + 2]!],
        min: [0, 1, 2].map((a) => Math.min(...axis(a))),
        max: [0, 1, 2].map((a) => Math.max(...axis(a))),
      });
    }
    return out;
  });
}
/** Flächen des festen Zugangs, mit `beat` auch die bewegten Teile in diesem Takt */
function quads(open: number, cam: readonly [number, number] = [0, 1], beat?: number): Quad[] {
  const p = parts();
  build(p, ctx(open, cam));
  if (beat !== undefined) motion(p, ctx(open, cam), beat);
  return quadsOf(p);
}

describe('Zugang zur Wasserwelt: Muschelbogen mit fließender Wasserwand', () => {
  it('bleibt in jeder Lage und jedem Schritt des Öffnens unter 6000 festen und 1500 bewegten Voxeln je Takt', () => {
    for (const cam of CAMS)
      for (const open of STEPS) {
        expect(model(ctx(open, cam)).size).toBeLessThanOrEqual(6000);
        for (let beat = 0; beat < BEATS; beat++) expect(moving(ctx(open, cam), beat).length).toBeLessThanOrEqual(1500);
      }
  });

  it('bewegte Zellen liegen nie in einer festen Zelle und nie doppelt (alle Lagen, zu, halb, offen, jeder Takt)', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1]) {
        const solid = model(ctx(open, cam));
        for (let beat = 0; beat < BEATS; beat++) {
          const cells = moving(ctx(open, cam), beat);
          expect(cells.filter(([i, j, k]) => solid.has(i, j, k))).toEqual([]);
          expect(new Set(cells.map(([i, j, k]) => `${i},${j},${k}`)).size).toBe(cells.length);
        }
      }
  });

  it('die Bewegung ist eine Schleife: Takt 16 gleicht Takt 0, und sie bewegt sich wirklich', () => {
    for (const cam of CAMS) {
      expect(moving(ctx(0, cam), BEATS)).toEqual(moving(ctx(0, cam), 0));
      expect(moving(ctx(0, cam), 1)).not.toEqual(moving(ctx(0, cam), 0));
    }
  });

  it('baut nichts in die Bucht (z > 0,5), auch nicht mit den bewegten Teilen', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1]) expect(Math.max(...quads(open, cam, 3).map((q) => q.max[2]!))).toBeLessThan(0.51);
  });

  it('zu füllt die Wand den ganzen Bogen bis oben, ohne Lücke', () => {
    for (const cam of CAMS) {
      const solid = model(ctx(0, cam));
      const cells = new Set(moving(ctx(0, cam), 0).map(([i, j]) => `${i},${j}`));
      for (let i = -22; i < 22; i++)
        for (let j = 0; j < wallTop(i, 1); j++) {
          let filled = cells.has(`${i},${j}`);
          for (let k = -8; k < 4 && !filled; k++) filled = solid.has(i, j, k);
          expect(filled, `Spalte ${i}, Zeile ${j}`).toBe(true);
        }
      expect(wallTop(0, 1)).toBeGreaterThanOrEqual(36); // gut 4,5 Felder hoch
    }
  });

  it('die Wand sinkt beim Öffnen stetig ins Becken; offen ist der Durchgang |x| ≤ 2,4 bis 3 Felder Höhe frei', () => {
    expect(level(0)).toBe(1);
    expect(level(1)).toBe(0);
    for (let n = 1; n < STEPS.length; n++)
      expect(wallTop(0, level(STEPS[n]!))).toBeLessThanOrEqual(wallTop(0, level(STEPS[n - 1]!)));
    for (const cam of CAMS) {
      expect(moving(ctx(1, cam), 0)).toEqual([]);
      const inside = quads(1, cam).filter((q) => q.min[0]! < 2.4 && q.max[0]! > -2.4 && q.min[2]! < 0.5);
      expect(inside.filter((q) => q.max[1]! > 0.15 && q.min[1]! < 3)).toEqual([]);
    }
  });

  it('das Tropfen-Schild ragt deutlich über den Ring und schaut zur Kamera', () => {
    for (const cam of CAMS) {
      const q = quads(0, cam);
      expect(Math.max(...q.map((f) => f.max[1]!))).toBeGreaterThan(7);
      const sign = q.filter((f) => f.part === 'bright' && f.min[1]! >= 5.8);
      const toward = sign.filter((f) => f.n[0] === cam[0] && f.n[2] === cam[1]);
      const area = (fs: Quad[]) => fs.reduce((s, f) => s + (f.max[0]! - f.min[0]! + f.max[2]! - f.min[2]!), 0);
      expect(area(toward)).toBeGreaterThan(5);
    }
  });
});

describe('Torplatte vor dem Zugang (wasser)', () => {
  it('Stegplanke mit Welle, die leuchtet wie Wasser; wippt leicht, sinkt einen Voxel ein; flackert nicht, liegt in der Bucht, höchstens so viele Voxel', () => {
    expect(checkPlate('wasser', plate)).toBeLessThanOrEqual(176); // eine Lage
    expect([plate.bob, plate.deep, plate.under]).toEqual([true, undefined, undefined]);
    expect(plate.mark.join('').replace(/\./g, '')).toMatch(/^v+$/); // die Welle
    expect(GLOW.has('v')).toBe(true);
  });
});
