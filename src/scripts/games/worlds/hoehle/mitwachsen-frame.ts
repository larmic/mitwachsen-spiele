// Raster der Kristallgrotte in der Welt – rein, im Welt-Paket der Höhlenwelt: aus dem Höhlenbett und dem Portal am See
// (beide auf der Mitte der Grotte) die Lage jedes Felds [quer, vom Tor weg] von der Mündung aus, quer zur Seite des
// Bahnhofs Fledermaus. Genutzt von der Dunkelmaske (mitwachsen-mask.ts), den Lichtgeistern (mitwachsen-ghost.ts) und den
// Netzen der Tupfspinnen (mitwachsen-spider.ts); je Welt einmal gerechnet.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Höhle nach dem ersten Spielen“, Dunkelmaske)

import type { Point } from '../../../../data/games/mitwachsen';
import { CAVE_PORTAL } from '../../../../data/games/mitwachsen-portals';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { World } from '../../mitwachsen-world';

/** Raster der Grotte in der Welt: Feld zu einer Lage [quer, vom Tor weg] von der Mündung aus, und wie weit ein Feld vom Tor weg liegt */
export type Frame = { at(across: number, out: number): Point; out(x: number, y: number): number };
/** Welt, wie das Raster sie liest */
export type Cave = Pick<World, 'homes' | 'portals' | 'cell'>;
const frames = new WeakMap<object, Frame | null>();

/**
 * Raster der Grotte aus dem Bett und dem Portal am See (beide auf der Mitte, `GROTTE.bed` und `GROTTE.portal`); quer zeigt
 * zur Seite des Bahnhofs (`Cell.stop`). Ohne Grotte (kein Portal am See) null; je Welt einmal
 */
export function caveFrame(world: Cave): Frame | null {
  const known = frames.get(world);
  if (known !== undefined) return known;
  const gate = world.portals.get(CAVE_PORTAL)?.gate;
  const bed = world.homes.hoehle?.bed;
  let frame: Frame | null = null;
  if (gate && bed) {
    const len = GROTTE.portal[1] - GROTTE.bed;
    const f = [(gate[0] - bed[0]) / len, (gate[1] - bed[1]) / len] as const;
    const mouth = [bed[0] - f[0] * GROTTE.bed, bed[1] - f[1] * GROTTE.bed] as const;
    const make = (a: readonly [number, number]): Frame => ({
      at: (u, o) => [Math.round(mouth[0] + a[0] * u + f[0] * o), Math.round(mouth[1] + a[1] * u + f[1] * o)],
      out: (x, y) => (x - mouth[0]) * f[0] + (y - mouth[1]) * f[1],
    });
    const { side, out } = GROTTE.station;
    frame = make([-f[1], f[0]]);
    if (world.cell(...frame.at(side, out + 1)).stop !== 'hoehle') frame = make([f[1], -f[0]]);
  }
  frames.set(world, frame);
  return frame;
}
