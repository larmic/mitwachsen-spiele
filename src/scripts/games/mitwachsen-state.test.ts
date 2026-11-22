import { beforeAll, describe, expect, it } from 'vitest';
import { DIRS as DIRECTIONS, type Dir } from '../../lib/games/front';
import { GATES, REGIONS, animalId, type RegionId } from '../../data/games/mitwachsen';
import {
  SLEEP_LOCK,
  REGROW,
  WAKE_GRACE,
  attachPack,
  initialState,
  progressOf,
  regionAnimals,
  step,
  type Animal,
  type Cmd,
  type GameEvent,
  type State,
} from './mitwachsen-state';
import { meadowSpots, windOk } from './mitwachsen-meadow';
import { SCATTER } from './mitwachsen-scatter';
import { beyondRing, kesselPlace, standHeight, type Cell, type World } from './mitwachsen-world';
import { startRealm, type Homestead } from './mitwachsen-home';
import { BLOCK, raining, windy } from './mitwachsen-weather';
import { platformArea } from './mitwachsen-portal';
import { SEATS, crossings } from './mitwachsen-border';
import { dirTo } from './mitwachsen-free';
import { heardStone } from './mitwachsen-story';
import { EIS_PACK, PACKS, bareOf, worldOf } from './test-worlds';
import { ICE_ANIMALS } from '../../data/games/worlds/eis/mitwachsen-kessel';
import { HAUNTS } from './worlds/eis/mitwachsen-haunts';
import { bergPeak } from './worlds/eis/mitwachsen-ice-sky';
import { migrate, newWorld, progressFrom, withProgress, type SavedWorld } from './mitwachsen-save';

/** Zuhause der Lichtung: Bett in ihrer Mitte, in jeder Welt gleich; Zuhause der Eis-Welt (im Kessel von Seed 1) */
const { lichtung: LICHTUNG, eis: EIS_HOME } = worldOf(1).homes;
// Die Welten der Tests einmal vorab bauen (Frist der Hooks: vitest.config.ts): Sonst zahlt der erste Test je Seed den Bau (`worldOf`)
beforeAll(() => {
  [1, 2, 3, 4, 5, 7, 42, 2026].forEach((s) => worldOf(s));
  [1, 3].forEach((s) => bareOf(s));
});

/** Kleine Testwelt: überall flaches Gras des Zuhauses, einzelne Felder überschreibbar */
function fakeWorld(cells: Record<string, Partial<Cell>> = {}, home: Partial<Homestead> = {}): World {
  const world: World = {
    seed: 1,
    cell: (x, y) => ({ h: 1, ground: 'grass', deco: null, region: 'lichtung', solid: false, ...cells[`${x},${y}`] }),
    realm: () => 'lichtung',
    homes: { lichtung: { ...LICHTUNG, ...home }, eis: EIS_HOME },
    gates: new Map(),
    spawns: new Map(),
    spotsOf: () => [],
    climate: () => ({ id: 'eis', strength: 0 }),
    portals: new Map(),
    stones: new Map(),
    attach: () => ({ world, chunks: [] }),
  };
  return world;
}
const animal = (id: string, x: number, y: number, extra: Partial<Animal> = {}): Animal => ({
  id,
  species: 'hase',
  x,
  y,
  dir: 's',
  mode: 'wander',
  home: { kind: 'region', region: 'lichtung' },
  realm: 'lichtung',
  spawn: [x, y],
  rest: 99,
  ...extra,
});
/** Wacher Zustand mit Figur auf (x, y) und den angegebenen Tieren */
function awake(world: World, x: number, y: number, animals: Animal[] = []): State {
  const s = initialState(world);
  return { ...s, sleeping: false, player: { x, y, dir: 'e' }, animals };
}
function run(s: State, world: World, ...cmds: (Cmd | Dir)[]) {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, typeof c === 'string' ? { type: 'move', dir: c } : c);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
const ACT: Cmd = { type: 'action' };
const DIRS_TO_BED: [number, number, Dir][] = [
  [1, 0, 'e'],
  [-1, 0, 'w'],
  [0, 1, 's'],
  [0, -1, 'n'],
];
const TICK: Cmd = { type: 'tick' };
const types = (e: GameEvent[]) => e.map((x) => x.type);

describe('Aufwachen und Schlafen', () => {
  it('startet schlafend im Bett; die erste Taste weckt die Figur an einem freien Platz daneben', () => {
    const world = worldOf(1);
    const s0 = initialState(world);
    expect(s0.sleeping).toBe(true);
    expect([s0.player.x, s0.player.y]).toEqual([...LICHTUNG.bed]);
    const { s, events } = run(s0, world, 'e');
    expect(s.sleeping).toBe(false);
    expect([s.player.x, s.player.y]).toEqual([...LICHTUNG.wake[0]!]);
    expect(types(events)).toEqual(['wake']);
  });

  it('legt sich mit der Aktion am Bett schlafen; Tasten wecken erst nach der Sperrzeit', () => {
    const world = worldOf(1);
    let { s } = run(initialState(world), world, 'e'); // aufwachen neben dem Bett
    const r = run(s, world, ACT);
    expect(r.s.sleeping).toBe(true);
    expect(types(r.events)).toContain('sleep');
    s = r.s;
    // Wildes Drücken während der Sperrzeit weckt nicht
    for (let i = 0; i < SLEEP_LOCK - 1; i++) s = run(s, world, TICK, 'e', ACT).s;
    expect(s.sleeping).toBe(true);
    s = run(s, world, TICK, TICK).s;
    expect(s.still).toBeGreaterThan(0);
    const woke = run(s, world, ACT).s;
    expect(woke.sleeping).toBe(false);
    expect(woke.still).toBe(0); // aus dem Bett auf ein neues Feld: Die Stehzeit (Torplatte) beginnt neu
  });

  it('läuft ins Bett und schläft ein, ganz ohne Aktionstaste', () => {
    const world = worldOf(1);
    const [bx, by] = LICHTUNG.bed;
    const r = run(awake(world, bx + 1, by), world, 'w');
    expect(types(r.events)).toEqual(['sleep']);
    expect(r.s.sleeping).toBe(true);
  });

  it('gleich nach dem Aufwachen ist das Bett nur ein Hindernis', () => {
    const world = worldOf(1);
    let s = run(initialState(world), world, 'e').s; // wach neben dem Bett
    expect(s.sleeping).toBe(false);
    const toBed = DIRS_TO_BED.find(
      ([dx, dy]) => s.player.x + dx === LICHTUNG.bed[0] && s.player.y + dy === LICHTUNG.bed[1],
    )![2];
    expect(types(run(s, world, toBed).events)).toEqual(['bump']);
    for (let i = 0; i < WAKE_GRACE; i++) s = run(s, world, TICK).s;
    expect(run(s, world, toBed).s.sleeping).toBe(true);
  });

  it('schickt folgende Tiere beim Schlafen heim', () => {
    const w = fakeWorld({ '0,0': { deco: 'bed', solid: true } });
    let s = awake(w, 1, 0, [animal('lichtung:hase', 2, 0, { mode: 'follow', spawn: [9, 9] })]);
    s = { ...s, followers: ['lichtung:hase'], player: { ...s.player, dir: 'w' } };
    s = run(s, w, ACT).s;
    expect(s.sleeping).toBe(true);
    expect(s.followers).toEqual([]);
    expect(s.animals[0]!.mode).toBe('wander');
  });
});

describe('Laufen und Klettern', () => {
  it('geht ein Feld in Pfeilrichtung und schaut dorthin', () => {
    const w = fakeWorld();
    const { s, events } = run(awake(w, 0, 0), w, 'e', 's', 's', 'w');
    expect([s.player.x, s.player.y, s.player.dir]).toEqual([0, 2, 'w']);
    expect(types(events)).toEqual(['step', 'step', 'step', 'step']);
  });

  it('Stehzähler (Torplatte): zählt die Takte ohne Eingabe auf demselben Feld, jede Eingabe setzt ihn auf 0; nie gespeichert', () => {
    const w = fakeWorld({ '1,0': { h: 4 } });
    expect(initialState(w).still).toBe(0);
    let r = run(awake(w, 0, 0), w, TICK, TICK, TICK);
    expect(r.s.still).toBe(3);
    r = run(r.s, w, 'e'); // gegen die Wand: kein Schritt, aber ein Pfeil – das ist kein Stehen
    expect(types(r.events)).toEqual(['bump']);
    expect(r.s.still).toBe(0);
    r = run(r.s, w, TICK, ACT); // Aktion ebenso
    expect(r.s.still).toBe(0);
    r = run(r.s, w, TICK, 's');
    expect(r.s.still).toBe(0);
    r = run(r.s, w, TICK, TICK);
    expect(r.s.still).toBe(2);
    r = run(r.s, w, { type: 'tick', held: true }); // Pfeil gedrückt: Die Figur läuft gleich weiter, das ist kein Stehen
    expect(r.s.still).toBe(0);
    r = run(r.s, w, TICK, TICK);
    expect(r.s.still).toBe(2);
    expect('still' in progressOf(r.s)).toBe(false); // flüchtig wie das Ritual
    const file = JSON.parse(JSON.stringify(withProgress(newWorld('a', 1, 'Welt'), progressOf(r.s)))) as SavedWorld;
    expect(Object.keys(file)).not.toContain('still');
    expect(initialState(w, progressFrom(file)).still).toBe(0);
  });

  it('klettert eine Stufe hoch und runter, zwei Stufen sind eine Wand', () => {
    const w = fakeWorld({ '1,0': { h: 2 }, '2,0': { h: 4 }, '1,1': { h: 3 } });
    let r = run(awake(w, 0, 0), w, 'e');
    expect(r.s.player.x).toBe(1);
    expect(r.events).toEqual([{ type: 'step', climb: 1 }]);
    r = run(r.s, w, 'e'); // auf 4: zwei Stufen
    expect(r.s.player.x).toBe(1);
    expect(types(r.events)).toEqual(['bump']);
    r = run(r.s, w, 'w');
    expect(r.events).toEqual([{ type: 'step', climb: -1 }]);
    r = run(awake(w, 1, 2), w, 'n'); // von 1 auf 3: zwei Stufen hoch
    expect(types(r.events)).toEqual(['bump']);
  });

  it('fällt beliebig tief herunter, steigt aber nur eine Stufe hinauf', () => {
    const w = fakeWorld({ '0,0': { h: 4 }, '1,0': { h: 1 } });
    let r = run(awake(w, 0, 0), w, 'e');
    expect(r.events).toEqual([{ type: 'step', climb: -3 }]);
    r = run(r.s, w, 'w'); // zurück hinauf: drei Stufen
    expect(types(r.events)).toEqual(['bump']);
  });

  it('läuft nicht durch Wasser, Bäume, Zäune oder geschlossene Tore', () => {
    const w = fakeWorld({
      '1,0': { ground: 'water', h: 0 },
      '0,1': { deco: 'tree', solid: true },
      '-1,0': { deco: 'biggate', gate: 'eis' },
    });
    const { s, events } = run(awake(w, 0, 0), w, 'e', 's', 'w', 'e');
    expect([s.player.x, s.player.y]).toEqual([0, 0]);
    expect(types(events)).toEqual(['fill', 'bump', 'bump', 'bump']); // am Wasser erst den Eimer füllen, hinein geht es nie
  });
});

describe('Tiere', () => {
  it('singt bei der Aktion, ist beim ersten Mal getroffen und folgt', () => {
    const w = fakeWorld();
    let r = run(awake(w, 0, 0, [animal('a', 1, 0)]), w, ACT);
    expect(r.events).toEqual([
      { type: 'sing', id: 'a', species: 'hase', first: true },
      { type: 'follow', id: 'a' },
    ]);
    expect(r.s.met).toEqual(['a']);
    expect(r.s.followers).toEqual(['a']);
    r = run(r.s, w, ACT); // singt noch einmal, sonst ändert sich nichts
    expect(r.events).toEqual([{ type: 'sing', id: 'a', species: 'hase', first: false }]);
    expect(r.s.followers).toEqual(['a']);
  });

  it('nimmt mit der Aktion auch ein Tier schräg daneben, wenn vorn keines steht', () => {
    const w = fakeWorld();
    const r = run(awake(w, 10, 10, [animal('a', 11, 11)]), w, ACT); // weit weg vom Bett
    expect(types(r.events)).toEqual(['sing', 'follow']);
  });

  it('Hineinlaufen reicht: Das Tier singt, ist gefunden und folgt; die Figur bleibt stehen', () => {
    const w = fakeWorld();
    const r = run(awake(w, 0, 0, [animal('a', 1, 0)]), w, 'e');
    expect(r.events).toEqual([
      { type: 'sing', id: 'a', species: 'hase', first: true },
      { type: 'follow', id: 'a' },
    ]);
    expect(r.s.met).toEqual(['a']);
    expect(r.s.followers).toEqual(['a']);
    expect(r.s.player.x).toBe(0);
  });

  it('in ein folgendes Tier hineinlaufen tauscht sofort den Platz', () => {
    const w = fakeWorld();
    const s = run(awake(w, 0, 0, [animal('a', 1, 0)]), w, 'e').s; // folgt jetzt
    const r = run(s, w, 'e');
    expect(types(r.events)).toEqual(['swap']);
    expect([r.s.player.x, r.s.animals[0]!.x]).toEqual([1, 0]);
    expect(r.s.followers).toEqual(['a']);
  });

  /** Wiese (Garten) auf allen Feldern des Rechtecks */
  const meadow = (x0: number, y0: number, x1: number, y1: number) => {
    const cells: Record<string, Partial<Cell>> = {};
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells[`${x},${y}`] = { garden: true };
    return fakeWorld(cells);
  };
  const resident = (id: string, x: number, y: number) => animal(id, x, y, { mode: 'home', home: { kind: 'garden' } });

  it('ein Tier auf der Wiese macht Platz: Es hüpft zur Seite und schaut, die Figur geht im selben Zug weiter', () => {
    const w = meadow(-2, -2, 2, 2);
    const r = run(awake(w, 0, 0, [resident('a', 1, 0)]), w, 'e');
    expect(types(r.events)).toEqual(['aside', 'step']);
    expect([r.s.player.x, r.s.player.y]).toEqual([1, 0]);
    const a = r.s.animals[0]!;
    expect(a.x === 1 && Math.abs(a.y) === 1, `seitlich: ${a.x},${a.y}`).toBe(true);
    expect(a.dir).toBe(a.y > 0 ? 'n' : 's'); // schaut zur Figur
  });

  it('ist seitlich nichts frei, weicht es geradeaus aus; geht gar nichts, tauschen beide den Platz', () => {
    let w = meadow(0, 0, 2, 0); // eine Reihe
    let r = run(awake(w, 0, 0, [resident('a', 1, 0)]), w, 'e');
    expect(types(r.events)).toEqual(['aside', 'step']);
    expect(r.s.animals[0]!.x).toBe(2);
    w = meadow(0, 0, 1, 0);
    r = run(awake(w, 0, 0, [resident('a', 1, 0)]), w, 'e');
    expect(types(r.events)).toEqual(['swap']);
    expect([r.s.player.x, r.s.animals[0]!.x]).toEqual([1, 0]);
  });

  it('kommt durch eine volle Wiese, ohne anzuhalten; kein Tier steht auf einem anderen oder auf der Figur', () => {
    const w = meadow(0, -2, 7, 2);
    const herd: Animal[] = [];
    for (let x = 1; x <= 6; x++) {
      herd.push(resident(`m${x}`, x, 0));
      if (x % 2 === 0) herd.push(resident(`n${x}`, x, -1), resident(`s${x}`, x, 1));
    }
    let s = awake(w, 0, 0, herd);
    for (let i = 0; i < 7; i++) {
      const r = run(s, w, 'e');
      expect(types(r.events), `Schritt ${i + 1}`).not.toContain('sing');
      s = r.s;
    }
    expect(s.player.x).toBe(7);
    const cells = [...s.animals.map((a) => `${a.x},${a.y}`), `${s.player.x},${s.player.y}`];
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('ein Tier auf der Wiese, das nicht ausweichen kann und nicht tauschen darf, singt nur', () => {
    const w = fakeWorld({ '1,0': { garden: true } }); // die Figur steht nicht auf der Wiese
    const r = run(awake(w, 0, 0, [resident('a', 1, 0)]), w, 'e');
    expect(types(r.events)).toEqual(['sing']);
    expect(r.s.player.x).toBe(0);
  });

  it('läuft im Gänsemarsch: Jedes Tier rückt auf den Platz seines Vordermanns', () => {
    const w = fakeWorld();
    let s = run(awake(w, 0, 0, [animal('a', 1, 0), animal('b', 0, 1)]), w, ACT).s; // a folgt
    s = { ...s, player: { ...s.player, dir: 's' } };
    s = run(s, w, ACT).s; // b folgt
    expect(s.followers).toEqual(['a', 'b']);
    s = run(s, w, 'n', 'n', 'n').s;
    const at = (id: string) => s.animals.find((a) => a.id === id)!;
    expect([s.player.x, s.player.y]).toEqual([0, -3]);
    expect([at('a').x, at('a').y]).toEqual([0, -2]);
    expect([at('b').x, at('b').y]).toEqual([0, -1]);
  });

  it('bleibt stehen und schaut, solange die Figur daneben steht', () => {
    const w = fakeWorld();
    let s = awake(w, 0, 0, [animal('a', 1, 1, { rest: 1 })]);
    for (let i = 0; i < 50; i++) s = run(s, w, TICK).s;
    expect([s.animals[0]!.x, s.animals[0]!.y, s.animals[0]!.dir]).toEqual([1, 1, 'w']);
  });

  it('Eis-Tiere laufen nur im Kessel umher (auch bei offenem Eistor)', () => {
    const w = worldOf(2);
    for (const openGates of [[], ['eis' as const]]) {
      let s: State = { ...initialState(w, {}, 4), sleeping: false, openGates };
      const visited = new Set<string>();
      for (let i = 0; i < 3000; i++) {
        s = run(s, w, TICK).s;
        for (const a of s.animals)
          if (a.realm === 'eis') {
            visited.add(`${a.x},${a.y}`);
            expect([w.cell(a.x, a.y).region, w.cell(a.x, a.y).garden], a.id).toEqual(['eis', undefined]);
          }
      }
      expect(visited.size).toBeGreaterThan(100); // sie laufen wirklich umher
    }
  });

  it('läuft umher, aber nur in seinem Zuhause', () => {
    const cells: Record<string, Partial<Cell>> = {};
    for (let x = -10; x <= 10; x++)
      for (let y = -10; y <= 10; y++) if (Math.abs(x) > 2 || Math.abs(y) > 2) cells[`${x},${y}`] = { region: 'border' };
    const w = fakeWorld(cells);
    let s = awake(w, 8, 8, [animal('a', 0, 0, { rest: 1 })]);
    const visited = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      s = run(s, w, TICK).s;
      visited.add(`${s.animals[0]!.x},${s.animals[0]!.y}`);
    }
    expect(visited.size).toBeGreaterThan(4);
    for (const k of visited) {
      const [x = 0, y = 0] = k.split(',').map(Number);
      expect(Math.abs(x) <= 2 && Math.abs(y) <= 2, k).toBe(true);
    }
  });
});

describe('Beerenbüsche', () => {
  it('in einen Busch laufen pflückt die Beeren; danach ist er nur ein Hindernis, bis sie nachwachsen', () => {
    const w = fakeWorld({ '1,0': { deco: 'bush', solid: true } });
    let r = run(awake(w, 0, 0), w, 'e');
    expect(r.events).toEqual([{ type: 'pick', x: 1, y: 0 }]);
    expect(r.s.player.x).toBe(0);
    r = run(r.s, w, 'e');
    expect(types(r.events)).toEqual(['bump']);
    let s = r.s;
    const regrown: GameEvent[] = [];
    for (let i = 0; i < REGROW; i++) {
      const t = run(s, w, TICK);
      s = t.s;
      regrown.push(...t.events);
    }
    expect(regrown).toEqual([{ type: 'regrow', x: 1, y: 0 }]);
    expect(types(run(s, w, 'e').events)).toEqual(['pick']);
  });
});

/** Testwelt: links vom Bett (x ≤ 0) die Wiese, rechts davon gewöhnliche Lichtung */
const meadowWorld = () => {
  const cells: Record<string, Partial<Cell>> = {};
  for (let y = -3; y <= 3; y++) for (let x = -6; x <= 0; x++) cells[`${x},${y}`] = { garden: true };
  return fakeWorld(cells);
};

describe('Tage', () => {
  it('jedes Schlafen zählt einen Tag; der Tag kommt mit dem Spielstand wieder', () => {
    const world = worldOf(1);
    let s = initialState(world, { day: 4 });
    expect(s.day).toBe(4);
    s = run(s, world, 'e').s;
    s = { ...s, player: { ...s.player, x: LICHTUNG.bed[0] + 1, y: LICHTUNG.bed[1], dir: 'w' } };
    s = run(s, world, ACT).s;
    expect(s.day).toBe(5);
    expect(progressOf(s).day).toBe(5);
  });
});

describe('Tiere an wechselnden Stellen', () => {
  const world = worldOf(3);
  const where = (s: State) =>
    s.animals
      .filter((a) => a.home.kind === 'region')
      .map((a) => `${a.id}@${a.x},${a.y}`)
      .sort();

  it('bei jedem Besuch wohnen die Tiere woanders, beim gleichen Besuch gleich', () => {
    expect(where(initialState(world, {}, 11))).toEqual(where(initialState(world, {}, 11)));
    expect(where(initialState(world, {}, 11))).not.toEqual(where(initialState(world, {}, 12)));
  });

  it('immer auf erreichbaren Feldern der Lichtung, mit Abstand zum Bett und zueinander', () => {
    const spots = new Set(world.spotsOf('lichtung').map(([x, y]) => `${x},${y}`));
    for (const seed of [1, 2, 3]) {
      const s = initialState(world, {}, seed);
      const region = s.animals.filter((a) => a.home.kind === 'region' && a.realm === 'lichtung');
      expect(region).toHaveLength(REGIONS[0].animals.length * REGIONS[0].herd); // je Art eine Herde
      for (const a of region) {
        expect(spots.has(`${a.x},${a.y}`), a.id).toBe(true);
        expect(Math.max(Math.abs(a.x - LICHTUNG.bed[0]), Math.abs(a.y - LICHTUNG.bed[1]))).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('wechselnde Plätze je Welt: Eis-Tiere im Tal, 8 Felder vom Schneebett (außer am Lieblingsort) und 5 voneinander wie auf der Lichtung', () => {
    const [bx, by] = world.homes.eis.bed;
    const spots = new Set(world.spotsOf('eis').map(([x, y]) => `${x},${y}`));
    const open = { openGates: ['eis' as const] }; // bei offenem Eistor (sonst fehlt der verlaufene Pinguin)
    const before = where(initialState(world, open, 1)).filter((w) => w.startsWith('eis:'));
    const firstIce = new Set(ICE_ANIMALS.map(({ species }) => animalId('eis', species)));
    for (const seed of [1, 2, 3]) {
      const ice = initialState(world, open, seed).animals.filter((a) => a.realm === 'eis');
      expect(ice).toHaveLength(50); // zehn Arten, je fünf
      for (const a of ice) {
        expect(spots.has(`${a.x},${a.y}`), a.id).toBe(true);
        if (!firstIce.has(a.id))
          // das erste Tier jeder Art bleibt an seinem Lieblingsort, der Pinguin auch am Iglu
          expect(Math.max(Math.abs(a.x - bx), Math.abs(a.y - by)), a.id).toBeGreaterThanOrEqual(SCATTER.eis.bed);
        for (const o of ice)
          if (o !== a)
            expect(Math.max(Math.abs(a.x - o.x), Math.abs(a.y - o.y))).toBeGreaterThanOrEqual(SCATTER.eis.apart);
      }
      if (seed > 1) expect(ice.map((a) => `${a.id}@${a.x},${a.y}`).sort()).not.toEqual(before);
    }
    expect(SCATTER.lichtung).toEqual({ bed: 8, apart: 5 }); // auf der großen Lichtung wie bisher
    expect({ ...SCATTER.eis, haunt: undefined }).toEqual(SCATTER.lichtung); // das Gletschertal ist fast so weit
  });

  /** Steht jedes erste Eis-Tier an seinem Lieblingsort: nah an seinem Wohnort und an einem Feld seines Themas? */
  const atHaunts = (s: State, w: World) => {
    const radius = SCATTER.eis.haunt!;
    for (const { species, near } of ICE_ANIMALS) {
      const id = animalId('eis', species);
      const a = s.animals.find((x) => x.id === id);
      expect(a, id).toBeDefined();
      const home = w.spawns.get(id)!;
      expect(Math.max(Math.abs(a!.x - home[0]), Math.abs(a!.y - home[1])), id).toBeLessThanOrEqual(radius);
      expect(a!.spawn, id).toEqual([a!.x, a!.y]); // dorthin kehrt es zurück
      const r = radius + 2; // der Wohnort liegt gleich neben dem Thema (world.test.ts)
      let theme = false;
      for (let dy = -r; dy <= r && !theme; dy++)
        for (let dx = -r; dx <= r && !theme; dx++) theme = HAUNTS[near](w.cell(a!.x + dx, a!.y + dy));
      expect(theme, `${id}: ${near}`).toBe(true);
    }
  };

  it('das erste Tier jeder Eis-Art steht an seinem Lieblingsort: beim Öffnen, an jedem neuen Morgen, beim Einziehen', () => {
    const open = { openGates: ['eis' as const] };
    for (const seed of [1, 2]) {
      const w = worldOf(seed);
      for (const rng of [1, 2, 3]) atHaunts(initialState(w, open, rng), w);
    }
    // neuer Morgen im Schneebett: wieder an den Lieblingsorten, aber nicht auf demselben Feld wie gestern
    const [bx, by] = world.homes.eis.bed;
    let s = initialState(world, { ...open, position: [bx, by] }, 4);
    s = run(s, world, 'e').s; // aufwachen
    const before = where(s);
    s = { ...s, player: { ...s.player, x: bx, y: by } };
    s = run(s, world, ACT).s; // schlafen
    for (let i = 0; i < SLEEP_LOCK; i++) s = run(s, world, TICK).s;
    s = run(s, world, 'e').s; // neuer Morgen
    expect(s.sleeping).toBe(false);
    expect(where(s)).not.toEqual(before);
    atHaunts(s, world);
    // das Welt-Paket kommt mitten im Spiel an
    const bare = bareOf(3);
    const { world: full } = bare.attach(PACKS[0]);
    atHaunts(attachPack(initialState(bare, open, 5), full), full);
  });

  it('an einem neuen Morgen sind die verlorenen Tiere woanders unterwegs, Tiere der Wiese bleiben', () => {
    const garden = [{ id: 'lichtung:hase', species: 'hase' as const }];
    let s = initialState(world, { garden }, 5);
    s = run(s, world, 'e').s; // aufwachen
    const hase = s.animals.find((a) => a.id === 'lichtung:hase')!;
    const before = where(s);
    s = { ...s, player: { ...s.player, x: LICHTUNG.bed[0] + 1, y: LICHTUNG.bed[1] } };
    s = run(s, world, ACT).s; // schlafen
    for (let i = 0; i < SLEEP_LOCK; i++) s = run(s, world, TICK).s;
    s = run(s, world, 'e').s; // neuer Morgen
    expect(where(s)).not.toEqual(before);
    const later = s.animals.find((a) => a.id === 'lichtung:hase')!;
    expect(later.mode).toBe('home');
    expect(world.cell(later.x, later.y).garden).toBe(hase.mode === 'home' ? true : undefined);
  });
});

describe('Unterstand bei Regen', () => {
  it('regnet es, gehen die Tiere der Wiese unter den Unterstand; danach zurück an ihre Plätze', () => {
    const world = worldOf(1);
    const garden = Array.from({ length: 6 }, (_, i) => ({ id: `wild:7:7:${i}`, species: 'hase' as const }));
    let s: State = { ...initialState(world, { garden }), sleeping: false, player: { x: 0, y: 3, dir: 's' } };
    let rain = 1;
    while (!raining(world.seed, s.day, rain * BLOCK)) rain++;
    s = { ...s, tick: rain * BLOCK };
    for (let i = 0; i < 400; i++) s = run(s, world, TICK).s;
    const home = () => s.animals.filter((a) => a.mode === 'home');
    for (const a of home()) expect(world.cell(a.x, a.y).roof, `${a.id} ${a.x},${a.y}`).toBe(true);
    let sun = rain + 1;
    while (raining(world.seed, s.day, sun * BLOCK)) sun++;
    s = { ...s, tick: sun * BLOCK };
    for (let i = 0; i < 600; i++) s = run(s, world, TICK).s;
    for (const a of home())
      expect(Math.abs(a.x - a.spawn[0]) + Math.abs(a.y - a.spawn[1]), a.id).toBeLessThanOrEqual(4);
    for (const a of home()) expect(world.cell(a.x, a.y).garden).toBe(true);
  });
});

describe('Iglu bei Pustewind (Eis-Welt)', () => {
  const world = worldOf(1);
  const igloo = world.homes.eis.shelter;
  const lee = world.homes.eis.lee!;
  /** alle Tiere der Lichtung und der Eis-Welt wohnen auf ihrer Wiese (ohne den Pinguin: noch kein Pustewind) */
  const everyone = (penguin = true) =>
    REGIONS.flatMap((r) => regionAnimals(r.id))
      .filter((id) => penguin || id !== 'eis:pinguin')
      .map((id) => ({ id, species: id.split(':')[1] as 'hase' }));
  /** erster Abschnitt des Tages, in dem es in der Eis-Welt windet (bzw. nicht) und auf der Lichtung regnet (bzw. nicht) */
  const block = (wind: boolean, rain: boolean) => {
    let b = 1;
    while (windy(world.seed, 0, b * BLOCK) !== wind || raining(world.seed, 0, b * BLOCK) !== rain) b++;
    return b;
  };
  const start = (b: number, garden = everyone()): State => ({
    ...initialState(world, { garden, openGates: ['eis'] }),
    sleeping: false,
    tick: b * BLOCK,
  });
  const ticks = (s: State, n: number) => {
    for (let i = 0; i < n; i++) s = run(s, world, TICK).s;
    return s;
  };
  const resting = (s: State, realm: RegionId) => s.animals.filter((a) => a.mode === 'home' && a.realm === realm);
  const inIgloo = (a: Animal) => world.cell(a.x, a.y).roof === true && world.realm(a.x, a.y) === 'eis';
  const nearSpawn = (a: Animal) => Math.abs(a.x - a.spawn[0]) + Math.abs(a.y - a.spawn[1]) <= 4;

  it('weht der Pustewind, gehen die Tiere der Schneewiese ins Iglu, vorn zuerst, die übrigen dicht an die windgeschützte Seite; danach zurück', () => {
    let s = ticks(start(block(true, false)), 600);
    const ice = resting(s, 'eis');
    expect(ice).toHaveLength(50);
    const inside = ice.filter(inIgloo);
    expect(inside).toHaveLength((igloo.x1 - igloo.x0 + 1) * (igloo.y1 - igloo.y0 + 1)); // das Iglu ist voll
    // Wer nicht hineinpasst, steht dicht an der windgeschützten Seite: auf den Feldern der Wiese, die ihr am nächsten
    // liegen (bei fünf Tieren je Art sind das viele, darum etwas weiter als drei Felder)
    const outside = ice.filter((a) => !inIgloo(a));
    const toLee = ([x, y]: readonly [number, number]) => Math.hypot(x - lee[0], y - lee[1]);
    const free = meadowSpots(world, 'eis').filter(([x, y]) => !world.cell(x, y).roof);
    const reach = free.map(toLee).sort((a, b) => a - b)[outside.length - 1]!;
    expect(reach).toBeLessThanOrEqual(6);
    for (const a of outside) expect(toLee([a.x, a.y]), a.id).toBeLessThanOrEqual(reach + 0.5);
    const leeward = outside.filter((a) => a.x >= igloo.x1); // rechts daneben: windgeschützt
    expect(leeward.length).toBeGreaterThanOrEqual((outside.length * 2) / 3);
    // Pinguine kuscheln vorn in der Mitte (fünf nebeneinander), die fünf Moschusochsen stehen dicht beieinander
    const of = (species: string) => ice.filter((a) => a.species === species);
    for (const p of of('pinguin')) expect([inIgloo(p), p.y], p.id).toEqual([true, igloo.y1]);
    for (const group of [of('pinguin'), of('moschusochse')]) {
      expect(group).toHaveLength(5);
      const xs = group.map((a) => a.x),
        ys = group.map((a) => a.y);
      expect(Math.max(...xs) - Math.min(...xs), group[0]!.species).toBeLessThanOrEqual(4);
      expect(Math.max(...ys) - Math.min(...ys), group[0]!.species).toBeLessThanOrEqual(2);
    }
    // Hört der Wind auf, gehen alle zurück an ihre Plätze auf der Schneewiese
    s = ticks({ ...s, tick: block(false, false) * BLOCK }, 900);
    for (const a of resting(s, 'eis')) {
      expect(nearSpawn(a), a.id).toBe(true);
      expect(world.cell(a.x, a.y).garden).toBe(true);
    }
  });

  it('jede Wiese folgt nur dem Wetter ihrer Gegend: Tiere der Lichtung bleiben bei Eis-Wind draußen und umgekehrt', () => {
    const windOnly = ticks(start(block(true, false)), 400);
    for (const a of resting(windOnly, 'lichtung')) expect(nearSpawn(a), a.id).toBe(true);
    expect(resting(windOnly, 'eis').filter(inIgloo).length).toBeGreaterThan(15);
    const rainOnly = ticks(start(block(false, true)), 400);
    for (const a of resting(rainOnly, 'eis'))
      expect([nearSpawn(a), inIgloo(a) && !nearSpawn(a)], a.id).toEqual([true, false]);
    expect(resting(rainOnly, 'lichtung').filter((a) => world.cell(a.x, a.y).roof).length).toBeGreaterThan(10);
  });

  it('bevor der Pinguin zu Hause ist, weht kein Pustewind: Die Tiere der Schneewiese bleiben draußen', () => {
    const s = ticks(start(block(true, false), everyone(false)), 400);
    const ice = resting(s, 'eis');
    expect(ice).toHaveLength(49);
    for (const a of ice) expect(nearSpawn(a), a.id).toBe(true);
  });

  it('zieht der Pinguin mitten im Pustewind-Abschnitt ein, bleibt es heute windstill; erst nach dem Schlafen weht es', () => {
    const base = start(block(true, false), everyone(false));
    const free = ([x, y]: readonly [number, number], dx: number, dy: number) => {
      const c = world.cell(x + dx, y + dy);
      return c.garden === true && !c.solid && !base.animals.some((a) => a.x === x + dx && a.y === y + dy);
    };
    const DIR4 = [
      ['e', 1, 0],
      ['w', -1, 0],
      ['s', 0, 1],
      ['n', 0, -1],
    ] as const;
    // ein Platz am Bett, an dem vor und hinter der Figur die Wiese frei ist (wo die Tiere stehen, würfelt die Welt)
    const [x, y] = world.homes.eis.wake.find((p) => DIR4.some(([, dx, dy]) => free(p, dx, dy) && free(p, -dx, -dy)))!;
    const [dir, dx, dy] = DIR4.find(([, dx, dy]) => free([x, y], dx, dy) && free([x, y], -dx, -dy))!;
    const animals = base.animals.map((a) =>
      a.id === 'eis:pinguin' ? { ...a, mode: 'follow' as const, x: x - dx, y: y - dy } : a,
    );
    const s0: State = { ...base, animals, followers: ['eis:pinguin'], player: { x, y, dir } };
    const moved = run(s0, world, dir);
    expect(moved.events).toContainEqual({ type: 'home', id: 'eis:pinguin', species: 'pinguin' });
    expect(windOk(moved.s)).toBe(false); // heute nicht: kein Sprung von Sonne auf vollen Wind
    const s = ticks(moved.s, 400);
    for (const a of resting(s, 'eis')) expect(nearSpawn(a), a.id).toBe(true); // keiner sucht das Iglu auf
    expect(windOk({ ...s, day: s.day + 1 })).toBe(true); // nach dem Schlafen darf der Pustewind wehen
    expect(windOk(initialState(world, { garden: everyone(), day: s.day }))).toBe(true); // im Spielstand: gleich
  });
});

describe('Jeder Tag beginnt mit Sonne', () => {
  it('nach dem Schlafen beginnt das Wetter von vorn, auch wenn es am Abend geregnet hat', () => {
    const world = worldOf(1);
    let s: State = {
      ...initialState(world),
      sleeping: false,
      player: { x: LICHTUNG.bed[0] + 1, y: LICHTUNG.bed[1], dir: 'w' },
    };
    let rain = 1;
    while (!raining(world.seed, s.day, rain * BLOCK)) rain++;
    s = { ...s, tick: rain * BLOCK + 10, wokeAt: -1e9 }; // es regnet gerade
    expect(raining(world.seed, s.day, s.tick - s.dayStart)).toBe(true);
    s = run(s, world, ACT).s; // schlafen
    for (let i = 0; i < SLEEP_LOCK; i++) s = run(s, world, TICK).s;
    s = run(s, world, 'e').s; // neuer Morgen
    expect(s.sleeping).toBe(false);
    expect(s.dayStart).toBe(s.tick);
    expect(raining(world.seed, s.day, s.tick - s.dayStart)).toBe(false);
  });
});

describe('Korb mit Beeren', () => {
  it('Pflücken füllt den Korb; am Futtertrog kommen die Beeren hinein und alle Tiere der Wiese freuen sich', () => {
    const w = fakeWorld({
      '1,0': { deco: 'bush', solid: true },
      '-1,0': { deco: 'trough', solid: true, garden: true },
      '0,2': { garden: true },
    });
    let s = awake(w, 0, 0, [
      animal('lichtung:hase', 0, 2, { mode: 'home', home: { kind: 'garden' } }),
      animal('lichtung:igel', 5, 5),
    ]);
    expect(types(run(s, w, 'w').events)).toEqual(['bump']); // ohne Korb ist der Trog nur ein Hindernis
    s = run(s, w, 'e').s;
    expect(s.basket).toBe(true);
    const r = run(s, w, 'w');
    expect(r.events).toEqual([{ type: 'feed', food: 'berries', ids: ['lichtung:hase'] }]);
    expect(r.s.basket).toBe(false);
    expect([r.s.player.x, r.s.player.y]).toEqual([0, 0]);
  });
});

describe('Eimer mit Wasser', () => {
  it('am Wasser schöpft die Figur einen Eimer voll; am Wassertrog kommt das Wasser hinein, alle Tiere der Wiese freuen sich', () => {
    const w = fakeWorld({
      '1,0': { ground: 'water', h: 0 },
      '-1,0': { deco: 'watertrough', solid: true, garden: true },
      '0,2': { garden: true },
    });
    let s = awake(w, 0, 0, [animal('lichtung:hase', 0, 2, { mode: 'home', home: { kind: 'garden' } })]);
    expect(types(run(s, w, 'w').events)).toEqual(['bump']); // ohne Eimer ist der Trog nur ein Hindernis
    let r = run(s, w, 'e');
    expect(r.events).toEqual([{ type: 'fill', x: 1, y: 0 }]);
    s = r.s;
    expect([s.bucket, s.player.x]).toEqual([true, 0]); // die Figur bleibt am Ufer stehen
    expect(types(run(s, w, 'e').events)).toEqual(['bump']); // voller Eimer: Wasser ist wieder nur Wasser
    r = run(s, w, 'w');
    expect(r.events).toEqual([{ type: 'pour', ids: ['lichtung:hase'] }]);
    expect(r.s.bucket).toBe(false);
  });

  it('Korb und Eimer trägt die Figur gleichzeitig; jeder Trog nimmt nur das Seine', () => {
    const w = fakeWorld({
      '1,0': { ground: 'water', h: 0 },
      '0,1': { deco: 'trough', solid: true },
      '0,-1': { deco: 'bush', solid: true },
    });
    let s = run(awake(w, 0, 0), w, 'e', 'n').s;
    expect([s.basket, s.bucket]).toEqual([true, true]);
    s = run(s, w, 's').s;
    expect([s.basket, s.bucket]).toEqual([false, true]);
  });
});

describe('Fischkisten und Eisschale (Eis-Welt)', () => {
  it('Fischkiste: hineinlaufen gibt das Netz, die Kiste ist leer und nach 300 Takten wieder voll (auch nachts)', () => {
    const w = fakeWorld({ '1,0': { deco: 'fishcrate', solid: true, biome: 'eis' } });
    let r = run(awake(w, 0, 0), w, 'e');
    expect(r.events).toEqual([{ type: 'catch', x: 1, y: 0 }]);
    expect([r.s.fish, r.s.basket, r.s.bucket, r.s.player.x]).toEqual([true, false, false, 0]); // die Figur bleibt stehen
    expect(types(run(r.s, w, 'e').events)).toEqual(['bump']); // leer ist die Kiste ein Hindernis wie ein abgeernteter Busch
    let s: State = { ...r.s, sleeping: true }; // nachts wächst es auch nach
    const regrown: GameEvent[] = [];
    for (let i = 0; i < REGROW; i++) {
      r = run(s, w, TICK);
      s = r.s;
      regrown.push(...r.events);
      if (i === REGROW - 2) expect(regrown).toEqual([]);
    }
    expect(regrown).toEqual([{ type: 'regrow', x: 1, y: 0 }]);
    expect(types(run({ ...s, sleeping: false }, w, 'e').events)).toEqual(['catch']);
    expect(initialState(w).fish).toBe(false);
    expect('fish' in progressOf(s)).toBe(false); // das Netz wird nicht gespeichert, wie Korb und Eimer
  });

  it('die Eisschale nimmt nur Fisch, der Futtertrog nur Beeren; ohne das Passende sind beide ein Hindernis', () => {
    const w = fakeWorld({
      '-1,0': { deco: 'icebowl', solid: true, garden: true },
      '1,0': { deco: 'trough', solid: true, garden: true },
      '0,2': { garden: true },
    });
    const home = [animal('lichtung:hase', 0, 2, { mode: 'home', home: { kind: 'garden' } })];
    const s = awake(w, 0, 0, home);
    expect(types(run(s, w, 'w', 'e').events)).toEqual(['bump', 'bump']); // leere Hände
    let r = run({ ...s, basket: true }, w, 'w');
    expect([types(r.events), r.s.basket]).toEqual([['bump'], true]); // Beeren gehören nicht in die Eisschale
    r = run({ ...s, fish: true }, w, 'e');
    expect([types(r.events), r.s.fish]).toEqual([['bump'], true]); // Fisch gehört nicht in den Futtertrog
    r = run({ ...s, fish: true }, w, 'w');
    expect(r.events).toEqual([{ type: 'feed', food: 'fish', ids: ['lichtung:hase'] }]);
    expect([r.s.fish, r.s.player.x]).toEqual([false, 0]);
  });

  it('Netz, Eimer und Korb trägt die Figur gleichzeitig; jeder Trog nimmt nur das Seine', () => {
    const w = fakeWorld({
      '1,0': { ground: 'water', h: 0 },
      '0,-1': { deco: 'bush', solid: true },
      '-1,0': { deco: 'fishcrate', solid: true },
      '0,1': { deco: 'icebowl', solid: true },
      '1,1': { deco: 'watertrough', solid: true },
      '-1,1': { deco: 'trough', solid: true },
    });
    let s = run(awake(w, 0, 0), w, 'e', 'n', 'w').s;
    expect([s.basket, s.fish, s.bucket]).toEqual([true, true, true]);
    let r = run(s, w, 's');
    expect([types(r.events), r.s.basket, r.s.fish, r.s.bucket]).toEqual([['feed'], true, false, true]);
    s = { ...r.s, player: { x: 1, y: 0, dir: 's' } };
    r = run(s, w, 's');
    expect([types(r.events), r.s.basket, r.s.fish, r.s.bucket]).toEqual([['pour'], true, false, false]);
    s = { ...r.s, player: { x: -1, y: 0, dir: 's' } };
    r = run(s, w, 's');
    expect([types(r.events), r.s.basket, r.s.fish, r.s.bucket]).toEqual([['feed'], false, false, false]);
  });

  it('am Eisloch schöpft die Figur Wasser, im Wassertrog aus Eis leert sie es: Es freuen sich die Tiere der Schneewiese', () => {
    const world = worldOf(1);
    const home = world.homes.eis;
    // ein Feld am Ufer des Eislochs (im Kessel um das Schneebett herum gesucht)
    const shore = (() => {
      for (let dy = -20; dy <= 20; dy++)
        for (let dx = -25; dx <= 25; dx++) {
          const [x, y] = [home.bed[0] + dx, home.bed[1] + dy];
          if (world.cell(x, y).ground !== 'water') continue;
          for (const [ex, ey, dir] of DIRS_TO_BED)
            if (standHeight(world, [], x - ex, y - ey) !== null) return { at: [x - ex, y - ey] as const, dir };
        }
      throw new Error('kein Ufer');
    })();
    const pinguin = animal('eis:pinguin', home.bed[0] + 2, home.bed[1] + 2, {
      species: 'pinguin',
      mode: 'home',
      home: { kind: 'garden' },
      realm: 'eis',
    });
    const hase = animal('lichtung:hase', 2, 2, { mode: 'home', home: { kind: 'garden' } });
    let s: State = { ...awake(world, ...shore.at, [pinguin, hase]), openGates: ['eis'] };
    let r = run(s, world, shore.dir);
    expect(types(r.events)).toEqual(['fill']);
    expect(world.realm(...shore.at)).toBe('eis');
    // vor den Wassertrog aus Eis (rechts vor dem Schneebett) und hinein
    const [tx, ty] = home.water;
    expect(world.cell(tx, ty).biome).toBe('eis');
    s = { ...r.s, player: { x: tx, y: ty - 1, dir: 's' } };
    r = run(s, world, 's');
    expect(r.events).toEqual([{ type: 'pour', ids: ['eis:pinguin'] }]);
    expect(r.s.bucket).toBe(false);
  });
});

describe('Wiese ums Bett', () => {
  it('ein folgendes Tier, das die Wiese betritt, ist zu Hause: es singt, läuft zu seinem Platz und bleibt dort', () => {
    const w = meadowWorld();
    let s = awake(w, 2, 0, [animal('lichtung:hase', 3, 0, { mode: 'follow' })]);
    s = { ...s, followers: ['lichtung:hase'], player: { ...s.player, dir: 'w' } };
    const r = run(s, w, 'w', 'w', 'w');
    expect(r.events).toContainEqual({ type: 'home', id: 'lichtung:hase', species: 'hase' });
    expect(r.s.followers).toEqual([]);
    expect(r.s.garden).toEqual([{ id: 'lichtung:hase', species: 'hase' }]);
    const hase = () => s.animals.find((a) => a.id === 'lichtung:hase')!;
    s = { ...r.s, player: { ...r.s.player, x: 12, y: 0 } }; // Figur geht weg
    expect(w.cell(hase().spawn[0], hase().spawn[1]).garden).toBe(true);
    for (let i = 0; i < 300; i++) s = run(s, w, TICK).s;
    expect(Math.abs(hase().x - hase().spawn[0]) + Math.abs(hase().y - hase().spawn[1])).toBeLessThanOrEqual(2);
    for (let i = 0; i < 2000; i++) {
      s = run(s, w, TICK).s;
      expect(w.cell(hase().x, hase().y).garden, `${hase().x},${hase().y}`).toBe(true);
    }
  });

  it('kommt die Figur nah an die Wiese, ziehen alle folgenden Tiere zugleich ein, auch die hinteren, und laufen selbst hin', () => {
    const w = meadowWorld(); // Wiese bis x = 0
    const ids = ['lichtung:hase', 'lichtung:igel', 'lichtung:fuchs', 'lichtung:schaf', 'lichtung:kuh'];
    let s = awake(
      w,
      5,
      0,
      ids.map((id, i) => animal(id, 6 + i, 0, { mode: 'follow' })),
    );
    s = { ...s, followers: ids, player: { ...s.player, dir: 'w' } };
    let r = run(s, w, 'w'); // Figur auf x = 4: noch 4 Felder bis zur Wiese
    expect(types(r.events)).not.toContain('home');
    r = run(r.s, w, 'w'); // x = 3: noch 3 Felder
    expect(types(r.events)).not.toContain('home');
    r = run(r.s, w, 'w'); // x = 2: nah genug (`NEAR_MEADOW`), alle zugleich
    expect(r.events.filter((e) => e.type === 'home').map((e) => e.type === 'home' && e.id)).toEqual(ids);
    expect(r.s.followers).toEqual([]);
    expect(r.s.garden.map((p) => p.id)).toEqual(ids);
    expect(r.s.animals.every((a) => !w.cell(a.x, a.y).garden)).toBe(true); // noch stehen alle draußen
    s = { ...r.s, player: { ...r.s.player, x: 3, y: 4 } }; // Figur geht zur Seite
    for (let i = 0; i < 300; i++) s = run(s, w, TICK).s;
    for (const a of s.animals) expect(w.cell(a.x, a.y).garden, a.id).toBe(true);
  });

  it('nah an der Wiese bleiben Tiere einer anderen Gegend in der Kette', () => {
    const w = meadowWorld();
    const ids = ['lichtung:hase', 'eis:pinguin'];
    let s = awake(w, 3, 0, [
      animal(ids[0]!, 4, 0, { mode: 'follow' }),
      animal(ids[1]!, 5, 0, { mode: 'follow', realm: 'eis', home: { kind: 'region', region: 'eis' } }),
    ]);
    s = { ...s, followers: ids, player: { ...s.player, dir: 'w' } };
    const r = run(s, w, 'w');
    expect(r.events.filter((e) => e.type === 'home').map((e) => e.type === 'home' && e.id)).toEqual(['lichtung:hase']);
    expect(r.s.followers).toEqual(['eis:pinguin']);
  });

  it('jedes Tier bekommt einen eigenen Platz auf der Wiese', () => {
    const w = meadowWorld();
    const ids = ['lichtung:hase', 'lichtung:igel', 'lichtung:fuchs'];
    let s = awake(
      w,
      2,
      0,
      ids.map((id, i) => animal(id, 3 + i, 0, { mode: 'follow' })),
    );
    s = { ...s, followers: ids, player: { ...s.player, dir: 'w' } };
    s = run(s, w, 'w', 'w', 'w', 'w', 'w').s;
    expect(s.garden.map((p) => p.id).sort()).toEqual([...ids].sort());
    const spots = s.animals.map((a) => a.spawn.join(','));
    expect(new Set(spots).size).toBe(3);
  });

  it('ein folgendes Tier, das per Platztausch auf die Wiese kommt, bleibt dort', () => {
    const w = meadowWorld();
    let s = awake(w, 0, 0, [animal('lichtung:hase', 1, 0, { mode: 'follow' })]);
    s = { ...s, followers: ['lichtung:hase'] };
    const r = run(s, w, 'e'); // tauscht sofort: Hase steht jetzt auf der Wiese
    expect(r.events).toContainEqual({ type: 'home', id: 'lichtung:hase', species: 'hase' });
    expect(r.s.followers).toEqual([]);
  });

  it('Tiere auf der Wiese folgen nicht, wenn die Figur hineinläuft', () => {
    const w = fakeWorld({ '1,0': { garden: true }, '0,0': { garden: true } });
    const r = run(awake(w, 0, 0, [animal('a', 1, 0, { mode: 'home', home: { kind: 'garden' } })]), w, 'e');
    expect(types(r.events)).toEqual(['swap']); // kein Platz zum Ausweichen: Sie tauschen
    expect(r.s.followers).toEqual([]);
  });

  it('Tiere auf der Wiese kommen mit dem Spielstand wieder, verteilt auf der Wiese', () => {
    const world = worldOf(2);
    const garden = Array.from({ length: 8 }, (_, i) => ({ id: `wild:9:9:${i}`, species: 'hase' as const }));
    const s = initialState(world, { garden });
    const home = s.animals.filter((a) => a.mode === 'home');
    expect(home).toHaveLength(8);
    for (const a of home) expect(world.cell(a.x, a.y).garden).toBe(true);
    expect(new Set(home.map((a) => `${a.x},${a.y}`)).size).toBe(8);
  });
});

describe('Große Tore', () => {
  const never = GATES.filter((g) => g.opens === 'never').map((g) => g.id);

  it('die anderen sieben Tore öffnen nie (`never`); das Eistor öffnet nur der Pinguin, kein anderes Tier', () => {
    expect(never).toHaveLength(7);
    expect(never).not.toContain('eis');
    expect(GATES.find((g) => g.id === 'eis')!.opens).toEqual({ key: 'pinguin' });
    // alle Tiere der Lichtung und alle Eis-Tiere außer dem Pinguin zu Hause: Er ist nicht dabei, also bleibt alles zu
    const world = worldOf(1);
    const garden = REGIONS.flatMap((r) => regionAnimals(r.id))
      .filter((id) => id !== 'eis:pinguin')
      .map((id) => ({ id, species: id.split(':')[1] as 'hase' }));
    const r = run(
      { ...initialState(world, { garden }), sleeping: false },
      world,
      ...Array.from({ length: 300 }, () => TICK),
    );
    expect(r.s.openGates).toEqual([]);
    expect(types(r.events)).not.toContain('gate');
  });

  it('Tore mit opens „never“ öffnen nie, auch wenn alle Tiere der Lichtung gefunden sind', () => {
    const world = worldOf(1);
    const s = initialState(world, { met: regionAnimals('lichtung') });
    expect(s.openGates).toEqual([]);
    for (const [x, y] of [...world.gates.values()].flatMap((g) => g.cells))
      expect(standHeight(world, s.openGates, x, y)).toBeNull();
  });

  it('Tore mit opens „never“ öffnen nie, auch nicht aus einem alten Spielstand', () => {
    const s = initialState(worldOf(1), { openGates: never });
    expect(s.openGates.filter((id) => never.includes(id))).toEqual([]);
  });

  it('ohne die nachgeladenen Regeln des Pinguins taucht er nicht auf, und kein Tor geht auf', () => {
    const world = worldOf(1);
    const garden = regionAnimals('lichtung').map((id) => ({ id, species: id.split(':')[1] as 'hase' }));
    let s = initialState(world, { garden });
    expect(s.animals.some((a) => a.id === 'eis:pinguin')).toBe(false); // verlaufen: nicht im Kessel
    const r = run(s, world, 'n', ...Array.from({ length: 300 }, () => TICK));
    s = r.s;
    expect(types(r.events)).not.toContain('guide');
    expect(s.animals.some((a) => a.mode === 'lead')).toBe(false);
    expect(s.openGates).toEqual([]);
  });

  it('das letzte gefundene Tier öffnet kein Tor (kein Ereignis)', () => {
    const world = worldOf(1);
    const others = regionAnimals('lichtung').filter((id) => id !== animalId('lichtung', 'hase'));
    let s = initialState(world, { met: others });
    s = {
      ...s,
      sleeping: false,
      player: { x: 0, y: 1, dir: 'e' },
      animals: [animal(animalId('lichtung', 'hase'), 1, 1)],
    };
    const r = run(s, world, ACT);
    expect(types(r.events)).not.toContain('gate');
    expect(r.s.openGates).toEqual([]);
  });
});

describe('Zuhause je Gegend', () => {
  it('startet am Bett der Gegend, in der die gespeicherte Position liegt', () => {
    const world = worldOf(1);
    expect(world.realm(20, -14)).toBe('lichtung');
    const s = initialState(world, { position: [20, -14] });
    expect([s.player.x, s.player.y]).toEqual([...world.homes.lichtung.bed]);
    // Das Bett kommt aus dem Zuhause der Gegend: Liegt es woanders, schläft die Figur dort
    const moved = fakeWorld({}, { bed: [5, 7] });
    const t = initialState(moved, { position: [2, 3] });
    expect([t.player.x, t.player.y]).toEqual([5, 7]);
  });

  it('unbekannte oder kaputte Position: Start am Bett der Lichtung', () => {
    const world = worldOf(1);
    const bed = [...world.homes.lichtung.bed];
    for (const position of [undefined, [5000, -7000], [Number.NaN, 2], [1.5, 0]] as const) {
      const s = initialState(world, { position: position && [position[0], position[1]] });
      expect([s.player.x, s.player.y], String(position)).toEqual(bed);
    }
  });

  it('schläft im Bett der Gegend, in der die Figur steht, und wacht dort auf', () => {
    const w = fakeWorld({ '5,7': { deco: 'bed', solid: true } }, { bed: [5, 7], wake: [[5, 8]] });
    let s = awake(w, 6, 7);
    s = { ...s, player: { ...s.player, dir: 'w' } };
    s = run(s, w, ACT).s;
    expect(s.sleeping).toBe(true);
    expect([s.player.x, s.player.y]).toEqual([5, 7]);
    for (let i = 0; i < SLEEP_LOCK; i++) s = run(s, w, TICK).s;
    s = run(s, w, 'e').s;
    expect(s.sleeping).toBe(false);
    expect([s.player.x, s.player.y]).toEqual([5, 8]);
  });

  it('schläft im Schneebett der Eis-Welt und wacht dort auf (Tor im Test offen)', () => {
    const world = worldOf(1);
    const { bed, wake } = world.homes.eis;
    let s: State = { ...awake(world, bed[0] + 1, bed[1]), openGates: ['eis'] };
    s = { ...s, player: { ...s.player, dir: 'w' } };
    s = run(s, world, 'w').s; // ins Schneebett laufen
    expect(s.sleeping).toBe(true);
    expect([s.player.x, s.player.y]).toEqual([...bed]);
    for (let i = 0; i < SLEEP_LOCK; i++) s = run(s, world, TICK).s;
    s = run(s, world, 'n').s;
    expect(s.sleeping).toBe(false);
    expect([s.player.x, s.player.y]).toEqual([...wake[0]!]);
    expect(world.realm(s.player.x, s.player.y)).toBe('eis');
  });

  it('im Gletscherkessel gespeichert, das Eistor ist aber zu: Start am Bett der Lichtung', () => {
    const world = worldOf(1);
    const s = initialState(world, { position: [...world.homes.eis.wake[0]!] as [number, number] });
    expect([s.player.x, s.player.y]).toEqual([...world.homes.lichtung.bed]);
  });

  // je Seed ein eigener Test (gut 2.800 Felder je Seed), so bleibt jeder im Zeitbudget (vitest.config.ts)
  it.each([1, 42, 2026, 7])(
    'alter Spielstand im Gletscherkessel, wo heute eine Tanne, ein Eisblock, ein Eiskristall oder ein Eisloch ist: Start im Schneebett (Seed %i)',
    (seed) => {
      // Die Winterlandschaft und die Seen kamen nach: Eine gespeicherte Position kann jetzt auf einer Tanne oder im Wasser
      // eines Eislochs liegen. Die Figur schläft trotzdem im Schneebett und wacht auf begehbarem Boden daneben auf
      const world = worldOf(seed);
      const snowy = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => {
        const c = world.cell(x, y);
        // Tanne, Kristall, Eisblock oder Eisloch
        return (
          c.tree === 'snowpine' ||
          c.deco === 'crystal' ||
          (c.ground === 'ice' && c.h >= 2 && !c.slide) ||
          (c.ground === 'water' && c.region === 'eis')
        );
      });
      expect(snowy.length).toBeGreaterThan(20);
      // Den Start prüft jedes Feld (Fehler gesammelt, ein `expect`); das Aufwachen im Schneebett ist für alle dasselbe
      // Bett, es prüft jedes hundertste
      const wrong: string[] = [];
      const [bx, by] = world.homes.eis.bed;
      for (const [n, [x, y]] of snowy.entries()) {
        if (startRealm(world, ['eis'], [x, y]) !== 'eis') wrong.push(`${x},${y}: nicht im Kessel`); // bleibt im Kessel
        let s = initialState(world, { position: [x, y], openGates: ['eis'] });
        if (s.player.x !== bx || s.player.y !== by) wrong.push(`${x},${y}: Start ${s.player.x},${s.player.y}`);
        if (n % 100) continue;
        s = run(s, world, ...Array<typeof TICK>(SLEEP_LOCK).fill(TICK), 'n').s;
        if (s.sleeping) wrong.push(`${x},${y}: schläft noch`);
        if (world.realm(s.player.x, s.player.y) !== 'eis') wrong.push(`${x},${y}: wacht außerhalb des Kessels auf`);
        if (standHeight(world, s.openGates, s.player.x, s.player.y) === null)
          wrong.push(`${x},${y}: wacht unbegehbar auf`);
      }
      expect(wrong).toEqual([]);
    },
  );

  it('gespeicherte Position auf dem Eisberg (Gipfel oder Stufe): Start im Schneebett, kein neues Speicherformat', () => {
    // Der Eisberg kam nach: Eine alte Position kann auf seinen Stufen oder dem Gipfel liegen. Sie ist begehbar, die
    // Figur startet trotzdem wie jede im Kessel im Schneebett und wacht daneben auf
    for (const seed of [1, 42, 2026]) {
      const world = worldOf(seed);
      const [px, py] = bergPeak(world)!;
      for (const p of [
        [px, py],
        [px + 3, py],
      ] as const) {
        expect(world.cell(...p), `Seed ${seed}: ${p.join(',')}`).toMatchObject({ ground: 'ice', region: 'eis' });
        expect(world.cell(...p).h, `Seed ${seed}: ${p.join(',')}`).toBeGreaterThanOrEqual(2);
        expect(standHeight(world, ['eis'], ...p), `Seed ${seed}: begehbar`).not.toBeNull();
        expect(startRealm(world, ['eis'], [...p]), `Seed ${seed}`).toBe('eis');
        let s = initialState(world, { position: [...p], openGates: ['eis'] });
        expect([s.player.x, s.player.y], `Seed ${seed}: ${p.join(',')}`).toEqual([...world.homes.eis.bed]);
        s = run(s, world, ...Array<typeof TICK>(SLEEP_LOCK).fill(TICK), 'n').s;
        expect(world.realm(s.player.x, s.player.y)).toBe('eis');
      }
      expect(world.cell(px, py).h, `Seed ${seed}: Gipfel`).toBe(5);
    }
  });

  it('alter Spielstand hinter dem Felsring, der heute zu keinem Feld des Gletschertals gehört (Umbau): Start im Schneebett', () => {
    // Aus dem Gletscherkessel wurde das Gletschertal (Spielstand Version 5): Eine Position im alten Kessel kann heute
    // neben dem Tal liegen. Sie gehört zum Land hinter dem Eistor, also wacht die Figur im Schneebett auf
    const world = worldOf(1);
    const { mid, out } = world.gates.get('eis')!;
    const along = [out[1], -out[0]] as const;
    const beside: [number, number][] = [];
    for (let t = 10; t < 60; t++)
      for (const u of [-12, 12]) {
        const p: [number, number] = [mid[0] + out[0] * t + along[0] * u, mid[1] + out[1] * t + along[1] * u];
        if (beyondRing(...p) && world.realm(...p) === 'lichtung') beside.push(p);
      }
    expect(beside.length).toBeGreaterThan(10);
    for (const p of beside) {
      const s = initialState(world, { position: p, openGates: ['eis'] });
      expect([s.player.x, s.player.y], p.join()).toEqual([...world.homes.eis.bed]);
      expect(progressOf(s).position).toEqual([...world.homes.eis.bed]); // gespeichert wird von nun an das Bett
      // Tor zu: auf der Lichtung (wie immer); ohne Paket: Position wird gehalten (wie immer)
      const closed = initialState(world, { position: p });
      expect([closed.player.x, closed.player.y]).toEqual([...world.homes.lichtung.bed]);
    }
    const bare = bareOf(1);
    const held = initialState(bare, { position: beside[0]!, openGates: ['eis'] });
    expect([held.player.x, held.player.y]).toEqual([...bare.homes.lichtung.bed]);
    expect(progressOf(held).position).toEqual(beside[0]);
  });

  it('alter Spielstand im Gletscherkessel nahe Spur, Fischkisten oder Plattformen: dort bleibt jedes Feld begehbar', () => {
    // Dort standen Kinder am häufigsten; die Winterlandschaft wächst nur weiter weg, die Felder bleiben, wie sie waren
    const built = new Set(['fishcrate', 'bed', 'icebowl', 'watertrough', 'klangstein', 'igloo']);
    for (const seed of [1, 42, 2026, 7]) {
      const world = worldOf(seed);
      const kessel = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => world.cell(x, y).region === 'eis');
      const marks = kessel.filter(([x, y]) => {
        const c = world.cell(x, y);
        return c.slide || c.portal || c.deco === 'fishcrate';
      });
      const near = kessel.filter(([x, y]) => marks.some(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) <= 2));
      const blocked = near.filter(([x, y]) => {
        const c = world.cell(x, y);
        return c.ground !== 'water' && !built.has(c.deco ?? '') && standHeight(world, ['eis'], x, y) === null;
      });
      expect(near.length, `Seed ${seed}`).toBeGreaterThan(50);
      expect(blocked, `Seed ${seed}`).toEqual([]);
    }
  });

  it('ohne Paket der Eis-Welt (Laden gescheitert): Ein Stand aus dem Kessel startet auf der Lichtung und verliert nichts', () => {
    const full = worldOf(1);
    const bare = bareOf(1);
    const saved = {
      position: [...full.homes.eis.wake[0]!] as [number, number],
      openGates: ['eis' as const],
      garden: [
        { id: 'eis:pinguin', species: 'pinguin' as const },
        { id: 'eis:robbe:2', species: 'robbe' as const },
        { id: 'lichtung:hase', species: 'hase' as const },
      ],
      portals: ['eiskessel' as const, 'eis' as const],
      heard: ['eis-offen' as const, 'bett' as const],
    };
    const s = initialState(bare, saved);
    expect([s.player.x, s.player.y]).toEqual([...bare.homes.lichtung.bed]);
    expect(s.animals.some((a) => a.realm === 'eis')).toBe(false); // ohne Kessel steht kein Eis-Tier irgendwo
    expect(s.animals.find((a) => a.id === 'lichtung:hase')?.mode).toBe('home');
    const kept = progressOf(s);
    expect(kept.garden).toEqual(saved.garden);
    expect(kept.portals).toEqual(saved.portals);
    expect(kept.heard).toEqual(saved.heard);
    expect(kept.openGates).toEqual(['eis']);
    expect(kept.position).toEqual(saved.position); // die Position im Kessel bleibt, auch nach Schritten auf der Lichtung
    let t = s;
    for (let i = 0; i < 40; i++) t = step(t, bare, i % 2 ? { type: 'tick' } : { type: 'move', dir: 's' }).state;
    expect([t.player.x, t.player.y]).not.toEqual([...bare.homes.lichtung.bed]); // die Figur ist unterwegs
    expect(progressOf(t).position).toEqual(saved.position);
    // Mit dem Paket ist beim nächsten Start alles wieder da: Eis-Tiere zu Hause, Start im Kessel
    const again = initialState(full, { ...saved, ...progressOf(t) });
    expect(progressOf(again).position).toEqual([again.player.x, again.player.y]); // mit Paket zählt wieder die Figur
    expect(full.realm(again.player.x, again.player.y)).toBe('eis');
    expect(again.animals.filter((a) => a.realm === 'eis' && a.mode === 'home')).toHaveLength(2);
  });

  it('Eis-Tiere ohne Wohnort (Paket noch nicht da): nie getroffen, nie gezeichnet, nirgends; der Spielstand bleibt', () => {
    const bare = bareOf(1);
    const met = ['eis:robbe:1', 'lichtung:hase'];
    const s = initialState(bare, { met, position: [3, 2] }); // Tor zu, die Figur war auf der Lichtung
    expect(s.animals.some((a) => a.id.startsWith('eis:'))).toBe(false);
    expect(s.held).toBeUndefined(); // eine Position auf der Lichtung braucht kein Paket: Sie wird weiter gespeichert
    let t = s;
    for (let i = 0; i < 60; i++) t = step(t, bare, i % 3 ? { type: 'tick' } : { type: 'move', dir: 'e' }).state;
    expect(t.animals.some((a) => a.id.startsWith('eis:'))).toBe(false);
    expect(t.met.filter((id) => id.startsWith('eis:'))).toEqual(['eis:robbe:1']); // kein Eis-Tier neu getroffen
    expect(progressOf(t).position).toEqual([t.player.x, t.player.y]);
  });

  it('Paket kommt mitten im Spiel an (attachPack): Eis-Tiere ziehen ein, alles andere bleibt, wie es ist', () => {
    const bare = bareOf(1);
    const { world } = bare.attach(PACKS[0]);
    const saved = {
      met: ['lichtung:hase', 'eis:robbe:1'],
      garden: [{ id: 'lichtung:hase', species: 'hase' as const }],
      portals: ['eis' as const],
      heard: ['bett' as const],
    };
    let s = initialState(bare, saved, 7);
    for (let i = 0; i < 30; i++) s = step(s, bare, i % 2 ? { type: 'tick' } : { type: 'move', dir: 's' }).state;
    const before = s;
    const after = attachPack(before, world);
    // Tiere der Lichtung samt Wiese, Portale, Steine, Figur und Zufall unverändert
    const lichtung = (x: State) => x.animals.filter((a) => !a.id.startsWith('eis:'));
    expect(lichtung(after)).toEqual(lichtung(before));
    expect({ ...after, animals: [] }).toEqual({ ...before, animals: [] });
    // Die Eis-Tiere stehen verteilt im Kessel wie beim Öffnen (eigener Zufall aus Seed und Tag, gleich bei gleichem
    // Stand); der verlaufene Pinguin nicht (Tor zu, er ist der Schlüssel)
    const ice = after.animals.filter((a) => a.id.startsWith('eis:'));
    expect(ice).toHaveLength(49);
    const moved = ice.filter((a) => a.x !== world.spawns.get(a.id)![0] || a.y !== world.spawns.get(a.id)![1]);
    expect(moved.length).toBeGreaterThan(35);
    for (const a of ice) {
      expect(world.realm(a.x, a.y), a.id).toBe('eis');
      expect([a.x, a.y], a.id).toEqual([...a.spawn]);
    }
    expect(new Set(ice.map((a) => `${a.x},${a.y}`)).size).toBe(ice.length); // jedes an eigenem Platz
    expect(attachPack(before, world)).toEqual(after);
    expect(ice.some((a) => a.id === 'eis:pinguin')).toBe(false);
    expect(attachPack(after, world)).toEqual(after); // zweimal einbauen ändert nichts
    // Und es geht weiter wie in einer Welt, die gleich mit dem Paket entstand
    let t = after;
    for (let i = 0; i < 40; i++) t = step(t, world, i % 2 ? { type: 'tick' } : { type: 'move', dir: 'n' }).state;
    expect(t.animals.filter((a) => a.id.startsWith('eis:'))).toHaveLength(49);
  });

  it('nach dem Einbau mitten im Spiel speichern und neu laden: gleiches Format, gleicher Stand wie mit Paket gestartet', () => {
    const bare = bareOf(1);
    const { world } = bare.attach(EIS_PACK);
    const saved = { met: ['lichtung:hase'], portals: ['eis' as const], heard: ['bett' as const], day: 3 };
    let s = initialState(bare, saved, 7);
    for (let i = 0; i < 20; i++) s = step(s, bare, i % 2 ? { type: 'tick' } : { type: 'move', dir: 's' }).state;
    const before = progressOf(s);
    s = attachPack(s, world);
    for (let i = 0; i < 20; i++) s = step(s, world, i % 2 ? { type: 'tick' } : { type: 'move', dir: 'w' }).state;
    // Gespeichert wird wie immer (dieselben Felder, kein neues Format), auch durch JSON (localStorage)
    const file = JSON.parse(JSON.stringify(withProgress(newWorld('a', 1, 'Welt'), progressOf(s)))) as SavedWorld;
    expect(migrate(file)).toEqual(file);
    expect(Object.keys(progressOf(s)).sort()).toEqual(Object.keys(before).sort());
    expect(file.position).toEqual([s.player.x, s.player.y]); // gespeichert, wo die Figur war (nichts gehalten)
    // Neu geladen (jetzt gleich mit Paket): derselbe Fortschritt, die Figur erwacht im Bett ihrer Gegend (wie immer),
    // die Eis-Tiere an ihren Orten
    const again = initialState(world, progressFrom(file), 7);
    expect({ ...progressOf(again), position: file.position }).toEqual(progressOf(s));
    expect([again.player.x, again.player.y]).toEqual([...world.homes.lichtung.bed]);
    expect(again.animals.filter((a) => a.id.startsWith('eis:'))).toHaveLength(49);
    // Gleich wie in einer Welt, die von Anfang an mit dem Paket gebaut wurde
    expect(initialState(worldOf(1), progressFrom(file), 7)).toEqual(again);
  });

  it('Paket kommt an, während ein Stand aus dem Kessel gehalten wird: Eis-Tiere zu Hause ziehen ein, gehalten wird nicht mehr', () => {
    const full = worldOf(1);
    const bare = bareOf(1);
    const position = [...full.homes.eis.wake[0]!] as [number, number];
    const garden = [{ id: 'eis:robbe:2', species: 'robbe' as const }];
    const s = initialState(bare, { position, openGates: ['eis'], garden });
    expect(s.held).toEqual(position);
    const { world } = bare.attach(EIS_PACK);
    const t = attachPack(s, world);
    expect(t.held).toBeUndefined();
    expect([t.player.x, t.player.y]).toEqual([s.player.x, s.player.y]); // die Figur bleibt, wo sie ist (am Bett)
    expect(t.animals.find((a) => a.id === 'eis:robbe:2')).toMatchObject({ mode: 'home', realm: 'eis' });
    expect(t.animals.filter((a) => a.realm === 'eis')).toHaveLength(50); // der Pinguin wohnt bei offenem Tor im Kessel
    expect(progressOf(t).position).toEqual([t.player.x, t.player.y]);
  });

  it('Tiere gehören zu ihrer Gegend, Tiere der Landschaft zur Lichtung', () => {
    const world = worldOf(4);
    const s = initialState(world, { garden: [{ id: 'wild:0:2:0', species: 'fuchs' }], openGates: ['eis'] });
    for (const a of s.animals) expect(a.realm, a.id).toBe(a.id.startsWith('eis:') ? 'eis' : 'lichtung');
    expect(s.animals.filter((a) => a.realm === 'eis')).toHaveLength(50);
    expect(s.animals.find((a) => a.id === 'wild:0:2:0')!.realm).toBe('lichtung');
  });

  // Zweite Gegend zum Ausprobieren (die Eis-Welt, hier ganz nah): Alles östlich von x = 20 gehört zu ihr, ihr Bett
  // steht bei (24, 0), ihre Wiese reicht von x = 21 bis 27
  const EIS: RegionId = 'eis';
  const twoRealms = (cells: Record<string, Partial<Cell>> = {}): World => {
    for (let y = -3; y <= 3; y++) for (let x = 21; x <= 27; x++) cells[`${x},${y}`] ??= { garden: true };
    const w = fakeWorld(cells);
    const eis = { ...LICHTUNG, realm: EIS, bed: [24, 0] as const, shelter: { x0: 22, y0: -3, x1: 26, y1: -2 } };
    return { ...w, realm: (x) => (x > 20 ? EIS : 'lichtung'), homes: { ...w.homes, [EIS]: eis } };
  };

  it('liegt die gespeicherte Position hinter einem Tor, das zu ist: Start am Bett der Lichtung', () => {
    const world = twoRealms();
    const regions = [REGIONS[0], { ...REGIONS[0], id: EIS, behind: 'eis' as const }] as const;
    expect(startRealm(world, [], [24, 0], regions)).toBe('lichtung');
    expect(startRealm(world, ['eis'], [24, 0], regions)).toBe(EIS);
    expect(startRealm(world, [], [3, 0], regions)).toBe('lichtung');
  });

  it('ein Tier zieht nur auf der Wiese seiner eigenen Gegend ein', () => {
    const w = twoRealms();
    let s = awake(w, 28, 0, [
      animal('lichtung:hase', 29, 0, { mode: 'follow' }),
      animal('eis:hase', 30, 0, { mode: 'follow', realm: EIS }),
    ]);
    s = { ...s, followers: ['lichtung:hase', 'eis:hase'], player: { ...s.player, dir: 'w' } };
    const r = run(s, w, 'w', 'w', 'w', 'w');
    const homes = r.events.filter((e) => e.type === 'home');
    expect(homes).toEqual([{ type: 'home', id: 'eis:hase', species: 'hase' }]);
    expect(r.s.followers).toEqual(['lichtung:hase']); // der Hase der Lichtung folgt weiter
    expect(r.s.garden).toEqual([{ id: 'eis:hase', species: 'hase' }]);
  });

  it('am Trog freuen sich nur die Tiere der Wiese, auf der er steht (Futter, Fisch und Wasser)', () => {
    const w = twoRealms({
      '-1,0': { deco: 'trough', solid: true, garden: true },
      '1,0': { deco: 'watertrough', solid: true, garden: true },
      '0,-1': { deco: 'icebowl', solid: true, garden: true },
      '28,0': { deco: 'trough', solid: true },
      '29,1': { deco: 'watertrough', solid: true },
      '29,-1': { deco: 'icebowl', solid: true },
    });
    const resident = (id: string, x: number, realm: RegionId) =>
      animal(id, x, 2, { mode: 'home', home: { kind: 'garden' }, realm });
    const herd = [resident('lichtung:hase', 0, 'lichtung'), resident('eis:hase', 24, EIS)];
    const full = (x: number, y: number): State => ({ ...awake(w, x, y, herd), basket: true, bucket: true });
    expect(run(full(0, 0), w, 'w', 'e').events).toEqual([
      { type: 'feed', food: 'berries', ids: ['lichtung:hase'] },
      { type: 'pour', ids: ['lichtung:hase'] },
    ]);
    expect(run(full(29, 0), w, 'w', 's').events).toEqual([
      { type: 'feed', food: 'berries', ids: ['eis:hase'] },
      { type: 'pour', ids: ['eis:hase'] },
    ]);
    // Fisch in die Eisschale: auf der Schneewiese freuen sich nur die Eis-Tiere, auf der Lichtung nur ihre
    const pinguin = { ...resident('eis:pinguin', 25, EIS), species: 'pinguin' as const };
    const fishy = (x: number): State => ({ ...awake(w, x, 0, [...herd, pinguin]), fish: true });
    expect(run(fishy(29), w, 'n').events).toEqual([{ type: 'feed', food: 'fish', ids: ['eis:hase', 'eis:pinguin'] }]);
    expect(run(fishy(0), w, 'n').events).toEqual([{ type: 'feed', food: 'fish', ids: ['lichtung:hase'] }]);
  });
});

describe('Rufen', () => {
  it('ruft, wenn weder Tier noch Bett in der Nähe sind', () => {
    const w = fakeWorld();
    expect(types(run(awake(w, 10, 10), w, ACT).events)).toEqual(['call']);
  });
});

describe('Spielstand', () => {
  it('stellt Gefundene und Tiere im Garten wieder her', () => {
    const world = worldOf(4);
    const met = regionAnimals('lichtung');
    const s = initialState(world, { met, garden: [{ id: 'wild:0:2:0', species: 'fuchs' }] });
    expect(s.met).toEqual([...met].sort());
    const fox = s.animals.find((a) => a.id === 'wild:0:2:0')!;
    expect(fox.mode).toBe('home');
    expect(world.cell(fox.x, fox.y).garden).toBe(true);
    const p = progressOf(s);
    expect(p.met).toEqual(s.met);
    expect(p.garden).toEqual([{ id: 'wild:0:2:0', species: 'fuchs' }]);
  });

  it('ein Tier im Garten taucht nicht zusätzlich in seiner Gegend auf', () => {
    const world = worldOf(4);
    const s = initialState(world, { garden: [{ id: animalId('lichtung', 'hase'), species: 'hase' }] });
    expect(s.animals.filter((a) => a.id === animalId('lichtung', 'hase'))).toHaveLength(1);
  });
});

describe('Randfälle aus der Prüfung', () => {
  it('schläft am Bett, auch wenn ein folgendes Tier direkt hinter der Figur steht', () => {
    const world = worldOf(1);
    const [bx, by] = LICHTUNG.bed;
    let s = awake(world, bx + 1, by, [animal('lichtung:hase', bx + 1, by + 1, { mode: 'follow' })]);
    s = { ...s, followers: ['lichtung:hase'], player: { ...s.player, dir: 'n' } };
    const r = run(s, world, ACT);
    expect(r.s.sleeping).toBe(true);
  });
});

describe('Durchgänge bleiben frei', () => {
  it('umherlaufende Tiere bleiben nie an Toren oder auf Portal-Plattformen und ihren Zugängen stehen', () => {
    const world = worldOf(5);
    // Als Set: 4.000 Takte mal alle Tiere, ein Array-Vergleich je Tier war zu langsam für CI
    const passages = new Set([
      ...platformArea(world.portals),
      ...[...world.gates.values()]
        .flatMap((g) => g.cells)
        .flatMap(([x, y]) => [`${x},${y}`, `${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]),
    ]);
    // Alle Tore offen, Figur weit weg: Die Tiere laufen lange frei umher
    let s: State = {
      ...initialState(world),
      sleeping: false,
      player: { x: 0, y: 30, dir: 's' },
    };
    const blocked: string[] = [];
    for (let i = 0; i < 4000; i++) {
      s = step(s, world, TICK).state;
      // erst sammeln, dann einmal vergleichen: Ein expect je Tier und Takt kostet mehr als der Takt selbst
      for (const a of s.animals)
        if (a.mode === 'wander' && a.home.kind === 'region' && passages.has(`${a.x},${a.y}`))
          blocked.push(`Takt ${i}: ${a.id} ${a.x},${a.y}`);
    }
    expect(blocked).toEqual([]);
  });
});

describe('Portal-Plattformen', () => {
  const world = worldOf(1);
  const lava = world.portals.get('lava')!;
  const [gx, gy] = lava.gate;
  const [hx, hy] = lava.home;
  /** Figur wach an (x, y), Blick nach Osten */
  const at = (x: number, y: number, extra: Partial<State> = {}): State => ({
    ...initialState(world),
    sleeping: false,
    player: { x, y, dir: 'e' },
    animals: [],
    ...extra,
  });
  /** Von Westen her einen Schritt auf (x, y) */
  const go = (s: State, x: number, y: number, explored?: (x: number, y: number) => boolean) => {
    const r = step({ ...s, player: { ...s.player, x: x - 1, y } }, world, { type: 'move', dir: 'e' }, explored);
    return { s: r.state, events: r.events };
  };
  /** Ein freies Feld der Lichtung, `dx`/`dy` Felder neben der Plattformmitte am Tor (auch das Feld links davon frei) */
  const near = (dx: number, dy: number): [number, number] => [gx + dx, gy + dy];

  it('erwacht, sobald die Figur zwei Felder heran ist – auch schräg; das Gegenstück am Bett erwacht mit', () => {
    // drei Felder von der Mitte = zwei Felder vom Rand der Plattform, auch schräg an der Ecke
    for (const [dx, dy] of [
      [3, 3],
      [-3, 2],
      [0, -3],
      [-1, 1],
    ] as const) {
      const r = step(at(...near(dx, dy)), world, TICK);
      expect(r.events, `${dx},${dy}`).toContainEqual({ type: 'portal', id: 'lava' });
      expect(r.state.portals).toEqual(['lava']);
    }
  });

  it('weiter weg schläft sie weiter', () => {
    for (const [dx, dy] of [
      [4, 3],
      [-4, 0],
      [0, 4],
    ] as const)
      expect(step(at(...near(dx, dy)), world, TICK).state.portals).toEqual([]);
  });

  it('beim Herangehen erwacht sie, und die Figur geht ganz normal weiter', () => {
    // von der Lichtung her auf die Plattform zu (dort ist der Platz vor dem Tor frei)
    const { out } = world.gates.get('lava')!;
    const [x4, y4] = [gx - out[0] * 4, gy - out[1] * 4];
    const dir: Dir = out[0] > 0 ? 'e' : out[0] < 0 ? 'w' : out[1] > 0 ? 's' : 'n';
    let r = run(at(x4 - out[0], y4 - out[1]), world, dir);
    expect(r.s.portals).toEqual([]);
    r = run(r.s, world, dir);
    expect(r.events).toEqual([
      { type: 'step', climb: 0 },
      { type: 'portal', id: 'lava' },
    ]);
    expect([r.s.player.x, r.s.player.y]).toEqual([gx - out[0] * 3, gy - out[1] * 3]);
  });

  it('im Nebel erwacht sie nicht; sobald das Feld erkundet ist, im nächsten Takt', () => {
    const r = go(at(0, 0), ...near(3, 0), () => false);
    expect(r.s.portals).toEqual([]);
    const t = step(r.s, world, TICK, () => true);
    expect(t.events).toContainEqual({ type: 'portal', id: 'lava' });
    expect(t.state.portals).toEqual(['lava']);
  });

  it('das Gegenstück am Bett weckt niemand: schlafend ist es ein Sockel, der nichts auslöst', () => {
    let s = at(hx - 3, hy);
    for (let x = hx - 2; x <= hx; x++) {
      const r = go(s, x, hy);
      expect(types(r.events)).toEqual(['step']);
      s = r.s;
    }
    expect([s.player.x, s.player.y, s.portals]).toEqual([hx, hy, []]);
  });

  it('der Rand einer wachen Plattform ist nur Boden; gereist wird erst auf der Mitte', () => {
    let r = go(at(0, 0, { portals: ['lava'] }), gx - 2, gy);
    r = go(r.s, gx - 1, gy); // Rand (Seitenmitte im Westen)
    expect(types(r.events)).toEqual(['step']);
    r = go(r.s, gx, gy); // Mitte
    expect(r.events).toEqual([
      { type: 'step', climb: 0 },
      { type: 'teleport', id: 'lava', to: 'home' },
    ]);
    expect([r.s.player.x, r.s.player.y, r.s.player.dir]).toEqual([hx, hy, 's']);
    expect(r.s.arrived).toEqual([hx, hy]);
  });

  it('auch die Ecken sind begehbar: Man steigt von überall auf, und auf dem Rand passiert nichts', () => {
    const s = at(gx - 2, gy - 1, { portals: ['lava'] });
    const r = step(s, world, { type: 'move', dir: 'e' });
    expect(r.events).toEqual([{ type: 'step', climb: 0 }]);
    expect([r.state.player.x, r.state.player.y]).toEqual([gx - 1, gy - 1]);
    // über die Ecke hinüber auf die Seitenmitte: noch keine Reise
    const r2 = step({ ...r.state, player: { ...r.state.player, dir: 's' } }, world, { type: 'move', dir: 's' });
    expect(types(r2.events)).not.toContain('teleport');
  });

  it('nach der Ankunft erst runter, dann wieder rauf: dann geht es zurück, ohne Sperrzeit', () => {
    let r = go(at(gx - 1, gy, { portals: ['lava'] }), gx, gy);
    expect([r.s.player.x, r.s.player.y]).toEqual([hx, hy]);
    // auf der Mitte angekommen: Ein Schritt auf das Mittelfeld selbst ist unmöglich, Weiterlaufen bringt auf den Rand
    r = go(r.s, hx + 1, hy);
    expect(r.events).toEqual([
      { type: 'step', climb: 0 },
      { type: 'ready', id: 'lava' },
    ]);
    expect(r.s.arrived).toBeNull();
    // gleich wieder zurück auf die Mitte (im selben Takt): reist zurück ans Tor
    const back = step({ ...r.s, player: { ...r.s.player, dir: 'w' } }, world, { type: 'move', dir: 'w' });
    expect(back.events).toEqual([
      { type: 'step', climb: 0 },
      { type: 'teleport', id: 'lava', to: 'gate' },
    ]);
    expect([back.state.player.x, back.state.player.y]).toEqual([gx, gy]);
    expect(back.state.arrived).toEqual([gx, gy]);
  });

  it('wer auf der Mitte steht und nicht angekommen ist (z. B. Spielstand), reist erst beim nächsten Betreten', () => {
    const s = at(gx, gy, { portals: ['lava'] });
    const r = step(s, world, TICK);
    expect(types(r.events)).not.toContain('teleport');
  });

  it('folgende Tiere reisen mit und stehen um die Plattform, nie darauf', () => {
    const followers = ['lichtung:hase', 'lichtung:igel', 'lichtung:schaf'];
    const animals = followers.map((id, i) => animal(id, gx - 2 - i, gy, { mode: 'follow' }));
    const r = go(at(gx - 1, gy, { portals: ['lava'], animals, followers }), gx, gy);
    expect(types(r.events)).toContain('teleport');
    for (const a of r.s.animals) {
      expect(world.cell(a.x, a.y).portal, a.id).toBeUndefined();
      expect(Math.max(Math.abs(a.x - hx), Math.abs(a.y - hy)), a.id).toBeLessThanOrEqual(3);
    }
  });

  it('ein Gast reist mit: Der Pinguin, der auf der Lichtung folgt, kommt durch das Portal der Lichtung mit', () => {
    const pinguin = animal('eis:pinguin', gx - 2, gy, {
      species: 'pinguin',
      mode: 'follow',
      realm: 'eis',
      home: { kind: 'region', region: 'eis' },
    });
    const r = go(at(gx - 1, gy, { portals: ['lava'], animals: [pinguin], followers: ['eis:pinguin'] }), gx, gy);
    expect(r.events).toContainEqual({ type: 'teleport', id: 'lava', to: 'home' });
    const p = r.s.animals[0]!;
    expect([r.s.followers, p.mode]).toEqual([['eis:pinguin'], 'follow']);
    expect(Math.max(Math.abs(p.x - hx), Math.abs(p.y - hy))).toBeLessThanOrEqual(3);
  });

  it('Platztausch mit einem folgenden Tier auf die Mitte ist auch ein Betreten', () => {
    const hase = animal('lichtung:hase', gx, gy, { mode: 'follow' });
    const r = step(at(gx - 1, gy, { portals: ['lava'], animals: [hase], followers: ['lichtung:hase'] }), world, {
      type: 'move',
      dir: 'e',
    });
    expect(r.events).toContainEqual({ type: 'teleport', id: 'lava', to: 'home' });
  });

  it('Schlafen vergisst die Ankunft', () => {
    const r = go(at(gx - 1, gy, { portals: ['lava'] }), gx, gy);
    const s = { ...r.s, wokeAt: -100, player: { x: LICHTUNG.bed[0] + 1, y: LICHTUNG.bed[1], dir: 'w' as const } };
    const slept = step(s, world, { type: 'move', dir: 'w' }).state;
    expect([slept.sleeping, slept.arrived]).toEqual([true, null]);
  });

  it('wache Plattformen kommen mit dem Spielstand wieder (Format wie bisher); Unbekanntes fällt weg', () => {
    const s = initialState(world, { portals: ['lava', 'westtor' as never] });
    expect(s.portals).toEqual(['lava']);
    expect(s.arrived).toBeNull();
    expect(progressOf(s).portals).toEqual(['lava']);
    expect(progressOf(s)).not.toHaveProperty('arrived');
  });
});

describe('Eis-Portal (Eis-Welt)', () => {
  const world = worldOf(1);
  const ice = world.portals.get('eiskessel')!;
  const [gx, gy] = ice.gate;
  const [hx, hy] = ice.home;
  const bed = world.homes.eis.bed;
  /** Figur wach an (x, y) im Gletscherkessel, Eistor offen, Blick nach Osten */
  const at = (x: number, y: number, extra: Partial<State> = {}): State => ({
    ...initialState(world),
    sleeping: false,
    player: { x, y, dir: 'e' },
    animals: [],
    openGates: ['eis'],
    ...extra,
  });
  const cheb = (a: readonly number[], b: readonly number[]) =>
    Math.max(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!));

  it('beide Plattformen stehen in der Eis-Welt, am Bett gehört es zum Schneebett', () => {
    expect([world.realm(gx, gy), world.realm(hx, hy)]).toEqual(['eis', 'eis']);
    expect(ice.bed).toEqual(bed);
  });

  it('Eis-Portal schläft bis zur ersten Ankunft am Schneebett, dann erwachen beide', () => {
    // an der Plattform hinter der Mündung und an ihrem Gegenstück erwacht nichts, drei Felder vor dem Bett auch nicht
    for (const p of [ice.gate, [gx + 3, gy], [gx, gy + 2], ice.home, [bed[0] + 3, bed[1]]] as const)
      expect(step(at(p[0], p[1]), world, TICK).state.portals, p.join(',')).toEqual([]);
    // zwei Felder vor dem Schneebett (auch schräg): Es ist angekommen, beide Plattformen erwachen
    for (const [dx, dy] of [
      [2, 0],
      [-2, 2],
      [0, 1],
    ] as const) {
      const r = step(at(bed[0] + dx, bed[1] + dy), world, TICK);
      expect(r.events, `${dx},${dy}`).toContainEqual({ type: 'portal', id: 'eiskessel' });
      expect(r.state.portals).toEqual(['eiskessel']);
      expect(step(r.state, world, TICK).events.map((e) => e.type)).not.toContain('portal'); // nur einmal
    }
    // im Schlaf nicht, im Nebel nicht
    expect(step(at(bed[0] + 1, bed[1], { sleeping: true }), world, TICK).state.portals).toEqual([]);
    expect(step(at(bed[0] + 1, bed[1]), world, TICK, () => false).state.portals).toEqual([]);
    // mit dem Laufen dorthin: der Schritt, der zwei Felder heran ist, weckt es
    const walk = run(
      at(bed[0] + 4, bed[1] + 1, { player: { x: bed[0] + 4, y: bed[1] + 1, dir: 'w' } }),
      world,
      'w',
      'w',
    );
    expect(walk.events).toEqual([
      { type: 'step', climb: 0 },
      { type: 'step', climb: 0 },
      { type: 'portal', id: 'eiskessel' },
    ]);
  });

  it('Reisen nur innerhalb der Eis-Welt, folgende Tiere derselben Welt reisen mit', () => {
    const pinguin = animal('eis:pinguin', gx - 2, gy, {
      species: 'pinguin',
      mode: 'follow',
      realm: 'eis',
      home: { kind: 'region', region: 'eis' },
    });
    const robbe = animal('eis:robbe', gx - 3, gy, {
      species: 'robbe',
      mode: 'follow',
      realm: 'eis',
      home: { kind: 'region', region: 'eis' },
    });
    const s = at(gx - 1, gy, {
      portals: ['eiskessel'],
      animals: [pinguin, robbe],
      followers: ['eis:pinguin', 'eis:robbe'],
    });
    const r = run(s, world, 'e'); // auf die Mitte hinter der Mündung
    expect(r.events).toContainEqual({ type: 'teleport', id: 'eiskessel', to: 'home' });
    expect([r.s.player.x, r.s.player.y]).toEqual([hx, hy]); // im Kreis um das Schneebett, nicht auf der Lichtung
    expect(r.s.followers).toEqual(['eis:pinguin', 'eis:robbe']);
    for (const p of r.s.animals) {
      expect(world.cell(p.x, p.y).portal, p.id).toBeUndefined();
      expect(cheb([p.x, p.y], [hx, hy]), p.id).toBeLessThanOrEqual(3);
      expect(world.realm(p.x, p.y), p.id).toBe('eis');
    }
    // erst runter, dann wieder rauf: zurück hinter die Mündung, nie auf die Lichtung
    const off = run(r.s, world, 'e');
    const back = run({ ...off.s, player: { ...off.s.player, dir: 'w' } }, world, 'w');
    expect(back.events).toContainEqual({ type: 'teleport', id: 'eiskessel', to: 'gate' });
    expect([back.s.player.x, back.s.player.y]).toEqual([gx, gy]);
  });
});

describe('Klangsteine', () => {
  const withStone = () => fakeWorld({ '1,0': { deco: 'klangstein', solid: true, story: 'bett' } });

  it('Hineinlaufen lässt die Geschichte erklingen, beim ersten Mal als neu; die Figur bleibt stehen', () => {
    const w = withStone();
    let r = run(awake(w, 0, 0), w, 'e');
    expect(r.events).toEqual([{ type: 'story', id: 'bett', first: true }]);
    expect([r.s.player.x, r.s.heard]).toEqual([0, ['bett']]);
    r = run(r.s, w, 'e'); // noch einmal: hält die Geschichte an (das macht die Ansicht), ist aber nicht mehr neu
    expect(r.events).toEqual([{ type: 'story', id: 'bett', first: false }]);
  });

  it('die Aktionstaste vor dem Stein geht genauso', () => {
    const w = withStone();
    const s = awake(w, 0, 0);
    const r = run({ ...s, player: { ...s.player, dir: 'e' } }, w, ACT);
    expect(types(r.events)).toEqual(['story']);
  });

  it('Tiere in der Nähe drehen sich zur Figur und bleiben stehen, als hörten sie zu', () => {
    const w = withStone();
    const r = run(awake(w, 0, 0, [animal('a', 0, 2, { rest: 1 }), animal('b', 0, 9, { rest: 1 })]), w, 'e');
    expect(r.s.animals.map((a) => [a.dir, a.rest >= 30])).toEqual([
      ['n', true],
      ['s', false],
    ]);
  });

  it('der Stein vor dem Eistor erzählt die erste Fassung der Eis-Geschichte, ist das Tor offen, die zweite', () => {
    const w = fakeWorld({ '1,0': { deco: 'klangstein', solid: true, story: 'eis' } });
    expect(run(awake(w, 0, 0), w, 'e').events).toEqual([{ type: 'story', id: 'eis', first: true }]);
    const open = { ...awake(w, 0, 0), openGates: ['eis' as const] };
    const r = run(open, w, 'e');
    expect(r.events).toEqual([{ type: 'story', id: 'eis-offen', first: true }]);
    expect(r.s.heard).toEqual(['eis-offen']);
  });

  it('die Note am Stein vor dem Eistor gilt als gehört, wenn das Kind die Fassung kennt, die er jetzt erzählt', () => {
    expect(heardStone({ heard: ['eis-offen'], openGates: ['eis'] }, 'eis')).toBe(true);
    expect(heardStone({ heard: ['eis'], openGates: ['eis'] }, 'eis')).toBe(false); // neuer Text: Note wieder neu
    expect(heardStone({ heard: ['eis'], openGates: [] }, 'eis')).toBe(true);
    expect(heardStone({ heard: ['eis-offen'], openGates: [] }, 'bett')).toBe(false);
  });

  it('gehörte Geschichten kommen mit dem Spielstand wieder, unbekannte fallen weg', () => {
    const world = worldOf(1);
    const s = initialState(world, { heard: ['eis', 'bett'] });
    expect(s.heard).toEqual(['eis', 'bett']);
    expect(progressOf(s).heard).toEqual(['eis', 'bett']);
  });
});

describe('Weltgrenze am Tor', () => {
  const world = worldOf(1);
  const gate = world.gates.get('eis')!;
  const crossing = crossings(world)[0]!;
  const seats = (side: RegionId) => crossing.seats.get(side)!;
  const inward = dirTo(...gate.out); // durchs Eistor zum Gletscherkessel
  const outward = dirTo(-gate.out[0], -gate.out[1]);
  /** Feld auf der Achse des Tors: k > 0 in der Bucht davor, 0 in der Torreihe, k < 0 im Gang dahinter */
  const axis = (k: number): [number, number] => [gate.mid[0] - gate.out[0] * k, gate.mid[1] - gate.out[1] * k];
  /** Letztes Feld des Gangs auf der Achse (die Mündung); eins weiter beginnt der Boden des Kessels */
  let mouth = 0;
  while (crossing.cells.has(axis(mouth - 1).join(','))) mouth--;
  const follower = (id: string, [x, y]: [number, number], realm: RegionId = 'lichtung') =>
    animal(id, x, y, { mode: 'follow', realm, home: { kind: 'region', region: realm } });
  const ice = (id: string, at: [number, number]) => ({ ...follower(id, at, 'eis'), species: 'pinguin' as const });
  /** Figur mit Blick in `dir` auf (x, y), dahinter die Kette (Eistor offen) */
  function chain(at: [number, number], dir: Dir, animals: Animal[]): State {
    const s = awake(world, ...at, animals);
    return { ...s, openGates: ['eis'], followers: animals.map((a) => a.id), player: { ...s.player, dir } };
  }
  /** Vor dem Eistor: Hase, Pinguin, Fuchs und ein Tier der Landschaft folgen der Figur */
  const beforeGate = () =>
    chain(axis(1), inward, [
      follower('lichtung:hase', axis(2)),
      ice('eis:pinguin', axis(3)),
      { ...follower('lichtung:fuchs', axis(4)), species: 'fuchs' },
      { ...follower('wild:0:0:0', axis(5)), home: { kind: 'wild', cx: 0, cy: 0 } },
    ]);
  const byId = (s: State, id: string) => s.animals.find((a) => a.id === id)!;

  it('Tiere der Lichtung setzen sich am ersten Torfeld in die Bucht, auch die hinteren; Eis-Tiere folgen weiter', () => {
    let r = run(beforeGate(), world, inward); // in die Torreihe
    expect([r.s.player.x, r.s.player.y]).toEqual(axis(0));
    expect(r.events.filter((e) => e.type === 'wait')).toEqual([
      { type: 'wait', id: 'lichtung:hase', species: 'hase' },
      { type: 'wait', id: 'lichtung:fuchs', species: 'fuchs' },
      { type: 'wait', id: 'wild:0:0:0', species: 'hase' },
    ]);
    expect(r.s.followers).toEqual(['eis:pinguin']);
    // feste Warteplätze nebeneinander, der nächste zuerst; jedes schaut zur Figur
    const waiting = ['lichtung:hase', 'lichtung:fuchs', 'wild:0:0:0'];
    for (const [i, id] of waiting.entries()) {
      const a = byId(r.s, id);
      expect([a.mode, [a.x, a.y]], id).toEqual(['wait', seats('lichtung')[i]]);
      expect(a.dir, id).toBe(dirTo(r.s.player.x - a.x, r.s.player.y - a.y));
    }
    r = run(r.s, world, inward); // der Pinguin rückt auf
    expect([byId(r.s, 'eis:pinguin').x, byId(r.s, 'eis:pinguin').y]).toEqual(axis(0));
    // Sie bleiben auf ihren Plätzen, ohne Ablauf nach Zeit
    for (let i = 0; i < 600; i++) r = run(r.s, world, TICK);
    for (const [i, id] of waiting.entries())
      expect([byId(r.s, id).mode, [byId(r.s, id).x, byId(r.s, id).y]], id).toEqual(['wait', seats('lichtung')[i]]);
  });

  it('eine lange Kette: nach den festen Warteplätzen das nächste freie Feld daneben, jedes Tier auf eigenem Feld', () => {
    const long = Array.from({ length: SEATS + 4 }, (_, i) => follower(`lichtung:hase:${i}`, axis(i + 2)));
    const r = run(chain(axis(1), inward, long), world, inward);
    expect(types(r.events).filter((t) => t === 'wait')).toHaveLength(SEATS + 4);
    expect(r.s.followers).toEqual([]);
    const at = r.s.animals.map((a) => [a.x, a.y] as [number, number]);
    expect(at.slice(0, SEATS)).toEqual(seats('lichtung'));
    expect(new Set(at.map((p) => p.join(','))).size).toBe(at.length);
    for (const [x, y] of at.slice(SEATS)) {
      expect([world.realm(x, y), crossing.cells.has(`${x},${y}`)]).toEqual(['lichtung', false]);
      expect(Math.abs((x - gate.mid[0]) * gate.out[1] - (y - gate.mid[1]) * gate.out[0])).toBeGreaterThan(2); // neben dem Weg
      // gleiche Bedingungen wie die festen Plätze: nicht neben dem Klangstein, höchstens 12 Felder vom Tor
      expect([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => world.cell(x + dx, y + dy).story))).toBe(false);
      expect(crossing.fits('lichtung', [x, y])).toBe(true);
    }
  });

  it('in Gegenrichtung genauso: Eis-Tiere setzen sich vor der Gangmündung in den Kessel, Tiere der Lichtung folgen weiter', () => {
    const r = run(
      chain(axis(mouth - 1), outward, [
        ice('eis:pinguin', axis(mouth - 2)),
        follower('lichtung:hase', axis(mouth - 3)),
        { ...ice('eis:robbe', axis(mouth - 4)), species: 'robbe' },
      ]),
      world,
      outward, // in die Mündung
    );
    expect(types(r.events).filter((t) => t === 'wait')).toHaveLength(2);
    expect(r.s.followers).toEqual(['lichtung:hase']);
    for (const [i, id] of ['eis:pinguin', 'eis:robbe'].entries()) {
      const a = byId(r.s, id);
      expect([a.mode, [a.x, a.y]], id).toEqual(['wait', seats('eis')[i]]);
      expect(world.realm(a.x, a.y)).toBe('eis');
    }
  });

  it('die Gegend wechselt genau an der Gangmitte: je Richtung ein Ereignis, im Gang flackert nichts', () => {
    let s = chain(axis(1), inward, []);
    const realms: { at: number; to: string }[] = [];
    for (let k = 0; k >= mouth - 1; k--) {
      const r = run(s, world, inward);
      s = r.s;
      for (const e of r.events) if (e.type === 'realm') realms.push({ at: k, to: e.to });
    }
    for (let k = mouth; k <= 1; k++) {
      const r = run(s, world, outward);
      s = r.s;
      for (const e of r.events) if (e.type === 'realm') realms.push({ at: k, to: e.to });
    }
    const middle = Array.from({ length: 1 - mouth }, (_, i) => -i).find((k) => world.realm(...axis(k)) === 'eis')!;
    expect(realms).toEqual([
      { at: middle, to: 'eis' },
      { at: middle + 1, to: 'lichtung' },
    ]);
  });

  it('Warten und Wiederfolgen: Erst auf ihrer Seite außerhalb des Tors reihen sich die Wartenden hüpfend wieder ein', () => {
    let r = run(beforeGate(), world, inward, inward, inward); // durchs Tor in den Gang
    // zurück in die Torreihe (erst Platztausch mit dem Pinguin): noch im Durchgang, sie warten weiter, keiner setzt sich neu
    r = run(r.s, world, outward, outward);
    expect(types(r.events)).not.toContain('rejoin');
    expect(types(r.events)).not.toContain('wait');
    expect([r.s.player.x, r.s.player.y]).toEqual(axis(0));
    r = run(r.s, world, outward); // in die Bucht
    expect(r.events.filter((e) => e.type === 'rejoin').map((e) => (e as { id: string }).id)).toEqual([
      'lichtung:hase',
      'lichtung:fuchs',
      'wild:0:0:0',
    ]);
    expect(r.s.followers).toEqual(['eis:pinguin', 'lichtung:hase', 'lichtung:fuchs', 'wild:0:0:0']);
    for (const id of r.s.followers) expect(byId(r.s, id).mode, id).toBe('follow');
  });

  it('beim Schlafen gehen Wartende heim wie folgende Tiere', () => {
    let s = run(beforeGate(), world, inward).s;
    const [bx, by] = world.homes.lichtung.bed;
    s = { ...s, player: { x: bx + 1, y: by, dir: 'w' } }; // gleich am Bett
    s = run(s, world, ACT).s;
    expect(s.sleeping).toBe(true);
    expect(s.animals.some((a) => a.mode === 'wait')).toBe(false);
    expect(byId(s, 'lichtung:hase').mode).toBe('wander');
    expect(s.animals.find((a) => a.id === 'wild:0:0:0')).toBeUndefined(); // Tiere der Landschaft tauchen später auf
  });

  it('ein Tier zieht nur auf der Wiese seiner eigenen Gegend ein (Schneewiese im Gletscherkessel)', () => {
    const home = world.homes.eis;
    const [bx, by] = home.bed;
    // Eine Richtung, in der man vom Rand der Schneewiese geradeaus auf sie läuft
    const dir = (['n', 'e', 's', 'w'] as Dir[]).find((d) => {
      const [dx, dy] = DIRECTIONS[d];
      return [2, 3, 4, 5, 6, 7, 8, 9, 10].every((k) => standHeight(world, ['eis'], bx + dx * k, by + dy * k) !== null);
    })!;
    const [dx, dy] = DIRECTIONS[dir];
    const at = (k: number): [number, number] => [bx + dx * k, by + dy * k];
    let s = chain(at(7), dirTo(-dx, -dy), [follower('lichtung:hase', at(8)), ice('eis:pinguin', at(9))]);
    const r = run(s, world, dirTo(-dx, -dy), dirTo(-dx, -dy), dirTo(-dx, -dy));
    s = r.s;
    expect(r.events.filter((e) => e.type === 'home')).toEqual([
      { type: 'home', id: 'eis:pinguin', species: 'pinguin' },
    ]);
    expect(s.followers).toEqual(['lichtung:hase']);
  });
});
