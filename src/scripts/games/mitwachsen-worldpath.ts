// Weltpfade der Lichtung (Issue 61) – rein, im Kern: Von jedem Portalstein am Bett führt ein Pfad im Material seiner
// Welt (wie ihr Vorfeld, `APRON`) zur Plattform an ihrem Tor, schon bevor das Tor aufgeht. Nah am Bett sind es einzelne
// Trittsteine (jedes zweite Feld), ab `PATHS.solid` Feldern vom Bett ist er durchgehend: So ahnt man ihn erst und sieht
// ihn dann deutlich. Geändert wird nur der Boden begehbarer Wiese: keine Höhe, nichts Festes, kein Wasser; flache
// Zierde (Blumen, Farn, Pilze) weicht vom Pfad. Erreichbarkeit und Wohnorte der Tiere bleiben, wie sie sind. Gelegt
// werden die Pfade nach dem Bau der Lichtung und vor dem, was Pakete hineinlegen (das Gleis der Bahn liegt darüber).
// Spezifikation: docs/specs/mitwachsen.md („Weltpfade und Stellplätze am Portalstein“)

import type { GateId, Point } from '../../data/games/mitwachsen';
import { APRON } from './mitwachsen-apron';
import type { Cell } from './mitwachsen-cell';
import { footpath, standable } from './mitwachsen-footpath';
import type { Portal } from './mitwachsen-portal';

/** Bis so weit vom Bett liegt der Pfad nur als Trittsteine (jedes `every`-te Feld), danach durchgehend */
export const PATHS = { solid: 20, every: 2 } as const;
const key = (x: number, y: number) => `${x},${y}`;
/** Flache Zierde, die einem Pfad weicht */
const SOFT: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>(['flower', 'fern', 'mushroom']);

/** Wiese, auf der ein Pfad liegen darf: begehbares Gras der Lichtung ohne Merkmal, höchstens mit flacher Zierde */
const meadow = (c: Cell | undefined): c is Cell =>
  !!c &&
  c.region === 'lichtung' &&
  c.ground === 'grass' &&
  !c.solid &&
  !c.garden &&
  !c.portal &&
  !c.plate &&
  !c.way &&
  (!c.deco || SOFT.has(c.deco));

/** Felder der geraden Linie von `a` nach `b`, jedes ein Nachbar des vorigen (nie schräg) */
export function line([ax, ay]: Point, [bx, by]: Point): Point[] {
  const out: Point[] = [[ax, ay]];
  const [dx, dy] = [Math.abs(bx - ax), Math.abs(by - ay)];
  const [sx, sy] = [Math.sign(bx - ax), Math.sign(by - ay)];
  let [x, y, ix, iy] = [ax, ay, 0, 0];
  while (ix < dx || iy < dy) {
    // der Schritt, der näher an der Linie bleibt (bei Gleichstand quer zuerst: stabil und ohne Diagonale)
    if (iy >= dy || (ix < dx && (0.5 + ix) * dy <= (0.5 + iy) * dx)) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    out.push([x, y]);
  }
  return out;
}

/**
 * Fußweg von `from` nach `to`: die gerade Linie, solange man sie gehen kann (begehbar, höchstens eine Stufe hinauf);
 * wo etwas im Weg ist (Teich, Baum, Stufe), der kürzeste Umweg bis zum nächsten gangbaren Feld der Linie (`footpath`).
 * Viel billiger als eine Suche über den ganzen Weg: Die meisten Felder liegen frei. Leer, wenn es keinen Weg gibt
 */
export function route(map: Map<string, Cell>, from: Point, to: Point): Point[] {
  const ray = line(from, to);
  const at = (p: Point) => map.get(key(...p));
  const none = new Set<string>();
  const out: Point[] = [from];
  for (let i = 0; i < ray.length - 1;) {
    const here = out.at(-1)!;
    const next = ray[i + 1]!;
    if (standable(at(next)) && at(next)!.h - at(here)!.h <= 1) {
      out.push(next);
      i++;
      continue;
    }
    // das nächste Feld der Linie hinter dem Hindernis, zu dem ein Weg führt
    let j = i + 1;
    let detour: Point[] = [];
    for (; j < ray.length && !detour.length; j++)
      if (standable(at(ray[j]!)) || j === ray.length - 1) detour = footpath(map, [here], ray[j]!, none);
    if (!detour.length) return [];
    out.push(...detour.slice(1));
    i = j - 1;
  }
  return out;
}

/**
 * Die Pfade in die Karte der Lichtung legen: je Tor vom Portalstein am Bett (`Portal.home`) zur Plattform am Tor
 * (`Portal.gate`), gerade, wo es geht, sonst mit dem kürzesten Umweg (`route`). Liefert je Tor die Felder, die jetzt Pfad sind
 */
export function layPaths(
  map: Map<string, Cell>,
  bed: Point,
  portals: ReadonlyMap<GateId, Portal>,
): Map<GateId, Point[]> {
  const out = new Map<GateId, Point[]>();
  for (const [id, p] of portals) {
    const laid: Point[] = [];
    route(map, p.home, p.gate).forEach(([x, y], i) => {
      const c = map.get(key(x, y));
      const far = Math.hypot(x - bed[0], y - bed[1]) >= PATHS.solid;
      if (!meadow(c) || (!far && i % PATHS.every)) return;
      map.set(key(x, y), { ...c, ground: APRON[id], deco: null, tufts: 0, way: id });
      laid.push([x, y]);
    });
    out.set(id, laid);
  }
  return out;
}
