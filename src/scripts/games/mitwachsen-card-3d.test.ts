// Postkarte der Torfront in 3D: Die Kamera steht vor der Tür und sieht sie, gleich was zwischen ihr und dem Tor liegt
import { describe, expect, it } from 'vitest';
import type { Point } from '../../data/games/mitwachsen';
import { DIST, LOOK, frontEye, top } from './mitwachsen-card-3d';
import { worldOf } from './test-worlds';

type Ground = { h: number; solid?: boolean };
/** Sichtlinie von der Kamera (`eye`, `DIST` vor der Tür) zur Tür: über jedem Feld davor mindestens ein Feld frei? */
function clear(cell: (x: number, y: number) => Ground, g: { mid: Point; out: Point }, eye: number) {
  const [[mx, my], [ox, oy]] = [g.mid, g.out];
  const look = cell(mx, my).h + LOOK;
  for (let k = 1; k <= DIST; k++)
    for (let u = -2; u <= 2; u++) {
      const line = look + ((eye - look) * k) / DIST;
      if (line < top(cell(mx - ox * k + oy * u, my - oy * k + ox * u)) + 1 - 1e-9) return false;
    }
  return true;
}

describe('Postkarte der Torfront (3D): Kamera vor der Tür', () => {
  const g = { mid: [0, 0] as Point, out: [0, -1] as Point }; // Tor im Norden, die Bucht nach Süden (y wächst)

  it('auf ebenem Grund 6,5 über dem Boden des Tors', () => {
    expect(frontEye({ cell: () => ({ h: 2 }) as never }, g)).toBe(8.5);
  });

  it('ein Hügel oder Fels vor dem Tor hebt sie, bis die Tür frei zu sehen ist; auch auf hohem Grund unter ihr', () => {
    for (const [at, h, solid] of [
      [10, 9, false],
      [14, 6, true],
      [15, 12, false],
      [5, 6, true],
    ] as const) {
      const cell = (x: number, y: number) => (y === at && Math.abs(x) <= 2 ? { h, solid } : { h: 1 });
      const low = clear(cell, g, 7.5);
      const eye = frontEye({ cell: cell as never }, g);
      expect(low, `Hügel bei ${at}`).toBe(false); // ohne Anheben stünde er im Bild
      expect(eye).toBeGreaterThan(7.5);
      expect(clear(cell, g, eye)).toBe(true);
    }
  });

  it('in echten Welten: vor jedem Tor ist die Tür frei zu sehen, und die Kamera bleibt nah über dem Boden', () => {
    for (const seed of [1, 2, 3]) {
      const w = worldOf(seed);
      for (const gate of w.gates.values()) {
        const eye = frontEye(w, gate);
        const floor = w.cell(...gate.mid).h;
        expect(
          clear((x, y) => w.cell(x, y), gate, eye),
          `${seed} ${gate.id}`,
        ).toBe(true);
        expect(eye - floor, `${seed} ${gate.id}`).toBeLessThan(16); // nicht hoch über allem: die Front bleibt im Bild
      }
    }
  });
});
