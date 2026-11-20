import { describe, expect, it } from 'vitest';
import { hopOf } from './mitwachsen-gait';

describe('Gangart beim Gleiten', () => {
  it('Figur, Tiere der Lichtung und der Landschaft hüpfen wie bisher: ein kleiner Hüpfer je Schritt', () => {
    for (const id of ['player', 'lichtung:hase', 'wild:0:0:1'])
      for (const m of [0, 0.25, 0.5, 1]) expect(hopOf(id, m, 1e9), id).toBeCloseTo(Math.sin(m * Math.PI) * 0.14);
  });

  it('Eis-Tiere gehen je Art anders: der Fuchs springt hoch, Lemming und Robbe bleiben flach, der Pinguin wackelt', () => {
    const peak = (id: string) => Math.max(...Array.from({ length: 101 }, (_, i) => hopOf(id, i / 100, 1e9)));
    expect(peak('eis:polarfuchs')).toBeGreaterThan(peak('player'));
    expect(peak('eis:lemming:2')).toBeLessThan(peak('player'));
    expect(peak('eis:robbe')).toBeLessThan(peak('player'));
    expect(hopOf('eis:pinguin', 0.5, 1e9)).toBeCloseTo(0); // in der Mitte des Felds zwischen zwei Wacklern
    expect(peak('eis:schneeeule')).toBeGreaterThan(peak('player'));
    for (const id of ['eis:pinguin', 'eis:polarfuchs', 'eis:lemming'])
      expect([hopOf(id, 0, 1e9), hopOf(id, 1, 1e9)].map((h) => Math.abs(h) < 1e-9)).toEqual([true, true]); // am Feld landen
  });

  it('beim Singen hüpft jedes Wesen zusätzlich, 320 ms lang', () => {
    expect(hopOf('eis:walross', 0, 160)).toBeCloseTo(0.3);
    expect(hopOf('player', 0, 400)).toBe(0);
  });
});
