// Modelle von Bahnhof Fledermaus und Lokschuppen in der Grotte, nur im Paket der Bahn (Teile wie in `front.ts`: vorn,
// rechts, unten, Länge, Breite, Höhe, Farbe, oben; eigene Voxel-Grafik, keine Lore, keine Druse). Mit Bau 2 entstehen
// sie: der Bahnsteig aus lila geschichtetem Stein (in den Schichten des Höhlentors, `BANDS`), eine Stufe über dem Gleis,
// mit heller lila Kante; ein Steindach auf vier Pfosten mit Kristall-Lampen obendrauf (nur hell gefärbt, kein Licht) und
// dem Schild „Fledermaus auf Lila“ (ohne Text); daneben der Lokschuppen, vorn zum Gleis offen, hinten eine Wand aus
// demselben Stein, ein Dach mit Kristallfirst, darunter wohnt Tok (und der Siebenschläfer schläft dort). Kein Gold: Hier
// gibt es nichts zu tun.
// Spec: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 2)

import type { Part } from '../../../../lib/games/front';
import { BAT, pixels } from './mitwachsen-train-model';

/** Farben von Bahnhof Fledermaus und Lokschuppen: Schichten wie am Höhlentor, Kante und Schild lila, Kristalle */
export const BAT_COLORS = {
  bands: ['#9a8fb8', '#b0a6cc', '#8c84a8', '#c3bad9'],
  top: ['#d6d2e6', '#ccc8de'],
  edge: '#b48cf0',
  roof: ['#7d7696', '#8c84a8'],
  sign: '#b48cf0',
  crystal: ['#b48cf0', '#6fd6f0', '#f08cc8'],
  glow: '#f3ecff',
  bat: { p: '#f2a7b8', g: '#7a6a5e', k: '#1d2838', l: '#f2a7b8', w: '#8a82b0' },
} as const;

const B = BAT_COLORS;

// Eine Reihe des Bahnsteigs schaut vom Gleis weg (vorn): von −1 (Kante am Gleis) bis +1 (hinten), quer −0,5 … 0,5.
/**
 * Reihe des Bahnsteigs von Bahnhof Fledermaus: oben heller Stein mit lila Kante, zum Gleis hin die Stirnseite in drei
 * Schichten (je Reihe versetzt, so sieht man die Lagen)
 */
export const batRowParts = (odd: boolean): Part[] => [
  [-1, -0.5, 0, 2, 1, 0.04, B.top[+odd]!, B.top[+odd]!],
  [-1, -0.5, 0.04, 0.1, 1, 0.015, B.edge, B.edge],
  ...[0, 1, 2].map((k): Part => [-1.03, -0.5, -1 + k * 0.34, 0.04, 1, 0.34, B.bands[(k + +odd) % B.bands.length]!]),
];

/** Kristall-Lampe auf dem Dach: kleiner Kristall in einer Farbe mit hellem Schein obendrauf */
const lamp = (f: number, r: number, c: string): Part[] => [
  [f, r, 0, 0.14, 0.14, 0.22, c, B.glow],
  [f + 0.03, r + 0.03, 0.22, 0.08, 0.08, 0.1, B.glow, B.glow],
];

/** Steindach über zwei Reihen (Mitte in der Mitte der vier Felder) auf vier Pfosten, obendrauf drei Kristall-Lampen */
export const BAT_ROOF: readonly Part[] = [
  ...[-0.92, 0.8].flatMap((f) => [-0.92, 0.8].map((r): Part => [f, r, 0.04, 0.12, 0.12, 1.5, B.bands[0]])),
  [-1.08, -1.08, 1.54, 2.16, 2.16, 0.2, ...B.roof],
  ...lamp(-0.9, -0.07, B.crystal[0]),
  ...lamp(-0.07, -0.07, B.crystal[1]),
  ...lamp(0.76, -0.07, B.crystal[2]),
];

/** Schild auf dem Dach, zur Kamera: Fledermaus auf Lila, ohne Text */
export const BAT_SIGN: readonly Part[] = [
  [-0.03, -0.44, 0.16, 0.06, 0.88, 0.88, B.sign, B.sign],
  ...pixels(BAT, B.bat, 0.03, 0, 0.94, 0.09),
];

/**
 * Lokschuppen, Mitte in der Mitte seines Platzes, vorn zum Gleis offen: hinten die Wand aus geschichtetem Stein
 * (`depth` Felder vom Gleis weg tief, `long` lang), zwei Pfosten vorn, ein flaches Dach mit Kristallfirst
 */
export function shedParts(depth: number, long: number): Part[] {
  const [hd, hl] = [depth / 2, long / 2];
  return [
    ...[0, 1, 2, 3].map((k): Part => [hd - 1, -hl, k * 0.4, 1, long, 0.4, B.bands[k % B.bands.length]!]),
    ...[-hl, hl - 0.16].map((r): Part => [-hd + 0.04, r, 0, 0.16, 0.16, 1.6, B.bands[0]]),
    [-hd - 0.1, -hl - 0.1, 1.6, depth + 0.2, long + 0.2, 0.18, ...B.roof],
    ...[0, 1, 2].map((k): Part => [
      -0.12,
      -hl + 0.5 + (k * (long - 1.14)) / 2,
      1.78,
      0.24,
      0.14,
      0.18,
      B.crystal[k]!,
      B.glow,
    ]),
  ];
}
