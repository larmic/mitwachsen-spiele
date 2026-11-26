// Bild des Rands der Lichtung (Regel: mitwachsen-rim.ts), gleich für 3D, 2D und Karte: Der Fels des Rings ist dunkler
// Schiefer mit einem Stich ins Blaue, eine Farbe, die es auf begehbarem Boden nicht gibt (Klettersteine und Hügel sind
// hellgrau bzw. grün). Die innerste Reihe ist eine dichte Hecke aus Laub mit kleinen Blüten in Rosa, Weiß und Hellgelb:
// keine roten Beeren, sie soll nicht wie der Beerenbusch aussehen, den man pflücken kann. Kein Gold.

import type { Palette } from '../../lib/voxel/textures';

export const RIM_COLORS = {
  rock: '#b4bad6', // Tönung der Steinkachel in 3D (multipliziert): Schiefer mit Stich ins Blaue
  hedge: '#4f9d49', // Tönung der Laubkachel in 3D
  blossoms: ['#f7a8d0', '#ffffff', '#ffe98a'],
  map: { rock: '#6a6f82', hedge: '#2f7d33', ice: '#2c5884' }, // `ice`: Tiefeis am Rand der Eis-Welt (worlds/eis/mitwachsen-ice-rim.ts)
} as const;
/** Farben der Steinkachel des Rings in 2D (wie `PAL_STONE`, dunkler und bläulich) */
export const PAL_RING: Palette = { S: [['#6f7589', 1]], s: [['#585e72', 1]], r: [['#858ba1', 1]] };

/**
 * Blüten auf einem Heckenfeld (x, y) mit Oberkante `h`: auf etwa jedem zweiten Feld ein bis zwei kleine Quader obenauf
 * und einer an der Seite zur Kamera, fest aus der Lage (kein Zufall je Bild). Als [x, y, unten, Breite, Tiefe, Höhe, Farbe]
 */
export function rimBlossoms(
  x: number,
  y: number,
  h: number,
): [number, number, number, number, number, number, string][] {
  const n = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 8;
  if (n > 4) return [];
  const [a, b, c] = [RIM_COLORS.blossoms[n % 3]!, RIM_COLORS.blossoms[(n + 1) % 3]!, RIM_COLORS.blossoms[(n + 2) % 3]!];
  return [
    [x + 0.18 + 0.1 * n, y + 0.22, h, 0.16, 0.16, 0.07, a],
    ...(n % 2
      ? [[x + 0.62, y + 0.6, h, 0.14, 0.14, 0.06, b] as [number, number, number, number, number, number, string]]
      : []),
    [x + 0.3 + 0.08 * n, y + 0.97, h - 0.55, 0.16, 0.06, 0.16, c],
  ];
}
