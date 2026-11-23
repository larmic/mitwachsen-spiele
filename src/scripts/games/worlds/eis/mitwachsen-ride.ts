// Fahrregeln eines Fahrzeugs – rein, ohne DOM, allgemein (kennt keinen Schlitten; später im eigenen Paket
// `worlds/fahrt/`, Regel `ride-engine-is-generic`): Ein Fahrzeug pendelt auf seiner Strecke zwischen dem Halt an seinem
// Schuppen in der Welt (`home`) und dem Halt auf der Lichtung (`out`). Es erscheint, sobald die Welt es will (`ready`,
// dann gut 2 s), und steht danach immer am Halt der Gegend, in der die Figur ist (auf der Lichtung erst nach der ersten
// Heimfahrt, Stufe `fest`); wo, wird nie gespeichert. Ein neuer Druck zum Sitz oder Antippen steigt ein, ein gehaltener
// Pfeil stößt nur an; 2 s später geht es los, in diesen 2 s steigt ein Pfeil weg wieder aus. Gelenkt wird nie, jeder
// Druck unterwegs bekommt ein Winken. Vor Tieren auf der Strecke hält es, nach 1 s hüpfen sie beiseite; hindurch fährt
// es nie. Am Ziel steigt die Figur nach 1 s aus. Folgende Tiere fahren nie mit, sie warten am Halt (Weltgrenze).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import { DIRS } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import type { RideSpec } from '../../../../data/games/mitwachsen-rides';
import { dirTo, freeNear, occupied } from '../../mitwachsen-free';
import type { Ride, RideEvent } from '../../mitwachsen-pack-types';
import type { MoveCmd, RideEvents, RideRules, Rider } from '../../mitwachsen-rider';
import { canStep, standHeight, type World } from '../../mitwachsen-world';
import { key } from './mitwachsen-flood';
import { stageOf, withRide } from './mitwachsen-ride-save';

export const DUE = 20; // so viele Takte, nachdem die Welt es will (`ready`), erscheint es (wie der Pinguin)
export const COME = 15; // so lange trabt es aus den Bäumen herbei, dann bimmelt und schnaubt es (`come`)
export const DEPART = 20; // nach dem Einsteigen geht es so viele Takte später los (2 s; so lange steigt ein Pfeil weg aus)
export const SHOO = 10; // so lange hält es vor einem Tier, dann hüpft das Tier beiseite
export const ALIGHT = 10; // so lange nach der Ankunft steigt die Figur von selbst aus
export const JINGLE_EVERY = 15; // höchstens so oft bimmelt es (Anstoßen, Winken unterwegs)
export const TAP_REACH = 4; // Antippen wirkt bis zu so vielen Feldern (Schachbrett)
export const CHEER = 4; // auf der Festfahrt winken Tiere und Schneemänner bis so weit
const AHEAD = 2; // so viele Felder vor dem Sitz müssen frei sein (dort geht das Zugtier)
const EPS = 1e-6;

/** Strecke eines Fahrzeugs (aus dem Welt-Paket): `path` vom Halt am Schuppen bis zum Halt auf der Lichtung */
export type RideRoute = {
  path: readonly Point[];
  stops: { home: Point; out: Point };
  shed: readonly Point[];
  seats: { home: readonly Point[]; out: readonly Point[] };
  on: ReadonlySet<string>;
};
export type End = 'home' | 'out';
/** Wer auf der Festfahrt außer den Tieren noch winkt (Eis-Welt: Schneemänner) */
export type Fan = { who: string; x: number; y: number };
/** Fahrzeug am Halt: Ende der Strecke, Sitz, Zugtier und alle Felder, die es belegt (samt Schuppen) */
export type Parked = { end: End; seat: Point; pull: Point; cells: ReadonlySet<string> };

type Ctx = {
  spec: RideSpec;
  r: RideRoute;
  ready: (s: Rider, world: World) => boolean;
  fans: (s: Rider, world: World) => Fan[];
};
type Walker = Rider['animals'][number];

const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const ev = (c: Ctx, what: RideEvent['what'], [x, y]: readonly [number, number], more: Partial<RideEvent> = {}) =>
  ({ type: 'ride', what, id: c.spec.id, x, y, ...more }) as RideEvent;

const halts = new WeakMap<RideRoute, Record<End, Parked>>();
/** Beide Halte einer Strecke: am Schuppen Sitz auf dem ersten Feld, auf der Lichtung auf dem letzten */
export function stopsOf(r: RideRoute): Record<End, Parked> {
  let out = halts.get(r);
  if (!out) {
    const park = (end: End, seat: Point, pull: Point, more: readonly Point[] = []): Parked => ({
      end,
      seat,
      pull,
      cells: new Set([seat, pull, ...more].map((p) => key(...p))),
    });
    const [first, second] = [r.path[0]!, r.path[1]!];
    out = { home: park('home', first, second, r.shed), out: park('out', r.path.at(-1)!, r.path.at(-2)!) };
    halts.set(r, out);
  }
  return out;
}

/**
 * Wo das Fahrzeug steht, wenn es nicht fährt: am Halt der Gegend, in der die Figur ist (auf der Lichtung erst ab `fest`);
 * undefined, solange es noch nicht erschienen ist, unterwegs oder in einer anderen Gegend
 */
export function parked(spec: Pick<RideSpec, 'id'>, r: RideRoute, s: Rider, world: World): Parked | undefined {
  const stage = stageOf(s.packs, spec.id);
  if (s.ride || !stage) return undefined;
  const at = stopsOf(r);
  const realm = world.realm(s.player.x, s.player.y);
  if (realm === world.realm(...at.home.seat)) return at.home;
  return stage === 'fest' && realm === world.realm(...at.out.seat) ? at.out : undefined;
}

/** Feld der Fahrt bei Fortschritt `pos` (zum Halt auf der Lichtung vorwärts auf `path`, heim rückwärts) */
export const cellOf = (r: RideRoute, ride: Pick<Ride, 'to'>, pos: number): Point => {
  const i = Math.floor(pos + EPS);
  return r.path[ride.to === 'out' ? i : r.path.length - 1 - i]!;
};

/**
 * Darf ein Tier hierhin beiseite hüpfen (oder die Figur aussteigen)? Nicht auf die Strecke, nicht an einen Halt, nicht
 * auf eine Plattform, in derselben Gegend
 */
function aside(c: Ctx, world: World, from: Point) {
  const at = stopsOf(c.r);
  const realm = world.realm(...from);
  return (x: number, y: number) =>
    !c.r.on.has(key(x, y)) &&
    !at.home.cells.has(key(x, y)) &&
    !at.out.cells.has(key(x, y)) &&
    !world.cell(x, y).portal &&
    world.realm(x, y) === realm;
}

/** Ein Tier hüpft beiseite (`shoo`); false, wenn ringsum nichts frei ist (dann gleich noch einmal) */
function hop(c: Ctx, s: Rider, world: World, a: Walker, events: RideEvents): boolean {
  const spot = freeNear(s, world, [a.x, a.y], aside(c, world, [a.x, a.y]), a.id);
  if (!spot) return false;
  [a.x, a.y] = spot;
  a.dir = dirTo(s.player.x - a.x, s.player.y - a.y);
  events.push(ev(c, 'shoo', spot, { who: a.id }));
  return true;
}

/** Sicherheitsnetz am Halt: Steht ein Tier auf Sitz, Zugtier oder Schuppen, hüpft es beiseite */
function clear(c: Ctx, s: Rider, world: World, at: Parked, events: RideEvents) {
  for (const a of s.animals) if (at.cells.has(key(a.x, a.y))) hop(c, s, world, a, events);
}

/**
 * Feld in den Bäumen, aus dem es herbeitrabt: ein Baum 6 bis 8 Felder vom Halt `seat`, sonst ein Stück die Strecke
 * hinauf (auch für die Ansicht: Dort beginnt das Herbeitraben im Bild)
 */
export function trotFrom(r: Pick<RideRoute, 'path'>, world: World, [sx, sy]: Point): Point {
  let best: Point | undefined;
  for (let r = 6; r <= 8 && !best; r++)
    for (let y = sy - r; y <= sy + r && !best; y++)
      for (let x = sx - r; x <= sx + r && !best; x++)
        if (cheb(x, y, sx, sy) === r && world.cell(x, y).deco === 'tree') best = [x, y];
  return best ?? r.path[Math.min(8, r.path.length - 1)]!;
}

/** Fällig und Erscheinen: Will die Welt es (`ready`), erscheint es `DUE` Takte später am Halt an seinem Schuppen */
function due(c: Ctx, s: Rider, world: World, events: RideEvents) {
  if (!c.ready(s, world)) {
    s.rideDue = -1; // geht die Figur weg, beginnt es von vorn
    return;
  }
  if (s.rideDue < 0) s.rideDue = s.tick + DUE;
  if (s.tick < s.rideDue) return;
  const at = stopsOf(c.r).home;
  s.packs = withRide(s.packs, c.spec.id, 'bereit');
  s.rideDue = s.tick + COME; // dann ist es herbeigetrabt
  events.push(ev(c, 'appear', at.seat, { from: trotFrom(c.r, world, at.seat), persist: true }));
  clear(c, s, world, at, events);
}

/** Einsteigen: Die Figur setzt sich, folgende Tiere setzen sich auf die Warteplätze des Halts */
function board(c: Ctx, s: Rider, world: World, at: Parked, events: RideEvents) {
  clear(c, s, world, at, events);
  const len = c.r.path.length - 1;
  const ticks = Math.min(c.spec.ticks[1], Math.max(c.spec.ticks[0], Math.round(len * 1.5)));
  const to: End = at.end === 'home' ? 'out' : 'home';
  const feast = to === 'out' && stageOf(s.packs, c.spec.id) === 'bereit'; // erste Heimfahrt
  s.ride = {
    id: c.spec.id,
    phase: 'seated',
    at: s.tick,
    pos: 0,
    speed: len / ticks,
    to,
    feast,
    jingleAt: s.tick,
    greeted: [],
  };
  s.player = { x: at.seat[0], y: at.seat[1], dir: dirTo(at.pull[0] - at.seat[0], at.pull[1] - at.seat[1]) };
  const seats = c.r.seats[at.end];
  for (const id of s.followers) {
    const a = s.animals.find((t) => t.id === id)!;
    a.mode = 'wait';
    const free = (x: number, y: number) => !occupied(s, x, y, id);
    const spot =
      seats.find((p) => free(...p)) ?? freeNear(s, world, seats.at(-1) ?? at.seat, aside(c, world, at.seat), id);
    if (spot) [a.x, a.y] = spot;
    a.dir = dirTo(at.seat[0] - a.x, at.seat[1] - a.y); // schaut zum Fahrzeug
    events.push({ type: 'wait', id, species: a.species });
  }
  s.followers = [];
  events.push(ev(c, 'board', at.seat));
}

/**
 * Am Halt, ohne Fahrt: Zugtier schnaubt, Sitz steigt ein (neuer Druck, Antippen) oder stößt an, Schuppen ist eine Wand
 * (`bump` wie an jeder Wand)
 */
function atStop(c: Ctx, s: Rider, world: World, at: Parked, cmd: MoveCmd, events: RideEvents): boolean {
  const p = s.player;
  if (cmd.tap) {
    if (cheb(p.x, p.y, ...at.seat) <= TAP_REACH) board(c, s, world, at, events);
    return true; // Laufen per Antippen gibt es nicht
  }
  const [tx, ty] = [p.x + DIRS[cmd.dir][0], p.y + DIRS[cmd.dir][1]];
  if (!at.cells.has(key(tx, ty))) return false;
  p.dir = cmd.dir;
  const seat = tx === at.seat[0] && ty === at.seat[1];
  if (tx === at.pull[0] && ty === at.pull[1]) events.push(ev(c, 'snort', at.pull));
  else if (!seat)
    events.push({ type: 'bump' }); // Schuppen
  else if (cmd.fresh) board(c, s, world, at, events);
  else if (s.rideDue < 0 || s.tick - s.rideDue >= JINGLE_EVERY) {
    s.rideDue = s.tick; // gedrosselt; `come` kommt danach nie mehr (es zählt nur der Takt seines Herbeitrabens)
    events.push(ev(c, 'nudge', at.seat));
  }
  return true;
}

/** Ein Pfeil im Fahrzeug: in den ersten 2 s weg vom Fahrzeug wieder aussteigen, sonst winken (gedrosselt bimmeln) */
function inside(c: Ctx, s: Rider, world: World, cmd: MoveCmd, events: RideEvents) {
  const ride = s.ride!;
  const p = s.player;
  const [tx, ty] = [p.x + DIRS[cmd.dir][0], p.y + DIRS[cmd.dir][1]];
  const at = stopsOf(c.r)[ride.to === 'out' ? 'home' : 'out'];
  const off = !at.cells.has(key(tx, ty)) && canStep(world, s.openGates, p.x, p.y, tx, ty) && !occupied(s, tx, ty);
  if (ride.phase === 'seated' && off && !cmd.tap) {
    delete s.ride;
    s.player = { x: tx, y: ty, dir: cmd.dir };
    events.push(ev(c, 'leave', [tx, ty]));
    return;
  }
  const ring = s.tick - ride.jingleAt >= JINGLE_EVERY;
  if (ring) ride.jingleAt = s.tick;
  events.push(ev(c, 'wave', [p.x, p.y], ring ? { ring: true } : {}));
}

/** Tiere, die auf den nächsten Feldern der Fahrt stehen (Felder `from` bis `to` des Fortschritts) */
function ahead(c: Ctx, s: Rider, ride: Ride, from: number, to: number): Walker[] {
  const out: Walker[] = [];
  for (let i = from; i <= to; i++) {
    const [x, y] = cellOf(c.r, ride, i);
    out.push(...s.animals.filter((a) => a.x === x && a.y === y));
  }
  return out;
}

/** Ein Takt unterwegs: hält vor Tieren, sonst ein Stück weiter; Wechsel der Gegend, Winken am Weg, Ankunft */
function go(c: Ctx, s: Rider, world: World, events: RideEvents) {
  const ride = s.ride!;
  const len = c.r.path.length - 1;
  const i = Math.floor(ride.pos + EPS);
  const reach = Math.min(len, Math.floor(ride.pos + ride.speed + EPS) + AHEAD);
  const [block] = ahead(c, s, ride, i + 1, reach);
  if (block) {
    ride.phase = 'stop';
    ride.at = s.tick;
    events.push(ev(c, 'stop', [block.x, block.y], { who: block.id }));
    return;
  }
  ride.pos = len - ride.pos - ride.speed < EPS ? len : ride.pos + ride.speed;
  const [x, y] = cellOf(c.r, ride, ride.pos);
  const p = s.player;
  const realm = world.realm(p.x, p.y);
  if (x !== p.x || y !== p.y) s.player = { x, y, dir: dirTo(x - p.x, y - p.y) };
  if (world.realm(x, y) !== realm) events.push({ type: 'realm', to: world.realm(x, y) });
  if (ride.feast) cheer(c, s, world, events, false);
  if (ride.pos < len) return;
  ride.phase = 'arrive';
  ride.at = s.tick;
  events.push(ev(c, 'arrive', [x, y]));
}

/**
 * Festfahrt: Tiere der Welt und Schneemänner in der Nähe winken, jedes einmal; beim Losfahren (`start`) auch alle Tiere
 * der Welt, die zu Hause auf ihrer Wiese stehen (sie liegt weiter weg als `CHEER`, sie winken dem Schlitten nach)
 */
function cheer(c: Ctx, s: Rider, world: World, events: RideEvents, start: boolean) {
  const ride = s.ride!;
  const { x, y } = s.player;
  const own = world.realm(...c.r.stops.home);
  const near = s.animals.filter(
    (a) => a.realm === own && ((start && a.mode === 'home') || cheb(a.x, a.y, x, y) <= CHEER),
  );
  for (const f of [...near.map((a) => ({ who: a.id, x: a.x, y: a.y })), ...c.fans(s, world)]) {
    if (ride.greeted.includes(f.who)) continue;
    ride.greeted.push(f.who);
    events.push(ev(c, 'cheer', [f.x, f.y], { who: f.who }));
  }
}

/** Am Ziel: Die Figur steigt neben dem Halt aus; nach der ersten Heimfahrt das Fest (Stufe `fest`, gespeichert) */
function alight(c: Ctx, s: Rider, world: World, events: RideEvents) {
  const ride = s.ride!;
  const seat = stopsOf(c.r)[ride.to].seat;
  const h = standHeight(world, s.openGates, ...seat) ?? 1;
  const ok = aside(c, world, seat);
  const near = (x: number, y: number) => ok(x, y) && Math.abs((standHeight(world, s.openGates, x, y) ?? h) - h) <= 1;
  const spot = freeNear(s, world, seat, near);
  if (!spot) return; // gleich noch einmal
  delete s.ride;
  s.player = { x: spot[0], y: spot[1], dir: dirTo(seat[0] - spot[0], seat[1] - spot[1]) };
  events.push(ev(c, 'alight', spot));
  if (!ride.feast) return;
  s.packs = withRide(s.packs, c.spec.id, 'fest');
  events.push(ev(c, 'feast', spot, { persist: true }));
}

/** Ein Takt mit Fahrt: abfahren, fahren, halten und Tiere verscheuchen, ankommen und aussteigen */
function drive(c: Ctx, s: Rider, world: World, events: RideEvents) {
  const ride = s.ride!;
  const since = s.tick - ride.at;
  if (ride.phase === 'seated') {
    if (since < DEPART) return;
    ride.phase = 'go';
    ride.at = s.tick;
    events.push(ev(c, 'go', [s.player.x, s.player.y]));
    if (!ride.feast) return;
    events.push(ev(c, 'farewell', [s.player.x, s.player.y])); // der Pinguin winkt zum Abschied
    cheer(c, s, world, events, true); // die Tiere auf der Wiese winken mit
    return;
  }
  if (ride.phase === 'arrive') {
    if (since >= ALIGHT) alight(c, s, world, events);
    return;
  }
  if (ride.phase === 'stop') {
    if (since < SHOO) return;
    const i = Math.floor(ride.pos + EPS);
    const len = c.r.path.length - 1;
    const block = ahead(c, s, ride, i + 1, Math.min(len, Math.floor(ride.pos + ride.speed + EPS) + AHEAD));
    if (!block.every((a) => hop(c, s, world, a, events))) return; // nie hindurch: gleich noch einmal
    ride.phase = 'go';
    ride.at = s.tick;
  }
  go(c, s, world, events);
}

/**
 * Regeln eines Fahrzeugs (`WorldRules.ride`): `spec` aus `RIDES`, `route` seine Strecke in einer Welt (undefined: keins),
 * `ready` ob es erscheinen soll, `fans` wer auf der Festfahrt außer den Tieren seiner Welt noch winkt
 */
export function rideRules(
  spec: RideSpec,
  route: (world: World) => RideRoute | undefined,
  ready: Ctx['ready'],
  fans: Ctx['fans'] = () => [],
): RideRules {
  const ctx = (world: World): Ctx | undefined => {
    const r = route(world);
    return r && { spec, r, ready, fans };
  };
  return {
    tick(s, world, events) {
      const c = ctx(world);
      if (!c) return;
      if (s.ride) return drive(c, s, world, events);
      if (!stageOf(s.packs, spec.id)) return due(c, s, world, events);
      const at = parked(spec, c.r, s, world);
      if (!at || s.sleeping) return; // nachts ist es still (auch `come` fällt dann aus)
      if (s.tick === s.rideDue) events.push(ev(c, 'come', at.seat)); // herbeigetrabt: bimmelt, schnaubt, Herz
      clear(c, s, world, at, events);
    },
    move(s, world, cmd, events) {
      const c = ctx(world);
      if (!c) return false;
      if (s.ride) {
        inside(c, s, world, cmd, events);
        return true; // gelenkt wird nie
      }
      const at = parked(spec, c.r, s, world);
      if (at) return atStop(c, s, world, at, cmd, events);
      return !!cmd.tap; // Antippen ohne Fahrzeug am Halt (Schuppen von fern): nichts, nie laufen
    },
    blocks(s, world, a, x, y) {
      const stage = stageOf(s.packs, spec.id);
      const r = stage && route(world);
      if (!r) return false;
      const at = stopsOf(r);
      const k = key(x, y);
      if (at.home.cells.has(k)) return true;
      if (stage !== 'fest' && world.cell(x, y).ride !== spec.id) return false; // die Lichtung erst nach der ersten Heimfahrt
      return at.out.cells.has(k) || (a.mode === 'wander' && r.on.has(k));
    },
  };
}
