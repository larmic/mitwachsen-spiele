// Rand der Lichtung: Kante statt Treppe (Issue 36, Review vom 25.11.2026, Punkt 3) – rein und deterministisch, im Bau
// der Welt ganz zuletzt, nachdem unerreichbare Flecken zu Fels wurden. Ein Kind lernt im Spiel „eine Stufe geht immer“
// und „flach oben heißt, da kann man stehen“; der Felsring war oft nur eine Stufe hoch, im Stein der Klettersteine.
// Darum die Regel für jeden Weltrand: Das innerste Randfeld ist mindestens zwei Stufen höher als jeder begehbare
// Nachbar und hat ein Bild, das es auf begehbarem Boden nicht gibt. Auf der Lichtung ist die innerste Reihe eine dichte
// Hecke (`Cell.rim`, genau zwei Stufen über dem höchsten Nachbarn), der Fels dahinter ragt mindestens eine Stufe
// darüber. Unerreichbare Flecken mitten in der Lichtung folgen derselben Regel. Ausgenommen: die Buchten vor den Toren
// (dort stehen Torhaus und Türme, die flachen Reihen dahinter müssen flach bleiben) und alles am Gleis der Bahn
// (Tunnelportal). Begehbar ändert sich nichts: Der Rand war und bleibt fest.
// Bild: mitwachsen-3d.ts, mitwachsen-render.ts, Karte. Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt“)

import type { Point } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';

/** So viel höher als jeder begehbare Nachbar ist das innerste Randfeld mindestens */
export const RIM_UP = 2;
/** So weit um eine Tormitte (quer und zur Lichtung hin) bleibt der Rand, wie er war; so weit um ein Gleisfeld ebenso */
export const GATE_KEEP = { across: 8, inward: 10 } as const;
export const RAIL_KEEP = 2;

const key = (x: number, y: number) => `${x},${y}`;
const N8 = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const)).filter(([dx, dy]) => dx || dy);

/** Fels des Rings der Lichtung oder eines unerreichbaren Flecks (nicht die flachen Reihen am Torhaus, keine Welt dahinter) */
export const isRing = (c: Cell | undefined): boolean =>
  !!c && c.deco === 'rock' && c.region === 'border' && c.ground === 'stone' && !c.biome && (c.h >= 3 || !!c.rim);
/** Feld der Lichtung, auf oder an dem man steht: Boden und Wasser, nichts Festes am Rand */
const open = (c: Cell | undefined): c is Cell => !!c && c.region === 'lichtung' && c.deco !== 'rock';

/**
 * Den Rand der Lichtung schärfen (`map` wird geändert): Jedes Ringfeld mit einem offenen Nachbarn (auch schräg) wird
 * Hecke (`rim`), genau `RIM_UP` über dem höchsten offenen Nachbarn; die Felder dahinter (bis zwei Reihen) ragen
 * mindestens eine Stufe über die Hecke. `gates`: Mitte und Richtung nach außen je Tor. Liefert die Felder der Hecke
 */
export function sharpenRim(map: Map<string, Cell>, gates: readonly { mid: Point; out: Point }[]): Point[] {
  const kept = (x: number, y: number) =>
    gates.some(({ mid, out }) => {
      const [dx, dy] = [x - mid[0], y - mid[1]];
      const [t, u] = [dx * out[0] + dy * out[1], dx * out[1] - dy * out[0]];
      return Math.abs(u) <= GATE_KEEP.across && t >= -GATE_KEEP.inward;
    }) || near(map, x, y, RAIL_KEEP, (c) => !!c.ride || !!c.rail);
  const rim: Point[] = [];
  for (const [k, c] of map) {
    if (!isRing(c)) continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    const beside = N8.map(([dx, dy]) => map.get(key(x + dx, y + dy))).filter(open);
    if (!beside.length || kept(x, y)) continue;
    rim.push([x, y]);
    map.set(k, { ...c, h: Math.max(...beside.map((n) => n.h)) + RIM_UP, rim: true });
  }
  // dahinter: Fels, der über die Hecke ragt (zwei Reihen, jede mindestens so hoch wie die davor)
  let front = rim;
  for (let row = 0; row < 2; row++) {
    const next = new Map<string, number>();
    for (const [x, y] of front) {
      const h = map.get(key(x, y))!.h + (row ? 0 : 1);
      for (const [dx, dy] of N8) {
        const k = key(x + dx, y + dy);
        const n = map.get(k);
        if (n && isRing(n) && !n.rim && !kept(x + dx, y + dy)) next.set(k, Math.max(next.get(k) ?? n.h, h));
      }
    }
    for (const [k, h] of next) map.set(k, { ...map.get(k)!, h });
    front = [...next.keys()].map((k) => k.split(',').map(Number) as [number, number]);
  }
  return rim;
}

function near(map: ReadonlyMap<string, Cell>, x: number, y: number, r: number, is: (c: Cell) => boolean) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const c = map.get(key(x + dx, y + dy));
      if (c && is(c)) return true;
    }
  return false;
}
