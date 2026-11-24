// Tok erscheint (mitwachsen-tok.ts, Spielstand mitwachsen-tok-save.ts, Bild und Ton mitwachsen-tok-look.ts): Boten-Muster
// am Bett der Lichtung, hinter der Freigabe der Bahn-Phase (`BAHN_LIVE`)
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir, type Part } from '../../../../lib/games/front';
import { REGIONS, SPECIES, figureParts, LOOK, regionAnimalList, type Point } from '../../../../data/games/mitwachsen';
import { BAHN_LIVE } from '../../../../data/games/mitwachsen-rides';
import { TOK_COLORS, TOK_MODEL } from '../../../../data/games/worlds/bahn/mitwachsen-tok-model';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { slots } from '../../mitwachsen-album';
import { APPEAR, DUE, NEAR } from '../../mitwachsen-guide';
import type { HeraldEvent } from '../../mitwachsen-herald';
import { silhouette } from '../../mitwachsen-hint-look';
import { bahnWanted } from '../../mitwachsen-pack';
import { dawnOf } from '../../mitwachsen-packs';
import { initialState, progressOf, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import { createWorld, standHeight, type World } from '../../mitwachsen-world';
import { arrowTo } from '../../mitwachsen-map';
import { futureBear } from './mitwachsen-line';
import { BAHN_PACK, EIS_PACK, REGRESSION_SEEDS, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { CALL_EVERY, COME, SIGHT, TOK, TOK_NEAR, postOf, tokWanted } from './mitwachsen-tok';
import { heraldFx, juhu, lacks, pink } from './mitwachsen-tok-look';
import { sledHome, tokOf, wakeTok, withTok } from './mitwachsen-tok-save';

const BAHN = [BAHN_PACK];
const ICE = REGIONS.find((r) => r.id === 'eis')!;
/** Je Eis-Art ein Tier auf der Schneewiese: Die Leiste der Eis-Welt ist voll */
const FULL = regionAnimalList(ICE)
  .filter((a) => a.n === 1)
  .map(({ id, species }) => ({ id, species }));
/** Die erste Heimfahrt mit dem Schlitten ist gemacht */
const SLED_HOME = { fahrt: { schlitten: { stage: 'fest' } } };
const TICK: Cmd = { type: 'tick' };
const WAKE: Cmd = { type: 'move', dir: 's' };
const key = ([x, y]: Point) => `${x},${y}`;
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

type Run = { s: State; events: GameEvent[] };
/** Befehle mit den Regeln des Pakets der Bahn (`packs` false: ohne, wie solange es nicht geladen ist) */
function play(s: State, world: World, cmds: readonly Cmd[], packs = true): Run {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, c, undefined, undefined, packs ? BAHN : []);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
const ticks = (n: number): Cmd[] => Array.from({ length: n }, () => TICK);
const heralds = (e: readonly GameEvent[], what?: HeraldEvent['what']) =>
  e.filter((x): x is HeraldEvent => x.type === 'herald' && (!what || x.what === what));
const tokIn = (s: State) => s.animals.find((a) => a.id === TOK);

/** Stand, in dem Tok kommen kann: Eistor offen, Eis-Leiste voll, erste Heimfahrt gemacht; dazu `over` (Paket-Stand) */
function ready(world: World, over: { garden?: State['garden']; packs?: Record<string, unknown>; open?: boolean } = {}) {
  return initialState(world, {
    openGates: over.open === false ? [] : ['eis'],
    garden: over.garden ?? FULL,
    packs: over.packs ?? SLED_HOME,
  });
}

/** Wach auf dem Feld `p` (sonst auf dem ersten freien Platz zum Aufwachen an der Lichtung) */
function awake(world: World, s: State, p?: Point): State {
  const [x, y] = p ?? world.homes.lichtung.wake[0]!;
  return { ...s, sleeping: false, wokeAt: -100, player: { x, y, dir: 's' } };
}

/** Ein Feld der Lichtung, `d` Felder (Chebyshev) vom Bett, auf dem man stehen kann */
function fieldAt(world: World, d: number): Point {
  const [bx, by] = world.homes.lichtung.bed;
  for (let dx = -d; dx <= d; dx++)
    for (const dy of [-d, d]) {
      const p: Point = [bx + dx, by + dy];
      if (standHeight(world, [], ...p) !== null && world.realm(...p) === 'lichtung') return p;
    }
  throw new Error(`kein Feld ${d} vom Bett`);
}

describe('Tok erscheint: Freigabe der Bahn-Phase', () => {
  it('bis zum Freischalten holt das Spiel das Paket der Bahn nie: Ohne es kommt Tok nicht, auch wenn alles gilt', () => {
    expect(BAHN_LIVE).toBe(false); // Freigabe aus: Erst der Schritt „Freischalten“ setzt sie
    const world = worldOf(1, BAHN);
    const s = ready(world);
    expect(bahnWanted(s)).toBe(false); // Freigabe aus (Voreinstellung)
    expect(bahnWanted(s, true)).toBe(true); // freigeschaltet: mit offenem Eistor
    expect(bahnWanted({ openGates: [] }, true)).toBe(false);
    const without = play(s, world, [WAKE, ...ticks(40)], false);
    expect(tokIn(without.s)).toBeUndefined();
    expect(heralds(without.events)).toEqual([]);
    expect(without.s.packs).toEqual(SLED_HOME); // nichts gespeichert
    const withPack = play(s, world, [WAKE, ...ticks(5)]); // mit dem Paket (freigeschaltet oder Blick hinein)
    expect(tokIn(withPack.s)).toBeDefined();
  });
});

describe('Tok erscheint: wann', () => {
  const world = worldOf(1, BAHN);

  it('nur, wenn noch nichts gebaut ist, das Eistor offen, die Eis-Leiste voll und der Schlitten einmal heimfuhr', () => {
    expect(tokWanted(ready(world))).toBe(true);
    const cases: [string, State][] = [
      ['Ausbau 1', ready(world, { packs: { ...SLED_HOME, bahn: { built: 1 } } })],
      ['Eistor zu', ready(world, { open: false })],
      ['Eis-Leiste nicht voll', ready(world, { garden: FULL.slice(1) })],
      ['Schlitten nur bereit', ready(world, { packs: { fahrt: { schlitten: { stage: 'bereit' } } } })],
      ['ohne Schlitten', ready(world, { packs: {} })],
    ];
    const wrong = cases.filter(([, s]) => tokWanted(s) || tokIn(play(s, world, [WAKE, ...ticks(DUE * 2)]).s));
    expect(wrong.map(([name]) => name)).toEqual([]);
  });

  it('beim Aufwachen im Bett der Lichtung sofort: 4 bis 6 Felder neben der Figur, gespeichert als fällig', () => {
    const r = play(ready(world), world, [WAKE]);
    const t = tokIn(r.s)!;
    expect(t).toBeDefined();
    const d = cheb([t.x, t.y], [r.s.player.x, r.s.player.y]);
    expect(d).toBeGreaterThanOrEqual(APPEAR[0]);
    expect(d).toBeLessThanOrEqual(APPEAR[1]);
    expect(t).toMatchObject({ species: 'tok', mode: 'herald', realm: 'hoehle' });
    expect(heralds(r.events, 'appear')).toEqual([
      { type: 'herald', what: 'appear', id: TOK, x: t.x, y: t.y, persist: true },
    ]);
    expect(tokOf(r.s.packs)).toEqual({ stage: 'faellig' });
    expect(r.s.packs.fahrt).toEqual({ schlitten: { stage: 'fest' }, hoehle: { stage: 'faellig' } }); // Schlitten bleibt
    // wo er steht, wird nie gespeichert
    expect(JSON.stringify(progressOf(r.s))).not.toContain(`${t.x},${t.y}`);
    expect(progressOf(r.s).met).not.toContain(TOK);
  });

  it('auf dem Feld, das dem künftigen Bahnhof Bär am nächsten liegt', () => {
    const r = play(ready(world), world, [WAKE]);
    const t = tokIn(r.s)!;
    const { post, field } = postOf(world)!;
    const far = (p: Point) => Math.hypot(p[0] - post[0], p[1] - post[1]);
    const [px, py] = [r.s.player.x, r.s.player.y];
    let best = Infinity;
    for (let dy = -APPEAR[1]; dy <= APPEAR[1]; dy++)
      for (let dx = -APPEAR[1]; dx <= APPEAR[1]; dx++) {
        const p: Point = [px + dx, py + dy];
        if (Math.max(Math.abs(dx), Math.abs(dy)) < APPEAR[0] || !field.has(key(p))) continue;
        if (world.cell(...p).portal || r.s.animals.some((a) => a.id !== TOK && a.x === p[0] && a.y === p[1])) continue;
        best = Math.min(best, far(p));
      }
    expect(far([t.x, t.y])).toBeCloseTo(best);
  });

  it(`wach am Bett (höchstens ${TOK_NEAR} Felder) ${DUE} Takte nach dem ersten; geht die Figur vorher weg, neu`, () => {
    const near = awake(world, ready(world), fieldAt(world, TOK_NEAR));
    expect(tokIn(play(near, world, ticks(DUE)).s)).toBeUndefined();
    expect(tokIn(play(near, world, ticks(DUE + 1)).s)).toBeDefined();
    // weiter weg: nie
    const far = awake(world, ready(world), fieldAt(world, TOK_NEAR + 1));
    expect(tokIn(play(far, world, ticks(DUE * 3)).s)).toBeUndefined();
    // erst nah, dann vor Ablauf weg und wieder zurück: Die Wartezeit beginnt von vorn
    let r = play(near, world, ticks(DUE - 5));
    r = play({ ...r.s, player: { ...far.player } }, world, ticks(3));
    r = play({ ...r.s, player: { ...near.player } }, world, ticks(DUE));
    expect(tokIn(r.s)).toBeUndefined();
    expect(tokIn(play(r.s, world, ticks(1)).s)).toBeDefined();
  });

  it('nicht in einer anderen Gegend und nie zweimal', () => {
    const r = play(ready(world), world, [WAKE, ...ticks(DUE * 3)]);
    expect(r.s.animals.filter((a) => a.id === TOK)).toHaveLength(1);
    expect(heralds(r.events, 'appear')).toHaveLength(1);
  });
});

describe('Tok erscheint: ankommen und warten', () => {
  // ganze Welten: je Seed eine Welt vor Ausbau 1, im tiefen Lauf 20 (test:deep bleibt unter seiner Frist)
  it.each(seedsFor(seedRange(1, 20)))(
    'Seed %i: hüpft zur Figur (Herz), dann an seinen Platz am künftigen Bahnsteig von Bahnhof Bär',
    (seed) => {
      const world = worldOf(seed, BAHN);
      let r = play(ready(world), world, [WAKE]);
      expect(tokIn(r.s), `Seed ${seed}`).toBeDefined();
      r = play(r.s, world, ticks(COME + 1));
      expect(heralds(r.events, 'arrive'), `Seed ${seed}`).toHaveLength(1);
      const { post } = postOf(world)!;
      // sein Platz liegt am künftigen Bahnsteig (gerechnet auf der Kopie der Karte, frisch gebaut über `worldOf`)
      expect(futureBear(seed)?.platform.map(key), `Seed ${seed}`).toContain(key(post));
      // ein Feld je `PACE.lead` Takte: höchstens 120 Takte, bis er dort steht
      for (let i = 0; i < 12 && key([tokIn(r.s)!.x, tokIn(r.s)!.y]) !== key(post); i++) r = play(r.s, world, ticks(10));
      const t = tokIn(r.s)!;
      expect([t.x, t.y], `Seed ${seed}`).toEqual([...post]);
    },
  );

  it('an seinem Platz ruft er, solange die Figur ihn sieht, höchstens alle 4 s', () => {
    const world = worldOf(1, BAHN);
    const r = play(ready(world), world, [WAKE, ...ticks(COME + 121)]);
    const t = tokIn(r.s)!;
    expect([t.x, t.y]).toEqual([...postOf(world)!.post]);
    expect(cheb([t.x, t.y], [r.s.player.x, r.s.player.y])).toBeLessThanOrEqual(SIGHT);
    const watch = play(r.s, world, ticks(CALL_EVERY * 3 + 5));
    const at = watch.events.flatMap((e, i) => (e.type === 'herald' && e.what === 'call' ? [i] : []));
    expect(at.length).toBeGreaterThanOrEqual(2);
    expect(at.length).toBeLessThanOrEqual(4);
  });

  // je Seed zwei ganze Welten (vor und mit Ausbau 1), darum nur wenige Seeds, auch im tiefen Lauf: Beide rechnen mit
  // derselben Suche auf derselben Karte; wo Ausbau 1 Bahnhof Bär auf jeder Lichtung legt, prüft mitwachsen-line.test.ts
  // über die vollen Seeds
  it.each([SAMPLE_SEEDS[0]!, ...REGRESSION_SEEDS])(
    'Seed %i: Bahnhof Bär, den Tok erwartet, ist der, den Ausbau 1 legt (auf einer Kopie gerechnet, die Lichtung bleibt)',
    (seed) => {
      const before = createWorld(seed, BAHN); // frisch gebaut: Das Paket merkt sich die Karte vor Ausbau 1
      const station = futureBear(seed)?.platform ?? [];
      const built = createWorld(seed, BAHN, { bahn: { built: 1 } }); // nicht über worldOf: bleibt nicht im Speicher
      const faults = station.filter((p) => built.cell(...p).stop !== 'hoehle' || before.cell(...p).stop).map(key);
      const post = postOf(before)?.post;
      if (!station.length || !post || !station.some((p) => key(p) === key(post))) faults.push('Platz');
      expect(faults, `Seed ${seed}`).toEqual([]);
    },
  );

  it('nachts sitzt er neben dem Bett, morgens ruft er', () => {
    const world = worldOf(1, BAHN);
    let r = play(ready(world), world, [WAKE, ...ticks(150)]);
    const bed = world.homes.lichtung.bed;
    // zurück ins Bett laufen: Schlafen
    const s = { ...r.s, player: { ...r.s.player, x: bed[0], y: bed[1] + 1 }, wokeAt: -100 };
    r = play(s, world, [{ type: 'move', dir: 'n' }]);
    expect(r.s.sleeping).toBe(true);
    const t = tokIn(r.s)!;
    expect(cheb([t.x, t.y], bed)).toBeLessThanOrEqual(2);
    expect(t.nap).toBeUndefined(); // er schläft nicht, er wartet
    r = play(r.s, world, [...ticks(40), WAKE]);
    expect(heralds(r.events, 'call')).toHaveLength(1);
  });
});

const evening = (s: State): State => ({ ...s, late: true });

describe('Tok erscheint: am Abend schlafend', () => {
  const world = worldOf(7, BAHN);

  it('kommt schon schlafend und liegt neben dem Bett (gespeichert: schlaeft), ohne Ruf', () => {
    const r = play(evening(ready(world)), world, [WAKE]);
    const t = tokIn(r.s)!;
    expect(t.nap).toBe(true);
    expect(cheb([t.x, t.y], world.homes.lichtung.bed)).toBeLessThanOrEqual(2);
    expect(world.homes.lichtung.wake.map(key)).not.toContain(key([t.x, t.y]));
    expect(heralds(r.events).map((e) => e.what)).toEqual(['nap']);
    expect(tokOf(r.s.packs)).toEqual({ stage: 'faellig', schlaeft: true });
  });

  it('Schlafen im Spiel weckt ihn nicht; er bleibt liegen und schnarcht, wenn man in ihn hineinläuft', () => {
    let r = play(evening(ready(world)), world, [WAKE]);
    const t = tokIn(r.s)!;
    const bed = world.homes.lichtung.bed;
    r = play({ ...r.s, player: { ...r.s.player, x: bed[0], y: bed[1] + 1 }, wokeAt: -100 }, world, [
      { type: 'move', dir: 'n' },
      ...ticks(40),
      WAKE,
      ...ticks(DUE * 2),
    ]);
    expect(tokIn(r.s)).toMatchObject({ x: t.x, y: t.y, nap: true });
    expect(heralds(r.events).filter((e) => e.what !== 'snore')).toEqual([]);
    // in ihn hineinlaufen: Er schnarcht leise, die Figur bleibt stehen, nichts singt
    const [dir, [dx, dy]] = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(([, [dx, dy]]) => {
      const p: Point = [t.x - dx, t.y - dy];
      return standHeight(world, [], ...p) !== null && !r.s.animals.some((a) => a.x === p[0] && a.y === p[1]);
    })!;
    const before = { ...r.s, player: { x: t.x - dx, y: t.y - dy, dir: 's' as Dir }, wokeAt: -100 };
    const bump = play(before, world, [{ type: 'move', dir }]);
    expect(heralds(bump.events, 'snore')).toHaveLength(1);
    expect(bump.events.some((e) => e.type === 'sing')).toBe(false);
    expect([bump.s.player.x, bump.s.player.y]).toEqual([before.player.x, before.player.y]);
  });

  it('nach dem Laden liegt er wieder neben dem Bett; am nächsten echten Spieltag wacht er auf und ruft', () => {
    const saved = withTok(SLED_HOME, { stage: 'faellig', schlaeft: true });
    let r = play(ready(world, { packs: saved }), world, [WAKE]);
    expect(tokIn(r.s)?.nap).toBe(true);
    expect(heralds(r.events)).toEqual([]); // still: Er lag schon da
    // ein neuer echter Spieltag (`WorldPack.dawn`, mitwachsen-tired.ts `newDay`)
    const packs = dawnOf([BAHN_PACK], r.s.packs);
    expect(tokOf(packs)).toEqual({ stage: 'faellig' });
    r = play({ ...r.s, packs }, world, [TICK]);
    expect(tokIn(r.s)?.nap).toBeUndefined();
    expect(heralds(r.events, 'wake')).toHaveLength(1);
    // dann geht er an seinen Platz
    r = play(r.s, world, ticks(200));
    expect(tokIn(r.s)).toMatchObject({ x: postOf(world)!.post[0], y: postOf(world)!.post[1] });
  });

  it('wer ihn wach angetroffen hat: In den wachen Tok gelaufen, singt und hüpft er (getroffen)', () => {
    let r = play(ready(world), world, [WAKE, ...ticks(200)]);
    const t = tokIn(r.s)!;
    const [dir, [dx, dy]] = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(([, [dx, dy]]) => {
      const p: Point = [t.x - dx, t.y - dy];
      return standHeight(world, [], ...p) !== null && !r.s.animals.some((a) => a.x === p[0] && a.y === p[1]);
    })!;
    r = play({ ...r.s, player: { x: t.x - dx, y: t.y - dy, dir: 's' } }, world, [{ type: 'move', dir }]);
    expect(r.events.filter((e) => e.type === 'sing')).toEqual([{ type: 'sing', id: TOK, species: 'tok', first: true }]);
    expect(r.s.met).toContain(TOK);
    expect(tokIn(r.s)).toMatchObject({ x: t.x, y: t.y }); // er bleibt an seinem Platz
  });
});

describe('Tok erscheint: nach dem Laden und anderswo', () => {
  const world = worldOf(1, BAHN);
  const FAELLIG = withTok(SLED_HOME, { stage: 'faellig' });

  it('kam er schon, steht er nach dem Laden gleich an seinem Platz, ohne Auftauchen, auch fern vom Bett', () => {
    const far = awake(world, ready(world, { packs: FAELLIG }), fieldAt(world, TOK_NEAR + 3));
    const r = play(far, world, [TICK]);
    expect(tokIn(r.s)).toMatchObject({ x: postOf(world)!.post[0], y: postOf(world)!.post[1] });
    expect(heralds(r.events)).toEqual([]);
    expect(r.s.packs).toEqual(FAELLIG); // nichts Neues gespeichert
    expect(slots(r.s, 'lichtung').at(-1)![0]).toMatchObject({ species: 'tok', guest: 'hoehle' }); // Gast-Platz gleich da
  });

  it('nach dem Laden schläft die Figur: Er wartet wach neben dem Bett, morgens ruft er einmal und geht an seinen Platz', () => {
    // so auch am ersten Start nach langer Pause: `dawn` hat `schlaeft` schon vor dem Bau der Welt gestrichen
    const start = ready(world, {
      packs: dawnOf([BAHN_PACK], withTok(SLED_HOME, { stage: 'faellig', schlaeft: true })),
    });
    let r = play(start, world, [TICK]);
    const t = tokIn(r.s)!;
    expect(t.nap).toBeUndefined();
    expect(cheb([t.x, t.y], world.homes.lichtung.bed)).toBeLessThanOrEqual(2);
    r = play(r.s, world, [WAKE]);
    expect(heralds(r.events).map((e) => e.what)).toEqual(['call']);
    r = play(r.s, world, ticks(200));
    expect(tokIn(r.s)).toMatchObject({ x: postOf(world)!.post[0], y: postOf(world)!.post[1] });
    expect(heralds(r.events, 'appear')).toEqual([]);
  });

  it('wacht die Figur im Bett der Eis-Welt auf, ruft er nicht (sie sieht ihn nicht); der Pfeil zeigt nach Hause', () => {
    const both = worldOf(1, [EIS_PACK, BAHN_PACK]);
    const [x, y] = both.homes.eis.bed;
    const s = { ...ready(both, { packs: FAELLIG }), player: { x, y, dir: 's' as Dir } };
    let r = play(s, both, [TICK, WAKE, ...ticks(CALL_EVERY * 3)]);
    expect(tokIn(r.s)).toBeDefined();
    expect(r.s.sleeping).toBe(false);
    expect(heralds(r.events)).toEqual([]);
    // in der Eis-Welt zeigt der Pfeil der Karte zum Schneebett, nicht zu Tok auf der Lichtung
    expect(arrowTo(r.s, both)).toEqual(both.homes.eis.bed);
    // ebenso der neue Spieltag, während die Figur in der Eis-Welt ist: Er wacht still auf
    const napping = { ...r.s, animals: r.s.animals.map((a) => (a.id === TOK ? { ...a, nap: true as const } : a)) };
    r = play(napping, both, [TICK]);
    expect(tokIn(r.s)?.nap).toBeUndefined();
    expect(heralds(r.events)).toEqual([]);
  });

  it('der Pfeil der Karte zeigt auf der Lichtung zum wachen Tok, zum schlafenden nicht', () => {
    let r = play(ready(world), world, [WAKE, ...ticks(200)]);
    const t = tokIn(r.s)!;
    expect(arrowTo(r.s, world)).toEqual([t.x, t.y]);
    r = play(evening(ready(world)), world, [WAKE]);
    expect(tokIn(r.s)?.nap).toBe(true);
    expect(arrowTo(r.s, world)).toEqual(world.homes.lichtung.bed);
  });
});

describe('Tok: Spielstand', () => {
  it('liest nur gültige Einträge, lässt andere Fahrzeuge und Pakete stehen', () => {
    expect(tokOf({})).toBeUndefined();
    expect(tokOf({ fahrt: 'kaputt' })).toBeUndefined();
    expect(tokOf({ fahrt: { hoehle: { stage: 'irgendwas' } } })).toBeUndefined();
    expect(tokOf({ fahrt: { hoehle: { stage: 'faellig', schlaeft: 'ja' } } })).toEqual({ stage: 'faellig' });
    expect(tokOf({ fahrt: { hoehle: { stage: 'bereit' } } })).toEqual({ stage: 'bereit' }); // ein späterer Stand bleibt
    const packs = { eis: { a: 1 }, fahrt: { schlitten: { stage: 'fest' }, boot: { stage: 'bereit' } } };
    expect(withTok(packs, { stage: 'faellig', schlaeft: true })).toEqual({
      eis: { a: 1 },
      fahrt: { schlitten: { stage: 'fest' }, boot: { stage: 'bereit' }, hoehle: { stage: 'faellig', schlaeft: true } },
    });
    expect(packs.fahrt).not.toHaveProperty('hoehle'); // unverändert
  });

  it('der Schlitten hat heimgebracht: nur bei Stufe fest', () => {
    expect(sledHome(SLED_HOME)).toBe(true);
    expect(sledHome({ fahrt: { schlitten: { stage: 'bereit' } } })).toBe(false);
    expect(sledHome({})).toBe(false);
  });

  it('ein neuer echter Spieltag weckt nur, was schläft', () => {
    const asleep = withTok(SLED_HOME, { stage: 'faellig', schlaeft: true });
    expect(wakeTok(asleep)).toEqual(withTok(SLED_HOME, { stage: 'faellig' }));
    expect(wakeTok(SLED_HOME)).toEqual(SLED_HOME);
    expect(BAHN_PACK).toHaveProperty('dawn', wakeTok);
  });
});

describe('Tok: Bild, Ton, Leiste, Hinweis', () => {
  it('Modell nach dem Konzept: gut drei Viertel der Figur, Helm rot mit Lampe, kein Gold', () => {
    const top = (parts: readonly Part[]) => Math.max(...parts.map((p) => p[2] + p[5]));
    const helmet = TOK_MODEL.filter(
      (p) => p[6] !== TOK_COLORS.mole && p[6] !== TOK_COLORS.pink && p[6] !== TOK_COLORS.glass,
    );
    const ratio = top(helmet) / top(figureParts(LOOK));
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.85);
    const colors = new Set(TOK_MODEL.flatMap((p) => [p[6], p[7]]));
    for (const c of [TOK_COLORS.helm, TOK_COLORS.lamp, TOK_COLORS.shirt, TOK_COLORS.overall, TOK_COLORS.mole])
      expect(colors).toContain(c);
    expect(colors.has(GOLD.side) || colors.has(GOLD.top)).toBe(false);
    expect(BAHN_PACK.models?.tok).toBe(TOK_MODEL);
    expect(silhouette(TOK_MODEL).join('')).toContain('o'); // „noch nicht“ kann seinen Umriss zeigen
    expect(SPECIES.tok).toMatchObject({ name: 'Tok', gait: 'huepfen' });
  });

  it('Töne in der C-Pentatonik: Ju-hu E4–G4–E4, pink E6 → A5', () => {
    expect(juhu().map((n) => n[0])).toEqual([329.63, 392, 329.63]);
    expect(pink().slice(0, 4)).toEqual([1318.51, 0.05, 'triangle', 0.05]);
    const PENTA = [0, 2, 4, 7, 9];
    const fx = (['appear', 'arrive', 'call', 'nap', 'snore', 'wake'] as const).map((what) =>
      heraldFx({ type: 'herald', what, id: TOK, x: 0, y: 0 }),
    );
    const notes = fx.flatMap((f) => f.score).flatMap(([f, , , , slide]) => [f, f * slide]);
    const off = notes.filter((hz) => {
      const semis = 12 * Math.log2(hz / 261.63);
      return Math.abs(semis - Math.round(semis)) > 0.05 || !PENTA.includes(((Math.round(semis) % 12) + 12) % 12);
    });
    expect(off).toEqual([]);
    // höchstens drei Stimmen zugleich
    for (const f of fx)
      for (const [, len, , , , at] of f.score)
        expect(f.score.filter(([, l, , , , a]) => a < at + len && a + l > at).length).toBeLessThanOrEqual(3);
    expect(fx[0]).toMatchObject({ who: TOK }); // er hüpft
    expect(fx[0]!.burst?.length).toBeGreaterThan(0); // Steinkrümel
    expect(fx[1]).toMatchObject({ who: TOK, heart: true }); // Herz beim Ankommen
  });

  it('Gast-Platz in der Leiste der Lichtung, solange er da ist; „noch nicht“ am Höhlentor zeigt ihn vor Ausbau 1', () => {
    const world = worldOf(1, BAHN);
    const r = play(ready(world), world, [WAKE]);
    const guest = slots(r.s, 'lichtung').at(-1)![0];
    expect(guest).toMatchObject({ species: 'tok', guest: 'hoehle', home: false });
    expect(
      slots(r.s, 'eis')
        .flat()
        .some((x) => x.species === 'tok'),
    ).toBe(false);
    expect(
      slots(ready(world), 'lichtung')
        .flat()
        .some((x) => x.species === 'tok'),
    ).toBe(false);
    const due = ready(world);
    expect(lacks(due, 'hoehle')).toBe('tok'); // fällig
    expect(lacks(r.s, 'hoehle')).toBe('tok'); // gekommen
    expect(lacks({ ...due, packs: { ...SLED_HOME, bahn: { built: 1 } } }, 'hoehle')).toBeUndefined();
    expect(lacks(due, 'eis')).toBeUndefined();
    // vorher nichts von Tok: Eis-Leiste nicht voll, noch keine Heimfahrt mit dem Schlitten, Eistor zu
    expect(lacks(ready(world, { garden: FULL.slice(1) }), 'hoehle')).toBeUndefined();
    expect(lacks(ready(world, { packs: {} }), 'hoehle')).toBeUndefined();
    expect(lacks(ready(world, { open: false }), 'hoehle')).toBeUndefined();
    expect(BAHN_PACK.view).toHaveProperty('lacks', lacks);
    expect(NEAR).toBe(2);
  });
});
