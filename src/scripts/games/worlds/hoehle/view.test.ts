import { describe, expect, it } from 'vitest';
import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { ARCH_PERCH } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import type { Cell } from '../../mitwachsen-cell';
import { drawDeco, type DecoAt, type Turn } from '../../mitwachsen-view';
import { HOEHLE_PACK, worldOf } from '../../test-worlds';
import { SHED_H, band, caveBoxes, glowOver } from './mitwachsen-cave-look';
import { TURN_MS, view } from './view-2d';
import { view3d } from './view-3d';

const w = worldOf(1, [HOEHLE_PACK]);
const at: DecoAt = { now: 0, reduced: false, picked: {}, packs: {} };
const cell = (deco: Cell['deco'], extra: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grotto',
  deco,
  region: 'hoehle',
  solid: true,
  biome: 'hoehle',
  ...extra,
});

describe('Dinge der Kristallgrotte, gleich für 2D und 3D', () => {
  it('jede Deko-Art der Grotte hat Quader, in 2D und 3D dieselben', () => {
    for (const deco of [
      'shroombowl',
      'stonetrough',
      'cavelamp',
      'column',
      'crystalarch',
      'glowshroom',
      'shroombed',
      'dripspring',
      'dripmoss',
    ] as const) {
      const c = cell(deco, { note: 2, color: '#6fd6f0' });
      const boxes = caveBoxes(w, c, 5, 7)!;
      expect(boxes.length, deco).toBeGreaterThan(0);
      expect(drawDeco(view, w, c, 5, 7, at), deco).toEqual(boxes);
      expect(drawDeco(view3d, w, c, 5, 7, at), deco).toEqual(boxes);
      for (const b of boxes) expect(b[2], deco).toBeGreaterThanOrEqual(1); // nichts unter dem Boden
    }
    expect(caveBoxes(w, cell('tree'), 0, 0)).toBeNull();
  });

  it('Pilzbeet voll, bis es abgeerntet ist (`picked`), dann leer, in 2D und 3D gleich; Tropfmoos flach, am Steintrog ein Büschel; nirgends Gold', () => {
    const c = cell('shroombed', { ground: 'grass' });
    const full = drawDeco(view, w, c, 5, 7, at)!;
    const empty = drawDeco(view, w, c, 5, 7, { ...at, picked: { '5,7': 0 } })!;
    expect(full).toEqual(caveBoxes(w, c, 5, 7, true));
    expect(empty).toEqual(caveBoxes(w, c, 5, 7, false));
    expect(drawDeco(view3d, w, c, 5, 7, { ...at, picked: { '5,7': 0 } })).toEqual(empty);
    expect(drawDeco(view, w, c, 5, 7, { ...at, picked: { '6,7': 0 } })).toEqual(full); // ein anderes Beet ist leer
    const top = (boxes: readonly (readonly number[] | readonly unknown[])[]) =>
      Math.max(...boxes.map((b) => (b[2] as number) + (b[5] as number)));
    expect(top(full)).toBeGreaterThan(top(empty)); // die Pilze stehen über dem Rand
    expect(top(caveBoxes(w, cell('dripmoss', { solid: false }), 0, 0)!)).toBeLessThan(1.2); // begehbar, flach
    const trough = caveBoxes(w, cell('stonetrough'), 0, 0)!;
    expect(trough.some((b) => b[6] === GROTTE_COLORS.moss[0])).toBe(true); // Tropfmoos am Rand
    const gold: unknown[] = Object.values(GOLD);
    for (const deco of ['shroombed', 'dripspring', 'dripmoss', 'stonetrough', 'shroombowl'] as const) {
      const colors = [true, false].flatMap((f) => caveBoxes(w, cell(deco), 0, 0, f)!.flatMap((b) => [b[6], b[7]]));
      expect(
        colors.filter((x) => gold.includes(x)),
        deco,
      ).toEqual([]);
    }
  });

  it('Kristallbogen: Pfeiler nur an den Enden, der Bogen läuft über alle fünf; Säulen so hoch wie ihre Note', () => {
    const pillar = caveBoxes(w, cell('crystalarch', { note: 0 }), 0, 0)!;
    const span = caveBoxes(w, cell('crystalarch', { note: 2 }), 0, 0)!;
    expect(pillar.length).toBe(span.length + 1);
    expect(Math.min(...span.map((b) => b[2]))).toBeGreaterThanOrEqual(4); // darunter geht man durch
    // die Unterkante des Bogens ist der Sitzplatz der Fledermäuse (`Cell.perch`): sie hängen genau darunter
    expect(Math.min(...span.map((b) => b[2]))).toBe(1 + ARCH_PERCH);
    const column = caveBoxes(w, cell('column', { note: 5 }), 0, 0)!;
    expect(Math.max(...column.map((b) => b[2] + b[5]))).toBeCloseTo(6); // Boden 1 + Höhe 5
  });

  it('Stalagmiten in drei Höhen, draußen in der Landschaft wie immer', () => {
    const tops = [0, 1, 2].map((note) => {
      const boxes = caveBoxes(w, cell('stalagmite', { note }), 0, 0)!;
      return Math.max(...boxes.map((b) => b[2] + b[5]));
    });
    expect(tops[0]).toBeLessThan(tops[1]!);
    expect(tops[1]).toBeLessThan(tops[2]!);
    expect(caveBoxes(w, cell('stalagmite', { region: 'wild' }), 0, 0)).toBeNull();
  });

  it('Unterstand am Bett: jedes Feld der Rückwand ist Kristallwand, die Mitte trägt Dach (vor der Figur durchsichtig) und Pfosten', () => {
    const home = w.homes.hoehle;
    const [sx, sy] = home.shelterStem;
    const side = caveBoxes(w, w.cell(sx - 1, sy), sx - 1, sy)!;
    const mid = caveBoxes(w, w.cell(sx, sy), sx, sy)!;
    expect(side.length).toBe(2);
    expect(mid.length).toBe(5);
    const roof = mid.find((b) => b[8] === 'see')!;
    expect(roof[2]).toBe(1 + SHED_H);
    expect(roof[0]).toBeLessThan(home.shelter.x0);
    expect(roof[0] + roof[3]).toBeGreaterThan(home.shelter.x1 + 1);
    expect(roof[1] + roof[4]).toBeCloseTo(home.shelter.y1 + 1);
  });
});

describe('Zeichenteile der Grotte (2D)', () => {
  it('Lichtfleck als helles Licht obenauf, sonst nichts; kein Wetter, kein Gast, keine Töne am Tor', () => {
    const lit = view.ground(cell(null, { light: 0.3 }), 2, 3, false)!;
    expect(lit.slice(0, 6)).toEqual([2, 3, 1, 1, 1, 0.01]);
    expect(lit[6]).toBe(glowOver(0.3));
    expect(glowOver(0.9)).toBe('rgba(255, 246, 220, 0.45)'); // nie grell
    expect(view.ground(cell(null), 2, 3, false)).toBeNull();
    expect(view.sky.guestAt(w, {} as never)).toBeNull();
    expect(view.sky.gateScore()).toEqual([]);
    expect(view.heaven).toEqual(GROTTE_COLORS.heaven);
  });

  it('die Leiste klappt beim Wechsel der Gegend um (bei reduzierter Bewegung sofort)', () => {
    const t: Turn = {};
    expect(view.sky.turnAlbum(t, 'lichtung', 0, false)).toEqual(['lichtung', 1]);
    expect(view.sky.turnAlbum(t, 'hoehle', 1000, false)).toEqual(['lichtung', 1]);
    expect(view.sky.turnAlbum(t, 'hoehle', 1000 + TURN_MS / 4, false)).toEqual(['lichtung', 0.5]);
    expect(view.sky.turnAlbum(t, 'hoehle', 1000 + TURN_MS, false)).toEqual(['hoehle', 1]);
    expect(view.sky.turnAlbum({ shown: 'lichtung', at: 0 }, 'hoehle', 1, true)).toEqual(['hoehle', 1]);
  });

  it('Zeichen der Gegend: Kristall der Grotte, Blatt der Lichtung, sonst keins', () => {
    const drawn: string[] = [];
    const ctx = {
      set fillStyle(c: string) {
        drawn.push(c);
      },
      fillRect: () => {},
    } as unknown as CanvasRenderingContext2D;
    view.sky.realmSign(ctx, 'hoehle', 50, 50, 16);
    expect(drawn).toContain(GROTTE_COLORS.crystals[0]);
    drawn.length = 0;
    view.sky.realmSign(ctx, 'eis', 50, 50, 16);
    expect(drawn).toEqual([]);
  });
});

describe('3D-Teil der Grotte', () => {
  it('Grottenstein in den Schichten, Lichtflecken auch auf Moos; Landschaft draußen bleibt, wie sie ist', () => {
    const floor = view3d.ground(cell(null, { solid: false, light: 0.2 }), [])!;
    expect(floor).toMatchObject({ top: GROTTE_COLORS.floor[1], side: band(1), light: 0.2 });
    const wall = view3d.ground(cell('rock', { region: 'border', h: 4 }), [])!;
    expect(wall).toMatchObject({ top: GROTTE_COLORS.bands[0], side: band(4) });
    expect(view3d.ground(cell(null, { ground: 'grass', light: 0.3 }), [])).toMatchObject({ light: 0.3 });
    expect(view3d.ground(cell(null, { ground: 'grass' }), [])).toBeNull();
    expect(view3d.ground(cell(null, { region: 'wild' }), [])).toBeNull();
    expect(view3d.ground(cell(null, { biome: 'eis' }), [])).toBeNull();
    expect(view3d.bedFrame(cell('bed'))).toBeNull();
  });

  it('Höhlenhimmel und Nebel-Maske nur in der Grotte; das Höhlentor hat keine Flügel', () => {
    expect(view3d.air).toEqual({ realm: 'hoehle', sky: GROTTE_COLORS.sky, mist: GROTTE_COLORS.mist });
    expect(view3d.gate).toBe('hoehle');
    expect(view3d.look.door(1, false, 0)).toEqual([]);
    expect(view3d.look.icicle(0, 0)).toBe('#ffffff');
  });
});
