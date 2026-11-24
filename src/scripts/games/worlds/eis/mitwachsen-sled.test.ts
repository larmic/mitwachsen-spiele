// Fahrregeln des Schlittens (Fahr-Engine im Paket der Fahrzeuge, worlds/fahrt/mitwachsen-ride.ts); die Strecke prüft
// mitwachsen-sled-route.test.ts
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { REGIONS, regionAnimalList, type Point } from '../../../../data/games/mitwachsen';
import { stops } from '../../input-pace';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { initialState, progressOf, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import { canStep, createWorld, kesselPlace, standHeight, type World } from '../../mitwachsen-world';
import { EIS_PACK, FAHRT_PACK, seedChunks, seedRange, seedsFor, worldOf } from '../../test-worlds';
import {
  ALIGHT,
  COME,
  DEPART,
  DUE,
  JINGLE_EVERY,
  SHOO,
  TAP_REACH,
  cellOf,
  parked,
  stopsOf,
} from '../../mitwachsen-ride-kit';
import type { End, RideRoute, Vehicle } from '../../mitwachsen-rider';
import { stageOf, withRide, type RideStage } from '../../mitwachsen-ride-save';
import { SLED, sled as SLED_VEHICLE, snowmen } from './mitwachsen-sled';
import { SNOWMAN } from './mitwachsen-snowman';
import { sledRoute } from './mitwachsen-sled-route';

const ICE = [EIS_PACK];
const keyOf = ([x, y]: Point) => `${x},${y}`;

// ---------- Fahrregeln (Engine mitwachsen-ride.ts mit dem Schlitten, über ein Test-Paket wie `pack.rules` in index.ts) ----------

/** Die Fahr-Engine (Paket der Fahrzeuge) mit einem Fahrzeug */
const engineOf = (...v: Vehicle[]) => FAHRT_PACK.rules!.ride!(v);
/** Regeln des Schlittens: die Fahr-Engine mit dem Schlitten aus dem Paket der Eis-Welt */
const sled = engineOf(SLED_VEHICLE);
/** Test-Pakete: die Regeln der Eis-Welt samt Schlitten und die Fahr-Engine, wie im Spiel */
const RULES = [EIS_PACK, FAHRT_PACK];
const ICE_REGION = REGIONS.find((r) => r.id === 'eis')!;
/** Je Eis-Art ein Tier auf der Schneewiese: Die Leiste der Eis-Welt ist voll */
const FULL = regionAnimalList(ICE_REGION)
  .filter((a) => a.n === 1)
  .map(({ id, species }) => ({ id, species }));
const TICK: Cmd = { type: 'tick' };

type Run = { s: State; events: GameEvent[] };
/** Befehle mit den Regeln des Test-Pakets (`packs` false: ohne) */
function play(s: State, world: World, cmds: readonly Cmd[], packs = true): Run {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, c, undefined, undefined, packs ? RULES : []);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
const ticks = (n: number): Cmd[] => Array.from({ length: n }, () => TICK);
const rideEvents = (e: readonly GameEvent[], what?: RideEvent['what']) =>
  e.filter((x): x is RideEvent => x.type === 'ride' && (!what || x.what === what));
const at = (s: State): Point => [s.player.x, s.player.y];

/** Wach, Eistor offen, Leiste der Eis-Welt voll, die Figur auf `p` (sonst am Schneebett); `stage`: Schlitten schon da */
function awakeAt(world: World, p?: Point, stage?: RideStage, garden = FULL): State {
  const s = initialState(world, { openGates: ['eis'], garden });
  const [x, y] = p ?? world.homes.eis.wake.find(([wx, wy]) => !s.animals.some((a) => a.x === wx && a.y === wy))!;
  const packs = stage ? withRide(s.packs, 'schlitten', stage) : s.packs;
  // Tiere, die auf der Figur stünden, ziehen woanders hin (nur für den Test)
  const animals = s.animals.filter((a) => a.x !== x || a.y !== y);
  return { ...s, sleeping: false, wokeAt: -100, player: { x, y, dir: 's' }, animals, packs };
}

/** Freies Nachbarfeld von `target`, von dem aus die Figur hineinläuft (nicht am Halt), samt Richtung */
function beside(world: World, s: State, target: Point, not: ReadonlySet<string>): { from: Point; dir: Dir } {
  for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
    const from: Point = [target[0] - dx, target[1] - dy];
    if (not.has(keyOf(from)) || standHeight(world, s.openGates, ...from) === null) continue;
    if (s.animals.some((a) => a.x === from[0] && a.y === from[1])) continue;
    return { from, dir };
  }
  throw new Error(`kein Feld neben ${keyOf(target)}`);
}

/** Vor dem Sitz am Halt `end`, Schlitten schon da (`stage`): Zustand, Richtung zum Sitz */
function beforeSeat(world: World, end: End, stage: RideStage = end === 'out' ? 'fest' : 'bereit') {
  const stop = stopsOf(sledRoute(world)!)[end];
  const base = awakeAt(world, stop.seat, stage);
  const { from, dir } = beside(world, base, stop.seat, new Set([...sledRoute(world)!.on, ...stop.cells]));
  return { s: { ...base, player: { x: from[0], y: from[1], dir } }, dir, stop };
}

/** Einsteigen (Richtung `dir`) und fahren, bis die Figur ausgestiegen ist; `goAt`/`arriveAt`: Takte von Abfahrt und Ankunft */
function ride(world: World, s: State, dir: Dir, limit = 400): Run & { goAt: number; arriveAt: number } {
  let r = play(s, world, [{ type: 'move', dir, fresh: true }]);
  let [goAt, arriveAt] = [-1, -1];
  for (let i = 0; i < limit && r.s.ride; i++) {
    const n = play(r.s, world, [TICK]);
    if (rideEvents(n.events, 'go').length) goAt = n.s.tick;
    if (rideEvents(n.events, 'arrive').length) arriveAt = n.s.tick;
    r = { s: n.s, events: [...r.events, ...n.events] };
  }
  return { ...r, goAt, arriveAt };
}

/** Richtung zu einem freien Nachbarfeld der Figur abseits der Halte */
function free(world: World, s: State): Dir {
  const r = sledRoute(world)!;
  const not = new Set([...stopsOf(r).home.cells, ...stopsOf(r).out.cells]);
  for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
    const [x, y] = [s.player.x + dx, s.player.y + dy];
    if (not.has(keyOf([x, y])) || s.animals.some((a) => a.x === x && a.y === y)) continue;
    if (canStep(world, s.openGates, s.player.x, s.player.y, x, y)) return dir;
  }
  throw new Error(`kein freies Feld neben ${keyOf(at(s))}`);
}

describe('Fahrregeln des Schlittens (Eis-Welt)', () => {
  const W = () => worldOf(1, ICE);

  it('erscheint gut 2 s nach voller Leiste am Schneebett, dann trabt er herbei; nicht ohne volle Leiste, nicht fern vom Bett', () => {
    const world = W();
    const { s, events } = play(awakeAt(world), world, ticks(DUE + COME + 2));
    const appear = rideEvents(events, 'appear');
    expect(appear).toHaveLength(1);
    expect(appear[0]).toMatchObject({
      persist: true,
      x: sledRoute(world)!.path[0]![0],
      y: sledRoute(world)!.path[0]![1],
    });
    expect(appear[0]!.from).toBeDefined();
    expect(stageOf(s.packs, 'schlitten')).toBe('bereit');
    expect(rideEvents(events).map((e) => e.what)).toEqual(['appear', 'come']);
    // erst nach DUE Takten: einer weniger reicht nicht
    expect(rideEvents(play(awakeAt(world), world, ticks(DUE - 1)).events)).toEqual([]);
    // ohne volle Leiste (ein Eis-Tier fehlt), fern vom Bett, schlafend: nie
    const lacking = awakeAt(world, undefined, undefined, FULL.slice(1));
    expect(rideEvents(play(lacking, world, ticks(100)).events)).toEqual([]);
    const far = awakeAt(world, sledRoute(world)!.path[3]);
    expect(rideEvents(play(far, world, ticks(100)).events)).toEqual([]);
    expect(rideEvents(play({ ...awakeAt(world), sleeping: true }, world, ticks(100)).events)).toEqual([]);
  });

  it('geht die Figur vorher weg, beginnt die Wartezeit von vorn', () => {
    const world = W();
    const half = play(awakeAt(world), world, ticks(DUE - 5)).s;
    const away = play({ ...half, player: { ...half.player, ...xy(sledRoute(world)!.path[3]!) } }, world, [TICK]).s;
    expect(away.rideDue).toBe(-1);
    const back = { ...away, player: half.player };
    expect(rideEvents(play(back, world, ticks(DUE - 1)).events)).toEqual([]);
    expect(rideEvents(play(back, world, ticks(DUE + 1)).events, 'appear')).toHaveLength(1);
  });

  it('ohne Regeln aus dem Paket passiert nichts', () => {
    const world = W();
    const { s, events } = play(awakeAt(world), world, ticks(200), false);
    expect(rideEvents(events)).toEqual([]);
    expect(s.packs).not.toHaveProperty('fahrt');
    // auch nicht ohne Strecke (Welt ohne Paket der Eis-Welt)
    const bare = createWorld(1, []);
    expect(sled.move(awakeAt(world), bare, { type: 'move', dir: 'n', fresh: true }, [])).toBe(false);
    expect(sled.blocks(awakeAt(world, undefined, 'fest'), bare, awakeAt(world).animals[0]!, 0, 0)).toBe(false);
  });

  it('ein neuer Druck steigt ein, gehalten stößt nur an (gedrosselt), das Rentier schnaubt, der Schuppen ist eine Wand', () => {
    const world = W();
    const r = sledRoute(world)!;
    const { s, dir, stop } = beforeSeat(world, 'home');
    // neuer Druck: einsteigen, Figur auf dem Sitz, Fahrt zur Lichtung, Festfahrt
    const board = play(s, world, [{ type: 'move', dir, fresh: true }]);
    expect(rideEvents(board.events).map((e) => e.what)).toEqual(['board']);
    expect(at(board.s)).toEqual(stop.seat);
    expect(board.s.ride).toMatchObject({ phase: 'seated', to: 'out', feast: true, pos: 0 });
    expect(stops(board.events)).toBe('clear'); // aussteigen braucht einen neuen Druck
    // gehalten: anstoßen, nicht laufen; höchstens alle JINGLE_EVERY Takte
    const held = play(s, world, [
      { type: 'move', dir },
      { type: 'move', dir },
      ...ticks(JINGLE_EVERY),
      { type: 'move', dir },
    ]);
    expect(rideEvents(held.events).map((e) => e.what)).toEqual(['nudge', 'nudge']);
    expect(at(held.s)).toEqual(at(s));
    expect(held.s.ride).toBeUndefined();
    // Rentier: schnaubt (die Figur steht auf der Strecke davor)
    const pull = beside(world, s, stop.pull, new Set([...stop.cells]));
    const snort = play({ ...s, player: { ...s.player, ...xy(pull.from) } }, world, [
      { type: 'move', dir: pull.dir, fresh: true },
    ]);
    expect(rideEvents(snort.events).map((e) => e.what)).toEqual(['snort']);
    expect(at(snort.s)).toEqual(pull.from);
    // Schuppen: wie eine Wand (kein Schritt, `bump` wie an jeder Wand)
    const wall = r.shed
      .map((p) => {
        try {
          return beside(world, s, p, new Set([...stop.cells, ...r.on]));
        } catch {
          return undefined;
        }
      })
      .find((b) => b !== undefined)!;
    const shed = play({ ...s, player: { ...s.player, ...xy(wall.from) } }, world, [
      { type: 'move', dir: wall.dir, fresh: true },
    ]);
    expect(shed.events).toEqual([{ type: 'bump' }]);
    expect(at(shed.s)).toEqual(wall.from);
  });

  it('Antippen steigt bis 4 Felder weit ein, weiter weg passiert nichts (kein Laufen per Antippen)', () => {
    const world = W();
    const { stop } = beforeSeat(world, 'home');
    const r = sledRoute(world)!;
    const near = r.path[4]!;
    const tap: Cmd = { type: 'move', dir: 'n', fresh: true, tap: true };
    const ok = play(awakeAt(world, near, 'bereit'), world, [tap]);
    expect(rideEvents(ok.events, 'board')).toHaveLength(1);
    expect(at(ok.s)).toEqual(stop.seat);
    // das erste Feld der Strecke, das weiter als TAP_REACH (Schachbrett) vom Sitz liegt (die Strecke biegt am Schuppen ab)
    const far = r.path.find((p) => Math.max(Math.abs(p[0] - stop.seat[0]), Math.abs(p[1] - stop.seat[1])) > TAP_REACH)!;
    const no = play(awakeAt(world, far, 'bereit'), world, [tap]);
    expect(no.events).toEqual([]);
    expect(at(no.s)).toEqual(far);
    // auf der Lichtung vor dem Fest (dort hält er noch nicht): den Schuppen antippen läuft nicht
    const door = r.path.find((p) => world.realm(...p) === 'lichtung')!;
    const step1 = beside(world, awakeAt(world, door, 'bereit'), door, new Set()).from;
    const lich = awakeAt(world, step1, 'bereit');
    for (const dir of ['n', 'e', 's', 'w'] as const) {
      const t = play(lich, world, [{ type: 'move', dir, fresh: true, tap: true }]);
      expect(t.events).toEqual([]);
      expect(at(t.s)).toEqual(step1);
    }
    // schlafend: Antippen weckt nicht und steigt nicht ein
    const asleep = play({ ...awakeAt(world, near, 'bereit'), sleeping: true }, world, [tap]);
    expect(asleep.events).toEqual([]);
    expect(asleep.s.sleeping).toBe(true);
  });

  it('nachts ist es still: kein Herbeitraben-Bimmeln und kein Verscheuchen, solange die Figur schläft', () => {
    const world = W();
    const came = play(awakeAt(world), world, ticks(DUE + 1)).s; // gerade erschienen, trabt noch herbei
    expect(stageOf(came.packs, 'schlitten')).toBe('bereit');
    const night = play({ ...came, sleeping: true }, world, ticks(COME + 5));
    expect(rideEvents(night.events)).toEqual([]);
    // ein Tier auf dem Sitz hüpft nachts nicht beiseite
    const a = came.animals[0]!;
    const seat = stopsOf(sledRoute(world)!).home.seat;
    const onSeat = { ...came, sleeping: true, animals: [{ ...a, x: seat[0], y: seat[1] }, ...came.animals.slice(1)] };
    expect(rideEvents(play(onSeat, world, ticks(3)).events)).toEqual([]);
  });

  it('ein Pfeil weg in den ersten 2 s steigt aus; danach winkt die Figur nur (gebimmelt wird gedrosselt)', () => {
    const world = W();
    const { s, dir, stop } = beforeSeat(world, 'home');
    const back = ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[dir];
    const seated = play(s, world, [{ type: 'move', dir, fresh: true }, ...ticks(DEPART - 1)]).s;
    expect(seated.ride?.phase).toBe('seated');
    const leave = play(seated, world, [{ type: 'move', dir: back, fresh: true }]);
    expect(rideEvents(leave.events).map((e) => e.what)).toEqual(['leave']);
    expect(leave.s.ride).toBeUndefined();
    expect(at(leave.s)).toEqual(at(s));
    expect(stop.cells.has(keyOf(at(leave.s)))).toBe(false);
    // nach 2 s: losgefahren, jeder Pfeil winkt, gebimmelt wird höchstens alle JINGLE_EVERY Takte
    const going = play(seated, world, [TICK]).s;
    expect(going.ride?.phase).toBe('go');
    const waves = play(going, world, [
      { type: 'move', dir: back, fresh: true },
      { type: 'move', dir: back, fresh: true },
      { type: 'action' },
    ]);
    expect(rideEvents(waves.events).map((e) => [e.what, !!e.ring])).toEqual([
      ['wave', true],
      ['wave', false],
    ]);
    expect(waves.s.ride).toBeDefined();
    expect(waves.s.sleeping).toBe(false);
  });

  // Tief die Seeds 1 bis 20 (eine ganze Welt je Seed, siehe mitwachsen-sled-route.test.ts)
  it.each(seedChunks(seedsFor(seedRange(1, 20)), 10))(
    'die Fahrt dauert 150 bis 200 Takte, kommt immer an, die Glocke einmal je Gegendwechsel (Seeds $label)',
    ({ seeds }) => {
      const wrong: string[] = [];
      for (const seed of seeds) {
        const world = worldOf(seed, ICE);
        const { s, dir } = beforeSeat(world, 'home');
        const out = ride(world, s, dir);
        const stopped = rideEvents(out.events, 'stop').length;
        const took = out.arriveAt - out.goAt;
        if (out.s.ride || out.arriveAt < 0) wrong.push(`Seed ${seed}: nicht angekommen`);
        if (took < 150 || took > 200 + stopped * SHOO) wrong.push(`Seed ${seed}: ${took} Takte`);
        const realms = out.events.filter((e) => e.type === 'realm');
        if (realms.length !== 1 || world.realm(...at(out.s)) !== 'lichtung')
          wrong.push(`Seed ${seed}: Glocke ${realms.length}`);
        const end = stopsOf(sledRoute(world)!).out.seat;
        if (Math.max(Math.abs(end[0] - out.s.player.x), Math.abs(end[1] - out.s.player.y)) > 2)
          wrong.push(`Seed ${seed}: steigt fern vom Halt aus`);
      }
      expect(wrong).toEqual([]);
    },
  );

  it('Folgende warten am Halt, reihen sich nach der Rückfahrt mit dem ersten Schritt wieder ein, beim Schlafen gehen sie heim', () => {
    const world = W();
    const { s: s0, dir, stop } = beforeSeat(world, 'home');
    const r = sledRoute(world)!;
    // ein Eis-Tier folgt der Figur (steht hinter ihr)
    const fid = s0.animals.find((a) => a.realm === 'eis' && a.mode === 'wander')!.id;
    const spot = beside(world, s0, at(s0), new Set([...stop.cells, ...r.on, keyOf(at(s0))])).from;
    const s: State = {
      ...s0,
      animals: s0.animals
        .filter((a) => a.x !== spot[0] || a.y !== spot[1])
        .map((a) => (a.id === fid ? { ...a, mode: 'follow' as const, x: spot[0], y: spot[1] } : a)),
      followers: [fid],
    };
    const there = ride(world, s, dir);
    const waiter = () => there.s.animals.find((a) => a.id === fid)!;
    expect(there.events.filter((e) => e.type === 'wait').map((e) => (e as { id: string }).id)).toEqual([fid]);
    expect(waiter().mode).toBe('wait');
    expect(r.seats.home.map(keyOf)).toContain(keyOf([waiter().x, waiter().y]));
    expect(there.s.followers).toEqual([]);
    // auf der Lichtung: ein Schritt reiht es nicht ein (es wartet in der Eis-Welt)
    const walk = play(there.s, world, [{ type: 'move', dir: free(world, there.s), fresh: true }]);
    expect(walk.events.some((e) => e.type === 'rejoin')).toBe(false);
    // zurück: einsteigen auf der Lichtung (jetzt `fest`), heim, ein Schritt reiht es wieder ein
    const outStop = stopsOf(r).out;
    const b = beside(world, walk.s, outStop.seat, r.on);
    const home = ride(world, { ...walk.s, player: { ...walk.s.player, ...xy(b.from) } }, b.dir);
    expect(home.s.ride).toBeUndefined();
    expect(world.realm(...at(home.s))).toBe('eis');
    const step1 = play(home.s, world, [{ type: 'move', dir: free(world, home.s), fresh: true }]);
    expect(step1.events.filter((e) => e.type === 'rejoin').map((e) => (e as { id: string }).id)).toEqual([fid]);
    expect(step1.s.followers).toEqual([fid]);
    // schlafen: das wartende Tier geht heim
    const bed = world.homes.lichtung.bed;
    const night = play({ ...there.s, player: { x: bed[0] + 1, y: bed[1], dir: 'w' }, wokeAt: -100 }, world, [
      { type: 'action' },
    ]);
    expect(night.s.sleeping).toBe(true);
    expect(night.s.animals.find((a) => a.id === fid)!.mode).toBe('wander');
  });

  it('Hindernis: hält davor, nach SHOO Takten hüpft das Tier beiseite, nie hindurch', () => {
    const world = W();
    const r = sledRoute(world)!;
    const { s, dir } = beforeSeat(world, 'home');
    let cur = play(s, world, [{ type: 'move', dir, fresh: true }, ...ticks(DEPART + 30)]).s;
    expect(cur.ride?.phase).toBe('go');
    // ein Tier stellt sich zwei Felder vor den Sitz
    const i = Math.floor(cur.ride!.pos + 1e-6);
    const block = cellOf(r, cur.ride!, i + 2);
    const goat = {
      ...cur.animals[0]!,
      id: 'test:hindernis',
      mode: 'home' as const,
      x: block[0],
      y: block[1],
      rest: 999,
    };
    cur = { ...cur, animals: [...cur.animals.filter((a) => a.x !== block[0] || a.y !== block[1]), goat] };
    const stopped = play(cur, world, [TICK]);
    expect(rideEvents(stopped.events).map((e) => [e.what, e.who])).toEqual([['stop', goat.id]]);
    const pos = stopped.s.ride!.pos;
    const wait = play(stopped.s, world, ticks(SHOO - 1));
    expect(wait.s.ride!.pos).toBe(pos);
    expect(rideEvents(wait.events)).toEqual([]);
    const shoo = play(wait.s, world, [TICK]);
    expect(rideEvents(shoo.events).map((e) => e.what)).toEqual(['shoo']);
    const moved = shoo.s.animals.find((a) => a.id === goat.id)!;
    expect(r.on.has(keyOf([moved.x, moved.y]))).toBe(false);
    expect(shoo.s.ride!.pos).toBeGreaterThan(pos);
    // ohne Platz zum Beiseitehüpfen (alles ringsum Plattform) bleibt es stehen und versucht es gleich noch einmal
    const cramped: World = {
      ...world,
      cell: (x, y) =>
        r.on.has(keyOf([x, y])) ? world.cell(x, y) : { ...world.cell(x, y), portal: { gate: 'x' } as never },
    };
    const engine = engineOf({ spec: SLED, route: (): RideRoute => r, ready: () => false });
    const stuck = { ...wait.s, tick: wait.s.tick + 1 };
    const events: RideEvent[] = [];
    engine.tick(stuck, cramped, { push: (...e) => events.push(...(e as RideEvent[])) });
    expect(stuck.ride!.phase).toBe('stop');
    expect(events).toEqual([]);
  });

  it('das Fest kommt nur bei der ersten Heimfahrt und genau einmal; zu Fuß heim lässt `bereit` stehen', () => {
    const world = W();
    const r = sledRoute(world)!;
    // zu Fuß heim: kein Schlitten auf der Lichtung, `bereit` bleibt
    const foot = play(awakeAt(world, stopsOf(r).out.seat, 'bereit'), world, ticks(50));
    expect(stageOf(foot.s.packs, 'schlitten')).toBe('bereit');
    expect(parked(SLED, r, foot.s, world)).toBeUndefined();
    const b0 = beside(world, foot.s, stopsOf(r).out.seat, r.on);
    const noBoard = play({ ...foot.s, player: { ...foot.s.player, ...xy(b0.from) } }, world, [
      { type: 'move', dir: b0.dir, fresh: true },
    ]);
    expect(rideEvents(noBoard.events)).toEqual([]);
    // erste Heimfahrt: Fest, Abschied, Winken am Weg
    const { s, dir } = beforeSeat(world, 'home');
    const first = ride(world, s, dir);
    expect(rideEvents(first.events, 'feast')).toHaveLength(1);
    expect(rideEvents(first.events, 'feast')[0]!.persist).toBe(true);
    expect(rideEvents(first.events, 'farewell')).toHaveLength(1);
    const cheers = rideEvents(first.events, 'cheer').map((e) => e.who);
    expect(new Set(cheers).size).toBe(cheers.length); // jedes winkt einmal
    expect(stageOf(first.s.packs, 'schlitten')).toBe('fest');
    // zurück und wieder hin: kein Fest mehr
    const b = beside(world, first.s, stopsOf(r).out.seat, r.on);
    const back = ride(world, { ...first.s, player: { ...first.s.player, ...xy(b.from) } }, b.dir);
    expect(back.s.ride).toBeUndefined();
    const c = beside(world, back.s, stopsOf(r).home.seat, r.on);
    const again = ride(world, { ...back.s, player: { ...back.s.player, ...xy(c.from) } }, c.dir);
    expect(
      [...rideEvents(back.events), ...rideEvents(again.events)].filter(
        (e) => e.what === 'feast' || e.what === 'cheer' || e.what === 'farewell',
      ),
    ).toEqual([]);
    expect(stageOf(again.s.packs, 'schlitten')).toBe('fest');
  });

  // Tief die Seeds 1 bis 20 (eine ganze Welt je Seed, siehe mitwachsen-sled-route.test.ts)
  it.each(seedChunks(seedsFor(seedRange(1, 20)), 10))(
    'auf der Festfahrt winken die Eis-Tiere der Schneewiese beim Losfahren, jedes einmal (Seeds $label)',
    ({ seeds }) => {
      const wrong: string[] = [];
      for (const seed of seeds) {
        const world = worldOf(seed, ICE);
        const { s, dir } = beforeSeat(world, 'home');
        const home = s.animals.filter((a) => a.realm === 'eis' && a.mode === 'home').map((a) => a.id);
        const go = play(play(s, world, [{ type: 'move', dir, fresh: true }]).s, world, ticks(DEPART));
        const cheered = new Set(rideEvents(go.events, 'cheer').map((e) => e.who));
        if (!home.length) wrong.push(`Seed ${seed}: niemand zu Hause`);
        const missing = home.filter((id) => !cheered.has(id));
        if (missing.length) wrong.push(`Seed ${seed}: ${missing.join(' ')} winkt nicht`);
      }
      expect(wrong).toEqual([]);
    },
  );

  it('fertige Schneemänner in der Nähe winken auf der Festfahrt mit, halbe nicht', () => {
    const world = W();
    const heap = kesselPlace(1, EIS_PACK).cells.find(([x, y]) => world.cell(x, y).deco === 'snowheap')!;
    const s = awakeAt(world, [heap[0] + 1, heap[1]]);
    const built = (stage: number) => ({ ...s, packs: { ...s.packs, eis: { v: 1, snow: { [keyOf(heap)]: stage } } } });
    expect(snowmen(built(SNOWMAN), world)).toEqual([{ who: `schneemann:${keyOf(heap)}`, x: heap[0], y: heap[1] }]);
    expect(snowmen(built(SNOWMAN - 1), world)).toEqual([]);
  });

  it('die Figur schläft nie im Schlitten: jeder Pfeil und jede Aktion unterwegs winkt nur', () => {
    const world = W();
    const { s, dir } = beforeSeat(world, 'home');
    let cur = play(s, world, [{ type: 'move', dir, fresh: true }]).s;
    const all: Dir[] = ['n', 'e', 's', 'w'];
    let slept = false;
    for (let i = 0; cur.ride && i < 400; i++) {
      const d = all[i % 4]!;
      const cmds: Cmd[] =
        cur.ride.phase === 'seated' ? [TICK, { type: 'action' }] : [{ type: 'move', dir: d }, { type: 'action' }, TICK];
      cur = play(cur, world, cmds).s;
      slept ||= cur.sleeping;
    }
    expect(slept).toBe(false);
    expect(cur.ride).toBeUndefined();
  });

  it('wandernde Tiere betreten Strecke und Halte nicht; Halte sperren alle, die Lichtung erst ab `fest`', () => {
    const world = W();
    const r = sledRoute(world)!;
    const stop = stopsOf(r);
    const s = awakeAt(world, undefined, 'bereit');
    const a = s.animals[0]!;
    const wander = { ...a, mode: 'wander' as const };
    const homing = { ...a, mode: 'home' as const };
    const kessel = r.path[Math.floor(r.path.length / 4)]!;
    const lichtung = r.path[r.path.length - 5]!;
    expect(sled.blocks(s, world, wander, ...kessel)).toBe(true);
    expect(sled.blocks(s, world, homing, ...kessel)).toBe(false); // heimkehrende kreuzen
    expect(sled.blocks(s, world, homing, ...stop.home.seat)).toBe(true);
    expect(sled.blocks(s, world, homing, ...r.shed[0]!)).toBe(true);
    expect(sled.blocks(s, world, wander, ...lichtung)).toBe(false); // vor dem Fest nicht
    expect(sled.blocks(s, world, homing, ...stop.out.seat)).toBe(false);
    const fest = { ...s, packs: withRide(s.packs, 'schlitten', 'fest') };
    expect(sled.blocks(fest, world, wander, ...lichtung)).toBe(true);
    expect(sled.blocks(fest, world, homing, ...stop.out.pull)).toBe(true);
    expect(sled.blocks(awakeAt(world), world, wander, ...kessel)).toBe(false); // noch kein Schlitten
    // im Spiel: 600 Takte lang betritt kein wanderndes Tier Strecke oder Halt
    let cur = play(s, world, []).s;
    const busy = new Set([...r.on, ...stop.home.cells]);
    const wrong: string[] = [];
    for (let i = 0; i < 600; i++) {
      const before = new Map(cur.animals.map((x) => [x.id, keyOf([x.x, x.y])]));
      cur = play(cur, world, [TICK]).s;
      for (const x of cur.animals)
        if (
          x.mode === 'wander' &&
          before.get(x.id) !== keyOf([x.x, x.y]) &&
          busy.has(keyOf([x.x, x.y])) &&
          world.cell(x.x, x.y).ride
        )
          wrong.push(`${x.id} ${keyOf([x.x, x.y])}`);
    }
    expect(wrong).toEqual([]);
  });

  it('Neuladen mitten in der Fahrt: Die Figur wacht im Bett der Gegend auf, der Schlitten steht an ihrem Halt', () => {
    const world = W();
    const r = sledRoute(world)!;
    const { s, dir } = beforeSeat(world, 'home', 'fest');
    const start = play(s, world, [{ type: 'move', dir, fresh: true }, ...ticks(DEPART + 40)]).s;
    const late = play(start, world, ticks(130)).s;
    for (const mid of [start, late]) {
      expect(mid.ride?.phase).toBe('go');
      const realm = world.realm(...at(mid));
      const back = initialState(world, progressOf(mid));
      expect(back.ride).toBeUndefined();
      expect(back.sleeping).toBe(true);
      expect(at(back)).toEqual(world.homes[realm].bed);
      const woke = play(back, world, [{ type: 'move', dir: 's' }, TICK]).s;
      expect(parked(SLED, r, woke, world)?.end).toBe(realm === 'eis' ? 'home' : 'out');
    }
  });

  it.each([1, 2, 3])(
    'Invariante (Seed %i): 4000 Zufallsbefehle samt Fahrten, nie zwei Wesen auf einem Feld, Figur begehbar, jede Fahrt endet',
    (seed) => {
      const world = worldOf(seed, ICE);
      const a = chaos(world, seed);
      const b = chaos(world, seed);
      expect(a.wrong).toEqual([]);
      expect(a.rides).toBeGreaterThanOrEqual(3);
      expect(b.s).toEqual(a.s); // gleiche Befehle ergeben dasselbe
      expect(b.events).toEqual(a.events);
    },
  );
});

const xy = ([x, y]: Point) => ({ x, y });

/**
 * Zufallsbefehle (feste Folge je Seed): Takte, Pfeile (neu gedrückt oder gehalten), Antippen des Schlittens, Aktion.
 * Nach jedem Befehl: nie zwei Wesen auf einem Feld, die wache Figur steht begehbar, jede Fahrt endet rechtzeitig.
 */
function chaos(world: World, seed: number) {
  const r = sledRoute(world)!;
  const start = beside(world, awakeAt(world, stopsOf(r).home.seat, 'bereit'), stopsOf(r).home.seat, r.on).from;
  let s = awakeAt(world, start, 'bereit');
  let rng = seed * 7919;
  const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
  const all: Dir[] = ['n', 'e', 's', 'w'];
  const events: GameEvent[] = [];
  const wrong: string[] = [];
  let rides = 0;
  let trip: { from: number; stops: number } | undefined;
  for (let i = 0; i < 4000; i++) {
    const p = rand();
    const d = all[Math.floor(rand() * 4)]!;
    const cmd: Cmd =
      p < 0.55
        ? TICK
        : p < 0.8
          ? { type: 'move', dir: d, ...(rand() < 0.5 ? { fresh: true } : {}) }
          : p < 0.95
            ? { type: 'move', dir: d, fresh: true, tap: true }
            : { type: 'action' };
    const n = play(s, world, [cmd]);
    s = n.s;
    events.push(...n.events);
    if (rideEvents(n.events, 'board').length) {
      rides++;
      trip = { from: s.tick, stops: 0 };
    }
    if (trip) trip.stops += rideEvents(n.events, 'stop').length;
    if (trip && !s.ride) trip = undefined;
    if (trip && s.tick - trip.from > DEPART + 200 + trip.stops * SHOO + ALIGHT) wrong.push(`${i}: Fahrt endet nicht`);
    const cells = [...(s.sleeping ? [] : [at(s)]), ...s.animals.map((a): Point => [a.x, a.y])].map(keyOf);
    if (new Set(cells).size !== cells.length) wrong.push(`${i}: zwei Wesen auf einem Feld`);
    if (!s.sleeping && standHeight(world, s.openGates, ...at(s)) === null)
      wrong.push(`${i}: Figur auf ${keyOf(at(s))}`);
  }
  return { s, events, wrong: [...new Set(wrong)].slice(0, 10), rides };
}
