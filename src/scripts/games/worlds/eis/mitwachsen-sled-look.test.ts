// Aussehen und Klang des Schlittens: Körper je Stufe, Gleiten und Sprünge, Marken am Boden, Töne und Freude
import { describe, expect, it } from 'vitest';
import { LOOK, REGIONS, SPECIES, regionAnimalList, type Point } from '../../../../data/games/mitwachsen';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import type { Ride, RideEvent } from '../../mitwachsen-pack-types';
import type { RideAt, RideBody } from '../../mitwachsen-ride-view';
import type { Box } from '../../mitwachsen-view';
import { initialState, step, type GameEvent, type State } from '../../mitwachsen-state';
import { createWorld } from '../../mitwachsen-world';
import { EIS_PACK, FAHRT_PACK, worldOf } from '../../test-worlds';
import { COME, DUE, stopsOf, trotFrom } from '../../mitwachsen-ride-kit';
import { withRide, type RideStage } from '../../mitwachsen-ride-save';
import { sled } from './mitwachsen-sled';
import {
  DOOR_U,
  JUMP,
  OPEN_TICKS,
  SLED_ID,
  jingle,
  narrow,
  rideFx,
  rideScores,
  sledBodies,
  sledMarks,
} from './mitwachsen-sled-look';
import { sledRoute, trackAt } from './mitwachsen-sled-route';
import { view } from './view-2d';

const world = worldOf(1, [EIS_PACK]);
const r = sledRoute(world)!;
const len = r.path.length - 1;
const HOME = stopsOf(r).home;
const OUT = stopsOf(r).out;
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const LAMP = '#ffc94a';
const keyOf = ([x, y]: Point) => `${x},${y}`;
const xy = (b: RideBody | undefined): Point => [b!.x, b!.y];

/** Wach, Eistor offen, die Figur auf `p` (sonst am Schneebett); `stage`: so weit ist der Schlitten */
function at(p: Point = world.homes.eis.bed, stage?: RideStage, more: Partial<State> = {}): State {
  const s = initialState(world, { openGates: ['eis'] });
  const packs = stage ? withRide(s.packs, 'schlitten', stage) : s.packs;
  return { ...s, sleeping: false, player: { x: p[0], y: p[1], dir: 's' }, packs, ...more };
}
const ride = (more: Partial<Ride>): Ride => ({
  id: 'schlitten',
  phase: 'go',
  at: 0,
  pos: 0,
  speed: 0.5,
  to: 'out',
  feast: false,
  jingleAt: 0,
  greeted: [],
  ...more,
});
const bodies = (s: State, a: Partial<RideAt> = {}) => sledBodies(s, world, { ...AT, ...a });
const part = (b: readonly RideBody[], id: string) => b.find((x) => x.id === id);
const colors = (b: RideBody | undefined) => new Set(b!.parts.flatMap((p) => [p[6], p[7]]));

describe('Aussehen des Schlittens (mitwachsen-sled-look.ts)', () => {
  it('kommt mit dem Paket: Fahrzeug über `rules.vehicle` (Regeln aus der Fahr-Engine), Bild über die Haken der Ansicht', () => {
    expect(EIS_PACK.rules!.vehicle).toBe(sled);
    expect(view).toMatchObject({ bodies: sledBodies, marks: sledMarks });
    const e: RideEvent = { type: 'ride', what: 'board', id: 'schlitten', x: 0, y: 0 };
    expect(view.rideFx!(e, at())).toEqual(rideFx(e, at()));
    expect(view.rideFx!({ ...e, id: 'hoehle' }, at())).toBeUndefined(); // der Zug antwortet selbst
  });

  it('Körper je Stufe: noch nichts, dann Schuppen, Schlitten mit goldenem Rahmen und Rentier; danach mit Wimpel', () => {
    expect(bodies(at())).toEqual([]); // noch nicht erschienen
    expect(sledBodies(at(undefined, 'fest'), createWorld(1, []), AT)).toEqual([]); // ohne Paket keine Strecke
    const ready = bodies(at(undefined, 'bereit'));
    expect(ready.map((b) => b.id)).toEqual([`${SLED_ID}:schuppen`, SLED_ID, `${SLED_ID}:rentier`]);
    expect(xy(part(ready, SLED_ID))).toEqual(HOME.seat);
    expect(xy(part(ready, `${SLED_ID}:rentier`))).toEqual(HOME.pull);
    expect(part(ready, SLED_ID)!.dir).toBe(part(ready, `${SLED_ID}:rentier`)!.dir); // das Rentier zieht vorn
    expect(colors(part(ready, SLED_ID)).has(GOLD.top)).toBe(true); // goldener Rahmen bis zur ersten Fahrt
    expect(colors(part(ready, SLED_ID)).has(RIDES[0].color)).toBe(true); // Himmelblau
    // der Schuppen steht in der Mitte seiner Felder, die Tür zum Halt
    const shed = part(ready, `${SLED_ID}:schuppen`)!;
    const cells = new Set(r.shed.map(keyOf));
    expect(cells.has(keyOf([Math.round(shed.x - 0.5 + 1e-9), Math.round(shed.y - 0.5 + 1e-9)]))).toBe(true);
    const fest = bodies(at(undefined, 'fest'));
    expect(colors(part(fest, SLED_ID)).has(GOLD.top)).toBe(false);
    expect(part(fest, SLED_ID)!.parts.length).toBeGreaterThan(part(ready, SLED_ID)!.parts.length - 3); // Wimpel
    expect(part(fest, SLED_ID)!.key).not.toBe(part(ready, SLED_ID)!.key);
    // am Abend: Laterne am Schlitten, die am Schuppen brennt
    const lit = bodies(at(undefined, 'fest'), { lit: true });
    expect(colors(part(lit, SLED_ID)).has(LAMP)).toBe(true);
    expect(colors(part(fest, SLED_ID)).has(LAMP)).toBe(false);
    expect(colors(part(lit, `${SLED_ID}:schuppen`)).has(LAMP)).toBe(true);
  });

  it('schläft er (die Fahr-Engine fehlt noch, Vorladen), kein goldener Rahmen; sonst derselbe Schlitten', () => {
    const ready = at(undefined, 'bereit');
    const sleepy = part(bodies({ ...ready, dozing: ['schlitten'] }), SLED_ID);
    expect(colors(sleepy).has(GOLD.top)).toBe(false);
    expect(colors(sleepy).has(RIDES[0].color)).toBe(true);
    expect(xy(sleepy)).toEqual(HOME.seat);
    // der schlafende Zug zählt nicht für den Schlitten
    expect(colors(part(bodies({ ...ready, dozing: ['hoehle'] }), SLED_ID)).has(GOLD.top)).toBe(true);
  });

  it('steht am Halt der Gegend der Figur: auf der Lichtung erst nach der ersten Heimfahrt (der Schuppen bleibt im Kessel)', () => {
    const lichtung = world.homes.lichtung.bed;
    expect(bodies(at(lichtung, 'bereit')).map((b) => b.id)).toEqual([`${SLED_ID}:schuppen`]);
    const out = bodies(at(lichtung, 'fest'));
    expect(xy(part(out, SLED_ID))).toEqual(OUT.seat);
    expect(xy(part(out, `${SLED_ID}:rentier`))).toEqual(OUT.pull);
  });

  it('feste Schlüssel mit wenigen Varianten, je Schlüssel dieselben Teile (die 3D-Ansicht baut jede Form einmal)', () => {
    const seen = new Map<string, RideBody['parts']>();
    const states = (['bereit', 'fest'] as const).flatMap((stage) => [
      at(undefined, stage),
      at(undefined, stage, { tick: 50, rideDue: 48 }), // angestoßen: offen
      at(HOME.seat, stage, { ride: ride({ pos: 7 }) }),
    ]);
    const all = states.flatMap((s) => [...bodies(s), ...bodies(s, { lit: true })]);
    for (const b of all) if (!seen.has(b.key)) seen.set(b.key, b.parts);
    expect(all.filter((b) => seen.get(b.key) !== b.parts)).toEqual([]);
    expect(seen.size).toBeLessThanOrEqual(12 + 2 + 1); // Schlitten, Schuppen, Rentier
    expect([...seen.keys()].every((k) => k.startsWith('ride:'))).toBe(true);
  });

  it('das Schlittenrentier ist kein Tier: weder in der Leiste noch unter den Tieren, auch nicht nach dem Erscheinen', () => {
    const ice = REGIONS.find((g) => g.id === 'eis')!;
    const garden = regionAnimalList(ice)
      .filter((a) => a.n === 1)
      .map(({ id, species }) => ({ id, species }));
    let s: State = { ...at(undefined, undefined, { garden }), wokeAt: -100 };
    s = { ...s, animals: s.animals.filter((a) => a.x !== s.player.x || a.y !== s.player.y) };
    const ids = s.animals.map((a) => a.id).sort();
    const events: GameEvent[] = [];
    for (let i = 0; i < DUE + COME + 2; i++) {
      const n = step(s, world, { type: 'tick' }, undefined, undefined, [EIS_PACK, FAHRT_PACK]);
      s = n.state;
      events.push(...n.events);
    }
    expect(events.some((e) => e.type === 'ride' && e.what === 'appear')).toBe(true);
    expect(s.animals.map((a) => a.id).sort()).toEqual(ids);
    expect([...s.met, ...s.garden.map((g) => g.id)].some((id) => id.startsWith('ride:'))).toBe(false);
    expect(bodies(s).every((b) => !ids.includes(b.id))).toBe(true);
    expect(Object.keys(SPECIES)).not.toContain(`${SLED_ID}:rentier`);
  });

  it('angestoßen geht die Tür einladend auf: 1 s lang offene Seitenwände, in 2D und 3D derselbe Körper', () => {
    const nudged = (since: number) =>
      part(bodies(at(undefined, 'bereit', { tick: 100, rideDue: 100 - since })), SLED_ID)!;
    const shut = part(bodies(at(undefined, 'bereit', { rideDue: -1 })), SLED_ID)!;
    expect(nudged(0).key).not.toBe(shut.key);
    expect(nudged(0).parts).not.toEqual(shut.parts);
    expect(nudged(OPEN_TICKS - 1).key).toBe(nudged(0).key);
    expect(nudged(OPEN_TICKS).key).toBe(shut.key); // nach 1 s wieder zu
    expect(nudged(-5).key).toBe(shut.key); // trabt noch herbei: zu
    const riding = part(bodies(at(HOME.seat, 'bereit', { tick: 100, rideDue: 100, ride: ride({ pos: 3 }) })), SLED_ID)!;
    expect(riding.key.endsWith('0')).toBe(true); // während der Fahrt nie offen
  });

  it('herbeitraben: gerade erschienen, kommt er aus den Tannen; bei reduzierter Bewegung steht er gleich am Halt', () => {
    const s = at(undefined, 'bereit', { tick: 100, rideDue: 100 + COME });
    const from = trotFrom(r, world, HOME.seat);
    const start = xy(part(bodies(s, { frac: 0 }), SLED_ID));
    expect(start).toEqual(from);
    const half = xy(part(bodies({ ...s, tick: 100 + COME / 2 }, { frac: 0 }), SLED_ID));
    expect(half[0]).toBeCloseTo((from[0] + HOME.seat[0]) / 2);
    expect(half[1]).toBeCloseTo((from[1] + HOME.seat[1]) / 2);
    expect(xy(part(bodies({ ...s, tick: 100 + COME }), SLED_ID))).toEqual(HOME.seat);
    expect(xy(part(bodies(s, { frac: 0, reduced: true }), SLED_ID))).toEqual(HOME.seat);
  });

  it('unterwegs gleitet er zwischen den Takten; die Figur sitzt darin; bei reduzierter Bewegung Sprünge alle 3 Felder', () => {
    const go = at(HOME.seat, 'bereit', { ride: ride({ pos: 10.25, speed: 0.5 }) });
    const b = bodies(go, { frac: 0.5 });
    const seat = part(b, SLED_ID)!;
    expect(seat.seat).toBe(true);
    expect(colors(seat).has(LOOK.skin)).toBe(true); // die Figur sitzt im Schlitten
    expect(xy(seat)).toEqual(r.path[10]); // 10,25 − 0,5 × (1 − 0,5)
    const p = xy(part(bodies(go, { frac: 1 }), SLED_ID));
    const [a, c] = [r.path[10]!, r.path[11]!];
    expect(p[0]).toBeCloseTo(a[0] + (c[0] - a[0]) * 0.25);
    expect(p[1]).toBeCloseTo(a[1] + (c[1] - a[1]) * 0.25);
    expect(xy(part(b, `${SLED_ID}:rentier`))).toEqual(r.path[11]); // ein Feld voraus
    // reduzierte Bewegung: nur auf ganzen Vielfachen von JUMP
    const jumps = new Set<string>();
    for (let pos = 0; pos < len; pos += 0.37) {
      const j = xy(part(bodies({ ...go, ride: ride({ pos }) }, { reduced: true, frac: 0.3 }), SLED_ID));
      jumps.add(keyOf(j));
    }
    const g = world.gates.get('eis')!; // in der Tür rückt er zur Mitte
    const allowed = new Set(
      r.path
        .filter((_, i) => i % JUMP === 0)
        .map(([x, y]) => keyOf(xy({ ...narrow({ x, y, z: 0, dir: 'n' }, g) } as RideBody))),
    );
    expect([...jumps].every((k) => allowed.has(k))).toBe(true);
    // heim rückwärts; angekommen läuft das Rentier ein Stück geradeaus weiter (in den Schuppen bzw. hinter den Halt)
    const back = bodies({ ...go, ride: ride({ to: 'home', pos: 9, phase: 'stop' }) });
    expect(xy(part(back, SLED_ID))).toEqual(r.path[len - 9]);
    const end = bodies({ ...go, ride: ride({ pos: len, phase: 'arrive' }) });
    const [ex, ey] = r.path[len]!;
    const [px, py] = r.path[len - 1]!;
    expect(xy(part(end, `${SLED_ID}:rentier`))).toEqual([2 * ex - px, 2 * ey - py]);
  });

  it('in der Tür rückt er zur Mitte (sonst führe er durch die Torflügel), fern vom Tor nicht', () => {
    const g = world.gates.get('eis')!;
    const u = (p: { x: number; y: number }) => (p.x - g.mid[0]) * g.out[1] - (p.y - g.mid[1]) * g.out[0];
    for (const t of [-1, 0, 1, 2, 3]) {
      const [x, y] = trackAt(g, t);
      expect(u(narrow({ x, y, z: 1, dir: 'n' }, g))).toBeCloseTo(DOOR_U);
    }
    const far = trackAt(g, 8);
    expect(narrow({ x: far[0], y: far[1], z: 1, dir: 'n' }, g)).toMatchObject({ x: far[0], y: far[1] });
    expect(narrow({ x: 3, y: 4, z: 1, dir: 'n' }, undefined)).toMatchObject({ x: 3, y: 4 });
  });

  it('Schneespur: im Kessel ab dem Erscheinen, über die Lichtung ab der ersten Heimfahrt (wachsend), dazu der Fleck', () => {
    expect(sledMarks(at(), world)).toEqual([]);
    expect(sledMarks(at(), world)).toBe(sledMarks(at(), world)); // dieselbe leere Liste: 3D baut nichts neu
    const cellOfBox = (b: Box) => world.cell(Math.floor(b[0] + 0.01), Math.floor(b[1] + 0.01));
    const ready = sledMarks(at(undefined, 'bereit'), world);
    expect(ready.length).toBeGreaterThan(0);
    expect(ready.every((b) => cellOfBox(b).ride)).toBe(true);
    expect(sledMarks(at(undefined, 'bereit'), world)).toBe(ready); // je Stand einmal berechnet
    const fest = sledMarks(at(undefined, 'fest'), world);
    expect(fest.some((b) => !cellOfBox(b).ride)).toBe(true); // auch auf der Lichtung
    const patch = fest.filter((b) => b[3] === 0.92 && b[4] === 0.92);
    expect(patch.length).toBeGreaterThanOrEqual(5); // Schneefleck am Halt
    expect(patch.every((b) => Math.max(Math.abs(b[0] - OUT.seat[0]), Math.abs(b[1] - OUT.seat[1])) <= 1.1)).toBe(true);
    // Festfahrt: Die Spur auf der Lichtung wächst bis zum Schlitten
    const growing = (pos: number) =>
      sledMarks(at(HOME.seat, 'bereit', { ride: ride({ feast: true, pos }) }), world).length;
    expect(growing(0)).toBe(ready.length);
    expect(growing(len - 30)).toBeGreaterThan(growing(0));
    expect(growing(len)).toBeGreaterThan(growing(len - 30));
    expect(growing(len)).toBe(fest.length - patch.length); // ganz, aber noch ohne Fleck (der kommt mit dem Fest)
  });
});

describe('Klang und Freude des Schlittens (mitwachsen-sled-look.ts)', () => {
  const ev = (what: RideEvent['what'], more: Partial<RideEvent> = {}): RideEvent => ({
    type: 'ride',
    what,
    id: 'schlitten',
    x: 3,
    y: 4,
    ...more,
  });
  const ALL: RideEvent['what'][] = [
    'appear',
    'come',
    'snort',
    'nudge',
    'board',
    'leave',
    'go',
    'wave',
    'stop',
    'shoo',
    'arrive',
    'alight',
    'feast',
    'cheer',
    'farewell',
  ];
  const semis = (f: number) => ((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12;
  const PENTA = new Set([0, 2, 4, 7, 9]); // C D E G A

  it('Schellen: D6 und A5 im Wechsel, schnell, über Verzögerungen', () => {
    const j = jingle();
    expect(j.map((n) => n[0])).toEqual([1174.66, 880, 1174.66, 880, 1174.66, 880]);
    expect(j.map((n) => Math.round(n[5] * 100))).toEqual([0, 6, 12, 18, 24, 30]);
    expect(RIDES[0].signal).toEqual([1174.66, 880]);
  });

  it('das Signal liegt in der Pentatonik C–D–E–G–A und klingt anders als jeder Tierruf', () => {
    expect(RIDES[0].signal.every((f) => PENTA.has(semis(f)))).toBe(true);
    const signal = [...RIDES[0].signal].sort().join();
    for (const sp of Object.values(SPECIES)) expect([...sp.tone.notes].sort().join(), sp.id).not.toBe(signal);
  });

  it('je Ereignis höchstens ein Ton sofort (die Grenze von 6 Stimmen bleibt), Melodien in der Pentatonik', () => {
    for (const what of ALL) {
      const notes = rideScores(ev(what, { ring: true }));
      expect(notes.filter((n) => n[5] === 0).length, what).toBeLessThanOrEqual(1);
      const tunes = notes.filter((n) => n[0] > 200); // ohne das tiefe Schnauben
      expect(
        tunes.every((n) => PENTA.has(semis(n[0]))),
        what,
      ).toBe(true);
    }
    // jeder Druck hört etwas: ohne `ring` ein leiser Ton, gebimmelt wird gedrosselt (nur mit `ring`)
    expect(rideScores(ev('wave'))).toHaveLength(1);
    expect(rideScores(ev('wave', { ring: true })).length).toBeGreaterThan(1);
    expect(rideScores(ev('board')).map((n) => n[0])).toEqual([1046.5, 1174.66, 1318.51, 1567.98]); // Abfahrt
    expect(rideScores(ev('feast')).length).toBeGreaterThan(rideScores(ev('board')).length); // Fest
    expect(new Set(rideScores(ev('stop')).map((n) => n[0]))).toEqual(new Set([880])); // freundliches Tuten
    expect(rideScores(ev('snort'))[0]![0]).toBeLessThan(200); // tief
  });

  it('Freude: Herz bei Herbeitraben, Schnauben, Aussteigen und Fest; das Tier am Weg; der Pinguin beim Abschied', () => {
    const s = at(undefined, 'bereit');
    expect(rideFx(ev('come'), s)).toMatchObject({ who: 'player', heart: true });
    expect(rideFx(ev('feast'), s)).toMatchObject({ who: 'player', heart: true });
    expect(rideFx(ev('feast'), s).burst).toHaveLength(3); // Schneeflocken
    // auch ohne `ring` und ohne Hüpfer (reduzierte Bewegung) bekommt jeder Druck eine Antwort: einen Ton
    expect(rideFx(ev('wave'), s)).toMatchObject({ who: 'player' });
    expect(rideFx(ev('wave'), s).score.length).toBeGreaterThan(0);
    expect(rideFx(ev('shoo', { who: 'eis:robbe:1' }), s)).toEqual({ score: [], who: 'eis:robbe:1' });
    expect(rideFx(ev('cheer', { who: 'eis:robbe:1' }), s)).toMatchObject({ who: 'eis:robbe:1', heart: true });
    expect(rideFx(ev('cheer', { who: 'schneemann:3,4' }), s).burst).toHaveLength(3);
    expect(rideFx(ev('cheer', { who: 'schneemann:3,4' }), s).who).toBeUndefined();
    const penguin = { ...s.animals[0]!, id: 'eis:pinguin:1', species: 'pinguin' as const };
    expect(rideFx(ev('farewell'), { ...s, animals: [penguin] })).toMatchObject({ who: penguin.id, heart: true });
    expect(rideFx(ev('farewell'), { ...s, animals: [] }).who).toBeUndefined();
    expect(rideFx(ev('go'), s)).toEqual({ score: jingle() });
  });
});
