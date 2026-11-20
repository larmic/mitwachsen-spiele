import { describe, expect, it } from 'vitest';
import { VOX, parts } from './mitwachsen-gate-kit';
import { build, pilzVox, plopp } from './mitwachsen-gate-pilze';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** alle Voxel als (i, j, k) */
function cells(open: number, cam: (typeof CAMS)[number]) {
  const v = pilzVox({ open, cam });
  const out: [number, number, number][] = [];
  for (let k = -80; k < 8; k++)
    for (let j = 0; j < 72; j++) for (let i = -56; i < 56; i++) if (v.has(i, j, k)) out.push([i, j, k]);
  return { v, out };
}

describe('Zugang zum Pilzwald: der Pilzhut, der aufploppt', () => {
  it('nichts liegt in der Bucht (z > 0,5), in keinem Zustand und keiner Lage', () => {
    for (const cam of CAMS)
      for (const open of STEPS) {
        const p = parts();
        build(p, { open, cam, outline: false, lit: 0 });
        for (const g of Object.values(p)) {
          if (g.empty) continue;
          const pos = g.build().getAttribute('position').array;
          for (let n = 2; n < pos.length; n += 3) expect(pos[n]!, `offen ${open}`).toBeLessThanOrEqual(0.505);
        }
      }
  });

  it('zu sperrt der Hut den Durchgang, offen ist er bis 3 hoch frei (der Pilz steht in der Nische, |x| > 2,5)', () => {
    for (const cam of CAMS) {
      const closed = cells(0, cam).out.filter(([i, j, k]) => Math.abs(i) < 16 && j < 8 && k >= -8 && k < 4);
      expect(closed.length).toBeGreaterThan(200);
      const blocking = cells(1, cam).out.filter(([i, j]) => Math.abs((i + 0.5) / VOX) <= 2.45 && j < 3 * VOX);
      expect(blocking).toEqual([]);
    }
  });

  it('bleibt in jeder Lage und jedem Öffnungsgrad unter der Voxel-Grenze', () => {
    for (const cam of CAMS) for (const open of STEPS) expect(pilzVox({ open, cam }).size).toBeLessThan(6000);
  });

  it('der rote Pilz ist immer gedrungen: Hut mindestens dreimal so breit, wie der Stiel hoch ist', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const s = plopp(t);
      expect(2 * Math.min(s.hat.R1, s.hat.R2)).toBeGreaterThan(2.4 * s.hs);
      expect(s.hs).toBeLessThan(1.1);
    }
  });

  it('das Schild schaut zur Kamera: flach quer zur Blickrichtung', () => {
    for (const cam of CAMS) {
      const v = pilzVox({ open: 0, cam });
      // Mitte der obersten Schildreihe (Holzrahmen) liegt bei (3,5, −0,625); seitlich davon geht es weiter
      const [ci, ck] = [28, -5];
      const j = 5 + 11;
      expect(v.has(ci + cam[1] * 5, j, ck - cam[0] * 5)).toBe(true);
      expect(v.has(ci - cam[0] * 1, j, ck - cam[1] * 1)).toBe(false);
    }
  });
});
