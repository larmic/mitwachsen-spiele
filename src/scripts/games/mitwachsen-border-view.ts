// Bild der Weltgrenze, gleich für 2D und die Ebene über 3D: das Zeichen der Gegend links in der Leiste (grünes Blatt der
// Lichtung, Schneeflocke der Eis-Welt), das Umklappen der Leiste beim Wechsel an der Gangmitte und der kleine Pfeil zum
// Tor über wartenden Tieren. Das alles gibt es erst, wenn das Eistor offen ist (vorher gibt es nur eine Gegend): Die
// Ansicht lädt es mit dem Wetter der Eis-Welt nach (mitwachsen-ice-sky.ts), nie mit der Spielseite.
// Spezifikation: docs/specs/mitwachsen.md (Regel 7a „Weltgrenze“, „Was angezeigt wird“: Leiste unten)

import type { Projection } from '../../lib/games/front';
import { fromKey } from '../../lib/games/chunks';
import { GAME_COLORS, type Point, type RegionId } from '../../data/games/mitwachsen';
import { crossings } from './mitwachsen-border';
import { sprite } from './mitwachsen-glyphs';
import type { World } from './mitwachsen-world';

export const TURN_MS = 400; // so lange klappt die Leiste beim Wechsel der Gegend um

const ARROW = ['..a..', '.aaa.', 'aaaaa', '.aaa.', '.aaa.']; // zeigt nach oben
/** Zeichen und Farbe jeder Gegend links in der Leiste: grünes Blatt der Lichtung, Schneeflocke der Eis-Welt */
const SIGN: Record<RegionId, readonly [string[], string]> = {
  lichtung: [
    ['.....ggg', '...ggggg', '..gggggg', '.gggg.gg', '.ggg.ggg', '.gg.ggg.', '..gggg..', '.g......'],
    '#3f9a3c',
  ],
  eis: [['...f...', '.f.f.f.', '..fff..', 'fffffff', '..fff..', '.f.f.f.', '...f...'], '#3f8fd8'],
};

/** Was sich die Leiste über das Umklappen merkt: welche Gegend sie zeigt, welche davor und seit wann */
export type Turn = { shown?: RegionId; from?: RegionId; at?: number };

/**
 * Umklappen der Leiste: Wechselt die Gegend, wird die Leiste in `TURN_MS` erst flach und klappt dann mit den Tieren der
 * neuen Gegend wieder auf (bei reduzierter Bewegung sofort). Liefert die Gegend, deren Tiere gerade zu sehen sind, und
 * wie weit die Leiste offen ist (0 … 1).
 */
export function turnAlbum(t: Turn, realm: RegionId, now: number, reduced: boolean): [RegionId, number] {
  if (t.shown && t.shown !== realm) [t.from, t.at] = [t.shown, now];
  t.shown = realm;
  const p = reduced || t.at === undefined ? 1 : Math.min(1, (now - t.at) / TURN_MS);
  return p < 0.5 ? [t.from ?? realm, 1 - 2 * p] : [realm, 2 * p - 1];
}

/** Zeichen der Gegend links in der Leiste, unten mittig bei (cx, bottom), `size` breit */
export function realmSign(ctx: CanvasRenderingContext2D, realm: RegionId, cx: number, bottom: number, size: number) {
  const [grid, color] = SIGN[realm];
  sprite(ctx, grid, color, cx, bottom, size / 8);
}

/** Wohin der Pfeil über einem wartenden Tier zeigt: zum nächsten ersten Feld seiner Seite (Tor bzw. Gangmündung) */
export function gateward(world: World, a: { x: number; y: number; realm: RegionId }): Point | null {
  let best: Point | null = null;
  const far = (p: Point) => Math.hypot(p[0] - a.x, p[1] - a.y);
  for (const c of crossings(world))
    for (const [k, side] of c.entries)
      if (side === a.realm && (!best || far(fromKey(k)) < far(best))) best = fromKey(k);
  return best;
}

/** Kleiner Pfeil über dem Kopf eines wartenden Tiers (bei hx, hy), zum Tor gedreht; weiß mit dunkler Kante */
export function waitArrow(
  ctx: CanvasRenderingContext2D,
  world: World,
  P: Projection,
  a: { x: number; y: number; realm: RegionId },
  b: { x: number; y: number; z: number },
  [hx, hy]: readonly [number, number],
  px: number,
) {
  const to = gateward(world, a);
  if (!to) return;
  const [gx, gy] = P(to[0] + 0.5, to[1] + 0.5, b.z);
  const [ax, ay] = P(b.x + 0.5, b.y + 0.5, b.z);
  ctx.save();
  ctx.translate(Math.round(hx), Math.round(hy - 4 * px));
  // Der Pfeil zeigt nach oben: in Vierteldrehungen zum Tor drehen, so bleiben die Pixel scharf
  ctx.rotate((Math.round(Math.atan2(gy - ay, gx - ax) / (Math.PI / 2)) + 1) * (Math.PI / 2));
  sprite(ctx, ARROW, GAME_COLORS.ink, 1, 2.5 * px + 1, px); // dunkle Kante
  sprite(ctx, ARROW, GAME_COLORS.arrow, 0, 2.5 * px, px);
  ctx.restore();
}
