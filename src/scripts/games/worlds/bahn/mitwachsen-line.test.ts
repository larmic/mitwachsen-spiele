import { describe, expect, it } from 'vitest';
import { fromKey } from '../../../../lib/games/chunks';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { animalId, type Point } from '../../../../data/games/mitwachsen';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import { atHome } from '../../mitwachsen-meadow';
import { ALIGHT, SIGHT, stopsOf } from '../../mitwachsen-ride-kit';
import { withTok } from '../../mitwachsen-ride-save';
import type { End } from '../../mitwachsen-rider';
import { initialState, step as stepGame, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import { LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { Cell, Rail } from '../../mitwachsen-cell';
import { LICHTUNG_HOME } from '../../mitwachsen-home';
import { BESIDE, plateRow } from '../../mitwachsen-bay';
import { canStep, createWorld, type World } from '../../mitwachsen-world';
import {
  BAHN_PACK,
  BUILT,
  FAHRT_PACK,
  HOEHLE_PACK,
  SAMPLE_SEEDS,
  seedRange,
  seedsFor,
  worldOf,
} from '../../test-worlds';
import { bayAt, besideRay, centreOf, hutOf } from './mitwachsen-bear';
import { APPROACH, PORTAL_T, clean, joined } from './mitwachsen-line';
import { STONE_GAPS } from './mitwachsen-stones';
import { OPEN_TICKS, stationOf, stationBodies } from './mitwachsen-station-look';
import { LETTERS, STEPS, gridOf } from './mitwachsen-trace';
import { CARS, SEAT, TRAIN, lineOf as trackOf, train, trainRoute } from './mitwachsen-train';
import { ROOF_HALF, batPlatform, bearPlatform } from './mitwachsen-platform';
import { batBodies, batOf } from './mitwachsen-bat-look';
import { NEAR, capOf, shedIn } from './mitwachsen-build2';
import { withBuilt } from './mitwachsen-built';

/** Seeds, deren Grotte um eine Ecke liegt (wie in mitwachsen-grotte.test.ts): Dort biegt auch das Gleis im Gang ab */
const TURNED = [26, 30];
/** Eigenschafts-Tests über ganze Welten: wenige Seeds, im tiefen Lauf 20 und die gebogenen */
/** Gute Nacht, Bahn (Schmuck mit Zug): Liegt Bahnhof Bär in Sichtweite (`SIGHT`) des Lichtungsbetts? */
function bearInSight(w: World, r: NonNullable<ReturnType<typeof trainRoute>>): boolean {
  const [bx, by] = w.homes.lichtung.bed;
  const [sx, sy] = stopsOf(r).out.seat;
  return Math.max(Math.abs(sx - bx), Math.abs(sy - by)) <= SIGHT;
}

const SEEDS = seedsFor([...seedRange(1, 20), ...TURNED], [...SAMPLE_SEEDS, ...TURNED]);
/** Seed, auf dem zwei Felder vom Bahnhof Bär kein Platz für den Klangstein passt (aus einer Probe über Seeds 21–140) */
const BEAR_FAR = 38;
const key = ([x, y]: Point) => `${x},${y}`;
const step = ([x, y]: Point, l: string): Point => {
  const [dx, dy] = STEPS[LETTERS.indexOf(l)]!;
  return [x + dx, y + dy];
};
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

const TOK = animalId('hoehle', 'tok');
const TICK: Cmd = { type: 'tick' };
const heralds = (e: readonly GameEvent[], what: string) => e.filter((x) => x.type === 'herald' && x.what === what);
/** Wach auf dem Bahnsteig von Bahnhof Bär neben dem mittleren Wagen, nach dem Hau-ruck, samt Richtung zum Zug */
function onPlatformAfterHeave(w: World): { s: State; dir: Dir } | null {
  const st = stationOf(w);
  const row = st?.rows[SEAT];
  const lane = st?.line[SEAT];
  if (!row || !lane) return null;
  const dir = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(
    ([, [dx, dy]]) => row.edge[0] + dx === lane[0] && row.edge[1] + dy === lane[1],
  )?.[0];
  if (!dir) return null;
  const packs = withBuilt(withTok({}, { stage: 'offen' }), 1);
  const s0 = initialState(w, { packs, openGates: ['eis', 'hoehle'] });
  const player = { x: row.edge[0], y: row.edge[1], dir: 's' as const };
  return { s: { ...s0, sleeping: false, wokeAt: -100, player, animals: [] }, dir };
}

type Watched = { s: State; events: GameEvent[]; held: boolean; tokNear: boolean };

/** Einsteigen und fahren, bis die Figur ausgestiegen ist; dabei: Steht der Zug beim Klopfen am Prellbock, Tok daneben? */
function rideWatched(w: World, start: State, dir: Dir): Watched {
  const rules = [HOEHLE_PACK, BAHN_PACK, FAHRT_PACK];
  const cap = capOf(w);
  const buffer = trackOf(w, false).at(-1)!;
  const out: Watched = { s: start, events: [], held: true, tokNear: false };
  let sunk = false;
  const play = (c: Cmd) => {
    const r = stepGame(out.s, w, c, undefined, undefined, rules);
    out.s = r.state;
    out.events.push(...r.events);
    return r.events;
  };
  play(TICK); // Tok setzt sich in die Bucht
  play({ type: 'move', dir, fresh: true });
  for (let i = 0; i < 500 && out.s.ride; i++) {
    const now = play(TICK);
    const { work, ride } = out.s;
    if (work && work.to !== Infinity && ride && ride.pos !== cap) out.held = false;
    if (sunk || !heralds(now, 'sink').length) continue;
    sunk = true;
    const t = out.s.animals.find((a) => a.id === TOK);
    out.tokNear = !!t && cheb([t.x, t.y], buffer) <= NEAR;
  }
  // die Figur geht weiter (stünde sie auf seinem Weg, wartete der Maulwurf wie jedes heimkehrende Tier)
  const arrived = out.s;
  const wake = w.homes.lichtung.wake[0]!;
  out.s = { ...out.s, player: { x: wake[0], y: wake[1], dir: 's' } };
  const before = out.events.length;
  for (let i = 0; i < 400; i++) play(TICK);
  out.events.length = before;
  const mole = out.s.animals.find((a) => a.id === FIRST_MOLE);
  out.s = { ...arrived, animals: arrived.animals.map((a) => (a.id === FIRST_MOLE && mole ? mole : a)) };
  return out;
}

const AT = { now: 0, frac: 1, reduced: false, lit: false };
const MID = 'ride:hoehle:mid';
/** Rechts von einer Blickrichtung (wie in mitwachsen-station-look.ts): Tür +1 geht dorthin auf, −1 zur anderen Seite */
const RIGHT: Record<Dir, Point> = { e: [0, 1], w: [0, -1], s: [-1, 0], n: [1, 0] };

/** Die Figur kommt im Zug am Halt `end` an und steigt aus (Fahr-Engine, ein Takt nach `ALIGHT`); `inWay` steht im Weg */
function alighted(w: World, base: State, end: End, inWay?: Point): State {
  const r = trainRoute(w, base)!;
  const seat = r.stops[end];
  const animals = inWay ? [{ ...base.animals[0]!, id: 'im-weg', x: inWay[0], y: inWay[1] }] : [];
  const ride = { id: TRAIN.id, phase: 'arrive' as const, at: -ALIGHT, pos: r.path.length - 1, speed: 1, to: end };
  const s: State = {
    ...base,
    tick: 0,
    animals,
    player: { x: seat[0], y: seat[1], dir: 's' },
    ride: { ...ride, feast: false, jingleAt: 0, greeted: [] },
  };
  FAHRT_PACK.rules!.ride!([train]).tick(s, w, { push: () => 0 });
  return s;
}

/** Zu welcher Seite des Gleises geht die Tür des mittleren Wagens auf (angestoßen oder, `nudge` false, ohne)? [0, 0]: zu */
function doorSide(w: World, s: State, nudge = true): Point {
  const look = nudge ? { ...s, nudged: { id: TRAIN.id, at: s.tick } } : s;
  const mid = stationBodies(look, w, AT).find((b) => b.id === MID);
  const open = Number(/^ride:hoehle:mid:[01](-?1|0)/.exec(mid?.key ?? '')?.[1] ?? 0);
  const [rx, ry] = mid ? RIGHT[mid.dir] : [0, 0];
  return [open * rx, open * ry];
}

/**
 * Was am Aussteigen an beiden Bahnhöfen nicht stimmt (Rückmeldung zur Höhle, Punkt 2): Der Zug ist da (an Bahnhof Bär
 * nach Bau 1, an Bahnhof Fledermaus nach Bau 2 mit offenem Höhlentor), die Figur sitzt am Halt, und die Fahr-Engine lässt
 * sie aussteigen. Sie steht dann auf dem eigenen Bahnsteig an der Tür (dem Feld an der Kante neben dem Sitz), nie auf
 * einer Torplatte, und entlang des Gleises weiter als die halbe Breite des Dachs (`ROOF_HALF`) von seiner Mitte (Körper
 * `bahn:dach` bzw. `bahn:felsdach`); steht dort ein Tier, auf einem anderen Feld des Bahnsteigs, ebenso frei vom Dach.
 * Gleich nach dem Aussteigen steht die Tür zum eigenen Bahnsteig offen (ohne Anstoßen), nach `OPEN_TICKS` ist sie zu;
 * angestoßen geht sie ebenso zum eigenen Bahnsteig auf. Ohne Gleis (Seed 33) nichts zu prüfen
 */
function exitFaults(w: World): string[] {
  const bad: string[] = [];
  const packs = withBuilt(withTok({}, { stage: 'offen' }), 2);
  const base = { ...initialState(w, { packs, openGates: ['eis', 'hoehle'] }), sleeping: false, wokeAt: -100 };
  const r = trainRoute(w, base);
  if (!r) return [];
  const bodies = [...stationBodies(base, w, AT), ...batBodies(w)];
  for (const [end, st, roof] of [
    ['out', bearPlatform(w), 'bahn:dach'],
    ['home', batPlatform(w), 'bahn:felsdach'],
  ] as const) {
    const top = bodies.find((b) => b.id === roof);
    const door = st?.rows[st.lane.findIndex((p) => key(p) === key(r.stops[end]))]?.edge;
    if (!st || !top || !door) {
      bad.push(`${end}: kein Bahnsteig, Dach oder Tür`);
      continue;
    }
    const [ax, ay] = [st.lane[1]![0] - st.lane[0]![0], st.lane[1]![1] - st.lane[0]![1]];
    const along = (p: Point) => Math.abs((p[0] - top.x) * ax + (p[1] - top.y) * ay);
    for (const inWay of [undefined, door]) {
      const s = alighted(w, base, end, inWay);
      const at: Point = [s.player.x, s.player.y];
      const what = `${end}${inWay ? ' (Tür besetzt)' : ''}`;
      if (s.ride) bad.push(`${what}: nicht ausgestiegen`);
      if (!inWay && key(at) !== key(door)) bad.push(`${what}: nicht an der Tür ${key(at)}`);
      if (w.cell(...at).stop !== 'hoehle') bad.push(`${what}: nicht auf dem Bahnsteig ${key(at)}`);
      if (w.cell(...at).plate) bad.push(`${what}: auf der Torplatte`);
      if (along(at) <= ROOF_HALF) bad.push(`${what}: unter dem Dach (${along(at).toFixed(2)} Felder von der Mitte)`);
    }
    // beim Aussteigen und angestoßen geht die Tür des mittleren Wagens zum eigenen Bahnsteig auf (nicht zur Seite von
    // Bahnhof Bär); nach dem Aussteigen nur kurz
    const off = alighted(w, base, end);
    const out = doorSide(w, off, false);
    if (key(out) !== key(st.side)) bad.push(`${end}: Tür beim Aussteigen zur Seite ${key(out)}`);
    const later = doorSide(w, { ...off, tick: off.tick + OPEN_TICKS }, false);
    if (key(later) !== key([0, 0])) bad.push(`${end}: Tür bleibt nach dem Aussteigen offen`);
    const side = doorSide(w, off);
    if (key(side) !== key(st.side)) bad.push(`${end}: Tür zur Seite ${key(side)}`);
  }
  return bad;
}

/**
 * Bau 2 als ganze Fahrt in einer Welt (wie in mitwachsen-build2.test.ts, dort an Seed 1 im Einzelnen): nach dem Hau-ruck
 * wach auf dem Bahnsteig von Bahnhof Bär, einsteigen und fahren, bis die Figur in der Grotte ausgestiegen ist; der
 * Maulwurf danach 400 Takte später, während sie an ihrem Bett steht. Gespielt in der schon gebauten Welt des Ausbaus 2:
 * Ihre Felder sind die, die `relay` zum Augenblick `pop` baut (die Strecke liegt bis dahin wie bei Ausbau 1); das spart
 * je Seed zwei Neubauten. Fehler gesammelt
 */
function build2Ride(w: World): string[] {
  const start = onPlatformAfterHeave(w);
  if (!start) return ['kein Einstieg an Bahnhof Bär'];
  const { s, events, held, tokNear } = rideWatched(w, start.s, start.dir);
  const bad: string[] = [];
  for (const what of ['sink', 'pop', 'board'])
    if (heralds(events, what).length !== 1) bad.push(`${what} ${heralds(events, what).length}×`);
  if (!held) bad.push('der Zug stand beim Klopfen nicht am Prellbock');
  if (!tokNear) bad.push('Tok klopfte nicht neben dem Prellbock');
  if (s.ride || w.realm(s.player.x, s.player.y) !== 'hoehle') bad.push('nicht in der Grotte');
  if (!events.some((e) => e.type === 'home' && e.id === FIRST_MOLE)) bad.push('Maulwurf zog nicht ein');
  if (!s.garden.some((a) => a.id === FIRST_MOLE)) bad.push('Maulwurf nicht im Gehege');
  const tok = s.animals.find((a) => a.id === TOK);
  const home = shedIn(w).home;
  if (!tok?.solo || !home || tok.x !== home[0] || tok.y !== home[1]) bad.push('Tok nicht im Lokschuppen');
  const mole = s.animals.find((a) => a.id === FIRST_MOLE);
  if (!mole || !atHome(w, mole.home, mole.x, mole.y)) bad.push(`Maulwurf nicht am Höhlenbett (${mole?.x}, ${mole?.y})`);
  return bad;
}

type Laid = { cells: Point[]; rails: Rail[]; c: (p: Point) => Cell };

/** Die Linie aus den Feldern der Welt: vom Prellbock in der Bucht zurück bis Bahnhof Bär, dann vorwärts bis zum Ende */
function lineOf(w: World): Laid {
  const g = w.gates.get('hoehle')!;
  const c = (p: Point) => w.cell(...p);
  const buffer = bayAt(g)(LINE.lane, -1);
  const back: Point[] = [];
  for (let p = buffer; c(p).rail && back.length < 400;) {
    back.push(p);
    const r = c(p).rail!;
    if (back.length > 1 && r.to.length < 2) break;
    p = step(p, r.to[0]!);
  }
  const fwd: Point[] = [];
  const first = c(buffer).rail;
  if (first && first.to.length === 2)
    for (let p = step(buffer, first.to[1]!); c(p).rail && fwd.length < 400;) {
      fwd.push(p);
      const r = c(p).rail!;
      if (r.to.length < 2) break;
      p = step(p, r.to[1]!);
    }
  const cells = [...back.reverse(), ...fwd];
  return { cells, rails: cells.map((p) => c(p).rail!), c };
}

/** Felder, die man vom Bett `wake` aus erreicht, ohne `blocked` zu betreten (offen: `open`) */
function reach(w: World, wake: readonly Point[], blocked: ReadonlySet<string>, open: string[] = []) {
  const seen = new Set<string>(wake.map(key));
  const queue = [...wake];
  for (let i = 0; i < queue.length && seen.size < 60000; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of STEPS) {
      const q: Point = [x + dx, y + dy];
      if (seen.has(key(q)) || blocked.has(key(q)) || !canStep(w, open as never[], x, y, ...q)) continue;
      seen.add(key(q));
      queue.push(q);
    }
  }
  return seen;
}

/** So viele Schritte braucht man vom Bett (`wake`) bis zum nächsten Feld aus `goal` (−1: gar nicht) */
function stepsTo(w: World, wake: readonly Point[], goal: ReadonlySet<string>) {
  const dist = new Map<string, number>(wake.map((p) => [key(p), 0]));
  const queue = [...wake];
  for (let i = 0; i < queue.length && dist.size < 60000; i++) {
    const [x, y] = queue[i]!;
    const d = dist.get(key([x, y]))!;
    if (goal.has(key([x, y]))) return d;
    for (const [dx, dy] of STEPS) {
      const q: Point = [x + dx, y + dy];
      if (dist.has(key(q)) || !canStep(w, [], x, y, ...q)) continue;
      dist.set(key(q), d + 1);
      queue.push(q);
    }
  }
  return -1;
}

/** Felder eines Bahnsteigs (`Cell.stop`) in der Gegend `realm` rund um die Linie */
function platformOf(laid: Laid, realm: Cell['region']): Point[] {
  const out = new Map<string, Point>();
  for (const p of laid.cells)
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const q: Point = [p[0] + dx, p[1] + dy];
        const cell = laid.c(q);
        if (cell.stop === 'hoehle' && cell.region === realm) out.set(key(q), q);
      }
  return [...out.values()];
}

/**
 * Was am Klangstein `id` der Bahn nicht stimmt: Feld, mindestens zwei Felder vom Gleis, genau `gap` Felder von den
 * Feldern `near` (Bahnhof oder Lokschuppen), ringsum frei und eben, von `free` (erreichbar vom Bett) aus zu erreichen
 */
function stoneFaults(
  w: World,
  laid: Laid,
  id: 'bahnhof' | 'lokschuppen',
  free: Set<string>,
  near: Point[],
  gaps: readonly number[],
) {
  const p = w.stones.get(id);
  if (!p) return [`kein Stein ${id}`];
  const bad: string[] = [];
  const c = w.cell(...p);
  if (c.deco !== 'klangstein' || c.story !== id || !c.solid) bad.push(`${id}: Feld`);
  if (laid.cells.some((q) => cheb(q, p) < 2)) bad.push(`${id}: zu nah am Gleis`);
  if (!gaps.includes(Math.min(...near.map((q) => cheb(q, p))))) bad.push(`${id}: nicht am Bahnhof oder Schuppen`);
  const ring = [-1, 0, 1].flatMap((dy) =>
    [-1, 0, 1].flatMap((dx): Point[] => (dx || dy ? [[p[0] + dx, p[1] + dy]] : [])),
  );
  const open = (q: Point) => !w.cell(...q).solid && w.cell(...q).ground !== 'water' && w.cell(...q).h === c.h;
  if (!ring.every(open) || ring.some((q) => w.cell(...q).ride)) bad.push(`${id}: ringsum nicht frei`);
  if (!ring.some((q) => free.has(key(q)))) bad.push(`${id}: nicht erreichbar`);
  return bad;
}

/**
 * Was an den Klangsteinen der Bahn nicht stimmt: am Bahnhof Bär zwei Felder von Bahnsteig und Gleis (notfalls drei oder
 * vier, `STONE_GAPS`), am Kopf bei Toks Häuschen; am Lokschuppen ein Feld daneben; beide erreichbar und frei umgehbar
 */
function trainStoneFaults(w: World, laid: Laid) {
  const bear = stationOf(w);
  const station = bear ? [...bear.line.slice(0, LINE.bear.long), ...bear.rows.flatMap((r) => [r.edge, r.back])] : [];
  const bad = [
    ...stoneFaults(w, laid, 'bahnhof', reach(w, w.homes.lichtung.wake, new Set()), station, STONE_GAPS),
    ...stoneFaults(w, laid, 'lokschuppen', reach(w, w.homes.hoehle.wake, new Set()), shedIn(w).cells, [1]),
  ];
  // am Kopf des Bahnhofs bei Toks Häuschen, fern vom Bett: näher am Häuschen als am anderen Ende des Bahnsteigs
  const stone = w.stones.get('bahnhof');
  const hut = bear?.hut;
  const other = hut && bear.rows[hut.row === 0 ? bear.rows.length - 1 : 0]?.back;
  const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (!stone || !hut || !other || dist(stone, hut.at) >= dist(stone, other)) bad.push('bahnhof: nicht am Häuschen');
  return bad;
}

/** Was an einem Feld von Bahnhof Bär nicht stimmt: Lichtung, trocken, frei, außerhalb des Portalrings, nichts Gemiedenes nah */
function siteFaults(laid: Laid, p: Point, bed: Point, hut?: Point): string[] {
  const bad: string[] = [];
  const cell = laid.c(p);
  const solid = cell.solid && (!hut || key(p) !== key(hut)); // Toks Häuschen ist fest
  if (cell.ground === 'water' || solid || cell.region !== 'lichtung') bad.push(`Feld ${key(p)}`);
  if (Math.hypot(p[0] - bed[0], p[1] - bed[1]) < LINE.bear.ring) bad.push(`${key(p)} im Portalring`);
  const near = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => laid.c([p[0] + dx, p[1] + dy])));
  if (near.some((n) => n.portal || n.garden || n.plate || n.deco === 'klangstein' || n.ground === 'water'))
    bad.push(`${key(p)} zu nah an etwas`);
  return bad;
}

/** So viele Felder sind in `a` anders als in `b`: die Lichtung bis 60 Felder ums Bett und die Spur u −2 hinter dem Tor */
function unlike(a: World, b: World) {
  const g = a.gates.get('hoehle')!;
  const cells = [
    ...Array.from({ length: 121 * 121 }, (_, i): Point => [(i % 121) - 60, Math.floor(i / 121) - 60]),
    ...Array.from({ length: 40 }, (_, t) => bayAt(g)(LINE.lane, g.deep + t)),
  ];
  return cells.filter((p) => JSON.stringify(a.cell(...p)) !== JSON.stringify(b.cell(...p))).length;
}

describe('Gleis der Höhlenbahn als Boden (Paket der Bahn)', () => {
  it('gesucht wird nur, wo Anfang und Ziel über freie Felder zusammenhängen (joined)', () => {
    const rows = ['11#11', '11#11', '11111'];
    const g = gridOf(0, 0, 4, 2, (x, y) => (rows[y]![x] === '#' ? null : [1, 0]));
    expect(joined(g, [0, 0], [4, 0])).toBe(true); // unten herum
    const walled = gridOf(0, 0, 4, 2, (x) => (x === 2 ? null : [1, 0]));
    expect(joined(walled, [0, 0], [4, 0])).toBe(false);
    expect(joined(walled, [2, 0], [4, 0])).toBe(false); // Anfang zu
  });

  it('ohne das Paket der Bahn liegt nirgends Gleis', () => {
    const w = worldOf(SEEDS[0]!, [HOEHLE_PACK]);
    const g = w.gates.get('hoehle')!;
    const lane = Array.from({ length: APPROACH }, (_, i) => bayAt(g)(LINE.lane, -1 - i));
    expect(lane.some((p) => w.cell(...p).ride || w.cell(...p).rail)).toBe(false);
  });

  it('vor Ausbau 1 legt das Paket nichts: Lichtung und Grotte Feld für Feld wie ohne das Paket der Bahn', () => {
    // frisch gebaut, nicht über worldOf: Die Welten bleiben nicht im Speicher (der tiefe Lauf hält schon 20 mit Gleis)
    const bad = SAMPLE_SEEDS.slice(0, 1).flatMap((seed) => {
      const plain = createWorld(seed, [HOEHLE_PACK]);
      return [{}, { bahn: { built: 0 } }].flatMap((saved) => {
        const diff = unlike(createWorld(seed, [HOEHLE_PACK, BAHN_PACK], saved), plain);
        return diff ? [`Seed ${seed}, ${JSON.stringify(saved)}: ${diff} Felder anders`] : [];
      });
    });
    expect(bad).toEqual([]);
  });

  it(`Seed ${BEAR_FAR}: zwei Felder vom Bahnhof Bär passt kein Feld, der Stein steht drei oder vier Felder weit, erreichbar`, () => {
    // frisch gebaut, nicht über worldOf: Die Welt bleibt nicht im Speicher
    const w = createWorld(BEAR_FAR, [HOEHLE_PACK, BAHN_PACK], BUILT);
    expect(trainStoneFaults(w, lineOf(w)), `Seed ${BEAR_FAR}`).toEqual([]);
  });

  for (const seed of SEEDS) {
    const w = worldOf(seed, [HOEHLE_PACK, BAHN_PACK], BUILT);
    const laid = lineOf(w);
    const g = w.gates.get('hoehle')!;
    const at = bayAt(g);
    const buffer = laid.rails.findIndex((r) => r.part === 'buffer');

    it(`Seed ${seed}: eine Linie von Bahnhof Bär durch die Bucht bis zum Bahnhof Fledermaus, Ausbau 1 bis zum Prellbock`, () => {
      const bad: string[] = [];
      if (laid.cells.length < 40) bad.push(`nur ${laid.cells.length} Felder`);
      if (laid.rails[0]?.part !== 'end' || laid.rails.at(-1)?.part !== 'end') bad.push('ohne Prellbock an den Enden');
      if (key(laid.cells[buffer] ?? [0, 0]) !== key(at(LINE.lane, -1))) bad.push('Prellbock nicht vor der Tür');
      if (laid.rails.some((r, i) => r.stage !== (i <= buffer ? 1 : 2)))
        bad.push('Ausbau nicht 1 bis zum Prellbock, dann 2');
      if (laid.c(laid.cells[0]!).region !== 'lichtung') bad.push('Anfang nicht auf der Lichtung');
      if (laid.c(laid.cells.at(-1)!).region !== 'hoehle') bad.push('Ende nicht in der Grotte');
      if (!laid.cells.every((p) => laid.c(p).ride === 'hoehle')) bad.push('Felder ohne Strecke');
      // nur Lichtung, Gang und Grotte (das Tor auf seiner Spur u −2)
      const door = key(at(LINE.lane, 0));
      const where = laid.cells.filter(
        (p) => !['lichtung', 'hoehle', 'wild'].includes(laid.c(p).region) && key(p) !== door,
      );
      if (where.length) bad.push(`außerhalb von Lichtung und Grotte: ${where.map(key).join(' ')}`);
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: rechtwinklig, mindestens ${LINE.straight} Felder Gerade zwischen Kurven, Rampen höchstens 1 je ${LINE.ramp}`, () => {
      const bad: string[] = [];
      if (!clean(laid.cells)) bad.push('Felder nicht als Kette, doppelt oder sich berührend');
      const corners: number[] = [];
      for (let i = 1; i < laid.cells.length - 1; i++) {
        const [a, b, c] = [laid.cells[i - 1]!, laid.cells[i]!, laid.cells[i + 1]!];
        if (a[0] - b[0] !== b[0] - c[0] || a[1] - b[1] !== b[1] - c[1]) corners.push(i);
      }
      for (let k = 1; k < corners.length; k++)
        if (corners[k]! - corners[k - 1]! - 1 < LINE.straight)
          bad.push(`Kurven bei ${corners[k - 1]} und ${corners[k]}`);
      const hs = laid.cells.map((p) => laid.c(p).h);
      const changes = hs.flatMap((h, i) => (i > 0 && h !== hs[i - 1] ? [i] : []));
      if (hs.some((h, i) => i > 0 && Math.abs(h - hs[i - 1]!) > 1)) bad.push('Stufe höher als eins');
      for (let k = 1; k < changes.length; k++)
        if (changes[k]! - changes[k - 1]! < LINE.ramp) bad.push(`Stufen bei ${changes[k - 1]} und ${changes[k]}`);
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Bahnhof Bär 2 × 7 neben dem Gleis, ${LINE.bear.r.join('–')} Felder vom Bett, ${LINE.bear.angle.join('–')}° neben dem Strahl zum Tor, ${LINE.bear.steps.join('–')} Schritte`, () => {
      const platform = platformOf(laid, 'lichtung');
      const lane = laid.cells.slice(0, LINE.bear.long);
      const bed = LICHTUNG_HOME.bed;
      const bad: string[] = [];
      if (platform.length !== LINE.bear.long * LINE.bear.wide) bad.push(`Bahnsteig ${platform.length} Felder`);
      if (!lane.every((p) => platform.some((q) => cheb(p, q) === 1 && (p[0] === q[0] || p[1] === q[1]))))
        bad.push('Gleis nicht am Bahnsteig');
      const station = [...lane, ...platform];
      // das Gleis eben, der Bahnsteig eine Stufe darüber, Toks Häuschen am Kopf fest (hinten, am Ende fern vom Bett)
      const h = laid.c(lane[0]!).h;
      if (!lane.every((p) => laid.c(p).h === h)) bad.push('Gleis am Bahnhof nicht eben');
      if (!platform.every((p) => laid.c(p).h === h + 1)) bad.push('Bahnsteig nicht eine Stufe über dem Gleis');
      const hut = hutOf({ lane, platform }, bed);
      const solid = platform.filter((p) => laid.c(p).solid).map(key);
      if (!hut || solid.join() !== key(hut.at))
        bad.push(`fest: ${solid.join(' ')} statt Häuschen ${hut && key(hut.at)}`);
      if (hut && ![0, LINE.bear.long - 1].includes(hut.row)) bad.push('Häuschen nicht am Kopf');
      const c = centreOf({ lane, platform });
      const r = Math.hypot(c[0] - bed[0], c[1] - bed[1]);
      const deg = besideRay(c, g, bed);
      const { bear } = LINE;
      if (r < bear.r[0] || r > bear.r[1] || deg < bear.angle[0] || deg > bear.angle[1])
        bad.push(`Mitte ${r.toFixed(1)} Felder, ${deg.toFixed(0)}°`);
      const steps = stepsTo(w, LICHTUNG_HOME.wake, new Set(platform.map(key)));
      if (steps < bear.steps[0] || steps > bear.steps[1]) bad.push(`${steps} Schritte vom Bett`);
      bad.push(...station.flatMap((p) => siteFaults(laid, p, bed, hut?.at)));
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Bahnhof Bär im Bild: 7 Reihen, Häuschen am Kopf, der Zug hält am Bahnsteig, das Tunnelportal liegt dahinter`, () => {
      const st = stationOf(w);
      if (!st) return expect(st, `Seed ${seed}`).not.toBeNull();
      const bad: string[] = [];
      if (st.rows.length !== LINE.bear.long) bad.push(`${st.rows.length} Reihen`);
      if (!st.hut || !w.cell(...st.hut.at).solid) bad.push('Häuschen nicht fest');
      if (!(st.portal! > LINE.bear.long)) bad.push(`Tunnelportal bei ${st.portal}`);
      // der Zug am Bahnsteig (Ausbau 1, Tok im Wagen): alle Wagen über dem Gleis neben dem Bahnsteig
      // was das Bild vom Zustand liest (ohne `initialState`, das alle Tiere der Welt aufstellt)
      const s = {
        packs: { bahn: { built: 1 }, fahrt: { hoehle: { stage: 'bereit' } } },
        player: { x: 1e6, y: 1e6, dir: 's' },
        animals: [],
        openGates: [],
        tick: 0,
      } as unknown as State;
      const lane = new Set(st.line.slice(0, LINE.bear.long).map(key));
      const cars = stationBodies(s, w, { now: 0, frac: 0, reduced: true, lit: false }).filter((b) =>
        /^ride:hoehle:(loco|mid|rear)$/.test(b.id),
      );
      if (cars.length !== 3) bad.push(`${cars.length} Wagen`);
      for (const c of cars)
        if (!lane.has(key([Math.round(c.x), Math.round(c.y)]))) bad.push(`${c.id} nicht am Bahnsteig`);
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: freier Weg vom Bett zum Bahnsteig, Fußweg zur Torplatte frei, keine Plattform berührt`, () => {
      const track = new Set(laid.cells.map(key));
      const stops = platformOf(laid, 'lichtung');
      const free = reach(w, LICHTUNG_HOME.wake, track);
      const bad: string[] = [];
      if (!stops.some((p) => free.has(key(p)))) bad.push('Bahnsteig nur über das Gleis');
      // der Fußweg zur Torplatte: ohne das Gleis zu betreten und mit zwei Feldern Abstand zum Bahnhof
      const station = [...laid.cells.slice(0, LINE.bear.long), ...stops];
      const around = station.flatMap(([x, y]) =>
        [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => key([x + dx, y + dy]))),
      );
      const walkway = reach(w, LICHTUNG_HOME.wake, new Set([...track, ...around]));
      if (!walkway.has(key(at(0, -2)))) bad.push('Torplatte nur über Gleis oder nah am Bahnhof');
      const touched = laid.cells.filter((p) => {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (laid.c([p[0] + dx, p[1] + dy]).portal) return true;
        return false;
      });
      if (touched.length) bad.push(`an Plattformen: ${touched.map(key).join(' ')}`);
      const pond = laid.cells.filter((p) => laid.c(p).ground === 'water' || laid.c(p).solid);
      if (pond.some((p) => key(p) !== key(at(LINE.lane, 0)))) bad.push('Gleis auf Wasser oder Festem');
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: auf der Lichtung nie auf oder neben Wiese, Trögen, Unterstand, Pilz, Plattformen, Torplatten, Klangsteinen`, () => {
      const fixed = new Set(Array.from({ length: APPROACH }, (_, i) => key(at(LINE.lane, -1 - i))));
      const avoided = (n: Cell) =>
        !!n.garden ||
        !!n.roof ||
        !!n.portal ||
        n.deco === 'trough' ||
        n.deco === 'watertrough' ||
        n.deco === 'shelterpilz' ||
        n.deco === 'klangstein';
      const bad = laid.cells
        .filter((p) => laid.c(p).region === 'lichtung')
        .filter((p) =>
          [-1, 0, 1].some((dy) =>
            [-1, 0, 1].some((dx) => {
              const n = laid.c([p[0] + dx, p[1] + dy]);
              // die feste Spur u −2 der Bucht liegt mit Absicht neben der Torplatte (u −1 … 1), nie auf ihr
              return avoided(n) || (!!n.plate && (!fixed.has(key(p)) || (dx === 0 && dy === 0)));
            }),
          ),
        )
        .map(key);
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: in der Bucht nur auf der Spur u ${LINE.lane}, davor Einschnitt und Tunnelportal`, () => {
      const bad: string[] = [];
      const plate = [-1, 0, 1].map((u) => key(plateRow(g, u)));
      const tok = key(plateRow(g, BESIDE));
      for (let t = -1; t >= -3; t--)
        for (let u = -6; u <= 6; u++) {
          const onTrack = laid.cells.some((p) => key(p) === key(at(u, t)));
          if (onTrack !== (u === LINE.lane)) bad.push(`Bucht u ${u}, t ${t}`);
        }
      if (laid.cells.some((p) => plate.includes(key(p)) || key(p) === tok)) bad.push('auf Torplatte oder Toks Platz');
      const parts = new Map(laid.cells.map((p, i) => [key(p), laid.rails[i]!.part]));
      if (parts.get(key(at(LINE.lane, PORTAL_T))) !== 'portal') bad.push('kein Tunnelportal');
      for (let i = 1; i <= LINE.cut; i++)
        if (parts.get(key(at(LINE.lane, PORTAL_T + i))) !== 'cut') bad.push(`kein Einschnitt in Reihe ${PORTAL_T + i}`);
      for (let t = -1; t >= -APPROACH; t--) if (!parts.has(key(at(LINE.lane, t)))) bad.push(`Spur endet bei ${t}`);
      // im Gang belegt das Gleis eines von fünf Feldern, auf derselben Spur
      for (let t = 0; t <= g.deep; t++) {
        const row = [-2, -1, 0, 1, 2].filter((u) => parts.has(key(at(u, t))));
        if (row.join() !== `${LINE.lane}`) bad.push(`Gang Reihe ${t}: ${row.join()}`);
      }
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: in der Grotte bis an den Bahnhof Fledermaus (12–16 Schritte vor dem Höhlenbett); Wege vom Höhlenbett zum Bahnsteig und zum Tor frei`, () => {
      const platform = platformOf(laid, 'hoehle');
      const lane = laid.cells.slice(-LINE.bear.long);
      const home = w.homes.hoehle;
      const track = new Set(laid.cells.map(key));
      const bad: string[] = [];
      if (platform.length !== LINE.bear.long * LINE.bear.wide) bad.push(`Bahnsteig ${platform.length} Felder`);
      if (!lane.every((p) => platform.some((q) => cheb(p, q) === 1 && (p[0] === q[0] || p[1] === q[1]))))
        bad.push('Gleis nicht am Bahnsteig');
      const near = (p: Point) => Math.hypot(p[0] - home.bed[0], p[1] - home.bed[1]);
      const plat = platform.reduce((m, p) => Math.min(m, near(p)), Infinity);
      if (lane.some((p) => near(p) < plat)) bad.push('Gleis auf der Seite zum Höhlenbett');
      const free = reach(w, home.wake, track);
      if (!platform.some((p) => free.has(key(p)))) bad.push('Bahnsteig nur über das Gleis');
      const steps = stepsTo(w, home.wake, new Set(platform.map(key)));
      if (steps < 12 || steps > 16) bad.push(`${steps} Schritte vom Höhlenbett`);
      if (!free.has(key(at(0, g.deep)))) bad.push('Mündung des Gangs nur über das Gleis');
      const portal = [...w.portals.values()].flatMap((p) => [p.gate, p.home]);
      if (laid.cells.some((p) => portal.some((q) => cheb(p, q) <= 2))) bad.push('an einer Plattform');
      if (laid.cells.some((p) => laid.c(p).garden)) bad.push('auf der Mooswiese');
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Bau 2: Bahnhof Fledermaus eine Stufe über dem Gleis, Lokschuppen daneben mit fester Rückwand, Toks Platz und der Siebenschläfer darin erreichbar`, () => {
      const bad: string[] = [];
      const st = batOf(w);
      if (!st || st.rows.length !== LINE.bear.long) bad.push('kein Bahnsteig');
      const shed = shedIn(w);
      if (!shed.cells.length || !shed.wall.length) bad.push('kein Lokschuppen');
      if (shed.wall.some((p) => !w.cell(...p).solid)) bad.push('Rückwand nicht fest');
      const track = new Set(laid.cells.map(key));
      const free = reach(w, w.homes.hoehle.wake, track);
      if (!shed.home || !free.has(key(shed.home))) bad.push('Toks Platz nicht erreichbar');
      if (shed.cells.some((p) => track.has(key(p)))) bad.push('Lokschuppen auf dem Gleis');
      const dormouse = w.spawns.get('hoehle:siebenschlaefer');
      if (!dormouse || w.cell(...dormouse).shed !== 'hoehle' || !free.has(key(dormouse)))
        bad.push('Siebenschläfer nicht im Schuppen');
      if (dormouse && shed.home && key(dormouse) === key(shed.home)) bad.push('Siebenschläfer auf Toks Platz');
      if (!batBodies(w).some((b) => b.id === 'bahn:schuppen')) bad.push('Lokschuppen nicht im Bild');
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Klangsteine der Bahn: am Bahnhof Bär neben Toks Häuschen, am Lokschuppen; je zwei Felder vom Gleis, frei umgehbar`, () => {
      expect(trainStoneFaults(w, laid), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Aussteigen sichtbar: an Bahnhof Bär und Fledermaus auf den eigenen Bahnsteig, an der Tür, nie unter dem Dach`, () => {
      expect(exitFaults(w), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Bau 2 als ganze Fahrt: Tok klopft am Prellbock, der Zug fährt bis Bahnhof Fledermaus, der Maulwurf zieht ein und läuft heim, Tok im Lokschuppen`, () => {
      expect(build2Ride(w), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Gute Nacht, Bahn: Bahnhof Bär liegt in Sichtweite des Lichtungsbetts`, () => {
      const shut = trainRoute(w, {
        packs: { bahn: { built: 2 }, fahrt: { hoehle: { stage: 'bereit' } } },
        openGates: [],
      });
      expect({ seed, ok: !shut || bearInSight(w, shut) }).toEqual({ seed, ok: true });
    });

    it(`Seed ${seed}: Strecke des Zugs (Fahren): bis zum Prellbock bzw. Bahnhof Fledermaus, Wagen auf dem Gleis, Bank auf dem Bahnsteig, jede Fahrt 15–20 s mit höchstens 8 Feldern je Sekunde`, () => {
      const bad: string[] = [];
      const ready = { bahn: { built: 2 }, fahrt: { hoehle: { stage: 'bereit' } } };
      const shut = trainRoute(w, { packs: ready, openGates: [] });
      const open = trainRoute(w, { packs: ready, openGates: ['hoehle'] });
      if (!shut || !open) bad.push('keine Strecke');
      const plate = new Set([-1, 0, 1].map((u) => key(plateRow(g, u))));
      for (const [name, r] of [
        ['Bucht', shut],
        ['Grotte', open],
      ] as const) {
        if (!r) continue;
        const cars = [...r.cars!.home, ...r.cars!.out];
        if (cars.length !== 2 * CARS || cars.some((p) => !w.cell(...p).rail))
          bad.push(`${name}: Wagen nicht auf dem Gleis`);
        if (r.path.some((p) => plate.has(key(p)) || key(p) === key(plateRow(g, BESIDE))))
          bad.push(`${name}: über die Platte`);
        if (!r.seats.out.length || r.seats.out.some((p) => w.cell(...p).stop !== 'hoehle')) bad.push(`${name}: Bank`);
        if (r.seats.home.some((p) => plate.has(key(p)) || r.on.has(key(p)))) bad.push(`${name}: Warteplatz`);
        if (![...r.dark!].some((k) => w.cell(...fromKey(k)).rail?.part === 'portal')) bad.push(`${name}: kein Tunnel`);
      }
      if (shut && w.realm(...shut.stops.home) !== 'lichtung') bad.push('Ausbau 1 nicht in der Bucht');
      if (open) {
        if (w.realm(...open.stops.home) !== 'hoehle') bad.push('nicht bis in die Grotte');
        if (!open.seats.home.some((p) => w.cell(...p).stop === 'hoehle')) bad.push('kein Steinbahnsteig');
      }
      // Dauer wie `rideTicks` in worlds/fahrt/mitwachsen-ride.ts (Pakete importieren einander nicht, auch ihre Tests
      // nicht): in `TRAIN.ticks` gehalten (15–20 s). Gemessen (Seeds 1 bis 20): bis zum Prellbock 63 bis 91 Felder (gut 4
      // bis 6 Felder je s), bis Bahnhof Fledermaus 105 bis 165 Felder; schneller als gut 8 Felder je s wird es nie
      const [lo, hi] = TRAIN.ticks;
      for (const r of [shut, open]) {
        if (!r) continue;
        const len = r.path.length - 1;
        const t = Math.min(hi, Math.max(lo, Math.round(len / TRAIN.pace!)));
        if (len / t > TRAIN.pace! * 1.05) bad.push(`${len} Felder in ${t / 10} s`);
      }
      expect(bad, `Seed ${seed}`).toEqual([]);
    });
  }

  // Aussteigen sichtbar über 10 Seeds, im tiefen Lauf 1 bis 40 (wie die Messung der Konzeptseite): die oben nicht schon
  // gebauten frisch, nicht über worldOf, damit sie nicht im Speicher bleiben (der tiefe Lauf hält schon 22 mit Gleis)
  it.each(seedsFor(seedRange(1, 40), [2, 3]).filter((seed) => !SEEDS.includes(seed)))(
    'Seed %i: Aussteigen sichtbar: an Bahnhof Bär und Fledermaus auf den eigenen Bahnsteig, an der Tür, nie unter dem Dach',
    (seed) => {
      expect(exitFaults(createWorld(seed, [HOEHLE_PACK, BAHN_PACK], BUILT)), `Seed ${seed}`).toEqual([]);
    },
  );

  it('ohne Grotte endet das Gleis am Prellbock vor der Tür, auf der Lichtung dasselbe', () => {
    const seed = SEEDS[0]!;
    const alone = lineOf(worldOf(seed, [BAHN_PACK], BUILT));
    const full = lineOf(worldOf(seed, [HOEHLE_PACK, BAHN_PACK], BUILT));
    const end = full.rails.findIndex((r) => r.part === 'buffer');
    expect(alone.cells).toEqual(full.cells.slice(0, end + 1));
    expect(alone.rails.at(-1)).toMatchObject({ part: 'end', stage: 1 });
    expect(alone.rails.every((r) => r.stage === 1)).toBe(true);
  });
});
