// Hau-ruck am Höhlentor (Konzept-Schritt 11): Tok und die Figur schieben den Rollstein in drei Stößen in seine Nische
// (Regeln mitwachsen-heave.ts, Bild und Ton mitwachsen-heave-look.ts, beide im Paket der Höhlenwelt). Reine Regeln über
// `step` mit den Paketen wie im Spiel (Höhlenwelt, Bahn mit Tok, Fahr-Engine)
import { describe, expect, it } from 'vitest';
import { animalId, keyOf, type Point } from '../../../../data/games/mitwachsen';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { BESIDE, plateRow } from '../../mitwachsen-bay';
import { HEAVE_END, heaveLeft, nope } from '../../mitwachsen-guide';
import { THIRDS, lampOn, stoneX } from '../../mitwachsen-gate-hoehle';
import { openStep } from '../../mitwachsen-gates-3d';
import { needsPack } from '../../mitwachsen-pack';
import { stageOf, withTok } from '../../mitwachsen-ride-save';
import {
  initialState,
  progressOf,
  step,
  type Animal,
  type Cmd,
  type GameEvent,
  type State,
} from '../../mitwachsen-state';
import { lageOf, leadTicks } from '../../mitwachsen-turn-pace';
import type { RideAt } from '../../mitwachsen-ride-view';
import { beyondRing, canStep, type World } from '../../mitwachsen-world';
import { BAHN_PACK, FAHRT_PACK, HOEHLE_PACK, seedRange, seedsFor, worldOf } from '../../test-worlds';
/** Ausbau 1 der Bahn (`packs.bahn.built`; das Paket der Bahn importiert dieser Test nicht, Pakete bleiben getrennt) */
const withBuilt = (packs: Record<string, unknown>, built: number) => ({ ...packs, bahn: { built } });
import { GATE, HEAVE, OPEN_TICKS, PUSHES, PUSH_GAP, TOK_ALONE } from './mitwachsen-heave';
import {
  BAT,
  HANDS,
  HEAVE_T,
  LAMPS,
  NICHE,
  ROLL,
  heaveAjar,
  heaveBodies,
  heaveScore,
  openScore,
} from './mitwachsen-heave-look';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { view } from './view-2d';

const TOK = animalId('hoehle', 'tok');
/** Die Pakete wie im Spiel: Höhlenwelt (Hau-ruck), Bahn (Tok, Zug), Fahr-Engine */
const RULES = [HOEHLE_PACK, BAHN_PACK, FAHRT_PACK];
/** Spielstand nach der ersten Fahrt bis zum Prellbock: Ausbau 1, Stufe `bereit`, gefahren */
const RIDDEN = withBuilt(withTok({}, { stage: 'bereit', gefahren: true }), 1);
const worldFor = (seed: number) => worldOf(seed, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 1 } });
const W = worldFor(1);
const TICK: Cmd = { type: 'tick' };
const AT: RideAt = { now: 0, frac: 0, reduced: false, lit: false };
const ticks = (n: number): Cmd[] => Array.from({ length: n }, () => TICK);
const PENTA = new Set([0, 2, 4, 7, 9]); // C-Dur-Pentatonik in Halbtönen über C
const semis = (f: number) => ((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12;

type Run = { s: State; events: GameEvent[]; at: Map<string, number[]> };
function play(s: State, world: World, cmds: readonly Cmd[]): Run {
  const events: GameEvent[] = [];
  const at = new Map<string, number[]>();
  for (const c of cmds) {
    const r = step(s, world, c, undefined, undefined, RULES);
    s = r.state;
    for (const e of r.events) {
      events.push(e);
      const k = e.type === 'heave' ? `heave:${e.n}` : e.type;
      at.set(k, [...(at.get(k) ?? []), s.tick]);
    }
  }
  return { s, events, at };
}
const push = (dir: Dir = 'n'): Cmd => ({ type: 'move', dir, fresh: true });

/** Tok als Bote auf seinem Platz neben der Torplatte (wie nach der ersten Fahrt, mitwachsen-train.ts) */
function tokAt([x, y]: Point): Animal {
  const home = { kind: 'region', region: 'hoehle' } as const;
  return { id: TOK, species: 'tok', x, y, dir: 'n', mode: 'herald', home, realm: 'hoehle', spawn: [x, y], rest: 0 };
}

/** Wach auf der Mitte der Torplatte vor dem Höhlentor, Tok neben der Platte (`tok: false`: ohne ihn) */
function onPlate(world: World, { tok = true, packs = RIDDEN } = {}): State {
  const g = world.gates.get(GATE)!;
  const [x, y] = plateRow(g, 0);
  const s = initialState(world, { packs });
  return {
    ...s,
    sleeping: false,
    wokeAt: -100,
    player: { x, y, dir: 'n' },
    animals: tok ? [tokAt(plateRow(g, BESIDE))] : [],
  };
}

const lead = (world: World) => leadTicks(lageOf(world.gates.get(GATE)!.out));
/** Vom Start des Stehens bis zum Beginn des Hau-rucks (`OPEN_TICKS`) und bis nach dem Vorspiel */
const begun = (world: World) => play(onPlate(world), world, ticks(OPEN_TICKS));

/** Weg zu Fuß (Breitensuche mit `canStep`, ohne Gleis und ohne Tok) vom Feld der Figur bis zu `goal` */
function pathTo(world: World, s: State, goal: Point, limit = 40000): Dir[] | null {
  const k = (x: number, y: number) => `${x},${y}`;
  const from = new Map<string, [string, Dir]>();
  const start = k(s.player.x, s.player.y);
  const seen = new Set([start]);
  const queue: Point[] = [[s.player.x, s.player.y]];
  const busy = new Set(s.animals.map((a) => k(a.x, a.y)));
  for (let i = 0; i < queue.length && seen.size < limit; i++) {
    const [x, y] = queue[i]!;
    if (x === goal[0] && y === goal[1]) {
      const out: Dir[] = [];
      for (let at = k(x, y); at !== start;) {
        const [prev, dir] = from.get(at)!;
        out.unshift(dir);
        at = prev;
      }
      return out;
    }
    for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
      const [nx, ny] = [x + dx, y + dy];
      if (seen.has(k(nx, ny)) || busy.has(k(nx, ny)) || world.cell(nx, ny).ride) continue;
      if (world.cell(nx, ny).deco === 'bed' || !canStep(world, s.openGates, x, y, nx, ny)) continue;
      seen.add(k(nx, ny));
      from.set(k(nx, ny), [k(x, y), dir]);
      queue.push([nx, ny]);
    }
  }
  return null;
}

describe('Hau-ruck am Höhlentor: Schlüssel und Pakete', () => {
  it('Schlüssel Tok: das Hau-ruck beginnt, ein offenes Tor bleibt beim Laden offen', () => {
    expect(keyOf(GATE)).toBe('tok');
    expect(HOEHLE_PACK.rules?.ritual).toBe(HEAVE);
    expect(begun(W).s.heave).toEqual({ gate: GATE, n: 0, at: OPEN_TICKS + lead(W) });
    expect(initialState(W, { openGates: [GATE] }).openGates).toEqual([GATE]);
  });

  it('Pakete: das Spiel braucht die Grotte nah am Höhlentor nach der Eis-Welt und mit offenem Tor, sonst nicht', () => {
    const g = W.gates.get(GATE)!;
    const near = { openGates: ['eis' as const], garden: [], at: [plateRow(g, 0)] };
    expect(needsPack(near, W.gates, beyondRing, GATE)).toBe(true);
    expect(needsPack({ ...near, openGates: [] }, W.gates, beyondRing, GATE)).toBe(false); // vor der Eis-Welt: Tok kommt erst danach
    expect(needsPack({ ...near, at: [W.homes.lichtung.bed] }, W.gates, beyondRing, GATE)).toBe(false); // fern vom Tor
    expect(needsPack({ ...near, at: [], openGates: ['eis', GATE] }, W.gates, beyondRing, GATE)).toBe(true);
  });
});

describe('Hau-ruck am Höhlentor: Regeln (mitwachsen-heave.ts)', () => {
  it('beginnt erst, wenn die Figur 0,4 s still auf der Platte steht und Tok in der Bucht wartet; Drüberlaufen nie', () => {
    const g = W.gates.get(GATE)!;
    const s = onPlate(W);
    expect(play(s, W, ticks(OPEN_TICKS - 1)).s.heave).toBeUndefined();
    const r = play(s, W, ticks(OPEN_TICKS));
    expect(r.s.heave?.n).toBe(0);
    expect(r.events.filter((e) => e.type === 'heave')).toEqual([
      { type: 'heave', x: g.mid[0], y: g.mid[1], n: 0, who: TOK },
    ]);
    // ohne Tok (er sitzt noch im Zug) nichts; „noch nicht“ zeigt dann das Tor (Tok als fehlender Schritt, Haken der Bahn)
    const inTrain = withBuilt(withTok({}, { stage: 'bereit' }), 1); // noch nicht gefahren: Tok sitzt im Zug
    const alone = play(onPlate(W, { tok: false, packs: inTrain }), W, ticks(30));
    expect(alone.s.heave).toBeUndefined();
    expect(nope(alone.s, W, -1e9)).toBe(GATE);
    // schläft Tok, auch nicht
    const nap = onPlate(W);
    nap.animals[0] = { ...nap.animals[0]!, nap: true };
    expect(play(nap, W, ticks(30)).s.heave).toBeUndefined();
    // Drüberlaufen: jeder Schritt setzt die Stehzeit zurück
    const across = play(s, W, [TICK, TICK, push('e'), TICK, push('w'), TICK, TICK]);
    expect(across.s.heave).toBeUndefined();
    // offenes Tor: kein Hau-ruck mehr
    expect(play({ ...s, openGates: [...s.openGates, GATE] }, W, ticks(30)).s.heave).toBeUndefined();
  });

  it('Vorspiel, solange die Kamera zur Front dreht: Pfeile lassen nur hüpfen, die Figur bleibt auf der Platte', () => {
    const b = begun(W);
    if (lead(W) === 0) return;
    const r = play(b.s, W, [push('n'), push('e'), push('s')]);
    expect(r.events.map((e) => e.type)).toEqual(['hop', 'hop', 'hop']);
    expect([r.s.player.x, r.s.player.y]).toEqual([b.s.player.x, b.s.player.y]);
    expect(r.s.heave?.n).toBe(0);
  });

  it('jeder Pfeil ist ein Stoß, mindestens 6 Takte dazwischen; drei Stöße: das Tor ist offen und sofort gespeichert, Stufe `offen`', () => {
    let s = play(begun(W).s, W, ticks(lead(W))).s;
    const first = play(s, W, [push()]);
    expect(first.s.heave).toMatchObject({ n: 1, at: s.tick });
    expect(first.events).toContainEqual(expect.objectContaining({ type: 'heave', n: 1, who: TOK }));
    s = first.s;
    // zu früh: nur hüpfen
    const early = play(s, W, [...ticks(PUSH_GAP - 1), push()]);
    expect(early.s.heave?.n).toBe(1);
    expect(early.events.map((e) => e.type)).toContain('hop');
    s = play(s, W, ticks(PUSH_GAP)).s;
    const second = play(s, W, [push('e')]); // jede Richtung zählt, die Figur bleibt stehen
    expect(second.s.heave?.n).toBe(2);
    expect([second.s.player.x, second.s.player.y]).toEqual([s.player.x, s.player.y]);
    expect(second.s.openGates).not.toContain(GATE); // ein halb geschobener Stein ist noch zu
    s = play(second.s, W, ticks(PUSH_GAP)).s;
    const third = play(s, W, [push()]);
    expect(third.s.heave?.n).toBe(PUSHES);
    expect(third.s.openGates).toContain(GATE);
    expect(third.events).toContainEqual({ type: 'gate', id: GATE, at: 0 }); // die Spielseite speichert sofort
    expect(progressOf(third.s).openGates).toContain(GATE);
    expect(stageOf(third.s.packs, 'hoehle')).toBe('offen');
    expect(progressOf(third.s).packs.fahrt).toEqual({ hoehle: { stage: 'offen', gefahren: true } }); // `gefahren` bleibt
  });

  it('ohne Druck stößt Tok allein, je 1,5 s: niemand bleibt hängen, kein Fehlerton', () => {
    const b = begun(W);
    const go = b.s.heave!.at;
    const r = play(b.s, W, ticks(lead(W) + PUSHES * TOK_ALONE + 1));
    expect([1, 2, 3].map((n) => r.at.get(`heave:${n}`))).toEqual([
      [go + TOK_ALONE],
      [go + 2 * TOK_ALONE],
      [go + 3 * TOK_ALONE],
    ]);
    expect(r.s.openGates).toContain(GATE);
    expect(r.events.map((e) => e.type)).not.toContain('bump');
  });

  it('danach 3 s: Pfeile hüpfen nur, dann hüpft Tok mit Herz („Ju-hu“) und das Hau-ruck ist vorbei', () => {
    const b = begun(W);
    let r = play(b.s, W, ticks(lead(W) + PUSHES * TOK_ALONE));
    const opened = r.s.heave!.at;
    expect(heaveLeft(r.s)).toBe(HEAVE_END);
    const hop = play(r.s, W, [push('s')]);
    expect(hop.events.map((e) => e.type)).toEqual(['hop']);
    r = play(r.s, W, ticks(HEAVE_END));
    expect(r.s.heave).toBeUndefined();
    expect(r.at.get('herald')).toEqual([opened + HEAVE_END]);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'herald', what: 'arrive', id: TOK }));
    expect(heaveLeft(r.s)).toBeUndefined();
  });

  it('ein halb geschobener Stein wird nicht gespeichert: nach dem Laden ist das Tor zu, kein Hau-ruck', () => {
    const b = begun(W);
    const half = play(b.s, W, ticks(lead(W) + 2 * TOK_ALONE)).s;
    expect(half.heave?.n).toBe(2);
    const saved = progressOf(half);
    expect(saved.openGates).not.toContain(GATE);
    expect(JSON.stringify(saved)).not.toContain('heave');
    const again = initialState(W, saved);
    expect(again.heave).toBeUndefined();
    expect(again.openGates).not.toContain(GATE);
  });

  it('Stufe `fest` bleibt `fest`; während des Hau-rucks zeigt das Tor kein „noch nicht“', () => {
    const packs = withBuilt(withTok({}, { stage: 'fest' }), 1);
    const s = play(onPlate(W, { packs }), W, ticks(OPEN_TICKS + lead(W))).s;
    expect(nope({ ...s, still: 100 }, W, -1e9)).toBeUndefined();
    const r = play(s, W, ticks(PUSHES * TOK_ALONE));
    expect(stageOf(r.s.packs, 'hoehle')).toBe('fest');
  });

  it('zu Fuß: nach dem Laden wartet Tok wieder in der Bucht (am Morgen hüpft er vom Bett hin), dann geht es genauso', () => {
    let s = initialState(W, { packs: RIDDEN });
    s = play(s, W, [TICK]).s;
    const tok = () => s.animals.find((a) => a.id === TOK);
    expect(tok()).toBeDefined(); // schläft die Figur, sitzt er neben dem Bett der Lichtung
    s = play(s, W, [push('s')]).s; // aufwachen
    const post = plateRow(W.gates.get(GATE)!, BESIDE);
    for (let i = 0; i < 600 && (tok()!.x !== post[0] || tok()!.y !== post[1]); i++) s = play(s, W, [TICK]).s;
    expect([tok()!.x, tok()!.y]).toEqual(post);
    const path = pathTo(W, s, plateRow(W.gates.get(GATE)!, 0))!;
    expect(path).not.toBeNull();
    s = play(
      s,
      W,
      path.map((d) => ({ type: 'move', dir: d })),
    ).s;
    const r = play(s, W, ticks(OPEN_TICKS + lead(W) + PUSHES * TOK_ALONE));
    expect(r.s.openGates).toContain(GATE);
  });
});

describe('Hau-ruck am Höhlentor: über viele Welten', () => {
  it.each(seedsFor(seedRange(1, 20)))(
    'Seed %i: Tok allein öffnet das Tor in drei Stößen; danach geht es zu Fuß durch den Gang ins Höhlenbett, vorher nicht',
    (seed) => {
      const w = worldFor(seed);
      const before = onPlate(w);
      const wake = w.homes.hoehle.wake[0]!;
      const shut = pathTo(w, before, wake);
      const r = play(before, w, ticks(OPEN_TICKS + lead(w) + PUSHES * TOK_ALONE + HEAVE_END + 1));
      const wrong: string[] = [];
      if (shut) wrong.push('vor dem Hau-ruck schon ein Weg in die Grotte');
      if (!r.s.openGates.includes(GATE)) wrong.push('Tor zu');
      if (r.s.heave) wrong.push('Hau-ruck nicht vorbei');
      const path = pathTo(w, r.s, wake);
      if (!path) wrong.push('kein Weg ins Höhlenbett');
      else {
        const walked = play(
          r.s,
          w,
          path.map((d) => ({ type: 'move', dir: d })),
        );
        if (w.realm(walked.s.player.x, walked.s.player.y) !== 'hoehle') wrong.push('nicht in der Grotte angekommen');
      }
      expect(wrong, `Seed ${seed}`).toEqual([]);
    },
  );
});

describe('Hau-ruck am Höhlentor: Bild und Ton (mitwachsen-heave-look.ts)', () => {
  const heave = (n: number, at = 0) => ({ gate: GATE, n, at });

  it('der Stein rollt in Dritteln (Werte von `stoneX`, `THIRDS`), nach dem dritten Stoß in die Nische, dann die Lampen', () => {
    expect(HEAVE_T.slice(0, 4)).toEqual([0, ...THIRDS.slice(1)]);
    const niche = stoneX(HEAVE_T[3]);
    for (const k of [1, 2] as const) expect(stoneX(HEAVE_T[k]) / niche).toBeCloseTo(k / 3, 2);
    expect(stoneX(1)).toBeCloseTo(niche, 6);
    expect(lampOn(HEAVE_T[3], 0)).toBe(false); // in der Nische: die Lampen noch aus
    expect(lampOn(HEAVE_T[4], 4)).toBe(true);
    expect(heaveAjar({ tick: 5 }, false)).toBeNull();
    expect(heaveAjar({ tick: 5, heave: heave(0) }, false)).toEqual([GATE, 0]);
    expect(heaveAjar({ tick: 0, heave: heave(1) }, false)).toEqual([GATE, 0]); // eben gestoßen: rollt los
    expect(heaveAjar({ tick: ROLL / 2, heave: heave(1) }, false)![1]).toBeCloseTo(HEAVE_T[1] / 2, 6);
    expect(heaveAjar({ tick: ROLL, heave: heave(1) }, false)).toEqual([GATE, HEAVE_T[1]]);
    expect(heaveAjar({ tick: ROLL, heave: heave(2) }, false)).toEqual([GATE, HEAVE_T[2]]);
    expect(heaveAjar({ tick: NICHE, heave: heave(3) }, false)).toEqual([GATE, HEAVE_T[3]]);
    expect(heaveAjar({ tick: LAMPS - 1, heave: heave(3) }, false)).toEqual([GATE, HEAVE_T[3]]);
    expect(heaveAjar({ tick: HEAVE_END, heave: heave(3) }, false)).toEqual([GATE, 1]);
    // bei reduzierter Bewegung springt er in Dritteln, die Lampen gehen alle zugleich an
    expect(heaveAjar({ tick: 0, heave: heave(1) }, true)).toEqual([GATE, HEAVE_T[1]]);
    expect(heaveAjar({ tick: 0, heave: heave(3) }, true)).toEqual([GATE, HEAVE_T[3]]);
    expect(heaveAjar({ tick: LAMPS, heave: heave(3) }, true)).toEqual([GATE, 1]);
    expect(view.ajar?.({ tick: ROLL, heave: heave(1) } as never, false)).toEqual([GATE, HEAVE_T[1]]);
  });

  it('in 3D gehen die Lampen paarweise an: Jeder Schritt, in dem das Torhaus neu gebaut wird, zündet höchstens ein Paar mehr', () => {
    // wie die 3D-Ansicht: der Grad aus `heaveAjar` je Takt, gerundet auf die Schritte des Torhauses (`openStep`)
    const lit = (t: number) => [0, 1, 2, 3, 4].filter((n) => lampOn(openStep('hoehle', t), n)).length;
    const seen: number[] = [];
    for (let tick = 0; tick <= HEAVE_END; tick++) seen.push(lit(heaveAjar({ tick, heave: heave(3) }, false)![1]));
    for (let i = 1; i < seen.length; i++) expect(seen[i]! - seen[i - 1]!, `Takt ${i}`).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < seen.length; i++) expect(seen[i]! - seen[i - 1]!, `Takt ${i}`).toBeLessThanOrEqual(1);
    expect(new Set(seen)).toEqual(new Set([0, 1, 2, 3, 4, 5])); // vom Mund (0) bis tief in den Gang, ein Paar nach dem anderen
    expect(seen.indexOf(1)).toBeGreaterThanOrEqual(LAMPS); // erst, wenn der Stein in der Nische liegt
    // die anderen Tore bleiben in Zehnteln
    expect(openStep('eis', 0.84)).toBe(0.8);
  });

  it('auf dem Stein eine große und eine kleine Hand im goldenen Rahmen, solange geschoben wird; danach Fledermaus und Glühwürmchen', () => {
    const g = W.gates.get(GATE)!;
    expect(heaveBodies({ tick: 0 }, W, AT)).toEqual([]);
    // im Vorspiel (ein Pfeil lässt nur hüpfen) noch kein Gold; ab seinem Ende und zwischen den Stößen die Hände
    expect(heaveBodies({ tick: 4, heave: heave(0, 5) }, W, AT)).toEqual([]);
    expect(heaveBodies({ tick: 5, heave: heave(0, 5) }, W, AT)).toHaveLength(1);
    expect(heaveBodies({ tick: 7, heave: heave(1, 5) }, W, AT)).toHaveLength(1);
    const [hands] = heaveBodies({ tick: 0, heave: heave(0) }, W, AT);
    expect(hands).toMatchObject({ id: 'heave:hands', parts: HANDS });
    expect(HANDS.filter((p) => p[6] === GOLD.side)).toHaveLength(4); // der Rahmen
    expect(Math.hypot(hands!.x - g.mid[0], hands!.y - g.mid[1])).toBeLessThan(1);
    // er rollt mit dem Stein ein Drittel weiter
    const [moved] = heaveBodies({ tick: ROLL, heave: heave(1) }, W, AT);
    expect(Math.hypot(moved!.x - hands!.x, moved!.y - hands!.y)).toBeCloseTo(4.375 / 3, 1);
    // nach dem dritten Stoß keine Hände mehr; ab `BAT` die Fledermaus und Glühwürmchen, bei reduzierter Bewegung nichts
    expect(heaveBodies({ tick: 1, heave: heave(3) }, W, AT)).toEqual([]);
    const fly = heaveBodies({ tick: BAT + 3, heave: heave(3) }, W, AT);
    expect(fly.map((b) => b.key)).toContain('heave-bat');
    expect(fly.filter((b) => b.key === 'heave-fly').length).toBeGreaterThan(0);
    expect(fly.every((b) => !b.id.startsWith('ride:'))).toBe(true); // nichts davon lässt sich antippen
    expect(heaveBodies({ tick: BAT + 3, heave: heave(3) }, W, { ...AT, reduced: true })).toEqual([]);
    expect(heaveBodies({ tick: HEAVE_END + 1, heave: heave(3) }, W, AT)).toEqual([]);
  });

  it('Töne in der C-Pentatonik: Trommel C3, E3 mit Geröll, beim Öffnen Akkord C–E–G, „plopp“, Lampen mit Echo, Zirpen; nie mehr als 4 Stimmen zugleich', () => {
    expect(heaveScore(0)).toEqual([]);
    expect(heaveScore(1).map((n) => n[0])).toEqual([130.81]);
    expect(heaveScore(2)[0]![0]).toBe(164.81);
    expect(heaveScore(2).length).toBeGreaterThan(1); // Geröll
    expect(heaveScore(3)).toEqual([]); // klingt mit dem Öffnen
    const open = openScore();
    expect(open.filter((n) => n[5] === 0).map((n) => n[0])).toEqual([261.63, 329.63, 392]);
    const lamps = open.filter((n) => n[5] >= 1 && n[5] < 2 && n[3] >= 0.05).map((n) => n[0]);
    expect(lamps).toEqual([440, 329.63, 523.25, 440]);
    const all = [...heaveScore(1), ...heaveScore(2), ...open];
    expect(all.filter((n) => !PENTA.has(semis(n[0])))).toEqual([]);
    // höchstens vier Stimmen zugleich (der Akkord klingt noch, wenn „plopp“ kommt; das Konzept erlaubt fünf)
    for (const score of [heaveScore(1), heaveScore(2), open])
      for (const n of score) {
        const at = n[5];
        const loud = score.filter((m) => m[5] <= at + 1e-9 && m[5] + m[1] > at + 1e-9).length;
        expect(loud, `bei ${at} s`).toBeLessThanOrEqual(4);
      }
    expect(Math.max(...open.map((n) => open.filter((m) => m[5] <= n[5] && m[5] + m[1] > n[5]).length))).toBe(4);
    expect(view.sky!.gateScore()).toEqual(open);
    expect(view.score!({ type: 'heave', x: 0, y: 0, n: 1 })).toEqual(heaveScore(1));
  });
});
