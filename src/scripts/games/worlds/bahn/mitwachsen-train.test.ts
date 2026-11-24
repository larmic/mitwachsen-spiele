// Fahren mit der Höhlenbahn (Schritt 4): der Zug als Fahrzeug der Fahr-Engine (Paket der Fahrzeuge), Strecke aus dem
// Gleis (mitwachsen-train.ts), Bild und Ton (mitwachsen-station-look.ts, mitwachsen-train-look.ts). Reine Regeln über
// `step` mit den Paketen wie im Spiel; die Strecke über viele Seeds prüft mitwachsen-line.test.ts
import { describe, expect, it } from 'vitest';
import { fromKey } from '../../../../lib/games/chunks';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { animalId, type Point } from '../../../../data/games/mitwachsen';
import { BAHN_LIVE, RIDES, RIDE_PRELOAD } from '../../../../data/games/mitwachsen-rides';
import { BESIDE, plateRow } from '../../mitwachsen-bay';
import { TUNNEL_LIGHT } from '../../mitwachsen-dusk';
import { bahnWanted } from '../../mitwachsen-pack';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { ALIGHT, DEPART, JINGLE_EVERY, SHOO, SNORE_EVERY, TAP_REACH, parked, stopsOf } from '../../mitwachsen-ride-kit';
import { ridden, withTok } from '../../mitwachsen-ride-save';
import { BENCH } from '../../mitwachsen-border';
import { SLEEP_LOCK } from '../../mitwachsen-state';
import type { RideAt } from '../../mitwachsen-ride-view';
import type { RideRoute, Vehicle } from '../../mitwachsen-rider';
import { initialState, progressOf, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import { bayOf } from './mitwachsen-tok';
import type { World } from '../../mitwachsen-world';
import { BAHN_PACK, BUILT, EIS_PACK, FAHRT_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { withBuilt } from './mitwachsen-built';
import { stationBodies, stationOf } from './mitwachsen-station-look';
import { AHEAD, CARS, SEAT, TRAIN, lineOf, train, trainRoute } from './mitwachsen-train';
import { UH_UH, dim, trainFx, trainScores } from './mitwachsen-train-look';
import { view } from './view-2d';

/** Die Linie bis zum Prellbock in der Bucht (Ausbau 1, nur die Lichtung) und die ganze bis Bahnhof Fledermaus */
const W1 = worldOf(1, [BAHN_PACK], { bahn: { built: 1 } });
const W2 = worldOf(1, [HOEHLE_PACK, BAHN_PACK], BUILT);
/** Spielstand nach Bau 1: Ausbau 1, der Zug steht da (Stufe `bereit`) */
const READY = withBuilt(withTok({}, { stage: 'bereit' }), 1);
const FAR = withBuilt(READY, 2);
/** Die Pakete wie im Spiel: Bahn (Tok, Zug) und die Fahr-Engine */
const RULES = [BAHN_PACK, FAHRT_PACK];
const TICK: Cmd = { type: 'tick' };
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const keyOf = ([x, y]: Point) => `${x},${y}`;
const pos = (s: State): Point => [s.player.x, s.player.y];

type Run = { s: State; events: GameEvent[] };
function play(s: State, world: World, cmds: readonly Cmd[], rules: readonly (typeof RULES)[number][] = RULES): Run {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, c, undefined, undefined, rules);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
const ticks = (n: number): Cmd[] => Array.from({ length: n }, () => TICK);
const rides = (e: readonly GameEvent[], what?: RideEvent['what']) =>
  e.filter((x): x is RideEvent => x.type === 'ride' && (!what || x.what === what));

/** Wach, ohne Tiere (die kommen, wo ein Test sie braucht), die Figur auf `p` */
function awake(world: World, p: Point, packs = READY, more: Partial<State> = {}): State {
  const s = initialState(world, { packs });
  return { ...s, sleeping: false, wokeAt: -100, player: { x: p[0], y: p[1], dir: 's' }, animals: [], ...more };
}

/** Auf dem Bahnsteig von Bahnhof Bär neben dem mittleren Wagen, samt Richtung zum Zug */
function onPlatform(world: World): { at: Point; dir: Dir } {
  const st = stationOf(world)!;
  const row = st.rows[SEAT]!;
  const lane = st.line[SEAT]!;
  const dir = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(
    ([, [dx, dy]]) => row.edge[0] + dx === lane[0] && row.edge[1] + dy === lane[1],
  )![0];
  return { at: row.edge, dir };
}

/** Einsteigen und fahren, bis die Figur ausgestiegen ist */
function ride(world: World, s: State, dir: Dir, limit = 400): Run & { boardAt: number; arriveAt: number } {
  let r = play(s, world, [{ type: 'move', dir, fresh: true }]);
  const boardAt = r.s.tick;
  let arriveAt = -1;
  for (let i = 0; i < limit && r.s.ride; i++) {
    const n = play(r.s, world, [TICK]);
    if (rides(n.events, 'arrive').length) arriveAt = n.s.tick;
    r = { s: n.s, events: [...r.events, ...n.events] };
  }
  return { ...r, boardAt, arriveAt };
}

describe('Fahren mit der Höhlenbahn: Strecke und Paket (mitwachsen-train.ts)', () => {
  it('kommt mit dem Paket der Bahn: Fahrzeug über `rules.vehicle`, Bild, Ton und Licht über die Haken der Ansicht', () => {
    expect(BAHN_PACK.rules!.vehicle).toBe(train);
    expect(train.spec).toBe(RIDES.find((r) => r.id === 'hoehle'));
    expect('ready' in train).toBe(false); // er erscheint nie von selbst: Tok baut ihn
    expect(view).toMatchObject({ bodies: stationBodies, rideFx: trainFx, dim });
  });

  it('Freigabe (beide Stellungen): ohne das Paket der Bahn gibt es keinen Zug, freigeschaltet kommt es mit dem Eistor', () => {
    expect(BAHN_LIVE).toBe(false);
    expect(bahnWanted({ openGates: ['eis'] })).toBe(false); // bis zum Freischalten holt das Spiel es nie
    expect(bahnWanted({ openGates: ['eis'] }, true)).toBe(true);
    const { at, dir } = onPlatform(W1);
    const s = awake(W1, at);
    const without = play(s, W1, [{ type: 'move', dir, fresh: true }], [EIS_PACK, FAHRT_PACK]);
    expect(rides(without.events)).toEqual([]); // ohne Paket: kein Zug, kein Einsteigen
    const withIt = play(s, W1, [{ type: 'move', dir, fresh: true }]);
    expect(rides(withIt.events, 'board')).toHaveLength(1);
  });

  it('Strecke bei Ausbau 1: vom Prellbock in der Bucht bis Bahnhof Bär, Wagen am Halt, Bank, Tunnel; vorher keine', () => {
    expect(trainRoute(W1, { packs: {}, openGates: [] })).toBeUndefined(); // vor Ausbau 1 kein Gleis, kein Zug
    const r = trainRoute(W1, { packs: READY, openGates: [] })!;
    const line = lineOf(W1, false);
    const g = W1.gates.get('hoehle')!;
    expect(r.path[0]).toEqual(line.at(-1 - SEAT));
    expect(r.path.at(-1)).toEqual(line[SEAT]);
    expect(r.cars!.out).toEqual(line.slice(0, CARS));
    expect(r.cars!.home).toEqual(line.slice(-CARS));
    expect(r.ahead).toBe(AHEAD);
    expect(W1.cell(...line.at(-1)!).rail?.part).toBe('end'); // ohne Grotte endet das Gleis am Prellbock vor der Tür
    expect(Math.abs(line.at(-1)![0] - g.mid[0]) + Math.abs(line.at(-1)![1] - g.mid[1])).toBeLessThanOrEqual(4);
    expect(r.seats.out.length).toBeGreaterThan(0);
    expect(r.seats.out.every((p) => W1.cell(...p).stop === 'hoehle')).toBe(true); // die Bank auf dem Bahnsteig
    const tok = keyOf(plateRow(g, BESIDE));
    expect(r.seats.home.filter((p) => W1.cell(...p).plate || keyOf(p) === tok || r.on.has(keyOf(p)))).toEqual([]);
    const parts = [...r.dark!].map((k) => W1.cell(...fromKey(k)).rail?.part);
    expect(parts).toEqual(expect.arrayContaining(['portal', 'cut']));
    expect(trainRoute(W1, { packs: READY, openGates: [] })).toBe(r); // je Welt einmal gerechnet
  });

  it('Ausbau 2 und offenes Höhlentor: bis an Bahnhof Fledermaus in der Grotte; Tor zu: wie Ausbau 1 bis zum Prellbock', () => {
    const shut = trainRoute(W2, { packs: FAR, openGates: [] })!;
    const open = trainRoute(W2, { packs: FAR, openGates: ['hoehle'] })!;
    expect(W2.realm(...shut.stops.home)).toBe('lichtung');
    expect(W2.realm(...open.stops.home)).toBe('hoehle');
    expect(open.seats.home.some((p) => W2.cell(...p).stop === 'hoehle')).toBe(true); // der Steinbahnsteig
    expect(open.path.length).toBeGreaterThan(shut.path.length);
    expect(trainRoute(W2, { packs: READY, openGates: ['hoehle'] })!.path).toEqual(shut.path); // Ausbau 1: nur bis dort
  });
});

describe('Fahren mit der Höhlenbahn: Regeln (Fahr-Engine mit dem Zug)', () => {
  const { at, dir } = onPlatform(W1);
  const r1 = trainRoute(W1, { packs: READY, openGates: [] })!;

  it('steht nach Bau 1 an Bahnhof Bär; gehalten stößt ein Pfeil nur an (Tuten, Tür auf, gedrosselt), ein neuer Druck steigt ein', () => {
    const s = awake(W1, at);
    expect(parked(TRAIN, r1, s, W1)?.end).toBe('out');
    const held = play(s, W1, [{ type: 'move', dir }]);
    expect(rides(held.events).map((e) => e.what)).toEqual(['nudge']);
    expect(held.s.ride).toBeUndefined();
    expect(pos(held.s)).toEqual(at); // durch den Zug läuft niemand
    expect(held.s.nudged).toEqual({ id: 'hoehle', at: held.s.tick });
    const again = play(held.s, W1, [...ticks(3), { type: 'move', dir }]);
    expect(rides(again.events)).toEqual([]); // gedrosselt
    const later = play(held.s, W1, [...ticks(JINGLE_EVERY), { type: 'move', dir }]);
    expect(rides(later.events, 'nudge')).toHaveLength(1);
    const board = play(s, W1, [{ type: 'move', dir, fresh: true }]);
    expect(rides(board.events).map((e) => e.what)).toEqual(['board']);
    expect(board.s.ride).toMatchObject({ id: 'hoehle', phase: 'seated', to: 'home', feast: false });
    expect(pos(board.s)).toEqual(r1.stops.out); // die Figur sitzt im mittleren Wagen
    // jeder Wagen ist zum Einsteigen da
    const front = stopsOf(r1).out;
    expect(front.board.size).toBe(CARS);
  });

  it('Antippen steigt bis 4 Felder weit ein (nur das angetippte Fahrzeug), weiter weg passiert nichts', () => {
    const near = awake(W1, at);
    const tap: Cmd = { type: 'move', dir, fresh: true, tap: true, ride: 'hoehle' };
    expect(rides(play(near, W1, [tap]).events, 'board')).toHaveLength(1);
    expect(rides(play(near, W1, [{ ...tap, ride: 'schlitten' }]).events)).toEqual([]); // der Schlitten war gemeint
    const seat = r1.stops.out;
    const far = W1.homes.lichtung.bed;
    expect(Math.max(Math.abs(far[0] - seat[0]), Math.abs(far[1] - seat[1]))).toBeGreaterThan(TAP_REACH);
    const fromBed = play(awake(W1, far), W1, [tap]);
    expect(rides(fromBed.events)).toEqual([]);
    expect(pos(fromBed.s)).toEqual(far); // gelaufen wird per Antippen nie
  });

  it('in den ersten 2 s steigt ein Pfeil weg wieder aus; danach winkt die Figur, der Zug tutet höchstens alle 1,5 s', () => {
    const back = (Object.keys(DIRS) as Dir[]).find(
      (d) => DIRS[d][0] === -DIRS[dir][0] && DIRS[d][1] === -DIRS[dir][1],
    )!;
    const seated = play(awake(W1, at), W1, [{ type: 'move', dir, fresh: true }, ...ticks(5)]).s;
    const off = play(seated, W1, [{ type: 'move', dir: back, fresh: true }]);
    expect(rides(off.events).map((e) => e.what)).toEqual(['leave']);
    expect(off.s.ride).toBeUndefined();
    const going = play(seated, W1, ticks(DEPART)).s;
    expect(going.ride!.phase).toBe('go');
    const waves = play(going, W1, [{ type: 'move', dir: back, fresh: true }, ...ticks(1), { type: 'move', dir: back }]);
    const w = rides(waves.events, 'wave');
    expect(w).toHaveLength(2);
    expect(w.map((e) => !!e.ring)).toEqual([true, false]); // getutet wird gedrosselt, gewinkt immer
    expect(waves.s.ride).toBeDefined(); // gelenkt wird nie
    expect(trainFx(w[0]!)!.who).toBe('player');
  });

  it('erste Fahrt (Ausbau 1): bis zum Prellbock in der Bucht, „Uh-uh“ vor dem Tunnel, Licht im Tunnel gedimmt, aussteigen, Tok hüpft an seinen Platz', () => {
    const run = ride(W1, awake(W1, at), dir);
    const len = r1.path.length - 1;
    // 15–20 s wie jede Fahrt; die kurze Strecke bis zum Prellbock fährt er langsamer als sein Höchsttempo (8 Felder je s)
    const took = run.arriveAt - run.boardAt - DEPART - SHOO * rides(run.events, 'stop').length;
    expect(took).toBe(Math.max(TRAIN.ticks[0], Math.round(len / TRAIN.pace!)));
    expect(took).toBeLessThanOrEqual(TRAIN.ticks[1]);
    expect(len / took).toBeLessThanOrEqual(TRAIN.pace!);
    expect(rides(run.events, 'tunnel')).toHaveLength(1);
    expect(rides(run.events, 'alight')).toHaveLength(1);
    const out = run.s;
    expect(out.ride).toBeUndefined();
    expect(W1.cell(...pos(out)).plate).toBeUndefined(); // nie auf die Torplatte
    expect(W1.cell(...pos(out)).ride).toBeUndefined();
    const home = r1.stops.home;
    expect(Math.max(Math.abs(out.player.x - home[0]), Math.abs(out.player.y - home[1]))).toBeLessThanOrEqual(2);
    // Tok hüpft aus dem hinteren Wagen an seinen Platz neben der Torplatte
    const g = W1.gates.get('hoehle')!;
    const tok = out.animals.find((a) => a.id === animalId('hoehle', 'tok'))!;
    expect([tok.x, tok.y]).toEqual(plateRow(g, BESIDE));
    expect(tok.mode).toBe('herald');
    expect(rides(run.events, 'guest').map((e) => e.who)).toEqual([tok.id]);
    expect(trainFx(rides(run.events, 'guest')[0]!)).toMatchObject({ who: tok.id, heart: true });
    // der Zug bleibt in der Bucht stehen (beide Halte liegen auf der Lichtung: wo er zuletzt ankam)
    expect(out.docked).toEqual({ hoehle: 'home' });
    expect(parked(TRAIN, r1, out, W1)?.end).toBe('home');
    // gespeichert wird nur, dass die erste Fahrt gemacht ist (gleich beim Aussteigen), nie, wo Zug und Tok stehen
    expect(progressOf(out).packs).toEqual(withTok(READY, { stage: 'bereit', gefahren: true }));
    expect(rides(run.events, 'alight')[0]!.persist).toBe(true);
    // unterwegs im Tunnel ist das Licht gedimmt, sonst nicht
    let dimmed = 0;
    let s = play(awake(W1, at), W1, [{ type: 'move', dir, fresh: true }]).s;
    while (s.ride) {
      if (dim(s, W1) === TUNNEL_LIGHT) dimmed++;
      s = play(s, W1, [TICK]).s;
    }
    expect(dimmed).toBeGreaterThan(0);
    expect(dim(s, W1)).toBe(1);
  });

  it('zurück zum Bahnhof Bär: einsteigen am Prellbock, Tok bleibt in der Bucht; nach dem Laden steht der Zug wieder an Bahnhof Bär', () => {
    const there = ride(W1, awake(W1, at), dir).s;
    const seat = r1.stops.home;
    const into = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(([, [dx, dy]]) =>
      stopsOf(r1).home.board.has(keyOf([there.player.x + dx, there.player.y + dy])),
    );
    const s = into ? there : { ...there, player: { ...there.player, x: seat[0] + 1, y: seat[1] } };
    const d = into?.[0] ?? 'w';
    const back = ride(W1, s, d);
    expect(rides(back.events, 'board')).toHaveLength(1);
    expect(back.s.docked).toEqual({ hoehle: 'out' });
    expect(back.s.animals.some((a) => a.id === animalId('hoehle', 'tok'))).toBe(true); // er wartet neben der Torplatte
    expect(rides(back.events, 'guest')).toEqual([]);
    // neu geladen: kein `docked`, der Zug steht an Bahnhof Bär, Tok sitzt wieder im Zug
    const reload = awake(W1, plateRow(W1.gates.get('hoehle')!, -4), progressOf(there).packs);
    expect(reload.docked).toBeUndefined();
    expect(parked(TRAIN, r1, reload, W1)?.end).toBe('out');
    const rear = stationBodies(reload, W1, AT).find((b) => b.id === 'ride:hoehle:rear')!;
    expect(rear.key.startsWith('ride:hoehle:rear:1')).toBe(true);
  });

  it('Tok in der Bucht: nachts sitzt er neben dem Bett der Lichtung, morgens ruft er und hüpft zurück an seinen Platz', () => {
    const there = ride(W1, awake(W1, at), dir).s;
    const tokId = animalId('hoehle', 'tok');
    const g = W1.gates.get('hoehle')!;
    const bed = W1.homes.lichtung.bed;
    const night = play({ ...there, player: { x: bed[0] + 1, y: bed[1], dir: 'w' }, wokeAt: -100 }, W1, [
      { type: 'action' },
    ]);
    expect(night.s.sleeping).toBe(true);
    const sleeping = night.s.animals.find((a) => a.id === tokId)!;
    expect(Math.max(Math.abs(sleeping.x - bed[0]), Math.abs(sleeping.y - bed[1]))).toBeLessThanOrEqual(2);
    expect(sleeping.nap).toBeUndefined(); // er wacht über sie
    // morgens: ein Ruf, dann hüpft er zurück neben die Torplatte und schaut zum Tor
    const morning = play(night.s, W1, [...ticks(SLEEP_LOCK), { type: 'move', dir: 's', fresh: true }]);
    expect(morning.s.sleeping).toBe(false);
    expect(morning.events.some((e) => e.type === 'herald' && e.what === 'call')).toBe(true);
    let s = morning.s;
    const field = bayOf(W1)!.field;
    expect(field.has(keyOf([sleeping.x, sleeping.y]))).toBe(true);
    const tokAt = (st: State) => st.animals.find((a) => a.id === tokId)!;
    const post = keyOf(plateRow(g, BESIDE));
    const most = 2 * (field.get(keyOf([sleeping.x, sleeping.y]))! + 10); // ein Feld je `PACE.lead` = 2 Takte, mit Luft
    for (let i = 0; i < most && keyOf([tokAt(s).x, tokAt(s).y]) !== post; i++) s = play(s, W1, [TICK]).s;
    const back = s.animals.find((a) => a.id === tokId)!;
    expect([back.x, back.y]).toEqual(plateRow(g, BESIDE));
    expect(play(s, W1, [TICK]).s.animals.find((a) => a.id === tokId)!.mode).toBe('herald');
  });

  it('Hindernis: ein Tier auf dem Gleis, Halt mit freundlichem Tuten, nach 1 s hüpft es beiseite, nie hindurch', () => {
    const going = play(awake(W1, at), W1, [{ type: 'move', dir, fresh: true }, ...ticks(DEPART + 1)]).s;
    const i = Math.floor(going.ride!.pos);
    const block = r1.path[r1.path.length - 1 - (i + AHEAD)]!; // auf der Fahrt zum Prellbock rückwärts auf `path`
    const hase = {
      ...initialState(W1).animals[0]!,
      id: 'lichtung:hase',
      species: 'hase' as const,
      x: block[0],
      y: block[1],
    };
    const s: State = { ...going, animals: [{ ...hase, mode: 'wander' as const }] };
    const stopped = play(s, W1, [TICK]);
    expect(rides(stopped.events).map((e) => [e.what, e.who])).toEqual([['stop', 'lichtung:hase']]);
    expect(trainScores(rides(stopped.events)[0]!).length).toBe(2); // zweimal freundlich tuten
    const p = stopped.s.ride!.pos;
    const wait = play(stopped.s, W1, ticks(SHOO - 1));
    expect(wait.s.ride!.pos).toBe(p);
    const shoo = play(wait.s, W1, [TICK]);
    expect(rides(shoo.events).map((e) => e.what)).toEqual(['shoo']);
    const moved = shoo.s.animals[0]!;
    expect(r1.on.has(keyOf([moved.x, moved.y]))).toBe(false);
    expect(shoo.s.ride!.pos).toBeGreaterThan(p);
  });

  it('nie hindurch, auch nicht am Ziel: steht ein Tier dort, wo die Wagen am Prellbock halten werden, hält er davor', () => {
    const line = lineOf(W1, false);
    const end = line.at(-2)!; // hinter dem letzten Sitz, unter den Wagen am Prellbock
    expect(r1.path.some((p) => keyOf(p) === keyOf(end))).toBe(false);
    let s = play(awake(W1, at), W1, [{ type: 'move', dir, fresh: true }, ...ticks(DEPART)]).s;
    const len = r1.path.length - 1;
    while (s.ride && s.ride.pos < len - AHEAD - 1) s = play(s, W1, [TICK]).s;
    const hase = {
      ...initialState(W1).animals[0]!,
      id: 'lichtung:hase',
      species: 'hase' as const,
      x: end[0],
      y: end[1],
    };
    s = { ...s, animals: [{ ...hase, mode: 'wait' as const }] }; // wartet still (läuft nicht von selbst weg)
    const run: GameEvent[] = [];
    while (s.ride) {
      const n = play(s, W1, [TICK]);
      run.push(...n.events);
      s = n.s;
    }
    expect(rides(run, 'stop').map((e) => e.who)).toEqual(['lichtung:hase']);
    expect(rides(run, 'shoo').map((e) => e.who)).toEqual(['lichtung:hase']);
    expect(r1.on.has(keyOf([s.animals[0]!.x, s.animals[0]!.y]))).toBe(false);
  });

  it('Folgende fahren nie mit: Sie setzen sich auf die Bank von Bahnhof Bär und schauen zum Zug', () => {
    const [x, y] = r1.seats.out[r1.seats.out.length - 1]!;
    const fid = 'lichtung:hase';
    const follower = {
      ...initialState(W1).animals[0]!,
      id: fid,
      species: 'hase' as const,
      x,
      y,
      mode: 'follow' as const,
    };
    const s = awake(W1, at, READY, { animals: [follower], followers: [fid] });
    const board = play(s, W1, [{ type: 'move', dir, fresh: true }]);
    expect(board.events.filter((e) => e.type === 'wait').map((e) => (e as { id: string }).id)).toEqual([fid]);
    const sitter = board.s.animals[0]!;
    expect(sitter.mode).toBe('wait');
    expect(W1.cell(sitter.x, sitter.y).stop).toBe('hoehle'); // auf dem Bahnsteig, an der Bank
    expect(board.s.followers).toEqual([]);
  });

  it('Folgende warten an ihrem Halt, nicht in der Gegend: nach der Fahrt in die Bucht (dieselbe Gegend) bleiben sie auf der Bank, bis die Figur wieder nah ist', () => {
    const [x, y] = r1.seats.out[r1.seats.out.length - 1]!;
    const fid = 'lichtung:hase';
    const follower = {
      ...initialState(W1).animals[0]!,
      id: fid,
      species: 'hase' as const,
      x,
      y,
      mode: 'follow' as const,
    };
    const there = ride(W1, awake(W1, at, READY, { animals: [follower], followers: [fid] }), dir);
    const bench: Point = [there.s.animals[0]!.x, there.s.animals[0]!.y];
    expect(W1.cell(...bench).stop).toBe('hoehle');
    // in der Bucht (auf der Lichtung wie die Bank) ein paar Schritte: Es reiht sich nicht ein und springt nie
    const far = Math.max(Math.abs(there.s.player.x - bench[0]), Math.abs(there.s.player.y - bench[1]));
    expect(far).toBeGreaterThan(BENCH + 4);
    let s = there.s;
    const events: GameEvent[] = [];
    const jumps: string[] = [];
    for (const d of ['w', 'n', 'e', 's', 'w', 'n'] as Dir[]) {
      const before: Point = [s.animals[0]!.x, s.animals[0]!.y];
      const n = play(s, W1, [{ type: 'move', dir: d, fresh: true }]);
      const a = n.s.animals[0]!;
      if (Math.max(Math.abs(a.x - before[0]), Math.abs(a.y - before[1])) > 1)
        jumps.push(`${d}: ${before.join(',')} → ${a.x},${a.y}`);
      events.push(...n.events);
      s = n.s;
    }
    expect(events.filter((e) => e.type === 'rejoin')).toEqual([]);
    expect(jumps).toEqual([]);
    expect([s.animals[0]!.x, s.animals[0]!.y]).toEqual(bench);
    expect(s.animals[0]).toMatchObject({ mode: 'wait', bench: true });
    // wieder einsteigen in der Bucht: Das Tier auf der Bank von Bahnhof Bär bleibt, wo es ist
    const again = play(there.s, W1, [{ type: 'move', dir: 'n', fresh: true, tap: true, ride: 'hoehle' }]);
    expect(again.s.ride).toBeDefined();
    expect([again.s.animals[0]!.x, again.s.animals[0]!.y]).toEqual(bench);
    // zurück an Bahnhof Bär: neben der Bank reiht es sich mit dem ersten Schritt wieder ein
    const near = { ...there.s, player: { x: at[0], y: at[1], dir: 's' as Dir }, docked: {} };
    const step1 = play(near, W1, [{ type: 'move', dir: dir === 'n' || dir === 's' ? 'w' : 'n', fresh: true }]);
    expect(step1.events.filter((e) => e.type === 'rejoin').map((e) => (e as { id: string }).id)).toEqual([fid]);
    expect(step1.s.animals[0]!.bench).toBeUndefined();
  });

  it('wandernde Tiere meiden Gleis und Wagen am Halt; heimkehrende kreuzen das Gleis', () => {
    const rules = FAHRT_PACK.rules!.ride!([train]);
    const s = awake(W1, at);
    const a = { ...initialState(W1).animals[0]!, mode: 'wander' as const };
    const mid = r1.path[Math.floor(r1.path.length / 2)]!;
    expect(rules.blocks(s, W1, a, ...mid)).toBe(true);
    expect(rules.blocks(s, W1, { ...a, mode: 'home' }, ...mid)).toBe(false);
    expect(rules.blocks(s, W1, { ...a, mode: 'home' }, ...r1.cars!.out[0]!)).toBe(true);
    expect(rules.blocks(awake(W1, at, withBuilt({}, 1)), W1, a, ...mid)).toBe(false); // ohne Zug (Stufe) nichts
  });

  it('Ausbau 2, Höhlentor offen: bis Bahnhof Fledermaus samt Glocke beim Gegendwechsel; der Zug steht am Bahnhof der Gegend der Figur', () => {
    const p = onPlatform(W2);
    const open = { openGates: ['hoehle' as const] };
    const run = ride(W2, awake(W2, p.at, FAR, open), p.dir);
    const r2 = trainRoute(W2, { packs: FAR, openGates: ['hoehle'] })!;
    expect(rides(run.events, 'alight')).toHaveLength(1);
    expect(W2.realm(...pos(run.s))).toBe('hoehle');
    expect(run.events.filter((e) => e.type === 'realm')).toHaveLength(1); // die Glocke einmal
    // eine Fahrt dauert höchstens mit 8 Feldern je Sekunde 15 bis 20 s, dazu 2 s Abfahrt und je Halt vor einem Tier, das
    // auf dem Gleis stand (wilde Tiere der Landschaft), `SHOO` Takte
    const T = Math.min(TRAIN.ticks[1], Math.max(TRAIN.ticks[0], Math.round((r2.path.length - 1) / TRAIN.pace!)));
    expect(T).toBeGreaterThanOrEqual(150);
    expect(T).toBeLessThanOrEqual(200);
    expect(run.arriveAt - run.boardAt).toBe(DEPART + T + SHOO * rides(run.events, 'stop').length);
    expect(rides(run.events, 'guest')).toEqual([]); // Tok steigt nur bei der ersten Fahrt in der Bucht aus
    // nach dem Laden in der Grotte: der Zug steht am Bahnhof Fledermaus; auf der Lichtung an Bahnhof Bär
    const cave = awake(W2, pos(run.s), FAR, open);
    expect(parked(TRAIN, r2, cave, W2)?.end).toBe('home');
    expect(parked(TRAIN, r2, awake(W2, p.at, FAR, open), W2)?.end).toBe('out');
    expect(ALIGHT).toBe(10);
  });
});

describe('Vorladen am Halt: der Zug schläft, solange seine Ziel-Gegend fehlt (mitwachsen-preload.ts)', () => {
  /** Ausbau 2 ohne Grotte: ihr Paket lädt noch (oder das Laden scheiterte); der Zug steht noch vor der ersten Fahrt */
  const W2A = worldOf(1, [BAHN_PACK], BUILT);
  const { at, dir } = onPlatform(W2A);
  const midOf = (st: State, w: World, a = AT) => stationBodies(st, w, a).find((b) => b.id === 'ride:hoehle:mid')!;
  const GOLDEN = '#b46a0c';
  const sleepy = () => awake(W2A, at, FAR);

  it('Ausbau 1: Die erste Fahrt bis zum Prellbock wartet nie auf die Grotte (vorgeladen wird sie trotzdem)', () => {
    expect(train.needs).toEqual(['hoehle']);
    const p = onPlatform(W1); // W1: ohne Grotte
    const run = play(awake(W1, p.at), W1, [{ type: 'move', dir: p.dir, fresh: true }]);
    expect(run.s.dozing).toBeUndefined();
    expect(run.s.ride?.id).toBe('hoehle');
  });

  it('Hineinlaufen und Antippen steigen nicht ein, er schnarcht leise (gedrosselt), die Figur bleibt stehen', () => {
    const fresh = play(sleepy(), W2A, [{ type: 'move', dir, fresh: true }]);
    expect(fresh.s.dozing).toEqual(['hoehle']);
    expect(rides(fresh.events).map((e) => e.what)).toEqual(['snore']);
    expect(fresh.s.ride).toBeUndefined();
    expect(pos(fresh.s)).toEqual(at); // durch den Zug läuft niemand, nichts ist zu
    const tap: Cmd = { type: 'move', dir, fresh: true, tap: true, ride: 'hoehle' };
    expect(rides(play(fresh.s, W2A, [...ticks(3), tap]).events)).toEqual([]); // gedrosselt
    const later = play(fresh.s, W2A, [...ticks(JINGLE_EVERY), tap]);
    expect(rides(later.events).map((e) => e.what)).toEqual(['snore']);
    expect(later.s.ride).toBeUndefined();
    expect(pos(later.s)).toEqual(at); // gelaufen wird per Antippen nie
  });

  it('er schnarcht von selbst alle 3 s, solange die Figur höchstens 6 Felder vor ihm steht; weiter weg ist er still', () => {
    const near = play(sleepy(), W2A, ticks(SNORE_EVERY * 2));
    expect(rides(near.events, 'snore')).toHaveLength(2);
    const bed = W2A.homes.lichtung.bed;
    const seat = trainRoute(W2A, { packs: FAR, openGates: [] })!.stops.out;
    expect(Math.max(Math.abs(bed[0] - seat[0]), Math.abs(bed[1] - seat[1]))).toBeGreaterThan(RIDE_PRELOAD);
    expect(rides(play(awake(W2A, bed, FAR), W2A, ticks(SNORE_EVERY * 2)).events)).toEqual([]);
    expect(trainFx({ type: 'ride', what: 'snore', id: 'hoehle', x: 0, y: 0 })).toMatchObject({ zzz: true });
  });

  it('im Bild: keine goldene Tür, kein Dampf, keine Lampen (auch abends), nichts grau; ist die Grotte da, steigt man ein', () => {
    const s = play(sleepy(), W2A, [TICK]).s;
    const lit: RideAt = { ...AT, lit: true };
    const bodies = stationBodies(s, W2A, lit);
    expect(bodies.some((b) => b.id === 'ride:hoehle:dampf')).toBe(false);
    expect(bodies.find((b) => b.id === 'ride:hoehle:loco')!.key.endsWith('0')).toBe(true);
    expect(midOf(s, W2A).parts.some((p) => p[6] === GOLDEN)).toBe(false);
    // nichts grau oder zu: der Wagen sieht aus wie nach der ersten Fahrt (Stufe `offen`, ohne Gold)
    const opened = withBuilt(withTok({}, { stage: 'offen' }), 2);
    expect(midOf(s, W2A).key).toBe(midOf(awake(W2, at, opened), W2).key);
    // derselbe Spielstand, die Grotte ist angekommen: Er wacht auf, die Tür ist golden, ein neuer Druck steigt ein
    const awakeNow = play(s, W2, [TICK]).s;
    expect(awakeNow.dozing).toBeUndefined();
    expect(midOf(awakeNow, W2).parts.some((p) => p[6] === GOLDEN)).toBe(true);
    expect(play(awakeNow, W2, [{ type: 'move', dir, fresh: true }]).s.ride?.id).toBe('hoehle');
  });

  it('wacht er gleich nach dem Schnarchen auf, ist die Tür zu, und ein gehaltener Pfeil stößt ihn sofort an', () => {
    const snored = play(sleepy(), W2A, [{ type: 'move', dir, fresh: true }]).s;
    expect(snored.nudged).toBeUndefined(); // das Schnarchen öffnet keine Tür
    const woke = play(snored, W2, [TICK]).s;
    const shut = play(sleepy(), W2, [TICK]).s;
    expect(midOf(woke, W2).key).toBe(midOf(shut, W2).key);
    const held = play(woke, W2, [{ type: 'move', dir }]);
    expect(rides(held.events).map((e) => e.what)).toEqual(['nudge']);
  });

  it('solange Tok baut (Bau 1), schläft nichts: kein Schnarchen, Dampf und Licht wie sonst', () => {
    const work = { from: 0, to: 100_000 };
    const run = play(awake(W2A, at, FAR, { work }), W2A, ticks(SNORE_EVERY * 2));
    expect(run.s.dozing).toBeUndefined();
    expect(rides(run.events, 'snore')).toEqual([]);
    // ohne Fahr-Engine schliefe er sonst auch
    expect(play(awake(W1, at, READY, { work }), W1, [TICK], [BAHN_PACK]).s.dozing).toBeUndefined();
  });

  it('ohne Fahr-Engine schläft er auch (nur das Bild, ohne Regeln fährt nichts); ohne Paket der Bahn gibt es keinen Zug', () => {
    expect(play(awake(W1, at), W1, [TICK], [BAHN_PACK]).s.dozing).toEqual(['hoehle']);
    expect(play(awake(W2, at, FAR), W2, [TICK], [BAHN_PACK]).s.dozing).toEqual(['hoehle']);
    expect(play(awake(W1, at), W1, [TICK], [EIS_PACK, FAHRT_PACK]).s.dozing).toBeUndefined();
  });
});

describe('Fahr-Engine mit zwei Fahrzeugen (Schlitten und Zug)', () => {
  it('ein Fahrzeug ohne `ready` stört das Erscheinen des anderen nicht; ein Antippen gehört dem angetippten', () => {
    // ein zweites Fahrzeug mit der Daten des Schlittens auf einer Strecke neben dem Bett der Lichtung
    const [bx, by] = W1.homes.lichtung.bed;
    const path: Point[] = Array.from({ length: 6 }, (_, i): Point => [bx + 3 + i, by + 3]);
    const fake: RideRoute = {
      path,
      stops: { home: path[0]!, out: path.at(-1)! },
      shed: [],
      seats: { home: [], out: [] },
      on: new Set(path.map(keyOf)),
    };
    let asked = 0;
    const sled: Vehicle = { spec: RIDES[0], route: () => fake, ready: () => (asked++, true) };
    const both = FAHRT_PACK.rules!.ride!([sled, train]);
    const events: RideEvent[] = [];
    const push = (...e: unknown[]) => events.push(...(e as RideEvent[]));
    const s = awake(W1, onPlatform(W1).at);
    for (let i = 0; i < 25; i++) {
      s.tick++;
      both.tick(s, W1, { push });
    }
    expect(asked).toBeGreaterThan(0);
    expect(events.filter((e) => e.what === 'appear').map((e) => e.id)).toEqual(['schlitten']);
    // Antippen des Zugs: der Zug, nicht der Schlitten
    const tap: Cmd & { type: 'move' } = {
      type: 'move',
      dir: onPlatform(W1).dir,
      fresh: true,
      tap: true,
      ride: 'hoehle',
    };
    expect(both.move(s, W1, tap, { push })).toBe(true);
    expect(s.ride?.id).toBe('hoehle');
  });

  it('Ton: nur eigene Ereignisse, in der C-Pentatonik, höchstens drei Töne je Ereignis; „Uh-uh“ vor dem Tunnel', () => {
    const e = (what: RideEvent['what'], more: Partial<RideEvent> = {}): RideEvent => ({
      type: 'ride',
      what,
      id: 'hoehle',
      x: 0,
      y: 0,
      ...more,
    });
    expect(trainFx({ ...e('board'), id: 'schlitten' })).toBeUndefined();
    const semis = (hz: number) => ((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12;
    const all: RideEvent['what'][] = [
      'nudge',
      'board',
      'go',
      'wave',
      'stop',
      'tunnel',
      'arrive',
      'alight',
      'leave',
      'guest',
      'snore',
    ];
    for (const what of all) {
      const score = trainScores(e(what, { ring: true }));
      expect(score.length, what).toBeLessThanOrEqual(3);
      expect(score.filter(([, , , , , at]) => !at).length, what).toBeLessThanOrEqual(1); // höchstens einer sofort
      expect(
        score.every(([f]) => [0, 2, 4, 7, 9].includes(semis(f))),
        what,
      ).toBe(true);
    }
    expect(trainScores(e('tunnel'))).toEqual(UH_UH);
    expect(trainScores(e('go'))[0]![0]).toBe(TRAIN.signal[0]); // sein Signal: Pfiff A5 → C6
  });
});

describe('Der Zug im Bild beim Fahren (mitwachsen-station-look.ts)', () => {
  const { at, dir } = onPlatform(W1);
  const r1 = trainRoute(W1, { packs: READY, openGates: [] })!;
  const color = (b: { parts: readonly (readonly unknown[])[] }, c: string) => b.parts.some((p) => p[6] === c);

  it('am Halt: goldener Rahmen um die Tür des mittleren Wagens bis zur ersten Fahrt, angestoßen geht die Tür auf', () => {
    const s = awake(W1, at);
    const mid = stationBodies(s, W1, AT).find((b) => b.id === 'ride:hoehle:mid')!;
    expect(mid.key).toMatch(/:mid:00010?$|:mid:00[01]-?10$/);
    const nudged = play(s, W1, [{ type: 'move', dir }]).s;
    const open = stationBodies(nudged, W1, AT).find((b) => b.id === 'ride:hoehle:mid')!;
    expect(open.key).not.toBe(mid.key); // die Tür steht offen
    const later = play(nudged, W1, ticks(12)).s;
    expect(stationBodies(later, W1, AT).find((b) => b.id === 'ride:hoehle:mid')!.key).toBe(mid.key);
    // weiter (Stufe `offen`): kein Gold mehr
    const after = awake(W1, at, withTok(READY, { stage: 'offen' }));
    expect(stationBodies(after, W1, AT).find((b) => b.id === 'ride:hoehle:mid')!.key).not.toBe(mid.key);
    expect(color(mid, '#b46a0c')).toBe(true);
    // nach der ersten Fahrt (gespeichert: `gefahren`) kein Gold mehr, auch nach dem Laden an Bahnhof Bär
    const ridden1 = ride(W1, s, dir).s;
    expect(ridden(ridden1.packs, 'hoehle')).toBe(true);
    expect(ridden(READY, 'hoehle')).toBe(false);
    const reload = awake(W1, at, progressOf(ridden1).packs);
    const plain = stationBodies(reload, W1, AT).find((b) => b.id === 'ride:hoehle:mid')!;
    expect(plain.key).not.toBe(mid.key);
    expect(color(plain, '#b46a0c')).toBe(false);
  });

  it('unterwegs sitzt die Figur im mittleren Wagen (`seat`), im Tunnel leuchten die Lampen, am Prellbock steht er in der Bucht', () => {
    let s = play(awake(W1, at), W1, [{ type: 'move', dir, fresh: true }]).s;
    const seat = stationBodies(s, W1, AT).find((b) => b.seat)!;
    expect(seat.id).toBe('ride:hoehle:mid');
    let lit = false;
    while (s.ride) {
      const loco = stationBodies(s, W1, AT).find((b) => b.id === 'ride:hoehle:loco')!;
      if (loco.key.endsWith('1')) lit = true;
      s = play(s, W1, [TICK]).s;
    }
    expect(lit).toBe(true);
    const mid = stationBodies(s, W1, AT).find((b) => b.id === 'ride:hoehle:mid')!;
    const home = r1.stops.home;
    expect(Math.hypot(mid.x - home[0], mid.y - home[1])).toBeLessThan(1.5);
    expect(stationBodies(s, W1, AT).some((b) => b.seat)).toBe(false);
  });

  it('reduzierte Bewegung: unterwegs steht der Zug am Halt, von dem er abfuhr, und springt bei der Ankunft ans Ziel', () => {
    const calm: RideAt = { ...AT, reduced: true };
    const midOf = (st: State) => stationBodies(st, W1, calm).find((b) => b.id === 'ride:hoehle:mid')!;
    let s = play(awake(W1, at), W1, [{ type: 'move', dir, fresh: true }]).s;
    const start = midOf(s);
    const moved: string[] = [];
    while (s.ride && s.ride.phase !== 'arrive') {
      const m = midOf(s);
      if (Math.hypot(m.x - start.x, m.y - start.y) > 1e-9) moved.push(`${s.ride.phase} ${s.ride.pos.toFixed(1)}`);
      s = play(s, W1, [TICK]).s;
    }
    expect(moved).toEqual([]);
    const home = r1.stops.home;
    const end = midOf(s);
    expect(Math.hypot(end.x - home[0], end.y - home[1])).toBeLessThan(1.5);
  });
});
