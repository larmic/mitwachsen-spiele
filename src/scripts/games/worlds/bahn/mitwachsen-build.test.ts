// Bau 1 (mitwachsen-build.ts; Bild in mitwachsen-station-look.ts und mitwachsen-rail-look.ts, Töne in
// mitwachsen-tok-look.ts): Läuft die Figur in den wachen Tok, baut er Bahnhof Bär, das Gleis bis vor das Höhlentor und
// den Zug; hinter der Freigabe der Bahn-Phase (`BAHN_LIVE`)
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { REGIONS, regionAnimalList, type Point } from '../../../../data/games/mitwachsen';
import { BUILD, LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import { TRAIN_COLORS } from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { BAHN_LIVE } from '../../../../data/games/mitwachsen-rides';
import { unstick } from '../../mitwachsen-free';
import type { HeraldEvent } from '../../mitwachsen-herald';
import { bahnWanted } from '../../mitwachsen-pack';
import type { RideAt } from '../../mitwachsen-ride-view';
import { initialState, progressOf, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import { standHeight, type World } from '../../mitwachsen-world';
import { BAHN_PACK, worldOf } from '../../test-worlds';
import { beatTick, building, canBuild } from './mitwachsen-build';
import { builtOf, withBuilt } from './mitwachsen-built';
import { STAGES, railShown, waveAt, waveStage } from './mitwachsen-rail-look';
import { view3d } from './view-3d';
import { PARK, REAR_ROW, frontAt, stationBodies, stationOf } from './mitwachsen-station-look';
import { TOK, atPost, postOf, rearOf } from './mitwachsen-tok';
import { buildScore, heraldFx } from './mitwachsen-tok-look';
import { tokOf, withTok } from './mitwachsen-tok-save';

const BAHN = [BAHN_PACK];
const ICE = REGIONS.find((r) => r.id === 'eis')!;
const FULL = regionAnimalList(ICE)
  .filter((a) => a.n === 1)
  .map(({ id, species }) => ({ id, species }));
/** Tok ist gekommen (Stufe `faellig`), die erste Heimfahrt mit dem Schlitten gemacht, noch nichts gebaut */
const FAELLIG = withTok({ fahrt: { schlitten: { stage: 'fest' } } }, { stage: 'faellig' });
const TICK: Cmd = { type: 'tick' };
const key = ([x, y]: Point) => `${x},${y}`;

type Run = { s: State; events: GameEvent[] };
function play(s: State, world: World, cmds: readonly Cmd[]): Run {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, c, undefined, undefined, BAHN);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
/** Wie die Spielseite: Wird die Welt neu gebaut (`relay`), spielt es in der neuen weiter, wer im Weg stünde, rückt */
function live(s: State, world: World, cmds: readonly Cmd[]): Run & { world: World } {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, c, undefined, undefined, BAHN);
    s = r.state;
    events.push(...r.events);
    if (r.events.some((e) => e.type === 'herald' && e.relay)) {
      world = world.relay(s.packs).world;
      s = unstick(s, world);
    }
  }
  return { s, events, world };
}
const ticks = (n: number): Cmd[] => Array.from({ length: n }, () => TICK);
const heralds = (e: readonly GameEvent[], what?: HeraldEvent['what']) =>
  e.filter((x): x is HeraldEvent => x.type === 'herald' && (!what || x.what === what));
const tokIn = (s: State) => s.animals.find((a) => a.id === TOK);

/** Tok wartet an seinem Platz, die Figur steht wach neben ihm: der Befehl, mit dem sie in ihn hineinläuft */
function besideTok(world: World): { s: State; into: Cmd } {
  let s = initialState(world, { openGates: ['eis'], garden: FULL, packs: FAELLIG });
  s = play({ ...s, sleeping: false, wokeAt: -100 }, world, ticks(3)).s;
  const t = tokIn(s)!;
  const [dir, [dx, dy]] = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(([, [dx, dy]]) => {
    const p: Point = [t.x - dx, t.y - dy];
    return standHeight(world, [], ...p) !== null && !s.animals.some((a) => a.x === p[0] && a.y === p[1]);
  })!;
  return { s: { ...s, player: { x: t.x - dx, y: t.y - dy, dir: 's' } }, into: { type: 'move', dir } };
}

/** Bild zu einem Zeitpunkt (`now` ms), ohne Bruchteil eines Takts */
const at = (reduced = false, now = 0): RideAt => ({ now, frac: 0, reduced, lit: false });

describe('Bau 1: Freigabe der Bahn-Phase', () => {
  it('bis zum Freischalten kommt das Paket der Bahn nie von selbst: kein Tok, kein Bau, nichts gespeichert', () => {
    const world = worldOf(1, BAHN);
    const { s, into } = besideTok(world);
    expect(BAHN_LIVE).toBe(false);
    expect(bahnWanted(s)).toBe(false); // Freigabe aus: Das Spiel holt das Paket nie
    expect(bahnWanted(s, true)).toBe(true); // freigeschaltet
    // ohne die Regeln des Pakets (so läuft das Spiel, solange die Freigabe aus ist) baut niemand
    const bare = { ...s, animals: s.animals.filter((a) => a.id !== TOK) };
    const r = step(bare, world, into, undefined, undefined, []);
    expect(builtOf(r.state.packs)).toBe(0);
    expect(r.state.work).toBeUndefined();
    expect(r.events.filter((e) => e.type === 'herald')).toEqual([]);
  });
});

describe('Bau 1: beginnen', () => {
  const world = worldOf(1, BAHN);

  it('in den wachen Tok gelaufen: Ausbau 1, Stufe bereit, sofort gespeichert, die Welt wird neu gebaut', () => {
    const { s, into } = besideTok(world);
    expect(canBuild(s)).toBe(true);
    expect(atPost(world, tokIn(s)!)).toBe(true);
    const r = play(s, world, [into]);
    const t = tokIn(r.s)!;
    expect(heralds(r.events)).toEqual([{ type: 'herald', what: 'build', id: TOK, x: t.x, y: t.y, persist: true }]);
    expect(r.s.work).toEqual({ from: s.tick, to: s.tick + BUILD.ticks });
    expect(building(r.s)).toBe(true);
    const saved = progressOf(r.s).packs;
    expect(saved).toEqual({
      ...FAELLIG,
      fahrt: { schlitten: { stage: 'fest' }, hoehle: { stage: 'bereit' } },
      bahn: { built: 1 },
    });
    expect(JSON.stringify(progressOf(r.s))).not.toContain('work'); // wie weit gebaut wird, steht nie im Spielstand
    const back: Record<Dir, Dir> = { e: 'w', w: 'e', n: 's', s: 'n' };
    expect(t.dir).toBe(back[(into as { dir: Dir }).dir]); // er schaut zur Figur
  });

  it('nicht, wenn er schläft (er schnarcht), noch nichts von ihm gespeichert ist oder schon gebaut wurde', () => {
    const { s, into } = besideTok(world);
    const asleep = play(
      { ...s, animals: s.animals.map((a) => (a.id === TOK ? { ...a, nap: true as const } : a)) },
      world,
      [into],
    );
    expect(heralds(asleep.events).map((e) => e.what)[0]).toBe('snore');
    expect(builtOf(asleep.s.packs)).toBe(0);
    expect(canBuild({ packs: {} })).toBe(false); // Tok kam noch nicht
    expect(canBuild({ packs: withBuilt(FAELLIG, 1) })).toBe(false); // schon gebaut
    expect(canBuild({ packs: FAELLIG, work: { from: 0, to: 80 } })).toBe(false); // baut gerade
  });

  it('der Ausbau steigt nur; fehlt er, gilt 0; der Rest des Eintrags und die anderen Pakete bleiben', () => {
    expect(builtOf({})).toBe(0);
    expect(withBuilt({}, 1)).toEqual({ bahn: { built: 1 } });
    expect(withBuilt({ bahn: { built: 2, x: 1 }, eis: { a: 1 } }, 1)).toEqual({
      bahn: { built: 2, x: 1 },
      eis: { a: 1 },
    });
    expect(builtOf(withBuilt({ bahn: { built: 1 } }, 2))).toBe(2);
    expect(builtOf(withBuilt({ bahn: 'kaputt' }, 1))).toBe(1);
  });
});

describe('Bau 1: nur an seinem Platz, nur mit Platz für Bahnhof Bär', () => {
  it('unterwegs zu seinem Platz baut er nicht: Er singt und hüpft (Regeln des Kerns), nichts wird gespeichert', () => {
    const world = worldOf(1, BAHN);
    const { s } = besideTok(world);
    const at = postOf(world)!;
    const on = new Set(at.station!.platform.map(key));
    // ein freies Feld der Lichtung, 4 bis 8 Felder von seinem Platz, nicht auf dem künftigen Bahnsteig, mit Nachbar frei
    const [spot, dir] = [...at.field.keys()]
      .map((k): Point => [Number(k.split(',')[0]), Number(k.split(',')[1])])
      .filter((p) => !on.has(key(p)) && Math.max(Math.abs(p[0] - at.post[0]), Math.abs(p[1] - at.post[1])) >= 4)
      .flatMap((p) =>
        (Object.entries(DIRS) as [Dir, readonly [number, number]][])
          .filter(([, [dx, dy]]) => standHeight(world, [], p[0] - dx, p[1] - dy) !== null)
          .map(([d]) => [p, d] as const),
      )[0]!;
    const [dx, dy] = DIRS[dir];
    const away: State = {
      ...s,
      animals: s.animals.map((a) => (a.id === TOK ? { ...a, x: spot[0], y: spot[1] } : a)),
      player: { x: spot[0] - dx, y: spot[1] - dy, dir: 's' },
    };
    expect(atPost(world, { x: spot[0], y: spot[1] })).toBe(false);
    const r = play(away, world, [{ type: 'move', dir }]);
    expect(heralds(r.events, 'build')).toEqual([]);
    expect(r.events.some((e) => e.type === 'sing')).toBe(true);
    expect(builtOf(r.s.packs)).toBe(0);
    expect(r.s.work).toBeUndefined();
  });

  it('Seed 33 (Teiche, wo Bahnhof Bär hingehört; Frage an den Vater offen): kein Bau, Tok bleibt auf der Lichtung', () => {
    const world = worldOf(33, BAHN);
    expect(postOf(world)?.station).toBeNull();
    const { s, into } = besideTok(world);
    expect(atPost(world, tokIn(s)!)).toBe(false);
    const r = play(s, world, [into, ...ticks(BUILD.ticks)]);
    expect(heralds(r.events, 'build')).toEqual([]);
    expect(builtOf(r.s.packs)).toBe(0);
    expect(r.s.work).toBeUndefined();
    expect(tokIn(r.s)).toBeDefined();
    expect(tokOf(r.s.packs)).toEqual({ stage: 'faellig' });
  });
});

describe('Bau 1: während des Baus', () => {
  const world = worldOf(1, BAHN);

  it('jeder Pfeil lässt die Figur nur hüpfen; zu pop wird die Welt neu gebaut, Tok hüpft an den hinteren Wagen und steigt zu board ein, nach 8 s ist der Bau fertig', () => {
    const { s, into } = besideTok(world);
    let r = live(s, world, [into]);
    const from = r.s.work!.from;
    const rear = rearOf(world)!;
    const still = { ...r.s.player };
    const bad: string[] = [];
    const events: GameEvent[] = [];
    let w = r.world;
    for (let i = 0; i < BUILD.ticks; i++) {
      const dir = (['n', 'e', 's', 'w'] as const)[i % 4]!;
      r = live(r.s, w, [{ type: 'move', dir, fresh: true }, TICK]);
      if (r.world !== w && r.s.tick !== beatTick(from, BUILD.pop)) bad.push(`Takt ${r.s.tick}: neu gebaut`);
      w = r.world;
      events.push(...r.events);
      if (building(r.s) && (r.s.player.x !== still.x || r.s.player.y !== still.y))
        bad.push(`Takt ${r.s.tick}: gelaufen`);
      const boarded = r.s.tick >= beatTick(from, BUILD.board);
      if (boarded === !!tokIn(r.s)) bad.push(`Takt ${r.s.tick}: Tok ${tokIn(r.s) ? 'noch da' : 'schon weg'}`);
    }
    expect(bad).toEqual([]);
    expect(events.filter((e) => e.type === 'hop').length).toBeGreaterThanOrEqual(BUILD.ticks - 1);
    expect(heralds(events).map((e) => e.what)).toEqual(['pop', 'board']);
    expect(heralds(events, 'pop')[0]).toMatchObject({ relay: true });
    const board = heralds(events, 'board')[0]!;
    expect([board.x, board.y]).toEqual(rear); // er steigt am hinteren Wagen ein
    const st = stationOf(w)!;
    expect(rear).toEqual(st.rows[REAR_ROW]!.edge);
    const car = stationBodies(r.s, w, at()).find((b) => b.id === 'bahn:rear')!;
    const [lx, ly] = st.line[REAR_ROW]!;
    expect(Math.max(Math.abs(car.x - lx), Math.abs(car.y - ly))).toBeLessThan(0.5); // der Wagen hält neben ihm
    expect(r.s.work).toBeUndefined();
    expect(building(r.s)).toBe(false);
    // danach läuft die Figur wieder, und Tok kommt nicht wieder (Ausbau 1)
    const before = { ...r.s.player };
    const free = (['n', 'e', 's', 'w'] as const).find((d) => {
      const [dx, dy] = DIRS[d];
      return standHeight(w, [], before.x + dx, before.y + dy) !== null;
    })!;
    r = live(r.s, w, [{ type: 'move', dir: free, fresh: true }, ...ticks(40)]);
    expect([r.s.player.x, r.s.player.y]).not.toEqual([before.x, before.y]);
    expect(tokIn(r.s)).toBeUndefined();
    expect(tokOf(r.s.packs)).toEqual({ stage: 'bereit' });
  });

  it('wer mitten im Bau neu lädt, findet ihn fertig: Ausbau 1, kein Tok auf der Lichtung, der Zug mit ihm am Bahnsteig', () => {
    const { s, into } = besideTok(world);
    const r = play(s, world, [into, ...ticks(10)]);
    const p = progressOf(r.s);
    expect(builtOf(p.packs)).toBe(1);
    const built = worldOf(1, BAHN, { bahn: { built: 1 } }); // Feld für Feld wie createWorld(1, BAHN, p.packs)
    const again = play(initialState(built, p), built, ticks(3)).s;
    expect(again.work).toBeUndefined();
    expect(tokIn(again)).toBeUndefined();
    const train = stationBodies(again, built, at()).filter((b) => b.id.startsWith('bahn:') && b.key.includes(':rear:'));
    expect(train.map((b) => b.key)).toEqual(['bahn:rear:10']); // Tok sitzt im hinteren Wagen, die Tür ist zu
  });
});

describe('Bau 1: die Welt wird neu gebaut', () => {
  it('World.relay: Feld für Feld wie gleich mit dem neuen Spielstand gebaut, nur die geänderten Stücke fallen weg', () => {
    const before = worldOf(1, BAHN); // relay ändert die Welt nicht, es baut eine neue
    const packs = withBuilt(FAELLIG, 1);
    const { world, chunks } = before.relay(packs);
    const fresh = worldOf(1, BAHN, { bahn: { built: 1 } });
    const diff: string[] = [];
    for (let y = -40; y <= 40; y++)
      for (let x = -40; x <= 40; x++)
        if (JSON.stringify(world.cell(x, y)) !== JSON.stringify(fresh.cell(x, y))) diff.push(key([x, y]));
    expect(diff).toEqual([]);
    expect(chunks.length).toBeGreaterThan(0);
    expect(stationOf(world)).not.toBeNull();
    expect(world.relay(packs).chunks).toEqual([]); // gleicher Spielstand: nichts ändert sich
  });
});

describe('Bau 1: Bahnhof Bär und Zug', () => {
  // je Seed (Bahnsteig, Häuschen, der Zug am Bahnsteig, Tunnelportal): mitwachsen-line.test.ts, mit den Welten dort
  const BUILT1 = withBuilt(withTok(FAELLIG, { stage: 'bereit' }), 1);

  const w = worldOf(1, BAHN, { bahn: { built: 1 } });
  const st = stationOf(w)!;
  /** Zustand mitten im Bau beim Bruchteil `p` */
  const during = (p: number): State => ({
    ...initialState(w, { packs: BUILT1 }),
    tick: 1000 + Math.round(p * BUILD.ticks),
    work: { from: 1000, to: 1000 + BUILD.ticks },
  });
  const ids = (p: number, reduced = false) => stationBodies(during(p), w, at(reduced)).map((b) => b.id);

  it('vor Ausbau 1 nichts; beim Bau: erst ab pop der Bahnhof, ab roll der Zug, der aus dem Tunnelportal bis an den Bahnsteig heranrollt', () => {
    expect(stationBodies(initialState(w, { packs: FAELLIG }), w, at())).toEqual([]);
    expect(ids(0.05)).toEqual([]);
    expect(ids(BUILD.pop).filter((i) => i.startsWith('bahn:reihe')).length).toBe(LINE.bear.long);
    expect(ids(BUILD.pop)).toEqual(expect.arrayContaining(['bahn:dach', 'bahn:schild']));
    expect(ids(BUILD.roll[0] - 0.01)).not.toContain('bahn:loco');
    // zu roll steht er noch ganz im Tunnel, dann kommt Wagen für Wagen heraus, zuerst die Lok
    expect(st.portal).toBeGreaterThan(LINE.bear.long);
    expect(ids(BUILD.roll[0]).filter((i) => /^bahn:(loco|mid|rear|dampf)$/.test(i))).toEqual([]);
    const cars = (p: number) => ids(p).filter((i) => /^bahn:(loco|mid|rear)$/.test(i));
    const seen = Array.from({ length: 41 }, (_, i) => cars(BUILD.roll[0] + ((BUILD.roll[1] - BUILD.roll[0]) * i) / 40));
    expect(seen.every((c, i) => i === 0 || c.length >= seen[i - 1]!.length)).toBe(true);
    const order = ['bahn:loco', 'bahn:mid', 'bahn:rear'];
    expect(seen.filter((c) => c.join() !== order.slice(0, c.length).join())).toEqual([]);
    expect(ids(BUILD.roll[1])).toEqual(expect.arrayContaining(['bahn:loco', 'bahn:mid', 'bahn:rear', 'bahn:dampf']));
    const fronts = Array.from({ length: 11 }, (_, i) =>
      frontAt(st, { x: 1e6, y: 1e6 }, BUILD.roll[0] + ((BUILD.roll[1] - BUILD.roll[0]) * i) / 10, false)!,
    );
    expect(fronts[0]).toBeGreaterThanOrEqual(st.portal!); // die Lok kommt aus dem Tunnelportal
    expect(fronts.every((f, i) => i === 0 || f <= fronts[i - 1]!)).toBe(true); // rollt nur heran
    expect(fronts.at(-1)).toBe(PARK);
    expect(frontAt(st, { x: 1e6, y: 1e6 }, undefined, false)).toBe(PARK); // fertig: am Bahnsteig
  });

  it('beim Aufploppen wachsen die Teile kurz aus dem Boden, bei reduzierter Bewegung stehen sie gleich da', () => {
    const z = (p: number, reduced: boolean) =>
      stationBodies(during(p), w, at(reduced)).find((b) => b.id === 'bahn:dach')!.z;
    expect(z(BUILD.pop, false)).toBeLessThan(z(0.5, false));
    expect(z(BUILD.pop, true)).toBe(z(0.5, true));
  });

  it('die Tür des hinteren Wagens geht zu door auf, ab board sitzt Tok darin; ohne Bau sitzt er, die Tür ist zu', () => {
    const rear = (p?: number) =>
      stationBodies(p === undefined ? initialState(w, { packs: BUILT1 }) : during(p), w, at()).find(
        (b) => b.id === 'bahn:rear',
      )!.key;
    expect(rear(BUILD.door - 0.02)).toBe('bahn:rear:00');
    expect(rear(BUILD.door)).toMatch(/^bahn:rear:0-?1$/);
    expect(rear(BUILD.board)).toMatch(/^bahn:rear:1-?1$/);
    expect(rear()).toBe('bahn:rear:10');
  });

  it('bei reduzierter Bewegung kein Dampf, der Zug rückt in Sprüngen vor; er fährt nie durch die Figur', () => {
    expect(ids(0.6, true)).not.toContain('bahn:dampf');
    const p = BUILD.roll[0] + 0.1;
    const jump = frontAt(st, { x: 1e6, y: 1e6 }, p, true)! - PARK;
    expect(Math.abs(jump / 2 - Math.round(jump / 2))).toBeLessThan(1e-9);
    const [x, y] = st.line[3]!; // die Figur steht auf dem Gleis am Bahnsteig
    expect(frontAt(st, { x, y }, undefined, false)).toBeGreaterThan(3);
  });

  it('Farben: Lila, Silber, türkiser Leuchtstreifen, Fledermaus vorn; nirgends Gold (das Kind kann hier nichts tun)', () => {
    const all = stationBodies(during(1 - 1e-3), w, at()).flatMap((b) => b.parts.flatMap((p) => [p[6], p[7]]));
    expect(all).toEqual(expect.arrayContaining([TRAIN_COLORS.lila, TRAIN_COLORS.silver[0], TRAIN_COLORS.light]));
    expect(all).toEqual(expect.arrayContaining([TRAIN_COLORS.bat.w, TRAIN_COLORS.steam]));
    expect(all.filter((c) => c && Object.values(GOLD).includes(c as never))).toEqual([]);
  });
});

describe('Bau 1: Gleiswelle', () => {
  const rail = (along: number) => ({ to: 'ns', stage: 1 as const, along });
  const packs = { bahn: { built: 1 } };

  it('läuft vom Bahnhof bis an den Prellbock; vorher und nachher liegt alles, Ausbau 2 erst mit Bau 2', () => {
    const shown = (along: number, work?: number, reduced = false) => railShown(rail(along), { packs, work, reduced });
    expect(shown(0, BUILD.wave[0] - 0.01)).toBe(false);
    expect(shown(0, BUILD.wave[0])).toBe(true);
    expect(shown(1, BUILD.wave[1] - 0.01)).toBe(false);
    expect(shown(1, BUILD.wave[1])).toBe(true);
    expect(shown(0.5, undefined)).toBe(true); // kein Bau: alles liegt
    expect(railShown({ ...rail(0), stage: 2 }, { packs, reduced: false })).toBe(false);
    const order = Array.from({ length: 11 }, (_, i) => waveAt(i / 10, false));
    expect(order.every((t, i) => i === 0 || t >= order[i - 1]!)).toBe(true);
  });

  it('3D baut bei Bau 1 nur dreimal neu: Stufe 0 wie Ausbau 0, die letzte Stufe wie der fertige Ausbau', () => {
    const stamps = Array.from({ length: 101 }, (_, i) => view3d.stamp!(packs, i / 100));
    const changes = stamps.filter((t, i) => i > 0 && t !== stamps[i - 1]);
    expect(stamps[0]).toBe(view3d.stamp!({}));
    expect(changes).toHaveLength(STAGES);
    expect(stamps.at(-1)).toBe(view3d.stamp!(packs));
    expect(view3d.stamp!(packs, undefined)).toBe('bahn1');
  });

  it('bei reduzierter Bewegung (und in 3D) in drei Stufen', () => {
    const times = new Set(Array.from({ length: 101 }, (_, i) => waveAt(i / 100, true)));
    expect(times.size).toBe(STAGES);
    expect(waveStage(undefined)).toBeUndefined();
    expect(waveStage(0)).toBe(0);
    expect(waveStage(BUILD.wave[1])).toBe(STAGES);
  });
});

describe('Bau 1: Töne', () => {
  const PENTA = new Set([0, 2, 4, 7, 9]); // C D E G A
  const inPenta = (f: number) => PENTA.has(((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12);

  it('pink-pink-pink, plopp, klonk, Pfiff, Ding-Dong, pff: alles aus der C-Pentatonik, höchstens ein Ton sofort', () => {
    const score = buildScore();
    expect(score.filter((n) => n[5] === 0)).toHaveLength(1);
    const bad = score.filter(([f, , , , slide]) => !inPenta(f) || !inPenta(f * slide));
    expect(bad).toEqual([]);
    expect(Math.max(...score.map((n) => n[5]))).toBeLessThan((BUILD.ticks * 100) / 1000);
    const e = { type: 'herald', what: 'build', id: TOK, x: 0, y: 0 } as const;
    expect(heraldFx(e)).toMatchObject({ who: TOK, score });
    expect(heraldFx({ ...e, what: 'board' }).score.length).toBe(3); // „Ju-hu“
  });
});
