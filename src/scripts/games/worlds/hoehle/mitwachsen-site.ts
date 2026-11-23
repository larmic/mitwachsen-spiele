// Wo die Kristallgrotte liegt – rein und deterministisch, hängt nur vom Gang hinter dem Höhlentor und vom freien Platz
// (`beyond`: hinter dem Felsring, fern der anderen Gänge, außerhalb der Hülle der Eis-Welt) ab, nicht vom Seed.
// Am liebsten gerade hinter dem Gang wie der Gletscherkessel. Liegt dort die Eis-Welt im Weg (ihr Tor steht gleich
// daneben und zeigt in dieselbe Richtung), führt die Verlängerung des Gangs um eine Ecke: erst ein Stück geradeaus,
// dann quer, von der Eis-Welt weg; die Grotte liegt dann mit ihrer Länge in dieser Richtung. Gewählt wird die kürzeste
// Verlängerung, eine Ecke kostet so viel wie `TURN_COST` Felder geradeaus. Die Grotte liegt so herum (wenn nötig
// gespiegelt, quer zum Gang), dass die Spur des Gleises (u −2 der Bucht vor dem Tor, mitwachsen-bay.ts) in der Grotte auf
// der Seite des Bahnhofs ankommt (u +2, `GROTTE.station`): So kreuzt das Gleis nie den Weg durch die Mitte.
// Teil des Welt-Pakets der Höhlenwelt (index.ts), nachgeladen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import type { Point } from '../../../../data/games/mitwachsen';
import type { Beyond, Gang } from '../../mitwachsen-pack-types';

/**
 * Lage der Grotte: ihr Raster (`at`: Feld für die Lage u quer, v vorwärts von ihrer Mitte aus; `uv` umgekehrt), die
 * Felder der Verlängerung des Gangs vom Ende des Felsrings bis an ihre Klippen (`floor` Boden, `walls` Fels daneben)
 * und ob sie um eine Ecke führt (`turn`, für Tests)
 */
export type Site = {
  at(u: number, v: number): Point;
  uv(x: number, y: number): Point;
  floor: readonly Point[];
  walls: readonly Point[];
  turn: boolean;
};

/** So viele Felder geradeaus kostet eine Ecke: Lieber etwas länger geradeaus als um die Ecke */
export const TURN_COST = 8;
/** Länger wird die Verlängerung nie gesucht; dann liegt die Grotte gerade hinter dem Gang, so weit es eben braucht */
const MAX_COST = 240;

type V = readonly [number, number];
const add = (p: V, d: V, k: number): Point => [p[0] + d[0] * k, p[1] + d[1] * k];

/** Raster mit Mitte `c`, quer `a` und vorwärts `f` (Einheitsvektoren der Achsen) */
function frame(c: V, a: V, f: V): Pick<Site, 'at' | 'uv'> {
  return {
    at: (u, v) => [c[0] + a[0] * u + f[0] * v, c[1] + a[1] * u + f[1] * v],
    uv: (x, y) => [(x - c[0]) * a[0] + (y - c[1]) * a[1], (x - c[0]) * f[0] + (y - c[1]) * f[1]],
  };
}

/** Liegt die ganze Ellipse mit den Halbachsen A (quer) und B (vorwärts) um die Mitte des Rasters in `beyond`? (am Rand geprüft) */
function hullFree(at: Site['at'], A: number, B: number, beyond: Beyond): boolean {
  for (let u = -A; u <= A; u++) {
    const h = Math.ceil(B * Math.sqrt(1 - (u / A) ** 2));
    if (!beyond(...at(u, -h)) || !beyond(...at(u, h))) return false;
  }
  for (let v = -B; v <= B; v++) {
    const h = Math.ceil(A * Math.sqrt(1 - (v / B) ** 2));
    if (!beyond(...at(-h, v)) || !beyond(...at(h, v))) return false;
  }
  return true;
}

/** Wände um den Boden: alle Felder bis `wall` weit (auch schräg), die nicht Boden sind */
function wallsOf(floor: readonly Point[], wall: number): Point[] {
  const keys = new Set(floor.map(([x, y]) => `${x},${y}`));
  const out = new Map<string, Point>();
  for (const [x, y] of floor)
    for (let dy = -wall; dy <= wall; dy++)
      for (let dx = -wall; dx <= wall; dx++) {
        const k = `${x + dx},${y + dy}`;
        if (!keys.has(k)) out.set(k, [x + dx, y + dy]);
      }
  return [...out.values()];
}

/**
 * Wo die Grotte mit den Halbachsen `rx` × `ry` samt Klippen (und `gap` Feldern Abstand ringsum) liegt: die Lage mit der
 * kürzesten Verlängerung des Gangs, deren Hülle und Verlängerung (samt Wänden) ganz in `beyond` liegen. Gerade: die
 * Mitte `ry + C` Felder hinter dem Ende des Gangs. Um die Ecke: `k` Felder geradeaus, dann quer zur Seite `side`,
 * `m` Felder bis an die Klippen; Kosten `k + m + TURN_COST`.
 */
export function siteOf(gang: Gang, beyond: Beyond, room: { rx: number; ry: number; gap: number }): Site {
  const site = unmirrored(gang, beyond, room);
  // Spur des Gleises in der Bucht: u −2 dort, wo u nach [−out.y, out.x] wächst (mitwachsen-bay.ts). Gerade wie um die
  // Ecke kommt die Spur u des Gangs (`gang.at`) in der Grotte bei demselben u an; liegt sie bei u −2, wird gespiegelt
  const o = gang.at(0, 0);
  const across = [gang.at(1, 0)[0] - o[0], gang.at(1, 0)[1] - o[1]] as const;
  const out = [gang.at(0, 1)[0] - o[0], gang.at(0, 1)[1] - o[1]] as const;
  if (across[0] * out[1] - across[1] * out[0] > 0) return site; // die Spur liegt bei u +2 des Gangs
  return { ...site, at: (u, v) => site.at(-u, v), uv: (x, y) => [-site.uv(x, y)[0], site.uv(x, y)[1]] };
}

function unmirrored(gang: Gang, beyond: Beyond, { rx, ry, gap }: { rx: number; ry: number; gap: number }): Site {
  const [A, B] = [rx + gap, ry + gap];
  const { half: h, wall, end } = gang;
  const o = gang.at(0, 0);
  const across: V = [gang.at(1, 0)[0] - o[0], gang.at(1, 0)[1] - o[1]];
  const out: V = [gang.at(0, 1)[0] - o[0], gang.at(0, 1)[1] - o[1]];
  const free = (cells: readonly Point[]) => cells.every(([x, y]) => beyond(x, y));
  const straight = (c: number): Site | null => {
    const f = frame(gang.at(0, end + ry + c), across, out);
    if (!hullFree(f.at, A, B, beyond)) return null;
    const floor: Point[] = [];
    for (let t = end + 1; t <= end + c; t++) for (let u = -h; u <= h; u++) floor.push(gang.at(u, t));
    const walls = wallsOf(floor, wall).filter(([x, y]) => {
      const t = (x - o[0]) * out[0] + (y - o[1]) * out[1];
      return t > end; // die Wände des Gangs im Felsring stehen schon
    });
    return free(floor) && free(walls) ? { ...f, floor, walls, turn: false } : null;
  };
  const bent = (k: number, m: number, side: 1 | -1): Site | null => {
    const t1 = end + 1 + h + k; // Reihe der Ecke
    const turn = gang.at(0, t1);
    const f: V = [across[0] * side, across[1] * side];
    const a: V = [-out[0] * side, -out[1] * side]; // gedreht wie das Raster des Gangs
    const site = frame(add(turn, f, h + 1 + m + ry), a, f);
    if (!hullFree(site.at, A, B, beyond)) return null;
    const floor: Point[] = [];
    for (let t = end + 1; t <= t1 + h; t++) for (let u = -h; u <= h; u++) floor.push(gang.at(u, t));
    for (let s = h + 1; s <= h + 1 + m; s++) for (let w = -h; w <= h; w++) floor.push(add(add(turn, f, s), out, w));
    const walls = wallsOf(floor, wall).filter(([x, y]) => (x - o[0]) * out[0] + (y - o[1]) * out[1] > end);
    return free(floor) && free(walls) ? { ...site, floor, walls, turn: true } : null;
  };
  for (let cost = 0; cost <= MAX_COST; cost++) {
    const s = straight(cost);
    if (s) return s;
    for (let k = cost - TURN_COST; k >= 0; k--)
      for (const side of [1, -1] as const) {
        const b = bent(k, cost - TURN_COST - k, side);
        if (b) return b;
      }
  }
  // Nirgends Platz in der Nähe (kommt nicht vor, Test): gerade hinter dem Gang, so weit es braucht
  let c = MAX_COST;
  while (!straight(c) && c < 600) c++;
  return straight(c) ?? { ...frame(gang.at(0, end + ry + c), across, out), floor: [], walls: [], turn: false };
}
