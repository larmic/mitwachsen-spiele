// Schmuck mit Zug (Schritt 13): Pfeif-Gruß, Laternenfahrt mit Kristall-Wimpel, warmes Licht ab 20 min, „Gute Nacht,
// Bahn“ samt Nachtlicht (mitwachsen-feast-look.ts, mitwachsen-train.ts `feast`, mitwachsen-station-look.ts), dazu die
// Gute Nacht des Schlittens (mit der Freigabe der Bahn). Reine Regeln über `step` mit den Paketen wie im Spiel
import { afterEach, describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { REGIONS, animalId, type Point } from '../../../../data/games/mitwachsen';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { BAHN_LIVE, bahnOn, tryBahn } from '../../../../data/games/mitwachsen-live';
import { TRAIN_COLORS } from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import { bahnWanted } from '../../mitwachsen-pack';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { SIGHT, bedSight, stopsOf } from '../../mitwachsen-ride-kit';
import { stageOf, withTok } from '../../mitwachsen-ride-save';
import type { RideAt } from '../../mitwachsen-ride-view';
import { initialState, progressOf, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { BAHN_PACK, FAHRT_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { withBuilt } from './mitwachsen-built';
import {
  FEAST,
  FLIES,
  NIGHT_WHISTLE,
  PFEIF,
  SPARKS,
  chirp,
  marmot,
  trainGoodNight,
  whistleBack,
} from './mitwachsen-feast-look';
import { stationBodies, stationOf } from './mitwachsen-station-look';
import { SEAT, TRAIN, feast, train, trainRoute } from './mitwachsen-train';
import { trainFx } from './mitwachsen-train-look';
import { view } from './view-2d';

const W1 = worldOf(1, [BAHN_PACK], { bahn: { built: 1 } });
const W2 = worldOf(1, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 2 } });
const RULES = [BAHN_PACK, FAHRT_PACK];
const TICK: Cmd = { type: 'tick' };
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
/** Nach dem Hau-ruck und Bau 2: Stufe `offen`, Ausbau 2, die erste Fahrt gemacht */
const OPEN = withBuilt(withTok({}, { stage: 'offen', gefahren: true }), 2);
const READY = withBuilt(withTok({}, { stage: 'bereit' }), 1);
const CAVE = REGIONS.find((r) => r.id === 'hoehle')!;
/** Von jeder Höhlen-Art wohnt eines zu Hause: die Höhlen-Leiste ist voll */
const FULL = CAVE.animals.map(({ species }) => ({ id: animalId('hoehle', species), species }));
const PENTA = new Set([0, 2, 4, 7, 9]);
const semis = (hz: number) => ((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12;

type Run = { s: State; events: GameEvent[] };
function play(s: State, world: World, cmds: readonly Cmd[]): Run {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, c, undefined, undefined, RULES);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
const rides = (e: readonly GameEvent[], what?: RideEvent['what']) =>
  e.filter((x): x is RideEvent => x.type === 'ride' && (!what || x.what === what));

function awake(world: World, p: Point, packs: Record<string, unknown>, more: Partial<State> = {}): State {
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

/** Einsteigen (Antippen, bis 4 Felder weit) und fahren, bis die Figur ausgestiegen ist; `look` sieht jedes Bild */
function ride(world: World, s: State, look?: (s: State) => void): Run {
  let r = play(s, world, [{ type: 'move', dir: 'n', fresh: true, tap: true, ride: TRAIN.id }]);
  for (let i = 0; i < 400 && r.s.ride; i++) {
    look?.(r.s);
    const n = play(r.s, world, [TICK]);
    r = { s: n.s, events: [...r.events, ...n.events] };
  }
  return r;
}

const ev = (what: RideEvent['what'], more: Partial<RideEvent> = {}): RideEvent => ({
  type: 'ride',
  what,
  id: 'hoehle',
  x: 0,
  y: 0,
  ...more,
});
const marmotAt = (id: string, x: number, y: number) =>
  ({ id, species: 'murmeltier', x, y, dir: 's', mode: 'wander' }) as State['animals'][number];

describe('Schmuck mit Zug: Freigabe', () => {
  afterEach(() => tryBahn(false));

  it('alles kommt mit dem Paket der Bahn, das bis zum Freischalten nie von selbst lädt', () => {
    expect(BAHN_LIVE).toBe(false);
    expect(bahnWanted({ openGates: ['eis', 'hoehle'] })).toBe(false);
    expect(view).toHaveProperty('goodNight', trainGoodNight);
    expect(train).toHaveProperty('feast', feast);
    tryBahn(false);
    expect(bahnOn()).toBe(false);
  });
});

describe('Pfeif-Gruß: tutet der Zug, pfeifen Murmeltiere zurück', () => {
  const near = { animals: [marmotAt('hoehle:murmeltier', 3, 4), marmotAt('hoehle:murmeltier:2', -6, 0)] } as State;

  it('beim Anstoßen, Halt, Abfahrt und gedrosselten Winken: bis zu zwei Murmeltiere in der Nähe hüpfen, ein Pfiff kurz danach', () => {
    for (const what of ['nudge', 'stop', 'go'] as const) {
      const fx = trainFx(ev(what), near)!;
      expect(fx.chorus, what).toEqual(['hoehle:murmeltier', 'hoehle:murmeltier:2']);
      expect(fx.score).toContainEqual(marmot(PFEIF.at));
      expect(fx.score.length, what).toBeLessThanOrEqual(3);
      expect(fx.score.filter((n) => !n[5]).length, what).toBeLessThanOrEqual(1);
      expect(
        fx.score.every(([f]) => PENTA.has(semis(f))),
        what,
      ).toBe(true);
    }
    expect(trainFx(ev('wave', { ring: true }), near)).toMatchObject({
      who: 'player',
      chorus: ['hoehle:murmeltier', 'hoehle:murmeltier:2'],
    });
    expect(trainFx(ev('wave'), near)!.chorus).toBeUndefined(); // ohne Tuten kein Gruß
    expect(trainFx(ev('board'), near)!.chorus).toBeUndefined();
  });

  it('nur Murmeltiere bis 10 Felder weit, höchstens zwei, die nächsten zuerst; sonst nichts', () => {
    const many = {
      animals: [
        marmotAt('a', PFEIF.reach + 1, 0),
        marmotAt('b', 5, 5),
        marmotAt('c', 1, 1),
        marmotAt('d', 2, 0),
        { ...marmotAt('e', 0, 1), species: 'dachs' },
      ],
    } as State;
    expect(whistleBack(ev('nudge'), many).chorus).toEqual(['c', 'd']);
    expect(whistleBack(ev('nudge'), { animals: [marmotAt('a', 11, 0)] })).toEqual({ score: [], chorus: [] });
    expect(whistleBack(ev('nudge'))).toEqual({ score: [], chorus: [] });
    expect(trainFx({ ...ev('nudge'), id: 'schlitten' }, near)).toBeUndefined();
    expect(marmot()).toEqual([880, 0.18, 'sine', 0.06, 1, 0]);
  });
});

describe('Laternenfahrt: die erste Heimfahrt nach voller Höhlen-Leiste (Regeln)', () => {
  const p = onPlatform(W2);
  const open = { openGates: ['hoehle' as const] };
  /** In die Grotte gefahren, die Figur steht neben Bahnhof Fledermaus */
  const inCave = (packs: Record<string, unknown>, garden = FULL) =>
    ride(W2, awake(W2, p.at, packs, { ...open, garden })).s;

  it('mit voller Höhlen-Leiste und Stufe `offen` ist die Fahrt auf die Lichtung das Fest: danach Stufe `fest`, gleich gespeichert', () => {
    const s = inCave(OPEN);
    expect(W2.realm(s.player.x, s.player.y)).toBe('hoehle');
    expect(stageOf(s.packs, TRAIN.id)).toBe('offen'); // die Fahrt in die Grotte ist kein Fest
    let feasting = false;
    const run = ride(W2, s, (x) => (feasting ||= !!x.ride?.feast));
    expect(feasting).toBe(true);
    expect(rides(run.events, 'farewell')).toHaveLength(1); // die Fledermaus wacht beim Losfahren auf
    const fest = rides(run.events, 'feast');
    expect(fest).toHaveLength(1);
    expect(fest[0]!.persist).toBe(true);
    expect(stageOf(run.s.packs, TRAIN.id)).toBe('fest');
    expect(progressOf(run.s).packs).toMatchObject({ fahrt: { hoehle: { stage: 'fest', gefahren: true } } });
    expect(W2.realm(run.s.player.x, run.s.player.y)).toBe('lichtung');
    // danach nie wieder ein Fest
    const again = ride(W2, inCave(run.s.packs));
    expect(rides(again.events, 'feast')).toEqual([]);
  });

  it('Zierde, nie Bedingung: ohne volle Leiste oder vor dem Hau-ruck fährt der Zug wie immer, ohne Fest', () => {
    const half = ride(W2, inCave(OPEN, FULL.slice(0, -1))); // ohne Glühwürmchen (der Maulwurf zieht am Bahnhof ein)
    expect(rides(half.events, 'feast')).toEqual([]);
    expect(stageOf(half.s.packs, TRAIN.id)).toBe('offen');
    const of = (packs: Record<string, unknown>, garden: readonly unknown[] = FULL, gates = ['hoehle']) =>
      feast({ packs, garden, openGates: gates } as unknown as State);
    expect(of(OPEN)).toBe(true);
    expect(of(withTok(OPEN, { stage: 'bereit' }))).toBe(false);
    expect(of(withTok(OPEN, { stage: 'fest' }))).toBe(false);
    expect(of(OPEN, [])).toBe(false);
    expect(of(withBuilt(withTok({}, { stage: 'offen', gefahren: true }), 1))).toBe(false); // Strecke nur bis zum Prellbock
    expect(of(OPEN, FULL, [])).toBe(false);
    // die Fahrt in die Grotte ist nie das Fest, auch mit voller Leiste
    const there = ride(W2, awake(W2, p.at, OPEN, { ...open, garden: FULL }));
    expect(rides(there.events, 'feast')).toEqual([]);
  });

  it('vor Bau 2 (Stufe `offen`, Ausbau 1): zu Fuß gefüllt, die Fahrt vom Prellbock zu Bahnhof Bär ist kein Fest', () => {
    const early = withBuilt(withTok({}, { stage: 'offen', gefahren: true }), 1);
    const r = trainRoute(W1, { packs: early, openGates: ['hoehle'] })!;
    const home = stopsOf(r).home.seat;
    const s = awake(W1, home, early, { ...open, garden: FULL, docked: { hoehle: 'home' } });
    const run = ride(W1, s);
    expect(run.s.ride).toBeUndefined();
    expect(rides(run.events, 'go').length).toBeGreaterThan(0); // er ist gefahren
    expect(rides(run.events, 'feast')).toEqual([]);
    expect(rides(run.events, 'farewell')).toEqual([]);
    expect(stageOf(run.s.packs, TRAIN.id)).toBe('offen');
  });

  it('Bild und Ton: Glühwürmchen folgen dem Zug, solange er in der Höhlenwelt ist (nicht bei reduzierter Bewegung); danach der Kristall-Wimpel', () => {
    const s = inCave(OPEN);
    let flies = 0,
      calm = 0,
      lit = true;
    const run = ride(W2, s, (x) => {
      if (!x.ride?.feast) return;
      const bodies = stationBodies(x, W2, AT);
      const ff = bodies.filter((b) => b.id.startsWith('bahn:gluehwurm:'));
      flies = Math.max(flies, ff.length);
      calm += stationBodies(x, W2, { ...AT, reduced: true }).filter((b) => b.id.startsWith('bahn:gluehwurm:')).length;
      const loco = bodies.find((b) => b.id === 'ride:hoehle:loco')!;
      if (!/:loco:\d{4}1:w$/.test(loco.key)) lit = false; // Lampen an und warmes Fensterband: Laternenfahrt
    });
    expect(flies).toBe(FLIES.n);
    expect(calm).toBe(0);
    expect(lit).toBe(true);
    const after = stationBodies(run.s, W2, AT).find((b) => b.id === 'ride:hoehle:loco')!;
    expect(after.key).toMatch(/:p$/);
    expect(after.parts.some((q) => q[6] === TRAIN_COLORS.mast)).toBe(true);
    expect(after.parts.some((q) => q[6] === '#b46a0c')).toBe(false); // kein Gold am Wimpel
    const before = stationBodies(s, W2, AT).find((b) => b.id === 'ride:hoehle:loco')!;
    expect(before.parts.some((q) => q[6] === TRAIN_COLORS.mast)).toBe(false);
  });

  it('Töne: die Fledermaus wacht auf und zirpt (Herz), Murmeltiere pfeifen beim Winken, am Ziel ein Fest mit Kristall-Funken', () => {
    const bat = { id: 'hoehle:fledermaus', species: 'fledermaus', x: 0, y: 0, dir: 's', mode: 'wander' };
    const st = { animals: [bat, marmotAt('hoehle:murmeltier', 1, 1)] } as State;
    expect(trainFx(ev('farewell'), st)).toEqual({ score: chirp(), who: 'hoehle:fledermaus', heart: true });
    expect(trainFx(ev('farewell'), { animals: [] } as unknown as State)).toEqual({ score: chirp() });
    expect(trainFx(ev('cheer', { who: 'hoehle:murmeltier' }), st)).toEqual({
      score: [marmot()],
      who: 'hoehle:murmeltier',
      heart: true,
    });
    expect(trainFx(ev('cheer', { who: 'hoehle:fledermaus' }), st)).toMatchObject({
      who: 'hoehle:fledermaus',
      heart: true,
    });
    expect(trainFx(ev('feast'), st)).toEqual({ score: FEAST, who: 'player', heart: true, burst: SPARKS });
    for (const score of [FEAST, chirp(), NIGHT_WHISTLE]) {
      expect(score.length).toBeLessThanOrEqual(3);
      expect(score.filter((n) => !n[5]).length).toBeLessThanOrEqual(1);
      expect(score.every(([f]) => PENTA.has(semis(f)))).toBe(true);
    }
  });
});

describe('Licht des Zugs: warm ab 20 min, „Gute Nacht, Bahn“ und Nachtlicht', () => {
  const { at } = onPlatform(W1);
  const bed = W1.homes.lichtung.bed;
  /** Die Figur schläft im Bett der Lichtung, der Zug steht an Bahnhof Bär */
  const asleep = (packs = READY, more: Partial<State> = {}): State => ({
    ...awake(W1, bed, packs),
    sleeping: true,
    ...more,
  });
  const bodies = (s: State, a: RideAt) => stationBodies(s, W1, a);
  const car = (s: State, a: RideAt, kind: string) => bodies(s, a).find((b) => b.id === `ride:hoehle:${kind}`)!;

  it('ab 20 min (`warm`) leuchtet das Fensterband jedes Wagens warm; davor nicht', () => {
    const s = awake(W1, at, READY);
    for (const kind of ['loco', 'mid', 'rear']) {
      expect(
        car(s, { ...AT, warm: true }, kind).parts.some((q) => q[6] === TRAIN_COLORS.warm),
        kind,
      ).toBe(true);
      expect(
        car(s, AT, kind).parts.some((q) => q[6] === TRAIN_COLORS.warm),
        kind,
      ).toBe(false);
    }
    // warm, Nachtlicht und Wimpel sind kein Gold: Gold nur, wo das Kind etwas tun kann
    const gold = new Set<string>(Object.values(GOLD));
    const all = car(
      awake(W1, at, withTok(READY, { stage: 'fest' })),
      { ...AT, warm: true, asleep: ['hoehle'] },
      'loco',
    );
    const extra = [TRAIN_COLORS.warm, TRAIN_COLORS.night, TRAIN_COLORS.mast, ...all.parts.map((q) => q[6])];
    expect(extra.filter((c) => typeof c === 'string' && gold.has(c))).toEqual([]);
  });

  it('schläft die Figur im Lichtungsbett und steht der Zug an Bahnhof Bär in Sichtweite, pfeift er leise gute Nacht', () => {
    const r = trainRoute(W1, { packs: READY, openGates: [] })!;
    const seat = stopsOf(r).out.seat;
    expect(Math.max(Math.abs(seat[0] - bed[0]), Math.abs(seat[1] - bed[1]))).toBeLessThanOrEqual(SIGHT);
    expect(trainGoodNight(asleep(), W1)).toEqual({ id: 'hoehle', score: NIGHT_WHISTLE });
    expect(trainGoodNight({ ...asleep(), sleeping: false }, W1)).toBeUndefined(); // wach
    expect(trainGoodNight(asleep(READY, { player: { x: at[0], y: at[1], dir: 's' } }), W1)).toBeUndefined(); // nicht im Bett
    expect(trainGoodNight(asleep(READY, { docked: { hoehle: 'home' } }), W1)).toBeUndefined(); // am Prellbock: zu weit
    expect(trainGoodNight(asleep(READY, { dozing: ['hoehle'] }), W1)).toBeUndefined(); // er schläft schon
    expect(trainGoodNight(asleep({}), W1)).toBeUndefined(); // noch kein Zug
    expect(bedSight(TRAIN, r, { ...asleep(), player: { x: bed[0] + 1, y: bed[1], dir: 's' } }, W1)).toBeUndefined();
  });

  it('nach „Gute Nacht“ (`asleep`) sind Lampen, Fensterband und Dampf aus, nur das kleine Nachtlicht der Lok brennt', () => {
    const s = asleep();
    const night: RideAt = { ...AT, lit: true, warm: true, asleep: ['hoehle'] };
    const loco = car(s, night, 'loco');
    expect(loco.key).toMatch(/0:n$/);
    expect(loco.parts.some((q) => q[6] === TRAIN_COLORS.night)).toBe(true);
    expect(loco.parts.some((q) => q[6] === TRAIN_COLORS.lit || q[6] === TRAIN_COLORS.warm)).toBe(false);
    expect(bodies(s, night).some((b) => b.id === 'ride:hoehle:dampf')).toBe(false);
    // vorher: Lampen und Fenster an, kein Nachtlicht; ein anderes Fahrzeug im Schlaf ändert nichts
    const before = car(s, { ...night, asleep: ['schlitten'] }, 'loco');
    expect(before.parts.some((q) => q[6] === TRAIN_COLORS.lit)).toBe(true);
    expect(before.parts.some((q) => q[6] === TRAIN_COLORS.night)).toBe(false);
  });
});
