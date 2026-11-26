// Spielorte in der Kristallgrotte (Issue 56): Leuchtpilze wecken, Kristalltürmchen bauen, Zahlen-Kristalle klingen, die
// Echo-Wand antwortet; ihr Zustand, ihr Bild, ihre Töne und ihre Lichtinseln. Die Lage über die Seeds prüft
// mitwachsen-grotte.test.ts
import { describe, expect, it } from 'vitest';
import { DIGITS } from '../../../../data/games/mitwachsen-digits';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { CAVE_PLACES } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import { mapColor } from '../../mitwachsen-map';
import { SIGHT_OF } from '../../mitwachsen-sight';
import { initialState, progressOf, step, type GameEvent, type State } from '../../mitwachsen-state';
import { kesselPlace, standHeight } from '../../mitwachsen-world';
import { HOEHLE_PACK, worldOf } from '../../test-worlds';
import { TOWER, awake, caveOf, towerAt } from './mitwachsen-cave-places';
import {
  CAVE_PLACE_COLORS,
  CAVE_PLACE_SIGHTS,
  ECHO_SCORE,
  SHROOM_SCORE,
  echoBoxes,
  echoGlow,
  glowBodies,
  shroomBoxes,
  stoneBoxes,
  stoneScore,
  towerBoxes,
  towerScore,
} from './mitwachsen-cave-places-look';
import { view } from './view-2d';
import { view3d } from './view-3d';

const world = worldOf(1, [HOEHLE_PACK]);
const RULES = [HOEHLE_PACK];
const CELLS = kesselPlace(1, HOEHLE_PACK).cells.map((p) => [p, world.cell(...p)] as const);
const of = (deco: Cell['deco']) => CELLS.filter(([, c]) => c.deco === deco).map(([p]) => p);
const [SHROOMS, HEAPS, ECHO] = [of('sleepshroom'), of('crystalheap'), of('echostone')];
const STONES = CELLS.filter(([, c]) => c.deco === 'numstone').sort((a, b) => a[1].note! - b[1].note!);
const PENTA = [0, 2, 4, 7, 9];
const penta = (hz: number) => PENTA.includes(((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12);
const gold = (boxes: readonly (readonly unknown[])[]) => boxes.some((b) => b[6] === GOLD.side || b[7] === GOLD.top);

/** Wach in der Grotte, links neben dem Feld (x, y), ohne Tiere */
function west(x: number, y: number, more: Partial<State> = {}): State {
  const s = initialState(world, {});
  return {
    ...s,
    sleeping: false,
    wokeAt: -100,
    openGates: ['eis', 'hoehle'],
    player: { x: x - 1, y, dir: 'e' },
    animals: [],
    ...more,
  };
}
const east = (s: State) => step(s, world, { type: 'move', dir: 'e', fresh: true }, undefined, undefined, RULES);
const events = <T extends GameEvent['type']>(all: readonly GameEvent[], type: T) =>
  all.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe('Spielorte der Grotte: Regeln', () => {
  it('Leuchtpilz: Hineinlaufen weckt ihn, die Figur bleibt stehen ohne „boing“; er bleibt wach und ist gespeichert', () => {
    const [x, y] = SHROOMS[0]!;
    const s = west(x, y);
    expect(awake(s.packs, x, y)).toBe(false);
    const r = east(s);
    expect(events(r.events, 'caveshroom')).toEqual([{ type: 'caveshroom', x, y }]);
    expect(events(r.events, 'bump')).toEqual([]);
    expect(r.state.player).toMatchObject({ x: x - 1, y });
    expect(awake(r.state.packs, x, y)).toBe(true);
    const saved = JSON.parse(JSON.stringify(progressOf(r.state))) as ReturnType<typeof progressOf>;
    expect(awake(saved.packs, x, y)).toBe(true);
    const again = east(r.state);
    expect(events(again.events, 'caveshroom')).toEqual([]);
    expect(events(again.events, 'bump')).toHaveLength(1); // schon wach: Sie stößt an wie an jedem Stein
    expect(again.state.packs).toBe(r.state.packs);
  });

  it('Kristalltürmchen: jedes Hineinlaufen eine Stufe, bis der Turm steht; danach stößt sie an; gespeichert', () => {
    const [x, y] = HEAPS[0]!;
    let s = west(x, y);
    const stages: number[] = [];
    for (let i = 0; i < TOWER; i++) {
      const r = east(s);
      stages.push(...events(r.events, 'cavetower').map((e) => e.stage));
      expect(events(r.events, 'bump')).toEqual([]);
      s = r.state;
    }
    expect(stages).toEqual([1, 2, 3]);
    expect(towerAt(s.packs, x, y)).toBe(TOWER);
    const done = east(s);
    expect(events(done.events, 'cavetower')).toEqual([]);
    expect(events(done.events, 'bump')).toHaveLength(1);
    expect(towerAt(JSON.parse(JSON.stringify(progressOf(s).packs)) as Record<string, unknown>, x, y)).toBe(TOWER);
    // Pilze und Türmchen teilen den Zustand der Höhlenwelt und verlieren einander nicht
    const [sx, sy] = SHROOMS[1]!;
    const both = east({ ...s, player: { x: sx - 1, y: sy, dir: 'e' } }).state;
    expect(caveOf(both.packs)).toEqual({ v: 1, lit: [`${sx},${sy}`], towers: { [`${x},${y}`]: TOWER } });
  });

  it('Echo-Wand: jedes Hineinlaufen antwortet, ohne „boing“ und ohne Spielstand', () => {
    const [x, y] = ECHO[0]!;
    const r = east(west(x, y));
    expect(events(r.events, 'echo')).toEqual([{ type: 'echo', x, y }]);
    expect(events(r.events, 'bump')).toEqual([]);
    expect(r.state.packs).toEqual({});
    expect(events(east(r.state).events, 'echo')).toHaveLength(1);
  });

  it('Zahlen-Kristall: klingt, wenn die Figur in seine Nähe kommt; sie läuft weiter; erst nach dem Weggehen wieder', () => {
    const [[x, y], cell] = STONES.find(([[sx, sy]]) =>
      [-3, -2, -1, 1, 2].every(
        (dx) => standHeight(world, ['hoehle'], sx + dx, sy) !== null && !world.cell(sx + dx, sy).deco,
      ),
    )!;
    let s = west(x - 2, y);
    const rings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = east(s);
      rings.push(events(r.events, 'numstone').length);
      for (const e of events(r.events, 'numstone')) expect(e).toEqual({ type: 'numstone', x, y, n: cell.note });
      expect(r.state.player.x).toBe(s.player.x + 1);
      s = r.state;
    }
    expect(rings).toEqual([0, 1, 0, 0, 0]);
    expect(s.packs).toEqual({});
    expect(mapColor(cell)).toBe(mapColor({ ...cell, deco: null })); // flach: Die Karte zeigt Boden
  });

  it('kaputte und alte Einträge: schlafende Pilze, bloße Haufen', () => {
    expect(caveOf({})).toEqual({ v: 1, lit: [], towers: {} });
    expect(caveOf({ hoehle: 'x' })).toEqual({ v: 1, lit: [], towers: {} });
    expect(caveOf({ hoehle: { lit: ['1,2', 5, 'a'], towers: { '3,4': 2, '5,6': 9, x: 1, '7,8': 1.5 } } })).toEqual({
      v: 1,
      lit: ['1,2'],
      towers: { '3,4': 2 },
    });
  });
});

describe('Spielorte der Grotte: Bild, Licht und Ton', () => {
  const cell = (deco: Cell['deco'], note?: number): Cell => ({
    h: 2,
    ground: 'grotto',
    deco,
    region: 'hoehle',
    solid: deco !== 'numstone',
    ...(note && { note }),
  });
  const inside = (boxes: readonly (readonly [number, number, number, number, number, number, ...unknown[]])[]) => {
    for (const [x, y, z, w, d, h] of boxes) {
      expect(x).toBeGreaterThanOrEqual(4);
      expect(x + w).toBeLessThanOrEqual(5 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(-3);
      expect(y + d).toBeLessThanOrEqual(-2 + 1e-9);
      expect(z).toBeGreaterThanOrEqual(2);
      expect(h).toBeGreaterThan(0);
    }
  };

  it('Leuchtpilz: schlafend matt, wach in einer Kristallfarbe und leuchtend; im Feld, ohne Gold', () => {
    const [asleep, lit] = [
      shroomBoxes(cell('sleepshroom'), 4, -3, false),
      shroomBoxes(cell('sleepshroom'), 4, -3, true),
    ];
    inside([...asleep, ...lit]);
    expect(asleep.some((b) => b[8] === 'glow')).toBe(false);
    expect(asleep.some((b) => b[6] === CAVE_PLACE_COLORS.asleep[0])).toBe(true);
    expect(lit.filter((b) => b[8] === 'glow').length).toBeGreaterThanOrEqual(2);
    expect(lit.some((b) => (CAVE_PLACE_COLORS.caps as readonly string[]).includes(b[6]))).toBe(true);
    expect(gold([...asleep, ...lit])).toBe(false);
  });

  it('Türmchen: mit jeder Stufe höher, nur das fertige leuchtet an der Spitze', () => {
    const tops = [0, 1, 2, 3].map((stage) => {
      const boxes = towerBoxes(cell('crystalheap'), 4, -3, stage);
      inside(boxes);
      expect(gold(boxes)).toBe(false);
      expect(boxes.some((b) => b[8] === 'glow')).toBe(stage === TOWER);
      return Math.max(...boxes.map((b) => b[2] + b[5]));
    });
    expect(tops.every((t, i) => i === 0 || t > tops[i - 1]!)).toBe(true);
    expect(tops[3]! - 2).toBeGreaterThan(1.3);
  });

  it('Zahlen-Kristall: flacher Stein mit seiner Ziffer obenauf, so viele Pixel wie das Zeichen; Echo-Wand: hoch und hell', () => {
    for (let n = 1; n <= 9; n++) {
      const boxes = stoneBoxes(cell('numstone', n), 4, -3);
      inside(boxes);
      expect(boxes.filter((b) => b[8] === 'glow')).toHaveLength(DIGITS[n]!.join('').split('#').length - 1);
      expect(Math.max(...boxes.map((b) => b[2] + b[5])) - 2).toBeLessThan(0.2); // flach: Man läuft darüber
    }
    const echo = echoBoxes(cell('echostone'), 4, -3);
    inside(echo);
    expect(Math.max(...echo.map((b) => b[2] + b[5])) - 2).toBeGreaterThan(1.2);
    expect(gold(echo)).toBe(false);
  });

  it('beide Ansichten zeichnen jedes Ding aus dem Zustand des Pakets', () => {
    const [sx, sy] = SHROOMS[0]!;
    const [hx, hy] = HEAPS[0]!;
    const packs = { hoehle: { v: 1, lit: [`${sx},${sy}`], towers: { [`${hx},${hy}`]: 2 } } };
    const at = { now: 0, reduced: false, picked: {}, packs } as never;
    for (const v of [view, view3d]) {
      expect(v.decos.sleepshroom!(world, world.cell(sx, sy), sx, sy, at)).toEqual(
        shroomBoxes(world.cell(sx, sy), sx, sy, true),
      );
      expect(v.decos.crystalheap!(world, world.cell(hx, hy), hx, hy, at)).toEqual(
        towerBoxes(world.cell(hx, hy), hx, hy, 2),
      );
      const [[nx, ny], stone] = STONES[4]!;
      expect(v.decos.numstone!(world, stone, nx, ny, at)).toEqual(stoneBoxes(stone, nx, ny));
      const [ex, ey] = ECHO[0]!;
      expect(v.decos.echostone!(world, world.cell(ex, ey), ex, ey, at)).toEqual(echoBoxes(world.cell(ex, ey), ex, ey));
    }
  });

  it('Lichtinseln: nur wache Pilze und fertige Türmchen nah an der Figur, je ein kleines Loch im Dunkel; nur in der Grotte', () => {
    const [sx, sy] = SHROOMS[0]!;
    const [hx, hy] = HEAPS[0]!;
    const far = SHROOMS.find(([x, y]) => Math.max(Math.abs(x - sx), Math.abs(y - sy)) > CAVE_PLACES.near)!;
    const s = west(sx, sy);
    expect(glowBodies(s, world)).toEqual([]);
    const lit = {
      ...s,
      packs: { hoehle: { v: 1, lit: [`${sx},${sy}`, far.join(',')], towers: { [`${hx},${hy}`]: 2 } } },
    };
    const bodies = glowBodies(lit, world);
    expect(bodies).toHaveLength(1); // der ferne Pilz und der halbe Turm nicht
    expect(bodies[0]).toMatchObject({ x: sx, y: sy - 1, beacon: true, parts: [] });
    expect(bodies[0]!.id.startsWith('ride:')).toBe(false);
    const built = { ...west(hx, hy), packs: { hoehle: { v: 1, lit: [], towers: { [`${hx},${hy}`]: TOWER } } } };
    expect(glowBodies(built, world).map((b) => [b.x, b.y])).toEqual([[hx, hy - 1]]);
    expect(glowBodies({ ...lit, player: { x: 0, y: 3, dir: 's' } }, world)).toEqual([]);
    expect(view.bodies!(lit, world, { now: 0, frac: 1, reduced: false, lit: false }).some((b) => b.beacon)).toBe(true);
    // die Echo-Wand hat immer ihr Licht, wenn die Figur nah ist
    const [ex, ey] = ECHO[0]!;
    expect(echoGlow(west(ex, ey), world)).toMatchObject([{ x: ex, y: ey - 1, beacon: true, parts: [] }]);
    expect(echoGlow({ ...west(ex, ey), player: { x: 0, y: 3, dir: 's' } }, world)).toEqual([]);
  });

  it('Töne in der Pentatonik, leise; das Echo kommt zweimal leiser zurück; die Ansicht spielt alle vier', () => {
    const all = [SHROOM_SCORE, ECHO_SCORE, ...[1, 2, 3].map(towerScore), ...[1, 5, 9].map(stoneScore)];
    for (const score of all) {
      expect(score.every(([hz]) => penta(hz))).toBe(true);
      expect(score.every(([, , , gain]) => gain <= 0.07)).toBe(true);
    }
    expect([1, 2, 3].map((n) => towerScore(n).length)).toEqual([1, 2, 4]);
    expect(stoneScore(9)[0]![0]).toBeGreaterThan(stoneScore(1)[0]![0]);
    const gains = [0, 2, 4].map((i) => ECHO_SCORE[i]![3]);
    expect(gains[0]! > gains[1]! && gains[1]! > gains[2]!).toBe(true);
    expect(view.score!({ type: 'caveshroom', x: 0, y: 0 })).toEqual(SHROOM_SCORE);
    expect(view.score!({ type: 'cavetower', x: 0, y: 0, stage: 2 })).toEqual(towerScore(2));
    expect(view.score!({ type: 'numstone', x: 0, y: 0, n: 4 })).toEqual(stoneScore(4));
    expect(view.score!({ type: 'echo', x: 0, y: 0 })).toEqual(ECHO_SCORE);
  });

  it('alle vier sind Sehenswürdigkeiten; gelockt wird nur zu schlafenden Pilzen und unfertigen Türmchen', () => {
    expect(HOEHLE_PACK.sights!.map((s) => s.id)).toEqual(
      expect.arrayContaining(['hoehle:leuchtpilze', 'hoehle:tuermchen', 'hoehle:zahlen', 'hoehle:echo']),
    );
    expect([SIGHT_OF.caveshroom, SIGHT_OF.cavetower, SIGHT_OF.numstone, SIGHT_OF.echo]).toEqual(
      CAVE_PLACE_SIGHTS.map((s) => s.id),
    );
    const [shrooms, towers] = CAVE_PLACE_SIGHTS as [
      (typeof CAVE_PLACE_SIGHTS)[number],
      (typeof CAVE_PLACE_SIGHTS)[number],
    ];
    const [sx, sy] = SHROOMS[0]!;
    const [hx, hy] = HEAPS[0]!;
    const s = {
      ...west(0, 0),
      found: [],
      packs: { hoehle: { v: 1, lit: [`${sx},${sy}`], towers: { [`${hx},${hy}`]: TOWER } } },
    } as never;
    expect(shrooms.cells(world, s)).toHaveLength(SHROOMS.length - 1);
    expect(shrooms.marks!(world, s)).toEqual([[sx, sy]]);
    expect(towers.cells(world, s)).toHaveLength(HEAPS.length - 1);
    expect(towers.marks!(world, s)).toEqual([[hx, hy]]);
  });
});
