// Glitzergang der Grubenbahn (Rückmeldung zur Höhle, Punkt 7 und Schritt 16) – rein und deterministisch, aus den Feldern
// der Welt und der Runde von Funkel: wo auf der Runde die beiden Klingeltore stehen (`Cell.chimeGate`, die Enden des Gangs,
// die `layGrube` legt), die Mitte des Gangs mit dem kleinen Wasserfall an der Wand (ein Körper, kein Wasser auf dem Feld:
// das Gleis bleibt Gleis), die Kristalle in der Wand (je drei Felder einer, nicht an den Toren und am Wasserfall), welche
// davon in der Glitzerwelle leuchten (nah am Sitz, solange Funkel im Gang ist) und die festen Bilder bei reduzierter
// Bewegung (Halt, Klingeltor ein, Mitte mit Wasserfall, Klingeltor aus, Halt; dazwischen kein Gleiten).
// Spezifikation: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“, Klingeltore und Glitzergang)

import { DIRS } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import type { RideRoute } from '../../mitwachsen-rider';
import type { World } from '../../mitwachsen-world';

/** Je so viele Felder des Gangs ein Kristall in der Wand */
export const CRYSTAL_EVERY = 3;
/** So viele Felder vor und hinter dem Sitz leuchten die Kristalle in der Glitzerwelle */
export const GLOW_REACH = 3;
/** So nah (Felder vor und hinter dem Sitz) ist Funkel am Tor, solange es hindurchfährt: Die Scheibe hebt sich */
export const PASS_REACH = 2;

/**
 * Der Glitzergang auf der Runde (Indizes in `RideRoute.path`, vom Sitz am Halt an): Klingeltor am Eingang und am Ausgang,
 * die Mitte, das Feld des Wasserfalls an der Wand neben der Mitte, die Kristalle in der Wand mit dem Index, neben dem sie
 * stehen, und die festen Bilder bei reduzierter Bewegung (Halt, Tor ein, Mitte, Tor aus)
 */
export type Gang = {
  gates: { in: number; out: number };
  mid: number;
  fall?: Point;
  crystals: readonly { at: Point; i: number }[];
  frames: readonly number[];
};

const key = ([x, y]: readonly [number, number]) => `${x},${y}`;

/**
 * Das Nachbarfeld von `p` an der Wand: nicht auf der Runde, ein Nachbar des Gangs (`Lane.part` `side`, gegraben) und
 * zwei Felder weiter kein Zaunkristall (dort liegt die Höhle); undefined, wenn es keins gibt (an einer Ecke)
 */
function wallOf(world: World, on: ReadonlySet<string>, [x, y]: Point): Point | undefined {
  for (const [dx, dy] of Object.values(DIRS)) {
    const q: Point = [x + dx, y + dy];
    const c = world.cell(...q);
    if (on.has(key(q)) || c.lane?.part !== 'side' || c.solid) continue;
    if (world.cell(x + 2 * dx, y + 2 * dy).lane?.part === 'fence') continue;
    return q;
  }
  return undefined;
}

const gangs = new WeakMap<RideRoute, Gang | null>();

/** Der Glitzergang auf der Runde `r` (undefined ohne Klingeltore, etwa vor dem Graben); je Runde einmal */
export function gangOf(world: World, r: RideRoute): Gang | undefined {
  if (!gangs.has(r)) gangs.set(r, build(world, r));
  return gangs.get(r) ?? undefined;
}

function build(world: World, r: RideRoute): Gang | null {
  const len = r.path.length - 1;
  const at = (gate: 'in' | 'out') => r.path.slice(0, len).findIndex((p) => world.cell(...p).chimeGate === gate);
  const [i, o] = [at('in'), at('out')];
  if (i < 0 || o <= i) return null;
  const mid = Math.round((i + o) / 2);
  const fall = wallOf(world, r.on, r.path[mid]!);
  const crystals: { at: Point; i: number }[] = [];
  const used = new Set(fall ? [key(fall)] : []);
  for (let k = i + CRYSTAL_EVERY; k <= o - CRYSTAL_EVERY; k += CRYSTAL_EVERY) {
    if (Math.abs(k - mid) <= 2) continue; // dort steht der Wasserfall
    const q = wallOf(world, r.on, r.path[k]!);
    if (q && !used.has(key(q))) {
      used.add(key(q));
      crystals.push({ at: q, i: k });
    }
  }
  return { gates: { in: i, out: o }, mid, ...(fall && { fall }), crystals, frames: [0, i, mid, o] };
}

/** Ist der Sitz bei Fortschritt `p` im Gang (zwischen den Toren, beide mitgezählt)? */
export const inGang = (g: Gang, p: number) => p >= g.gates.in && p <= g.gates.out;

/** Fährt Funkel bei Fortschritt `p` gerade durch das Tor am Index `gate` (Lok, Sitz oder hinterer Wagen darin)? */
export const passing = (gate: number, p: number) => Math.abs(p - gate) <= PASS_REACH;

/** Kristalle der Glitzerwelle bei Fortschritt `p`: nah am Sitz, solange er im Gang ist (ihre Indizes `i`) */
export const glitter = (g: Gang, p: number): ReadonlySet<number> =>
  new Set(inGang(g, p) ? g.crystals.filter((c) => Math.abs(c.i - p) <= GLOW_REACH).map((c) => c.i) : []);

/**
 * Bei reduzierter Bewegung: das feste Bild zum Fortschritt `p` einer Runde der Länge `len` (das letzte erreichte von
 * Halt, Tor ein, Mitte, Tor aus; am Ende wieder der Halt); ohne Gang steht es am Halt, bis die Runde um ist
 */
export function frameOf(g: Gang | undefined, p: number, len: number): number {
  if (p >= len) return len;
  const frames = g?.frames ?? [0];
  return frames.reduce((a, f) => (f <= p ? f : a), 0);
}
