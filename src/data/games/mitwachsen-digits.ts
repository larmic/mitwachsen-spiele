// Ziffern als kleine Pixel-Zeichen für die Schilder der Halte (Issue 40): eine helle Marke mit dunkler Ziffer, 3 × 5
// Pixel, eigene Voxel-Grafik. Für alle Pakete (Bahn: Bahnhof Bär 1, Bahnhof Fledermaus 2; Grubenbahn: Funkels Halt 3):
// die Reihenfolge, in der das Kind die Halte kennenlernt. Teile wie in `front.ts` (vorn, rechts, unten, Länge, Breite,
// Höhe, Farbe), auf einer Fläche, die nach vorn schaut; von vorn gesehen liegt „rechts“ links im Bild.

import type { Part } from '../../lib/games/front';

/** Nummern der Halte auf ihren Schildern */
export const HALT_NUMBER = { baer: 1, fledermaus: 2, funkel: 3 } as const;

/** Ziffern 1 bis 9, je fünf Zeilen zu drei Pixeln (`#` gesetzt) */
export const DIGITS: Readonly<Record<number, readonly string[]>> = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '##.', '#.#', '.#.'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['.#.', '#.#', '.#.', '#.#', '.#.'],
  9: ['.#.', '#.#', '.##', '..#', '##.'],
};
export const BADGE_COLORS = { paper: '#fffdf7', ink: '#1d2838' } as const;

/**
 * Marke mit der Ziffer `n`: helles Feld (5 × 7 Pixel) bei vorn `f`, Mitte quer bei `r`, Oberkante bei `top`, je Pixel
 * `px` groß, darauf die Ziffer in dunkler Farbe
 */
export function numberBadge(n: number, f: number, r: number, top: number, px = 0.05): Part[] {
  const rows = DIGITS[n] ?? [];
  const out: Part[] = [[f, r - 2.5 * px, top - 7 * px, 0.008, 5 * px, 7 * px, BADGE_COLORS.paper]];
  rows.forEach((line, row) =>
    [...line].forEach((ch, col) => {
      if (ch === '#')
        out.push([f + 0.008, r + (0.5 - col) * px, top - (row + 2) * px, 0.008, px, px, BADGE_COLORS.ink]);
    }),
  );
  return out;
}
