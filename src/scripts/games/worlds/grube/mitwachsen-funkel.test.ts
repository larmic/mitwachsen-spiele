// Das Grubenbähnchen Funkel (Rückmeldung zur Höhle, Schritt 15): Eintrag in `RIDES`, was das Paket der Grubenbahn in die
// Grotte legt (`layGrube`), seine Strecke als Schleife (`funkelRoute`) über die Seeds und eine ganze Runde über `step`
// mit den Paketen wie im Spiel
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import type { RideEvent } from '../../mitwachsen-pack-types';
import type { RideRoute } from '../../mitwachsen-rider';
import { loopOk, parked, stopsOf } from '../../mitwachsen-ride-kit';
import { ridden, withRidden } from '../../mitwachsen-ride-save';
import { initialState, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import { canStep, createWorld, type World } from '../../mitwachsen-world';
import { DUG, FAHRT_PACK, GRUBE_PACK, HOEHLE_PACK, reachable, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { FUNKEL, SEAT, dug, funkel, funkelExit, funkelRoute } from './mitwachsen-funkel';
import { pack } from './index';

const keyOf = ([x, y]: readonly [number, number]) => `${x},${y}`;
const RULES = [GRUBE_PACK, FAHRT_PACK];
const TICK: Cmd = { type: 'tick' };

describe('Grubenbähnchen Funkel', () => {
  it('Eintrag: eine Schleife in der Höhlenwelt, ohne Halt auf der Lichtung und ohne Wimpel, Petrol, Signal D5 → A5', () => {
    expect(FUNKEL).toEqual({
      id: 'grube',
      gate: 'hoehle',
      ticks: [150, 200],
      pace: 0.8,
      signal: [587.33, 880],
      color: '#2f8f83',
      loop: true,
    });
    expect(RIDES.map((r) => r.id)).toEqual(['schlitten', 'hoehle', 'grube']);
    expect(funkel.spec).toBe(FUNKEL);
    expect('ready' in funkel).toBe(false); // es erscheint nie von selbst: der Maulwurf gräbt den Gang
    expect('needs' in funkel).toBe(false); // es braucht nur seine eigene Welt
    expect(pack.rules?.vehicle).toBe(funkel);
    expect(pack.gate).toBeUndefined(); // keine eigene Welt hinter einem Tor
    expect('build' in pack).toBe(false);
  });

  it('vor dem Graben legt das Paket nichts: Die Grotte bleibt Feld für Feld, wie sie ohne Paket ist, Funkel hat keine Strecke', () => {
    const plain = worldOf(1, [HOEHLE_PACK]);
    const w = worldOf(1, [HOEHLE_PACK, GRUBE_PACK]);
    const [bx, by] = plain.homes.hoehle.bed;
    const diff: string[] = [];
    for (let y = by - 40; y <= by + 40; y++)
      for (let x = bx - 40; x <= bx + 40; x++)
        if (JSON.stringify(plain.cell(x, y)) !== JSON.stringify(w.cell(x, y))) diff.push(keyOf([x, y]));
    expect(diff).toEqual([]);
    expect(dug({})).toBe(false);
    expect(dug(DUG)).toBe(true);
    expect(funkelRoute(w, { packs: {} })).toBeUndefined();
    expect(funkelRoute(w, { packs: DUG })).toBeUndefined(); // gebaut ohne gegrabenen Gang: kein Gleis
    expect(funkelRoute(worldOf(1, [HOEHLE_PACK]), { packs: DUG })).toBeUndefined(); // ohne das Paket kein Gleis
  });

  it('kommt das Paket vor dem Graben mit der Grotte an, baut es die Welt nicht neu (`lays`); erst `relay` legt das Gleis', () => {
    let calls = 0;
    const counted = {
      ...GRUBE_PACK,
      lay: (l: Parameters<NonNullable<typeof GRUBE_PACK.lay>>[0]) => (calls++, GRUBE_PACK.lay!(l)),
    };
    const base = createWorld(3, [HOEHLE_PACK]);
    const { world: w, chunks } = base.attach(counted);
    expect(calls).toBe(0);
    expect(chunks).toEqual([]);
    expect(w.homes).toBe(base.homes); // dieselbe gebaute Welt
    expect(w.attach(counted).chunks).toEqual([]); // schon dabei
    expect(funkelRoute(w, { packs: DUG })).toBeUndefined();
    const next = w.relay(DUG); // der Gang ist gegraben: Jetzt legt das Paket
    expect(calls).toBe(1);
    expect(next.chunks.length).toBeGreaterThan(0);
    expect(funkelRoute(next.world, { packs: DUG })?.loop).toBe(true);
    expect(funkelRoute(base.relay(DUG).world, { packs: DUG })).toBeUndefined(); // ohne das Paket kein Gleis
  });

  type Bad = (m: string) => unknown;

  /** Form der Runde: geschlossen, Länge und Dauer, Schritte zum Nachbarfeld, Gleis mit seinen Richtungen */
  function shapeOf(w: World, r: RideRoute, bad: Bad) {
    const len = r.path.length - 1;
    if (!loopOk(r)) bad('loopOk');
    if (len < 150 || len > 175) bad(`Länge ${len}`);
    // Dauer wie in der Fahr-Engine (`rideTicks`, ein anderes Paket): Länge / Tempo, in `ticks` gehalten
    const t = Math.min(FUNKEL.ticks[1], Math.max(FUNKEL.ticks[0], Math.round(len / FUNKEL.pace!)));
    if (len / t > 0.85) bad(`Fahrt ${t} Takte`);
    if (new Set(r.path.slice(1).map(keyOf)).size !== len) bad('ein Feld doppelt');
    // jedes Feld der Runde: Gleis der Grubenbahn mit zwei Richtungen zu den Nachbarn in der Runde
    r.path.slice(0, -1).forEach((p, i) => {
      const [prev, next] = [r.path[(i + len - 1) % len]!, r.path[i + 1]!];
      if (Math.abs(p[0] - next[0]) + Math.abs(p[1] - next[1]) !== 1) bad(`Schritt ${i} nicht zum Nachbarfeld`);
      const dirs = (Object.entries(DIRS) as [Dir, readonly [number, number]][])
        .filter(([, [dx, dy]]) => [prev, next].some((q) => q[0] === p[0] + dx && q[1] === p[1] + dy))
        .map(([d]) => d)
        .sort()
        .join('');
      const c = w.cell(...p);
      if (c.ride !== 'grube' || [...(c.lane?.to ?? '')].sort().join('') !== dirs) bad(`Gleis bei ${keyOf(p)}`);
    });
  }

  /** Halt: Lok, Sitz, hinterer Wagen auf dem Gleis des Halts, neben dem Bahnsteig; Warteplätze und Aussteigen dort */
  function haltOf(w: World, r: RideRoute, bad: Bad): Point[] {
    const at = stopsOf(r).home;
    const halt = [r.path[0]!, r.path[1]!, r.path.at(-2)!];
    if (at.board.size !== 3 || ![...at.board].every((k) => halt.some((p) => keyOf(p) === k))) bad('Wagen am Halt');
    if (w.cell(...r.path.at(-2)!).lane?.at !== SEAT - 1) bad('hinterer Wagen nicht auf dem Halt');
    if (r.seats.home.length < 6 || r.seats.home.some((p) => w.cell(...p).stop !== 'grube')) bad('Warteplätze');
    const exits = funkelExit(w, { packs: DUG });
    if (!exits.length || exits.some(([x, y]) => Math.hypot(x - at.seat[0], y - at.seat[1]) > 2.5)) bad('Aussteigen');
    return exits;
  }

  /** Zu Fuß: nie in den Gang, aber an den Bahnsteig; Enden des Gangs und Zaun fest, Gang sonst gegraben */
  function feetOf(w: World, r: RideRoute, exits: readonly Point[], bad: Bad) {
    const [hx, hy] = w.homes.hoehle.bed; // das Bett ist fest: von einem freien Nachbarfeld aus
    const start = Object.values(DIRS)
      .map(([dx, dy]): Point => [hx + dx, hy + dy])
      .find((p) => !w.cell(...p).solid)!;
    const feet = new Set(reachable(w, [], start, 20000).map(keyOf));
    const gang = r.path.filter((p) => w.cell(...p).lane?.part === 'gang');
    if (gang.some((p) => feet.has(keyOf(p)))) bad('Gang zu Fuß erreichbar');
    if (!exits.some((p) => feet.has(keyOf(p)))) bad('Bahnsteig zu Fuß nicht erreichbar');
    const ends = [gang[0], gang.at(-1)].filter((p) => p !== undefined);
    if (ends.length !== 2 || ends.some((p) => !w.cell(...p).solid)) bad('Enden des Gangs nicht fest');
    if (gang.slice(1, -1).some((p) => w.cell(...p).solid || w.cell(...p).h !== 1)) bad('Gang nicht gegraben');
    for (let y = hy - 90; y <= hy + 90; y++)
      for (let x = hx - 90; x <= hx + 90; x++) {
        const c = w.cell(x, y);
        if (c.lane?.part === 'fence' && (c.deco !== 'crystalbush' || !c.solid)) bad(`Zaun bei ${x},${y}`);
        if (c.lane?.part === 'side' && feet.has(keyOf([x, y]))) bad(`Nachbar des Gangs zu Fuß bei ${x},${y}`);
      }
  }

  /**
   * Tiere: Umherlaufende queren das Gleis nie (die Fahr-Engine sperrt es); jeder Wohnplatz der Grotte ist vom Bett aus
   * erreichbar, ohne auf das Gleis zu treten, also keiner in dem, was die Schleife einschließt
   */
  function pawsOf(w: World, bad: Bad) {
    const [hx, hy] = w.homes.hoehle.bed;
    const start = Object.values(DIRS)
      .map(([dx, dy]): Point => [hx + dx, hy + dy])
      .find((p) => !w.cell(...p).solid)!;
    const seen = new Set([keyOf(start)]);
    const queue: Point[] = [start];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      for (const [dx, dy] of Object.values(DIRS)) {
        const [nx, ny] = [x + dx, y + dy];
        const k = keyOf([nx, ny]);
        if (seen.has(k) || w.realm(nx, ny) !== 'hoehle' || w.cell(nx, ny).ride === 'grube') continue;
        if (!canStep(w, [], x, y, nx, ny)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    const trapped = w.spotsOf('hoehle').filter((p) => !seen.has(keyOf(p)));
    if (trapped.length) bad(`${trapped.length} Wohnplätze nur über das Gleis, etwa ${keyOf(trapped[0]!)}`);
  }

  /** Was an der Strecke und den Feldern eines Seeds nicht stimmt */
  function problems(seed: number): string[] {
    const w = worldOf(seed, [HOEHLE_PACK, GRUBE_PACK], DUG);
    const r = funkelRoute(w, { packs: DUG });
    if (!r) return [`Seed ${seed}: keine Strecke`];
    const out: string[] = [];
    const bad = (m: string) => out.push(`Seed ${seed}: ${m}`);
    shapeOf(w, r, bad);
    feetOf(w, r, haltOf(w, r, bad), bad);
    pawsOf(w, bad);
    return out;
  }

  it('Strecke über die Seeds: geschlossene Runde vom Sitz zum Sitz, 15–20 s, Gleis mit Richtungen, Halt am Bahnsteig, Gang nur für Züge, kein Wohnplatz in der Schleife', () => {
    expect(seedsFor(seedRange(1, 20)).flatMap(problems)).toEqual([]);
  });

  /** Wach, ohne Tiere, die Figur auf dem Bahnsteig neben dem Sitz, mit der Richtung zu ihm */
  function ready(world: World): { s: State; dir: Dir } {
    const r = funkelRoute(world, { packs: DUG })!;
    const seat = r.stops.home;
    const [at, dir] = (Object.entries(DIRS) as [Dir, readonly [number, number]][])
      .map(([d, [dx, dy]]): [Point, Dir] => [[seat[0] - dx, seat[1] - dy], d])
      .find(([p]) => world.cell(...p).stop === 'grube')!;
    const s = initialState(world, { packs: DUG });
    return { s: { ...s, sleeping: false, wokeAt: -100, player: { x: at[0], y: at[1], dir }, animals: [] }, dir };
  }

  it('eine Runde wie bei jedem Fahrzeug: einsteigen, immer vorwärts herum, am selben Halt auf den Bahnsteig aussteigen; danach kein Gold mehr', () => {
    const world = worldOf(1, [HOEHLE_PACK, GRUBE_PACK], DUG);
    const r = funkelRoute(world, { packs: DUG })!;
    const { s: s0, dir } = ready(world);
    const events: GameEvent[] = [];
    let s = s0;
    const play = (c: Cmd) => {
      const out = step(s, world, c, undefined, undefined, RULES);
      s = out.state;
      events.push(...out.events);
    };
    play({ type: 'move', dir, fresh: true });
    expect(s.ride).toMatchObject({ id: 'grube', to: 'home', feast: false });
    const seen: number[] = [];
    let goAt = -1;
    let arriveAt = -1;
    for (let i = 0; i < 400 && s.ride; i++) {
      play(TICK);
      if (s.ride?.phase === 'go' && goAt < 0) goAt = s.tick;
      if (s.ride?.phase === 'arrive' && arriveAt < 0) arriveAt = s.tick;
      if (s.ride) seen.push(s.ride.pos);
    }
    expect(s.ride).toBeUndefined();
    const what = events.filter((e): e is RideEvent => e.type === 'ride').map((e) => e.what);
    expect(what.filter((x) => ['board', 'go', 'arrive', 'alight'].includes(x))).toEqual([
      'board',
      'go',
      'arrive',
      'alight',
    ]);
    expect(what).not.toContain('feast');
    expect(what).not.toContain('tunnel'); // kein „Uh-uh“ auf der Runde
    expect(seen.every((p, i) => i === 0 || p >= seen[i - 1]!)).toBe(true); // immer vorwärts
    expect(arriveAt - goAt).toBeGreaterThanOrEqual(150);
    expect(arriveAt - goAt).toBeLessThanOrEqual(201);
    // ausgestiegen auf den Bahnsteig neben dem Sitz, die erste Fahrt gemerkt (gespeichert)
    expect(world.cell(s.player.x, s.player.y).stop).toBe('grube');
    expect(Math.hypot(s.player.x - r.stops.home[0], s.player.y - r.stops.home[1])).toBeLessThan(2.5);
    expect(ridden(s.packs, 'grube')).toBe(true);
    expect(events.some((e) => e.type === 'ride' && e.what === 'alight' && e.persist)).toBe(true);
    expect(withRidden(s.packs, 'grube')).toBe(s.packs);
  });

  it('steht am Halt, solange die Figur in der Grotte ist; sperrt den Halt für Tiere, die Strecke für umherlaufende', () => {
    const world = worldOf(1, [HOEHLE_PACK, GRUBE_PACK], DUG);
    const r = funkelRoute(world, { packs: DUG })!;
    const { s } = ready(world);
    expect(parked(FUNKEL, r, s, world)?.seat).toEqual(r.stops.home);
    const away = { ...s, player: { ...s.player, x: world.homes.lichtung.bed[0], y: world.homes.lichtung.bed[1] } };
    expect(parked(FUNKEL, r, away, world)).toBeUndefined();
    const engine = FAHRT_PACK.rules!.ride!([funkel]);
    const walker = { id: 'x', species: 'maulwurf', x: 0, y: 0, dir: 's', mode: 'wander' } as State['animals'][number];
    const mid = r.path[40]!;
    expect(engine.blocks(s, world, walker, ...r.stops.home)).toBe(true);
    expect(engine.blocks(s, world, walker, ...mid)).toBe(true);
    expect(engine.blocks(s, world, { ...walker, mode: 'follow' }, ...mid)).toBe(false);
    expect(engine.blocks({ ...s, packs: {} }, world, walker, ...r.stops.home)).toBe(false); // vor dem Graben nichts
  });
});
