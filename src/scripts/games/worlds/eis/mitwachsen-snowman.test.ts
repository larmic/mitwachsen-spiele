import { describe, expect, it } from 'vitest';
import type { Dir } from '../../../../lib/games/front';
import { initialState, progressOf, step, type GameEvent, type State } from '../../mitwachsen-state';
import { kesselPlace } from '../../mitwachsen-world';
import { migrate, newWorld, progressFrom, withProgress } from '../../mitwachsen-save';
import { stops } from '../../input-pace';
import { reshapes } from '../../mitwachsen-chores';
import { EIS_PACK, PACKS, worldOf } from '../../test-worlds';
import { SNOWMAN, snowOf, stageAt } from './mitwachsen-snowman';
import { snowBoxes, snowScore, wobble } from './mitwachsen-snowman-look';
import { SNOWMAN_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import { ICE_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';

const world = worldOf(1);
/** Die Schneehaufen im Tal von Seed 1 */
const HEAPS = kesselPlace(1, EIS_PACK).cells.filter(([x, y]) => world.cell(x, y).deco === 'snowheap');
const [HX, HY] = HEAPS[0]!;

/** Wach, Eistor offen, die Figur steht vor dem ersten Schneehaufen (südlich davon) und schaut zu ihm */
function before(saved: Partial<Parameters<typeof initialState>[1]> = {}): State {
  const s = initialState(world, { openGates: ['eis'], ...saved });
  return { ...s, sleeping: false, wokeAt: -100, player: { x: HX, y: HY + 1, dir: 'n' } };
}
/** Pfeil in Richtung `dir` mit den Regeln aus den Paketen */
const walk = (s: State, dir: Dir = 'n') => step(s, world, { type: 'move', dir }, undefined, undefined, PACKS);

describe('Schneemänner bauen (Eis-Welt)', () => {
  it('jedes Hineinlaufen lässt eine Kugel wachsen, beim dritten Mal steht der Schneemann; die Figur bleibt stehen', () => {
    let s = before();
    expect(stageAt(s.packs, HX, HY)).toBe(0);
    const seen: GameEvent[] = [];
    for (let stage = 1; stage <= SNOWMAN; stage++) {
      const r = walk(s);
      s = r.state;
      expect(r.events).toContainEqual({ type: 'snowman', x: HX, y: HY, stage });
      expect(stops(r.events)).toBe('pause'); // eine Begegnung: kurz stehen bleiben
      expect([s.player.x, s.player.y]).toEqual([HX, HY + 1]);
      expect(stageAt(s.packs, HX, HY)).toBe(stage);
      seen.push(...r.events);
    }
    expect(seen.filter((e) => e.type === 'snowman')).toHaveLength(SNOWMAN);
  });

  it('kein Fehler, kein Ende: Am fertigen Schneemann stößt die Figur sanft an, er bleibt, wie er ist', () => {
    let s = before();
    for (let i = 0; i < SNOWMAN; i++) s = walk(s).state;
    for (let i = 0; i < 5; i++) {
      const r = walk(s);
      expect(r.events).toEqual([{ type: 'bump' }]);
      s = r.state;
    }
    expect(stageAt(s.packs, HX, HY)).toBe(SNOWMAN);
    expect([s.player.x, s.player.y]).toEqual([HX, HY + 1]);
    expect(world.cell(HX, HY).solid).toBe(true); // fest wie ein Busch, in jeder Stufe
  });

  it('wächst nur an Schneehaufen; ohne die Regeln des Pakets ist der Haufen nur fest', () => {
    const s = before();
    const r = step(s, world, { type: 'move', dir: 'n' }); // ohne `rules`
    expect(r.events).toEqual([{ type: 'bump' }]);
    expect(r.state.packs).toEqual({});
    // andere Haufen bleiben, wie sie sind
    const t = walk(s).state;
    for (const [x, y] of HEAPS.slice(1)) expect(stageAt(t.packs, x, y)).toBe(0);
  });

  it('an Busch, Stein, Fischkiste und Co. ändern die Regeln des Pakets nichts: kein Schneemann, `packs` bleibt', () => {
    const s = before();
    // jedes feste Ding im Tal außer den Schneehaufen, das man von Süden anlaufen kann
    const things = kesselPlace(1, EIS_PACK).cells.filter(([x, y]) => {
      const c = world.cell(x, y);
      return c.solid && c.deco !== 'snowheap' && !world.cell(x, y + 1).solid;
    });
    expect(things.length).toBeGreaterThan(5);
    for (const [x, y] of things.slice(0, 40)) {
      const r = walk({ ...s, player: { x, y: y + 1, dir: 'n' } });
      expect(
        r.events.some((e) => e.type === 'snowman'),
        `${x},${y}`,
      ).toBe(false);
      expect(r.state.packs).toBe(s.packs);
    }
  });

  it('folgende Tiere drehen sich nicht um, wenn eine Kugel wächst (sie schauen ohnehin her)', () => {
    const s = before();
    const a = s.animals[0]!;
    const follower = { ...a, x: HX + 2, y: HY + 1, dir: 'e' as Dir, mode: 'follow' as const, rest: 0 };
    const r = walk({ ...s, animals: [follower] });
    expect(r.events).toContainEqual({ type: 'snowman', x: HX, y: HY, stage: 1 });
    expect(r.state.animals[0]!.rest).toBe(0);
    expect(r.state.animals[0]!.mode).toBe('follow');
  });

  it('die 3D-Ansicht baut nur nach Pflücken, Fangen, Nachwachsen und Schneemann ein Stück neu', () => {
    const types = ['pick', 'catch', 'regrow', 'snowman', 'fill', 'feed', 'pour', 'bump', 'step'];
    expect(types.filter((type) => reshapes({ type }))).toEqual(['pick', 'catch', 'regrow', 'snowman']);
  });

  it('Tiere ringsum drehen sich um und schauen zu', () => {
    const s = before();
    const a = s.animals[0]!;
    const near = { ...s, animals: [{ ...a, x: HX + 2, y: HY + 1, dir: 'e' as Dir, mode: 'wander' as const, rest: 1 }] };
    const r = walk(near);
    expect(r.state.animals[0]!.dir).toBe('w');
    expect(r.state.animals[0]!.rest).toBeGreaterThanOrEqual(20);
  });

  it('der alte Zustand bleibt unberührt (rein)', () => {
    const s = before();
    const packs = s.packs;
    walk(s);
    expect(s.packs).toBe(packs);
    expect(stageAt(s.packs, HX, HY)).toBe(0);
  });

  it('gebaute Schneemänner und halbe überstehen Speichern und Laden', () => {
    let s = before();
    for (let i = 0; i < SNOWMAN; i++) s = walk(s).state;
    const [x2, y2] = HEAPS[1]!;
    s = walk({ ...s, player: { x: x2, y: y2 + 1, dir: 'n' } }).state;
    const saved = migrate(JSON.parse(JSON.stringify(withProgress(newWorld('a', 1, 'X'), progressOf(s)))))!;
    const back = initialState(world, progressFrom(saved));
    expect(stageAt(back.packs, HX, HY)).toBe(SNOWMAN);
    expect(stageAt(back.packs, x2, y2)).toBe(1);
  });

  it('alter Stand ohne Zustand der Pakete lädt: lauter Haufen, und bauen geht', () => {
    const old = { ...newWorld('a', 1, 'X'), openGates: ['eis'] } as Record<string, unknown>;
    delete old.packs;
    const saved = migrate(old)!;
    expect(saved.packs).toEqual({});
    const s = before(progressFrom(saved));
    for (const [x, y] of HEAPS) expect(stageAt(s.packs, x, y)).toBe(0);
    expect(stageAt(walk(s).state.packs, HX, HY)).toBe(1);
  });
});

describe('Zustand der Eis-Welt im Spielstand (Migration im Paket)', () => {
  it('ohne Eintrag oder kaputt: lauter Haufen', () => {
    for (const eis of [undefined, null, 3, 'x', [], { snow: 'x' }, { snow: [1, 2] }, { v: 1 }])
      expect(snowOf({ eis })).toEqual({});
  });

  it('behält gültige Stufen, verwirft fremde Felder und Stufen außerhalb 1 … 3', () => {
    const eis = { v: 1, snow: { '3,4': 2, '-5,7': 3, '1,1': 0, '2,2': 4, '4,4': 1.5, x: 1, '6,6': '2' } };
    expect(snowOf({ eis })).toEqual({ '3,4': 2, '-5,7': 3 });
  });

  it('der Kern trägt den Eintrag unverändert, auch wenn er ihn nicht kennt', () => {
    const packs = { eis: { v: 1, snow: { '3,4': 2 } }, sand: { morgen: true } };
    const saved = migrate({ ...newWorld('a', 1, 'X'), packs })!;
    expect(saved.packs).toEqual(packs);
    expect(migrate({ ...newWorld('a', 1, 'X'), packs: [1] })!.packs).toEqual({});
  });
});

describe('Bild und Klang der Schneemänner', () => {
  it('wächst Stufe um Stufe; erst der fertige Schneemann hat Möhrennase und Mütze', () => {
    const top = (stage: number) => Math.max(...snowBoxes(0, 0, 1, stage).map((b) => b[2] + b[5]));
    expect(top(1)).toBeGreaterThan(top(0));
    expect(top(2)).toBeGreaterThan(top(1));
    expect(top(3)).toBeGreaterThan(top(2));
    const carrot = (stage: number) => snowBoxes(0, 0, 1, stage).some((b) => b[6] === SNOWMAN_COLORS.carrot[0]);
    expect([0, 1, 2, 3].map(carrot)).toEqual([false, false, false, true]);
    // alles im eigenen Feld (die 2D-Ansicht zeichnet es in der Reihe seiner Vorderkante)
    for (const b of snowBoxes(5, 7, 1, 3, 0.06)) {
      expect(b[1] + b[4]).toBeLessThanOrEqual(8);
      expect(b[0]).toBeGreaterThanOrEqual(5);
      expect(b[0] + b[3]).toBeLessThanOrEqual(6);
    }
  });

  it('der Haufen unterscheidet sich von den begehbaren Schneewehen: Schattenrand, kleine Kugel, Zweig', () => {
    const heap = snowBoxes(0, 0, 1, 0);
    expect(heap.some((b) => b[6] === SNOWMAN_COLORS.shadow[0] && b[2] === 1)).toBe(true); // Rand am Boden
    expect(heap.some((b) => b[6] === SNOWMAN_COLORS.twig[0])).toBe(true);
    expect(heap.filter((b) => b[6] === ICE_COLORS.snow[0]).length).toBeGreaterThanOrEqual(3); // Hügel und Kugel
    // höher als eine Schneewehe (0,3), aber unter der ersten Kugel
    expect(Math.max(...heap.map((b) => b[2] + b[5] - 1))).toBeGreaterThan(0.35);
  });

  it('wackelt nach dem Wachsen kurz und steht dann still', () => {
    expect(wobble(-1)).toBe(0);
    expect(Math.abs(wobble(100))).toBeGreaterThan(0);
    expect(wobble(600)).toBe(0);
    expect(wobble(5000)).toBe(0);
    // ohne Wackeln (reduzierte Bewegung, 3D) liegt der Schneemann genau wie gebaut
    expect(snowBoxes(0, 0, 1, 3, 0)).toEqual(snowBoxes(0, 0, 1, 3));
  });

  it('ploppt je Kugel etwas höher; der fertige Schneemann bekommt eine kleine Melodie', () => {
    const plop = (stage: number) => snowScore({ type: 'snowman', x: 0, y: 0, stage });
    expect(plop(2)[0]![0]).toBeGreaterThan(plop(1)[0]![0]);
    expect(plop(SNOWMAN).length).toBeGreaterThan(plop(1).length);
    for (const [, len] of plop(SNOWMAN)) expect(len).toBeLessThan(1);
  });

  it('2D wackelt nur, wenn die Kugel vor ihren Augen wächst: nicht beim ersten Blick, nicht in einer anderen Welt', () => {
    const draw = EIS_PACK.view!.decos.snowheap!;
    const c = world.cell(HX, HY);
    const packs = (stage: number) => ({ eis: { v: 1, snow: { [`${HX},${HY}`]: stage } } });
    const at = (now: number, stage: number) => ({ now, reduced: false, picked: {}, packs: packs(stage) });
    const built = (stage: number) => snowBoxes(HX, HY, c.h, stage); // wie gebaut, ohne Wackeln
    // erster Blick auf Stufe 1, dann wächst sie im nächsten Bild: Sie wackelt kurz, später steht sie still
    expect(draw(world, c, HX, HY, at(1000, 1))).toEqual(built(1));
    draw(world, c, HX, HY, at(1016, 2));
    expect(draw(world, c, HX, HY, at(1116, 2))).not.toEqual(built(2));
    expect(draw(world, c, HX, HY, at(2000, 2))).toEqual(built(2));
    // eine andere Welt mit einem Haufen an derselben Stelle, schon gewachsen: kein Wackeln beim ersten Blick
    expect(draw(worldOf(2), c, HX, HY, at(2016, 3))).toEqual(built(3));
    // lange nicht gezeichnet (außer Sicht oder 3D), inzwischen gewachsen: kein Wackeln
    expect(draw(world, c, HX, HY, at(9000, 3))).toEqual(built(3));
  });

  it('die 2D-Ansicht des Pakets zeichnet jede Stufe, solange nichts lädt', () => {
    const draw = EIS_PACK.view!.decos.snowheap!;
    const c = world.cell(HX, HY);
    const at = (packs: Record<string, unknown>) => ({ now: 0, reduced: true, picked: {}, packs });
    const low = draw(world, c, HX, HY, at({}))!;
    const high = draw(world, c, HX, HY, at({ eis: { v: 1, snow: { [`${HX},${HY}`]: 3 } } }))!;
    expect(high.length).toBeGreaterThan(low.length);
  });
});
