// Bahnhof Bär und der Zug im Bild – rein, ohne DOM, gleich für 2D und 3D (Körper über den Haken `View2D.bodies`, wie
// Schlitten und Schuppen): ab Ausbau 1 die Reihen des Bahnsteigs (Planken, helle Kante, Stirnseite aus Holz), das
// Grasdach mit Bank, das Schild „Bär auf Grün“ und Toks Häuschen, dazu der Zug aus Lok und zwei Wagen am Bahnsteig, im
// hinteren Wagen Tok. Solange Tok baut (`State.work`, mitwachsen-build.ts), ploppt der Bahnhof zum Augenblick `pop` auf
// (er wächst kurz aus dem Boden), der Zug rollt von `roll` an das Gleis entlang heran, die Tür des hinteren Wagens geht
// zu `door` auf, und Tok sitzt ab `board` darin. Der Zug rollt aus dem Tunnelportal heran: Was von ihm noch im Tunnel
// ist, ist nicht zu sehen. Bei reduzierter Bewegung kein Aufploppen, kein Dampf, der Zug rückt in
// ruhigen Sprüngen vor. Der Zug fährt nie durch die Figur: Steht sie auf dem Gleis, hält er davor. Wo alles steht,
// rechnet `stationOf` je Welt einmal aus den Feldern (Gleis vom Prellbock an Bahnhof Bär, Bahnsteig, Häuschen).
// Fahren: Der Zug steht, wo die Regeln ihn parken (`parked`: an Bahnhof Bär, am Prellbock in der Bucht, an Bahnhof
// Fledermaus), und fährt mit der Figur im mittleren Wagen das Gleis entlang (zwischen den Takten gleitend, bei
// reduzierter Bewegung springt er ans Ziel); die Tür des mittleren Wagens hat bis zur ersten Fahrt (`gefahren`) einen
// goldenen Rahmen, solange er dort steht, wo die Figur einsteigen kann (nicht, solange er schläft, weil ein Paket
// fehlt: dann ohne Dampf und Licht), angestoßen geht sie kurz auf; im Tunnel und am
// Abend leuchten die Lampen; Tok sitzt im hinteren Wagen, solange er nicht in der Bucht wartet. Teil des Pakets der
// Bahn (view-2d.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 1)

import type { Dir, Part } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { BUILD, LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import {
  CAR,
  ROOF,
  SIGN,
  carParts,
  rowParts,
  steamParts,
  type CarLook,
} from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import { dirTo } from '../../mitwachsen-free';
import { heraldOf, workOf } from '../../mitwachsen-herald';
import type { RideAt, RideBody } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { hutOf, rowsOf } from './mitwachsen-bear';
import { builtOf } from './mitwachsen-built';
import { key } from './mitwachsen-ground';
import { parked } from '../../mitwachsen-ride-kit';
import { ridden, tokOf } from '../../mitwachsen-ride-save';
import { LETTERS, STEPS } from './mitwachsen-trace';
import { SEAT, TRAIN, bearEnd, farOf, inTunnel, lineOf, trainRoute } from './mitwachsen-train';
import { batBodies } from './mitwachsen-bat-look';
import { capOf } from './mitwachsen-build2';

/** Bahnhof Bär in einer Welt: das Gleis vom Prellbock an (Ausbau 1, bis an den Prellbock vor der Tür), Reihen, Häuschen */
export type BearStation = {
  line: Point[];
  rows: { edge: Point; back: Point }[];
  hut?: { at: Point; row: number };
  /** vom Gleis zum Bahnsteig */
  side: Point;
  /** Stelle des Tunnelportals im Gleis (undefined: keins gefunden) */
  portal?: number;
};

const stations = new WeakMap<World, BearStation | null>();

/** Das Gleis des Ausbaus 1 vom Feld `start` an in Reihe (den Richtungen der Stücke nach) */
function railFrom(world: World, start: Point | undefined): Point[] {
  const line: Point[] = [];
  for (let p = start; p && line.length < 400;) {
    line.push(p);
    const r = world.cell(...p).rail;
    const on = r && (line.length === 1 ? r.to[0] : r.to[1]);
    if (!r || r.stage !== 1 || !on) break;
    const [dx, dy] = STEPS[LETTERS.indexOf(on)]!;
    p = [p[0] + dx, p[1] + dy];
  }
  return line;
}

/** Die Felder eines Bahnsteigs (`Cell.stop`) bis zwei Felder neben dem Gleis `lane` */
function platformBy(world: World, lane: readonly Point[]): Point[] {
  const found = new Map<string, Point>();
  for (const [x, y] of lane)
    for (const [dx, dy] of STEPS)
      for (const k of [1, 2]) {
        const q: Point = [x + dx * k, y + dy * k];
        if (world.cell(...q).stop === 'hoehle') found.set(key(...q), q);
      }
  return [...found.values()];
}

/**
 * Bahnhof Bär aus den Feldern der Welt (je Welt einmal): der Prellbock am Anfang der Linie auf der Lichtung, von dort das
 * Gleis des Ausbaus 1 in Reihe, die Felder des Bahnsteigs (`Cell.stop`) daneben; null ohne Gleis
 */
export function stationOf(world: World): BearStation | null {
  if (stations.has(world)) return stations.get(world)!;
  const bed = world.homes.lichtung.bed;
  const line = railFrom(world, bearEnd(world));
  const lane = line.slice(0, LINE.bear.long);
  const platform = platformBy(world, lane);
  const rows = rowsOf({ lane, platform });
  const [first, head] = [rows[0], lane[0]];
  const portal = line.findIndex((p) => world.cell(...p).rail?.part === 'portal');
  const found: BearStation | null =
    first && head
      ? {
          line,
          rows,
          hut: hutOf({ lane, platform }, bed),
          side: [first.edge[0] - head[0], first.edge[1] - head[1]],
          ...(portal > 0 ? { portal } : {}),
        }
      : null;
  stations.set(world, found);
  return found;
}

const memo = new Map<string, Part[]>();
const model = (k: string, make: () => Part[]) => memo.get(k) ?? (memo.set(k, make()), memo.get(k)!);

/** Wo die Front der Lok steht, wenn der Zug am Bahnsteig hält (Stelle im Gleis vom Prellbock an) */
export const PARK = 0.9;
/** Abstand der Wagen: Länge eines Wagens und eine kleine Lücke */
const GAP = CAR + 0.1;
/** Die Reihe des Bahnsteigs (vom Prellbock an) neben dem hinteren Wagen des haltenden Zugs: Dort steigt Tok ein */
export const REAR_ROW = Math.round(PARK + 2 * GAP + CAR / 2);
/** So viele Felder rollt der Zug beim Bau heran, wenn es kein Tunnelportal gibt (sonst aus dem Portal) */
export const ROLL_IN = 16;
/** Bei reduzierter Bewegung rückt er beim Bau in Sprüngen so vieler Felder heran */
const JUMP = 2;
/** Kennung der Körper des Zugs (`ride:` trifft das Antippen, wie beim Schlitten) */
export const TRAIN_ID = 'ride:hoehle';
/** So lange ploppt der Bahnhof auf (Bruchteil des Baus) */
const POP_FOR = 0.06;

/**
 * Wie weit Bau 1 ist, zwischen den Takten weiter (`frac`); undefined: es wird nicht gebaut (oder es ist Bau 2, der den
 * Bahnhof Bär nicht ändert und den Zug fahren lässt)
 */
function progress(state: State, at: Pick<RideAt, 'frac'>): number | undefined {
  const w = builtOf(state.packs) >= 2 ? undefined : workOf(state);
  return w === undefined ? undefined : Math.min(1, w + at.frac / BUILD.ticks);
}

/** Punkt an der Stelle `t` (in Feldern vom Prellbock an) des Gleises, zwischen den Feldern weiter, samt Höhe */
function along(world: World, line: readonly Point[], t: number): [number, number, number] {
  const n = line.length - 1;
  const c = Math.max(0, Math.min(n, t));
  const i = Math.min(n - 1, Math.floor(c));
  const a = line[Math.max(0, i)]!,
    b = line[Math.max(0, Math.min(n, i + 1))]!;
  const f = n > 0 ? c - i : 0;
  const ha = world.cell(...a).h,
    hb = world.cell(...b).h;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, ha + (hb - ha) * f];
}

/**
 * Wo die Front der Lok steht (Stelle im Gleis): am Bahnsteig (`PARK`); solange der Zug beim Bau heranrollt, weiter weg,
 * zu Beginn am Tunnelportal (zuerst schnell, dann langsamer; bei reduzierter Bewegung in Sprüngen); vor dem Augenblick
 * `roll` ist er noch nicht da (undefined). Steht die Figur auf dem Gleis zwischen ihm und dem Bahnsteig, hält er vor ihr
 */
export function frontAt(
  st: BearStation,
  player: { x: number; y: number },
  work: number | undefined,
  reduced: boolean,
): number | undefined {
  const [r0, r1] = BUILD.roll;
  if (work !== undefined && work < r0) return undefined;
  const room = Math.max(0, st.portal ?? Math.min(ROLL_IN, st.line.length - 1 - PARK - 3 * GAP));
  const q = work === undefined ? 1 : Math.min(1, (work - r0) / (r1 - r0));
  let off = room * (1 - q) ** 2;
  if (reduced) off = Math.ceil(off / JUMP - 1e-9) * JUMP;
  const front = PARK + Math.min(room, off);
  const k = st.line.findIndex((p) => p[0] === player.x && p[1] === player.y);
  return k >= 0 && k + 1 > front - 3 * GAP && k < front + 3 * GAP ? Math.max(front, k + 1.1) : front;
}

const RIGHT: Record<Dir, Point> = { e: [0, 1], w: [0, -1], s: [-1, 0], n: [1, 0] };

/**
 * Körper von Bahnhof Bär und Zug je Bild (`View2D.bodies`), ab Ausbau 1; ab Ausbau 2 in der Welt dazu Bahnhof
 * Fledermaus und der Lokschuppen (mitwachsen-bat-look.ts); leer davor und in einer Welt ohne Gleis
 */
export function stationBodies(state: State, world: World, at: RideAt): readonly RideBody[] {
  if (builtOf(state.packs) < 1) return [];
  const st = stationOf(world);
  if (!st) return [];
  const work = progress(state, at);
  return [...stationParts(st, world, work, at.reduced), ...trainParts(st, world, state, work, at), ...batBodies(world)];
}

/** Bahnsteig, Dach mit Bank, Schild und Häuschen; beim Bau erst ab `pop`, dann wachsen sie kurz aus dem Boden */
function stationParts(st: BearStation, world: World, work: number | undefined, reduced: boolean): RideBody[] {
  if (work !== undefined && work < BUILD.pop) return [];
  const rise = work === undefined || reduced ? 0 : Math.max(0, 1 - (work - BUILD.pop) / POP_FOR) * -0.9;
  const dir = dirTo(...st.side);
  const out: RideBody[] = st.rows.map(({ edge, back }, i) => {
    const hut = st.hut?.row === i;
    const k = `bahn:reihe:${i % 2}${+hut}`;
    return {
      id: `bahn:reihe:${i}`,
      key: k,
      x: (edge[0] + back[0]) / 2,
      y: (edge[1] + back[1]) / 2,
      z: world.cell(...edge).h + rise,
      dir,
      parts: model(k, () => rowParts(i % 2 === 1, hut)),
    };
  });
  const n = st.rows.length;
  const pair = st.hut?.row === n - 1 ? [n - 3, n - 2] : [1, 2];
  const under = pair.flatMap((i) => (st.rows[i] ? [st.rows[i].edge, st.rows[i].back] : []));
  if (under.length === 4) {
    const x = under.reduce((s, p) => s + p[0], 0) / 4,
      y = under.reduce((s, p) => s + p[1], 0) / 4;
    const z = world.cell(...under[0]!).h + rise;
    out.push(
      { id: 'bahn:dach', key: 'bahn:dach', x, y, z, dir, parts: ROOF },
      { id: 'bahn:schild', key: 'bahn:schild', x, y, z: z + 1.74, dir: 's', parts: SIGN },
    );
  }
  return out;
}

/** So viele Takte nach dem Anstoßen steht die Tür des mittleren Wagens einladend offen (1 s) */
export const OPEN_TICKS = 10;

/** Wo der Zug steht: das Gleis von Bahnhof Bär an und die Stelle der Front der Lok darauf */
type Place = { line: readonly Point[]; front: number };

/**
 * Fortschritt des Sitzes in diesem Bild: zwischen den Takten gleitend, außer der Zug hält am Prellbock, wo Tok Bau 2
 * baut (`Ride.stopover`); bei reduzierter Bewegung springt er ans Ziel und steht bis zur Ankunft am Halt (bei Bau 2 ab
 * dem Prellbock dort)
 */
function seatAt(ride: NonNullable<State['ride']>, len: number, world: World, at: RideAt): number {
  const cap = ride.stopover ? capOf(world) : Infinity;
  const held = ride.stopover === 'ahead' && ride.pos >= cap - 1e-6;
  const p = ride.phase === 'go' && !held ? Math.max(0, ride.pos - ride.speed * (1 - at.frac)) : ride.pos;
  if (!at.reduced || p >= len) return p;
  return p >= cap - 1e-6 ? cap : 0;
}

/**
 * Wo der Zug gerade ist: unterwegs mit der Figur (der Sitz zwischen den Takten gleitend; bei reduzierter Bewegung steht
 * er bis zur Ankunft am Halt, von dem er abfuhr, und springt dann ans Ziel; die Kamera folgt dem Sitz, bleibt also still), am Halt in der Welt (Prellbock in der Bucht, Bahnhof Fledermaus) oder an Bahnhof Bär
 * (dort rollt er beim Bau heran und hält vor der Figur, `frontAt`); undefined, solange er noch nicht da ist
 */
function placeOf(st: BearStation, world: World, state: State, work: number | undefined, at: RideAt): Place | undefined {
  const r = work === undefined ? trainRoute(world, state) : undefined;
  const ride = state.ride?.id === TRAIN.id ? state.ride : undefined;
  if (r && ride) {
    const line = lineOf(world, farOf(state));
    const p = seatAt(ride, r.path.length - 1, world, at);
    const q = ride.to === 'out' ? line.length - 1 - SEAT - p : SEAT + p;
    return { line, front: q - SEAT + PARK };
  }
  const end = r && (parked(TRAIN, r, state, world)?.end ?? state.docked?.[TRAIN.id]);
  if (r && end === 'home') {
    const line = lineOf(world, farOf(state));
    return { line, front: line.length - 1 - 2 * SEAT + PARK };
  }
  const front = frontAt(st, state.player, work, at.reduced);
  return front === undefined ? undefined : { line: st.line, front };
}

/**
 * Tür und Licht des Zugs: bis zur ersten Fahrt (`gefahren`, gespeichert) ein goldener Rahmen um die Tür, wo die Figur
 * einsteigen kann, angestoßen geht sie kurz auf, abends und im Tunnel leuchten die Lampen. Schläft er (ein Paket fehlt
 * noch, Vorladen), nichts davon: keine goldene Tür, die Tür bleibt zu, die Lampen sind aus, kein Dampf; nichts ist grau
 */
function doorOf(world: World, state: State, work: number | undefined, at: RideAt, riding: boolean) {
  const r = work === undefined && !riding ? trainRoute(world, state) : undefined;
  const dozing = !!state.dozing?.includes(TRAIN.id) && !riding;
  const gold = !!r && !dozing && !ridden(state.packs, TRAIN.id) && !!parked(TRAIN, r, state, world);
  const nudged = state.nudged?.id === TRAIN.id && state.tick - state.nudged.at < OPEN_TICKS && !riding && !dozing;
  const lit = !dozing && (at.lit || inTunnel(state, world));
  return { dozing, gold, nudged, lit };
}

/**
 * Lok und zwei Wagen am Gleis (beim Bau rollen sie aus dem Tunnelportal heran; ein Wagen, dessen Mitte noch hinter dem
 * Portal ist, ist nicht zu sehen; unterwegs sitzt die Figur im mittleren Wagen, `seat`), Dampf über der Lok (nicht bei
 * reduzierter Bewegung)
 */
function trainParts(st: BearStation, world: World, state: State, work: number | undefined, at: RideAt): RideBody[] {
  const place = placeOf(st, world, state, work, at);
  if (!place) return [];
  const riding = state.ride?.id === TRAIN.id;
  const tok = work === undefined ? tokOf(state.packs) !== undefined && !heraldOf(state) : work >= BUILD.board;
  const open = work !== undefined && work >= BUILD.door;
  const { dozing, gold, nudged, lit } = doorOf(world, state, work, at, riding);
  const kinds: CarLook['kind'][] = ['loco', 'mid', 'rear'];
  const hidden = (a: number) => work !== undefined && st.portal !== undefined && a + CAR / 2 > st.portal;
  const out = kinds.flatMap((kind, i): RideBody[] => {
    const a = place.front + i * GAP; // Front dieses Wagens
    if (hidden(a)) return [];
    const [x, y, z] = along(world, place.line, a + CAR / 2);
    const [fx, fy] = along(world, place.line, a);
    const [bx, by] = along(world, place.line, a + CAR);
    const dir = dirTo(fx - bx, fy - by);
    const [rx, ry] = RIGHT[dir];
    const side = rx * st.side[0] + ry * st.side[1] > 0 ? 1 : -1;
    const mid = kind === 'mid';
    const look: CarLook = {
      kind,
      tok: kind === 'rear' && tok,
      door: (kind === 'rear' && open) || (mid && nudged) ? side : 0,
      rider: mid && riding,
      frame: mid && gold ? side : 0,
      lit: kind === 'loco' && lit,
    };
    const k = `${TRAIN_ID}:${kind}:${+look.tok}${look.door}${+!!look.rider}${look.frame}${+!!look.lit}`;
    const seat = mid && riding ? { seat: true as const } : {};
    return [{ id: `${TRAIN_ID}:${kind}`, key: k, x, y, z, dir, parts: model(k, () => carParts(look)), ...seat }];
  });
  const loco = out.find((b) => b.id === `${TRAIN_ID}:loco`);
  if (loco && !at.reduced && !dozing) {
    const phase = Math.floor(at.now / 400) % 4;
    const k = `${TRAIN_ID}:dampf:${phase}`;
    out.push({ ...loco, id: `${TRAIN_ID}:dampf`, key: k, parts: model(k, () => steamParts(phase)) });
  }
  return out;
}
