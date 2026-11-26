// Bahnsteige am Gleis – rein, ohne DOM: die Reihen des Bahnsteigs von Bahnhof Bär (auf der Lichtung) und Bahnhof
// Fledermaus (in der Grotte, ab Ausbau 2), auf welcher Seite des Gleises er liegt (`side`), über welchen zwei Reihen sein
// Dach steht (`roof`) und wohin die Figur aussteigt (`exitsOf`, Haken `Vehicle.exit` des Zugs): auf den Bahnsteig, an der
// Tür des mittleren Wagens, nie unter das Dach (die Kamera schaut von Süden, das Dach verdeckte sie sonst samt Kopf).
// Regeln und Bild (mitwachsen-station-look.ts, mitwachsen-bat-look.ts) lesen dieselben Reihen. Teil des Pakets der Bahn.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Fahren, Aussteigen sichtbar)

import type { Point, RegionId } from '../../../../data/games/mitwachsen';
import { LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { World } from '../../mitwachsen-world';
import { hutOf, rowsOf } from './mitwachsen-bear';
import { key } from './mitwachsen-ground';
import { STEPS } from './mitwachsen-trace';
import { lineOf } from './mitwachsen-train-line';

/** Eine Reihe des Bahnsteigs quer zum Gleis: das Feld an der Kante zum Gleis und das hintere */
export type Row = { edge: Point; back: Point };

/**
 * Ein Bahnsteig: das Gleis daneben (`lane`, von Bahnhof Bär aus in Reihe), seine Reihen (je Feld von `lane` eine), die
 * Richtung vom Gleis zum Bahnsteig (`side`), die beiden Reihen unter dem Dach (`roof`) und, an Bahnhof Bär, Toks Häuschen
 */
export type Platform = {
  lane: Point[];
  rows: Row[];
  side: Point;
  roof: readonly [number, number];
  hut?: { at: Point; row: number };
};

/**
 * Halbe Breite des Dachs entlang des Gleises (Bahnhof Bär und Fledermaus, `ROOF_SIZE.wide`: 2,16 Felder um die Mitte
 * zwischen seinen zwei Reihen; seit Issue 15 liegt die Platte nur noch über den hinteren Feldern dieser Reihen, die
 * Breite ist geblieben): Liegt ein Feld entlang des Gleises weiter als das von der Mitte weg, verdeckt das Dach es nicht
 */
export const ROOF_HALF = 1.08;

/** Die Felder eines Bahnsteigs (`Cell.stop`) bis zwei Felder neben dem Gleis `lane`, nur in `realm` (sonst überall) */
function stopsBy(world: World, lane: readonly Point[], realm?: RegionId): Point[] {
  const found = new Map<string, Point>();
  for (const [x, y] of lane)
    for (const [dx, dy] of STEPS)
      for (const k of [1, 2]) {
        const q: Point = [x + dx * k, y + dy * k];
        const c = world.cell(...q);
        if (c.stop === 'hoehle' && (!realm || c.region === realm)) found.set(key(...q), q);
      }
  return [...found.values()];
}

/**
 * Dach von Bahnhof Bär: über den Reihen 1 und 2, neben der Sitzreihe (`SEAT` = 3); steht Toks Häuschen in der letzten
 * Reihe, über den beiden davor
 */
export const bearRoof = (n: number, hut?: number): readonly [number, number] =>
  hut === n - 1 ? [n - 3, n - 2] : [1, 2];

/**
 * Dach von Bahnhof Fledermaus: über den letzten beiden Reihen (5 und 6 der 7), am fernen Ende, weg von der Sitzreihe 3
 * (dort steigt die Figur aus; früher lag es über ihr und verdeckte sie)
 */
export const batRoof = (n: number): readonly [number, number] => [n - 2, n - 1];

const side = (rows: readonly Row[], lane: readonly Point[]): Point | undefined => {
  const [first, head] = [rows[0], lane[0]];
  return first && head ? [first.edge[0] - head[0], first.edge[1] - head[1]] : undefined;
};

const bears = new WeakMap<World, Platform | null>();
/**
 * Bahnsteig von Bahnhof Bär aus den Feldern der Welt (je Welt einmal): die ersten `LINE.bear.long` Felder des Gleises
 * vom Prellbock an, die Felder des Bahnsteigs daneben, Toks Häuschen; null ohne Gleis oder Bahnsteig
 */
export function bearPlatform(world: World): Platform | null {
  if (bears.has(world)) return bears.get(world)!;
  const lane = lineOf(world, false).slice(0, LINE.bear.long);
  const platform = stopsBy(world, lane);
  const rows = rowsOf({ lane, platform });
  const s = side(rows, lane);
  const hut = s && hutOf({ lane, platform }, world.homes.lichtung.bed);
  const found = s ? { lane, rows, side: s, roof: bearRoof(rows.length, hut?.row), ...(hut ? { hut } : {}) } : null;
  bears.set(world, found);
  return found;
}

const bats = new WeakMap<World, Platform | null>();
/**
 * Bahnsteig von Bahnhof Fledermaus aus den Feldern der Welt (je Welt einmal): das Gleis hinter dem Prellbock an seinem
 * Ende (so lang wie der Bahnsteig), die Felder des Bahnsteigs daneben in der Grotte; null ohne Grotte oder solange der
 * Bahnsteig nicht über dem Gleis liegt (vor Ausbau 2)
 */
export function batPlatform(world: World): Platform | null {
  if (bats.has(world)) return bats.get(world)!;
  const far = lineOf(world, true);
  const lane = far.length > lineOf(world, false).length ? far.slice(-LINE.bear.long) : [];
  const rows = rowsOf({ lane, platform: stopsBy(world, lane, 'hoehle') });
  const s = side(rows, lane);
  const raised = !!s && world.cell(...rows[0]!.edge).h > world.cell(...lane[0]!).h;
  const found = s && raised ? { lane, rows, side: s, roof: batRoof(rows.length) } : null;
  bats.set(world, found);
  return found;
}

/**
 * Wohin die Figur am liebsten aussteigt, wenn der Sitz auf `seat` steht (Haken `Vehicle.exit`), die besten zuerst: die
 * Felder des Bahnsteigs außer den beiden Reihen unter dem Dach und Toks Häuschen, zuerst das Feld an der Kante neben dem
 * Sitz (die Tür des mittleren Wagens), dann die nächsten, an der Kante vor dem hinteren bei gleichem Abstand. Leer, wenn
 * der Sitz nicht neben diesem Bahnsteig steht. Ob ein Feld frei ist, prüft die Fahr-Engine
 */
export function exitsOf(p: Platform, seat: Point): Point[] {
  const k = p.lane.findIndex(([x, y]) => x === seat[0] && y === seat[1]);
  const door = p.rows[k]?.edge;
  if (!door) return [];
  const hut = p.hut && key(...p.hut.at);
  const spots = p.rows.flatMap((r, i) =>
    p.roof.includes(i)
      ? []
      : [
          { p: r.edge, back: 0 },
          { p: r.back, back: 1 },
        ].filter((o) => key(...o.p) !== hut),
  );
  const d = (o: { p: Point; back: number }) => Math.hypot(o.p[0] - door[0], o.p[1] - door[1]) + o.back * 1e-3;
  return spots.sort((a, b) => d(a) - d(b)).map((o) => o.p);
}
