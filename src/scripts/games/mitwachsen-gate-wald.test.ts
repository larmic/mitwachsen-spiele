import { describe, expect, it } from 'vitest';
import { parts } from './mitwachsen-gate-kit';
import { build, inArch, raster, plate } from './mitwachsen-gate-wald';
import { checkPlate } from './test-plates';
import { GLOW } from '../../data/games/mitwachsen-portals';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;

/** alle Ecken aller Teile als [x, y, z] */
function corners(open: number, cam: readonly [number, number] = [0, 1]) {
  const p = parts();
  build(p, { open, outline: false, lit: 0, cam });
  return Object.values(p).flatMap((g) => {
    if (g.empty) return [];
    const a = g.build().getAttribute('position').array;
    return Array.from({ length: a.length / 3 }, (_, i) => [a[i * 3]!, a[i * 3 + 1]!, a[i * 3 + 2]!] as const);
  });
}

describe('Zugang zum Wald: der Spechtbaum', () => {
  it('nichts liegt in der Bucht (z > 0,5), in keinem Zustand und keiner Lage', () => {
    for (const open of [0, 0.1, 0.5, 1])
      for (const cam of CAMS) expect(Math.max(...corners(open, cam).map((c) => c[2]))).toBeLessThan(0.55);
  });

  it('offen ist der Durchgang durch den Stamm frei (|x| ≤ 2,4 bis 3 Felder hoch), zu ist er von der Tür verschlossen', () => {
    for (const cam of CAMS) {
      // Quader: keine Ecke ragt in den Gang (sie sind kantig, ihre Ecken genügen)
      const inside = corners(1, cam).filter(([x, y, z]) => Math.abs(x) < 2.4 && y > 0.01 && y < 3 && z < 0.5);
      expect(inside).toEqual([]);
    }
    for (let j = 0; j < 24; j++)
      for (let i = -19; i < 19; i++) expect(raster({ open: 1, cam: [0, 1] }).has(i, j, 1)).toBe(false);
    const closed = raster({ open: 0, cam: [0, 1] });
    for (let j = 0; j < 30; j++)
      for (let i = -20; i < 20; i++) if (inArch(i, j)) expect(closed.has(i, j, 1), `${i},${j}`).toBe(true);
  });

  it('die Tür öffnet sich in drei Stücken: bei halb offen ist die Mitte weg, die rechte Bahn noch da', () => {
    const half = raster({ open: 0.5, cam: [0, 1] });
    expect(half.has(0, 5, 1)).toBe(false);
    expect(half.has(15, 5, 1)).toBe(true);
  });

  it('bleibt in jedem Zustand unter 6000 Voxeln', () => {
    for (const open of [0, 0.1, 0.2, 0.5, 0.9, 1])
      for (const cam of CAMS) expect(raster({ open, cam }).size).toBeLessThanOrEqual(6000);
  });

  it('das Blatt-Schild hängt auf der Seite zur Kamera', () => {
    for (const cam of CAMS) {
      const v = raster({ open: 0, cam });
      // Mitte des Schilds (helles Blatt) eine Zelle außerhalb des Stamms auf der Seite zur Kamera
      const at = {
        '0,1': [-27, 14, 3],
        '1,0': [36, 16, -9],
        '-1,0': [-37, 16, -9],
        '0,-1': [-28, 31, -19],
      }[cam.join(',')]!;
      expect(v.has(at[0]!, at[1]!, at[2]!), cam.join(',')).toBe(true);
    }
  });
});

describe('Torplatte vor dem Zugang (wald)', () => {
  it('Baumscheibe mit hellen Jahresringen, die sich spiegeln wie in einem echten Stamm; flackert nicht, liegt in der Bucht, höchstens so viele Voxel', () => {
    expect(checkPlate('wald', plate)).toBeLessThanOrEqual(176);
    expect(plate.mark).toEqual([...plate.mark].reverse());
    expect(plate.mark.map((r) => [...r].reverse().join(''))).toEqual(plate.mark);
    expect(GLOW.has('w')).toBe(false); // Holz leuchtet nicht
  });
});
