// Große Tore in der 2D-Ansicht: Türme, Tür mit Eisenbändern und Torbogen in den Farben ihrer Welt. Die Tür wird beim
// Öffnen von vorn gesehen schmaler, jeder Flügel zu seiner Angel hin (bei Toren im Osten oder Westen, deren Tür man nur
// von der Seite sieht, verschwindet sie Feld für Feld). Führt der verlaufene Pinguin die Figur zu einem Tor im Norden
// oder Süden, steht statt des Zeichens sein Umriss auf der Tür (mitwachsen-guest-look.ts, nachgeladen). Die
// 3D-Torhäuser baut mitwachsen-gatehouse.ts.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore)

import { box, type Projection } from '../../lib/games/front';
import { THEME_COLORS, type GateId } from '../../data/games/mitwachsen';
import type { Guest } from './mitwachsen-guest-look';
import type { Cell, World } from './mitwachsen-world';

const ARCH = 4.7; // Höhe der Tür bis zum Torbogen
const HALF = 2.5; // halbe Breite der Tür: jeder Flügel ist so breit

/** Umriss des Pinguins auf dieser Tür: solange er hierher führt und die Tür noch zu ist */
const outlineOn = (guest: Guest | null, id: GateId, open: number) =>
  guest?.gate === id && open === 0 ? guest.outline : null;

/**
 * Großes Tor in 2D, ein Feld: Turm, oder Tür mit Eisenbändern, darüber der Torbogen in den Farben seiner Welt.
 * Die Öffnung je Tor (`gates`, 0 … 1) lässt die Flügel schmaler werden, jeder zu seiner Angel hin. In der Mitte der
 * geschlossenen Tür leuchtet das Zeichen; führt der Pinguin zu diesem Tor (`guest`, nachgeladen), steht dort sein Umriss
 * mit Goldrahmen (gezeichnet mit dem letzten Feld der Tür, damit kein Feld ihn verdeckt).
 */
export function bigGate(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  world: World,
  c: Cell,
  x: number,
  y: number,
  h: number,
  gates: ReadonlyMap<GateId, number>,
  guest: Guest | null,
) {
  if (c.deco === 'gatetower') {
    const theme = THEME_COLORS[c.part!.id];
    box(ctx, P, x, y, h, 1, 1, 6.6, theme.side, theme.top);
    box(ctx, P, x + 0.3, y + 0.3, h + 6.6, 0.4, 0.4, 0.6, theme.portal);
    return;
  }
  const g = world.gates.get(c.gate!)!;
  const theme = THEME_COLORS[g.id];
  const open = gates.get(g.id) ?? 0;
  const outline = outlineOn(guest, g.id, open);
  const [mx, my] = g.mid;
  const u = (x - mx) * Math.abs(g.out[1]) + (y - my) * Math.abs(g.out[0]); // Lage entlang des Tors (−2 … 2)
  const reach = HALF * Math.cos((open * Math.PI) / 2); // so weit reicht ein Flügel von seiner Angel aus
  // Geschlossen eine Tür über die ganze Breite (wie immer), sonst zwei Flügel, jeder an seiner Angel
  const leaves: (readonly [number, number])[] =
    open === 0
      ? [[-HALF, HALF]]
      : [
          [-HALF, Math.min(0, -HALF + reach)],
          [Math.max(0, HALF - reach), HALF],
        ];
  const across = g.out[1] !== 0; // Tor im Norden oder Süden: Man sieht die Tür von vorn
  for (const [lo, hi] of leaves) {
    const [a, b] = [Math.max(lo, u - 0.5), Math.min(hi, u + 0.5)];
    // Tor im Osten oder Westen: Die Tür ist nur von der Seite zu sehen, ein Feld bleibt, solange der Flügel es halb deckt
    if (b - a < (across ? 0.01 : 0.5)) continue;
    const [at, w] = across ? [x + a - (u - 0.5), b - a] : [x, 1];
    box(ctx, P, at, y + 0.35, h, w, 0.3, ARCH, '#6b4423', '#7d5232');
    for (const z of [0.7, 2.3, 3.9]) box(ctx, P, at, y + 0.3, h + z, w, 0.4, 0.18, '#3a3a44');
  }
  box(ctx, P, x, y + 0.1, h + ARCH, 1, 0.8, 1.2, theme.side, theme.top);
  if (open === 0 && !(outline && across) && x === mx && y === my)
    box(ctx, P, x + 0.3, y + 0.28, h + 2.2, 0.4, 0.04, 0.6, theme.portal); // Zeichen in der Mitte
  const last = g.cells.reduce((p, q) => (q[1] > p[1] || (q[1] === p[1] && q[0] > p[0]) ? q : p));
  // Den Umriss gibt es in 2D nur auf einer Tür, die man von vorn sieht (in 3D an jedem Tor, auch auf offenen Flügeln)
  if (outline && across && x === last[0] && y === last[1]) outline(ctx, P, mx + 0.5, y + 0.7, h);
}
