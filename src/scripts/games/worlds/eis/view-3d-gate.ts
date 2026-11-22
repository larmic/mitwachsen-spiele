// Das Eistor in 3D, soweit es zur Eis-Welt gehört (im 3D-Teil ihres Welt-Pakets, mit ihm nachgeladen): Beschläge und
// Zeichen der Doppeltür, der Umriss des verlaufenen Pinguins darauf, der sich beim Öffnen füllt, das Leuchten der
// Eiszapfen im Ritual und die Torplatte als Eisscholle mit Schneeflocke (ihren goldenen Rand, solange er die Figur
// dorthin führt, legt die 3D-Ansicht an). Den Zugang selbst (Schlucht, Bogen, Orgel) und die schlichten Türbretter
// baut der Kern (mitwachsen-gate-eis.ts, mitwachsen-gatehouse.ts).
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“, Abschnitt „Welt-Pakete“)

import { THEME_COLORS } from '../../../../data/games/mitwachsen';
import { ICE_FLOE } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import type { GateLook } from '../../mitwachsen-gate-kit';
import { W, leaves, onLeaf, wings, type Leaf, type Wing } from '../../mitwachsen-gatehouse';
import { GUEST_OUTLINE, GUEST_PX, GUEST_Y, PRE_FILL, guestPixel } from '../../mitwachsen-guest-look';

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

/** Wie weit die Eiszapfen leuchten (0 … 1, darunter nichts) bei `lit` aus `ritualGlow`: erst ab 0,3 s im Ritual */
export const iceGlow = (lit: number) => (lit - PRE_FILL) / (1 - PRE_FILL);

/**
 * Farbe eines Eiszapfens am Bogen bei `x`: Geht das Eistor auf, leuchten sie von links nach rechts eisblau, bis
 * `iceGlow(lit)` (im Vorspiel noch keiner)
 */
export const icicle = (x: number, lit: number) => ((x + W) / (2 * W) < iceGlow(lit) ? ICE_GLOW : ICICLE);

/** Was die Eis-Welt zum Eistor beiträgt (Haken `look` der Zugänge, mitwachsen-gate-kit.ts) */
export const gateLook: GateLook = {
  door: (open, outline, lit) => door(THEME_COLORS.eis.portal, open, outline, lit),
  icicle,
  plate: ICE_FLOE, // Torplatte: Eisscholle mit eingelegter Schneeflocke (der Rand ist hellblau wie jedes Eis-Zeichen)
};
