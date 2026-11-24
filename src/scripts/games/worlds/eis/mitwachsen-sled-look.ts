// Aussehen und Klang des Schlittens der Eis-Welt, gleich für 2D und 3D (Haken `View2D.bodies`, `marks` und `rideFx`,
// mitwachsen-ride-view.ts) – rein, ohne DOM und Three.js. Körper: der Schlitten (mit goldenem Rahmen bis zur ersten
// Fahrt, danach mit Wimpel; am Abend mit Laterne; angestoßen kurz mit offenen Seitenwänden; während der Fahrt sitzt
// die Figur darin), das Schlittenrentier davor und der Schuppen aus Eisblöcken. Wo sie stehen, folgt nur aus dem Zustand: am Halt der Gegend der Figur, beim
// Erscheinen trabt er aus den Tannen herbei, unterwegs gleitet er zwischen den Takten weiter (bei reduzierter Bewegung
// in ruhigen Sprüngen alle 3 Felder). Durch die Tür rückt er etwas zur Mitte, sonst führe er durch die Torflügel.
// Marken: die Schneespur im Kessel ab dem Erscheinen, auf der Lichtung ab der ersten Heimfahrt (auf ihr wächst sie mit),
// dazu der Schneefleck am Halt. Töne: Schellen-Bimmeln D6/A5 (`RIDES`), Abfahrt, Tuten, Schnauben, Fest.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import type { Dir, Part } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { REINDEER, shedParts, sledParts } from '../../../../data/games/worlds/eis/mitwachsen-sled-models';
import { dirTo } from '../../mitwachsen-free';
import type { Ride, RideEvent } from '../../mitwachsen-pack-types';
import type { RideAt, RideBody, RideFx } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { Box } from '../../mitwachsen-view';
import { standHeight, type GatePlace, type World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { COME, cellOf, parked, trotFrom } from '../../mitwachsen-ride-kit';
import { stageOf } from '../../mitwachsen-ride-save';
import { SLED } from './mitwachsen-sled';
import { sledRoute, type Route } from './mitwachsen-sled-route';

/** Kennung der Körper (`ride:` trifft das Antippen) */
export const SLED_ID = `ride:${SLED.id}`;
/** Bei reduzierter Bewegung rückt der Schlitten in Sprüngen so vieler Felder vor */
export const JUMP = 3;
/** So viele Takte nach dem Anstoßen (und nach dem Herbeitraben) stehen die Seitenwände einladend offen (1 s) */
export const OPEN_TICKS = 10;
/** In der Tür rückt der Körper so weit zur Mitte (quer, in Feldern von der Mitte; die Spur liegt bei 2) */
export const DOOR_U = 1.4;
const TRACK_SNOW = ['#b7cde0', '#c9dcec'] as const; // festgefahrene Spur im Schnee
const TRACK_GRASS = ['#dfe9f2', '#f2f7fb'] as const; // Schneespur auf dem Gras der Lichtung
const PATCH = ['#e8f0f7', '#f6f9fc'] as const; // Schneefleck am Halt auf der Lichtung
const FLAKES = ['#ffffff', '#dfe9f2', '#bfe6f5'] as const;
const NONE: readonly Box[] = []; // immer dasselbe: Die 3D-Ansicht baut nur bei einer neuen Liste neu

type Spot = { x: number; y: number; z: number; dir: Dir };

const memo = new Map<string, Part[]>();
/** Teile einer Variante, je Schlüssel einmal (die 3D-Ansicht baut jede Form nur einmal) */
const model = (key: string, make: () => Part[]) => memo.get(key) ?? (memo.set(key, make()), memo.get(key)!);

/** Höhe, auf der etwas auf dem Feld (x, y) steht */
const heightAt = (state: State, world: World) => (x: number, y: number) =>
  standHeight(world, state.openGates, x, y) ?? world.cell(x, y).h;

/**
 * Punkt bei Fortschritt `p` (in Feldern) auf der Fahrt zum Ende `ride.to`, zwischen den Feldern gleitend; über das Ende
 * hinaus geht es geradeaus weiter (dort läuft das Zugtier, wenn der Schlitten ankommt)
 */
function along(r: Route, ride: Pick<Ride, 'to'>, p: number, h: (x: number, y: number) => number): Spot {
  const i = Math.max(0, Math.min(Math.floor(p), r.path.length - 2));
  const [a, b] = [cellOf(r, ride, i), cellOf(r, ride, i + 1)];
  const f = p - i;
  const k = Math.min(1, f);
  return {
    x: a[0] + (b[0] - a[0]) * f,
    y: a[1] + (b[1] - a[1]) * f,
    z: h(...a) + (h(...b) - h(...a)) * k,
    dir: dirTo(b[0] - a[0], b[1] - a[1]),
  };
}

/** In der Tür (und in der Reihe davor und den ersten Gangreihen) zur Mitte hin rücken: nicht durch die Torflügel */
export function narrow(s: Spot, g: Pick<GatePlace, 'mid' | 'out'> | undefined): Spot {
  if (!g) return s;
  const [ox, oy] = g.out;
  const [px, py] = [s.x - g.mid[0], s.y - g.mid[1]];
  const t = px * ox + py * oy; // Reihen nach außen (in den Gang)
  const u = px * oy - py * ox; // quer, die Spur liegt bei +2
  const w = Math.max(0, Math.min(1, t + 2, 4 - t));
  if (!w || Math.abs(Math.abs(u) - 2) > 0.5) return s;
  const d = (Math.sign(u) * DOOR_U - u) * w;
  return { ...s, x: s.x + oy * d, y: s.y - ox * d };
}

/** Schlitten und Zugtier während der Fahrt: zwischen den Takten weiter (`frac`), bei reduzierter Bewegung in Sprüngen */
function riding(r: Route, ride: Ride, at: RideAt, h: (x: number, y: number) => number): [Spot, Spot] {
  const len = r.path.length - 1;
  let p = ride.phase === 'go' ? Math.max(0, ride.pos - ride.speed * (1 - at.frac)) : ride.pos;
  if (at.reduced && p < len) p = Math.floor(p / JUMP) * JUMP;
  return [along(r, ride, p, h), along(r, ride, p + 1, h)];
}

/** Schlitten und Zugtier am Halt; gerade erschienen, traben sie aus den Tannen herbei (nicht bei reduzierter Bewegung) */
function standing(r: Route, state: State, world: World, at: RideAt, h: (x: number, y: number) => number) {
  const stop = parked(SLED, r, state, world);
  if (!stop) return undefined;
  const { seat, pull } = stop;
  const dir = dirTo(pull[0] - seat[0], pull[1] - seat[1]);
  const left = stop.end === 'home' && !at.reduced ? Math.max(0, state.rideDue - state.tick - at.frac) / COME : 0;
  const [fx, fy] = trotFrom(r, world, seat);
  const off = left > 0 ? [(fx - seat[0]) * left, (fy - seat[1]) * left] : [0, 0];
  const spot = ([x, y]: Point): Spot => ({ x: x + off[0]!, y: y + off[1]!, z: h(x, y), dir });
  return [spot(seat), spot(pull)] as const;
}

/** Der Schuppen in der Mitte seiner Felder, die Tür zum Halt */
function shed(r: Route, h: (x: number, y: number) => number, lit: boolean): RideBody {
  const [hx, hy] = r.stops.home;
  const [bx, by] = r.path[1]!;
  const n = r.shed.length;
  return {
    id: `${SLED_ID}:schuppen`,
    key: `${SLED_ID}:schuppen${lit ? ':licht' : ''}`,
    x: r.shed.reduce((s, p) => s + p[0], 0) / n,
    y: r.shed.reduce((s, p) => s + p[1], 0) / n,
    z: h(hx, hy),
    dir: dirTo(bx - hx, by - hy),
    parts: model(`schuppen${lit}`, () => shedParts(lit)),
  };
}

/**
 * Körper des Schlittens je Bild: Schuppen (sobald er da ist), Schlitten und Zugtier am Halt der Gegend der Figur oder
 * unterwegs; leer, solange er noch nicht erschienen ist oder die Welt keine Strecke hat
 */
export function sledBodies(state: State, world: World, at: RideAt): readonly RideBody[] {
  const r = sledRoute(world);
  const stage = r && stageOf(state.packs, SLED.id);
  if (!r || !stage) return [];
  const h = heightAt(state, world);
  const out = [shed(r, h, at.lit)];
  const pair = state.ride ? riding(r, state.ride, at, h) : standing(r, state, world, at, h);
  if (!pair) return out;
  const g = world.gates.get(SLED.gate);
  const [seat, pull] = pair.map((s) => narrow(s, g)) as [Spot, Spot];
  const since = state.tick - state.rideDue; // `rideDue`: Takt des Herbeitrabens bzw. des letzten Anstoßens
  const open = !state.ride && state.rideDue >= 0 && since >= 0 && since < OPEN_TICKS;
  // schläft er (die Fahr-Engine fehlt noch, Vorladen), kein goldener Rahmen: Einsteigen geht dann nicht
  const dozing = !!state.dozing?.includes(SLED.id);
  const look = {
    frame: stage === 'bereit' && !dozing,
    pennant: stage === 'fest',
    lamp: at.lit,
    seated: !!state.ride,
    open,
  };
  const key = `${SLED_ID}:${+look.frame}${+look.pennant}${+look.lamp}${+look.seated}${+look.open}`;
  out.push(
    { id: SLED_ID, key, ...seat, parts: model(key, () => sledParts(look)), ...(state.ride && { seat: true as const }) },
    { id: `${SLED_ID}:rentier`, key: `${SLED_ID}:rentier`, ...pull, parts: REINDEER },
  );
  return out;
}

/** Kufenspur auf einem Feld der Strecke, längs ihrer Richtung (an einer Kurve in beide) */
function runners(path: readonly Point[], i: number, h: number, [side, top]: readonly [string, string]): Box[] {
  const [x, y] = path[i]!;
  const near = [path[i - 1], path[i + 1]].filter((q) => q !== undefined);
  const out: Box[] = [];
  if (near.some((q) => q[1] === y))
    out.push([x, y + 0.26, h, 1, 0.12, 0.014, side, top], [x, y + 0.62, h, 1, 0.12, 0.014, side, top]);
  if (near.some((q) => q[0] === x))
    out.push([x + 0.26, y, h, 0.12, 1, 0.014, side, top], [x + 0.62, y, h, 0.12, 1, 0.014, side, top]);
  return out;
}

const marked = new WeakMap<World, { key: string; boxes: readonly Box[] }>();

/**
 * Flache Marken am Boden: die Schneespur im Kessel und im Gang, sobald der Schlitten erschienen ist; durch Tür und
 * Bucht über die Lichtung erst ab der ersten Heimfahrt (während der Festfahrt wächst sie bis zum Schlitten), dazu dann
 * der Schneefleck am Halt auf der Lichtung. Je Welt und Stand einmal berechnet
 */
export function sledMarks(state: State, world: World): readonly Box[] {
  const r = sledRoute(world);
  const stage = r && stageOf(state.packs, SLED.id);
  if (!r || !stage) return NONE;
  const reach = state.ride?.feast ? Math.floor(state.ride.pos) : stage === 'fest' ? r.path.length : -1;
  const key = `${stage}:${reach}`;
  const last = marked.get(world);
  if (last?.key === key) return last.boxes;
  const boxes: Box[] = [];
  if (stage === 'fest') {
    const [sx, sy] = r.stops.out;
    for (let y = sy - 1; y <= sy + 1; y++)
      for (let x = sx - 1; x <= sx + 1; x++) {
        const c = world.cell(x, y);
        if (!c.solid && c.ground !== 'water') boxes.push([x + 0.04, y + 0.04, c.h, 0.92, 0.92, 0.008, ...PATCH]);
      }
  }
  r.path.forEach((p, i) => {
    const c = world.cell(...p);
    if (c.ride || i <= reach) boxes.push(...runners(r.path, i, c.h, c.ground === 'snow' ? TRACK_SNOW : TRACK_GRASS));
  });
  marked.set(world, { key, boxes });
  return boxes;
}

const [HI, LO] = SLED.signal as readonly [number, number]; // D6, A5
const C_RUN = [1046.5, 1174.66, 1318.51, 1567.98]; // C6 D6 E6 G6: Abfahrt
const FEAST = [...C_RUN, 1760, 2093]; // … A6 C7: Fest

/** Schellen: `n` Schläge D6/A5 im Wechsel, schnell (60 ms), über Verzögerungen (höchstens ein Ton sofort) */
export const jingle = (n = 6, gain = 0.05, at = 0): Scored[] =>
  Array.from({ length: n }, (_, i): Scored => [i % 2 ? LO : HI, 0.07, 'sine', gain, 1, at + i * 0.06]);
/** Zweimal weiches Tuten (A5) */
const toot = (at = 0): Scored[] => [
  [LO, 0.16, 'triangle', 0.07, 0.98, at],
  [LO, 0.22, 'triangle', 0.07, 0.98, at + 0.26],
];
/** Kurzes, tiefes Schnauben des Rentiers */
const snort = (at = 0): Scored[] => [
  [110, 0.14, 'sawtooth', 0.03, 0.6, at],
  [98, 0.18, 'triangle', 0.07, 0.7, at + 0.05],
];
const run = (notes: readonly number[], len: number): Scored[] =>
  notes.map((f, i): Scored => [f, i === notes.length - 1 ? len * 2 : len, 'triangle', 0.06, 1, i * 0.1]);

/** Töne zu einem Ereignis des Schlittens */
export function rideScores(e: RideEvent): Scored[] {
  switch (e.what) {
    case 'appear': // von fern aus den Tannen
      return jingle(6, 0.02);
    case 'come':
      return [...jingle(), ...snort(0.45)];
    case 'snort':
      return snort();
    case 'nudge': // die Tür geht einladend auf, er tutet
    case 'stop': // vor einem Tier: freundlich
      return toot();
    case 'board': // Abfahrtston
      return run(C_RUN, 0.12);
    case 'leave':
      return [[784, 0.1, 'sine', 0.05, 0.8, 0]];
    case 'go':
    case 'arrive':
      return jingle();
    case 'wave': // gedrosselt bimmeln, sonst ein leiser Ton: Jeder Druck hört etwas (auch ohne Hüpfer)
      return e.ring ? jingle(4) : [[HI, 0.08, 'sine', 0.03, 1, 0]];
    case 'alight':
      return run([1567.98, 2093], 0.12);
    case 'feast':
      return run(FEAST, 0.14);
    default: // Tier hüpft beiseite, winkt am Weg, der Pinguin winkt: das zeigt das Bild
      return [];
  }
}

/**
 * Was die Ansicht zu einem Ereignis zeigt: Töne, wer hüpft und ein Herz bekommt (die Figur beim Herbeitraben, Schnauben,
 * Aussteigen und Fest; das Tier, das beiseite hüpft oder winkt; der Pinguin beim Abschied), Schneeflocken beim Fest
 * und an winkenden Schneemännern
 */
export function rideFx(e: RideEvent, state: State): RideFx {
  const score = rideScores(e);
  switch (e.what) {
    case 'come':
    case 'snort':
    case 'alight':
      return { score, who: 'player', heart: true };
    case 'feast':
      return { score, who: 'player', heart: true, burst: FLAKES };
    case 'wave':
      return { score, who: 'player' };
    case 'shoo':
      return { score, who: e.who };
    case 'cheer':
      return e.who?.startsWith('schneemann:') ? { score, burst: FLAKES } : { score, who: e.who, heart: true };
    case 'farewell':
      return { score, who: state.animals.find((a) => a.species === 'pinguin')?.id, heart: true };
    default:
      return { score };
  }
}
