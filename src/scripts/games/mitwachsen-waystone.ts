// Wegsteine an den Weltpfaden der Lichtung (Weltpfade, Schritt 3) – rein, im Kern: Neben jedem Pfad liegt alle 6 bis 8
// Felder ein flacher Stein, abwechselnd links und rechts. Er schläft (matt, grau), bis das Tor seiner Welt offen ist;
// dann leuchtet seine Einlage in der Farbe der Welt. Geht das Tor auf, läuft ein Glitzern Stein für Stein vom Bett zum
// Tor (`due`); bei reduzierter Bewegung leuchten die Steine nur, ohne Glitzern. Der Stein ist nur Bild: begehbar, nichts hängt an ihm.
// Gelegt wird er auf freie Wiese neben dem Pfad auf dessen Höhe; liegt später etwas darauf (Gleis, Bahnsteig, Zierde),
// sieht man ihn nicht (`stoneOf`). Nah am Rand kann sein Feld ein Fleck Schnee oder Sand der Welt dahinter sein.
// Spezifikation: docs/specs/mitwachsen.md („Weltpfade und Stellplätze am Portalstein“)

import type { GateId, Point } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';

/** Abstände der Steine entlang des Pfads in Feldern (reihum) und Takte zwischen zwei Steinen der Lichterkette */
export const WAYSTONES = { gaps: [6, 7, 8], pace: 2 } as const;
const key = (x: number, y: number) => `${x},${y}`;

/** Freie Wiese, auf der ein Wegstein liegen darf */
const free = (c: Cell | undefined, h: number): c is Cell =>
  !!c &&
  c.region === 'lichtung' &&
  c.ground === 'grass' &&
  c.h === h &&
  !c.solid &&
  !c.deco &&
  !c.garden &&
  !c.portal &&
  !c.plate &&
  !c.gate &&
  !c.way &&
  !c.waystone;

/** Welt des Wegsteins, der auf dem Feld zu sehen ist (nichts liegt darauf) */
export const stoneOf = (c: Cell | undefined): GateId | undefined =>
  c && !c.deco && !c.solid && !c.ride && !c.stop ? c.waystone : undefined;

/**
 * Wegsteine neben die gelegten Pfade (`layPaths`, je Tor vom Bett zum Tor geordnet) in die Karte legen: nach je
 * `WAYSTONES.gaps` Feldern Weg einer, quer zur Laufrichtung neben dem Pfad, abwechselnd links und rechts; ist dort
 * kein Platz, auf der anderen Seite, sonst am nächsten Feld des Pfads. Liefert je Tor seine Steine vom Bett zum Tor
 */
export function layStones(map: Map<string, Cell>, paths: ReadonlyMap<GateId, readonly Point[]>): Map<GateId, Point[]> {
  const out = new Map<GateId, Point[]>();
  for (const [id, path] of paths) {
    const stones: Point[] = [];
    let walked = 0;
    path.forEach(([x, y], i) => {
      const prev = path[i - 1];
      if (!prev) return;
      const [dx, dy] = [x - prev[0], y - prev[1]];
      walked += Math.abs(dx) + Math.abs(dy);
      if (walked < WAYSTONES.gaps[stones.length % WAYSTONES.gaps.length]!) return;
      const along = Math.abs(dx) >= Math.abs(dy); // der Pfad läuft hier entlang x: Die Steine liegen nördlich und südlich
      const side = stones.length % 2 ? 1 : -1;
      const h = map.get(key(x, y))!.h;
      for (const s of [side, -side]) {
        const [sx, sy] = along ? [x, y + s] : [x + s, y];
        const c = map.get(key(sx, sy));
        if (!free(c, h)) continue;
        map.set(key(sx, sy), { ...c, tufts: 0, waystone: id });
        stones.push([sx, sy]);
        walked = 0;
        return;
      }
    });
    out.set(id, stones);
  }
  return out;
}

/**
 * Steine der Lichterkette, die im Takt `tick` aufblitzen, wenn die Kette im Takt `start` am Bett losläuft (dann
 * schwingen die Flügel des Tors auf): der i-te nach i · `WAYSTONES.pace` Takten
 */
export const due = (stones: readonly Point[], start: number, tick: number): Point[] =>
  stones.filter((_, i) => start + i * WAYSTONES.pace === tick);
