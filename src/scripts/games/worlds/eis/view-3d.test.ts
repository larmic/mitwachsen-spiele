import { describe, expect, it } from 'vitest';
import { ICE_COLORS } from '../../../../data/games/mitwachsen-eis';
import { drawDeco, type DecoAt } from '../../mitwachsen-view';
import type { Cell } from '../../mitwachsen-world';
import { EIS_PACK, worldOf } from '../../test-worlds';
import { view3d } from './view-3d';
import { gateLook } from './view-3d-gate';

const at: DecoAt = { now: 1234, reduced: false, picked: {} };
const world = worldOf(1);
/** Erstes Feld um das Bett einer Gegend (sonst im Kessel, um das Schneebett) mit dieser Deko-Art */
function find(deco: Cell['deco'], home: 'eis' | 'lichtung' = 'eis'): [number, number, Cell] {
  const [bx, by] = world.homes[home].bed;
  for (let y = by - 25; y <= by + 25; y++)
    for (let x = bx - 25; x <= bx + 25; x++) {
      const c = world.cell(x, y);
      if (c.deco === deco) return [x, y, c];
    }
  throw new Error(`keine ${deco}`);
}
const snow: Cell = { h: 2, ground: 'snow', deco: null, region: 'eis', solid: false, biome: 'eis' };

describe('3D-Teil des Welt-Pakets der Eis-Welt (view-3d.ts)', () => {
  it('kommt per import() aus dem Paket, erst wenn die 3D-Ansicht ihn will', async () => {
    expect(await EIS_PACK.view3d!()).toBe(view3d);
    expect(view3d.gate).toBe('eis');
    expect(view3d.look).toBe(gateLook);
  });

  it('Iglu, Eisschale, Eistrog und Fischkiste wie in 2D; in 3D zuckt keine Flosse, die Kiste leert sich beim Fangen', () => {
    for (const deco of ['igloo', 'icebowl', 'watertrough', 'fishcrate'] as const) {
      const [x, y, c] = find(deco);
      expect(c.biome, deco).toBe('eis');
      const boxes = drawDeco(view3d, world, c, x, y, at);
      expect(boxes, deco).not.toBeNull(); // das Paket baut es (beim Iglu zeichnet ein Feld das ganze)
      expect(boxes, deco).toEqual(drawDeco(EIS_PACK.view!, world, c, x, y, at0));
    }
    // Der Trog auf der Lichtung bleibt aus Holz: Das Paket sagt dazu nichts (null), die 3D-Ansicht baut ihn wie immer
    const [tx, ty, trough] = find('watertrough', 'lichtung');
    expect(trough.biome).toBeUndefined();
    expect(drawDeco(view3d, world, trough, tx, ty, at)).toBeNull();
    const [cx, cy, crate] = find('fishcrate');
    const full = drawDeco(view3d, world, crate, cx, cy, at)!;
    const empty = drawDeco(view3d, world, crate, cx, cy, { ...at, picked: { [`${cx},${cy}`]: 1 } })!;
    expect(full.length).toBeGreaterThan(empty.length);
    expect(full.some((b) => b[8] === 'sway')).toBe(true); // Schwanzflossen wiegen sich im Wind
  });

  it('Boden: Schnee und Eis im Kessel, die Rutschspur glänzt erst bei offenem Eistor, sonst wie auf der Lichtung', () => {
    expect(view3d.ground(snow, [])).toEqual({ tiles: ['snowTop', 'ice', 'ice'] });
    expect(view3d.ground({ ...snow, ground: 'stone', region: 'border' }, [])?.tiles[0]).toBe('snowTop'); // Klippen
    expect(view3d.ground({ ...snow, ground: 'stone' }, [])).toBeNull();
    const slide: Cell = { ...snow, slide: true };
    expect(view3d.ground(slide, [])?.tiles[0]).toBe('snowTop');
    expect(view3d.ground(slide, ['eis'])).toEqual({ tiles: ['ice', 'ice', 'ice'], top: ICE_COLORS.slide[1] });
    expect(view3d.ground({ ...snow, region: 'wild' }, ['eis'])).toBeNull(); // Schnee draußen in der Landschaft
    expect(view3d.ground({ ...snow, biome: undefined, region: 'lichtung' }, ['eis'])).toBeNull();
  });

  it('das Bett im Kessel ist aus Schnee, sonst sagt das Paket nichts (Holz)', () => {
    expect(view3d.bedFrame({ ...snow, deco: 'bed' })).toEqual([...ICE_COLORS.snow, 'white']);
    expect(view3d.bedFrame({ ...snow, deco: 'bed', biome: undefined, region: 'lichtung' })).toBeNull();
  });
});

const at0: DecoAt = { ...at, reduced: true }; // 2D bei reduzierter Bewegung: auch dort zuckt nichts
