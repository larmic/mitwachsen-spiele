import { describe, expect, it } from 'vitest';
import { parts, VOX } from './mitwachsen-gate-kit';
import { build, hoehleVox, openTop, stoneX } from './mitwachsen-gate-hoehle';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const STATES = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1];

/** alle Ecken aller Flächen, je Viereck gebündelt */
function quads(open: number, cam: readonly [number, number]) {
  const p = parts();
  build(p, { open, outline: false, lit: 0, cam });
  const out: number[][][] = [];
  for (const g of Object.values(p)) {
    if (g.empty) continue;
    const pos = g.build().getAttribute('position').array;
    for (let v = 0; v < pos.length; v += 12)
      out.push([0, 1, 2, 3].map((n) => [pos[v + n * 3]!, pos[v + n * 3 + 1]!, pos[v + n * 3 + 2]!]));
  }
  return out;
}

describe('Zugang zur Höhlenwelt: Höhlenmund mit Rollstein', () => {
  it('bleibt in jedem Zustand und jeder Lage unter etwa 6000 Voxeln', () => {
    for (const cam of CAMS)
      for (const open of STATES) expect(hoehleVox({ open, outline: false, lit: 0, cam }).size).toBeLessThan(6000);
  });

  it('baut nichts in die Bucht (z über 0,5)', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1])
        for (const q of quads(open, cam)) for (const [, , z] of q) expect(z).toBeLessThanOrEqual(0.505);
  });

  it('offen ist der Durchgang |x| ≤ 2,4 bis 3 hoch frei, zu steckt der Stein im Mund', () => {
    const inside = (q: number[][]) => {
      const lo = [0, 1, 2].map((a) => Math.min(...q.map((c) => c[a]!)));
      const hi = [0, 1, 2].map((a) => Math.max(...q.map((c) => c[a]!)));
      return hi[0]! > -2.4 && lo[0]! < 2.4 && hi[1]! > 0.01 && lo[1]! < 3 && lo[2]! < 0.5;
    };
    for (const cam of CAMS) {
      expect(quads(1, cam).filter(inside)).toEqual([]);
      expect(quads(0, cam).filter(inside).length).toBeGreaterThan(100);
    }
  });

  it('der Mund ist über dem ganzen Durchgang mindestens 3 hoch, der Stein rollt ganz in die Nische', () => {
    for (let x = -2.4; x <= 2.4; x += 1 / 16) expect(openTop(x)).toBeGreaterThanOrEqual(3);
    expect(stoneX(0)).toBe(0);
    expect(stoneX(1) - 1.875).toBeGreaterThanOrEqual(2.5);
    // offen: im Gang (|x| < 2,5) liegt über der Höhe von Lampen und Geröll kein Voxel, auch nicht vom Stein
    const v = hoehleVox({ open: 1, outline: false, lit: 0, cam: [0, 1] });
    for (let i = -20; i < 20; i++)
      for (let j = 8; j < 24; j++) for (let k = -26; k < 4; k++) expect(v.has(i, j, k)).toBe(false);
  });

  it('die Steinscheibe steht vor dem Wahrzeichen zur Kamera hin (liegt der Zugang hinten, fehlt sie)', () => {
    const at = (cam: readonly [number, number]) => {
      const v = hoehleVox({ open: 0, outline: false, lit: 0, cam });
      // Mitte der Scheibe: eine Höhe über der Brücke (5,5), zur Kamera versetzt
      const [i, k] = [Math.round(cam[0] * 1.25 * VOX), Math.round((-0.625 + cam[1]) * VOX)];
      return v.has(i, 44 + 5, k);
    };
    expect(at([0, 1])).toBe(false);
    for (const cam of CAMS.slice(1)) expect(at(cam)).toBe(true);
  });
});
