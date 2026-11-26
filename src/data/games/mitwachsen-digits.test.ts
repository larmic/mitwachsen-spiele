// Ziffern auf den Schildern der Halte (Issue 40)
import { describe, expect, it } from 'vitest';
import { BADGE_COLORS, DIGITS, HALT_NUMBER, numberBadge } from './mitwachsen-digits';
import { SIGN } from './worlds/bahn/mitwachsen-train-model';
import { BAT_SIGN } from './worlds/bahn/mitwachsen-bat-model';
import { HALT_SIGN } from './worlds/grube/mitwachsen-funkel-model';

describe('Ziffern auf den Schildern', () => {
  it('neun Ziffern, je fünf Zeilen zu drei Pixeln, alle verschieden', () => {
    expect(Object.keys(DIGITS).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const rows of Object.values(DIGITS)) {
      expect(rows).toHaveLength(5);
      for (const line of rows) expect(line).toMatch(/^[.#]{3}$/);
    }
    expect(new Set(Object.values(DIGITS).map((r) => r.join('|'))).size).toBe(9);
  });

  it('die Marke: helles Feld, darauf die Ziffer dunkel und ganz innerhalb; unbekannte Zahl: nur das Feld', () => {
    const [paper, ...ink] = numberBadge(3, 0.1, 0, 1, 0.05);
    expect(paper![6]).toBe(BADGE_COLORS.paper);
    [0.1, -0.125, 0.65, 0.008, 0.25, 0.35].forEach((v, i) => expect(paper![i]).toBeCloseTo(v));
    expect(ink).toHaveLength(DIGITS[3]!.join('').replaceAll('.', '').length);
    for (const [f, r, z, , w, h, color] of ink) {
      expect(color).toBe(BADGE_COLORS.ink);
      expect(f).toBeGreaterThan(paper![0]); // vor dem Feld
      expect(r).toBeGreaterThanOrEqual(paper![1] - 1e-9);
      expect(r + w).toBeLessThanOrEqual(paper![1] + paper![4] + 1e-9);
      expect(z).toBeGreaterThanOrEqual(paper![2] - 1e-9);
      expect(z + h).toBeLessThanOrEqual(paper![2] + paper![5] + 1e-9);
    }
    expect(numberBadge(0, 0, 0, 1)).toHaveLength(1);
  });

  it('Bahnhof Bär trägt die 1, Bahnhof Fledermaus die 2, Funkels Halt die 3; jede Marke liegt auf ihrer Tafel', () => {
    expect(HALT_NUMBER).toEqual({ baer: 1, fledermaus: 2, funkel: 3 });
    for (const [sign, n] of [
      [SIGN, 1],
      [BAT_SIGN, 2],
      [HALT_SIGN, 3],
    ] as const) {
      const papers = sign.filter((p) => p[6] === BADGE_COLORS.paper);
      expect(papers).toHaveLength(1);
      const ink = sign.filter((p) => p[6] === BADGE_COLORS.ink && p[0] > papers[0]![0]); // vor der Marke: die Ziffer
      expect(ink).toHaveLength(DIGITS[n]!.join('').replaceAll('.', '').length);
      // die Tafel: das größte flache Teil des Schilds
      const board = [...sign].sort((a, b) => b[4] * b[5] - a[4] * a[5])[0]!;
      const [, r, z, , w, h] = papers[0]!;
      expect(r).toBeGreaterThanOrEqual(board[1] - 1e-9);
      expect(r + w).toBeLessThanOrEqual(board[1] + board[4] + 1e-9);
      expect(z).toBeGreaterThanOrEqual(board[2] - 1e-9);
      expect(z + h).toBeLessThanOrEqual(board[2] + board[5] + 1e-9);
    }
  });
});
