// Fahr-Engine (mitwachsen-ride.ts): Dauer einer Fahrt (immer 15–20 s, das Tempo des Zugs ist sein Höchsttempo) und die
// Schleife (`RideRoute.loop`, die Grubenbahn): ein Halt für beide Enden, immer vorwärts, kein Fest, kein Wimpel, kein
// „Gute Nacht“. Schlitten und Zug prüfen ihre Tests in worlds/eis/ und worlds/bahn/
import { describe, expect, it } from 'vitest';
import { DIRS } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { RIDES, type LoopSpec, type RideSpec } from '../../../../data/games/mitwachsen-rides';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { ALIGHT, DEPART, DUE, SIGHT, bedSight, cellOf, loopOk, parked, stopsOf } from '../../mitwachsen-ride-kit';
import type { MoveCmd, RideRoute, Vehicle } from '../../mitwachsen-rider';
import { stageOf } from '../../mitwachsen-ride-save';
import { initialState, type State } from '../../mitwachsen-state';
import { canStep, standHeight } from '../../mitwachsen-world';
import { bareOf } from '../../test-worlds';
import { rideRules, rideTicks } from './mitwachsen-ride';

const [SLED, TRAIN] = [RIDES.find((r) => r.id === 'schlitten')!, RIDES.find((r) => r.id === 'hoehle')!];

describe('Dauer einer Fahrt (rideTicks)', () => {
  it('Schlitten: Länge × 1,5 Takte, in 15–20 s gehalten', () => {
    expect(rideTicks(SLED, 40)).toBe(150);
    expect(rideTicks(SLED, 120)).toBe(180);
    expect(rideTicks(SLED, 400)).toBe(200);
  });

  it('Zug: höchstens 8 Felder je Sekunde, eine kurze Strecke (Prellbock in der Bucht) fährt langsamer und dauert doch 15 s', () => {
    expect(TRAIN.pace).toBe(0.8);
    for (const len of [20, 63, 91, 120, 140, 165, 300]) {
      const t = rideTicks(TRAIN, len);
      expect(t, `${len} Felder`).toBeGreaterThanOrEqual(150);
      expect(t, `${len} Felder`).toBeLessThanOrEqual(200);
      if (len / TRAIN.pace! >= 150 && len / TRAIN.pace! <= 200) expect(t).toBe(Math.round(len / TRAIN.pace!));
    }
    expect(63 / rideTicks(TRAIN, 63)).toBeLessThan(0.5); // gut 4 Felder je Sekunde bis zum Prellbock
  });
});

// ---------- Schleife (`RideRoute.loop`) ----------

const W = bareOf(1);
const keyOf = ([x, y]: Point) => `${x},${y}`;
/** Ein Fahrzeug, das eine Schleife fährt (wie die Grubenbahn Funkel, deren Strecke ihr Paket aus der Grotte rechnet) */
const LOOP: LoopSpec = {
  id: 'grube',
  gate: 'hoehle',
  ticks: [150, 200],
  pace: 0.8,
  signal: [587.33, 880],
  color: '#2f8f8a',
  loop: true,
};

const [LW, LH] = [12, 6];
/**
 * Platz des Sitzes nahe dem Bett der Lichtung: Von ihm geht es eben ein Feld nach Norden, weg von der Schleife (dort
 * steigt die Figur in den ersten 2 s wieder aus)
 */
function seatSpot(): Point {
  const [bx, by] = W.homes.lichtung.bed;
  const ok = (x: number, y: number) =>
    standHeight(W, [], x, y) !== null &&
    standHeight(W, [], x, y) === standHeight(W, [], x, y - 1) &&
    canStep(W, [], x, y, x, y - 1);
  for (let d = 3; d <= 8; d++)
    for (let y = by - d; y <= by + d; y++) for (let x = bx - d; x <= bx + d; x++) if (ok(x, y)) return [x, y];
  throw new Error('kein Platz für den Halt der Schleife');
}

/**
 * Eine rechteckige Schleife nahe dem Bett der Lichtung (nur für die Engine: Sie rechnet unterwegs nicht mit dem Gelände): beginnt
 * und endet am Sitz des Halts, oben nach Osten, rechts nach Süden, unten nach Westen, links nach Norden
 */
function loopPath(): Point[] {
  const [x0, y0] = seatSpot();
  const [w, h] = [LW, LH];
  const p: Point[] = [];
  for (let x = x0; x < x0 + w; x++) p.push([x, y0]);
  for (let y = y0; y < y0 + h; y++) p.push([x0 + w, y]);
  for (let x = x0 + w; x > x0; x--) p.push([x, y0 + h]);
  for (let y = y0 + h; y >= y0; y--) p.push([x0, y]);
  return p; // das letzte Feld ist wieder der Sitz
}
const PATH = loopPath();
const SEAT = PATH[0]!;
const ROUTE: RideRoute = {
  path: PATH,
  stops: { home: SEAT, out: SEAT },
  shed: [],
  seats: { home: [], out: [] },
  on: new Set(PATH.map(keyOf)),
  loop: true,
};
/** Ein Fahrzeug mit Schleife; `feast` und `onward` sagen immer ja und dürfen bei einer Schleife nichts ändern */
const LOOPER: Vehicle = {
  spec: LOOP,
  route: () => ROUTE,
  ready: () => true,
  feast: () => true,
  onward: () => ({ to: 'out', pos: 5 }),
};

/** Wach neben dem Halt der Schleife (ein Feld nördlich des Sitzes), ohne Tiere im Weg */
function awake(): State {
  const s = initialState(W, {});
  return { ...s, sleeping: false, wokeAt: -100, player: { x: SEAT[0], y: SEAT[1] - 1, dir: 's' }, animals: [] };
}

type Log = { events: RideEvent[]; cells: Point[] };
const logOf = (): Log => ({ events: [], cells: [] });
const pushTo = (log: Log) => ({ push: (...e: unknown[]) => log.events.push(...(e as RideEvent[])) });
/** `n` Takte mit den Regeln der Schleife; merkt Ereignisse und das Feld der Figur nach jedem Takt */
function run(s: State, n: number, log: Log = logOf()): Log {
  const rules = rideRules(LOOPER);
  for (let i = 0; i < n; i++) {
    s.tick++;
    rules.tick(s, W, pushTo(log));
    log.cells.push([s.player.x, s.player.y]);
  }
  return log;
}
const TAP: MoveCmd = { type: 'move', dir: 's', fresh: true, tap: true, ride: 'grube' };
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

describe('Schleife (RideRoute.loop, die Grubenbahn)', () => {
  it('Eintrag: Schleife ohne Halt auf der Lichtung, ohne Wimpel; Schlitten und Zug pendeln wie bisher', () => {
    const loop: RideSpec = LOOP;
    expect(loop.loop).toBe(true);
    expect(loop.out).toBeUndefined();
    expect(loop.pennant).toBeUndefined();
    // Schlitten und Zug pendeln, nur Funkel (die Grubenbahn) fährt eine Schleife; der Rodelreifen fährt nur bergab
    expect(RIDES.filter((r) => !r.loop && !r.slide).map((r) => r.id)).toEqual(['schlitten', 'hoehle']);
    expect(RIDES.filter((r) => !r.loop && !r.slide).every((r) => !!r.out && !!r.pennant)).toBe(true);
    expect(RIDES.filter((r) => r.slide).map((r) => [r.id, r.out, r.pennant, r.loop])).toEqual([
      ['rodel', undefined, undefined, undefined],
    ]);
    expect(RIDES.filter((r) => r.loop).map((r) => [r.id, r.out, r.pennant])).toEqual([['grube', undefined, undefined]]);
  });

  it('stopsOf: beide Enden sind derselbe Halt, Sitz auf dem ersten Feld, Zugtier auf dem zweiten', () => {
    const at = stopsOf(ROUTE);
    expect(at.out).toBe(at.home);
    expect(at.home.end).toBe('home');
    expect(at.home.seat).toEqual(SEAT);
    expect(at.home.pull).toEqual(PATH[1]);
    // ohne `loop` bleiben es zwei Halte an beiden Enden
    const shuttle = stopsOf({ ...ROUTE, loop: undefined });
    expect(shuttle.out.seat).toEqual(PATH.at(-1));
    expect(shuttle.out.pull).toEqual(PATH.at(-2));
    expect(shuttle.out).not.toBe(shuttle.home);
  });

  it('cellOf: auf der Schleife immer vorwärts, auf einer Pendelstrecke heim rückwärts', () => {
    const wrong: string[] = [];
    for (const to of ['home', 'out'] as const)
      for (const pos of [0, 1, 7.5, PATH.length - 1])
        if (keyOf(cellOf(ROUTE, { to }, pos)) !== keyOf(PATH[Math.floor(pos)]!)) wrong.push(`${to} ${pos}`);
    expect(wrong).toEqual([]);
    const shuttle = { path: PATH };
    expect(cellOf(shuttle, { to: 'home' }, 1)).toEqual(PATH.at(-2));
    expect(cellOf(shuttle, { to: 'out' }, 1)).toEqual(PATH[1]);
  });

  it('parked: steht an seinem einen Halt, solange die Figur in dessen Gegend ist, ab „bereit“', () => {
    const s = awake();
    expect(parked(LOOP, ROUTE, s, W)).toBeUndefined(); // noch nicht da
    run(s, DUE + 1);
    expect(stageOf(s.packs, 'grube')).toBe('bereit');
    expect(parked(LOOP, ROUTE, s, W)).toBe(stopsOf(ROUTE).home);
    expect(parked(LOOP, ROUTE, { ...s, docked: { grube: 'out' } }, W)).toBe(stopsOf(ROUTE).home);
  });

  it('eine Runde: einsteigen, immer vorwärts herum, am selben Halt aussteigen; kein Fest, kein Wimpel, kein `onward`', () => {
    const s = awake();
    run(s, DUE + 1); // erschienen
    const log = logOf();
    expect(rideRules(LOOPER).move(s, W, TAP, pushTo(log))).toBe(true);
    expect(s.ride).toMatchObject({ id: 'grube', to: 'home', pos: 0, feast: false });
    expect(s.ride?.from).toBeUndefined();
    expect([s.player.x, s.player.y]).toEqual(SEAT);
    expect(DIRS[s.player.dir]).toEqual([PATH[1]![0] - SEAT[0], PATH[1]![1] - SEAT[1]]); // schaut vorwärts
    const t = rideTicks(LOOP, PATH.length - 1);
    run(s, DEPART + t + ALIGHT + 2, log);
    expect(s.ride).toBeUndefined();
    // jedes Feld unterwegs liegt auf der Schleife, ihr Fortschritt nimmt nie ab, und sie kommt ganz herum
    const cells = log.cells.slice(0, DEPART + t + 1);
    const start = cells.findIndex((c) => keyOf(c) !== keyOf(SEAT)); // bis zur Abfahrt auf dem Sitz
    expect(start).toBeGreaterThanOrEqual(DEPART);
    const idx = cells.slice(start).map((c) => PATH.findIndex((p, j) => j > 0 && keyOf(p) === keyOf(c)));
    expect(idx.filter((i) => i < 0)).toEqual([]);
    const back = idx.findIndex((i, j) => j > 0 && i < idx[j - 1]!);
    expect(back, `rückwärts bei Takt ${back}`).toBe(-1);
    expect(idx.at(-1)).toBe(PATH.length - 1);
    const what = log.events.map((e) => e.what);
    expect(what).toEqual(expect.arrayContaining(['board', 'go', 'arrive', 'alight']));
    expect(what.filter((w) => w === 'feast' || w === 'farewell' || w === 'cheer')).toEqual([]);
    expect(log.events.find((e) => e.what === 'arrive')).toMatchObject({ x: SEAT[0], y: SEAT[1] });
    // ausgestiegen neben dem einen Halt, nicht auf der Schleife; die Stufe bleibt (nie `fest`: kein Wimpel)
    expect(ROUTE.on.has(keyOf([s.player.x, s.player.y]))).toBe(false);
    expect(cheb([s.player.x, s.player.y], SEAT)).toBeLessThanOrEqual(2);
    expect(s.docked?.grube).toBe('home');
    expect(stageOf(s.packs, 'grube')).toBe('bereit');
    // noch eine Runde: wieder vom selben Halt, wieder ohne Fest
    expect(rideRules(LOOPER).move(s, W, TAP, pushTo(log))).toBe(true);
    expect(s.ride).toMatchObject({ to: 'home', feast: false });
    run(s, DEPART + t + ALIGHT + 2, log);
    expect(s.ride).toBeUndefined();
    expect(stageOf(s.packs, 'grube')).toBe('bereit');
  });

  it('in den ersten 2 s steigt ein Pfeil weg wieder aus, am selben Halt', () => {
    const s = awake();
    run(s, DUE + 1);
    const log = logOf();
    const rules = rideRules(LOOPER);
    rules.move(s, W, TAP, pushTo(log));
    expect(s.ride).toBeDefined();
    rules.move(s, W, { type: 'move', dir: 'n', fresh: true }, pushTo(log)); // vom Sitz nach Norden, weg von der Schleife
    expect(s.ride).toBeUndefined();
    expect([s.player.x, s.player.y]).toEqual([SEAT[0], SEAT[1] - 1]);
    expect(log.events.at(-1)?.what).toBe('leave');
  });

  it('Sperren: Halt immer, Strecke nur für umherlaufende Tiere, abseits nichts; vor „bereit“ nichts', () => {
    const rules = rideRules(LOOPER);
    const before = awake();
    const a = { id: 'test:hase', species: 'hase', x: 0, y: 0, dir: 's', mode: 'wander' } as State['animals'][number];
    expect(rules.blocks(before, W, a, ...SEAT)).toBe(false); // noch nicht da
    const s = awake();
    run(s, DUE + 1);
    const mid = PATH[Math.floor(PATH.length / 2)]!;
    const off: Point = [SEAT[0] + 3, SEAT[1] + 3]; // innerhalb des Rechtecks, nicht auf der Schleife
    expect(ROUTE.on.has(keyOf(off))).toBe(false);
    expect(rules.blocks(s, W, a, ...SEAT)).toBe(true);
    expect(rules.blocks(s, W, { ...a, mode: 'home' }, ...SEAT)).toBe(true);
    expect(rules.blocks(s, W, { ...a, mode: 'home' }, ...PATH[1]!)).toBe(true); // Zugtier am Halt
    expect(rules.blocks(s, W, a, ...mid)).toBe(true);
    expect(rules.blocks(s, W, { ...a, mode: 'home' }, ...mid)).toBe(false);
    expect(rules.blocks(s, W, a, ...off)).toBe(false);
  });

  it('loopOk: eine Schleife beginnt und endet am Sitz ihres einen Halts, sonst bricht stopsOf ab', () => {
    expect(loopOk(ROUTE)).toBe(true);
    expect(loopOk({ ...ROUTE, path: PATH.slice(0, -1), loop: undefined })).toBe(true); // Pendelstrecke: immer
    const broken: RideRoute[] = [
      { ...ROUTE, path: PATH.slice(0, -1) }, // endet nicht am Sitz
      { ...ROUTE, stops: { home: SEAT, out: PATH[3]! } }, // zwei Halte
      { ...ROUTE, stops: { home: PATH[3]!, out: PATH[3]! } }, // Halt nicht am Anfang
      { ...ROUTE, seats: { home: [PATH[3]!], out: [] } }, // andere Warteplätze je Ende
      { ...ROUTE, path: [] },
    ];
    expect(broken.map((r) => loopOk(r))).toEqual(broken.map(() => false));
    expect(() => stopsOf(broken[0]!)).toThrow();
  });

  it('kein „Gute Nacht“: auch in Sichtweite des Lichtungsbetts nicht, eine Pendelstrecke dort schon', () => {
    const bed = W.homes.lichtung.bed;
    expect(cheb(SEAT, bed)).toBeLessThanOrEqual(SIGHT);
    const s = awake();
    run(s, DUE + 1);
    const asleep: State = { ...s, sleeping: true, player: { x: bed[0], y: bed[1], dir: 's' } };
    expect(bedSight(LOOP, ROUTE, asleep, W)).toBeUndefined();
    const shuttle: RideSpec = { ...TRAIN, id: 'grube' };
    expect(bedSight(shuttle, { ...ROUTE, loop: undefined }, asleep, W)).toBeDefined();
  });
});
