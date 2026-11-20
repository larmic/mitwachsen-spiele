// Der verlaufene Pinguin holt die Figur ab und öffnet das Eistor (`opens: { key: 'pinguin' }`), gegen die echten Daten.
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../lib/games/front';
import { GATES, animalId, type Point } from '../../data/games/mitwachsen';
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
  LOST,
  NEAR,
  PEEP_EVERY,
  RITUAL,
  SLIDE,
  bay,
  guideGate,
  leader,
  lost,
  pending,
  wanted,
} from './mitwachsen-guide';
import * as rules from './mitwachsen-lead';
import { toGate } from './mitwachsen-lead';
import { BREATH, HOP_AGAIN, SLIDE_PACE, mouth, toMeadow } from './mitwachsen-ritual';
import { canStep, createWorld, standHeight, type World } from './mitwachsen-world';

const TICK: Cmd = { type: 'tick' };
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
/** Schritte bis vor die Tür des Eistors (Weg der Wegfindung) */
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
  const world = createWorld(1);

  it('das Eistor hat seinen Schlüssel; solange es zu ist, wohnt der Pinguin nicht im Kessel', () => {
    expect(GATES.find((g) => g.id === 'eis')!.opens).toEqual({ key: 'pinguin' });
    expect(lost(GUIDE, [])).toBe(true);
    expect(lost(GUIDE, ['eis'])).toBe(false);
    expect(lost(animalId('eis', 'pinguin', 2), [])).toBe(false); // nur der eine verlaufene
    expect(initialState(world).animals.some((a) => a.id === GUIDE)).toBe(false);
    expect(initialState(world).animals.filter((a) => a.realm === 'eis')).toHaveLength(29);
    const open = initialState(world, { openGates: ['eis'] });
    expect(open.animals.find((a) => a.id === GUIDE)!.mode).toBe('wander'); // Tor offen: Er wohnt im Kessel
  });

  it('erscheint nur mit allen Tieren der Lichtung zu Hause; Tiere der Landschaft zählen nicht', () => {
    const wild = { id: 'wild:0:0:0', species: 'fuchs' as const };
    const missing = everyone().slice(1);
    expect(wanted({ openGates: [], garden: everyone() })).toBe(true);
    expect(wanted({ openGates: [], garden: [...missing, wild] })).toBe(false);
    expect(wanted({ openGates: ['eis'], garden: everyone() })).toBe(false); // Tor schon offen
    for (const garden of [missing, [...missing, wild]]) {
      const r = run({ ...initialState(world, { garden }), sleeping: false, wokeAt: -100 }, world, ...ticks(200));
      expect(guideOf(r.s), String(garden.length)).toBeUndefined();
    }
  });

  for (const seed of [1, 2, 3]) {
    it(`Seed ${seed}: alter Stand mit allen Tieren zu Hause: beim nächsten Aufwachen 4 bis 6 Felder neben der Figur, auf freiem Feld`, () => {
      const world = createWorld(seed);
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
      const world = createWorld(seed);
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
      expect(t).toBeLessThan(25); // wenige Sekunden nach dem Auftauchen
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
  const world = createWorld(1);

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

  it('folgt die Figur ihm, führt er sie bis vor die Tür des Eistors (in die golden markierte Bucht); dort geht es auf', () => {
    let s = leading(world, onPath(world, 40), downhill(world, onPath(world, 40)));
    const door = world.gates.get('eis')!;
    const inBay = new Set(bay(door).map(key));
    let opened: GameEvent[] = [];
    for (let i = 0; i < 400 && !s.openGates.length; i++) {
      const here: Point = [s.player.x, s.player.y];
      const r = run(s, world, dirTo(here, downhill(world, here)), TICK);
      s = r.s;
      opened = r.events;
      if (!s.openGates.length) expect(cheb(guideOf(s)!, s.player), `Schritt ${i}`).toBeLessThanOrEqual(FAR + 1);
    }
    expect(s.openGates).toEqual(['eis']);
    expect(opened).toContainEqual({ type: 'gate', id: 'eis' });
    const g = guideOf(s)!;
    expect(dist(world, g)).toBe(0); // direkt vor der Tür
    expect(inBay.has(key([g.x, g.y]))).toBe(true);
    expect(inBay.has(key([s.player.x, s.player.y]))).toBe(true);
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
  for (const seed of [1, 2]) {
    it(`Seed ${seed}: höchstens ein Pinguin, immer führend, nie zwei auf einem Feld, Figur begehbar, wiederholbar`, () => {
      const world = createWorld(seed);
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

/** Erster Schritt der Figur auf dem kürzesten Weg zu einem Feld, das `goal` erfüllt (Tiere zählen dabei nicht) */
function toward(world: World, s: State, goal: (x: number, y: number) => boolean): Dir | null {
  const first = new Map<string, Dir | null>([[key([s.player.x, s.player.y]), null]]);
  const queue: Point[] = [[s.player.x, s.player.y]];
  for (let i = 0; i < queue.length && i < 60_000; i++) {
    const [x, y] = queue[i]!;
    if (goal(x, y)) return first.get(key([x, y])) ?? null;
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const k = key([x + dx, y + dy]);
      if (first.has(k) || !canStep(world, s.openGates, x, y, x + dx, y + dy)) continue;
      first.set(k, first.get(key([x, y])) ?? (d as Dir));
      queue.push([x + dx, y + dy]);
    }
  }
  return null;
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
  const world = createWorld(1);
  const door = world.gates.get('eis')!;
  const front: Point = [door.mid[0] - door.out[0], door.mid[1] - door.out[1]]; // direkt vor der Mitte der Tür
  const row2: Point = [door.mid[0] - 2 * door.out[0], door.mid[1] - 2 * door.out[1]];
  /** Figur und Pinguin in der Bucht: Der nächste Takt öffnet das Tor */
  const atDoor = (extra: Animal[] = []) => leading(world, row2, front, extra);
  const opened = () => run(atDoor(), world, TICK);
  const ice = (x: number, y: number) => world.realm(x, y) === 'eis';

  it('Pinguin öffnet das Eistor: Stehen Figur und Pinguin in der Bucht, geht es für immer auf; andere Tiere nicht', () => {
    const r = opened();
    expect(r.s.openGates).toEqual(['eis']);
    expect(r.s.ritual).toBe(r.s.tick);
    expect(r.events).toContainEqual({ type: 'gate', id: 'eis' });
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

  it('Ritual: 3 s lang lassen Pfeile die Figur nur hüpfen, danach gibt der nächste Pfeil sie frei', () => {
    let { s } = opened();
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

  it('nach 2,4 s rutscht der Pinguin durch den Gang hinter die Mündung und wartet dort; Umriss und Bucht verschwinden', () => {
    let { s } = opened();
    expect(guideGate(s)).toBe('eis'); // während das Tor aufgeht, noch Umriss und Bucht
    s = run(s, world, ...ticks(SLIDE - 1)).s;
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

describe('Invarianten bei wildem Drücken bis durchs offene Eistor', () => {
  for (const seed of [1, 2]) {
    it(`Seed ${seed}: führen, Tor öffnen, in den Kessel, einziehen: nie zwei auf einem Feld, Figur begehbar, wiederholbar`, () => {
      const world = createWorld(seed);
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
          for (let i = 0; i < 400 && !goal(s.player.x, s.player.y); i++) {
            const d = toward(world, s, goal);
            for (const cmd of [d ? { type: 'move' as const, dir: d } : TICK, ...ticks(pause)]) {
              s = step(s, world, cmd, undefined, rules).state;
              check(s);
            }
          }
        };
        wild(800);
        for (let k = 0; k < 6 && !s.openGates.length; k++) {
          go((x, y) => inBay.has(key([x, y])), 2); // zur Bucht, der Pinguin führt
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
