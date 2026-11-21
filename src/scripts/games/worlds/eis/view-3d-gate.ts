// Das Eistor in 3D, soweit es zur Eis-Welt gehört (im 3D-Teil ihres Welt-Pakets, mit ihm nachgeladen): Beschläge und
// Zeichen der Doppeltür, der Umriss des verlaufenen Pinguins darauf, der sich beim Öffnen füllt, das Leuchten der
// Eiszapfen im Ritual, die goldene Bucht vor dem Tor, solange er die Figur dorthin führt, und die Torplatte als
// Eisscholle mit Schneeflocke. Den Zugang selbst (Schlucht,
// Bogen, Orgel) und die schlichten Türbretter baut der Kern (mitwachsen-gate-eis.ts, mitwachsen-gatehouse.ts).
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“, Abschnitt „Welt-Pakete“)

import { THEME_COLORS } from '../../../../data/games/mitwachsen';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { ICE_FLOE } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import type { GateLook } from '../../mitwachsen-gate-kit';
import { W, block, leaves, onLeaf, wings, type Leaf, type Parts, type Wing } from '../../mitwachsen-gatehouse';
import { GUEST_OUTLINE, GUEST_PX, GUEST_Y, guestPixel } from '../../mitwachsen-guest-look';

const ICE_GLOW = '#7fd6ff'; // eisblau leuchtende Eiszapfen, wenn das Eistor aufgeht
const ICICLE = '#d4f1ff'; // Eiszapfen ohne Ritual
const IRON = '#3a3a44'; // Eisenbänder der Tür
const SEAM = 0.06; // Umriss: so weit bleibt er von der Mitte der Tür weg (dort treffen sich die Flügel)

/** Eisenbänder über die Flügel, vorn und hinten */
function bands(l: Leaf, x0: number, x1: number) {
  for (const y of [0.7, 2.3, 3.9]) {
    onLeaf(l, 'solid', [x0, y, -0.33, x1, y + 0.2, -0.28], IRON);
    onLeaf(l, 'solid', [x0, y, -0.82, x1, y + 0.2, -0.77], IRON);
  }
}

/**
 * Doppeltür aus Holz mit Eisenbändern, vorn und hinten gleich, als zwei Flügel um ihre äußere Angel (die Bretter aus
 * `leaves`). Geschlossen laufen Bänder und Zeichen über beide Flügel (sie gehören zum linken, so bleibt die Tür, wie
 * sie war); offen hat jeder Flügel seine eigenen Bänder und Abstand zum Rahmen, ein Zeichen gibt es dann nicht mehr. Der
 * Umriss sitzt vorn auf beiden.
 */
export function door(glow: string, open: number, outline: boolean, lit: number): Wing[] {
  const [left, right] = leaves(open);
  if (open > 0)
    for (const l of [left, right]) {
      const outer = Math.abs(l.hinge[0]);
      if (l.side < 0) bands(l, -outer, -0.04);
      else bands(l, 0.04, outer);
    }
  else bands(left, -W + 0.05, W - 0.05);
  // Leuchtendes Zeichen der Welt in der Mitte der geschlossenen Tür (vorn und hinten)
  if (open === 0 && !outline)
    for (const z of [-0.3, -0.86]) {
      onLeaf(left, 'bright', [-0.55, 2.0, z, 0.55, 3.1, z + 0.06], glow);
      const [z0, z1] = z > -0.5 ? [z + 0.05, z + 0.09] : [z - 0.04, z];
      onLeaf(left, 'bright', [-0.3, 2.25, z0, 0.3, 2.85, z1], '#ffffff');
    }
  if (outline) penguinOutline(left, right, lit);
  return wings([left, right]);
}

/**
 * Umriss des verlaufenen Pinguins mit Goldrahmen auf der Tür, vorn und hinten wie das Zeichen (Pixel aus
 * `GUEST_OUTLINE`, je eine Lage auf dem Holz): Jedes Pixel gehört zum Flügel, auf dessen Seite es liegt, und hält
 * Abstand zur Mitte (`SEAM`). Gold ersetzt die Pixel darunter, es liegt nichts übereinander. Bis `lit` füllt er sich
 * von unten mit den Farben des Pinguins (`guestPixel`).
 */
function penguinOutline(left: Leaf, right: Leaf, lit: number) {
  const rows = GUEST_OUTLINE.length;
  GUEST_OUTLINE.forEach((row, r) => {
    [...row].forEach((_, c) => {
      const color = guestPixel(r, c, lit);
      if (!color) return;
      const [x0, x1] = [(c - row.length / 2) * GUEST_PX, (c + 1 - row.length / 2) * GUEST_PX];
      const y = GUEST_Y + (rows - 1 - r) * GUEST_PX;
      const [l, a, b] = x0 + x1 < 0 ? [left, x0, Math.min(x1, -SEAM)] : [right, Math.max(x0, SEAM), x1];
      for (const [z0, z1] of [
        [-0.35, -0.26],
        [-0.84, -0.75],
      ] as const)
        onLeaf(l, 'bright', [a, y, z0, b, y + GUEST_PX, z1], color.side, color.top);
    });
  });
}

/** Farbe eines Eiszapfens am Bogen bei `x`: Geht das Eistor auf, leuchten sie bis `lit` von links nach rechts eisblau */
export const icicle = (x: number, lit: number) => ((x + W) / (2 * W) < lit ? ICE_GLOW : ICICLE);

/**
 * Goldene Bucht vor dem Tor, solange der verlaufene Pinguin die Figur dorthin führt: ein schmaler Goldrand um die drei
 * Reihen vor der Tür, so breit wie das Tor, vorn vor dem Sockel der Türme. Er liegt je Feld knapp über dessen Boden:
 * `rise(u, t)` ist die Höhe des Felds u (−2 … 2 entlang des Tors) in Reihe t (1 … 3) gegenüber der Tormitte. Felder
 * gleicher Höhe teilen sich ein Stück Rand, an einer Stufe setzt er ab.
 */
export function goldenBay(p: Parts, rise: (u: number, t: number) => number = () => 0) {
  const [w, depth] = [0.12, 3];
  const strip = (x0: number, x1: number, z0: number, z1: number, y: number) =>
    block(p.bright, x0, y + 0.02, z0, x1, y + 0.07, z1, GOLD.side, GOLD.top);
  /** Felder `from` … `to` als Stücke gleicher Höhe: [erstes, letztes, Höhe] */
  const runs = (from: number, to: number, h: (i: number) => number) => {
    const out: [number, number, number][] = [];
    for (let i = from; i <= to; i++) {
      const last = out[out.length - 1];
      if (last && last[2] === h(i)) last[1] = i;
      else out.push([i, i, h(i)]);
    }
    return out;
  };
  const front = (t: number) => (t === 1 ? 0.85 : t - 0.5); // vordere Kante der Reihe t
  for (const [a, b, y] of runs(-2, 2, (u) => rise(u, 1))) strip(a - 0.5, b + 0.5, 0.85, 0.85 + w, y);
  for (const [a, b, y] of runs(-2, 2, (u) => rise(u, depth))) strip(a - 0.5, b + 0.5, depth + 0.5 - w, depth + 0.5, y);
  for (const [u, x0] of [
    [-2, -W],
    [2, W - w],
  ] as const)
    for (const [a, b, y] of runs(1, depth, (t) => rise(u, t)))
      strip(x0, x0 + w, a === 1 ? front(1) + w : front(a), b === depth ? depth + 0.5 - w : b + 0.5, y);
}

/** Was die Eis-Welt zum Eistor beiträgt (Haken `look` der Zugänge, mitwachsen-gate-kit.ts) */
export const gateLook: GateLook = {
  door: (open, outline, lit) => door(THEME_COLORS.eis.portal, open, outline, lit),
  icicle,
  bay: goldenBay,
  plate: ICE_FLOE, // Torplatte: Eisscholle mit eingelegter Schneeflocke (der Rand ist hellblau wie jedes Eis-Zeichen)
};
