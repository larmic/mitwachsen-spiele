// Der verlaufene Pinguin holt die Figur ab. Im Spiel hat das Eistor noch keinen Schlüssel (`opens: 'never'`); hier
// bekommt es ihn (`{ key: 'pinguin' }`), damit sich das Führen prüfen lässt. Gilt für die ganze Datei.
import { describe, expect, it, vi } from 'vitest';
import { DIRS, type Dir } from '../../lib/games/front';
import { GATES, animalId, type Point } from '../../data/games/mitwachsen';
import {
  initialState,
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
  bay,
  guideGate,
  leader,
  lost,
  wanted,
} from './mitwachsen-guide';
import * as rules from './mitwachsen-lead';
import { toGate } from './mitwachsen-lead';
import { createWorld, standHeight, type World } from './mitwachsen-world';

vi.mock('../../data/games/mitwachsen', async (original) => {
  const data = await original<typeof import('../../data/games/mitwachsen')>();
  const GATES = data.GATES.map((g) => (g.id === 'eis' ? { ...g, opens: { key: 'pinguin' as const } } : g));
  return { ...data, GATES };
});

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

  it('das Eistor hat hier seinen Schlüssel; solange es zu ist, wohnt der Pinguin nicht im Kessel', () => {
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

  it('folgt die Figur ihm, führt er sie bis vor die Tür des Eistors (in die golden markierte Bucht)', () => {
    let s = leading(world, onPath(world, 40), downhill(world, onPath(world, 40)));
    const door = world.gates.get('eis')!;
    const inBay = new Set(bay(door).map(key));
    for (let i = 0; i < 400 && dist(world, s.player) > 1; i++) {
      const here: Point = [s.player.x, s.player.y];
      s = run(s, world, dirTo(here, downhill(world, here)), TICK, TICK, TICK).s;
      const g = guideOf(s)!;
      expect(cheb(g, s.player), `Schritt ${i}`).toBeLessThanOrEqual(FAR + 1);
    }
    s = run(s, world, ...ticks(20)).s;
    const g = guideOf(s)!;
    expect(dist(world, g)).toBe(0); // direkt vor der Tür
    expect(inBay.has(key([g.x, g.y]))).toBe(true);
    expect(inBay.has(key([s.player.x, s.player.y]))).toBe(true);
    expect(g.dir).toBe(door.out[0] > 0 ? 'e' : door.out[0] < 0 ? 'w' : door.out[1] > 0 ? 's' : 'n'); // schaut zum Tor
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
