import { describe, expect, it } from 'vitest';
import { BEATS, VOX, parts, type GateCtx } from './mitwachsen-gate-kit';
import { SIGN_D, SIGN_Y, bands, build, flow, motion, treeAt, voxels, plate } from './mitwachsen-gate-lava';
import { checkPlate } from './test-plates';
import { GLOW, PALETTE } from '../../data/games/mitwachsen-portals';

const CAMS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
];
const ctx = (open: number, cam: readonly [number, number] = [0, 1]): GateCtx => ({ open, outline: false, lit: 0, cam });
const OPENS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** Ecken aller Flächen, je Teil: fest (`build`) oder bewegt (`motion` im Takt `beat`) */
function corners(g: GateCtx, beat?: number) {
  const p = parts();
  if (beat === undefined) build(p, g);
  else motion(p, g, beat);
  return Object.entries(p).flatMap(([part, geo]) => {
    if (geo.empty) return [];
    const pos = geo.build().getAttribute('position').array;
    const out: { part: string; x: number; y: number; z: number }[] = [];
    for (let i = 0; i < pos.length; i += 3) out.push({ part, x: pos[i]!, y: pos[i + 1]!, z: pos[i + 2]! });
    return out;
  });
}
/** Belegte Zellen im Bereich der Kaskade als Schlüssel */
function cells(has: (i: number, j: number, k: number) => boolean) {
  const out: string[] = [];
  for (let i = -24; i < 24; i++)
    for (let j = 0; j < 30; j++) for (let k = -24; k < 6; k++) if (has(i, j, k)) out.push(`${i},${j},${k}`);
  return out;
}

describe('Zugang der Lavaberge: Glutkaskade über Basaltstufen', () => {
  it('bleibt in jedem Zustand und jeder Lage unter der Voxel-Grenze, bewegt höchstens 1500 je Takt', () => {
    for (const cam of CAMS)
      for (const open of OPENS) {
        expect(voxels(ctx(open, cam)).size).toBeLessThanOrEqual(6000);
        for (let beat = 0; beat < BEATS; beat++) expect(bands(ctx(open, cam), beat).size).toBeLessThanOrEqual(1500);
      }
  });

  it('baut nichts in die Bucht (z > 0,5), auch nicht mit den Glutbändern', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1]) {
        expect(Math.max(...corners(ctx(open, cam)).map((c) => c.z))).toBeLessThanOrEqual(0.51);
        for (const beat of [0, 5, 11]) {
          const m = corners(ctx(open, cam), beat);
          if (m.length) expect(Math.max(...m.map((c) => c.z))).toBeLessThanOrEqual(0.51);
        }
      }
  });

  it('zu ist die Kaskade eine glühende Wand: höher als die Figur, quer über den ganzen Durchgang', () => {
    const v = voxels(ctx(0));
    for (const i of [-18, 0, 17]) {
      expect(v.has(i, 4, 0)).toBe(true); // Fall vor der untersten Stufe
      expect(v.has(i, 19, -14)).toBe(true); // Teich oben, 2,5 Felder hoch
    }
    const lava = corners(ctx(0)).filter((c) => c.part === 'bright' && Math.abs(c.x) < 2.3 && c.z < 0.5);
    expect(Math.max(...lava.map((c) => c.y))).toBeGreaterThan(2.5);
    expect(Math.min(...lava.map((c) => c.x))).toBeLessThan(-2.2);
    expect(Math.max(...lava.map((c) => c.x))).toBeGreaterThan(2.2);
  });

  it('offen ist der Durchgang frei: bis 3 Felder Höhe nur flache Platten (ein Voxel), auch hinter der Torreihe', () => {
    for (const cam of CAMS) {
      const inside = corners(ctx(1, cam)).filter(
        (c) => Math.abs(c.x) < 2.4 && c.z < 0.5 && c.y > 1 / VOX + 0.01 && c.y < 3,
      );
      expect(inside, `Lage ${cam.join(',')}`).toEqual([]);
      for (let beat = 0; beat < BEATS; beat++) expect(bands(ctx(1, cam), beat).size).toBe(0);
    }
  });

  it('erkaltet von oben Stufe für Stufe, dann sinken die Stufen zum flachen Weg ab', () => {
    const f = flow(0.3);
    expect(f.cool[3]).toBe(1); // oben erkaltet
    expect(f.cool[0]).toBe(0); // unten fließt es noch
    expect(f.sink).toBe(0);
    // Glutbänder nur noch auf den unteren Stufen
    const m = bands(ctx(0.3), 0);
    const js = cells((i, j, k) => m.has(i, j, k)).map((c) => Number(c.split(',')[1]));
    expect(js.length).toBeGreaterThan(0);
    expect(Math.max(...js)).toBeLessThanOrEqual(10);
    expect(voxels(ctx(0.5)).has(0, 19, -14)).toBe(true); // Stufen stehen noch
    expect(voxels(ctx(0.8)).has(0, 19, -14)).toBe(false); // sinken ab
    expect(flow(1).sink).toBe(1);
  });

  it('Glutbänder: Takt 16 schließt an Takt 0 an, und sie wandern weiter (nicht jeder Takt gleich)', () => {
    const key = (beat: number) => {
      const m = bands(ctx(0), beat);
      return cells((i, j, k) => m.has(i, j, k)).join(' ');
    };
    expect(key(BEATS)).toBe(key(0));
    expect(key(1)).not.toBe(key(0));
    expect(key(2)).not.toBe(key(0));
    expect(bands(ctx(0), 0).size).toBeGreaterThan(200);
  });

  it('bewegte und feste Teile teilen sich nie eine Zelle, in jeder Lage und jedem Zustand', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.2, 0.5, 1]) {
        const fixed = voxels(ctx(open, cam));
        for (let beat = 0; beat < BEATS; beat++) {
          const m = bands(ctx(open, cam), beat);
          const both = cells((i, j, k) => m.has(i, j, k) && fixed.has(i, j, k));
          expect(both, `Lage ${cam.join(',')}, offen ${open}, Takt ${beat}`).toEqual([]);
        }
      }
  });

  it('das Flammenzeichen schaut in jeder Lage zur Kamera, am Glutbaum neben dem Gang; die Krone ragt über den Ring', () => {
    for (const cam of CAMS) {
      const t = treeAt(cam);
      const v = voxels(ctx(0, cam));
      const [i, k] = [Math.round((t.x + cam[0] * SIGN_D) * VOX), Math.round((t.z + cam[1] * SIGN_D) * VOX)];
      const j = Math.round(SIGN_Y * VOX) + 6; // Mitte des Schilds
      expect(v.has(i, j, k), `Schild bei ${cam.join(',')}`).toBe(true);
      expect(v.has(i + cam[0], j, k + cam[1]), `davor frei bei ${cam.join(',')}`).toBe(false);
      expect(Math.abs(t.x)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...corners(ctx(0, cam)).map((c) => c.y))).toBeGreaterThan(6.5);
    }
  });
});

describe('Torplatte vor dem Zugang (lava)', () => {
  it('Basalt mit warm glimmenden Rissen in Orange und Gelb der Glut, kein Rot; flackert nicht, liegt in der Bucht, höchstens so viele Voxel', () => {
    expect(checkPlate('lava', plate)).toBeLessThanOrEqual(176);
    const cracks = new Set(plate.mark.join('').replace(/\./g, ''));
    expect([...cracks].sort()).toEqual(['R', 'r']);
    for (const c of cracks) expect(GLOW.has(c)).toBe(true); // sie glimmen
    expect([PALETTE.r, PALETTE.R]).toEqual(['#ff7a1a', '#ffd34d']); // warmes Orange und Gelb wie die Glut
  });
});
