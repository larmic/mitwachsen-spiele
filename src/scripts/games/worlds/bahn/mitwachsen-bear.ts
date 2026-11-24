// Bahnhof Bär auf der Lichtung – rein: wo er liegt (je Seed gesucht, `LINE.bear`): Mitte 13 bis 16 Felder vom Bett, 20
// bis 30° neben dem Strahl vom Bett zum Höhlentor (immer, für jeden Seed), Bahnsteig 2 × 7 mit dem Gleis daneben,
// 12 bis 16 Schritte vom Bett, fern von Plattformen, Wiese, Trögen, Torplatten, Klangsteinen und Teichen. Sein Platz wird
// eben und frei gemacht; der Fußweg zum Tor weicht ihm aus (mitwachsen-line.ts). Teil des Pakets der Bahn.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden)

import type { Point } from '../../../../data/games/mitwachsen';
import { LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { Cell } from '../../mitwachsen-cell';
import type { Door } from '../../mitwachsen-pack-types';
import { kept, key, near, settle } from './mitwachsen-ground';
import { dirOf } from './mitwachsen-trace';

/** Raster der Bucht vor einem Tor: u quer (wächst nach [−out.y, out.x], wie mitwachsen-bay.ts), t nach außen (Tür bei 0) */
export const bayAt =
  (g: Pick<Door, 'mid' | 'out'>) =>
  (u: number, t: number): Point => [g.mid[0] - g.out[1] * u + g.out[0] * t, g.mid[1] + g.out[0] * u + g.out[1] * t];

/**
 * Ein Bahnhof: das Gleis daneben (in Fahrtrichtung, das letzte Feld zur Strecke hin, das erste am Prellbock), die Felder
 * des Bahnsteigs und die Richtung, in der das Gleis den Bahnhof verlässt (`STEPS`)
 */
export type Station = { lane: Point[]; platform: Point[]; dir?: number };

/**
 * Bahnhof Bär: Plätze in der Reihe, wie gut sie zu `LINE.bear` passen (Mitte 25° neben dem Strahl, 14,5 Felder vom Bett
 * zuerst, dann je halbes Feld und Grad weiter weg), jeweils auf der Seite der Spur u −2 (dort hat die Mitte das kleinere
 * u). Zuerst längs zum Tor, das Gleis auf der Seite weg vom Fußweg; dann quer, das Gleis auf der Seite zum Tor (der
 * Bahnsteig zwischen Bett und Gleis), die Strecke verlässt ihn zum Strahl hin oder von ihm weg
 */
export function bearSpots(g: Door, bed: Point): Station[] {
  const { long, wide, r, angle } = LINE.bear;
  const at = bayAt(g);
  const a = Math.atan2(g.mid[1] - bed[1], g.mid[0] - bed[0]);
  const u = (p: Point) => (p[0] - g.mid[0]) * -g.out[1] + (p[1] - g.mid[1]) * g.out[0];
  const t = (p: Point) => (p[0] - g.mid[0]) * g.out[0] + (p[1] - g.mid[1]) * g.out[1];
  const mid = (r[0] + r[1]) / 2,
    turn = (angle[0] + angle[1]) / 2;
  const out = dirOf([0, 0], g.out);
  const across = dirOf([0, 0], [-g.out[1], g.out[0]]); // u wächst
  const tries: [number, number, number, boolean, 0 | 1][] = [];
  for (let rr = r[0]; rr <= r[1]; rr += 0.5)
    for (let deg = angle[0]; deg <= angle[1]; deg += 1)
      for (const flat of [false, true])
        for (const side of [0, 1] as const)
          tries.push([
            rr,
            deg,
            Math.abs(rr - mid) + Math.abs(deg - turn) / 2 + (flat ? 10 : 0) + side * 20,
            flat,
            side,
          ]);
  tries.sort((p, q) => p[2] - q[2]);
  const seen = new Set<string>();
  const spots: Station[] = [];
  for (const [rr, deg, , flat, side] of tries) {
    const c = [1, -1]
      .map((s): Point => {
        const b = a + (s * deg * Math.PI) / 180;
        return [bed[0] + rr * Math.cos(b), bed[1] + rr * Math.sin(b)];
      })
      .sort((p, q) => u(p) - u(q))[side]!;
    const [cu, ct] = [Math.round(u(c)), Math.round(t(c))];
    if (seen.has(`${flat},${side},${cu},${ct}`)) continue;
    seen.add(`${flat},${side},${cu},${ct}`);
    if (!flat) {
      // längs: das Gleis auf der Seite weg vom Strahl (u− oder u+), der Bahnsteig daneben, in Fahrtrichtung zum Tor
      const lu = side ? cu + 1 : cu - 1;
      const lane = Array.from({ length: long }, (_, i) => at(lu, ct - (long >> 1) + i));
      const platform = Array.from({ length: wide * long }, (_, i) =>
        at(side ? cu - (i % wide) : cu + (i % wide), ct - (long >> 1) + Math.floor(i / wide)),
      );
      spots.push({ lane, platform, dir: out });
      continue;
    }
    // quer: Gleis auf der Seite zum Tor, Bahnsteig zwischen ihm und dem Bett
    const platform = Array.from({ length: wide * long }, (_, i) =>
      at(cu - (long >> 1) + Math.floor(i / wide), ct - (i % wide)),
    );
    const row = Array.from({ length: long }, (_, i) => at(cu - (long >> 1) + i, ct + 1));
    spots.push({ lane: row, platform, dir: across }, { lane: [...row].reverse(), platform, dir: (across + 2) % 4 });
  }
  return spots;
}

/** Mitte eines Bahnhofs (Gleis und Bahnsteig) */
export const centreOf = (s: Station): Point => {
  const all = [...s.lane, ...s.platform];
  return [all.reduce((a, p) => a + p[0], 0) / all.length, all.reduce((a, p) => a + p[1], 0) / all.length];
};

/** Winkel in Grad zwischen den Strahlen vom Bett zu `p` und zum Tor */
export const besideRay = (p: Point, g: Pick<Door, 'mid'>, bed: Point) => {
  const a = Math.atan2(p[1] - bed[1], p[0] - bed[0]) - Math.atan2(g.mid[1] - bed[1], g.mid[0] - bed[0]);
  return Math.abs((Math.atan2(Math.sin(a), Math.cos(a)) * 180) / Math.PI);
};

/** Bahnhof Bär im Bereich des Konzepts: Mitte `LINE.bear.r` Felder vom Bett, `LINE.bear.angle` Grad neben dem Strahl */
export function inRange(s: Station, g: Pick<Door, 'mid'>, bed: Point) {
  const { r, angle } = LINE.bear;
  const c = centreOf(s);
  const d = Math.hypot(c[0] - bed[0], c[1] - bed[1]);
  const deg = besideRay(c, g, bed);
  return d >= r[0] && d <= r[1] && deg >= angle[0] && deg <= angle[1];
}

/**
 * Passt Bahnhof Bär hierher: im Bereich (`inRange`), Lichtung, nichts Gemiedenes und kein Wasser auf den Feldern und bis
 * `gap` − 1 Felder ringsum (Plattform, Wiese, Trog, Torplatte, Klangstein), außerhalb des Portalrings, nicht auf der
 * festen Strecke vor der Bucht (`reserved`), und mindestens ein Feld zu Fuß erreichbar. Bäume, Büsche und Höhen räumt
 * `level` danach weg; die Schritte vom Bett und der Fußweg werden danach geprüft (mitwachsen-line.ts)
 */
export function bearFits(
  s: Station,
  g: Door,
  bed: Point,
  map: Map<string, Cell>,
  reach: ReadonlySet<string>,
  reserved: ReadonlySet<string>,
) {
  const { ring, gap } = LINE.bear;
  if (!inRange(s, g, bed)) return false;
  const all = [...s.lane, ...s.platform];
  return (
    all.some((p) => reach.has(key(...p))) &&
    all.every((p) => {
      const cell = map.get(key(...p));
      return (
        !!cell &&
        cell.region === 'lichtung' &&
        !cell.gate &&
        Math.hypot(p[0] - bed[0], p[1] - bed[1]) >= ring &&
        !reserved.has(key(...p)) &&
        !near(map, p, gap - 1, (n) => kept(n) || n.ground === 'water')
      );
    })
  );
}

/** Die Felder des Bahnhofs samt `gap` − 1 Feldern ringsum: Dort führt der Fußweg nicht entlang */
export function aroundOf(s: Station): Set<string> {
  const out = new Set<string>();
  const r = LINE.bear.gap - 1;
  for (const [x, y] of [...s.lane, ...s.platform])
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.add(key(x + dx, y + dy));
  return out;
}

/**
 * Wand für den Fußweg, damit er das Gleis nie kreuzen muss: Das Gleis läuft vom Bahnhof zur Spur u −2 vor dem Tor, der
 * Fußweg vom Bett zur Torplatte daneben (u −1 … 1). Mit `inner` geht der Fußweg zwischen Bahnhof und Strahl vom Bett zum
 * Tor vorbei: Die Wand führt von der Mitte des Bahnhofs quer zum Strahl nach außen. Sonst geht er außen um den Bahnhof
 * herum: Die Wand führt quer über den Strahl hinweg. Je `long` Felder weit; zu Fuß (nur vier Richtungen) kommt niemand
 * hindurch
 */
export function wallOf(s: Station, g: Pick<Door, 'mid'>, bed: Point, inner: boolean, long = 48): Set<string> {
  const c = centreOf(s);
  const [ax, ay] = [g.mid[0] - bed[0], g.mid[1] - bed[1]];
  const len = Math.hypot(ax, ay) || 1;
  const away = Math.sign(ax * (c[1] - bed[1]) - ay * (c[0] - bed[0])) || 1; // zur Seite des Bahnhofs hin
  const out = inner ? away : -away;
  const [nx, ny] = [(-ay / len) * out, (ax / len) * out];
  const wall = new Set<string>();
  for (let t = 0; t <= long; t += 0.25) wall.add(key(Math.round(c[0] + nx * t), Math.round(c[1] + ny * t)));
  return wall;
}

/**
 * Platz des Bahnhofs eben und frei machen: alle Felder auf die niedrigste Höhe darunter, ohne Baum und Busch (Wasser
 * liegt dort nie, `bearFits`); ringsum höchstens eine Stufe
 */
export function level(map: Map<string, Cell>, s: Station) {
  const all = [...s.lane, ...s.platform];
  const h = Math.min(...all.map((p) => map.get(key(...p))!.h));
  for (const p of all) {
    const c = map.get(key(...p))!;
    map.set(key(...p), { ...c, h, ...(c.solid && { deco: null, solid: false, tree: undefined }) });
  }
  settle(map, all);
}

/** Die Felder um `cells` (Rand `r`), wie sie jetzt sind: zum Zurücklegen, wenn ein Versuch nicht passt */
export function snapshot(map: Map<string, Cell>, cells: readonly Point[], r = 8) {
  const saved = new Map<string, Cell | undefined>();
  const xs = cells.map((p) => p[0]),
    ys = cells.map((p) => p[1]);
  for (let y = Math.min(...ys) - r; y <= Math.max(...ys) + r; y++)
    for (let x = Math.min(...xs) - r; x <= Math.max(...xs) + r; x++) saved.set(key(x, y), map.get(key(x, y)));
  return () => {
    for (const [k, c] of saved) if (c) map.set(k, c);
  };
}

const STEPS4: readonly Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * Reihen eines Bahnhofs quer zum Gleis, vom Prellbock an (`lane` in Reihe): je das Feld am Gleis und das dahinter. Liegt
 * der Bahnsteig nicht in zwei Reihen neben dem Gleis, leer
 */
export function rowsOf(s: Pick<Station, 'lane' | 'platform'>): { edge: Point; back: Point }[] {
  const on = new Set(s.platform.map((p) => key(...p)));
  const first = s.lane[0];
  const side = first && STEPS4.find(([dx, dy]) => on.has(key(first[0] + dx, first[1] + dy)));
  if (!side) return [];
  const rows = s.lane.map(([x, y]) => ({
    edge: [x + side[0], y + side[1]] as Point,
    back: [x + 2 * side[0], y + 2 * side[1]] as Point,
  }));
  return rows.every((r) => on.has(key(...r.edge)) && on.has(key(...r.back))) ? rows : [];
}

/**
 * Toks Häuschen am Kopf des Bahnhofs Bär: auf dem Feld hinten (fern vom Gleis) in der ersten oder letzten Reihe, auf der,
 * die weiter vom Bett liegt, damit das Feld des Bahnsteigs nächst dem Bett frei bleibt (dort wartet Tok, und dorthin
 * zählen die Schritte vom Bett). Das Feld ist fest; undefined ohne Reihen
 */
export function hutOf(s: Pick<Station, 'lane' | 'platform'>, bed: Point): { at: Point; row: number } | undefined {
  const rows = rowsOf(s);
  const ends = [0, rows.length - 1].flatMap((row) => (rows[row] ? [{ at: rows[row].back, row }] : []));
  const far = (p: Point) => Math.hypot(p[0] - bed[0], p[1] - bed[1]);
  return ends.sort((a, b) => far(b.at) - far(a.at))[0];
}
