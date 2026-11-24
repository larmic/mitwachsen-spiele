// Das Gleis des Zugs der Höhlenbahn in Reihe – rein, ohne DOM: der Zug in `RIDES`, wie viele Felder er am Halt belegt
// (`CARS`), wo die Figur sitzt (`SEAT`), der Prellbock an Bahnhof Bär (`bearEnd`) und die Felder der Linie von dort bis
// an den Prellbock in der Bucht oder bis hinter Bahnhof Fledermaus (`lineOf`). Eigene Datei, weil Zug
// (mitwachsen-train.ts) und Bau 2 (mitwachsen-build2.ts) beide sie brauchen und einander nicht im Kreis importieren.
// Teil des Pakets der Bahn.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Fahren)

import type { Point } from '../../../../data/games/mitwachsen';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import type { World } from '../../mitwachsen-world';
import { LETTERS, STEPS } from './mitwachsen-trace';

/** Der Zug in `RIDES` */
export const TRAIN = RIDES.find((r) => r.id === 'hoehle')!;
/** So viele Felder des Gleises belegt der haltende Zug (Lok und zwei Wagen, gut 5 Felder lang) */
export const CARS = 6;
/** Feld des Sitzes (Mitte des mittleren Wagens), vom Ende des Gleises an gezählt */
export const SEAT = 3;
/** So weit ums Bett der Lichtung wird nach dem Prellbock von Bahnhof Bär gesucht (er liegt 13 bis 16 Felder weg) */
const SEARCH = 24;

/** Der Prellbock am Anfang der Linie auf der Lichtung (Bahnhof Bär), gesucht ums Bett */
export function bearEnd(world: World): Point | undefined {
  const [bx, by] = world.homes.lichtung.bed;
  for (let y = by - SEARCH; y <= by + SEARCH; y++)
    for (let x = bx - SEARCH; x <= bx + SEARCH; x++) {
      const c = world.cell(x, y);
      if (c.rail?.part === 'end' && c.rail.stage === 1 && c.region === 'lichtung') return [x, y];
    }
  return undefined;
}

const lines = new WeakMap<World, Map<boolean, Point[]>>();
/**
 * Das Gleis, auf dem der Zug fährt, in Reihe von Bahnhof Bär an (je Welt einmal): bis an den Prellbock in der Bucht
 * (`far` false; ohne Grotte endet das Gleis dort ohnehin), sonst bis an das Ende hinter Bahnhof Fledermaus; leer ohne Gleis
 */
export function lineOf(world: World, far: boolean): Point[] {
  let byFar = lines.get(world);
  if (!byFar) lines.set(world, (byFar = new Map<boolean, Point[]>()));
  const known = byFar.get(far);
  if (known) return known;
  const line: Point[] = [];
  for (let p = bearEnd(world); p && line.length < 600;) {
    line.push(p);
    const r = world.cell(...p).rail;
    if (!r || (line.length > 1 && (r.part === 'end' || (r.part === 'buffer' && !far)))) break;
    const on = line.length === 1 ? r.to[0] : r.to[1];
    if (!on) break;
    const [dx, dy] = STEPS[LETTERS.indexOf(on)]!;
    p = [p[0] + dx, p[1] + dy];
  }
  byFar.set(far, line);
  return line;
}
