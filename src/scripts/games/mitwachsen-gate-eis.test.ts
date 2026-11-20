import { describe, expect, it } from 'vitest';
import { build, raster } from './mitwachsen-gate-eis';
import { parts, type GateCtx, type Parts } from './mitwachsen-gate-kit';

const CAMS = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
] as const;

/** Alle Vierecke eines Zugangs: Teil, Normale, Grenzen (min, max je Achse), Farbe */
function quads(p: Parts) {
  return Object.entries(p).flatMap(([part, g]) => {
    if (g.empty) return [];
    const geo = g.build();
    const pos = geo.getAttribute('position').array,
      nor = geo.getAttribute('normal').array,
      rgb = geo.getAttribute('color').array;
    const out = [];
    for (let v = 0; v < pos.length / 3; v += 4) {
      const pts = [0, 1, 2, 3].map((q) => [0, 1, 2].map((a) => pos[(v + q) * 3 + a]!));
      const lo = [0, 1, 2].map((a) => Math.min(...pts.map((p) => p[a]!)));
      const hi = [0, 1, 2].map((a) => Math.max(...pts.map((p) => p[a]!)));
      const color = [0, 1, 2].map((a) => rgb[v * 3 + a]!.toFixed(3)).join();
      out.push({ part, n: [nor[v * 3]!, nor[v * 3 + 1]!, nor[v * 3 + 2]!], lo, hi, color });
    }
    return out;
  });
}

function gateAt(g: GateCtx) {
  const p = parts();
  const wings = build(p, g);
  return { wings, q: quads(p) };
}

describe('Eistor: Eisschlucht mit Eisorgel', () => {
  it('bleibt in jedem Zustand und jeder Lage bei höchstens 6000 Voxeln', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1])
        for (const outline of [false, true])
          for (const lit of [0, 0.5, 1]) expect(raster({ open, outline, lit, cam }).size).toBeLessThanOrEqual(6000);
  });

  it('baut nichts in die Bucht (z > 0,55) und behält die Doppeltür samt Angel', () => {
    for (const cam of CAMS) {
      const { wings, q } = gateAt({ open: 0, outline: true, lit: 0, cam });
      expect(Math.max(...q.map((f) => f.hi[2]!))).toBeLessThanOrEqual(0.55);
      expect(wings).toHaveLength(2);
      expect(wings.map((w) => w.hinge[1])).toEqual([-0.75, -0.75]);
    }
  });

  it('offen ist der Durchgang frei: nichts außer den Türflügeln in |x| ≤ 2,4 bis 3 Felder hoch', () => {
    for (const cam of CAMS) {
      const { q } = gateAt({ open: 1, outline: false, lit: 1, cam });
      const inWay = q.filter((f) => f.lo[0]! < 2.4 && f.hi[0]! > -2.4 && f.lo[1]! < 3 && f.hi[1]! > 0.2);
      expect(inWay).toEqual([]);
    }
  });

  it('die Schneeflocke schaut als Schild zur Kamera, außer der Zugang liegt hinten (dort trägt sie der Bogen)', () => {
    const shield = (cam: readonly [number, number]) =>
      gateAt({ open: 0, outline: false, lit: 0, cam }).q.filter((f) => {
        const mid = [0, 2].map((a) => (f.lo[a]! + f.hi[a]!) / 2);
        const out = mid[0]! * cam[0] + mid[1]! * cam[1]; // so weit liegt die Fläche zur Kamera hin
        return f.part === 'bright' && f.lo[1]! > 6.7 && f.n[0] === cam[0] && f.n[2] === cam[1] && out > 0.9;
      });
    for (const cam of CAMS.slice(1)) expect(shield(cam).length, cam.join()).toBeGreaterThan(5);
    expect(shield([0, 1])).toEqual([]);
  });

  it('mit dem Ritual leuchten die Kerne der Orgel und die Eiszapfen auf, die Form bleibt', () => {
    const bright = (lit: number) =>
      gateAt({ open: 0, outline: true, lit, cam: [0, 1] }).q.filter((f) => f.part === 'bright' && f.lo[1]! > 4);
    const [dark, lit] = [bright(0), bright(1)];
    expect(lit.map((f) => f.lo.join())).toEqual(dark.map((f) => f.lo.join()));
    const changed = lit.filter((f, i) => f.color !== dark[i]!.color);
    expect(changed.some((f) => f.lo[1]! > 6.25)).toBe(true); // Orgel
    expect(changed.some((f) => f.hi[1]! < 4.75)).toBe(true); // Eiszapfen
  });
});
