// Die Schneeraupe, die Rundfahrt der Eis-Welt (Issue 54): erscheint ab dem zweiten Besuch, eine Runde über `step` mit den
// Paketen wie im Spiel, ihr Bild und ihre Töne. Die Runde selbst ist über die Seeds in mitwachsen-valley.test.ts geprüft
import { describe, expect, it } from 'vitest';
import type { Part } from '../../../../lib/games/front';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { CAT_SIGN, catParts } from '../../../../data/games/worlds/eis/mitwachsen-cat-model';
import type { Cell } from '../../mitwachsen-cell';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { loopOk, parked, stopsOf } from '../../mitwachsen-ride-kit';
import { ridden, stageOf } from '../../mitwachsen-ride-save';
import type { RideAt } from '../../mitwachsen-ride-view';
import { vehiclesOf } from '../../mitwachsen-rider';
import { initialState, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import { EIS_PACK, FAHRT_PACK, worldOf } from '../../test-worlds';
import { CAT_SPEC, cat, catRoute, visit, visitsOf } from './mitwachsen-cat';
import { CAT_ID, JUMP, catBodies, catFx, catScores, pisteBox } from './mitwachsen-cat-look';
import { loopOf } from './mitwachsen-loop';
import { view } from './view-2d';
import { view3d } from './view-3d';

const world = worldOf(3, [EIS_PACK]);
const loop = loopOf(world);
const route = catRoute(world)!;
const [hx, hy] = route.stops.home;
const RULES = [EIS_PACK, FAHRT_PACK];
const TICK: Cmd = { type: 'tick' };
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const HERE = { eis: { v: 1, snow: {}, gast: 2 }, fahrt: { raupe: { stage: 'bereit' } } };
const PENTA = [0, 2, 4, 7, 9];
const penta = (hz: number) => PENTA.includes(((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12);
const gold = (parts: readonly Part[]) => parts.some((p) => p[6] === GOLD.side || p[7] === GOLD.top);
const DIRS = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] } as const;
type Dir = keyof typeof DIRS;
/** Ein Warteplatz direkt neben dem Halt und die Richtung von dort zu ihm */
const [FROM, DIR] = (Object.entries(DIRS) as [Dir, readonly [number, number]][])
  .map(([d, [dx, dy]]) => [[hx - dx, hy - dy] as const, d] as const)
  .find(([p]) => route.seats.home.some((q) => q[0] === p[0] && q[1] === p[1]))!;

/** Wach in der Eis-Welt neben dem Halt, ohne Tiere; `packs`: Stand der Pakete (sonst: zweiter Besuch, die Raupe ist da) */
function atHalt(packs: Record<string, unknown> = HERE, more: Partial<State> = {}): State {
  const s = initialState(world, { packs });
  return {
    ...s,
    sleeping: false,
    wokeAt: -100,
    openGates: ['eis'],
    player: { x: FROM[0], y: FROM[1], dir: DIR },
    animals: [],
    ...more,
  };
}
const whats = (events: readonly GameEvent[]) =>
  events.filter((e): e is RideEvent => e.type === 'ride' && e.id === 'raupe').map((e) => e.what);

describe('Schneeraupe: Regeln', () => {
  it('Eintrag und Strecke: eine Schleife der Eis-Welt, lange Runde, ein Halt ohne Zugtier; die Eis-Welt meldet drei Fahrzeuge an', () => {
    expect(CAT_SPEC).toMatchObject({ id: 'raupe', gate: 'eis', loop: true, ticks: [250, 380], pace: 0.9 });
    expect(CAT_SPEC.signal.every(penta)).toBe(true);
    expect(vehiclesOf([EIS_PACK]).map((v) => v.spec.id)).toEqual(['schlitten', 'rodel', 'raupe']);
    expect(route.loop).toBe(true);
    expect(loopOk(route)).toBe(true);
    expect(route.path).toHaveLength(loop.length + 1);
    expect(route.path.at(-1)).toEqual(route.path[0]);
    expect([...stopsOf(route).home.cells]).toEqual([`${hx},${hy}`]);
    expect(route.seats.home.length).toBeGreaterThanOrEqual(4);
    for (const p of route.seats.home) expect(world.cell(...p).ride).toBeUndefined();
    expect(catRoute(worldOf(3, []))).toBeUndefined(); // ohne Eis-Welt keine Runde
    expect(EIS_PACK.sights!.map((x) => x.id)).toContain('halt:raupe');
  });

  it('Besuche: der erste Schritt in den Schnee des Tals zählt eins, ein Schritt hinaus zwei, der nächste hinein bringt die Raupe', () => {
    const snow = { h: 1, ground: 'snow', deco: null, region: 'eis', solid: false } as Cell;
    const gang = { ...snow, region: 'wild' } as Cell;
    const s = { ...atHalt({}) };
    const go = (c: Cell, walks = true) => visit(s, c, 0, 0, { push: () => 0 }, { here: snow, walks, cell: () => snow });
    expect(visitsOf(s.packs)).toBe(0);
    expect(go(gang)).toBe(false);
    expect(visitsOf(s.packs)).toBe(0); // draußen vor dem ersten Besuch: nichts
    go(snow, false);
    expect(visitsOf(s.packs)).toBe(0); // der Schritt geht nicht: zählt nicht
    go(snow);
    go(snow);
    expect(visitsOf(s.packs)).toBe(1);
    expect(stageOf(s.packs, 'raupe')).toBeUndefined(); // beim ersten Besuch ist sie nicht da
    go(gang);
    expect(visitsOf(s.packs)).toBe(2);
    expect(stageOf(s.packs, 'raupe')).toBeUndefined();
    go(snow);
    expect(stageOf(s.packs, 'raupe')).toBe('bereit');
    const there = s.packs;
    go(gang);
    go(snow);
    expect(s.packs).toBe(there); // danach ändert sich nichts mehr
    // Schneemänner und Laternen im selben Zustand bleiben
    const kept = { ...atHalt({ eis: { v: 1, snow: { '1,1': 2 }, lit: ['4,4'] } }) };
    visit(kept, snow, 0, 0, { push: () => 0 }, { here: snow, walks: true, cell: () => snow });
    expect(kept.packs.eis).toEqual({ v: 1, snow: { '1,1': 2 }, lit: ['4,4'], gast: 1 });
    expect(visitsOf({ eis: { gast: 7 } })).toBe(0); // kaputter Eintrag
  });

  it('beim ersten Besuch steht sie nicht da und nimmt niemanden mit; ab dem zweiten steht sie am Halt', () => {
    const first = atHalt({ eis: { v: 1, snow: {}, gast: 1 } });
    expect(parked(CAT_SPEC, route, first, world)).toBeUndefined();
    expect(catBodies(first, world, AT)).toEqual([]);
    const tried = step(first, world, { type: 'move', dir: DIR, fresh: true }, undefined, undefined, RULES);
    expect(tried.state.ride).toBeUndefined();
    expect(tried.state.player).toMatchObject({ x: hx, y: hy }); // sie läuft einfach über das Feld
    expect(parked(CAT_SPEC, route, atHalt(), world)?.seat).toEqual([hx, hy]);
  });

  it('eine Runde: einsteigen, 2 s, einmal um das Tal ohne Lenken, am selben Halt aussteigen; danach gemerkt', () => {
    const events: GameEvent[] = [];
    let s = atHalt();
    const play = (c: Cmd) => {
      const out = step(s, world, c, undefined, undefined, RULES);
      s = out.state;
      events.push(...out.events);
    };
    play({ type: 'move', dir: DIR, fresh: true });
    expect(s.ride).toMatchObject({ id: 'raupe', to: 'home', feast: false });
    expect(s.ride!.laps).toBeUndefined(); // eine Runde, keine Wahl
    const on = new Set(loop.map((p) => p.join(',')));
    let last = -1;
    let going = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 600 && s.ride; i++) {
      play(TICK);
      if (s.ride?.phase !== 'go') continue;
      going++;
      expect(s.ride.pos).toBeGreaterThanOrEqual(last);
      last = s.ride.pos;
      expect(on.has(`${s.player.x},${s.player.y}`)).toBe(true);
      seen.add(`${s.player.x},${s.player.y}`);
    }
    expect(s.ride).toBeUndefined();
    expect(whats(events)).toEqual(['board', 'go', 'arrive', 'alight']);
    expect(going).toBeGreaterThanOrEqual(250); // 25 bis 38 s
    expect(going).toBeLessThanOrEqual(381);
    expect(seen.size).toBeGreaterThan(loop.length * 0.9); // einmal ganz herum
    // ausgestiegen neben dem Halt, nicht auf der Runde; die erste Fahrt gemerkt und gespeichert
    expect(Math.max(Math.abs(s.player.x - hx), Math.abs(s.player.y - hy))).toBeLessThanOrEqual(2);
    expect(on.has(`${s.player.x},${s.player.y}`)).toBe(false);
    expect(ridden(s.packs, 'raupe')).toBe(true);
    expect(events.some((e) => e.type === 'ride' && e.what === 'alight' && e.persist)).toBe(true);
    expect(parked(CAT_SPEC, route, s, world)?.seat).toEqual([hx, hy]);
  });

  it('in den 2 s vor der Abfahrt steigt ein Pfeil weg wieder aus; unterwegs ist jeder Druck ein Winken', () => {
    const boarded = step(atHalt(), world, { type: 'move', dir: DIR, fresh: true }, undefined, undefined, RULES).state;
    const back = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(
      ([, [dx, dy]]) => hx + dx === FROM[0] && hy + dy === FROM[1],
    )![0];
    const left = step(boarded, world, { type: 'move', dir: back, fresh: true }, undefined, undefined, RULES);
    expect(left.state.ride).toBeUndefined();
    expect(whats(left.events)).toEqual(['leave']);
    let s = boarded;
    for (let i = 0; i < 40; i++) s = step(s, world, TICK, undefined, undefined, RULES).state;
    const waved = step(s, world, { type: 'move', dir: back, fresh: true }, undefined, undefined, RULES);
    expect(waved.state.ride).toBeDefined();
    expect(whats(waved.events)).toContain('wave');
    expect('laps' in cat).toBe(false); // keine Rundenwahl
  });
});

describe('Schneeraupe: Bild und Ton', () => {
  const body = (s: State, at: Partial<RideAt> = {}) =>
    catBodies(s, world, { ...AT, ...at }).find((b) => b.id === CAT_ID)!;

  it('am Halt mit goldenem Tritt bis zur ersten Fahrt, daneben das Schild mit der 4; die Lampe leuchtet am Abend', () => {
    const bodies = catBodies(atHalt(), world, AT);
    expect(bodies.map((b) => b.id)).toEqual(['raupe:schild', CAT_ID]);
    expect(bodies[0]).toMatchObject({ dir: 's', parts: CAT_SIGN });
    expect(world.cell(bodies[0]!.x, bodies[0]!.y).ride).toBeUndefined(); // das Schild steht neben der Runde
    expect(bodies[1]).toMatchObject({ x: hx, y: hy, key: `${CAT_ID}:010` });
    expect(gold(bodies[1]!.parts)).toBe(true);
    expect(bodies.some((b) => b.seat)).toBe(false);
    const done = atHalt({ ...HERE, fahrt: { raupe: { stage: 'bereit', gefahren: true } } });
    expect(gold(body(done).parts)).toBe(false);
    expect(body(atHalt(), { lit: true }).key).toBe(`${CAT_ID}:110`);
    expect(gold(body(atHalt(HERE, { dozing: ['raupe'] })).parts)).toBe(false); // lädt die Fahr-Engine noch: kein Gold
    expect(catBodies(atHalt(HERE, { player: { x: 0, y: 3, dir: 's' } }), world, AT)).toEqual([]);
    expect(gold(CAT_SIGN)).toBe(false);
  });

  it('unterwegs sitzt die Figur in der Kabine, Lampe an, sie gleitet; bei reduzierter Bewegung feste Bilder', () => {
    let s = step(atHalt(), world, { type: 'move', dir: DIR, fresh: true }, undefined, undefined, RULES).state;
    for (let i = 0; i < 60; i++) s = step(s, world, TICK, undefined, undefined, RULES).state;
    const b = body(s);
    expect(b).toMatchObject({ seat: true, key: `${CAT_ID}:101` });
    const half = body(s, { frac: 0.5 });
    expect(Math.hypot(half.x - b.x, half.y - b.y)).toBeGreaterThan(0.2);
    const still = [0, 0.5, 1].map((frac) => body(s, { frac, reduced: true }));
    expect(new Set(still.map((x) => `${x.x},${x.y}`)).size).toBe(1);
    const at = loop[Math.floor(s.ride!.pos / JUMP) * JUMP]!;
    expect([still[0]!.x, still[0]!.y]).toEqual(at);
    // die langen Teile mittig: Die Figur liegt in jeder Fahrtrichtung obenauf (2D reiht nach der Mitte)
    for (const [f, , , l] of catParts({ rider: true }).filter((p) => p[3] > 0.5)) expect(f + l / 2).toBeCloseTo(0, 5);
    expect(catParts({ rider: true }).length).toBeGreaterThan(catParts({}).length);
  });

  it('die Runde ist gewalzter Schnee: ein flacher Quader im Feld, in beiden Ansichten', () => {
    const [x, y] = loop[20]!;
    const c = world.cell(x, y);
    const box = pisteBox(c, x, y);
    expect(box[0]).toBeGreaterThanOrEqual(x);
    expect(box[0] + box[3]).toBeLessThanOrEqual(x + 1);
    expect(box[5]).toBeLessThan(0.05);
    expect(view.ground(c, x, y, false)).toEqual(box);
    expect(view3d.ground(c, [])?.top).toBe(box[6]);
    expect(view.bodies!(atHalt(), world, AT).some((b) => b.id === CAT_ID)).toBe(true);
  });

  it('Töne in der Pentatonik, leise; beim Aussteigen ein Herz; andere Fahrzeuge gehen sie nichts an', () => {
    const e = (what: RideEvent['what'], more: Partial<RideEvent> = {}): RideEvent => ({
      type: 'ride',
      what,
      id: 'raupe',
      x: 0,
      y: 0,
      ...more,
    });
    for (const what of ['nudge', 'board', 'go', 'wave', 'stop', 'arrive', 'leave', 'alight', 'snore'] as const) {
      const score = catScores(e(what));
      expect(score.length, what).toBeGreaterThan(0);
      expect(
        score.every(([hz]) => penta(hz)),
        what,
      ).toBe(true);
      expect(
        score.every(([, , , gain]) => gain <= 0.07),
        what,
      ).toBe(true);
    }
    expect(catFx(e('alight'))).toMatchObject({ who: 'player', heart: true });
    expect(catFx(e('board', { id: 'rodel' }))).toBeUndefined();
    expect(view.rideFx!(e('alight'), atHalt())).toEqual(catFx(e('alight')));
    expect(view.rideFx!(e('alight', { id: 'rodel' }), atHalt())?.heart).toBe(true); // der Rodelreifen antwortet weiter selbst
  });
});
