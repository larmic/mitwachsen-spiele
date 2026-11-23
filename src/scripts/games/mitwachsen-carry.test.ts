import { describe, expect, it } from 'vitest';
import { BASKET_PARTS, BUCKET_PARTS } from '../../data/games/mitwachsen';
import { FISH_PARTS } from '../../data/games/mitwachsen-eis';
import { JUG_PARTS, SHROOM_BASKET_PARTS } from '../../data/games/mitwachsen-hoehle';
import { carried, carryKey } from './mitwachsen-carry';

const none = { basket: false, shrooms: false, bucket: false, fish: false };

describe('Was die Figur trägt', () => {
  it('Korb mit Beeren oder mit Leuchtpilzen, Eimer (in der Grotte Kanne) und Netz; mit leeren Händen nichts', () => {
    expect(carried(none, false)).toEqual([]);
    expect(carried({ ...none, basket: true }, true)).toEqual(BASKET_PARTS);
    expect(carried({ ...none, shrooms: true }, true)).toEqual(SHROOM_BASKET_PARTS);
    expect(carried({ ...none, bucket: true }, false)).toEqual(BUCKET_PARTS);
    expect(carried({ ...none, bucket: true }, true)).toEqual(JUG_PARTS); // Tropfwasser trägt sie in der Kanne
    expect(carried({ basket: true, shrooms: false, bucket: true, fish: true }, false)).toEqual([
      ...BASKET_PARTS,
      ...BUCKET_PARTS,
      ...FISH_PARTS,
    ]);
  });

  it('jede Kombination hat ihren eigenen Schlüssel für das Modell in 3D', () => {
    // der Korb trägt nur eine Sorte; ohne Wasser sieht die Figur in der Grotte aus wie draußen
    const baskets = [{}, { basket: true }, { shrooms: true }];
    const water = [{ cave: false }, { bucket: true, cave: false }, { bucket: true, cave: true }];
    const keys = new Set(
      baskets.flatMap((b) =>
        water.flatMap(({ cave, ...w }) => [false, true].map((fish) => carryKey({ ...none, ...b, ...w, fish }, cave))),
      ),
    );
    expect(keys.size).toBe(3 * 3 * 2);
    expect(carryKey(none, true)).toBe('');
  });
});
