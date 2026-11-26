// Die Runde der Schneeraupe im Gletschertal (Issue 54) – rein und deterministisch: eine geschlossene Strecke nördlich
// vom Schneebett, einmal um das Tal. Sie wird je Tal gesucht, nach allem Gewürfelten und nach dem Rodelberg
// (mitwachsen-kessel.ts): von Punkt zu Punkt einer Ellipse der günstigste Weg über erlaubte Felder. Es weichen nur
// Tannen, Eisblöcke und Schneewehen; umfahren werden Seen, Eisberg, Rodelberg, Rutschspur, Wiese, Plattformen, die
// Strecke des Schlittens und alles, was nie weicht (Schneehaufen, Kristalle, Fischkisten, Eiszapfen, samt einem Feld
// Abstand). Die Runde berührt sich nirgends selbst: Jedes ihrer Felder grenzt an genau zwei andere. Gelingt das in einem
// Tal nicht, gibt es dort keine Runde und keine Schneeraupe. Ihr Halt (das erste Feld, dem Bett am nächsten) trägt
// `Cell.stop` `'raupe'`, alle Felder `Cell.ride` `'raupe'`: Daraus findet das Fahrzeug die Runde wieder (`loopOf`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Schneeraupe“)

import type { Point } from '../../../../data/games/mitwachsen';
import { CAT_LOOP } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell } from '../../mitwachsen-cell';
import type { World } from '../../mitwachsen-world';
import { key } from './mitwachsen-flood';
import { blocked, cheapest, cleared } from './mitwachsen-sled-ground';

/** Kennung der Schneeraupe (`RIDES`) */
export const CAT = 'raupe';
const SIDES = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

/** Was nie weicht: Die Runde hält ein Feld Abstand */
const kept = (c: Cell | undefined) =>
  !!c && (c.deco === 'snowheap' || c.deco === 'crystal' || c.deco === 'fishcrate' || c.deco === 'icicle');
/** Darf die Runde über dieses Feld? Schnee des Tals, höchstens mit Tanne, Eisblock oder Schneewehe */
const free = (c: Cell | undefined) =>
  !!c &&
  c.region === 'eis' &&
  !c.slide &&
  !c.garden &&
  !c.portal &&
  !c.ride &&
  !c.stop &&
  (blocked(c) || (c.ground === 'snow' && !c.solid && (!c.deco || c.deco === 'snowdrift')));

/**
 * Die Punkte der Ellipse (`CAT_LOOP`) als Felder der Welt; `at`: Feld für eine Lage (quer, längs) von der Mitte des Tals.
 * Der erste Punkt liegt dem Schneebett am nächsten
 */
export function ringOf(at: (u: number, v: number) => Point): Point[] {
  const { out, across, along, points } = CAT_LOOP;
  return Array.from({ length: points }, (_, i) => {
    const a = -Math.PI / 2 + (i / points) * 2 * Math.PI;
    return at(Math.round(across * Math.cos(a)), out + Math.round(along * Math.sin(a)));
  });
}

/** Schließt sich `path` zu einer Runde, die sich nirgends berührt? Jedes Feld grenzt an genau seinen Vorgänger und Nachfolger */
export function simple(path: readonly Point[]): boolean {
  const on = new Set(path.map((p) => key(...p)));
  if (on.size !== path.length || path.length < 8) return false;
  return path.every(([x, y], i) => {
    const next = path[(i + 1) % path.length]!;
    const touch = SIDES.filter(([dx, dy]) => on.has(key(x + dx, y + dy))).length;
    return touch === 2 && Math.abs(next[0] - x) + Math.abs(next[1] - y) === 1;
  });
}

/**
 * Die Runde in die Karte bauen (`map`): durch die Punkte `ring` der Reihe nach (der erste ist der Halt), nur über
 * Felder aus `wild` (wo das Tal nichts frei hält), nie über `shut` (Rodelberg, Strecke und Platz des Schlittens).
 * Liefert die Felder der Runde als "x,y" (dort wohnt kein Tier); leer, wenn keine Runde Platz findet (dann bleibt
 * alles, wie es war)
 */
export function buildLoop(
  ring: readonly Point[],
  wild: readonly { x: number; y: number }[],
  map: Map<string, Cell>,
  shut: ReadonlySet<string>,
): ReadonlySet<string> {
  const open = new Set(wild.map(({ x, y }) => key(x, y)));
  const ok = (x: number, y: number) => {
    const k = key(x, y);
    if (!open.has(k) || shut.has(k) || !free(map.get(k))) return false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (kept(map.get(key(x + dx, y + dy)))) return false;
    return true;
  };
  /** Erlaubt samt allen Feldern bis `CAT_LOOP.room` ringsum: Dort gerät die Runde in keine Sackgasse (etwa am Ufer eines Sees) */
  const roomy = (x: number, y: number) => {
    const r = CAT_LOOP.room;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!ok(x + dx, y + dy)) return false;
    return true;
  };
  // jeder Punkt der Ellipse auf das nächste erlaubte Feld mit Platz ringsum
  const nearest = ([rx, ry]: Point): Point | undefined => {
    let best: { p: Point; d: number } | undefined;
    for (let dy = -CAT_LOOP.reach; dy <= CAT_LOOP.reach; dy++)
      for (let dx = -CAT_LOOP.reach; dx <= CAT_LOOP.reach; dx++) {
        const d = Math.hypot(dx, dy);
        if ((!best || d < best.d) && roomy(rx + dx, ry + dy)) best = { p: [rx + dx, ry + dy], d };
      }
    return best?.p;
  };
  const roomyNear = (p: Point) => !!nearest(p);
  const stops = ring.map(nearest).filter((p): p is Point => !!p); // ohne Platz (etwa mitten im See) fällt ein Punkt weg
  if (stops.length < CAT_LOOP.points - 3 || !ring[0] || !roomyNear(ring[0])) return new Set(); // zu wenig Platz, oder keiner am Halt
  const height = (x: number, y: number) => cleared(map.get(key(x, y))!).h;
  // von Punkt zu Punkt; ein Feld neben schon gelegter Runde ist für die nächsten Stücke gesperrt (sie berührt sich nie):
  // Nur neben dem Feld, von dem das Stück ausgeht, und zuletzt neben dem Halt darf es liegen
  const on = new Set<string>();
  const path: Point[] = [];
  const same = ([ax, ay]: Point, x: number, y: number) => ax === x && ay === y;
  for (let i = 0; i < stops.length; i++) {
    const [from, to] = [stops[i]!, stops[(i + 1) % stops.length]!];
    const closing = i === stops.length - 1;
    const meets = (x: number, y: number) => same(from, x, y) || (closing && same(to, x, y));
    const no = (x: number, y: number) => {
      if (closing && same(to, x, y)) return false; // der Halt selbst: Hier schließt sich die Runde
      return (
        !ok(x, y) ||
        on.has(key(x, y)) ||
        SIDES.some(([dx, dy]) => on.has(key(x + dx, y + dy)) && !meets(x + dx, y + dy))
      );
    };
    const piece = cheapest(from, to, no, map, height);
    if (!piece) return new Set();
    for (const p of piece.slice(0, -1)) {
      path.push(p);
      on.add(key(...p));
    }
  }
  if (!simple(path)) return new Set();
  for (const [x, y] of path) {
    const was = map.get(key(x, y))!;
    // weicht eine Tanne, weichen auch ihre Schneewehen im Lee (rechts daneben)
    if (was.tree === 'snowpine')
      for (const lee of [1, 2]) {
        const n = map.get(key(x + lee, y));
        if (n?.deco === 'snowdrift') map.set(key(x + lee, y), { ...n, deco: null });
      }
    map.set(key(x, y), { ...cleared(was), deco: null, solid: false, tree: undefined, ride: CAT });
  }
  const [hx, hy] = path[0]!;
  map.set(key(hx, hy), { ...map.get(key(hx, hy))!, stop: CAT });
  return new Set(path.map((p) => key(...p)));
}

const loops = new WeakMap<World, readonly Point[]>();
/**
 * Die Runde einer Welt in Reihe, vom Halt (`Cell.stop`) an im Uhrzeigersinn des Bilds, je Welt einmal gesucht; leer
 * ohne Eis-Welt oder ohne Runde
 */
export function loopOf(world: World): readonly Point[] {
  let found = loops.get(world);
  if (!found) loops.set(world, (found = trace(world)));
  return found;
}

function trace(world: World): Point[] {
  if (!world.spotsOf('eis').length) return [];
  const [bx, by] = world.homes.eis.bed;
  const r = CAT_LOOP.along;
  let start: Point | undefined;
  for (let y = by - r; y <= by + r && !start; y++)
    for (let x = bx - r; x <= bx + r && !start; x++) if (world.cell(x, y).stop === CAT) start = [x, y];
  if (!start) return [];
  const path: Point[] = [start];
  const seen = new Set([key(...start)]);
  for (let p: Point | undefined = start; p && path.length < 2000;) {
    const [x, y]: Point = p;
    p = SIDES.map(([dx, dy]): Point => [x + dx, y + dy]).find(
      (q) => world.cell(...q).ride === CAT && !seen.has(key(...q)),
    );
    if (p) {
      path.push(p);
      seen.add(key(...p));
    }
  }
  // im Bild im Uhrzeigersinn (y wächst nach unten: die Fläche nach der Schuhband-Formel ist dann positiv)
  let area = 0;
  path.forEach(([x, y], i) => {
    const [nx, ny] = path[(i + 1) % path.length]!;
    area += x * ny - nx * y;
  });
  return area >= 0 ? path : [start, ...path.slice(1).reverse()];
}
