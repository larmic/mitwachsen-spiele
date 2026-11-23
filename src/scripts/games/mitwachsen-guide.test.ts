// Der verlaufene Pinguin holt die Figur ab und öffnet das Eistor (`opens: { key: 'pinguin' }`), gegen die echten Daten.
import { beforeAll, describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../lib/games/front';
import { GATES, REGIONS, animalId, gateOfKey, keyOf, regionAnimalList, type Point } from '../../data/games/mitwachsen';
import {
  initialState,
  progressOf,
  regionAnimals,
  step,
  type Animal,
  type Cmd,
  type GameEvent,
  type State,
} from './mitwachsen-state';
import {
  APPEAR,
  DUE,
  FAR,
  GUIDE,
  GUIDE_GATE,
  full,
  keyAnimal,
  keyed,
  LOST,
  NEAR,
  PEEP_EVERY,
  HINT_AFTER,
  HINT_EVERY,
  RITUAL,
  SLIDE,
  guideGate,
  hint,
  leader,
  lost,
  missing,
  nope,
  pending,
  wanted,
} from './mitwachsen-guide';
import * as rules from './worlds/eis/mitwachsen-lead';
import { COME, toGate } from './worlds/eis/mitwachsen-lead';
import {
  BREATH,
  HOP_AGAIN,
  OPEN_TICKS,
  SLIDE_PACE,
  WINGS,
  mouth,
  preTicks,
  shut,
  toMeadow,
} from './worlds/eis/mitwachsen-ritual';
import { lageOf, leadTicks, type Lage } from './mitwachsen-turn-pace';
import { BESIDE, bay, inBay, plateRow } from './mitwachsen-bay';
import { BOB_EVERY, NET } from './worlds/eis/mitwachsen-bay';
import { plateMid } from './mitwachsen-plate';
import { canStep, standHeight, type World } from './mitwachsen-world';
import { dirTo as faceTo } from './mitwachsen-free';
import { PACKS, seedRange, seedsFor, worldOf } from './test-worlds';
import { HOLD_MS } from './input-pace';

// Die Welten der Tests einmal vorab bauen (Frist der Hooks: vitest.config.ts): Sonst zahlt der erste Test je Seed den Bau (`worldOf`)
beforeAll(() => [1, 2, 3].forEach((s) => worldOf(s)));

const TICK: Cmd = { type: 'tick' };
/** Seeds der wilden Läufe mit führendem Pinguin: sonst 1 und 2, tief (MITWACHSEN_DEEP) 1 bis 12 (seedsFor) */
const WILD = seedsFor(seedRange(1, 12), [1, 2]);
const TICK_MS = 100; // Takt der Regeln (larmic-mitwachsen.ts)
const HELD: Cmd = { type: 'tick', held: true }; // Takt mit gedrücktem Pfeil
const key = ([x, y]: Point) => `${x},${y}`;
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Alle Tiere der Lichtung wohnen auf der Wiese (Tiere der Landschaft nicht) */
const everyone = () => regionAnimals('lichtung').map((id) => ({ id, species: id.split(':')[1] as 'hase' }));

function run(s: State, world: World, ...cmds: (Cmd | Dir)[]) {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, typeof c === 'string' ? { type: 'move', dir: c } : c, undefined, rules);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
const ticks = (n: number): Cmd[] => Array.from({ length: n }, () => TICK);
const guideOf = (s: State) => s.animals.find((a) => a.id === GUIDE);
/** Vorspiel des Eistors dieser Welt in Takten (je Torlage) und das Ereignis, wenn es aufgeht (Flügel danach) */
const leadOf = (world: World) => leadTicks(lageOf(world.gates.get('eis')!.out));
const gateEvent = (world: World) => ({ type: 'gate', id: 'eis', at: leadOf(world) + WINGS });
/** Schritte bis zum Platz des Pinguins neben der Torplatte (Weg der Wegfindung) */
const dist = (world: World, a: { x: number; y: number }) => toGate(world).get(`${a.x},${a.y}`) ?? Infinity;
/** Nächstes Feld auf dem Weg zum Tor */
function downhill(world: World, [x, y]: Point): Point {
  const field = toGate(world);
  const here = field.get(key([x, y]))!;
  const next = Object.values(DIRS)
    .map(([dx, dy]): Point => [x + dx, y + dy])
    .find((p) => field.get(key(p)) === here - 1);
  return next!;
}
const dirTo = (from: Point, to: Point): Dir =>
  Object.entries(DIRS).find(([, [dx, dy]]) => from[0] + dx === to[0] && from[1] + dy === to[1])![0] as Dir;
/** Ein Feld auf dem Weg zum Tor, `steps` Schritte davor */
function onPath(world: World, steps: number): Point {
  const field = toGate(world);
  for (const [k, d] of field) if (d === steps) return k.split(',').map(Number) as unknown as Point;
  throw new Error('kein Feld so weit vom Tor');
}

/** Wacher Zustand: alle Tiere der Lichtung zu Hause, die Figur auf `at`, der Pinguin führend auf `penguin` (ohne weitere Tiere) */
function leading(world: World, at: Point, penguin: Point, extra: Animal[] = []): State {
  const s = initialState(world, { garden: everyone() });
  const g: Animal = {
    id: GUIDE,
    species: 'pinguin',
    x: penguin[0],
    y: penguin[1],
    dir: 's',
    mode: 'lead',
    home: { kind: 'region', region: 'eis' },
    realm: 'eis',
    spawn: penguin,
    rest: 0,
  };
  return { ...s, sleeping: false, wokeAt: -100, player: { x: at[0], y: at[1], dir: 's' }, animals: [g, ...extra] };
}

describe('Der Pinguin holt dich ab: Auftauchen', () => {
  const world = worldOf(1);

  it('das Eistor hat seinen Schlüssel; solange es zu ist, wohnt der Pinguin nicht im Kessel', () => {
    expect(GATES.find((g) => g.id === 'eis')!.opens).toEqual({ key: 'pinguin' });
    expect(lost(GUIDE, [])).toBe(true);
    expect(lost(GUIDE, ['eis'])).toBe(false);
    expect(lost(animalId('eis', 'pinguin', 2), [])).toBe(false); // nur der eine verlaufene
    expect(initialState(world).animals.some((a) => a.id === GUIDE)).toBe(false);
    expect(initialState(world).animals.filter((a) => a.realm === 'eis')).toHaveLength(49);
    const open = initialState(world, { openGates: ['eis'] });
    expect(open.animals.find((a) => a.id === GUIDE)!.mode).toBe('wander'); // Tor offen: Er wohnt im Kessel
  });

  it('erscheint, sobald die Leiste voll ist (je Art ein Tier der Lichtung zu Hause); Tiere der Landschaft zählen nicht', () => {
    const first = everyone()[0]!.species;
    const wild = { id: 'wild:0:0:0', species: first };
    const missing = everyone().filter((a) => a.species !== first); // eine ganze Art fehlt
    const onePerSpecies = [...new Map(everyone().map((a) => [a.species, a])).values()];
    expect(wanted({ openGates: [], garden: everyone() })).toBe(true);
    expect(wanted({ openGates: [], garden: onePerSpecies })).toBe(true); // die anderen drei je Art braucht es nicht
    expect(wanted({ openGates: [], garden: [...missing, wild] })).toBe(false); // ein Tier der Landschaft ersetzt die Art nicht
    expect(wanted({ openGates: ['eis'], garden: everyone() })).toBe(false); // Tor schon offen
    for (const garden of [missing, [...missing, wild]]) {
      const r = run({ ...initialState(world, { garden }), sleeping: false, wokeAt: -100 }, world, ...ticks(200));
      expect(guideOf(r.s), String(garden.length)).toBeUndefined();
    }
  });

  it('full: Leiste einer Gegend voll, auch in der Eis-Welt (der Pinguin zählt mit, Tiere der Landschaft nicht)', () => {
    const eis = REGIONS[1]!;
    const ice = regionAnimalList(eis);
    const onePerSpecies = [...new Map(ice.map((a) => [a.species, a])).values()];
    expect(eis.id).toBe('eis');
    expect(onePerSpecies).toHaveLength(eis.animals.length);
    expect(full({ garden: [] }, eis)).toBe(false);
    expect(full({ garden: ice }, eis)).toBe(true);
    expect(full({ garden: onePerSpecies }, eis)).toBe(true);
    expect(full({ garden: onePerSpecies.filter((a) => a.species !== 'pinguin') }, eis)).toBe(false);
    const wild = { id: 'wild:0:0:0', species: 'pinguin' as const };
    expect(full({ garden: [...onePerSpecies.filter((a) => a.species !== 'pinguin'), wild] }, eis)).toBe(false);
    expect(full({ garden: [...everyone(), ...onePerSpecies.slice(1)] }, eis)).toBe(false); // die Lichtung zählt nicht
    expect(full({ garden: everyone() }, REGIONS[0])).toBe(true);
    expect(full({ garden: ice }, REGIONS[0])).toBe(false);
  });

  it('kommt erst, wenn die Figur in der Nähe des Betts der Lichtung steht (so weit die Wiese reicht)', () => {
    const home = world.homes.lichtung;
    const awake = { ...initialState(world, { garden: everyone() }), sleeping: false, wokeAt: -100 };
    const far = { x: home.bed[0] + home.meadow + 4, y: home.bed[1], dir: 's' as const };
    let r = run({ ...awake, player: far }, world, ...ticks(200));
    expect(guideOf(r.s)).toBeUndefined(); // Leiste voll, aber weit weg vom Bett
    const [wx, wy] = home.wake[0]!;
    r = run({ ...r.s, player: { x: wx, y: wy, dir: 's' } }, world, ...ticks(DUE - 1));
    expect(guideOf(r.s)).toBeUndefined(); // am Bett: noch gut 2 s …
    r = run(r.s, world, ...ticks(2));
    expect(guideOf(r.s)?.mode).toBe('lead'); // … dann taucht er auf
  });

  for (const seed of [1, 2, 3]) {
    it(`Seed ${seed}: alter Stand mit allen Tieren zu Hause: beim nächsten Aufwachen 4 bis 6 Felder neben der Figur, auf freiem Feld`, () => {
      const world = worldOf(seed);
      let s = initialState(world, { garden: everyone() });
      s = run(s, world, ...ticks(50)).s; // im Schlaf: noch nicht
      expect(guideOf(s)).toBeUndefined();
      const r = run(s, world, 'n'); // die erste Taste weckt
      const g = guideOf(r.s)!;
      expect(r.events).toContainEqual({ type: 'guide', id: GUIDE, species: 'pinguin', x: g.x, y: g.y });
      expect(g.mode).toBe('lead');
      expect(cheb(g, r.s.player)).toBeGreaterThanOrEqual(APPEAR[0]);
      expect(cheb(g, r.s.player)).toBeLessThanOrEqual(APPEAR[1]);
      expect(standHeight(world, r.s.openGates, g.x, g.y)).not.toBeNull();
      expect(r.s.animals.filter((a) => a.x === g.x && a.y === g.y)).toHaveLength(1);
      expect(dist(world, g)).toBeLessThan(Infinity); // von dort kommt er zum Tor
      expect(guideGate(r.s)).toBe('eis');
    });
  }

  for (const seed of [1, 2, 3]) {
    it(`Seed ${seed}: er watschelt selbst zur Figur, hüpft und zeigt ein Herz (arrive), erst dann führt er`, () => {
      const world = worldOf(seed);
      let r = run(initialState(world, { garden: everyone() }), world, 'n'); // aufwachen: Er taucht auf
      let g = guideOf(r.s)!;
      let t = 0;
      for (; t < 60 && !r.events.some((e) => e.type === 'arrive'); t++) {
        r = run(r.s, world, TICK);
        g = guideOf(r.s)!;
        expect(cheb(g, r.s.player), `Takt ${t}`).toBeLessThanOrEqual(APPEAR[1] + 1); // auf dem Weg zu ihr
        expect(r.events.map((e) => e.type)).not.toContain('peep'); // unterwegs piept er nicht
      }
      expect(r.events).toContainEqual({ type: 'arrive', id: GUIDE, species: 'pinguin' });
      expect(cheb(g, r.s.player)).toBeLessThanOrEqual(NEAR); // bei ihr
      // wenige Sekunden nach dem Auftauchen; Tiere der Wiese können ihn kurz umleiten, aber angekommen ist er bei ihr
      // vor `COME` Takten (sonst freute er sich nur dort, wo er gerade ist)
      expect(t).toBeLessThan(COME);
      const later = run(r.s, world, ...ticks(40)).s;
      expect(dist(world, guideOf(later)!)).toBeLessThan(dist(world, later.player)); // jetzt führt er, vor ihr
      expect(run(later, world, ...ticks(40)).events.map((e) => e.type)).not.toContain('arrive'); // nur einmal
    });
  }

  it('ohne die nachgeladenen Regeln des Führens taucht er nicht auf; mit ihnen gut 2 s später', () => {
    let s = { ...initialState(world, { garden: everyone() }), sleeping: false, wokeAt: -100 };
    for (let i = 0; i < 100; i++) s = step(s, world, TICK).state; // ohne `guide`
    expect(guideOf(s)).toBeUndefined();
    const r = run(s, world, ...ticks(DUE + 1));
    expect(guideOf(r.s)?.mode).toBe('lead');
  });

  it('zieht das letzte Tier der Lichtung ein, taucht er gut 2 s später auf (nicht vorher)', () => {
    const last = animalId('lichtung', 'hase');
    const garden = everyone().filter((p) => p.id !== last);
    // Die Figur geht auf der Wiese nach Osten, der Hase folgt ihr von der Wiese aus: Er zieht beim Schritt ein
    const ok = (x: number, y: number) => world.cell(x, y).garden && standHeight(world, [], x, y) !== null;
    const start: Point = [-3, 4];
    expect([ok(-4, 4), ok(-3, 4), ok(-2, 4)]).toEqual([true, true, true]);
    let s = initialState(world, { garden });
    const hase = s.animals.find((a) => a.id === last)!;
    s = {
      ...s,
      sleeping: false,
      wokeAt: -100,
      player: { x: start[0], y: start[1], dir: 'e' },
      animals: [{ ...hase, mode: 'follow', x: -4, y: 4 }], // die anderen Tiere stehen hier nicht im Weg
      followers: [last],
    };
    const moved = run(s, world, 'e');
    expect(moved.events).toContainEqual({ type: 'home', id: last, species: 'hase' });
    let t = 0;
    let r = moved;
    while (!guideOf(r.s) && t < 100) {
      r = run(r.s, world, TICK);
      t++;
    }
    expect(t).toBeGreaterThanOrEqual(DUE);
    expect(t).toBeLessThanOrEqual(DUE + 2);
  });

  it('ist die Figur weit weg (Reise mit einer Plattform), taucht er wieder neben ihr auf', () => {
    const p = onPath(world, 40);
    const s = leading(world, p, downhill(world, downhill(world, p)));
    const far: Point = [p[0] + (LOST + 5) * Math.sign(-p[0] || 1), p[1]];
    const moved = { ...s, player: { ...s.player, x: far[0], y: far[1] } };
    expect(standHeight(world, [], ...far)).not.toBeNull();
    const r = run(moved, world, TICK);
    const g = guideOf(r.s)!;
    expect(r.events.map((e) => e.type)).toContain('guide');
    expect(cheb(g, r.s.player)).toBeLessThanOrEqual(APPEAR[1]);
  });
});

describe('Der Pinguin holt dich ab: Führen', () => {
  const world = worldOf(1);

  it('führt 2 bis 3 Felder voraus und wartet, bis die Figur höchstens 2 Felder entfernt ist', () => {
    const p = onPath(world, 40);
    let s = leading(world, p, downhill(world, p));
    s = run(s, world, ...ticks(30)).s;
    const g = guideOf(s)!;
    expect(cheb(g, s.player)).toBeGreaterThan(NEAR);
    expect(cheb(g, s.player)).toBeLessThanOrEqual(NEAR + 1);
    expect(dist(world, g)).toBeLessThan(dist(world, s.player)); // vor ihr, Richtung Tor
    const waited = run(s, world, ...ticks(100)).s; // sie bleibt stehen: Er wartet
    expect([guideOf(waited)!.x, guideOf(waited)!.y]).toEqual([g.x, g.y]);
    expect(guideOf(waited)!.dir).toBe(
      Math.abs(s.player.x - g.x) >= Math.abs(s.player.y - g.y)
        ? s.player.x > g.x
          ? 'e'
          : 'w'
        : s.player.y > g.y
          ? 's'
          : 'n',
    ); // schaut sie an
  });

  it('folgt die Figur ihm, führt er sie in die Bucht vor dem Eistor neben die Torplatte; steht sie darauf, geht es auf', () => {
    let s = leading(world, onPath(world, 40), downhill(world, onPath(world, 40)));
    const door = world.gates.get('eis')!;
    const inBay = new Set(bay(door).map(key));
    for (let i = 0; i < 400 && dist(world, s.player) > 1; i++) {
      const here: Point = [s.player.x, s.player.y];
      s = run(s, world, dirTo(here, downhill(world, here)), TICK).s;
      expect(cheb(guideOf(s)!, s.player), `Schritt ${i}`).toBeLessThanOrEqual(FAR + 1);
    }
    s = run(s, world, ...ticks(4)).s;
    let g = guideOf(s)!;
    expect([g.x, g.y]).toEqual([...plateRow(door, BESIDE)]); // sein Platz neben der Platte, in der Bucht
    expect(dist(world, g)).toBe(0);
    expect(inBay.has(key([g.x, g.y]))).toBe(true);
    expect(inBay.has(key([s.player.x, s.player.y]))).toBe(true);
    expect(s.openGates).toEqual([]); // die Bucht allein öffnet nicht
    // auf die Platte und stehen bleiben
    const on = (x: number, y: number) => world.cell(x, y).plate === 'eis';
    s = walk(s, world, on, 0).s;
    const opened = run(s, world, ...ticks(OPEN_TICKS));
    s = opened.s;
    expect(s.openGates).toEqual(['eis']);
    expect(opened.events).toContainEqual(gateEvent(world));
    g = guideOf(s)!;
    expect(inBay.has(key([g.x, g.y]))).toBe(true);
  });

  it('mit gehaltener Taste (ein Schritt alle 260 ms) läuft die Figur ihm nach, ohne je in ihn hineinzulaufen', () => {
    let s = leading(world, onPath(world, 60), downhill(world, onPath(world, 60)));
    const events: GameEvent[] = [];
    for (let t = 0; t < 2000 && dist(world, s.player) > 1; t++) {
      // Taste gehalten: in 26 Takten (2,6 s) zehn Schritte, jeweils zwischen zwei Takten
      if (Math.floor(((t + 1) * 10) / 26) > Math.floor((t * 10) / 26)) {
        const here: Point = [s.player.x, s.player.y];
        const r = run(s, world, dirTo(here, downhill(world, here)));
        s = r.s;
        events.push(...r.events);
      }
      const r = run(s, world, TICK);
      s = r.s;
      events.push(...r.events);
    }
    expect(dist(world, s.player)).toBeLessThanOrEqual(1); // angekommen
    expect(events.map((e) => e.type)).not.toContain('sing');
    expect(events.map((e) => e.type)).not.toContain('swap');
  });

  it('piept beim Warten höchstens alle 4 s (40 Takte)', () => {
    const p = onPath(world, 40);
    const s = leading(world, p, downhill(world, downhill(world, downhill(world, p))));
    const peeps = run(s, world, ...ticks(400)).events.filter((e) => e.type === 'peep');
    expect(peeps.length).toBeGreaterThanOrEqual(3);
    expect(peeps.length).toBeLessThanOrEqual(400 / PEEP_EVERY + 1);
    // Abstand zwischen zwei Pieps: Takte zählen
    let last = -Infinity;
    let state = s;
    for (let i = 0; i < 400; i++) {
      const next = run(state, world, TICK);
      state = next.s;
      if (next.events.some((e) => e.type === 'peep')) {
        expect(state.tick - last).toBeGreaterThanOrEqual(PEEP_EVERY);
        last = state.tick;
      }
    }
  });

  it('läuft die Figur weg, holt er sie ein, überholt sie und stellt sich wieder vor sie', () => {
    const p = onPath(world, 30);
    let s = leading(world, p, downhill(world, downhill(world, p)));
    // Die Figur läuft zehn Schritte vom Tor weg (bergauf auf dem Weg)
    const field = toGate(world);
    for (let i = 0; i < 10; i++) {
      const here: Point = [s.player.x, s.player.y];
      const away = Object.entries(DIRS).find(([, [dx, dy]]) => {
        const n: Point = [here[0] + dx, here[1] + dy];
        return field.get(key(n)) === field.get(key(here))! + 1 && !s.animals.some((a) => a.x === n[0] && a.y === n[1]);
      });
      if (!away) break;
      s = run(s, world, away[0] as Dir, TICK, TICK, TICK).s;
    }
    expect(dist(world, s.player)).toBeGreaterThan(35);
    let facing = false; // steht er einmal vor ihr und schaut zum Tor?
    for (let t = 0; t < 60; t++) {
      s = run(s, world, TICK).s;
      const g = guideOf(s)!;
      const next = downhill(world, [g.x, g.y]);
      if (dist(world, g) < dist(world, s.player) && next && g.dir === dirTo([g.x, g.y], next)) facing = true;
    }
    expect(facing).toBe(true);
    const g = guideOf(s)!;
    expect(dist(world, g)).toBeLessThan(dist(world, s.player)); // wieder vor ihr
    expect(cheb(g, s.player)).toBeLessThanOrEqual(FAR);
  });

  it('blockiert nie: Läuft die Figur in ihn hinein, singt er und hüpft ein Feld voraus', () => {
    const p = onPath(world, 30);
    const ahead = downhill(world, p);
    const s = leading(world, p, ahead);
    const r = run(s, world, dirTo(p, ahead));
    const g = guideOf(r.s)!;
    expect(r.events).toContainEqual({ type: 'sing', id: GUIDE, species: 'pinguin', first: true });
    expect(dist(world, g)).toBe(dist(world, { x: ahead[0], y: ahead[1] }) - 1); // ein Feld weiter Richtung Tor
    expect([r.s.player.x, r.s.player.y]).toEqual([...p]);
    expect(run(r.s, world, dirTo(p, ahead)).s.player).toMatchObject({ x: ahead[0], y: ahead[1] }); // der Weg ist frei
  });

  it('blockiert nie: Ist voraus nichts frei, tauscht er mit der Figur den Platz', () => {
    const p = onPath(world, 30);
    const ahead = downhill(world, p);
    const field = toGate(world);
    // Alle Felder, die von ihm aus näher am Tor liegen, sind besetzt
    const blockers = Object.values(DIRS)
      .map(([dx, dy]): Point => [ahead[0] + dx, ahead[1] + dy])
      .filter((q) => (field.get(key(q)) ?? Infinity) < field.get(key(ahead))!)
      .map((q, i): Animal => ({
        id: `lichtung:hase:${9 + i}`,
        species: 'hase',
        x: q[0],
        y: q[1],
        dir: 's',
        mode: 'wander',
        home: { kind: 'region', region: 'lichtung' },
        realm: 'lichtung',
        spawn: q,
        rest: 999,
      }));
    const s = leading(world, p, ahead, blockers);
    const r = run(s, world, dirTo(p, ahead));
    expect(r.events.map((e) => e.type)).toEqual(['sing', 'swap']);
    expect([r.s.player.x, r.s.player.y]).toEqual([...ahead]);
    expect([guideOf(r.s)!.x, guideOf(r.s)!.y]).toEqual([...p]);
  });

  it('nachts setzt er sich neben das Bett und schläft mit; morgens piept er zur Begrüßung und führt weiter', () => {
    const { bed, wake } = world.homes.lichtung;
    // Die Figur steht neben dem Bett, der Pinguin ein Stück weiter
    const at = wake[0]!;
    let s = leading(world, at, [at[0] + 3, at[1] + 3]);
    s = { ...s, player: { ...s.player, dir: dirTo(at, bed) } };
    const slept = run(s, world, dirTo(at, bed));
    expect(slept.s.sleeping).toBe(true);
    const g = guideOf(slept.s)!;
    expect(cheb(g, { x: bed[0], y: bed[1] })).toBeLessThanOrEqual(2);
    expect(wake.some(([x, y]) => x === g.x && y === g.y)).toBe(false); // nicht auf einem Platz zum Aufwachen
    const night = run(slept.s, world, ...ticks(80)).s;
    expect([guideOf(night)!.x, guideOf(night)!.y]).toEqual([g.x, g.y]); // nachts führt er nicht
    const morning = run(night, world, 'n');
    expect(morning.s.sleeping).toBe(false);
    expect(morning.events).toContainEqual({ type: 'peep', id: GUIDE, species: 'pinguin' });
    expect(guideOf(morning.s)!.mode).toBe('lead');
    const later = run(morning.s, world, ...ticks(60)).s;
    expect(dist(world, guideOf(later)!)).toBeLessThan(dist(world, g)); // er führt weiter Richtung Tor
  });
});

describe('Invarianten bei wildem Drücken mit führendem Pinguin', () => {
  for (const seed of WILD) {
    it(`Seed ${seed}: höchstens ein Pinguin, immer führend, nie zwei auf einem Feld, Figur begehbar, wiederholbar`, () => {
      const world = worldOf(seed);
      const dirs: Dir[] = ['n', 'e', 's', 'w'];
      const play = () => {
        let s = initialState(world, { garden: everyone() }, seed);
        let r = seed * 7919;
        let seen = false;
        for (let i = 0; i < 3000; i++) {
          r = (Math.imul(r, 1103515245) + 12345) >>> 0;
          const cmd: Cmd = r % 10 < 5 ? { type: 'move', dir: dirs[(r >>> 8) % 4]! } : TICK;
          s = step(s, world, cmd, undefined, rules).state;
          const guides = s.animals.filter((a) => a.id === GUIDE);
          expect(guides.length).toBeLessThanOrEqual(1);
          const g = guides[0];
          if (g) {
            seen = true;
            expect(g.mode).toBe('lead');
            expect(leader(s)).toBe(g);
            expect(standHeight(world, s.openGates, g.x, g.y)).not.toBeNull();
            expect(s.followers).not.toContain(GUIDE);
          }
          if (!s.sleeping) expect(standHeight(world, s.openGates, s.player.x, s.player.y)).not.toBeNull();
          const spots = s.animals.map((a) => `${a.x},${a.y}`);
          if (!s.sleeping) spots.push(`${s.player.x},${s.player.y}`);
          expect(new Set(spots).size).toBe(spots.length);
          expect(s.garden.some((p) => p.id === GUIDE)).toBe(false); // zieht auf der Lichtung nie ein
          expect(s.openGates).toEqual([]);
        }
        expect(seen).toBe(true);
        return s;
      };
      expect(play()).toEqual(play());
    });
  }
});

/** Kürzester Weg der Figur (Felder samt Start) zu einem Feld, das `goal` erfüllt (Tiere zählen dabei nicht) */
function route(world: World, s: State, goal: (x: number, y: number) => boolean): Point[] | null {
  const from = new Map<string, Point | null>([[key([s.player.x, s.player.y]), null]]);
  const queue: Point[] = [[s.player.x, s.player.y]];
  for (let i = 0; i < queue.length && i < 60_000; i++) {
    const here = queue[i]!;
    const [x, y] = here;
    if (goal(x, y)) {
      const path: Point[] = [];
      for (let p: Point | null = here; p; p = from.get(key(p)) ?? null) path.unshift(p);
      return path;
    }
    for (const [dx, dy] of Object.values(DIRS)) {
      const k = key([x + dx, y + dy]);
      if (from.has(k) || !canStep(world, s.openGates, x, y, x + dx, y + dy)) continue;
      from.set(k, here);
      queue.push([x + dx, y + dy]);
    }
  }
  return null;
}
/** Erster Schritt der Figur auf dem kürzesten Weg zu einem Feld, das `goal` erfüllt (Tiere zählen dabei nicht) */
function toward(world: World, s: State, goal: (x: number, y: number) => boolean): Dir | null {
  const path = route(world, s, goal);
  const [a, b] = path ?? [];
  return a && b ? dirTo(a, b) : null;
}
/** Die Figur läuft zu einem Feld, das `goal` erfüllt; nach jedem Schritt `pause` Takte. Liefert Zustand und Ereignisse */
function walk(s: State, world: World, goal: (x: number, y: number) => boolean, pause = 1, max = 300) {
  const events: GameEvent[] = [];
  for (let i = 0; i < max && !goal(s.player.x, s.player.y); i++) {
    const d = toward(world, s, goal);
    if (!d) break;
    const r = run(s, world, d, ...ticks(pause));
    s = r.s;
    events.push(...r.events);
  }
  return { s, events };
}
const types = (events: GameEvent[]) => events.map((e) => e.type);

describe('Das Eistor geht mit dem Pinguin auf', () => {
  const world = worldOf(1);
  const door = world.gates.get('eis')!;
  const front: Point = [door.mid[0] - door.out[0], door.mid[1] - door.out[1]]; // direkt vor der Mitte der Tür
  const row2: Point = [door.mid[0] - 2 * door.out[0], door.mid[1] - 2 * door.out[1]];
  const [bx, by] = plateRow(door, BESIDE);
  const along = (u: number, t: number): Point => [
    door.mid[0] - door.out[0] * t - door.out[1] * u,
    door.mid[1] - door.out[1] * t + door.out[0] * u,
  ];
  const toDoor = dirTo([0, 0], door.out); // Pfeil Richtung Tür
  const onPlate = (x: number, y: number) => world.cell(x, y).plate === 'eis';
  /** Figur mitten auf der Torplatte (seit 0,3 s), Pinguin vor der Tür in der Bucht: Der nächste Takt öffnet das Tor */
  const atDoor = (extra: Animal[] = []) => ({ ...leading(world, row2, front, extra), still: OPEN_TICKS - 1 });
  const opened = () => run(atDoor(), world, TICK);
  /** Das Vorspiel ist um, das Ritual beginnt genau jetzt */
  const begun = () => run(opened().s, world, ...ticks(leadOf(world)));
  const ice = (x: number, y: number) => world.realm(x, y) === 'eis';

  it('Pinguin öffnet das Eistor: Steht die Figur auf der Platte, er in der Bucht, geht es für immer auf; andere Tiere nicht', () => {
    expect(plateMid(door)).toEqual(row2);
    expect(onPlate(...row2)).toBe(true);
    const r = opened();
    expect(r.s.openGates).toEqual(['eis']);
    expect(r.s.ritual).toBe(r.s.tick + leadOf(world)); // erst das Vorspiel
    expect(r.events).toContainEqual(gateEvent(world));
    expect(r.events).toContainEqual({ type: 'peep', id: GUIDE, species: 'pinguin' }); // er hüpft mit seinem Ton
    expect([guideOf(r.s)!.x, guideOf(r.s)!.y]).toEqual([...front]); // vor der Tür
    for (const [x, y] of door.cells) expect(standHeight(world, r.s.openGates, x, y)).not.toBeNull();
    expect(progressOf(r.s).openGates).toEqual(['eis']); // so wird es gespeichert (die Ansicht speichert sofort)
    // Ein anderes Eis-Tier und ein Tier der Lichtung in der Bucht öffnen nichts, auch nicht als folgende Tiere
    const others: Animal[] = [
      { ...guideOf(atDoor())!, id: animalId('eis', 'pinguin', 2), mode: 'follow' },
      { ...guideOf(atDoor())!, id: animalId('lichtung', 'hase'), species: 'hase', realm: 'lichtung', mode: 'follow' },
    ];
    for (const a of others) {
      const s = { ...atDoor(), animals: [a], followers: [a.id], garden: [] }; // ohne den verlaufenen Pinguin
      const r = run(s, world, ...ticks(40));
      expect(r.s.openGates, a.id).toEqual([]);
      expect(types(r.events), a.id).not.toContain('gate');
    }
    // erst, wenn er bei der Figur angekommen ist (Herz), nicht schon beim Auftauchen
    expect(run({ ...atDoor(), guideDue: 0 }, world, 'n').s.openGates).toEqual([]);
  });

  it('die Bucht allein öffnet nicht: Er stellt sich neben die Platte, schaut sie an und hüpft still alle 2 s', () => {
    expect(plateRow(door, BESIDE)).toEqual(along(2, 2));
    expect([1, 0, -1].map((u) => plateRow(door, u))).toEqual([along(1, 2), along(0, 2), along(-1, 2)]);
    expect([-1, 0, 1].every((u) => onPlate(...plateRow(door, u)))).toBe(true);
    expect(onPlate(...plateRow(door, -2))).toBe(false);
    expect(inBay(door, bx, by) && inBay(door, ...along(-2, 3)) && !inBay(door, ...along(0, 4))).toBe(true);
    expect(onPlate(bx, by)).toBe(false);
    expect(toGate(world).size).toBeGreaterThan(1); // sein Weg beginnt dort und reicht weit
    // Figur in der Bucht, aber nicht auf der Platte (vorn links an der Tür), der Pinguin vor der Tür
    const r = run(leading(world, along(-2, 1), front), world, ...ticks(NET - 1));
    expect(r.s.openGates).toEqual([]);
    const g = guideOf(r.s)!;
    expect([g.x, g.y]).toEqual([bx, by]); // neben die Platte gegangen
    expect(g.dir).toBe(dirTo([bx, by], along(1, 2))); // schaut die Platte an
    const bobs = r.events.filter((e) => e.type === 'bob');
    expect(bobs.length).toBeGreaterThanOrEqual(Math.floor((NET - 1) / BOB_EVERY) - 1);
    expect(bobs.length).toBeLessThanOrEqual(Math.ceil(NET / BOB_EVERY));
    expect(bobs[0]).toEqual({ type: 'bob', id: GUIDE });
    expect(types(r.events)).not.toContain('peep'); // still, ohne zu piepen
    expect(types(r.events)).not.toContain('hop'); // keine Sperre: das Ritual hat nicht begonnen
    expect(r.s.ritual).toBe(-1);
  });

  it('auf der Platte nach 4 Takten Stehen (0,4 s) geht es auf; vorher sperrt nichts, jeder Schritt zählt neu', () => {
    let s = leading(world, along(0, 3), [bx, by]); // vor der Platte, er an seinem Platz
    s = run(s, world, toDoor).s; // drauf
    expect(onPlate(s.player.x, s.player.y)).toBe(true);
    expect(s.still).toBe(0);
    let r = run(s, world, ...ticks(OPEN_TICKS - 1));
    expect(r.s.openGates).toEqual([]);
    expect(r.s.ritual).toBe(-1);
    expect(r.s.still).toBe(OPEN_TICKS - 1);
    // ein Schritt auf das Nachbarfeld der Platte: keine Sperre, der Zähler beginnt neu
    r = run(r.s, world, dirTo(along(0, 2), along(-1, 2)));
    expect(types(r.events)).toEqual(['step']);
    expect(r.s.still).toBe(0);
    r = run(r.s, world, ...ticks(OPEN_TICKS - 1));
    expect(r.s.openGates).toEqual([]);
    r = run(r.s, world, TICK);
    expect(r.s.openGates).toEqual(['eis']);
    expect(r.s.ritual).toBe(r.s.tick + leadOf(world)); // nach dem Vorspiel sperrt das Ritual
    expect(r.events).toContainEqual(gateEvent(world));
    expect(run(run(r.s, world, ...ticks(leadOf(world))).s, world, toDoor).events).toEqual([{ type: 'hop' }]);
  });

  it('Drüberlaufen öffnet nie: mit gehaltener Taste (ein Schritt alle 260 ms) längs und quer über die Platte', () => {
    /**
     * Taste neu gedrückt und gehalten (input-pace.ts): erster Schritt sofort, der zweite erst nach HOLD_MS (5 Takte),
     * dann abwechselnd 3 und 2 Takte je Schritt (im Schnitt 260 ms); in jedem Takt ist der Pfeil gedrückt
     */
    expect(Math.ceil(HOLD_MS / TICK_MS)).toBeGreaterThanOrEqual(OPEN_TICKS); // ohne `held` öffnete schon die Wartezeit
    const held = (s: State, path: Point[]) => {
      const all: GameEvent[] = [];
      path.forEach((to, i) => {
        const wait = i === 0 ? Math.ceil(HOLD_MS / TICK_MS) : i % 2 ? 2 : 3;
        const r = run(s, world, dirTo([s.player.x, s.player.y], to), ...Array<Cmd>(wait).fill(HELD));
        s = r.s;
        all.push(...r.events);
        expect([s.player.x, s.player.y]).toEqual([...to]);
      });
      return { s, all };
    };
    // längs: von links neben der Platte über alle drei Felder und hinaus nach vorn (der Pinguin steht rechts daneben)
    const lengthwise = held(leading(world, along(-2, 2), [bx, by]), [
      along(-1, 2),
      along(0, 2),
      along(1, 2),
      along(1, 3),
      along(0, 3),
    ]);
    expect(lengthwise.s.openGates).toEqual([]);
    expect(types(lengthwise.all)).not.toContain('gate');
    expect(types(lengthwise.all)).not.toContain('hop');
    // quer: von vorn über die Platte bis an die Tür und zurück
    const across = held(leading(world, along(0, 3), [bx, by]), [
      along(0, 2),
      along(0, 1),
      along(-1, 1),
      along(-1, 2),
      along(-1, 3),
    ]);
    expect(across.s.openGates).toEqual([]);
    expect(types(across.all)).not.toContain('gate');
  });

  it('einzelner Druck, gehalten: Solange ein Pfeil gedrückt ist, steht die Figur nicht; erst nach dem Loslassen zählt es', () => {
    let s = leading(world, along(0, 3), [bx, by]);
    s = run(s, world, toDoor).s; // auf die Platte, der Pfeil bleibt gedrückt (z. B. gegen den Pinguin daneben)
    let r = run(s, world, ...Array<Cmd>(3 * OPEN_TICKS).fill(HELD));
    expect(r.s.still).toBe(0);
    expect(r.s.openGates).toEqual([]);
    expect(types(r.events)).not.toContain('gate');
    r = run(r.s, world, ...ticks(OPEN_TICKS)); // losgelassen: 0,4 s Stehen
    expect(r.s.openGates).toEqual(['eis']);
  });

  it('Steht die Figur schon auf der Platte, wenn der Pinguin in die Bucht kommt, geht es gleich auf', () => {
    // er ist noch vor der Bucht, sie wartet schon lange auf der Platte
    let s: State = { ...leading(world, row2, along(2, 5)), still: 50 };
    let arrived = -1;
    for (let t = 0; t < 40 && !s.openGates.length; t++) {
      const g = guideOf(s)!;
      const inBay = bay(door).some(([x, y]) => x === g.x && y === g.y);
      s = run(s, world, TICK).s;
      // im ersten Takt, in dem er in der Bucht ist, geht es auf
      expect(s.openGates, `Takt ${t}`).toEqual(inBay ? ['eis'] : []);
      if (inBay) arrived = t;
    }
    expect(s.openGates).toEqual(['eis']);
    expect(arrived).toBeGreaterThan(0);
    expect(arrived).toBeLessThan(20);
  });

  it('Anstoßen an der Tür zählt wie die Platte; ohne Pinguin in der Bucht nur ein Anstoßen', () => {
    const s = leading(world, along(-1, 1), [bx, by]); // vorn an der Tür, nicht auf der Platte
    const r = run(s, world, toDoor);
    expect(types(r.events)).toContain('bump');
    expect(r.s.openGates).toEqual(['eis']);
    expect(r.events).toContainEqual(gateEvent(world));
    // der Pinguin noch weit weg: Die Tür bleibt zu
    const far = run(leading(world, along(-1, 1), onPath(world, 12)), world, toDoor);
    expect(types(far.events)).toEqual(['bump']);
    expect(far.s.openGates).toEqual([]);
  });

  it('Sicherheitsnetz: Nach 8 s in der Bucht neben der Platte hüpft er darauf, schaut zur Figur und winkt; kein Kind bleibt hängen', () => {
    let s = leading(world, along(-2, 1), [bx, by]); // in der Bucht, nicht auf der Platte
    let r = run(s, world, ...ticks(NET - 1));
    expect([guideOf(r.s)!.x, guideOf(r.s)!.y]).toEqual([bx, by]);
    expect(types(r.events)).not.toContain('arrive');
    r = run(r.s, world, TICK);
    const g = guideOf(r.s)!;
    expect([g.x, g.y]).toEqual(along(1, 2)); // auf die Platte, gleich neben seinem Platz
    expect(onPlate(g.x, g.y)).toBe(true);
    const [px, py] = along(-2, 1);
    expect(g.dir).toBe(faceTo(px - g.x, py - g.y)); // schaut zur Figur
    expect(r.events).toContainEqual({ type: 'arrive', id: GUIDE, species: 'pinguin' }); // Hüpfer und Herz: er winkt
    expect(r.s.openGates).toEqual([]);
    // Er bleibt dort und hüpft weiter still, solange sie in der Bucht ist
    r = run(r.s, world, ...ticks(2 * BOB_EVERY));
    expect([guideOf(r.s)!.x, guideOf(r.s)!.y]).toEqual(along(1, 2));
    expect(types(r.events)).toContain('bob');
    expect(types(r.events)).not.toContain('arrive');
    // die Figur tritt auf ein freies Feld der Platte und bleibt stehen: Das Tor geht auf
    s = walk(r.s, world, (x, y) => onPlate(x, y), 0).s;
    expect(s.openGates).toEqual([]);
    s = run(s, world, ...ticks(OPEN_TICKS)).s;
    expect(s.openGates).toEqual(['eis']);
    // läuft sie stattdessen gegen die Tür, geht es auch auf
    expect(run(leading(world, along(-2, 1), [bx, by]), world, toDoor).s.openGates).toEqual(['eis']);
  });

  it('Ritual: 3 s lang lassen Pfeile die Figur nur hüpfen, danach gibt der nächste Pfeil sie frei', () => {
    let { s } = begun();
    expect(s.tick).toBe(s.ritual);
    const at = [s.player.x, s.player.y];
    const all: GameEvent[] = [];
    for (let t = 1; t < RITUAL; t++) {
      const r = run(s, world, door.out[0] ? 'n' : 'e', TICK);
      s = r.s;
      all.push(...r.events);
      expect([s.player.x, s.player.y], `Takt ${t}`).toEqual(at);
      expect(r.events[0]).toEqual({ type: 'hop' });
    }
    expect(types(all)).not.toContain('step');
    expect(all.filter((e) => e.type === 'peep')).toHaveLength(1); // der zweite Hüpfer vor der Tür
    expect(all).toContainEqual({ type: 'breath', x: door.mid[0], y: door.mid[1] }); // kalter Atemzug
    expect(all).toContainEqual({ type: 'slide', id: GUIDE, species: 'pinguin' }); // rutscht durch den Gang
    expect(HOP_AGAIN).toBeLessThan(BREATH);
    expect(BREATH).toBeLessThan(SLIDE);
    expect(SLIDE).toBeLessThan(RITUAL);
    s = run(s, world, TICK).s; // 3 s sind um
    const away = dirTo([s.player.x, s.player.y], [row2[0] - door.out[0], row2[1] - door.out[1]]); // zurück auf die Lichtung
    const free = run(s, world, away);
    expect(types(free.events)).toEqual(['step']);
  });

  it('Vorspiel je Torlage (6/12/35 Takte), ohne Sperre; Sperre genau RITUAL Takte; Wegglaufen im Vorspiel öffnet trotzdem', () => {
    const LAGEN: Lage[] = ['N', 'O', 'S', 'W'];
    expect(LAGEN.map(leadTicks)).toEqual([6, 12, 35, 12]);
    const OUTS: Point[] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    expect(OUTS.map(lageOf)).toEqual(LAGEN);
    expect(OUTS.map(preTicks)).toEqual(LAGEN.map(leadTicks)); // doppelt im Paket, gleich wie die Drehung
    const at = opened().s;
    for (const l of LAGEN) {
      // dasselbe Öffnen, nur mit dem Vorspiel dieser Lage: gesperrt sind genau die Takte des Rituals danach
      const lead = leadTicks(l);
      const locked: number[] = [];
      for (let k = 0; k < lead + RITUAL + 10; k++) {
        const s = { ...at, ritual: at.tick + lead, tick: at.tick + k };
        if (rules.hold(s, [])) locked.push(k);
        if (k < lead + SLIDE) expect(guideGate(s), `${l} Takt ${k}`).toBe('eis'); // Umriss, solange er vor der Tür ist
      }
      expect(locked, l).toEqual(Array.from({ length: RITUAL }, (_, i) => lead + i));
      expect(locked.length * TICK_MS, l).toBe(3000); // Gesamtsperre 3 s in jeder Lage
    }
    // in dieser Welt: Im Vorspiel läuft die Figur weg (ein Schritt, kein Hüpfen), das Tor geht trotzdem auf
    const r = opened();
    expect(r.s.ritual - r.s.tick).toBe(leadOf(world));
    const away = dirTo([0, 0], [-door.out[0], -door.out[1]]);
    let s = run(r.s, world, away).s;
    expect([s.player.x, s.player.y]).toEqual([row2[0] - door.out[0], row2[1] - door.out[1]]);
    const rest = run(s, world, ...ticks(leadOf(world) + SLIDE));
    s = rest.s;
    expect(s.openGates).toEqual(['eis']);
    expect(types(rest.events)).toContain('bob'); // er hüpft im Vorspiel vor der Tür
    expect(rest.events).toContainEqual({ type: 'slide', id: GUIDE, species: 'pinguin' }); // und rutscht hinein
    expect([guideOf(s)!.x, guideOf(s)!.y]).toEqual([...mouth(world)!]);
  });

  it('im Vorspiel zur Tür: hüpft, betritt die Tür nicht; Pinguin bleibt vor der Tür', () => {
    // wie im Spiel mit den Regeln der Eis-Welt (`rules.bump` aus dem Paket, darin `shut`)
    const go = (s: State, ...cmds: (Cmd | Dir)[]) => {
      const events: GameEvent[] = [];
      for (const c of cmds) {
        const r = step(s, world, typeof c === 'string' ? { type: 'move', dir: c } : c, undefined, rules, PACKS);
        s = r.state;
        events.push(...r.events);
      }
      return { s, events };
    };
    const where = (s: State) => [s.player.x, s.player.y];
    // mitten auf der Platte, er direkt vor der Tür: in ihn hinein (er singt), er rutscht nicht durch die Tür
    let r = go(opened().s, toDoor, toDoor);
    expect(where(r.s)).toEqual([...row2]);
    expect([guideOf(r.s)!.x, guideOf(r.s)!.y]).toEqual([...front]);
    expect(types(r.events)).not.toContain('slide');
    // vom Seitenfeld der Platte: ein Schritt vor die Tür, dann hüpft sie nur, die Flügel sind noch zu
    const side = opened().s;
    r = go({ ...side, player: { ...side.player, x: along(1, 2)[0], y: along(1, 2)[1] } }, toDoor);
    expect(where(r.s)).toEqual([...along(1, 1)]);
    r = go(r.s, toDoor, toDoor);
    expect(where(r.s)).toEqual([...along(1, 1)]);
    expect(r.events).toEqual([{ type: 'hop' }, { type: 'hop' }]);
    expect(world.cell(...along(1, 0)).gate).toBe('eis');
    // nach Vorspiel und Ritual sind die Flügel offen: Jetzt geht es hinein
    r = go(r.s, ...ticks(leadOf(world) + RITUAL), toDoor);
    expect(where(r.s)).toEqual([...along(1, 0)]);
    // je Torlage: nur im Vorspiel, nur an der Tür des Eistors, sonst nichts
    const gateCell = world.cell(...along(1, 0));
    const ground = world.cell(...along(1, 1));
    for (const pre of [6, 12, 35]) {
      for (let k = -pre; k < RITUAL; k++) {
        const s = { ...opened().s, ritual: 100, tick: 100 + k };
        const ev: GameEvent[] = [];
        expect(shut(s, gateCell, 0, 0, ev, { here: ground, walks: true, cell: () => ground }), `${pre} ${k}`).toBe(
          k < 0,
        );
        expect(shut(s, ground, 0, 0, ev, { here: ground, walks: true, cell: () => ground })).toBe(false);
      }
    }
    const later = { ...opened().s, ritual: -1 }; // nach dem Laden: frei
    expect(shut(later, gateCell, 0, 0, [], { here: ground, walks: true, cell: () => ground })).toBe(false);
  });

  it('nach dem Laden im Vorspiel ist das Tor offen, ohne Sperre, und der Pinguin wartet hinter der Gangmündung', () => {
    const r = opened();
    expect(r.s.tick).toBeLessThan(r.s.ritual); // mitten im Vorspiel gespeichert
    let s = initialState(world, { ...progressOf(r.s), garden: everyone() });
    expect(s.openGates).toEqual(['eis']);
    expect(s.ritual).toBe(-1); // nicht gespeichert
    s = { ...s, sleeping: false, wokeAt: -100 };
    const t = run(s, world, TICK);
    expect([guideOf(t.s)!.x, guideOf(t.s)!.y]).toEqual([...mouth(world)!]);
    expect(rules.hold(t.s, [])).toBe(false);
  });

  it('nach 2,4 s rutscht der Pinguin durch den Gang hinter die Mündung und wartet dort; Umriss und Bucht verschwinden', () => {
    let { s } = opened();
    expect(guideGate(s)).toBe('eis'); // im Vorspiel und während das Tor aufgeht, noch Umriss und Bucht
    s = run(s, world, ...ticks(leadOf(world) + SLIDE - 1)).s;
    expect(guideGate(s)).toBe('eis');
    s = run(s, world, TICK).s;
    const g = guideOf(s)!;
    expect([g.x, g.y]).toEqual([...mouth(world)!]);
    expect(ice(g.x, g.y)).toBe(true);
    expect(world.cell(g.x, g.y).slide).toBe(true); // am Anfang der Rutschspur im Kessel
    expect(g.dir).toBe(door.out[0] > 0 ? 'w' : door.out[0] < 0 ? 'e' : door.out[1] > 0 ? 'n' : 's'); // dreht sich um
    expect(guideGate(s)).toBeNull();
    expect(pending(s)).toBe(true); // die Regeln bleiben, bis er zu Hause ist
    // Solange die Figur nicht in der Eis-Welt ist, wartet er dort, auch über Nacht
    const later = run(s, world, ...ticks(200)).s;
    expect([guideOf(later)!.x, guideOf(later)!.y]).toEqual([g.x, g.y]);
  });

  it('Pinguin zieht beim Betreten der Eis-Welt als erstes Tier ein (auf der Schneewiese, nicht auf der Lichtungs-Wiese)', () => {
    let { s } = opened();
    s = run(s, world, ...ticks(RITUAL)).s;
    // Die Figur geht durch den Gang bis zur Mitte: Dort beginnt die Eis-Welt
    const inside = walk(s, world, ice);
    s = inside.s;
    expect(types(inside.events)).toContain('realm');
    let home: GameEvent[] = [];
    const field = toMeadow(world);
    let before = field.get(key([guideOf(s)!.x, guideOf(s)!.y]))!;
    for (let t = 0; t < 400 && !home.length; t++) {
      const r = run(s, world, TICK);
      s = r.s;
      home = r.events.filter((e) => e.type === 'home');
      const g = guideOf(s)!;
      const d = field.get(key([g.x, g.y]))!;
      expect(d, `Takt ${t}`).toBeLessThanOrEqual(before); // rutscht nur voraus, nie zurück
      before = d;
    }
    expect(home).toEqual([{ type: 'home', id: GUIDE, species: 'pinguin' }]);
    const g = guideOf(s)!;
    expect(g.mode).toBe('home');
    expect(world.cell(g.x, g.y).garden).toBe(true);
    expect(ice(g.x, g.y)).toBe(true);
    expect(s.garden.filter((p) => p.id.startsWith('eis:'))).toEqual([{ id: GUIDE, species: 'pinguin' }]); // als erstes
    expect(s.calm).toBe(s.day); // heute kein Pustewind
    expect(pending(s)).toBe(false);
    expect(ice(...g.spawn) && world.cell(...g.spawn).garden).toBe(true); // sein Platz auf der Schneewiese
  });

  it('rutscht schneller als die Figur und blockiert nie: Ist voraus nichts frei, tauscht er mit ihr den Platz', () => {
    expect(SLIDE_PACE * 100).toBeLessThan(260); // ein Schritt der Figur mit gehaltener Taste dauert 260 ms
    const field = toMeadow(world);
    const near = (q: Point) => field.get(key(q)) ?? Infinity;
    // ein Feld im Kessel, 10 Schritte vor der Schneewiese, und die Figur ein Feld weiter weg dahinter
    const p = [...field]
      .find(([, d]) => d === 10)![0]
      .split(',')
      .map(Number) as unknown as Point;
    const at = Object.values(DIRS)
      .map(([dx, dy]): Point => [p[0] + dx, p[1] + dy])
      .find((q) => near(q) === 11 && canStep(world, ['eis'], ...q, ...p))!;
    // Alle Felder, die von ihm aus näher an der Wiese liegen, sind besetzt
    const blockers = Object.values(DIRS)
      .map(([dx, dy]): Point => [p[0] + dx, p[1] + dy])
      .filter((q) => near(q) < 10)
      .map((q, i): Animal => ({
        ...guideOf(atDoor())!,
        id: animalId('eis', 'robbe', i + 1),
        species: 'robbe',
        x: q[0],
        y: q[1],
        mode: 'wander',
        spawn: q,
        rest: 999,
      }));
    const s = { ...leading(world, at, p, blockers), openGates: ['eis' as const] };
    const r = run(s, world, dirTo(at, p));
    expect(types(r.events)).toContain('swap');
    expect([r.s.player.x, r.s.player.y]).toEqual([...p]);
    expect([guideOf(r.s)!.x, guideOf(r.s)!.y]).toEqual([...at]);
  });

  it('Eis-Portal erwacht erst, wenn der Pinguin eingezogen ist (er zieht zuerst ein)', () => {
    const at = world.homes.eis.wake[0]!; // die Figur ist schon am Schneebett
    let s: State = { ...leading(world, at, mouth(world)!), openGates: ['eis'] };
    let home = -1;
    let portal = -1;
    for (let t = 0; t < 400 && portal < 0; t++) {
      const r = run(s, world, TICK);
      s = r.s;
      if (home < 0 && types(r.events).includes('home')) home = t;
      if (types(r.events).includes('portal')) portal = t;
      if (home < 0) expect(s.portals, `Takt ${t}`).toEqual([]); // solange er unterwegs ist, schläft es
    }
    expect(home).toBeGreaterThan(0);
    expect(portal).toBeGreaterThan(home);
    expect(s.portals).toEqual(['eiskessel']);
  });

  it('nach dem Laden ist das Tor offen; der Pinguin wartet hinter der Gangmündung, im Schneebett wacht man dort auf', () => {
    const saved = { ...progressOf(opened().s), garden: everyone() };
    let s = initialState(world, saved);
    expect(s.openGates).toEqual(['eis']);
    expect(pending(s)).toBe(true);
    const r = run(s, world, 'n'); // aufwachen
    s = r.s;
    const g = guideOf(s)!;
    expect([g.x, g.y, g.mode]).toEqual([...mouth(world)!, 'lead']);
    expect(types(r.events)).not.toContain('slide'); // still, ohne Rutschen
    // Gespeichert im Kessel (der Pinguin wohnt schon dort): Die Figur wacht am Schneebett auf
    const bed = world.homes.eis.bed;
    const snowy = initialState(world, {
      ...saved,
      garden: [...everyone(), { id: GUIDE, species: 'pinguin' }],
      position: [bed[0], bed[1] + 2],
    });
    expect([snowy.player.x, snowy.player.y]).toEqual([...bed]);
    expect(guideOf(snowy)!.mode).toBe('home');
    expect(pending(snowy)).toBe(false);
  });
});

describe('„Noch nicht“ am Eistor', () => {
  const world = worldOf(1);
  const door = world.gates.get('eis')!;
  const along = (u: number, t: number): Point => [
    door.mid[0] - door.out[0] * t - door.out[1] * u,
    door.mid[1] - door.out[1] * t + door.out[0] * u,
  ];
  const toDoor = dirTo([0, 0], door.out);
  const away = dirTo([0, 0], [-door.out[0], -door.out[1]]);
  const without = (...species: string[]) => everyone().filter((p) => !species.includes(p.species));
  /** Wache Figur auf `at`, ohne Pinguin und ohne andere Tiere; auf der Wiese wohnen `garden` */
  const alone = (at: Point, garden = without('igel')): State => ({
    ...initialState(world, { garden }),
    sleeping: false,
    wokeAt: -100,
    player: { x: at[0], y: at[1], dir: 'n' },
    animals: [],
  });
  /**
   * Wie die Ansicht: nach jedem Befehl `hint` fragen und sich den Takt merken, an dem das Tor zuletzt zeigte, was fehlt.
   * Liefert die Takte, an denen es das zeigte, und was
   */
  function shown(s: State, cmds: (Cmd | Dir)[], w = world) {
    let last = -Infinity;
    const out: [tick: number, species: string][] = [];
    const events: GameEvent[] = [];
    for (const c of cmds) {
      const r = run(s, w, c);
      s = r.s;
      events.push(...r.events);
      const sp = hint(s, w, last);
      if (sp) {
        last = s.tick;
        out.push([s.tick, sp]);
      }
    }
    return { s, out, events };
  }

  it('was fehlt: zuerst die Art der Lichtung, dann der Pinguin', () => {
    const lichtung = REGIONS[0].animals.map((a) => a.species);
    expect(missing({ garden: [] })).toBe(lichtung[0]); // in der Reihe der Leiste
    expect(missing({ garden: without('igel') })).toBe('igel');
    expect(missing({ garden: without('ziege', 'schaf') })).toBe('schaf'); // die erste fehlende, nicht die letzte
    expect(missing({ garden: without('baer') })).toBe('baer');
    expect(missing({ garden: everyone() })).toBe('pinguin'); // die Leiste ist voll: Er fehlt noch
    // ein Hase der Landschaft auf der Wiese zählt nicht für die Lichtung
    expect(missing({ garden: [{ id: animalId('lichtung', 'hase', 99), species: 'hase' }] })).toBe('hase');
    // auf der Platte nach 1 s Stehen
    const on = alone(along(0, 2));
    expect(world.cell(on.player.x, on.player.y).plate).toBe('eis');
    expect(shown(on, ticks(HINT_AFTER)).out).toEqual([[on.tick + HINT_AFTER, 'igel']]);
    expect(shown(on, ticks(HINT_AFTER - 1)).out).toEqual([]);
    expect(shown(alone(along(1, 2), everyone()), ticks(HINT_AFTER)).out.map(([, sp]) => sp)).toEqual(['pinguin']);
  });

  it('noch nicht höchstens alle 5 s, öffnet nichts', () => {
    // 30 s stehen: einmal, dann schaut die Figur einfach das Tor an
    const stand = shown(alone(along(0, 2)), ticks(300));
    expect(stand.out).toHaveLength(1);
    expect(stand.s.openGates).toEqual([]);
    expect(stand.s.ritual).toBe(-1);
    expect(types(stand.events)).not.toContain('gate');
    expect(types(stand.events)).not.toContain('hop'); // nichts sperrt
    // rauf und runter (je 1,2 s drauf): höchstens alle 5 s, aber immer wieder
    const updown: (Cmd | Dir)[] = [];
    for (let i = 0; i < 20; i++) updown.push(away, ...ticks(3), toDoor, ...ticks(12));
    const r = shown(alone(along(0, 2)), updown);
    expect(r.out.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < r.out.length; i++) expect(r.out[i]![0] - r.out[i - 1]![0]).toBeGreaterThanOrEqual(HINT_EVERY);
    expect(r.s.openGates).toEqual([]);
    expect(types(r.events)).not.toContain('gate');
    // kam es eben erst, holt es das im selben Stehen nach, sobald 5 s um sind
    const again = shown(alone(along(0, 2)), [...ticks(HINT_AFTER), away, TICK, toDoor, ...ticks(HINT_EVERY)]);
    expect(again.out.map(([t]) => t - again.out[0]![0])).toEqual([0, HINT_EVERY]);
  });

  it('nichts, solange der Pinguin führt oder kommt, das Tor offen ist, die Figur schläft, nicht steht oder neben der Platte steht', () => {
    const quiet = (s: State, cmds = ticks(3 * HINT_AFTER)) => expect(shown(s, cmds).out).toEqual([]);
    quiet({ ...leading(world, along(0, 2), along(2, 6)), still: 0 }); // er führt (noch auf dem Weg in die Bucht)
    quiet({ ...alone(along(0, 2)), openGates: ['eis'] });
    // er ist fällig bzw. watschelt schon zur Figur: Er kommt ja gleich
    const due = { ...alone(along(0, 2), everyone()), still: HINT_AFTER, tick: 50 };
    expect([hint(due, world, -Infinity), hint({ ...due, guideDue: 40 }, world, -Infinity)]).toEqual([
      'pinguin',
      undefined,
    ]);
    quiet({ ...initialState(world, { garden: without('igel') }), animals: [] }); // schläft: liegt im Bett
    quiet(alone(along(0, 2)), Array<Cmd>(3 * HINT_AFTER).fill(HELD)); // Pfeil gedrückt: Sie steht nicht
    quiet(alone(along(-2, 2))); // neben der Platte
    quiet(alone(along(0, 1))); // vor der Tür
    const sand = world.gates.get('sand')!; // die Platte eines anderen Tors (ohne Schlüssel)
    quiet(alone(plateMid(sand)));
  });
});

describe('„Noch nicht“ an den Toren, die nie aufgehen', () => {
  const world = worldOf(1);
  const never = GATES.filter((g) => g.opens === 'never');
  /** Wache Figur auf `at`, alle Tiere der Lichtung zu Hause, keine Tiere unterwegs */
  const alone = (at: Point): State => ({
    ...initialState(world, { garden: everyone() }),
    sleeping: false,
    wokeAt: -100,
    player: { x: at[0], y: at[1], dir: 'n' },
    animals: [],
  });
  /** Wie die Ansicht (mitwachsen-hint-look.ts, `never`): nach jedem Befehl `nope` fragen; Takte und Tore, an denen es zeigte */
  function shown(s: State, cmds: (Cmd | Dir)[]) {
    let last = -Infinity;
    const out: [tick: number, id: string][] = [];
    const events: GameEvent[] = [];
    for (const c of cmds) {
      const r = run(s, world, c);
      s = r.s;
      events.push(...r.events);
      const id = nope(s, world, last);
      if (id) {
        last = s.tick;
        out.push([s.tick, id]);
      }
    }
    return { s, out, events };
  }

  it('auf ihrer Platte nach 1 s Stehen das Zeichen, je Stehen einmal; die Platte öffnet nie', () => {
    expect(never.map((g) => g.id)).toEqual(['sand', 'wasser', 'lava', 'hoehle', 'wald', 'wolken', 'pilze']);
    for (const g of never) {
      const at = plateMid(world.gates.get(g.id)!);
      expect(world.cell(...at).plate).toBe(g.id);
      const on = alone(at);
      const stand = shown(on, ticks(300)); // 30 s
      expect(stand.out, g.id).toEqual([[on.tick + HINT_AFTER, g.id]]);
      expect(stand.s.openGates, g.id).toEqual([]);
      expect(types(stand.events), g.id).not.toContain('gate');
      expect(types(stand.events), g.id).not.toContain('hop'); // nichts sperrt
      expect(shown(on, ticks(HINT_AFTER - 1)).out, g.id).toEqual([]);
      expect(shown(on, Array<Cmd>(3 * HINT_AFTER).fill(HELD)).out, g.id).toEqual([]); // Pfeil gedrückt: Sie steht nicht
    }
  });

  it('rauf und runter: höchstens alle 5 s, aber immer wieder; nie ein anderes Tor', () => {
    for (const g of never) {
      const door = world.gates.get(g.id)!;
      const toDoor = dirTo([0, 0], door.out);
      const away = dirTo([0, 0], [-door.out[0], -door.out[1]]);
      const updown: (Cmd | Dir)[] = [];
      for (let i = 0; i < 20; i++) updown.push(away, ...ticks(3), toDoor, ...ticks(12));
      const r = shown(alone(plateMid(door)), updown);
      expect(r.out.length, g.id).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < r.out.length; i++) expect(r.out[i]![0] - r.out[i - 1]![0]).toBeGreaterThanOrEqual(HINT_EVERY);
      expect(new Set(r.out.map(([, id]) => id)), g.id).toEqual(new Set([g.id]));
      expect(r.s.openGates, g.id).toEqual([]);
    }
  });

  it('nie am Eistor, nie neben der Platte; auch mit führendem Pinguin öffnet die Platte eines anderen Tors nichts', () => {
    const eis = world.gates.get('eis')!;
    expect(shown(alone(plateMid(eis)), ticks(300)).out).toEqual([]); // das Eistor zeigt, was fehlt (`hint`)
    const sand = world.gates.get('sand')!;
    expect(shown(alone(sand.mid), ticks(300)).out).toEqual([]); // vor der Tür, nicht auf der Platte
    for (const g of never) {
      const at = plateMid(world.gates.get(g.id)!);
      const r = run({ ...leading(world, at, plateMid(eis)), still: 0 }, world, ...ticks(300));
      expect(
        r.s.openGates.filter((id) => id !== 'eis'),
        g.id,
      ).toEqual([]);
      expect(
        r.events.filter((e) => e.type === 'gate' && e.id !== 'eis'),
        g.id,
      ).toEqual([]);
    }
  });
});

describe('Invarianten bei wildem Drücken bis durchs offene Eistor', () => {
  for (const seed of [1, 2]) {
    it(`Seed ${seed}: führen, Tor öffnen, in den Kessel, einziehen: nie zwei auf einem Feld, Figur begehbar, wiederholbar`, () => {
      const world = worldOf(seed);
      const door = world.gates.get('eis')!;
      const inBay = new Set(bay(door).map(key));
      const dirs: Dir[] = ['n', 'e', 's', 'w'];
      const check = (s: State) => {
        const guides = s.animals.filter((a) => a.id === GUIDE);
        expect(guides.length).toBeLessThanOrEqual(1);
        const g = guides[0];
        if (g) {
          expect(standHeight(world, s.openGates, g.x, g.y)).not.toBeNull();
          expect(s.followers).not.toContain(GUIDE);
          if (g.mode === 'home') expect(world.cell(g.x, g.y).garden && world.realm(g.x, g.y) === 'eis').toBe(true);
          else expect(g.mode).toBe('lead');
        }
        if (s.garden.some((p) => p.id === GUIDE)) expect(g?.mode).toBe('home'); // eingezogen nur auf der Schneewiese
        if (!s.sleeping) expect(standHeight(world, s.openGates, s.player.x, s.player.y)).not.toBeNull();
        const spots = s.animals.map((a) => `${a.x},${a.y}`);
        if (!s.sleeping) spots.push(`${s.player.x},${s.player.y}`);
        expect(new Set(spots).size).toBe(spots.length);
        expect(s.openGates.filter((id) => id !== 'eis')).toEqual([]); // die anderen sieben nie
      };
      const play = () => {
        let s = initialState(world, { garden: everyone() }, seed);
        let r = seed * 7919;
        const wild = (n: number) => {
          for (let i = 0; i < n; i++) {
            r = (Math.imul(r, 1103515245) + 12345) >>> 0;
            const cmd: Cmd = r % 10 < 5 ? { type: 'move', dir: dirs[(r >>> 8) % 4]! } : TICK;
            s = step(s, world, cmd, undefined, rules).state;
            check(s);
          }
        };
        const go = (goal: (x: number, y: number) => boolean, pause: number) => {
          // Die Breitensuche über die ganze Welt ist teuer: Den Weg nur neu suchen, wenn die Figur von ihm abkommt
          // (Plattform, Schlafen), er zu Ende ist oder sich ein Tor öffnet; sonst läuft sie ihn weiter. Steht ein Tier
          // im Weg, bleibt sie auf ihm und versucht denselben Schritt noch einmal, wie bei der Suche je Schritt.
          let path: Point[] = [];
          let gates = '';
          for (let i = 0; i < 400 && !goal(s.player.x, s.player.y); i++) {
            let at = path.findIndex(([x, y]) => x === s.player.x && y === s.player.y);
            if (at < 0 || at === path.length - 1 || gates !== s.openGates.join()) {
              path = route(world, s, goal) ?? [];
              gates = s.openGates.join();
              at = 0;
            }
            const next = path[at + 1];
            const d = next ? dirTo(path[at]!, next) : null;
            for (const cmd of [d ? { type: 'move' as const, dir: d } : TICK, ...ticks(pause)]) {
              s = step(s, world, cmd, undefined, rules).state;
              check(s);
            }
          }
        };
        wild(800);
        // Hat das wilde Drücken sie ins Bett geschickt, weckt sie eine Taste (nach der Sperre beim Einschlafen)
        for (let i = 0; i < 100 && s.sleeping; i++) {
          s = step(s, world, { type: 'move', dir: 'n' }, undefined, rules).state;
          check(s);
        }
        for (let k = 0; k < 6 && !s.openGates.length; k++) {
          go((x, y) => inBay.has(key([x, y])), 2); // zur Bucht, der Pinguin führt
          go((x, y) => world.cell(x, y).plate === 'eis', 2); // auf die Torplatte und stehen bleiben
          for (let t = 0; t < 30 && !s.openGates.length; t++) s = step(s, world, TICK, undefined, rules).state;
        }
        expect(s.openGates).toEqual(['eis']);
        wild(400); // wildes Drücken während und nach dem Ritual
        go((x, y) => world.realm(x, y) === 'eis' && world.cell(x, y).region === 'eis', 2); // in den Kessel
        go((x, y) => Math.max(Math.abs(x - world.homes.eis.bed[0]), Math.abs(y - world.homes.eis.bed[1])) <= 2, 3);
        for (let t = 0; t < 200; t++) {
          s = step(s, world, TICK, undefined, rules).state;
          check(s);
        }
        expect(s.garden.some((p) => p.id === GUIDE)).toBe(true); // zu Hause auf der Schneewiese
        expect(s.portals).toContain('eiskessel'); // am Schneebett erwacht das Eis-Portal
        wild(1500);
        return s;
      };
      expect(play()).toEqual(play());
    });
  }
});

describe('Boten je Tor: Schlüssel, Verlaufen, fällig, was fehlt', () => {
  const lichtung = () => regionAnimalList(REGIONS[0]).map(({ id, species }) => ({ id, species }));

  it('der Schlüssel eines Tors steht in GATES (`opens`): heute nur das Eistor mit dem Pinguin', () => {
    expect(GATES.filter((g) => keyOf(g.id)).map((g) => [g.id, keyOf(g.id)])).toEqual([['eis', 'pinguin']]);
    expect(GUIDE_GATE).toBe(gateOfKey('pinguin'));
    expect(keyAnimal('eis')).toBe(GUIDE); // der Bote als Tier: das erste Tier seiner Art hinter dem Tor
    expect(keyAnimal('hoehle')).toBeUndefined(); // das Höhlentor hat keinen Schlüssel (noch nicht)
    expect(keyAnimal('sand')).toBeUndefined(); // ohne Schlüssel und ohne Gegend dahinter
  });

  it('keyed und lost je Tor: nur ein Tor mit Schlüssel, das zu ist, hat einen verlaufenen Boten', () => {
    expect([keyed([], 'eis'), keyed(['eis'], 'eis'), keyed([], 'hoehle'), keyed(['hoehle'], 'hoehle')]).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(keyed([])).toBe(true); // ohne Angabe das Tor des Pinguins
    expect(lost(GUIDE, ['hoehle'])).toBe(true); // ein anderes offenes Tor ändert nichts
    expect(lost(animalId('hoehle', 'pinguin'), [])).toBe(false);
  });

  it('wanted, pending und missing je Tor: ein Tor ohne Schlüssel ruft keinen Boten und braucht keine Regeln', () => {
    const s = { openGates: [], garden: lichtung() };
    expect([wanted(s), wanted(s, 'eis'), wanted(s, 'eis', REGIONS[0])]).toEqual([true, true, true]);
    expect(wanted(s, 'hoehle')).toBe(false);
    expect(wanted(s, 'eis', REGIONS[1])).toBe(false); // die Leiste der Eis-Welt ist leer
    expect([pending(s, 'hoehle'), pending({ ...s, openGates: ['hoehle'] }, 'hoehle')]).toEqual([false, false]);
    expect(pending(s, 'eis')).toBe(true);
    expect(missing(s, 'eis')).toBe('pinguin');
    expect(missing({ garden: [] }, 'eis')).toBe(REGIONS[0].animals[0]!.species); // vor dem Boten die Leiste seiner Gegend
  });
});
