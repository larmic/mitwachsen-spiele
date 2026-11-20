import { describe, expect, it } from 'vitest';
import { parts } from './mitwachsen-gate-kit';
import { build, sandGate } from './mitwachsen-gate-sand';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const OPENS = [0, 0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 1];
const ctx = (open: number, cam: readonly [number, number] = [0, 1]) => ({ open, outline: false, lit: 0, cam });

/** Alle Ecken aller Flächen (x, y, z) eines gebauten Zugangs, dazu je Teil die Normalen */
function geometry(open: number, cam: readonly [number, number]) {
  const p = parts();
  build(p, ctx(open, cam));
  return Object.entries(p).flatMap(([part, g]) => {
    if (g.empty) return [];
    const geo = g.build();
    const pos = [...geo.getAttribute('position').array];
    const nor = [...geo.getAttribute('normal').array];
    return pos.flatMap((_, n) => (n % 3 === 0 ? [{ part, p: pos.slice(n, n + 3), n: nor.slice(n, n + 3) }] : []));
  });
}

/** Voxel im Durchgang (|x| < 2,5, z ≤ 0,5) zwischen Unterkante `j0` und 3 Feldern Höhe */
function inPassage(open: number, j0: number) {
  const v = sandGate(ctx(open));
  let n = 0;
  for (let j = j0; j < 24; j++) for (let k = -24; k < 4; k++) for (let i = -20; i < 20; i++) if (v.has(i, j, k)) n++;
  return n;
}

describe('Zugang zur Sandwelt (Sandsteinbogen)', () => {
  it('zu füllt die Düne den Durchgang, offen ist er bis 3 Felder hoch frei (nur flache Platten am Boden)', () => {
    expect(inPassage(0, 0)).toBeGreaterThan(500);
    expect(inPassage(1, 1)).toBe(0);
  });

  it('nichts liegt in der Bucht (z > 0,5), in keinem Zustand und aus keiner Richtung', () => {
    for (const cam of CAMS)
      for (const open of OPENS) {
        const z = Math.max(...geometry(open, cam).map((c) => c.p[2]!));
        expect(z, `offen ${open}, Kamera ${cam.join(',')}`).toBeLessThan(0.51);
      }
  });

  it('bleibt in der Voxel-Grenze, damit acht Zugänge auf alten Tablets flüssig bleiben', () => {
    for (const cam of CAMS) for (const open of OPENS) expect(sandGate(ctx(open, cam)).size).toBeLessThanOrEqual(6100);
  });

  it('die Sonnenscheibe oben auf dem Bogen schaut zur Kamera', () => {
    for (const cam of CAMS) {
      const sign = geometry(0, cam).filter((c) => c.part === 'bright' && c.p[1]! > 5.5);
      expect(sign.length).toBeGreaterThan(0);
      expect(sign.some((c) => c.n[0] === cam[0] && c.n[2] === cam[1])).toBe(true);
    }
  });

  it('die Sandfäden reißen beim Öffnen ab, die Mulde füllt sich mit Wasser', () => {
    const bright = (open: number) => geometry(open, [0, 1]).filter((c) => c.part === 'bright' && c.p[1]! < 5);
    expect(bright(0).length).toBeGreaterThan(0);
    expect(bright(0.3)).toEqual([]);
    const water = (open: number) => sandGate(ctx(open)).has(-25, 1, 1);
    expect(water(0)).toBe(false);
    expect(water(1)).toBe(true);
  });
});
