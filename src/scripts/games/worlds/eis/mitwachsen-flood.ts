// Wege des verlaufenen Pinguins – rein, ohne DOM: Schritte von jedem Feld bis zu einem Ziel (Breitensuche rückwärts),
// je Welt und Ziel einmal berechnet. Genutzt für den Weg zum Tor (mitwachsen-lead.ts, `toGate`) und den Weg zur
// Schneewiese (mitwachsen-ritual.ts, `toMeadow`). Dazu, was alle Teile des Welt-Pakets der Eis-Welt brauchen: Schlüssel
// eines Felds (`key`) und die vier Richtungen (`ALL`), je einmal im Paket.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“)

import { DIRS } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import type { World } from '../../mitwachsen-world';

/** Schlüssel des Felds (x, y) als "x,y" */
export const key = (x: number, y: number) => `${x},${y}`;
/** Die vier Schritte (n, e, s, w) als [dx, dy] */
export const ALL = Object.values(DIRS);
const fields = new WeakMap<World, Map<string, Map<string, number>>>();

const CAP = 40_000; // höchstens so viele Felder (die Lichtung ist groß, die Eis-Welt hat weit weniger)

/**
 * Schritte von jedem Feld, von dem man zu einem der Ziele (`goals`, Schritt 0) kommt: `ok(x, y, tx, ty)` sagt, ob der
 * Schritt von (x, y) nach (tx, ty) geht. Höchstens `CAP` Felder. Je Welt und Name (`name`) einmal.
 */
export function flood(
  world: World,
  name: string,
  goals: () => Point[],
  ok: (x: number, y: number, tx: number, ty: number) => boolean,
): Map<string, number> {
  let byName = fields.get(world);
  if (!byName) fields.set(world, (byName = new Map<string, Map<string, number>>()));
  let field = byName.get(name);
  if (field) return field;
  field = new Map();
  const queue = goals();
  for (const [x, y] of queue) field.set(key(x, y), 0);
  for (let i = 0; i < queue.length && field.size < CAP; i++) {
    const [x, y] = queue[i]!;
    const n = field.get(key(x, y))!;
    for (const [dx, dy] of ALL) {
      const [nx, ny] = [x + dx, y + dy];
      if (field.has(key(nx, ny)) || !ok(nx, ny, x, y)) continue;
      field.set(key(nx, ny), n + 1);
      queue.push([nx, ny]);
    }
  }
  byName.set(name, field);
  return field;
}
