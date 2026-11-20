import { describe, expect, it } from 'vitest';
import { VOX, parts } from './mitwachsen-gate-kit';
import { BOW_Y, build, rainbowRows, voxels } from './mitwachsen-gate-wolken';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const ctx = (open: number, cam: (typeof CAMS)[number]) => ({ open, outline: false, lit: 0, cam });

/** Alle Ecken der Flächen eines Zugangs (x, y, z) */
function corners(open: number, cam: (typeof CAMS)[number]) {
  const p = parts();
  build(p, ctx(open, cam));
  return Object.values(p).flatMap((g) => {
    if (g.empty) return [];
    const a = g.build().getAttribute('position').array;
    return Array.from({ length: a.length / 3 }, (_, i) => [a[i * 3]!, a[i * 3 + 1]!, a[i * 3 + 2]!] as const);
  });
}

describe('Zugang der Wolkenwelt: die schlafende Riesenwolke', () => {
  it('bleibt in jeder Lage und jedem Zustand unter der Grenze von 6000 Voxeln', () => {
    for (const cam of CAMS)
      for (let o = 0; o <= 10; o++) expect(voxels(ctx(o / 10, cam)).size, `${cam.join()} ${o}`).toBeLessThan(6000);
  });

  it('baut nichts in die Bucht (z > 0,5)', () => {
    for (const cam of CAMS)
      for (const o of [0, 0.5, 1]) expect(Math.max(...corners(o, cam).map((c) => c[2]))).toBeLessThan(0.51);
  });

  it('zu: versperrt den Durchgang und ragt deutlich über den Felsring', () => {
    for (const cam of CAMS) {
      const c = corners(0, cam);
      const inGap = c.filter(([x, y, z]) => Math.abs(x) < 1.5 && y < 2 && z > -0.5);
      expect(inGap.length).toBeGreaterThan(0);
      expect(Math.max(...c.map((v) => v[1]))).toBeGreaterThan(6);
    }
  });

  it('offen: der Durchgang ist bis 3 Felder Höhe frei, darüber steht der Regenbogen', () => {
    for (const cam of CAMS) {
      const v = voxels(ctx(1, cam));
      for (let i = Math.ceil(-2.4 * VOX); i < 2.4 * VOX; i++)
        for (let j = 0; j < 3 * VOX; j++)
          for (let k = -8 * VOX; k < 0.5 * VOX; k++) expect(v.has(i, j, k), `${cam.join()} ${i} ${j} ${k}`).toBe(false);
      const c = corners(1, cam);
      expect(c.some(([x, y]) => Math.abs(x) < 2.4 && y > BOW_Y + 3)).toBe(true);
    }
  });

  it('der Regenbogen wächst Band für Band von außen und ist ein Bogen', () => {
    const count = (n: number) => rainbowRows(n).join('').replace(/\./g, '').length;
    expect(count(0)).toBe(0);
    for (let n = 1; n <= 6; n++) expect(count(n)).toBeGreaterThan(count(n - 1));
    const rows = rainbowRows(6);
    expect(rows[0]!.trim()).toMatch(/0/); // oben das äußere Band
    expect(rows.at(-1)![rows.at(-1)!.length / 2]).toBe('.'); // unten in der Mitte frei
  });

  it('das Gesicht schaut in jeder Lage zur Kamera: die Augen liegen auf der Seite der Wolke, die zur Kamera zeigt', () => {
    for (const cam of CAMS)
      for (const o of [0, 1]) {
        const p = parts();
        build(p, ctx(o, cam));
        const geo = p.solid.build();
        const pos = geo.getAttribute('position').array,
          col = geo.getAttribute('color').array,
          nor = geo.getAttribute('normal').array;
        let toCam = 0;
        for (let v = 0; v < pos.length / 3; v++) {
          const dark = col[v * 3]! < 0.1 && col[v * 3 + 2]! < 0.2; // Augen, dunkelblau
          if (dark && nor[v * 3]! === cam[0] && nor[v * 3 + 2]! === cam[1]) toCam++;
        }
        expect(toCam, `${cam.join()} offen ${o}`).toBeGreaterThan(0);
      }
  });
});
