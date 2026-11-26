// Offenes Dach am Zuhause (Issue 38): Solange die Figur zu Hause ist, wird das Dach des Unterstands durchscheinend
import { describe, expect, it } from 'vitest';
import { REGION_IDS } from '../../data/games/mitwachsen';
import { PILZ_OVER, ROOF_FADE, ROOF_LEFT, openRoof } from './mitwachsen-home';
import { worldOf } from './test-worlds';

const w = worldOf(1);

describe('Unterstände: Dach offen, wenn die Figur zu Hause ist', () => {
  it.each(REGION_IDS.filter((r) => w.homes[r]))(
    '%s: ganz offen bis zum Rand der Wiese, in zwei Feldern wieder dicht; um den Unterstand dieser Gegend',
    (realm) => {
      const home = w.homes[realm];
      const [bx, by] = home.bed;
      expect(w.realm(bx, by)).toBe(realm);
      const at = (d: number) => openRoof(w, bx, by + d);
      expect(at(0).open).toBe(1);
      expect(at(home.meadow).open).toBe(1);
      expect(at(home.meadow + ROOF_FADE / 2).open).toBeCloseTo(0.5);
      expect(at(home.meadow + ROOF_FADE).open).toBe(0);
      expect(at(home.meadow + ROOF_FADE + 5).open).toBe(0);
      // Mitte und Radius decken den ganzen Unterstand samt Überstand
      const { x, y, r } = at(0);
      const { x0, y0, x1, y1 } = home.shelter;
      for (const [cx, cy] of [
        [x0 - PILZ_OVER, y0 - PILZ_OVER],
        [x1 + 1 + PILZ_OVER, y1 + 1 + PILZ_OVER],
        [x0 - PILZ_OVER, y1 + 1 + PILZ_OVER],
      ])
        expect(Math.hypot(cx! - x, cy! - y)).toBeLessThan(r);
      expect(r).toBeLessThan(home.meadow + 1); // nichts außerhalb des Zuhauses wird durchscheinend
    },
  );

  it('es bleibt etwas vom Dach zu sehen, und der Pilzhut ragt nur wenig über', () => {
    expect(ROOF_LEFT).toBeGreaterThan(0.1);
    expect(ROOF_LEFT).toBeLessThanOrEqual(0.5);
    expect(PILZ_OVER).toBe(0.2);
  });
});
