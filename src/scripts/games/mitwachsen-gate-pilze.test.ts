import { describe, expect, it } from 'vitest';
import { BEATS, VOX, parts, type Vox } from './mitwachsen-gate-kit';
import { SIGN_AT, build, motion, motionVox, pilzVox } from './mitwachsen-gate-pilze';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** alle Voxel eines Rasters als (i, j, k) */
function cells(v: Vox) {
  const out: [number, number, number][] = [];
  for (let k = -80; k < 8; k++)
    for (let j = 0; j < 72; j++) for (let i = -56; i < 56; i++) if (v.has(i, j, k)) out.push([i, j, k]);
  return out;
}
/** Voxel, die offen im Durchgang (|x| ≤ 2,4) unter 3 Feldern Höhe liegen */
const blocking = (v: Vox) => cells(v).filter(([i, j]) => Math.abs((i + 0.5) / VOX) <= 2.45 && j < 3 * VOX);

/** größtes z aller Flächen */
function maxZ(p: ReturnType<typeof parts>) {
  let z = -Infinity;
  for (const g of Object.values(p)) {
    if (g.empty) continue;
    const pos = g.build().getAttribute('position').array;
    for (let n = 2; n < pos.length; n += 3) z = Math.max(z, pos[n]!);
  }
  return z;
}

describe('Zugang zum Pilzwald: das verwachsene Pilztor', () => {
  it('nichts liegt in der Bucht (z > 0,5), weder fest noch bewegt, in keinem Zustand und keiner Lage', () => {
    for (const cam of CAMS)
      for (const open of STEPS)
        for (const beat of [0, 5, 11]) {
          const p = parts();
          build(p, { open, cam, outline: false, lit: 0 });
          motion(p, { open, cam, outline: false, lit: 0 }, beat);
          expect(maxZ(p), `offen ${open}, Takt ${beat}`).toBeLessThanOrEqual(0.505);
        }
  });

  it('zu ist der Durchgang dicht verwachsen, in drei Lagen hintereinander (auch von der Seite sieht man es)', () => {
    for (const cam of CAMS)
      for (const beat of [0, 8]) {
        const inGap = [...cells(pilzVox({ open: 0, cam })), ...cells(motionVox({ open: 0, cam }, beat))].filter(
          ([i, j]) => Math.abs((i + 0.5) / VOX) < 2.4 && j < 3 * VOX,
        );
        expect(inGap.length).toBeGreaterThan(700);
        // Tiefe: vorn (z > 0), Mitte (−1 … 0) und hinten (z < −1) ist etwas
        for (const [k0, k1] of [
          [0, 4],
          [-8, 0],
          [-16, -8],
        ])
          expect(inGap.filter(([, , k]) => k >= k0! && k < k1!).length).toBeGreaterThan(80);
      }
  });

  it('offen ist der Durchgang bis 3 hoch frei, fest und in jedem Takt', () => {
    for (const cam of CAMS) {
      expect(blocking(pilzVox({ open: 1, cam }))).toEqual([]);
      for (let beat = 0; beat < BEATS; beat++) expect(blocking(motionVox({ open: 1, cam }, beat))).toEqual([]);
    }
  });

  it('bleibt unter der Voxel-Grenze: fest höchstens 6000, bewegt höchstens 1500 je Takt', () => {
    for (const cam of CAMS)
      for (const open of STEPS) {
        expect(pilzVox({ open, cam }).size).toBeLessThanOrEqual(6000);
        for (let beat = 0; beat < BEATS; beat++) expect(motionVox({ open, cam }, beat).size).toBeLessThanOrEqual(1500);
      }
  });

  it('bewegte Voxel liegen nie in einer Zelle des festen Rasters (alle Lagen, zu, halb, offen, jeder Takt)', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1]) {
        const solid = pilzVox({ open, cam });
        for (let beat = 0; beat < BEATS; beat++)
          expect(cells(motionVox({ open, cam }, beat)).filter(([i, j, k]) => solid.has(i, j, k))).toEqual([]);
      }
  });

  it('die Bewegung ist eine Schleife: Takt 16 ist Takt 0, und sie bewegt sich wirklich', () => {
    for (const cam of CAMS) {
      const at = (beat: number) => cells(motionVox({ open: 0, cam }, beat)).join(';');
      expect(at(BEATS)).toEqual(at(0));
      expect(at(-1)).toEqual(at(BEATS - 1));
      expect(at(BEATS / 2)).not.toEqual(at(0));
    }
  });

  it('wiegt sich ruhig: von Takt zu Takt ändert sich nur ein kleiner Teil der Ranken', () => {
    for (let beat = 0; beat < BEATS; beat++) {
      const a = new Set(cells(motionVox({ open: 0, cam: [0, 1] }, beat)).map((c) => c.join()));
      const b = cells(motionVox({ open: 0, cam: [0, 1] }, beat + 1)).map((c) => c.join());
      expect(b.filter((c) => !a.has(c)).length / b.length).toBeLessThan(0.35);
    }
  });

  it('das Schild schaut zur Kamera: flach quer zur Blickrichtung, nur wenn der Zugang nicht hinten liegt', () => {
    expect(cells(pilzVox({ open: 0, cam: [0, 1] })).filter(([i, j]) => Math.abs(i) >= 44 && j < 17)).toEqual([]);
    for (const cam of CAMS.filter((c) => c[1] <= 0)) {
      const v = pilzVox({ open: 0, cam });
      // Mitte der obersten Schildreihe (Holzrahmen) liegt bei (±5,75, −0,625); seitlich davon geht es weiter
      const [ci, ck] = [Math.round((cam[0] < 0 ? -1 : 1) * SIGN_AT.x * VOX), Math.round(SIGN_AT.z * VOX)];
      const j = 5 + 11;
      expect(v.has(ci + cam[1] * 5, j, ck - cam[0] * 5)).toBe(true);
      expect(v.has(ci - cam[0], j, ck - cam[1])).toBe(false);
    }
  });
});
