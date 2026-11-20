import { describe, expect, it } from 'vitest';
import { STORIES } from '../../data/games/mitwachsen-stories';
import { gateScore } from './mitwachsen-guest-look';

describe('Töne beim Öffnen des Eistors', () => {
  const score = gateScore();
  const TAIL = 0.03; // so lange klingt ein Ton nach (`note`)

  it('Eiszapfen spielen ab 0,3 s die Eis-Melodie des Klangsteins, ab 1,2 s Rumms und Akkord; alles unter 5 s', () => {
    const melody = STORIES.eis.melody.notes.map(([f]) => f);
    expect(score.slice(0, melody.length).map(([f]) => f)).toEqual(melody);
    expect(score[0]![5]).toBeCloseTo(0.3);
    const rest = score.slice(melody.length);
    expect(rest.map(([, , , , , at]) => at)).toEqual(rest.map(() => 1.2));
    expect(rest.length).toBeLessThanOrEqual(5); // Rumms und ein Akkord aus höchstens vier Stimmen
    expect(Math.max(...score.map(([, len, , , , at]) => at + len + TAIL))).toBeLessThan(5);
  });

  it('höchstens 6 Stimmen zugleich, alle Töne in der Pentatonik C–D–E–G–A', () => {
    const PENTA = [0, 2, 4, 7, 9];
    for (const [, , , , , at] of score) {
      const sounding = score.filter(([, len, , , , from]) => from <= at + 1e-9 && at < from + len + TAIL);
      expect(sounding.length, `bei ${at.toFixed(2)} s`).toBeLessThanOrEqual(6);
    }
    for (const [hz] of score) {
      const semis = Math.round(12 * Math.log2(hz / 261.63));
      expect(PENTA, `${hz} Hz`).toContain(((semis % 12) + 12) % 12);
    }
  });
});
