// Dauer einer Fahrt (Fahr-Engine, mitwachsen-ride.ts): immer 15–20 s, das Tempo des Zugs ist sein Höchsttempo
import { describe, expect, it } from 'vitest';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import { rideTicks } from './mitwachsen-ride';

const [SLED, TRAIN] = [RIDES.find((r) => r.id === 'schlitten')!, RIDES.find((r) => r.id === 'hoehle')!];

describe('Dauer einer Fahrt (rideTicks)', () => {
  it('Schlitten: Länge × 1,5 Takte, in 15–20 s gehalten', () => {
    expect(rideTicks(SLED, 40)).toBe(150);
    expect(rideTicks(SLED, 120)).toBe(180);
    expect(rideTicks(SLED, 400)).toBe(200);
  });

  it('Zug: höchstens 8 Felder je Sekunde, eine kurze Strecke (Prellbock in der Bucht) fährt langsamer und dauert doch 15 s', () => {
    expect(TRAIN.pace).toBe(0.8);
    for (const len of [20, 63, 91, 120, 140, 165, 300]) {
      const t = rideTicks(TRAIN, len);
      expect(t, `${len} Felder`).toBeGreaterThanOrEqual(150);
      expect(t, `${len} Felder`).toBeLessThanOrEqual(200);
      if (len / TRAIN.pace! >= 150 && len / TRAIN.pace! <= 200) expect(t).toBe(Math.round(len / TRAIN.pace!));
    }
    expect(63 / rideTicks(TRAIN, 63)).toBeLessThan(0.5); // gut 4 Felder je Sekunde bis zum Prellbock
  });
});
