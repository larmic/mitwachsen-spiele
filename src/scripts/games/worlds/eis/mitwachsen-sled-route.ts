// Strecke des Schlittens von Halt zu Halt – rein, ohne DOM, je Welt einmal berechnet: Im Kessel und im Gang folgt sie
// den Feldern mit `ride` (gebaut von mitwachsen-sled-ground.ts), durch Tür und Bucht geht sie gerade bei u = −2 der
// Torplatte (neben Platte und Platz des Pinguins, `BESIDE`) und weiter in die Lichtung, solange es geht (bis
// `STRAIGHT` Reihen; vor der Bucht liegen oft Teich, Fels oder Busch), dann auf dem günstigsten Weg (`costs`) zum Halt
// auf der Lichtung (`lichtungStop`): gleich neben der Plattform des Eistor-Portals am Bett, außen am Ring. Auf der
// Lichtung liegt sie nie im Feld (die Lichtung bleibt mit und ohne Paket gleich), nur hier.
// Dazu je Halt 8 feste Warteplätze für die folgenden Tiere, abseits von Strecke und dem freien Platz hinter dem Halt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import { fromKey } from '../../../../lib/games/chunks';
import type { Point, RegionId } from '../../../../data/games/mitwachsen';
import type { RideId } from '../../../../data/games/mitwachsen-rides';
import type { Cell } from '../../mitwachsen-cell';
import { crossings } from '../../mitwachsen-border';
import { atHome } from '../../mitwachsen-meadow';
import { platformCells } from '../../mitwachsen-portal';
import { canStep, type GatePlace, type World } from '../../mitwachsen-world';
import { BESIDE, plateRow } from '../../mitwachsen-bay';
import { ALL, key } from './mitwachsen-flood';
import { postOf, yardOf } from './mitwachsen-sled-ground';

/**
 * Halt auf der Lichtung: höchstens so weit (Luftlinie) von der Mitte der Plattform des Eistor-Portals am Bett, je
 * Ausweichstufe. Näher als 3 geht nicht (Plattform samt Nachbarn und Kreis der Gegenstücke sind gesperrt, `costs`)
 */
export const STOP_STAGES = [{ r: 6 }, { r: 9 }, { r: 12 }] as const;
export type StopStage = 0 | 1 | 2;
/** So viele Reihen ab der Tür läuft die Strecke höchstens gerade in die Lichtung (solange es geht) */
export const STRAIGHT = 13;
const RIDE: RideId = 'schlitten';
/** Gehört ein Feld einem anderen Fahrzeug (Gleis der Höhlenbahn, `Cell.ride`) oder seinem Bahnsteig (`Cell.stop`)? */
const foreign = (c: Cell) => (!!c.ride && c.ride !== RIDE) || !!c.stop;
/** Feste Warteplätze je Halt */
export const RIDE_SEATS = 8;
const SEAT_REACH = 8; // so weit (Schachbrett) liegen sie höchstens vom Halt
const OPEN = ['eis'] as const;
/** Kosten eines Felds, über das die Strecke nur führt, wenn es nicht anders geht (lieber 30 Felder Umweg) */
export const TIGHT = 30;

/**
 * Die Strecke: `path` vom Halt im Kessel (`stops.home`) bis zum Halt auf der Lichtung (`stops.out`), Feld
 * für Feld; das Feld des Laternenpfahls am Halt im Kessel (`shed`, fest wie eine Wand), die Warteplätze je Halt, alle Felder der Strecke (`on`, "x,y") und die Ausweichstufe
 * des Halts auf der Lichtung (`stage`, 0 im Wunschbereich)
 */
export type Route = {
  path: readonly Point[];
  stops: { home: Point; out: Point };
  shed: readonly Point[];
  seats: { home: readonly Point[]; out: readonly Point[] };
  on: ReadonlySet<string>;
  stage: StopStage;
};

/** Feld der Strecke vor und hinter der Tür des Tors `g`: t Reihen nach außen (0 die Tür, negativ in die Lichtung) */
export const trackAt = (g: Pick<GatePlace, 'mid' | 'out'>, t: number): Point => [
  g.mid[0] + g.out[0] * t + 2 * g.out[1],
  g.mid[1] + g.out[1] * t - 2 * g.out[0],
];

const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const grow = (points: readonly Point[], r: number) => {
  const out = new Set<string>();
  for (const [x, y] of points)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.add(key(x + dx, y + dy));
  return out;
};

/** Teil der Strecke auf der Lichtung: gerade Reihen ab der Tür und von ihrem Ende aus alle erlaubten Wege */
type Lichtung = { straight: Point[]; from: Map<string, string>; cost: (x: number, y: number) => number };

/**
 * Kosten eines Schritts auf ein Feld der Lichtung: nie (Infinity) auf Wasser, Wiese samt einem Feld, Kreis der
 * Gegenstücke, Plattformen, Klangsteine, Tröge samt Nachbarn, Torplatte und den Platz des Pinguins daneben (`BESIDE`),
 * den Durchgang des Eistors und Gleis und Bahnsteige eines anderen Fahrzeugs (`foreign`, die Höhlenbahn). Die Warteplätze an der Weltgrenze und die Felder direkt neben Plattformen und
 * Klangsteinen nur, wo es nicht anders geht (`TIGHT`): Sie liegen dicht an der Bucht, und ist dort der Weg geradeaus
 * versperrt (Teich, Fels, Busch), führt er manchmal nur über sie hinaus. Sonst 1.
 */
function costs(world: World, g: GatePlace) {
  const home = world.homes.lichtung;
  const crossing = crossings(world).find((c) => c.gate.id === g.id);
  const plates = [...world.portals.values()].flatMap((p) =>
    [p.gate, p.home].flatMap((c) => platformCells(c).map((f): Point => [f.x, f.y])),
  );
  const never = new Set([
    ...grow([...plates, ...world.stones.values()], 0),
    ...grow([home.food, home.water], 1),
    ...[-1, 0, 1, BESIDE].map((u) => key(...plateRow(g, u))),
    ...(crossing?.cells ?? []),
  ]);
  const tight = new Set([
    ...(crossing ? [...crossing.seats.values()].flat().map((p) => key(...p)) : []),
    ...grow([...plates, ...world.stones.values()], 1),
  ]);
  return (x: number, y: number) => {
    const c = world.cell(x, y);
    if (c.region !== 'lichtung' || world.realm(x, y) !== 'lichtung' || never.has(key(x, y)) || foreign(c))
      return Infinity;
    // Wiese (r 6) samt einem Feld und der Kreis der Gegenstücke (r 9, Plattformen 3 × 3)
    if (Math.hypot(x - home.bed[0], y - home.bed[1]) <= home.portalRing + 2 || c.ground === 'water') return Infinity;
    return tight.has(key(x, y)) ? TIGHT : 1;
  };
}

/** Liegt Wasser bis ein Feld (Schachbrett) um `p`? Der Halt hält zwei Felder Abstand zu Teichen */
const wet = (world: World, [x, y]: Point) =>
  [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => world.cell(x + dx, y + dy).ground === 'water'));

const lichtungCache = new WeakMap<World, Lichtung | null>();
/**
 * Gerade Reihen ab der Tür, so weit es geht (bis `STRAIGHT`, nur über Felder ohne Aufpreis), und von ihrem Ende aus
 * die günstigsten Wege (`costs`, bis 40.000 Felder; kehrt einer an den Rand der Tür zurück, kürzt `loopless` ihn)
 */
function lichtung(world: World): Lichtung | null {
  if (lichtungCache.has(world)) return lichtungCache.get(world)!;
  const g = world.gates.get('eis');
  let out: Lichtung | null = null;
  if (g) {
    const cost = costs(world, g);
    const straight: Point[] = [];
    for (let t = -1; t >= -STRAIGHT; t--) {
      const p = trackAt(g, t);
      if (cost(...p) !== 1 || !both(world, ...(straight.at(-1) ?? trackAt(g, 0)), ...p)) break;
      straight.push(p);
    }
    const start = straight.at(-1);
    if (start) out = { straight, from: cheapest(world, start, cost), cost };
  }
  lichtungCache.set(world, out);
  return out;
}

/** Günstigste Wege von `start` (Vorgänger je Feld, "x,y"), Schritte in beiden Richtungen begehbar */
function cheapest(world: World, start: Point, cost: (x: number, y: number) => number): Map<string, string> {
  const from = new Map<string, string>([[key(...start), '']]);
  const dist = new Map<string, number>([[key(...start), 0]]);
  const buckets: Point[][] = [[start]];
  for (let d = 0; d < buckets.length && dist.size < 40_000; d++)
    for (const [x, y] of buckets[d] ?? []) {
      if (dist.get(key(x, y)) !== d) continue;
      for (const [dx, dy] of ALL) {
        const [nx, ny] = [x + dx, y + dy];
        const nd = d + cost(nx, ny);
        if (nd >= (dist.get(key(nx, ny)) ?? Infinity) || !both(world, x, y, nx, ny)) continue;
        dist.set(key(nx, ny), nd);
        from.set(key(nx, ny), key(x, y));
        (buckets[nd] ??= []).push([nx, ny]);
      }
    }
  return from;
}

/** Geht der Schritt in beiden Richtungen? */
const both = (world: World, x: number, y: number, tx: number, ty: number) =>
  canStep(world, [...OPEN], x, y, tx, ty) && canStep(world, [...OPEN], tx, ty, x, y);

/** Liegt (x, y) auf dem Fußweg vom Bett der Lichtung zum Eistor (bis zwei Felder neben der Linie)? */
export function onFootpath(world: World, g: Pick<GatePlace, 'mid'>, [x, y]: Point): boolean {
  const bed = world.homes.lichtung.bed;
  const [ax, ay] = [g.mid[0] - bed[0], g.mid[1] - bed[1]];
  const [dx, dy] = [x - bed[0], y - bed[1]];
  const len = Math.hypot(ax, ay);
  const along = (dx * ax + dy * ay) / len;
  return along >= 0 && along <= len && Math.abs(dx * ay - dy * ax) / len <= 2;
}

/**
 * Halt des Fahrzeugs auf der Lichtung: neben der Plattform des Eistor-Portals am Bett (dort, wo das Kind das Portal
 * kennt), auf einem erreichbaren Feld ohne Aufpreis (`costs`), nicht auf dem Fußweg (`onFootpath`), zwei Felder weg
 * von Teichen, im Wunschbereich (`STOP_STAGES[0]`), so nah wie möglich an der Plattform, bei Gleichstand auf der Seite
 * der Strecke. Gibt es dort keins, weicht er Stufe für Stufe aus (`stage`). undefined ohne Eistor, Portal oder Platz.
 */
export function lichtungStop(world: World): { at: Point; stage: StopStage } | undefined {
  const part = lichtung(world);
  const g = world.gates.get('eis');
  const plate = world.portals.get('eis')?.home;
  if (!part || !g || !plate) return undefined;
  const bed = world.homes.lichtung.bed;
  const axis = Math.atan2(g.mid[1] - bed[1], g.mid[0] - bed[0]);
  const end = part.straight.at(-1)!;
  const sideOf = (p: Point) => Math.sign(Math.sin(Math.atan2(p[1] - bed[1], p[0] - bed[0]) - axis));
  const side = sideOf(trackAt(g, -STRAIGHT)) || 1;
  for (let stage = 0; stage < STOP_STAGES.length; stage++) {
    const { r } = STOP_STAGES[stage]!;
    const found: { at: Point; rank: number[] }[] = [];
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const at: Point = [plate[0] + x, plate[1] + y];
        const d = Math.hypot(x, y);
        if (d > r || !part.from.has(key(...at))) continue;
        if ((at[0] === end[0] && at[1] === end[1]) || onFootpath(world, g, at) || wet(world, at)) continue;
        if (part.cost(...at) !== 1) continue;
        found.push({ at, rank: [Math.round(d * 2), sideOf(at) === side ? 0 : 1, x, y] });
      }
    found.sort((a, b) => {
      for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i]! - b.rank[i]!;
      return 0;
    });
    if (found[0]) return { at: found[0].at, stage: stage as StopStage };
  }
  return undefined;
}

const routes = new WeakMap<World, Route | null>();
/**
 * Die Strecke des Schlittens in dieser Welt (je Welt einmal): undefined ohne Paket der Eis-Welt (keine Felder mit
 * `ride`) oder ohne Weg; dann gibt es keinen Schlitten, und man geht zu Fuß wie bisher
 */
export function sledRoute(world: World): Route | undefined {
  if (!routes.has(world)) routes.set(world, build(world) ?? null);
  return routes.get(world) ?? undefined;
}

function build(world: World): Route | undefined {
  const g = world.gates.get('eis');
  const part = lichtung(world);
  const stop = lichtungStop(world);
  if (!g || !part || !stop) return undefined;
  const inner = kesselPart(world, g);
  if (!inner || inner.length < 2) return undefined;
  const out: Point[] = [];
  for (let k = key(...stop.at); k; k = part.from.get(k) ?? '') out.unshift(fromKey(k));
  const path = loopless([...inner, trackAt(g, 0), ...part.straight, ...out.slice(1)]);
  const home = path[0]!;
  const [bx, by] = path[1]!;
  const back: Point = [home[0] - bx, home[1] - by];
  const shed = [postOf(home, back)];
  const on = new Set(path.map((p) => key(...p)));
  const keep = new Set([...grow(path, 1), ...grow(yardOf(home, back), 1)]);
  const seats = (realm: RegionId, at: Point) => seatsAt(world, realm, at, keep);
  return {
    path,
    stops: { home, out: stop.at },
    shed,
    seats: { home: seats('eis', home), out: seats('lichtung', stop.at) },
    on,
    stage: stop.stage,
  };
}

/** Schleifen herausnehmen: Kehrt der Weg auf ein Feld zurück (aus der Bucht zurück an den Rand der Tür), fällt sie weg */
function loopless(path: readonly Point[]): Point[] {
  const out: Point[] = [];
  const at = new Map<string, number>();
  for (const p of path) {
    const i = at.get(key(...p));
    if (i !== undefined) for (const q of out.splice(i + 1)) at.delete(key(...q));
    else {
      at.set(key(...p), out.length);
      out.push(p);
    }
  }
  return out;
}

/**
 * Strecke im Kessel und im Gang, vom Halt im Kessel bis zum ersten Feld hinter der Tür: Breitensuche über die Felder
 * mit `ride` ab dem Gang; der Halt ist das Feld am Ende
 */
function kesselPart(world: World, g: GatePlace): Point[] | undefined {
  const start = trackAt(g, 1);
  if (world.cell(...start).ride !== RIDE) return undefined;
  const from = new Map<string, string>([[key(...start), '']]);
  const queue: Point[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of ALL) {
      const k = key(x + dx, y + dy);
      if (from.has(k) || world.cell(x + dx, y + dy).ride !== RIDE || !both(world, x, y, x + dx, y + dy)) continue;
      from.set(k, key(x, y));
      queue.push([x + dx, y + dy]);
    }
  }
  const path: Point[] = [];
  for (let k = key(...queue.at(-1)!); k; k = from.get(k) ?? '') path.push(fromKey(k));
  return path;
}

/**
 * Feste Warteplätze an einem Halt: Wohnplätze der Gegend (erreichbar, nicht auf der Wiese, nicht an Durchgängen und
 * Plattformen) bis `SEAT_REACH` vom Halt, nicht an der Strecke oder am freien Platz hinter dem Halt (`keep`), nicht am Klangstein, nicht
 * an der Weltgrenze und nicht auf Gleis oder Bahnsteig eines anderen Fahrzeugs; der nächste zuerst
 */
function seatsAt(world: World, realm: RegionId, at: Point, keep: ReadonlySet<string>): Point[] {
  const crossing = crossings(world).flatMap((c) => [...c.cells, ...[...c.seats.values()].flat().map((p) => key(...p))]);
  const busy = new Set([...crossing, ...grow([...world.stones.values()], 1)]);
  return world
    .spotsOf(realm)
    .filter(
      (p) =>
        cheb(p, at) <= SEAT_REACH &&
        !keep.has(key(...p)) &&
        !busy.has(key(...p)) &&
        !foreign(world.cell(...p)) &&
        atHome(world, { kind: 'region', region: realm }, ...p),
    )
    .sort(
      (a, b) =>
        cheb(a, at) - cheb(b, at) ||
        Math.hypot(a[0] - at[0], a[1] - at[1]) - Math.hypot(b[0] - at[0], b[1] - at[1]) ||
        a[0] - b[0] ||
        a[1] - b[1],
    )
    .slice(0, RIDE_SEATS);
}
