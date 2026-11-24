// Fahrregeln aller Fahrzeuge – rein, ohne DOM, allgemein: die Fahr-Engine im Paket der Fahrzeuge (`WorldRules.ride`).
// Sie kennt kein einzelnes Fahrzeug; was eines ausmacht (Eintrag in `RIDES`, Strecke, wann es erscheint), sagt das Paket
// seiner Welt (`WorldRules.vehicle`: der Schlitten aus der Eis-Welt, der Zug aus dem Paket der Bahn). Ein Fahrzeug
// pendelt auf seiner Strecke zwischen dem Halt in der Welt (`home`: am Schuppen bzw. Bahnhof Fledermaus, bei Ausbau 1 der
// Prellbock in der Bucht) und dem Halt auf der Lichtung (`out`). Es erscheint, sobald die Welt es will (`ready`, dann
// gut 2 s; der Zug kommt mit Bau 1), und steht danach immer am Halt der Gegend, in der die Figur ist (`parked`); wo,
// wird nie gespeichert. Ein neuer Druck zum Fahrzeug oder Antippen steigt ein, ein gehaltener Pfeil stößt nur an; 2 s
// später geht es los, in diesen 2 s steigt ein Pfeil weg wieder aus. Gelenkt wird nie, jeder Druck unterwegs bekommt ein
// Winken. Vor Tieren auf der Strecke hält es, nach 1 s hüpfen sie beiseite; hindurch fährt es nie. Vor einem Tunnel
// kündigt es ihn an. Am Ziel steigt die Figur nach 1 s aus (wohin, darf das Fahrzeug vorschlagen: `Vehicle.exit`).
// Folgende Tiere fahren nie mit, sie warten am Halt. Fehlt ihm ein Paket (Ziel-Gegend, `Rider.dozing`), schläft es am
// Halt: schnarcht, steigt niemanden ein, bis es da ist.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Der Schlitten“ und „Tok und die Bahn“, Fahren)

import { DIRS } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { RIDE_PRELOAD, type RideId } from '../../../../data/games/mitwachsen-rides';
import { dirTo, freeNear, occupied } from '../../mitwachsen-free';
import type { Ride, RideEvent } from '../../mitwachsen-pack-types';
import {
  ALIGHT,
  CHEER,
  COME,
  DEPART,
  DUE,
  JINGLE_EVERY,
  SHOO,
  SNORE_EVERY,
  TAP_REACH,
  cellOf,
  key,
  parked,
  stopsOf,
  trotFrom,
  type Parked,
} from '../../mitwachsen-ride-kit';
import { rank, stageOf, withRide } from '../../mitwachsen-ride-save';
import type {
  End,
  MoveCmd,
  RideEngine,
  RideEvents,
  RideRoute,
  RideRules,
  Rider,
  Vehicle,
} from '../../mitwachsen-rider';
import { canStep, standHeight, type World } from '../../mitwachsen-world';

const AHEAD = 2; // so viele Felder vor dem Sitz müssen frei sein (dort geht das Zugtier), wenn die Strecke nichts sagt
/** So viele Felder vor einem Tunnel kündigt es ihn an („Uh-uh“) */
export const WARN = 3;
const EPS = 1e-6;

type Ctx = { v: Vehicle; id: RideId; r: RideRoute };
type Walker = Rider['animals'][number];

const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const ev = (c: Ctx, what: RideEvent['what'], [x, y]: readonly [number, number], more: Partial<RideEvent> = {}) =>
  ({ type: 'ride', what, id: c.id, x, y, ...more }) as RideEvent;

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

/** Sicherheitsnetz am Halt: Steht ein Tier auf Sitz, Zugtier, Wagen oder Schuppen, hüpft es beiseite */
function clear(c: Ctx, s: Rider, world: World, at: Parked, events: RideEvents) {
  for (const a of s.animals) if (at.cells.has(key(a.x, a.y))) hop(c, s, world, a, events);
}

/** Fällig und Erscheinen: Will die Welt es (`ready`), erscheint es `DUE` Takte später am Halt an seinem Schuppen */
function due(c: Ctx, s: Rider, world: World, events: RideEvents) {
  if (!c.v.ready?.(s, world)) {
    s.rideDue = -1; // geht die Figur weg, beginnt es von vorn
    return;
  }
  if (s.rideDue < 0) s.rideDue = s.tick + DUE;
  if (s.tick < s.rideDue) return;
  const at = stopsOf(c.r).home;
  s.packs = withRide(s.packs, c.id, 'bereit');
  s.rideDue = s.tick + COME; // dann ist es herbeigetrabt
  events.push(ev(c, 'appear', at.seat, { from: trotFrom(c.r, world, at.seat), persist: true }));
  clear(c, s, world, at, events);
}

/**
 * Dauer einer Fahrt in Takten, immer in `ticks` gehalten (15–20 s): mit Tempo (`spec.pace`, der Zug) Länge / Tempo, das
 * Tempo ist also die Höchstgeschwindigkeit (eine kurze Strecke, etwa bis zum Prellbock in der Bucht, fährt langsamer);
 * sonst Länge × 1,5 (der Schlitten)
 */
export function rideTicks(spec: Pick<Vehicle['spec'], 'ticks' | 'pace'>, len: number): number {
  const [lo, hi] = spec.ticks;
  return Math.min(hi, Math.max(lo, Math.round(spec.pace ? len / spec.pace : len * 1.5)));
}

/** Erste Heimfahrt eines Fahrzeugs, das erst danach auf der Lichtung hält (Schlitten, `spec.out` `'fest'`) */
const firstHome = (c: Ctx, s: Rider) => stageOf(s.packs, c.id) === 'bereit' && c.v.spec.out === 'fest';

/**
 * Einsteigen: Die Figur setzt sich, folgende Tiere setzen sich auf die Warteplätze des Halts; dort warten sie, bis die
 * Figur wieder nah ist (`bench`) oder schläft
 */
function board(c: Ctx, s: Rider, world: World, at: Parked, events: RideEvents) {
  clear(c, s, world, at, events);
  const len = c.r.path.length - 1;
  const ticks = rideTicks(c.v.spec, len);
  const to: End = at.end === 'home' ? 'out' : 'home';
  // sein Fest (`Vehicle.feast`; sonst die erste Heimfahrt eines Fahrzeugs, das erst danach auf der Lichtung hält: Schlitten)
  const feast = to === 'out' && (c.v.feast?.(s, world) ?? firstHome(c, s));
  s.ride = {
    id: c.id,
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
    a.bench = true; // reiht sich erst wieder ein, wenn die Figur nah ist (`BENCH` in mitwachsen-border.ts)
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
 * Sanft angestoßen (ein gehaltener Pfeil zum Fahrzeug): Es tutet, die Tür geht einladend auf; höchstens alle
 * `JINGLE_EVERY` Takte. Fahrzeuge, die von selbst erscheinen (Schlitten), merken es sich in `rideDue` (danach kommt
 * `come` nie mehr), die anderen (Zug) in `nudged`
 */
function nudge(c: Ctx, s: Rider, at: Parked, events: RideEvents) {
  const last = c.v.ready ? s.rideDue : s.nudged?.id === c.id ? s.nudged.at : -1;
  if (last >= 0 && s.tick - last < JINGLE_EVERY) return;
  if (c.v.ready) s.rideDue = s.tick;
  else s.nudged = { id: c.id, at: s.tick };
  events.push(ev(c, 'nudge', at.seat));
}

/**
 * Am Halt, ohne Fahrt: Zugtier schnaubt, Sitz (beim Zug jeder Wagen) steigt ein (neuer Druck, Antippen) oder stößt an,
 * Schuppen ist eine Wand (`bump` wie an jeder Wand)
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
  const seat = at.board.has(key(tx, ty));
  if (!seat && tx === at.pull[0] && ty === at.pull[1]) events.push(ev(c, 'snort', at.pull));
  else if (!seat)
    events.push({ type: 'bump' }); // Schuppen
  else if (cmd.fresh) board(c, s, world, at, events);
  else nudge(c, s, at, events);
  return true;
}

/** Schläft das Fahrzeug, weil ihm ein Paket fehlt (Fahr-Engine, Ziel-Gegend; `Rider.dozing`, mitwachsen-preload.ts)? */
const dozes = (c: Ctx, s: Rider) => !!s.dozing?.includes(c.id);

/**
 * Am Halt, solange es schläft (ein Paket lädt noch): Hineinlaufen oder Antippen steigt nicht ein, es schnarcht nur leise
 * (`snore`, höchstens alle `JINGLE_EVERY` Takte), die Figur bleibt stehen wie an jedem Fahrzeug; nichts ist zu, es
 * wacht auf, sobald das Paket da ist
 */
function doze(c: Ctx, s: Rider, at: Parked, cmd: MoveCmd, events: RideEvents): boolean {
  const p = s.player;
  const [tx, ty] = [p.x + DIRS[cmd.dir][0], p.y + DIRS[cmd.dir][1]];
  const reach = cmd.tap ? cheb(p.x, p.y, ...at.seat) <= TAP_REACH : at.cells.has(key(tx, ty));
  if (!reach) return !!cmd.tap; // Laufen per Antippen gibt es nicht
  if (!cmd.tap) p.dir = cmd.dir;
  const last = s.snored?.id === c.id ? s.snored.at : -1; // eigene Drossel: `nudged` öffnet im Bild die Tür
  if (last < 0 || s.tick - last >= JINGLE_EVERY) {
    s.snored = { id: c.id, at: s.tick };
    events.push(ev(c, 'snore', at.seat));
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

/**
 * Tiere, die auf den nächsten Feldern der Fahrt stehen (Felder `from` bis `to` des Fortschritts); ein Fahrzeug mit
 * Wagen (Zug) schaut kurz vor dem Ziel auch auf die Felder, die seine Wagen dort belegen werden (hinter dem letzten Sitz)
 */
function ahead(c: Ctx, s: Rider, ride: Ride, from: number, to: number): Walker[] {
  const out: Walker[] = [];
  for (let i = from; i <= to; i++) {
    const [x, y] = cellOf(c.r, ride, i);
    out.push(...s.animals.filter((a) => a.x === x && a.y === y));
  }
  const len = c.r.path.length - 1;
  if (c.r.cars && len - from < (c.r.ahead ?? AHEAD)) {
    const cells = stopsOf(c.r)[ride.to].cells;
    out.push(...s.animals.filter((a) => cells.has(key(a.x, a.y)) && !out.includes(a)));
  }
  return out;
}

/** Bis zu welchem Feld vor ihm frei sein muss (`RideRoute.ahead`, sonst 2: dort geht das Zugtier) */
const reachOf = (c: Ctx, ride: Ride) =>
  Math.min(c.r.path.length - 1, Math.floor(ride.pos + ride.speed + EPS) + (c.r.ahead ?? AHEAD));

/**
 * Tunnel voraus: Ist eines der Felder `from` bis `to` (Fortschritt des Sitzes) `WARN` Felder vor dem ersten Feld eines
 * Tunnels (`RideRoute.dark`)? Dann kündigt es ihn dort an, je Einfahrt einmal
 */
function tunnelAhead(c: Ctx, ride: Ride, from: number, to: number): Point | undefined {
  const dark = c.r.dark;
  const len = c.r.path.length - 1;
  if (!dark?.size) return undefined;
  for (let i = from; i <= to; i++) {
    if (i + WARN > len) break;
    const [a, b] = [cellOf(c.r, ride, i + WARN - 1), cellOf(c.r, ride, i + WARN)];
    if (dark.has(key(...b)) && !dark.has(key(...a))) return cellOf(c.r, ride, i);
  }
  return undefined;
}

/** Ein Takt unterwegs: hält vor Tieren, sonst ein Stück weiter; Tunnel, Wechsel der Gegend, Winken am Weg, Ankunft */
function go(c: Ctx, s: Rider, world: World, events: RideEvents) {
  const ride = s.ride!;
  const len = c.r.path.length - 1;
  const i = Math.floor(ride.pos + EPS);
  const [block] = ahead(c, s, ride, i + 1, reachOf(c, ride));
  if (block) {
    ride.phase = 'stop';
    ride.at = s.tick;
    events.push(ev(c, 'stop', [block.x, block.y], { who: block.id }));
    return;
  }
  const cap = ride.stopover === 'ahead' ? c.v.hold?.(s, world, events) : undefined;
  if (ride.stopover === 'ahead' && cap === undefined) ride.stopover = 'done';
  if (cap !== undefined && ride.pos >= cap - EPS) return; // wartet am Halt unterwegs (Zug: Tok versenkt den Prellbock)
  const goal = Math.min(len, cap ?? len);
  ride.pos = goal - ride.pos - ride.speed < EPS ? goal : ride.pos + ride.speed;
  const warn = tunnelAhead(c, ride, i + 1, Math.floor(ride.pos + EPS));
  if (warn) events.push(ev(c, 'tunnel', warn));
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
 * der Welt, die zu Hause auf ihrer Wiese stehen (sie liegt weiter weg als `CHEER`, sie winken dem Fahrzeug nach)
 */
function cheer(c: Ctx, s: Rider, world: World, events: RideEvents, start: boolean) {
  const ride = s.ride!;
  const { x, y } = s.player;
  const own = world.realm(...c.r.stops.home);
  const near = s.animals.filter(
    (a) => a.realm === own && ((start && a.mode === 'home') || cheb(a.x, a.y, x, y) <= CHEER),
  );
  for (const f of [...near.map((a) => ({ who: a.id, x: a.x, y: a.y })), ...(c.v.fans?.(s, world) ?? [])]) {
    if (ride.greeted.includes(f.who)) continue;
    ride.greeted.push(f.who);
    events.push(ev(c, 'cheer', [f.x, f.y], { who: f.who }));
  }
}

/**
 * Am Ziel: Die Figur steigt neben dem Halt aus (nie auf eine Torplatte), wo das Fahrzeug es will (`Vehicle.exit`, der
 * Zug: auf den Bahnsteig an der Tür, nie unter das Dach), sonst auf das nächste freie Feld; das Fahrzeug bleibt dort
 * (`docked`), wann sie ausstieg, merkt `alighted` (im Bild geht die Tür auf). Nach der ersten Heimfahrt das Fest (Stufe `fest`, gespeichert); danach, was das Paket des Fahrzeugs noch
 * will (`landed`; ändert es dabei den Spielstand, wird gleich gespeichert)
 */
function alight(c: Ctx, s: Rider, world: World, events: RideEvents) {
  const ride = s.ride!;
  const seat = stopsOf(c.r)[ride.to].seat;
  const h = standHeight(world, s.openGates, ...seat) ?? 1;
  const ok = aside(c, world, seat);
  const near = (x: number, y: number) =>
    ok(x, y) && !world.cell(x, y).plate && Math.abs((standHeight(world, s.openGates, x, y) ?? h) - h) <= 1;
  const fits = ([x, y]: Point) => near(x, y) && standHeight(world, s.openGates, x, y) !== null && !occupied(s, x, y);
  const spot = c.v.exit?.(s, world, ride.to).find(fits) ?? freeNear(s, world, seat, near);
  if (!spot) return; // gleich noch einmal
  delete s.ride;
  s.docked = { ...s.docked, [c.id]: ride.to };
  s.alighted = { id: c.id, at: s.tick }; // im Bild steht die Tür kurz offen, die Figur hüpft hindurch
  s.player = { x: spot[0], y: spot[1], dir: dirTo(seat[0] - spot[0], seat[1] - spot[1]) };
  const off = ev(c, 'alight', spot);
  events.push(off);
  if (ride.feast) {
    s.packs = withRide(s.packs, c.id, 'fest');
    events.push(ev(c, 'feast', spot, { persist: true }));
  }
  const packs = s.packs;
  c.v.landed?.(s, world, ride.to, events);
  if (s.packs !== packs) off.persist = true; // was das Paket des Fahrzeugs dabei merkt (Zug: `gefahren`), gleich speichern
}

/**
 * Abfahrt: Was das Paket des Fahrzeugs dabei will (`Vehicle.depart`; der Zug: Bau 2 beginnt). Sagt es einen Halt
 * unterwegs an, merkt die Fahrt ihn (`stopover`); ändert es den Spielstand, wird gleich gespeichert und die Strecke neu
 * gerechnet (der Zug fährt dann bis in die Grotte): Das Tempo passt sich an, damit die Fahrt in `ticks` bleibt
 */
function depart(c: Ctx, s: Rider, world: World, go: RideEvent, events: RideEvents) {
  const ride = s.ride!;
  const packs = s.packs;
  if (c.v.depart?.(s, world, ride.to, events)) ride.stopover = 'ahead';
  if (s.packs === packs) return;
  go.persist = true;
  const r = c.v.route(world, s);
  if (r) ride.speed = (r.path.length - 1) / rideTicks(c.v.spec, r.path.length - 1);
}

/** Ein Takt mit Fahrt: abfahren, fahren, halten und Tiere verscheuchen, ankommen und aussteigen */
function drive(c: Ctx, s: Rider, world: World, events: RideEvents) {
  const ride = s.ride!;
  const since = s.tick - ride.at;
  if (ride.phase === 'seated') {
    if (since < DEPART) return;
    ride.phase = 'go';
    ride.at = s.tick;
    const go = ev(c, 'go', [s.player.x, s.player.y]);
    events.push(go);
    depart(c, s, world, go, events);
    if (!ride.feast) return;
    events.push(ev(c, 'farewell', [s.player.x, s.player.y])); // der Bote winkt zum Abschied (Pinguin)
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
    const block = ahead(c, s, ride, i + 1, reachOf(c, ride));
    if (!block.every((a) => hop(c, s, world, a, events))) return; // nie hindurch: gleich noch einmal
    ride.phase = 'go';
    ride.at = s.tick;
  }
  go(c, s, world, events);
}

/** Regeln eines Fahrzeugs samt seiner Kennung (wem eine Fahrt oder ein Antippen gehört) */
export type One = RideRules & { id: RideId };

/** Regeln eines einzelnen Fahrzeugs (`v`: sein Eintrag, seine Strecke, wann es erscheint) */
export function rideRules(v: Vehicle): One {
  const id = v.spec.id;
  const ctx = (world: World, s: Pick<Rider, 'packs' | 'openGates'>): Ctx | undefined => {
    const r = v.route(world, s);
    return r && { v, id, r };
  };
  return {
    id,
    tick(s, world, events) {
      if (s.ride && s.ride.id !== id) return;
      const c = ctx(world, s);
      if (!c) return;
      if (s.ride) return drive(c, s, world, events);
      if (!stageOf(s.packs, id)) return v.ready ? due(c, s, world, events) : undefined;
      const at = parked(v.spec, c.r, s, world);
      if (!at || s.sleeping) return; // nachts ist es still (auch `come` fällt dann aus)
      if (dozes(c, s)) {
        // es schläft, bis sein Paket da ist: schnarcht leise, wenn die Figur nah ist (kein `come`)
        const near = cheb(s.player.x, s.player.y, ...at.seat) <= RIDE_PRELOAD;
        if (near && s.tick % SNORE_EVERY === 0) events.push(ev(c, 'snore', at.seat));
        return clear(c, s, world, at, events);
      }
      if (v.ready && s.tick === s.rideDue) events.push(ev(c, 'come', at.seat)); // herbeigetrabt: bimmelt, schnaubt, Herz
      clear(c, s, world, at, events);
    },
    move(s, world, cmd, events) {
      if (s.ride && s.ride.id !== id) return false;
      if (!s.ride && cmd.tap && cmd.ride && cmd.ride !== id) return false; // ein anderes Fahrzeug angetippt
      if (!s.ride && cmd.tap && cmd.who) return false; // ein Bote angetippt (Tok): kein Fahrzeug
      const c = ctx(world, s);
      if (!c) return false;
      if (s.ride) {
        inside(c, s, world, cmd, events);
        return true; // gelenkt wird nie
      }
      const at = parked(v.spec, c.r, s, world);
      if (at) return dozes(c, s) ? doze(c, s, at, cmd, events) : atStop(c, s, world, at, cmd, events);
      return !!cmd.tap; // Antippen ohne Fahrzeug am Halt (Schuppen von fern): nichts, nie laufen
    },
    blocks(s, world, a, x, y) {
      const stage = stageOf(s.packs, id);
      const r = stage && v.route(world, s);
      if (!r) return false;
      const at = stopsOf(r);
      const k = key(x, y);
      if (at.home.cells.has(k)) return true;
      // die Lichtung erst ab `spec.out` (Schlitten: nach der ersten Heimfahrt); die eigene Strecke als Feld immer
      if (rank(stage) < rank(v.spec.out) && world.cell(x, y).ride !== id) return false;
      return at.out.cells.has(k) || (a.mode === 'wander' && r.on.has(k));
    },
  };
}

/**
 * Die Fahr-Engine (`WorldRules.ride`): die Regeln aller Fahrzeuge der geladenen Pakete zusammen. Fährt die Figur,
 * gehören Takt und Pfeil dem Fahrzeug, in dem sie sitzt; sonst fragt sie die Fahrzeuge der Reihe nach (am Halt
 * einsteigen, anstoßen; ein Antippen nur das angetippte). Ein Tier meidet, was eines der Fahrzeuge sperrt
 */
export const rides: RideEngine = (vehicles) => {
  const all = vehicles.map(rideRules);
  return {
    tick(s, world, events) {
      const riding = s.ride?.id;
      for (const r of all) if (!riding || r.id === riding) r.tick(s, world, events);
    },
    move(s, world, cmd, events) {
      for (const r of all) if (r.move(s, world, cmd, events)) return true;
      return false;
    },
    blocks: (s, world, a, x, y) => all.some((r) => r.blocks(s, world, a, x, y)),
  };
};
