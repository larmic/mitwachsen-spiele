// Invarianten bei wildem Drücken (Regeln in mitwachsen-state.ts): aus mitwachsen-state.test.ts geteilt, damit die
// Worker parallel laufen
import { beforeAll, describe, expect, it } from 'vitest';
import { DIRS as DIRECTIONS, type Dir } from '../../lib/games/front';
import { initialState, step, type Cmd, type State } from './mitwachsen-state';
import { canStep, standHeight, type World } from './mitwachsen-world';
import { crossings } from './mitwachsen-border';
import { freeNear } from './mitwachsen-free';
import { seedRange, seedsFor, worldOf } from './test-worlds';

// Die Welten der Tests einmal vorab bauen (Frist der Hooks: vitest.config.ts): Sonst zahlt der erste Test je Seed den Bau (`worldOf`)
beforeAll(() => [1, 2, 3].forEach((s) => worldOf(s)));

/**
 * Seeds der wilden Läufe ab dem Schneebett: sonst 1 bis 3, tief (MITWACHSEN_DEEP) 1 bis 6 (seedsFor; bis 12 brachte
 * test:deep in gates:ci über 150 s, mit 8 lag es am 26.11.2026 bei 146 s). Die Läufe durchs
 * Tor stellen die Kette von Hand in die Bucht der Seeds 1 und 2, sie bleiben bei diesen
 */
const WILD = seedsFor(seedRange(1, 6), [1, 2, 3]);
const ACT: Cmd = { type: 'action' };
const TICK: Cmd = { type: 'tick' };

/**
 * Tiere der Wiese verlassen sie nie: Wer eingezogen ist, als die Figur nah an der Wiese war, steht noch kurz draußen
 * und läuft hin; ist es einmal auf der Wiese (`settled`), bleibt es dort.
 */
function stayOnMeadow(world: World, s: State, settled: Set<string>, wrong: string[], at: string) {
  for (const a of s.animals) {
    if (a.mode !== 'home') continue;
    const on = world.cell(a.x, a.y).garden === true;
    if (settled.has(a.id) && !on) wrong.push(`${at}: ${a.id} nicht mehr auf der Wiese`);
    else if (on) settled.add(a.id);
  }
}

/**
 * Was in jedem Takt gelten muss: Figur steht begehbar (wenn wach), nie zwei auf einem Feld, keiner folgt doppelt, Tiere
 * der Wiese bleiben drauf. Sammelt Fehler in `wrong`, statt je Takt `expect` aufzurufen: Bei tausenden Takten kosten die
 * `expect` mehr als die Takte selbst
 */
function everyTick(world: World, s: State, settled: Set<string>, wrong: string[], at: string) {
  if (!s.sleeping && standHeight(world, s.openGates, s.player.x, s.player.y) === null)
    wrong.push(`${at}: Figur bei ${s.player.x},${s.player.y} nicht begehbar`);
  const spots = s.animals.map((a) => `${a.x},${a.y}`);
  if (!s.sleeping) spots.push(`${s.player.x},${s.player.y}`);
  if (new Set(spots).size !== spots.length) wrong.push(`${at}: zwei auf einem Feld`);
  if (new Set(s.followers).size !== s.followers.length) wrong.push(`${at}: ein Tier folgt doppelt`);
  stayOnMeadow(world, s, settled, wrong, at);
}

describe('Invarianten bei wildem Drücken', () => {
  const DIRS: Dir[] = ['n', 's', 'e', 'w'];
  for (const seed of WILD) {
    it(`Seed ${seed}: Figur steht immer begehbar, nie zwei auf einem Feld, Tiere der Wiese bleiben drauf, alles wiederholbar`, () => {
      const world = worldOf(seed);
      const play = () => {
        const settled = new Set<string>();
        const wrong: string[] = [];
        let s = initialState(world, {}, seed);
        let r = seed * 7919;
        for (let i = 0; i < 4000; i++) {
          r = (Math.imul(r, 1103515245) + 12345) >>> 0;
          const pick = r % 10;
          const cmd: Cmd = pick < 6 ? { type: 'move', dir: DIRS[(r >>> 8) % 4]! } : pick < 8 ? ACT : TICK;
          s = step(s, world, cmd).state;
          everyTick(world, s, settled, wrong, `Takt ${i}`);
        }
        expect(wrong).toEqual([]);
        return s;
      };
      expect(play()).toEqual(play());
    });
  }

  // Ab dem Schneebett der Eis-Welt (das Eistor ist im Test offen, die Figur kann auch auf die Lichtung laufen)
  for (const seed of [1, 2]) {
    it(`Seed ${seed}: ab dem Schneebett: Figur steht immer begehbar, nie zwei auf einem Feld, alles wiederholbar`, () => {
      const world = worldOf(seed);
      const [bx, by] = world.homes.eis.bed;
      const play = () => {
        const settled = new Set<string>();
        const wrong: string[] = [];
        let s: State = { ...initialState(world, { openGates: ['eis'] }, seed), player: { x: bx, y: by, dir: 's' } };
        let r = seed * 104729;
        for (let i = 0; i < 4000; i++) {
          r = (Math.imul(r, 1103515245) + 12345) >>> 0;
          const pick = r % 10;
          const cmd: Cmd = pick < 6 ? { type: 'move', dir: DIRS[(r >>> 8) % 4]! } : pick < 8 ? ACT : TICK;
          s = step(s, world, cmd).state;
          if (i === 0) expect(s.animals.filter((a) => a.realm === 'eis')).toHaveLength(50);
          if (i === 0) expect(world.realm(s.player.x, s.player.y)).toBe('eis'); // aufgewacht am Schneebett
          // Eis-Tiere: frei umherlaufende bleiben im Kessel, zu Hause sind sie nur auf der Schneewiese
          for (const a of s.animals)
            if (a.realm === 'eis' && a.mode !== 'follow' && world.realm(a.x, a.y) !== 'eis')
              wrong.push(`Takt ${i}: ${a.id} bei ${a.x},${a.y} außerhalb des Kessels`);
          everyTick(world, s, settled, wrong, `Takt ${i}`);
        }
        expect(wrong).toEqual([]);
        return s;
      };
      expect(play()).toEqual(play());
    });
  }
});

describe('Invarianten bei wildem Drücken durchs offene Eistor', () => {
  const DIRS4: Dir[] = ['n', 's', 'e', 'w'];
  /** Nächster Schritt auf dem kürzesten Weg nach `to` (Breitensuche, Tiere zählen nicht) */
  function towards(world: World, s: State, to: readonly [number, number]): Dir | null {
    const start = `${s.player.x},${s.player.y}`;
    const first = new Map<string, Dir | null>([[start, null]]);
    const queue: [number, number][] = [[s.player.x, s.player.y]];
    while (queue.length && first.size < 40000) {
      const [x, y] = queue.shift()!;
      if (x === to[0] && y === to[1]) return first.get(`${x},${y}`) ?? null;
      for (const d of DIRS4) {
        const [dx, dy] = DIRECTIONS[d];
        const k = `${x + dx},${y + dy}`;
        if (first.has(k) || !canStep(world, s.openGates, x, y, x + dx, y + dy)) continue;
        first.set(k, first.get(`${x},${y}`) ?? d);
        queue.push([x + dx, y + dy]);
      }
    }
    return null;
  }

  for (const seed of [1, 2]) {
    it(`Seed ${seed}: hin und her durchs Tor mit Tieren beider Gegenden: Wartende auf eigenen Feldern in ihrer Gegend, nie zwei auf einem Feld, alles wiederholbar`, () => {
      const world = worldOf(seed);
      const gate = world.gates.get('eis')!;
      const { cells } = crossings(world)[0]!;
      const bay: [number, number] = [gate.mid[0] - gate.out[0] * 6, gate.mid[1] - gate.out[1] * 6];
      const snow = crossings(world)[0]!.seats.get('eis')!.at(-1)!; // im Kessel, nah an der Mündung, weit vom Bett
      const play = () => {
        const settled = new Set<string>();
        const s0 = initialState(world, {}, seed);
        // Kette: vier Tiere der Lichtung und vier Eis-Tiere, dicht hinter der Figur in der Bucht
        const herd = [
          ...s0.animals.filter((a) => a.realm === 'lichtung' && a.home.kind === 'region').slice(0, 4),
          ...s0.animals.filter((a) => a.realm === 'eis').slice(0, 4),
        ];
        const [ox, oy] = [-gate.out[0], -gate.out[1]];
        const chained = herd.map((a, i) => ({
          ...a,
          mode: 'follow' as const,
          x: bay[0] + ox * (i + 1),
          y: bay[1] + oy * (i + 1),
        }));
        let s: State = {
          ...s0,
          sleeping: false,
          openGates: ['eis'],
          player: { x: bay[0], y: bay[1], dir: 'n' },
          animals: [...s0.animals.filter((a) => !herd.includes(a)), ...chained],
          followers: chained.map((a) => a.id),
        };
        const seen = new Set<string>();
        const wrong: string[] = [];
        let r = seed * 48271;
        for (let i = 0; i < 2400; i++) {
          r = (Math.imul(r, 1103515245) + 12345) >>> 0;
          // Abwechselnd zielstrebig in den Kessel und zurück in die Bucht, dazwischen wildes Drücken und Takte
          const goal = Math.floor(i / 300) % 2 === 0 ? snow : bay;
          const pick = r % 10;
          const way = pick < 6 ? towards(world, s, goal) : null;
          const cmd: Cmd = way
            ? { type: 'move', dir: way }
            : pick < 8
              ? { type: 'move', dir: DIRS4[(r >>> 8) % 4]! }
              : TICK;
          const out = step(s, world, cmd);
          s = out.state;
          for (const e of out.events)
            if (e.type === 'wait' || e.type === 'rejoin') seen.add(`${e.type} ${e.id.split(':')[0]}`);
          const at = `Takt ${i}`;
          everyTick(world, s, settled, wrong, at);
          for (const a of s.animals) {
            if (a.realm === 'eis' && a.mode !== 'follow' && world.realm(a.x, a.y) !== 'eis')
              wrong.push(`${at}: ${a.id} außerhalb des Kessels`);
            if (a.mode !== 'wait') continue;
            // Wartende: auf der eigenen Seite, nie im Durchgang (jedes auf eigenem Feld, siehe oben)
            if (world.realm(a.x, a.y) !== a.realm) wrong.push(`${at}: ${a.id} wartet in fremder Gegend`);
            if (cells.has(`${a.x},${a.y}`)) wrong.push(`${at}: ${a.id} wartet im Durchgang`);
            if (s.followers.includes(a.id)) wrong.push(`${at}: ${a.id} wartet und folgt`);
          }
        }
        expect(wrong).toEqual([]);
        return { s, seen };
      };
      const first = play();
      // Die Grenze greift wirklich in beide Richtungen
      expect([...first.seen].sort()).toEqual(['rejoin eis', 'rejoin lichtung', 'wait eis', 'wait lichtung']);
      expect(play().s).toEqual(first.s);
    });

    it(`Seed ${seed}: Tiere bleiben in ihrer Gegend: aus der Bucht mit Tieren der Lichtung und aus dem Kessel mit Eis-Tieren hin und her, außerhalb des Durchgangs steht nie ein Tier in einer fremden Gegend, auch kein folgendes`, () => {
      const world = worldOf(seed);
      const gate = world.gates.get('eis')!;
      const { cells, seats } = crossings(world)[0]!;
      const bay: [number, number] = [gate.mid[0] - gate.out[0] * 6, gate.mid[1] - gate.out[1] * 6];
      const snow = seats.get('eis')!.at(-1)!;
      for (const [realm, start, other] of [
        ['lichtung', bay, snow],
        ['eis', snow, bay],
      ] as const) {
        const s0 = initialState(world, {}, seed);
        // Kette: vier Tiere der eigenen Gegend auf freien Feldern dicht um die Figur, keine fremden
        const herd = s0.animals.filter((a) => a.realm === realm && a.home.kind === 'region').slice(0, 4);
        const crowd = { ...s0, sleeping: false, openGates: ['eis' as const], player: { x: start[0], y: start[1] } };
        const chained: typeof herd = [];
        for (const a of herd) {
          const others = [...s0.animals.filter((t) => !herd.includes(t)), ...chained];
          const [x, y] = freeNear(
            { ...crowd, animals: others },
            world,
            start,
            (x, y) => world.realm(x, y) === realm && !cells.has(`${x},${y}`),
          )!;
          chained.push({ ...a, mode: 'follow', x, y });
        }
        let s: State = {
          ...s0,
          ...crowd,
          player: { x: start[0], y: start[1], dir: 'n' },
          animals: [...s0.animals.filter((a) => !herd.includes(a)), ...chained],
          followers: chained.map((a) => a.id),
        };
        let r = seed * 69621;
        let crossed = 0;
        const wrong: string[] = [];
        for (let i = 0; i < 2400; i++) {
          r = (Math.imul(r, 1103515245) + 12345) >>> 0;
          const goal = Math.floor(i / 300) % 2 === 0 ? other : start;
          const pick = r % 10;
          const way = pick < 6 ? towards(world, s, goal) : null;
          const cmd: Cmd = way
            ? { type: 'move', dir: way }
            : pick < 8
              ? { type: 'move', dir: DIRS4[(r >>> 8) % 4]! }
              : TICK;
          const out = step(s, world, cmd);
          s = out.state;
          for (const e of out.events) if (e.type === 'wait' && e.id.startsWith(`${realm}:`)) crossed++;
          for (const a of s.animals)
            if (!cells.has(`${a.x},${a.y}`) && world.realm(a.x, a.y) !== a.realm)
              wrong.push(`Takt ${i}: ${a.id} (${a.mode}) bei ${a.x},${a.y} in fremder Gegend`);
        }
        expect(wrong, realm).toEqual([]);
        expect(crossed, realm).toBeGreaterThan(0); // die Grenze hat wirklich gegriffen
      }
    });
  }
});
