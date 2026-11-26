// Der Rodelreifen am Rodelberg (Issue 50): Fahrt nur bergab über `step` mit den Paketen wie im Spiel, sein Bild und
// seine Töne. Der Berg selbst ist über die Seeds in mitwachsen-valley.test.ts geprüft
import { describe, expect, it } from 'vitest';
import type { Part } from '../../../../lib/games/front';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import { HILL_FLAG, tubeParts } from '../../../../data/games/worlds/eis/mitwachsen-tube-model';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { parked, stopsOf } from '../../mitwachsen-ride-kit';
import { ridden, stageOf } from '../../mitwachsen-ride-save';
import type { RideAt } from '../../mitwachsen-ride-view';
import { vehiclesOf } from '../../mitwachsen-rider';
import { initialState, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import { EIS_PACK, FAHRT_PACK, worldOf } from '../../test-worlds';
import { hillOf } from './mitwachsen-hill';
import { sled } from './mitwachsen-sled';
import { TUBE_SPEC, tube, tubeRoute } from './mitwachsen-tube';
import { PULL, TUBE_ID, runBox, stepBoxes, tubeBodies, tubeFx, tubeScores } from './mitwachsen-tube-look';
import { view } from './view-2d';
import { view3d } from './view-3d';

const world = worldOf(1, [EIS_PACK]);
const hill = hillOf(world)!;
const route = tubeRoute(world)!;
const [tx, ty] = hill.top;
const RULES = [EIS_PACK, FAHRT_PACK];
const TICK: Cmd = { type: 'tick' };
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const PENTA = [0, 2, 4, 7, 9];
const penta = (hz: number) => PENTA.includes(((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12);
const gold = (parts: readonly Part[]) => parts.some((p) => p[6] === GOLD.side || p[7] === GOLD.top);

/** Wach in der Eis-Welt, oben auf der Treppe links neben dem Gipfel, ohne Tiere */
function onTop(more: Partial<State> = {}): State {
  const s = initialState(world, {});
  return {
    ...s,
    sleeping: false,
    wokeAt: -100,
    openGates: ['eis'],
    player: { x: tx - 1, y: ty, dir: 'e' },
    animals: [],
    ...more,
  };
}

/** Befehle abspielen, bis `until` gilt (höchstens `max`), Zustand und Ereignisse sammeln */
function play(s0: State, cmds: readonly Cmd[], until: (s: State) => boolean, max = 300) {
  const events: GameEvent[] = [];
  let s = s0;
  const run = (c: Cmd) => {
    const out = step(s, world, c, undefined, undefined, RULES);
    s = out.state;
    events.push(...out.events);
  };
  cmds.forEach(run);
  const seen: State[] = [s];
  for (let i = 0; i < max && !until(s); i++) {
    run(TICK);
    seen.push(s);
  }
  return { s, events, seen };
}
const whats = (events: readonly GameEvent[]) =>
  events.filter((e): e is RideEvent => e.type === 'ride' && e.id === 'rodel').map((e) => e.what);

describe('Rodelreifen: Fahrt nur bergab', () => {
  it('Eintrag und Paket: nur bergab, kurz, ohne Wimpel; die Eis-Welt meldet Schlitten und Rodelreifen an', () => {
    expect(TUBE_SPEC).toMatchObject({ id: 'rodel', gate: 'eis', slide: true, ticks: [40, 60], pace: 0.6 });
    expect(RIDES.at(-1)).toBe(TUBE_SPEC);
    expect(TUBE_SPEC.signal.every(penta)).toBe(true);
    expect(vehiclesOf([EIS_PACK, FAHRT_PACK])).toEqual([sled, tube]);
    expect('ready' in tube).toBe(false); // er erscheint nicht: Er ist immer da
    expect(EIS_PACK.sights!.map((x) => x.id)).toContain('halt:rodel');
  });

  it('Strecke: vom Gipfel die Bahn hinab, ein Halt ohne Zugtier, die Tiere warten unten', () => {
    expect(route.path).toBe(hill.run);
    expect(route.stops).toEqual({ home: hill.top, out: hill.run.at(-1) });
    expect(route.seats.home).toBe(hill.foot);
    const at = stopsOf(route);
    expect([...at.home.cells]).toEqual([`${tx},${ty}`]); // nur der Sitz: Neben ihm läuft man frei
    expect(tubeRoute(worldOf(1, []))).toBeUndefined(); // ohne Eis-Welt kein Berg
  });

  it('immer da, ohne Eintrag im Spielstand: steht oben, sobald die Figur in der Eis-Welt ist', () => {
    const s = onTop();
    expect(stageOf(s.packs, 'rodel')).toBeUndefined();
    expect(parked(TUBE_SPEC, route, s, world)?.seat).toEqual(hill.top);
    const away = { ...s, player: { ...s.player, x: world.homes.lichtung.bed[0], y: world.homes.lichtung.bed[1] } };
    expect(parked(TUBE_SPEC, route, away, world)).toBeUndefined();
    // der Schlitten ist davon unberührt: ohne Eintrag nicht da
    expect(parked(sled.spec, sled.route(world, s)!, s, world)).toBeUndefined();
  });

  it('hineinlaufen, 2 s, die Bahn hinab ohne Lenken, unten aussteigen; der Reifen steht wieder oben', () => {
    const { s, events, seen } = play(onTop(), [{ type: 'move', dir: 'e', fresh: true }], (t) => !t.ride);
    expect(seen[0]!.ride).toMatchObject({ id: 'rodel', to: 'out', feast: false, phase: 'seated' });
    expect(seen[0]!.player).toMatchObject({ x: tx, y: ty });
    expect(whats(events)).toEqual(['board', 'go', 'arrive', 'alight']);
    const riding = seen.filter((t) => t.ride?.phase === 'go');
    // 4 bis 6 s unterwegs, immer vorwärts, die Figur immer auf der Bahn und nie bergauf
    expect(riding.length).toBeGreaterThanOrEqual(40);
    expect(riding.length).toBeLessThanOrEqual(61);
    const on = new Set(hill.run.map((p) => p.join(',')));
    let last = -1;
    let high = Infinity;
    for (const t of riding) {
      expect(t.ride!.pos).toBeGreaterThanOrEqual(last);
      last = t.ride!.pos;
      expect(on.has(`${t.player.x},${t.player.y}`)).toBe(true);
      const h = world.cell(t.player.x, t.player.y).h;
      expect(h).toBeLessThanOrEqual(high);
      high = h;
    }
    // unten neben dem Ende ausgestiegen, nicht auf der Bahn
    const end = hill.run.at(-1)!;
    expect(Math.max(Math.abs(s.player.x - end[0]), Math.abs(s.player.y - end[1]))).toBeLessThanOrEqual(2);
    expect(on.has(`${s.player.x},${s.player.y}`)).toBe(false);
    // der Reifen steht in den Regeln sofort wieder oben; die erste Abfahrt ist gemerkt und gespeichert
    expect(parked(TUBE_SPEC, route, s, world)?.seat).toEqual(hill.top);
    expect(ridden(s.packs, 'rodel')).toBe(true);
    expect(events.some((e) => e.type === 'ride' && e.what === 'alight' && e.persist)).toBe(true);
    // gleich noch einmal: wieder von oben
    const again = play(
      { ...s, player: { x: tx - 1, y: ty, dir: 'e' } },
      [{ type: 'move', dir: 'e', fresh: true }],
      (t) => !t.ride,
    );
    expect(whats(again.events)).toEqual(['board', 'go', 'arrive', 'alight']);
    expect(again.events.some((e) => e.type === 'ride' && e.persist)).toBe(false); // nichts Neues zu speichern
  });

  it('in den 2 s vor der Abfahrt steigt ein Pfeil weg wieder aus; unterwegs ist jeder Druck ein Winken; ein gehaltener Pfeil stößt nur an', () => {
    const boarded = step(onTop(), world, { type: 'move', dir: 'e', fresh: true }, undefined, undefined, RULES).state;
    const left = step(boarded, world, { type: 'move', dir: 'w', fresh: true }, undefined, undefined, RULES);
    expect(left.state.ride).toBeUndefined();
    expect(left.state.player).toMatchObject({ x: tx - 1, y: ty });
    expect(whats(left.events)).toEqual(['leave']);
    const { s: going } = play(boarded, [], (t) => t.ride?.phase === 'go' && t.ride.pos > 3);
    const waved = step(going, world, { type: 'move', dir: 'w', fresh: true }, undefined, undefined, RULES);
    expect(waved.state.ride).toBeDefined();
    expect(whats(waved.events)).toContain('wave');
    const held = step(onTop(), world, { type: 'move', dir: 'e' }, undefined, undefined, RULES);
    expect(held.state.ride).toBeUndefined();
    expect(whats(held.events)).toEqual(['nudge']);
    expect(held.state.player).toMatchObject({ x: tx - 1, y: ty });
  });

  it('neben dem Reifen läuft man frei (kein Zugtier); umherlaufende Tiere meiden Gipfel und Bahn; folgende warten unten', () => {
    // vom Feld rechts unter dem Gipfel nach links auf das zweite Feld der Bahn: ein normaler Schritt
    const s = onTop({ player: { x: tx + 1, y: ty + 1, dir: 'w' } });
    const walked = step(s, world, { type: 'move', dir: 'w', fresh: true }, undefined, undefined, RULES);
    expect(walked.state.player).toMatchObject({ x: tx, y: ty + 1 });
    expect(walked.state.ride).toBeUndefined();
    const engine = FAHRT_PACK.rules!.ride!([sled, tube]);
    const walker = { id: 'x', species: 'rentier', x: 0, y: 0, dir: 's', mode: 'wander' } as State['animals'][number];
    expect(engine.blocks(s, world, walker, tx, ty)).toBe(true);
    expect(engine.blocks(s, world, walker, ...hill.run[10]!)).toBe(true);
    expect(engine.blocks(s, world, { ...walker, mode: 'follow' }, ...hill.run[10]!)).toBe(false);
    expect(engine.blocks(s, world, walker, tx - 3, ty)).toBe(false); // die Treppe ist frei
    // ein folgendes Tier fährt nie mit: Es wartet unten am Ziel
    const pal = {
      ...walker,
      id: 'eis:rentier:1',
      realm: 'eis',
      mode: 'follow',
      x: tx - 2,
      y: ty,
    } as State['animals'][number];
    const withPal = onTop({ animals: [pal], followers: [pal.id] });
    const out = step(withPal, world, { type: 'move', dir: 'e', fresh: true }, undefined, undefined, RULES).state;
    expect(out.followers).toEqual([]);
    expect(hill.foot.map((p) => p.join(','))).toContain(`${out.animals[0]!.x},${out.animals[0]!.y}`);
  });
});

describe('Rodelreifen: Bild und Ton', () => {
  const body = (s: State, at: Partial<RideAt> = {}) =>
    tubeBodies(s, world, { ...AT, ...at }).find((b) => b.id === TUBE_ID)!;

  it('oben auf dem Gipfel, bis zur ersten Abfahrt mit goldenem Griff; die Fahne steht dahinter; nur in der Eis-Welt', () => {
    const bodies = tubeBodies(onTop(), world, AT);
    expect(bodies.map((b) => b.id)).toEqual(['rodel:fahne', TUBE_ID]);
    expect(bodies[0]).toMatchObject({ x: tx, y: ty - 1, parts: HILL_FLAG });
    expect(bodies[1]).toMatchObject({ x: tx, y: ty, z: 7, key: `${TUBE_ID}:gold` });
    expect(gold(bodies[1]!.parts)).toBe(true);
    expect(bodies.some((b) => b.seat)).toBe(false);
    const done = onTop({ packs: { fahrt: { rodel: { stage: 'offen' } } } });
    expect(body(done).key).toBe(`${TUBE_ID}:leer`);
    expect(gold(body(done).parts)).toBe(false);
    // lädt die Fahr-Engine noch (er schläft), lädt er nicht ein: kein Gold
    expect(body(onTop({ dozing: ['rodel'] })).key).toBe(`${TUBE_ID}:leer`);
    const away = onTop({ player: { x: 0, y: 3, dir: 's' } });
    expect(tubeBodies(away, world, AT)).toEqual([]);
    expect(Math.max(...HILL_FLAG.map((p) => p[2] + p[5]))).toBeGreaterThan(1.6); // von weitem zu sehen
  });

  it('unterwegs sitzt die Figur darin, er gleitet zwischen den Takten; bei reduzierter Bewegung von Feld zu Feld', () => {
    const boarded = step(onTop(), world, { type: 'move', dir: 'e', fresh: true }, undefined, undefined, RULES).state;
    const { s } = play(boarded, [], (t) => t.ride?.phase === 'go' && t.ride.pos > 8);
    const b = body(s);
    expect(b).toMatchObject({ seat: true, key: `${TUBE_ID}:figur` });
    expect(gold(b.parts)).toBe(false);
    const half = body(s, { frac: 0.5 });
    expect(Math.hypot(half.x - b.x, half.y - b.y)).toBeGreaterThan(0.1);
    expect(Math.hypot(half.x - b.x, half.y - b.y)).toBeLessThan(0.5);
    const still = [0, 0.5, 1].map((frac) => body(s, { frac, reduced: true }));
    expect(new Set(still.map((x) => `${x.x},${x.y}`)).size).toBe(1);
    expect(Number.isInteger(still[0]!.x) && Number.isInteger(still[0]!.y)).toBe(true);
    // alle Teile mittig: Die Figur liegt in jeder Fahrtrichtung obenauf (2D reiht nach der Mitte)
    for (const [f, r, , l, w] of tubeParts({ rider: true }).slice(0, 3)) {
      expect(f + l / 2).toBeCloseTo(0, 5);
      expect(r + w / 2).toBeCloseTo(0, 5);
    }
  });

  it('nach dem Aussteigen wird er im Bild an den Gipfel zurückgezogen; bei reduzierter Bewegung steht er gleich oben', () => {
    const { s } = play(onTop(), [{ type: 'move', dir: 'e', fresh: true }], (t) => !t.ride);
    const end = hill.run.at(-1)!;
    const first = body(s, { frac: 0 });
    expect(Math.hypot(first.x - end[0], first.y - end[1])).toBeLessThan(1.5);
    expect(first.key).toBe(`${TUBE_ID}:leer`);
    const later = { ...s, tick: s.tick + PULL / 2 };
    const mid = body(later, { frac: 0 });
    expect(Math.hypot(mid.x - tx, mid.y - ty)).toBeLessThan(Math.hypot(first.x - tx, first.y - ty));
    const up = body({ ...s, tick: s.tick + PULL }, { frac: 0 });
    expect([up.x, up.y, up.z]).toEqual([tx, ty, 7]);
    expect([body(s, { reduced: true }).x, body(s, { reduced: true }).y]).toEqual([tx, ty]);
  });

  it('Treppe und Bahn: Quader im Feld, flach, ohne Gold; beide Ansichten zeichnen sie', () => {
    const [sx, sy] = hill.stairs[0]!;
    const step0 = world.cell(sx, sy);
    const boxes = [...stepBoxes(step0, sx, sy), runBox(world.cell(...hill.run[3]!), ...hill.run[3]!)];
    for (const [x, y, z, w, d, h, side, top] of boxes) {
      expect(x - Math.floor(x) + w).toBeLessThanOrEqual(1.0001);
      expect(y - Math.floor(y) + d).toBeLessThanOrEqual(1.0001);
      expect(h).toBeLessThan(0.1);
      expect(z).toBeGreaterThanOrEqual(1);
      expect([side, top]).not.toContain(GOLD.top);
    }
    const at = { now: 0, reduced: false, picked: {}, packs: {} } as never;
    expect(view.decos.hillstep!(world, step0, sx, sy, at)).toEqual(stepBoxes(step0, sx, sy));
    expect(view3d.decos.hillstep!(world, step0, sx, sy, at)).toEqual(stepBoxes(step0, sx, sy));
    const run = world.cell(...hill.run[3]!);
    expect(view.ground(run, ...hill.run[3]!, false)).toEqual(runBox(run, ...hill.run[3]!));
    expect(view3d.ground(run, [])?.tiles).toEqual(['ice', 'ice', 'ice']);
    expect(view.bodies!(onTop(), world, AT).map((b) => b.id)).toContain(TUBE_ID);
  });

  it('Töne in der Pentatonik; am Ziel stiebt Schnee, beim Aussteigen ein Herz; andere Fahrzeuge gehen ihn nichts an', () => {
    const e = (what: RideEvent['what'], more: Partial<RideEvent> = {}): RideEvent => ({
      type: 'ride',
      what,
      id: 'rodel',
      x: 0,
      y: 0,
      ...more,
    });
    for (const what of ['nudge', 'board', 'go', 'wave', 'stop', 'arrive', 'leave', 'alight'] as const) {
      const score = tubeScores(e(what));
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
    expect(tubeFx(e('arrive'))?.burst?.length).toBeGreaterThan(0);
    expect(tubeFx(e('alight'))).toMatchObject({ who: 'player', heart: true });
    expect(tubeFx(e('wave'))).toMatchObject({ who: 'player' });
    expect(tubeFx(e('board', { id: 'schlitten' }))).toBeUndefined();
    expect(view.rideFx!(e('alight'), onTop())).toEqual(tubeFx(e('alight')));
  });
});
