// Bau 2 (Schritt 10 der Bahn): bei der nächsten Fahrt nach dem Hau-ruck klopft Tok am Prellbock, der versinkt, der Zug
// fährt bis Bahnhof Fledermaus, der Maulwurf zieht als erstes Höhlen-Tier ein, Tok wohnt im Lokschuppen
// (mitwachsen-build2.ts, Bild in mitwachsen-bat-look.ts, mitwachsen-rail-look.ts, mitwachsen-station-look.ts). Reine
// Regeln über `step` mit den Paketen wie im Spiel; die Welt wird beim Ereignis `relay` neu gebaut wie in der Spielseite
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { animalId, type Point } from '../../../../data/games/mitwachsen';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import { BUILD2 } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import { TOK_MODEL, TOK_SOLO } from '../../../../data/games/worlds/bahn/mitwachsen-tok-model';
import { bahnWanted } from '../../mitwachsen-pack';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { ALIGHT, DEPART, parked, stopsOf } from '../../mitwachsen-ride-kit';
import { withTok } from '../../mitwachsen-ride-save';
import { atHome } from '../../mitwachsen-meadow';
import type { RideAt } from '../../mitwachsen-ride-view';
import {
  attachPack,
  initialState,
  progressOf,
  step,
  type Cmd,
  type GameEvent,
  type State,
} from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { BAHN_PACK, BUILT, FAHRT_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { batBodies, batOf } from './mitwachsen-bat-look';
import { NEAR, TOK_WAIT, capOf, canBuild2, onward2, shedIn } from './mitwachsen-build2';
import { withBuilt } from './mitwachsen-built';
import { railBoxes, railShown, sunkOf, waveStage } from './mitwachsen-rail-look';
import { headingOf, puffOf, stationBodies, stationOf } from './mitwachsen-station-look';
import { SEAT, TRAIN, lineOf, train, trainRoute } from './mitwachsen-train';
import { heraldFx } from './mitwachsen-tok-look';
import { BAT_CALL, BEAR_CALL, trainScores } from './mitwachsen-train-look';
import { view3d } from './view-3d';

const SEED = 1;
/** Die Welt nach dem Hau-ruck: Ausbau 1, mit Grotte (das Gleis durch die Tür liegt schon, gezeichnet wird es erst ab 2) */
const W1 = worldOf(SEED, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 1 } });
const W2 = worldOf(SEED, [HOEHLE_PACK, BAHN_PACK], BUILT);
/** Spielstand nach dem Hau-ruck: Ausbau 1, Stufe `offen` (die erste Fahrt ist gemacht) */
const OPENED = withBuilt(withTok({}, { stage: 'offen' }), 1);
const OPEN_GATES = ['eis', 'hoehle'] as const;
const RULES = [HOEHLE_PACK, BAHN_PACK, FAHRT_PACK];
const TICK: Cmd = { type: 'tick' };
const TOK = animalId('hoehle', 'tok');
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

type Run = { s: State; w: World; events: GameEvent[] };
/** Befehle spielen; beim Ereignis `relay` baut die Welt neu wie in der Spielseite (`World.relay`) */
function play(s: State, w: World, cmds: readonly Cmd[]): Run {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, w, c, undefined, undefined, RULES);
    s = r.state;
    events.push(...r.events);
    if (r.events.some((e) => e.type === 'herald' && e.relay)) w = w.relay(s.packs).world;
  }
  return { s, w, events };
}
const ticks = (n: number): Cmd[] => Array.from({ length: n }, () => TICK);
const rides = (e: readonly GameEvent[], what?: RideEvent['what']) =>
  e.filter((x): x is RideEvent => x.type === 'ride' && (!what || x.what === what));
const heralds = (e: readonly GameEvent[], what: string) => e.filter((x) => x.type === 'herald' && x.what === what);

/** Wach auf `p`, ohne Tiere außer denen, die die Regeln gleich setzen (Tok in der Bucht) */
function awake(w: World, p: Point, packs: Record<string, unknown> = OPENED, gates: readonly string[] = OPEN_GATES) {
  const s = initialState(w, { packs, openGates: [...gates] as State['openGates'] });
  const t: State = { ...s, sleeping: false, wokeAt: -100, player: { x: p[0], y: p[1], dir: 's' }, animals: [] };
  return play(t, w, [TICK]).s; // Tok setzt sich in die Bucht (`backToBay`) bzw. in den Lokschuppen
}

/** Auf dem Bahnsteig von Bahnhof Bär neben dem mittleren Wagen, samt Richtung zum Zug */
function onPlatform(w: World): { at: Point; dir: Dir } {
  const st = stationOf(w)!;
  const row = st.rows[SEAT]!;
  const lane = st.line[SEAT]!;
  const dir = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(
    ([, [dx, dy]]) => row.edge[0] + dx === lane[0] && row.edge[1] + dy === lane[1],
  )![0];
  return { at: row.edge, dir };
}

/** Von Bahnhof Bär einsteigen und fahren, bis die Figur ausgestiegen ist; je Takt `watch` */
function rideIn(s: State, w: World, watch: (r: Run) => void = () => {}, limit = 500): Run {
  const { dir } = onPlatform(w);
  let r = play(s, w, [{ type: 'move', dir, fresh: true }]);
  for (let i = 0; i < limit && r.s.ride; i++) {
    const n = play(r.s, r.w, [TICK]);
    r = { ...n, events: [...r.events, ...n.events] };
    watch(r);
  }
  return r;
}

/** Ein Pfeil von der Figur in einen Wagen des Zugs am Halt `end` (undefined: keiner daneben) */
function intoTrain(s: State, w: World, end: 'home' | 'out'): Dir | undefined {
  const at = stopsOf(trainRoute(w, s)!)[end];
  return (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(([, [dx, dy]]) =>
    at.board.has(`${s.player.x + dx},${s.player.y + dy}`),
  )?.[0];
}

/**
 * Vor dem Hau-ruck (Höhlentor zu) von Bahnhof Bär bis an den Prellbock in der Bucht gefahren und ausgestiegen (Tok hüpft
 * an seinen Platz neben der Torplatte), dann geht das Tor auf: Der Zug steht in der Bucht, die Lok zum Tor
 */
function inBay(): Run {
  const shut = awake(W1, onPlatform(W1).at, OPENED, ['eis']);
  const r = rideIn(shut, W1);
  return { ...r, s: { ...r.s, openGates: [...OPEN_GATES] } };
}

describe('Bau 2: bei der nächsten Fahrt nach dem Hau-ruck (mitwachsen-build2.ts)', () => {
  let ready: State | undefined;
  const begin = () => (ready ??= awake(W1, onPlatform(W1).at));

  it('ohne das Paket der Bahn wohnt der erste Maulwurf in der Grotte, mit ihm sitzt er bis Bau 2 auf Toks Helm', () => {
    expect(bahnWanted({ openGates: ['eis', 'hoehle'] })).toBe(true); // für das Kind kommt es mit offenem Eistor
    // ohne Bahn (Blick hinein nur in die Grotte): Der erste Maulwurf läuft frei an seinem Fundort
    const cave = worldOf(SEED, [HOEHLE_PACK]);
    expect(cave.away?.size ?? 0).toBe(0);
    expect(initialState(cave, {}).animals.some((a) => a.id === FIRST_MOLE)).toBe(true);
    // mit der Bahn sitzt er bis Bau 2 auf Toks Helm: nicht in der Grotte, auch nicht, wenn die Bahn später kommt
    expect([...W1.away!]).toEqual([FIRST_MOLE]);
    expect(initialState(W1, { packs: OPENED }).animals.some((a) => a.id === FIRST_MOLE)).toBe(false);
    expect(attachPack(initialState(cave, { packs: OPENED }), W1).animals.some((a) => a.id === FIRST_MOLE)).toBe(false);
    expect(W2.away?.size).toBe(0);
    expect(BAHN_PACK.away!({ bahn: { built: 2 } })).toEqual([]);
    // ohne Hau-ruck (Höhlentor zu) beginnt kein Bau 2
    const shut = initialState(W1, { packs: OPENED, openGates: ['eis'] });
    expect(shut.openGates).not.toContain('hoehle');
    expect(canBuild2(shut, W1, 'home')).toBe(false);
  });

  it('beginnt nur zur Grotte hin, nach dem Hau-ruck, mit der Grotte; vorher und am Prellbock nicht', () => {
    expect([typeof train.depart, typeof train.hold]).toEqual(['function', 'function']);
    expect(canBuild2({ packs: OPENED, openGates: [...OPEN_GATES] }, W1, 'home')).toBe(true);
    expect(canBuild2({ packs: OPENED, openGates: [...OPEN_GATES] }, W1, 'out')).toBe(false); // vom Prellbock zurück
    expect(canBuild2({ packs: OPENED, openGates: ['eis'] }, W1, 'home')).toBe(false); // Tor noch zu
    expect(canBuild2({ packs: withBuilt(OPENED, 2), openGates: [...OPEN_GATES] }, W1, 'home')).toBe(false); // schon da
    const lichtung = worldOf(SEED, [BAHN_PACK], { bahn: { built: 1 } }); // ohne Grotte endet das Gleis am Prellbock
    expect(canBuild2({ packs: OPENED, openGates: [...OPEN_GATES] }, lichtung, 'home')).toBe(false);
    // Tok wartet in der Bucht, solange Bau 2 noch nicht war
    expect(begin().animals.find((a) => a.id === TOK)).toMatchObject({ mode: 'herald' });
    expect(begin().animals.find((a) => a.id === TOK)!.solo).toBeUndefined();
  });

  it('in den ersten 2 s wieder ausgestiegen: nichts gebaut; abgefahren: Ausbau 2 sofort gespeichert, der Bau wartet auf den Prellbock', () => {
    const { dir } = onPlatform(W1);
    const seated = play(begin(), W1, [{ type: 'move', dir, fresh: true }, ...ticks(DEPART - 1)]);
    expect(seated.s.packs).toEqual(begin().packs);
    expect(seated.s.work).toBeUndefined();
    const gone = play(seated.s, W1, [TICK]);
    expect(gone.s.packs.bahn).toEqual({ built: 2 });
    expect(rides(gone.events, 'go')[0]!.persist).toBe(true);
    expect(progressOf(gone.s).packs.bahn).toEqual({ built: 2 });
    expect(gone.s.ride!.stopover).toBe('ahead');
    expect(gone.s.work).toEqual({ from: gone.s.tick, to: Infinity });
    // die Fahrt geht bis Bahnhof Fledermaus, ihr Tempo passt sich an (15–20 s)
    const far = trainRoute(W1, gone.s)!;
    expect(W1.realm(...far.stops.home)).toBe('hoehle');
    expect(gone.s.ride!.speed).toBeCloseTo(
      (far.path.length - 1) / Math.min(200, Math.max(150, Math.round((far.path.length - 1) / TRAIN.pace!))),
    );
    // im Bild: Der Prellbock steht noch, durch die Tür liegt noch nichts (Fortschritt 0)
    const at = { packs: gone.s.packs, reduced: false, work: 0 };
    expect(sunkOf(at)).toBe(0);
    const gang = lineOf(W1, true).slice(lineOf(W1, false).length);
    expect(gang.every((p) => !railShown(W1.cell(...p).rail!, at))).toBe(true);
    expect(view3d.stamp!(gone.s.packs, 0)).toBe('bahn1'); // 3D baut nichts neu
  });

  it('am Prellbock: Tok hüpft heran und klopft 3 s, Bahnhof Fledermaus entsteht, der Prellbock versinkt, Tok steigt ein, weiter', () => {
    const cap = capOf(W1);
    let heldFor = 0;
    let sinkAt = -1;
    const seen: { stop: number; sunk: number; tokAt?: Point }[] = [];
    const run = rideIn(begin(), W1, (r) => {
      const ride = r.s.ride;
      if (ride?.stopover === 'ahead' && ride.pos >= cap - 1e-6) heldFor++;
      if (sinkAt < 0 && heralds(r.events, 'sink').length) sinkAt = r.s.tick;
      if (ride && r.s.work && r.s.work.to !== Infinity) {
        const t = r.s.animals.find((a) => a.id === TOK);
        seen.push({
          stop: ride.pos,
          sunk: sunkOf({ packs: r.s.packs, reduced: false, work: (r.s.tick - r.s.work.from) / BUILD2.ticks }),
          ...(t && { tokAt: [t.x, t.y] as Point }),
        });
      }
    });
    expect(heralds(run.events, 'sink')).toHaveLength(1);
    expect(heralds(run.events, 'pop')).toHaveLength(1);
    expect(heralds(run.events, 'board')).toHaveLength(1);
    expect(heldFor).toBeGreaterThanOrEqual(BUILD2.ticks); // er hält, solange Tok baut (3 s)
    expect(seen.every((x) => x.stop === cap)).toBe(true); // der Zug steht am Prellbock
    expect(seen.at(-1)!.sunk).toBe(1);
    // Tok hüpft an den Prellbock (nie auf Gleis oder Torplatte)
    const buffer = lineOf(W1, false).at(-1)!;
    const near = seen.flatMap((x) => (x.tokAt ? [x.tokAt] : [])).at(-1)!;
    expect(Math.max(Math.abs(near[0] - buffer[0]), Math.abs(near[1] - buffer[1]))).toBeLessThanOrEqual(2);
    expect(W1.cell(...near).ride).toBeUndefined();
    expect(heraldFx({ type: 'herald', what: 'sink', id: TOK, x: 0, y: 0 })!.score.length).toBeGreaterThan(
      BUILD2.taps * 2,
    );
    // angekommen am Bahnhof Fledermaus in der Grotte
    expect(rides(run.events, 'tunnel').length).toBeGreaterThanOrEqual(1);
    expect(run.w.realm(run.s.player.x, run.s.player.y)).toBe('hoehle');
    expect(run.s.work).toBeUndefined();
    expect(run.s.docked).toEqual({ hoehle: 'home' });
  });

  it('am Bahnhof Fledermaus: Der Maulwurf zieht als erstes Höhlen-Tier ein, Tok wohnt im Lokschuppen (ohne Maulwurf)', () => {
    const run = rideIn(begin(), W1);
    const homes = run.events.filter((e) => e.type === 'home');
    expect(homes).toEqual([{ type: 'home', id: FIRST_MOLE, species: 'maulwurf' }]); // gespeichert wie jedes Tier
    expect(run.s.garden.map((a) => a.id)).toContain(FIRST_MOLE);
    const mole = run.s.animals.find((a) => a.id === FIRST_MOLE)!;
    expect(mole).toMatchObject({ mode: 'home', realm: 'hoehle' });
    const tok = run.s.animals.find((a) => a.id === TOK)!;
    expect(tok).toMatchObject({ mode: 'herald', solo: true });
    expect([tok.x, tok.y]).toEqual(shedIn(run.w).home);
    expect(rides(run.events, 'guest').map((e) => e.who)).toEqual([TOK]);
    expect(BAHN_PACK.solos).toEqual({ tok: TOK_SOLO });
    expect(TOK_SOLO.length).toBeLessThan(TOK_MODEL.length); // ohne Maulwurf auf dem Helm
    // der Maulwurf läuft selbst ins Gehege am Höhlenbett
    const later = play(run.s, run.w, ticks(400));
    const there = later.s.animals.find((a) => a.id === FIRST_MOLE)!;
    expect(atHome(later.w, there.home, there.x, there.y)).toBe(true);
    // erst jetzt erwacht das Portal am stillen See: beim Ankommen am Höhlenbett
    const bed = later.w.homes.hoehle.wake[0]!;
    const atBed = play({ ...later.s, player: { x: bed[0], y: bed[1], dir: 's' } }, later.w, [TICK]);
    expect(atBed.s.portals).toContain('hoehlensee');
    // ohne den Maulwurf zu Hause nicht
    const without = { ...later.s, garden: later.s.garden.filter((a) => a.id !== FIRST_MOLE), portals: [] };
    expect(play({ ...without, player: { x: bed[0], y: bed[1], dir: 's' } }, later.w, [TICK]).s.portals).not.toContain(
      'hoehlensee',
    );
  });

  it('Bahnhof Fledermaus und Lokschuppen stehen ab Ausbau 2 in der Welt (Bahnsteig eine Stufe hoch, feste Rückwand); vorher nichts', () => {
    expect(batOf(W1)).toBeNull();
    expect(batBodies(W1)).toEqual([]);
    const st = batOf(W2)!;
    expect(st.rows).toHaveLength(7);
    const bodies = batBodies(W2).map((b) => b.id);
    expect(bodies).toEqual(
      expect.arrayContaining(['bahn:fels:0', 'bahn:felsdach', 'bahn:felsschild', 'bahn:schuppen']),
    );
    const shed = shedIn(W2);
    expect(shed.wall.length).toBeGreaterThan(0);
    expect(shed.wall.every((p) => W2.cell(...p).solid)).toBe(true);
    expect(shed.wall.every((p) => !W1.cell(...p).solid)).toBe(true); // bei Ausbau 1 frei
    expect(W2.cell(...shed.home!).solid).toBe(false);
    // der Siebenschläfer schläft vorn im Lokschuppen
    const dormouse = W2.spawns.get(animalId('hoehle', 'siebenschlaefer'))!;
    expect(W2.cell(...dormouse).shed).toBe('hoehle');
    expect(W2.cell(...dormouse).solid).toBe(false);
    // die Körper kommen mit dem Bild der Station (2D und 3D gleich)
    const s = { ...initialState(W2, { packs: withBuilt(OPENED, 2), openGates: [...OPEN_GATES] }) };
    expect(stationBodies(s, W2, AT).some((b) => b.id === 'bahn:schuppen')).toBe(true);
  });

  it('der Prellbock im Bild: versinkt mit Bau 2, bei reduzierter Bewegung auf einmal; danach eine Gerade', () => {
    const packs = withBuilt(OPENED, 2);
    const buffer = lineOf(W1, false).at(-1)!;
    const c = W1.cell(...buffer);
    const height = (work: number | undefined, reduced = false) =>
      Math.max(...(railBoxes(c, ...buffer, { packs, reduced, work }) ?? []).map((b) => b[2] + b[5]));
    const [s0, s1] = BUILD2.sink;
    expect(height(0)).toBeGreaterThan(height((s0 + s1) / 2));
    expect(height((s0 + s1) / 2)).toBeGreaterThan(height(undefined));
    expect(sunkOf({ packs, reduced: true, work: (s0 + s1) / 2 })).toBe(0);
    expect(sunkOf({ packs, reduced: true, work: s1 })).toBe(1);
    expect(sunkOf({ packs: OPENED, reduced: false, work: undefined })).toBe(0); // Ausbau 1: er steht
    expect(waveStage(BUILD2.wave[0], 2)).toBe(1); // die erste Stufe der Gleiswelle, wenn er versunken ist
    expect(view3d.stamp!(packs, BUILD2.wave[0])).toBe('bahn1:1');
  });

  it('zurück zur Lichtung und weiter: kein zweiter Bau, Tok bleibt im Lokschuppen; nach dem Laden ebenso', () => {
    const there = rideIn(begin(), W1);
    const r2 = trainRoute(there.w, there.s)!;
    const seat = stopsOf(r2).home;
    const into = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(([, [dx, dy]]) =>
      seat.board.has(`${there.s.player.x + dx},${there.s.player.y + dy}`),
    );
    expect(into).toBeDefined();
    let back = play(there.s, there.w, [{ type: 'move', dir: into![0], fresh: true }]);
    for (let i = 0; i < 400 && back.s.ride; i++) back = { ...play(back.s, back.w, [TICK]), events: back.events };
    expect(back.s.ride).toBeUndefined();
    expect(back.w.realm(back.s.player.x, back.s.player.y)).toBe('lichtung');
    expect(back.s.animals.find((a) => a.id === TOK)).toMatchObject({ realm: 'hoehle', solo: true });
    expect(parked(TRAIN, r2, back.s, back.w)?.end).toBe('out');
    // neu geladen mit Ausbau 2: Tok im Lokschuppen, der Maulwurf zu Hause
    const reload = awake(W2, onPlatform(W2).at, progressOf(there.s).packs);
    expect(reload.animals.find((a) => a.id === TOK)).toMatchObject({ solo: true });
    expect(reload.animals.find((a) => a.id === FIRST_MOLE)).toBeUndefined(); // garden aus `awake` leer: nicht verteilt
    const full = initialState(W2, progressOf(there.s));
    expect(full.animals.find((a) => a.id === FIRST_MOLE)?.mode).toBe('home');
    // nachts schläft er dort (die Figur geht auf der Lichtung ins Bett), morgens wacht er auf
    const bed = W2.homes.lichtung.bed;
    const night = play({ ...reload, player: { x: bed[0], y: bed[1] + 1, dir: 'n' } }, W2, [{ type: 'move', dir: 'n' }]);
    expect(night.s.sleeping).toBe(true);
    const sleeper = night.s.animals.find((a) => a.id === TOK)!;
    expect(sleeper).toMatchObject({ nap: true, x: shedIn(W2).home![0], y: shedIn(W2).home![1] });
    const morning = play({ ...night.s, sleptAt: -1000 }, W2, [{ type: 'move', dir: 's' }]);
    expect(morning.s.sleeping).toBe(false);
    expect(morning.s.animals.find((a) => a.id === TOK)!.nap).toBeUndefined();
  });
  it('Tok kam unterwegs nicht heran (morgens noch am Bett der Lichtung): Er hüpft los, während der Zug fährt, und klopft am Prellbock', () => {
    const wake = W1.homes.lichtung.wake[0]!;
    const start = begin();
    const far: State = {
      ...start,
      animals: start.animals.map((a) => (a.id === TOK ? { ...a, x: wake[0], y: wake[1] } : a)),
    };
    const buffer = lineOf(W1, false).at(-1)!;
    let atGo: Point | undefined;
    let before: Point | undefined;
    let atSink: Point | undefined;
    rideIn(far, W1, (r) => {
      const t = r.s.animals.find((a) => a.id === TOK);
      if (!t) return;
      if (!atGo && r.s.work?.to === Infinity) atGo = [t.x, t.y];
      if (!atSink && r.s.work?.to === Infinity) before = [t.x, t.y];
      if (!atSink && heralds(r.events, 'sink').length) atSink = [t.x, t.y];
    });
    expect(cheb(before!, buffer)).toBeLessThan(cheb(atGo!, buffer)); // er hüpft schon während der Fahrt
    expect(cheb(atSink!, buffer)).toBeLessThanOrEqual(NEAR); // geklopft wird nie ohne ihn
    expect(W1.cell(...atSink!).ride).toBeUndefined();
  });

  it('nach dem Hau-ruck in der Bucht eingestiegen: Tok klopft gleich am Prellbock, dann fährt der Zug, Lok voran, bis Bahnhof Fledermaus', () => {
    const bay = inBay();
    expect(bay.s.docked).toEqual({ hoehle: 'home' });
    expect(bay.w.realm(bay.s.player.x, bay.s.player.y)).toBe('lichtung');
    expect(bay.s.animals.find((a) => a.id === TOK)).toMatchObject({ mode: 'herald' });
    const cap = capOf(W1);
    expect(onward2(bay.s, W1, 'home')).toEqual({ to: 'home', pos: cap });
    const dir = intoTrain(bay.s, bay.w, 'home')!;
    expect(dir).toBeDefined();
    const seat = stopsOf(trainRoute(W1, bay.s)!).home.seat;
    let r = play(bay.s, bay.w, [{ type: 'move', dir, fresh: true }]);
    const boardTick = r.s.tick;
    expect(r.s.ride).toMatchObject({ to: 'home', pos: cap, from: { end: 'home', pos: cap }, phase: 'seated' });
    expect([r.s.player.x, r.s.player.y]).toEqual(seat);
    // im Bild: der Zug steht, wo er stand (auch bei reduzierter Bewegung), die Lok zum Tor, keine Dampfwolke
    const loco = (s: State, reduced = false) =>
      stationBodies(s, r.w, { ...AT, reduced }).find((b) => b.id === 'ride:hoehle:loco')!;
    for (const reduced of [false, true]) {
      const [a, b] = [loco(bay.s, reduced), loco(r.s, reduced)];
      expect([b.x, b.y, b.dir]).toEqual([a.x, a.y, a.dir]);
    }
    let goTick = -1;
    let sinkTick = -1;
    let moving = 0;
    const bad: string[] = [];
    for (let i = 0; i < 500 && r.s.ride; i++) {
      const before = r.s.ride.pos;
      const was = r.s.animals.find((a) => a.id === TOK);
      const n = play(r.s, r.w, [TICK]);
      const now = n.s.animals.find((a) => a.id === TOK);
      // Tok hüpft heran (höchstens ein Feld je Takt), er steht nie plötzlich woanders
      if (was && now && cheb([was.x, was.y], [now.x, now.y]) > 1)
        bad.push(`Takt ${n.s.tick}: Tok springt von ${was.x},${was.y} nach ${now.x},${now.y}`);
      r = { ...n, events: [...r.events, ...n.events] };
      if (goTick < 0 && rides(n.events, 'go').length) goTick = n.s.tick;
      if (sinkTick < 0 && heralds(n.events, 'sink').length) sinkTick = n.s.tick;
      const ride = n.s.ride;
      if (!ride) continue;
      if (ride.pos > before) moving++;
      if (headingOf(ride) !== 'home') bad.push(`Takt ${n.s.tick}: Lok schaut ${headingOf(ride)}`);
      for (const frac of [0, 0.5, 1])
        if (puffOf(n.s, n.w, { ...AT, frac }) !== undefined) bad.push(`Takt ${n.s.tick}: Dampfwolke`);
    }
    expect(bad).toEqual([]);
    // nach den 2 s mit geschlossenen Türen: Ausbau 2 gespeichert, Tok hüpft heran und klopft gleich (der Sitz steht schon
    // am Prellbock), ohne dass der Zug bis `TOK_WAIT` auf ihn warten muss
    expect(goTick).toBe(boardTick + DEPART);
    expect(sinkTick).toBeGreaterThan(goTick);
    expect(sinkTick).toBeLessThan(goTick + TOK_WAIT);
    expect(rides(r.events, 'go')[0]!.persist).toBe(true);
    expect(heralds(r.events, 'sink')).toHaveLength(1);
    expect(heralds(r.events, 'pop')).toHaveLength(1);
    expect(heralds(r.events, 'board')).toHaveLength(1);
    // die Restfahrt bleibt in 15–20 s (Tempo aus der Restlänge), dazu die 3 s des Klopfens
    expect(moving).toBeGreaterThanOrEqual(150);
    expect(moving).toBeLessThanOrEqual(200);
    expect(r.s.tick - goTick).toBeLessThanOrEqual(200 + BUILD2.ticks + ALIGHT + 2);
    // „Uh-uh“ vor dem Tor und die Glocke beim Wechsel in die Grotte kommen trotz Start mitten auf der Linie
    expect(rides(r.events, 'tunnel')).toHaveLength(1);
    expect(r.events.filter((e) => e.type === 'realm')).toEqual([{ type: 'realm', to: 'hoehle' }]);
    // angekommen am Bahnhof Fledermaus: die Figur auf dem Bahnsteig, der Maulwurf zieht ein, Tok in den Lokschuppen
    expect(r.s.ride).toBeUndefined();
    expect(r.w.realm(r.s.player.x, r.s.player.y)).toBe('hoehle');
    expect(r.w.cell(r.s.player.x, r.s.player.y).stop).toBe(TRAIN.id);
    expect(r.s.packs.bahn).toEqual({ built: 2 });
    expect(r.events.filter((e) => e.type === 'home')).toEqual([{ type: 'home', id: FIRST_MOLE, species: 'maulwurf' }]);
    expect(r.s.animals.find((a) => a.id === TOK)).toMatchObject({ solo: true });
  });

  it('aus der Bucht: in den ersten 2 s wieder in die Bucht ausgestiegen, nichts gebaut; zu Fuß oder nach dem Laden der alte Weg', () => {
    const bay = inBay();
    const dir = intoTrain(bay.s, bay.w, 'home')!;
    const seated = play(bay.s, bay.w, [{ type: 'move', dir, fresh: true }, ...ticks(DEPART - 2)]);
    const at = stopsOf(trainRoute(W1, seated.s)!).home;
    const off = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).filter(([, [dx, dy]]) => {
      const [x, y] = [seated.s.player.x + dx, seated.s.player.y + dy];
      return !at.cells.has(`${x},${y}`) && W1.cell(x, y).ride === undefined && !W1.cell(x, y).solid;
    });
    expect(off.length).toBeGreaterThan(0);
    const left = play(seated.s, W1, [{ type: 'move', dir: off[0]![0] }]);
    expect(left.s.ride).toBeUndefined();
    expect(rides(left.events, 'leave')).toHaveLength(1);
    expect(left.w.realm(left.s.player.x, left.s.player.y)).toBe('lichtung'); // in der Bucht, nicht an Bahnhof Bär
    expect(cheb([left.s.player.x, left.s.player.y], at.seat)).toBe(1);
    expect(left.s.packs).toEqual(bay.s.packs);
    expect(left.s.work).toBeUndefined();
    // nur in der Bucht und nur, solange Bau 2 aussteht: an Bahnhof Bär, Tor zu, ohne Tok, schon gebaut nicht
    const s = bay.s;
    expect(onward2(s, W1, 'out')).toBeUndefined();
    expect(onward2({ ...s, openGates: ['eis'] }, W1, 'home')).toBeUndefined();
    expect(onward2({ ...s, packs: withBuilt({}, 1) }, W1, 'home')).toBeUndefined();
    expect(onward2({ ...s, packs: withBuilt(OPENED, 2) }, W2, 'home')).toBeUndefined();
    // Tor zu: aus der Bucht wie bisher zurück nach Bahnhof Bär
    const shut = play({ ...bay.s, openGates: ['eis'] }, W1, [{ type: 'move', dir, fresh: true }]);
    expect(shut.s.ride).toMatchObject({ to: 'out', pos: 0 });
    expect(shut.s.ride!.from).toBeUndefined();
    // nach dem Laden steht der Zug wieder an Bahnhof Bär (`docked` wird nicht gespeichert): Bau 2 von dort, wie bisher
    const loaded = awake(W1, onPlatform(W1).at, progressOf(bay.s).packs);
    expect(loaded.docked).toBeUndefined();
    expect(parked(TRAIN, trainRoute(W1, loaded)!, loaded, W1)?.end).toBe('out');
    const fromBear = rideIn(loaded, W1);
    expect(heralds(fromBear.events, 'sink')).toHaveLength(1);
    expect(fromBear.w.realm(fromBear.s.player.x, fromBear.s.player.y)).toBe('hoehle');
  });

  it('Start mitten auf der Linie kurz vor dem Tor (Fahr-Engine, `Vehicle.onward`): Das „Uh-uh“ kommt beim ersten Schritt, nie hinter dem Zug', () => {
    const cap = capOf(W2);
    const r2 = trainRoute(W2, { packs: withBuilt(OPENED, 2), openGates: [...OPEN_GATES] })!;
    const len = r2.path.length - 1;
    const dark = (i: number) => r2.dark!.has(r2.path[len - i]!.join(','));
    const gate = Array.from({ length: len - cap }, (_, k) => cap + k).find((i) => dark(i) && !dark(i - 1))!;
    const start = gate - 2; // näher am Tor als `WARN`: ab hier sähe der Blick nach vorn den Anfang nie
    expect(dark(start)).toBe(false);
    const probe = { ...train, depart: undefined, hold: undefined, onward: () => ({ to: 'home' as const, pos: start }) };
    const engine = FAHRT_PACK.rules!.ride!([probe]);
    const s = structuredClone(awake(W2, onPlatform(W2).at, withBuilt(OPENED, 2)));
    const events: GameEvent[] = [];
    expect(engine.move(s, W2, { type: 'move', dir: onPlatform(W2).dir, fresh: true }, events)).toBe(true);
    expect(s.ride).toMatchObject({ to: 'home', pos: start, from: { end: 'out', pos: start } });
    for (let i = 0; i < DEPART + 5; i++) {
      s.tick++;
      engine.tick(s, W2, events);
    }
    const warns = rides(events, 'tunnel');
    expect(warns).toHaveLength(1);
    expect([warns[0]!.x, warns[0]!.y]).toEqual(r2.path[len - start]); // dort, wo der Zug losfuhr
  });

  it('mitten in der Fahrt neu geladen (Ausbau 2, der Maulwurf läuft frei): Bei der nächsten Ankunft am Bahnhof Fledermaus zieht er ein, dann erwacht das Portal', () => {
    const packs = withBuilt(OPENED, 2);
    const loaded = initialState(W2, { packs, openGates: [...OPEN_GATES] });
    const mole = loaded.animals.find((a) => a.id === FIRST_MOLE)!;
    expect(mole.mode).not.toBe('home'); // nicht zu Hause: läuft frei in der Grotte
    const s = awake(W2, onPlatform(W2).at, packs);
    const free: State = { ...s, animals: [...s.animals, mole] };
    const run = rideIn(free, W2);
    expect(run.events.filter((e) => e.type === 'home')).toEqual([
      { type: 'home', id: FIRST_MOLE, species: 'maulwurf' },
    ]);
    expect(run.s.garden.map((a) => a.id)).toContain(FIRST_MOLE);
    expect(run.s.animals.filter((a) => a.id === FIRST_MOLE)).toHaveLength(1);
    expect(run.s.animals.find((a) => a.id === FIRST_MOLE)).toMatchObject({ mode: 'home', home: { kind: 'garden' } });
    expect(heralds(run.events, 'sink')).toHaveLength(0); // kein zweiter Bau
    // folgt er der Figur (sie ging zu Fuß und fuhr dann), ebenso
    const following: State = { ...free, followers: [FIRST_MOLE] };
    const run2 = rideIn(following, W2);
    expect(run2.s.followers).not.toContain(FIRST_MOLE);
    expect(run2.s.garden.map((a) => a.id)).toContain(FIRST_MOLE);
    // erst danach erwacht das Portal am stillen See
    const later = play(run.s, run.w, ticks(400));
    const bed = later.w.homes.hoehle.wake[0]!;
    expect(play({ ...later.s, player: { x: bed[0], y: bed[1], dir: 's' } }, later.w, [TICK]).s.portals).toContain(
      'hoehlensee',
    );
    // wohnt er schon zu Hause, zieht bei der Ankunft niemand mehr ein
    const again = rideIn({ ...run.s, ...awake(W2, onPlatform(W2).at, packs), garden: run.s.garden }, W2);
    expect(again.events.filter((e) => e.type === 'home')).toEqual([]);
  });

  it('Ansage je Bahnhof bei der Ankunft: Bär der Anfang der Bett-Melodie, Fledermaus A4–E4–C5 mit Echo, am Prellbock Ding-Dong', () => {
    const arrive: RideEvent = { type: 'ride', what: 'arrive', id: TRAIN.id, x: 0, y: 0 };
    const ride = (to: 'home' | 'out') => ({ to }) as State['ride'];
    const two = withBuilt(OPENED, 2);
    expect(trainScores(arrive, { ride: ride('out'), packs: two, openGates: [...OPEN_GATES] })).toEqual(BEAR_CALL);
    expect(trainScores(arrive, { ride: ride('home'), packs: two, openGates: [...OPEN_GATES] })).toEqual(BAT_CALL);
    const buffer = trainScores(arrive, { ride: ride('home'), packs: OPENED, openGates: [...OPEN_GATES] });
    expect(buffer).not.toEqual(BAT_CALL);
    expect(buffer).toEqual(trainScores({ ...arrive, what: 'board' }));
    expect(BAT_CALL.map(([f]) => Math.round(f))).toEqual([440, 330, 523]);
    const semis = (hz: number) => ((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12;
    for (const score of [BEAR_CALL, BAT_CALL]) {
      expect(score.length).toBeLessThanOrEqual(3);
      expect(score.filter(([, , , , , at]) => !at)).toHaveLength(1);
      expect(score.every(([f]) => [0, 2, 4, 7, 9].includes(semis(f)))).toBe(true);
    }
    // das Echo: der letzte Ton der Fledermaus klingt leiser und länger nach
    const [a, , echo] = BAT_CALL;
    expect(echo![1]).toBeGreaterThan(a![1]);
    expect(echo![3]).toBeLessThan(a![3]);
  });
});
