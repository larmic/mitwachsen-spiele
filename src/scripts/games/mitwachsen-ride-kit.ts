// Gemeinsames der Fahrzeuge – rein, für die Pakete (die Fahr-Engine in worlds/fahrt/ und das Bild jedes Fahrzeugs in
// seinem Paket: Schlitten in worlds/eis/, Zug in worlds/bahn/; nur sie importieren es, Regel `ride-kit-is-for-packs`,
// darum nicht im Kern): Zeiten der Fahrregeln, beide Halte einer Strecke (`stopsOf`), wo ein Fahrzeug steht, wenn es
// nicht fährt (`parked`), das Feld der Fahrt bei einem Fortschritt (`cellOf`) und von wo es herbeitrabt (`trotFrom`).
// Die Regeln selbst stehen in der Fahr-Engine (worlds/fahrt/mitwachsen-ride.ts), sie kennt kein einzelnes Fahrzeug.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Der Schlitten“ und „Tok und die Bahn“, Fahren)

import type { Point } from '../../data/games/mitwachsen';
import type { RideSpec } from '../../data/games/mitwachsen-rides';
import type { Ride } from './mitwachsen-pack-types';
import { rank, ridden, stageOf } from './mitwachsen-ride-save';
import type { End, RideRoute, Rider, Vehicle } from './mitwachsen-rider';
import type { Sight } from './mitwachsen-sight';
import type { World } from './mitwachsen-world';

export const DUE = 20; // so viele Takte, nachdem die Welt es will (`ready`), erscheint es (wie der Pinguin)
export const COME = 15; // so lange trabt es aus den Bäumen herbei, dann bimmelt und schnaubt es (`come`)
export const DEPART = 20; // nach dem Einsteigen geht es so viele Takte später los (2 s; so lange steigt ein Pfeil weg aus)
export const SHOO = 10; // so lange hält es vor einem Tier, dann hüpft das Tier beiseite
export const ALIGHT = 10; // so lange nach der Ankunft steigt die Figur von selbst aus
export const JINGLE_EVERY = 15; // höchstens so oft bimmelt bzw. tutet es (Anstoßen, Winken unterwegs)
export const TAP_REACH = 4; // Antippen wirkt bis zu so vielen Feldern (Schachbrett)
export const CHEER = 4; // auf der Festfahrt winken Tiere und Schneemänner bis so weit
export const SNORE_EVERY = 30; // ein schlafendes Fahrzeug (ein Paket fehlt noch) schnarcht so oft, wenn die Figur nah ist
/** „Gute Nacht, Fahrzeuge“: Ein Fahrzeug, dessen Halt höchstens so weit (Schachbrett) vom Lichtungsbett steht, ist in Sichtweite */
export const SIGHT = 20;
const EPS = 1e-6;

export const key = (x: number, y: number) => `${x},${y}`;

/**
 * Fahrzeug am Halt: Ende der Strecke, Sitz, Zugtier (beim Zug das nächste Feld der Strecke) und alle Felder, die es
 * belegt (samt Laternenpfahl); `board`: die Felder, die zum Einsteigen da sind (Schlitten: der Sitz; Zug: jeder Wagen)
 */
export type Parked = {
  end: End;
  seat: Point;
  pull: Point;
  cells: ReadonlySet<string>;
  board: ReadonlySet<string>;
};

const halts = new WeakMap<RideRoute, Record<End, Parked>>();
const same = (a: readonly Point[], b: readonly Point[]) =>
  a.length === b.length && a.every((p, i) => key(...p) === key(...b[i]!));
/**
 * Hält eine Schleife (`RideRoute.loop`) ihre Form? `path` beginnt und endet am Sitz ihres einen Halts, beide Halte sind
 * dieses Feld (`stops.home` gleich `stops.out`) und beide Enden haben dieselben Warteplätze. Eine Pendelstrecke ist
 * immer in Ordnung. `stopsOf` bricht sonst ab: Die Figur käme am Ende der Runde auf einem anderen Feld an als dem Sitz
 */
export function loopOk(r: Pick<RideRoute, 'path' | 'stops' | 'seats' | 'loop'>): boolean {
  if (!r.loop) return true;
  const [first, last] = [r.path[0], r.path.at(-1)];
  return (
    !!first &&
    !!last &&
    r.path.length > 2 &&
    same([first, first, first], [last, r.stops.home, r.stops.out]) &&
    same(r.seats.home, r.seats.out)
  );
}
/**
 * Beide Halte einer Strecke: am Halt `home` der Sitz auf dem ersten Feld, auf der Lichtung auf dem letzten, das Zugtier
 * davor; ein Fahrzeug mit Wagen belegt dort die Felder seiner Wagen (`RideRoute.cars`). Eine Schleife
 * (`RideRoute.loop`) hat nur einen Halt: Beide Enden sind derselbe (`end` `'home'`, Sitz auf dem ersten Feld, Zugtier
 * auf dem zweiten)
 */
export function stopsOf(r: RideRoute): Record<End, Parked> {
  let out = halts.get(r);
  if (!out) {
    if (!loopOk(r)) throw new Error('Schleife muss am Sitz ihres einen Halts beginnen und enden');
    const park = (end: End, seat: Point, pull: Point, more: readonly Point[] = []): Parked => {
      const cars = r.cars?.[end];
      const cells = new Set([seat, pull, ...(cars ?? []), ...more].map((p) => key(...p)));
      return { end, seat, pull, cells, board: cars ? new Set(cars.map((p) => key(...p))) : new Set([key(...seat)]) };
    };
    const [first, second] = [r.path[0]!, r.path[1] ?? r.path[0]!];
    const home = park('home', first, second, r.shed);
    out = { home, out: r.loop ? home : park('out', r.path.at(-1)!, r.path.at(-2) ?? first) };
    halts.set(r, out);
  }
  return out;
}

/**
 * Wo das Fahrzeug steht, wenn es nicht fährt: am Halt der Gegend, in der die Figur ist, ab `bereit` (auf der Lichtung
 * erst ab der Stufe `spec.out`: der Schlitten nach der ersten Heimfahrt); liegen beide Halte in ihrer Gegend (der Zug
 * bei Ausbau 1), an dem, an dem es zuletzt ankam (`docked`, sonst auf der Lichtung). Undefined, solange es noch nicht da
 * ist, selbst unterwegs oder in einer anderen Gegend; fährt die Figur mit einem anderen Fahrzeug, steht es weiter da.
 * Eine Schleife (`RideRoute.loop`) steht immer an ihrem einen Halt, wenn die Figur in dessen Gegend ist
 */
export function parked(
  spec: Pick<RideSpec, 'id' | 'out'>,
  r: RideRoute,
  s: Pick<Rider, 'packs' | 'ride' | 'player' | 'docked'>,
  world: World,
): Parked | undefined {
  const stage = rank(stageOf(s.packs, spec.id));
  if (s.ride?.id === spec.id || stage < rank('bereit')) return undefined;
  const at = stopsOf(r);
  const realm = world.realm(s.player.x, s.player.y);
  const home = realm === world.realm(...at.home.seat);
  if (r.loop) return home ? at.home : undefined;
  const out = !!spec.out && stage >= rank(spec.out) && realm === world.realm(...at.out.seat);
  if (home && out) return at[s.docked?.[spec.id] ?? 'out'];
  return home ? at.home : out ? at.out : undefined;
}

/**
 * Feld der Fahrt bei Fortschritt `pos` (zum Halt auf der Lichtung vorwärts auf `path`, heim rückwärts; auf einer
 * Schleife, `RideRoute.loop`, immer vorwärts)
 */
export const cellOf = (r: Pick<RideRoute, 'path' | 'loop'>, ride: Pick<Ride, 'to'>, pos: number): Point => {
  const i = Math.floor(pos + EPS);
  return r.path[r.loop || ride.to === 'out' ? i : r.path.length - 1 - i]!;
};

const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/**
 * Feld in den Bäumen, aus dem es herbeitrabt: ein Baum 6 bis 8 Felder vom Halt `seat`, sonst ein Stück die Strecke
 * hinauf (auch für die Ansicht: Dort beginnt das Herbeitraben im Bild)
 */
export function trotFrom(r: Pick<RideRoute, 'path'>, world: World, [sx, sy]: Point): Point {
  let best: Point | undefined;
  for (let d = 6; d <= 8 && !best; d++)
    for (let y = sy - d; y <= sy + d && !best; y++)
      for (let x = sx - d; x <= sx + d && !best; x++)
        if (cheb(x, y, sx, sy) === d && world.cell(x, y).deco === 'tree') best = [x, y];
  return best ?? r.path[Math.min(8, r.path.length - 1)]!;
}

/**
 * „Gute Nacht, Fahrzeuge“ (Konzept „Reisewege“): Schläft die Figur im Bett der Lichtung und steht das Fahrzeug an seinem
 * Halt in Sichtweite (`SIGHT` Felder vom Bett, der Zug an Bahnhof Bär, der Schlitten auf seinem Platz), wo es steht;
 * sonst undefined (wach, in einem anderen Bett, unterwegs, zu weit weg oder noch nicht da). Eine Schleife
 * (`RideRoute.loop`, die Grubenbahn) sagt nie „Gute Nacht“: Sie wohnt in ihrer Welt, nicht an der Lichtung
 */
export function bedSight(
  spec: Pick<RideSpec, 'id' | 'out'>,
  r: RideRoute,
  s: Pick<Rider, 'packs' | 'ride' | 'player' | 'docked' | 'sleeping'>,
  world: World,
): Parked | undefined {
  const [bx, by] = world.homes.lichtung.bed;
  if (r.loop || !s.sleeping || s.player.x !== bx || s.player.y !== by) return undefined;
  const at = parked(spec, r, s, world);
  return at && cheb(...at.seat, bx, by) <= SIGHT ? at : undefined;
}

/**
 * Sehenswürdigkeit Halt eines Fahrzeugs (`WorldPack.sights`, mitwachsen-sight.ts; jedes Paket mit Fahrzeug trägt sie ein): Es lockt sein Sitz, solange es in der Gegend der Figur am Halt steht, wach ist und die Figur
 * noch nie gefahren hat (so lange hat seine Tür den goldenen Rahmen). Der Ruf ist sein Anstoß-Ton
 */
export function haltSight(v: Vehicle): Sight {
  const id = v.spec.id;
  return {
    id: `halt:${id}`,
    cells: (world, s) => {
      const r = v.route(world, s);
      const at = r && !s.dozing?.includes(id) && parked(v.spec, r, s, world);
      return at ? [at.seat] : [];
    },
    done: (s) => ridden(s.packs, id),
    call: (_, [x, y]) => ({ type: 'ride', what: 'nudge', id, x, y }),
  };
}
