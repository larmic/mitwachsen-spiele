import { describe, expect, it } from 'vitest';
import { parts } from './mitwachsen-gate-kit';
import { LIT, build, lighthouseAt, model, slide } from './mitwachsen-gate-wasser';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const ctx = (open: number, cam: readonly [number, number] = [0, 1]) => ({ open, outline: false, lit: 0, cam });

type Quad = { part: string; n: number[]; min: number[]; max: number[] };

/** Alle Flächen des Zugangs mit Normale und Grenzen (x, y, z) */
function quads(open: number, cam: readonly [number, number] = [0, 1]): Quad[] {
  const p = parts();
  build(p, ctx(open, cam));
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

describe('Zugang zur Wasserwelt: Lagune mit wachsendem Steg', () => {
  it('bleibt in jeder Lage und jedem Schritt des Öffnens unter 6000 Voxeln', () => {
    for (const cam of CAMS) for (const open of STEPS) expect(model(ctx(open, cam)).size).toBeLessThanOrEqual(6000);
  });

  it('baut nichts in die Bucht (z > 0,5)', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1]) expect(Math.max(...quads(open, cam).map((q) => q.max[2]!))).toBeLessThan(0.51);
  });

  it('offen ist der Durchgang |x| ≤ 2,4 bis 3 Felder Höhe frei, der Steg liegt flach (y ≤ 0,15)', () => {
    for (const cam of CAMS) {
      const inside = quads(1, cam).filter((q) => q.min[0]! < 2.4 && q.max[0]! > -2.4 && q.min[2]! < 0.5);
      expect(inside.filter((q) => q.max[1]! > 0.15 && q.min[1]! < 3)).toEqual([]);
    }
  });

  it('offen bedeckt der Steg den Gang bis z −3,5 über die ganze Breite, zu nur der Anleger in der Torreihe', () => {
    const deck = (open: number) => model(ctx(open)).has.bind(model(ctx(open)));
    const open = deck(1);
    for (let k = -28; k < 4; k += 4) expect(open(-20, 0, k) && open(19, 0, k) && open(0, 0, k)).toBe(true);
    const shut = deck(0);
    expect(shut(0, 0, -4)).toBe(true); // Anleger
    for (let k = -28; k < -4; k++) expect(shut(0, 0, k)).toBe(false); // dahinter nur Wasser
    expect(shut(0, -1, -10)).toBe(true);
  });

  it('die Bretter kommen eins nach dem anderen und liegen alle, bevor die Laternen leuchten', () => {
    for (let n = 1; n < 6; n++) expect(slide(0.1 + n * 0.13, n)).toBeLessThanOrEqual(slide(0.1 + n * 0.13, n - 1));
    for (let n = 0; n < 6; n++) expect(slide(LIT, n)).toBe(1);
    const lamps = (open: number) => quads(open).filter((q) => q.part === 'bright' && q.max[1]! < 1).length;
    expect(lamps(0.8)).toBe(0);
    expect(lamps(1)).toBeGreaterThan(0);
  });

  it('der Leuchtturm ragt über den Felsring, das Tropfen-Schild schaut zur Kamera', () => {
    for (const cam of CAMS) {
      const q = quads(0, cam);
      expect(Math.max(...q.map((f) => f.max[1]!))).toBeGreaterThan(6);
      const sign = q.filter((f) => f.part === 'bright' && f.min[1]! >= 3.2);
      const toward = sign.filter((f) => f.n[0] === cam[0] && f.n[2] === cam[1]);
      const area = (fs: Quad[]) => fs.reduce((s, f) => s + (f.max[0]! - f.min[0]! + f.max[2]! - f.min[2]!), 0);
      expect(area(toward)).toBeGreaterThan(5);
      // der Leuchtturm steht nicht zwischen Kamera und Gang (bei Lage links/rechts auf der abgewandten Seite)
      if (cam[0] !== 0) expect(Math.sign(lighthouseAt(cam)[0])).toBe(-cam[0]);
    }
  });
});
