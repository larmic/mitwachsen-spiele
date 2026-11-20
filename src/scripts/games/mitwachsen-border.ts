// Weltgrenze am Tor – rein, ohne DOM: Jedes Tier bleibt in seiner Gegend. Betritt die Figur das erste Feld des
// Durchgangs in eine andere Gegend (von der Lichtung aus die Torreihe des Eistors, vom Gletscherkessel aus die
// Gangmündung), lösen sich alle Tiere der Kette, die nicht in die Gegend dahinter gehören, auch die hinteren: Sie drehen
// sich zur Figur und setzen sich auf feste Warteplätze davor. Kommt die Figur auf ihre Seite zurück, reihen sie sich
// wieder ein; erst beim Schlafen gehen sie heim. Kein Ablauf nach Zeit, nichts davon wird gespeichert. Teil der Regeln
// (mitwachsen-state.ts).
// Spezifikation: docs/specs/mitwachsen.md (Regel 7a „Weltgrenze“)

import { fromKey } from '../../lib/games/chunks';
import { DIRS, type Dir } from '../../lib/games/front';
import { REGIONS, type Point, type RegionId, type SpeciesId } from '../../data/games/mitwachsen';
import { dirTo, freeNear, occupied, type Crowd } from './mitwachsen-free';
import { atHome } from './mitwachsen-meadow';
import { GATE_HALF, standHeight, type GatePlace, type World } from './mitwachsen-world';

export const SEATS = 16; // feste Warteplätze je Seite: genug für eine lange Kette, danach das nächste freie Feld
const REACH = 12; // so weit liegen die Warteplätze höchstens vom ersten Feld ihrer Seite

/**
 * Was ein Tier tut: umherlaufen, folgen, auf der Wiese wohnen, an der Weltgrenze warten oder (der verlaufene Pinguin)
 * die Figur zum Tor führen (mitwachsen-guide.ts)
 */
export type Mode = 'wander' | 'follow' | 'home' | 'wait' | 'lead';

/** Durchgang zwischen zwei Gegenden: Torreihe, Gang und Mündung, das erste Feld je Seite und die Warteplätze davor */
export type Crossing = {
  gate: GatePlace;
  realms: readonly [RegionId, RegionId]; // vor dem Tor, dahinter
  cells: ReadonlySet<string>; // alle Felder des Durchgangs ("x,y")
  entries: ReadonlyMap<string, RegionId>; // erstes Feld je Seite → Gegend, von der aus man es betritt
  seats: ReadonlyMap<RegionId, readonly Point[]>; // Warteplätze je Seite, der nächste zuerst
  fits: (side: RegionId, p: Point) => boolean; // darf ein Tier dieser Seite hier warten? (auch für Plätze daneben)
};

export type BorderEvent =
  | { type: 'wait'; id: string; species: SpeciesId } // ein Tier setzt sich an der Weltgrenze auf seinen Warteplatz
  | { type: 'rejoin'; id: string; species: SpeciesId } // die Figur ist zurück: Es reiht sich wieder ein
  | { type: 'realm'; to: RegionId }; // die Figur wechselt an der Gangmitte in eine andere Gegend

/** Was die Weltgrenze vom Zustand braucht (Teil des Zustands der Regeln) */
export type Border = Omit<Crowd, 'player' | 'animals'> & {
  player: { x: number; y: number; dir: Dir };
  animals: {
    id: string;
    species: SpeciesId;
    x: number;
    y: number;
    dir: Dir;
    mode: Mode;
    realm: RegionId;
  }[];
  followers: string[];
};

const key = (x: number, y: number) => `${x},${y}`;

/** Abstand eines Felds quer zur Achse des Durchgangs (der Weg davor, so breit wie das Tor, bleibt frei) */
const across = (g: GatePlace, [x, y]: Point) => Math.abs((x - g.mid[0]) * g.out[1] - (y - g.mid[1]) * g.out[0]);

const cache = new WeakMap<World, Crossing[]>();
/** Durchgänge einer Welt: einer je Gegend hinter einem Tor (heute das Eistor in den Gletscherkessel) */
export function crossings(world: World): Crossing[] {
  let out = cache.get(world);
  if (!out) {
    out = REGIONS.flatMap((r) => {
      const gate = r.behind && world.gates.get(r.behind);
      return gate ? [crossingOf(world, gate, r.id)] : [];
    });
    cache.set(world, out);
  }
  return out;
}

/**
 * Durchgang durch ein Tor in die Gegend `inner`: von jedem Torfeld geradeaus nach außen, bis zum Boden der Gegend.
 * Erstes Feld einer Seite ist jedes Feld des Durchgangs, das man von dort aus betritt. Die Warteplätze liegen vor ihm auf
 * Feldern, auf denen Tiere der Seite wohnen dürfen (nicht an Durchgängen, nicht auf der Wiese, nicht am Klangstein),
 * neben dem Weg davor, nebeneinander: der nächste zuerst.
 */
function crossingOf(world: World, gate: GatePlace, inner: RegionId): Crossing {
  const open = [gate.id];
  const cells = new Set<string>();
  for (const [gx, gy] of gate.cells)
    for (let k = 0; k < 400; k++) {
      const [x, y] = [gx + gate.out[0] * k, gy + gate.out[1] * k];
      if (world.cell(x, y).region === inner || standHeight(world, open, x, y) === null) break;
      cells.add(key(x, y));
    }
  const entries = new Map<string, RegionId>();
  for (const k of cells) {
    const [x, y] = fromKey(k);
    for (const [dx, dy] of Object.values(DIRS))
      if (!cells.has(key(x + dx, y + dy)) && standHeight(world, open, x + dx, y + dy) !== null)
        entries.set(k, world.realm(x + dx, y + dy));
  }
  const stone = ([x, y]: Point) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => world.cell(x + dx, y + dy).story));
  const firsts = new Map<RegionId, Point[]>();
  for (const [k, side] of entries) firsts.set(side, [...(firsts.get(side) ?? []), fromKey(k)]);
  const dist = (side: RegionId, [x, y]: Point) =>
    Math.min(...(firsts.get(side) ?? []).map(([fx, fy]) => Math.max(Math.abs(x - fx), Math.abs(y - fy))));
  const fits = (side: RegionId, p: Point) =>
    dist(side, p) <= REACH &&
    across(gate, p) > GATE_HALF &&
    !stone(p) &&
    atHome(world, { kind: 'region', region: side }, ...p);
  const seats = new Map<RegionId, Point[]>();
  for (const side of firsts.keys()) {
    const near = world.spotsOf(side).filter((p) => fits(side, p));
    near.sort(
      (a, b) => dist(side, a) - dist(side, b) || across(gate, a) - across(gate, b) || a[0] - b[0] || a[1] - b[1],
    );
    seats.set(side, near.slice(0, SEATS));
  }
  return { gate, realms: [world.realm(...gate.mid), inner], cells, entries, seats, fits };
}

/**
 * Die Figur ist von `from` auf ihr Feld gekommen (Schritt, Platztausch, Reise). An der Gangmitte wechselt die Gegend
 * (`realm`). Betritt sie von außen das erste Feld eines Durchgangs, setzen sich alle Tiere der Kette, die nicht in die
 * Gegend dahinter gehören, auf ihre Warteplätze (`wait`). Steht sie außerhalb der Durchgänge, reihen sich die Wartenden
 * ihrer Gegend wieder ein (`rejoin`).
 */
export function crossBorder(s: Border, world: World, from: Point, events: { push(e: BorderEvent): unknown }) {
  const { x, y } = s.player;
  const realm = world.realm(x, y);
  if (realm !== world.realm(...from)) events.push({ type: 'realm', to: realm });
  const here = crossings(world).find((c) => c.cells.has(key(x, y)));
  if (!here) {
    for (const a of s.animals)
      if (a.mode === 'wait' && a.realm === realm) {
        a.mode = 'follow';
        s.followers.push(a.id);
        events.push({ type: 'rejoin', id: a.id, species: a.species });
      }
    return;
  }
  const side = here.entries.get(key(x, y));
  if (!side || here.cells.has(key(...from))) return;
  const beyond = here.realms[0] === side ? here.realms[1] : here.realms[0];
  for (const id of [...s.followers]) {
    const a = s.animals.find((t) => t.id === id)!;
    if (a.realm === beyond) continue; // gehört hinüber: folgt weiter und rückt auf
    s.followers = s.followers.filter((f) => f !== id);
    a.mode = 'wait';
    [a.x, a.y] = seatFor(s, world, here, side, id); // setzt sich auf seinen Warteplatz (die Ansicht lässt es gleiten)
    a.dir = dirTo(x - a.x, y - a.y); // und schaut zur Figur
    events.push({ type: 'wait', id, species: a.species });
  }
}

/** Warteplatz für ein Tier: der nächste freie feste Platz seiner Seite, sonst das nächste freie Feld daneben */
function seatFor(s: Border, world: World, c: Crossing, side: RegionId, id: string): Point {
  const free = (x: number, y: number) => !occupied(s, x, y, id);
  const seats = c.seats.get(side) ?? [];
  const fixed = seats.find((p) => free(...p));
  if (fixed) return fixed;
  const ok = (x: number, y: number) => free(x, y) && c.fits(side, [x, y]); // gleiche Bedingungen wie die festen Plätze
  const a = s.animals.find((t) => t.id === id)!;
  return freeNear(s, world, seats.at(-1) ?? [a.x, a.y], ok, id) ?? [a.x, a.y];
}
