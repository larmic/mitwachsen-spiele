import { describe, expect, it } from 'vitest';
import {
  BEDTIME,
  GoodNights,
  LATE_EVENING,
  bedtime,
  dueTones,
  endsBedtime,
  lightsOut,
  rideLight,
} from './mitwachsen-bedtime';
import type { Scored } from './sfx';

const tone = (at: number, len = 0.2): Scored => [880, len, 'sine', 0.03, 1, at];

describe('„Gute Nacht, Fahrzeuge“ (mitwachsen-bedtime.ts)', () => {
  it('nach dem Schlaflied nacheinander, mit kleiner Pause; jedes Licht geht aus, wenn sein letzter Ton verklingt', () => {
    const b = bedtime([
      { id: 'hoehle', score: [tone(0), tone(0.5)] },
      { id: 'schlitten', score: [tone(0, 0.3)] },
    ]);
    expect(b.tones.map((n) => n[5])).toEqual([BEDTIME.from, BEDTIME.from + 0.5, BEDTIME.from + 0.7 + BEDTIME.gap]);
    expect(b.off.hoehle).toBeCloseTo(BEDTIME.from + 0.7);
    expect(b.off.schlitten).toBeCloseTo(BEDTIME.from + 0.7 + BEDTIME.gap + 0.3);
    expect(bedtime([])).toEqual({ tones: [], off: {} });
  });

  it('zusammen höchstens 4 s: wer nicht mehr hineinpasst, macht still am Ende sein Licht aus', () => {
    const b = bedtime([
      { id: 'hoehle', score: [tone(0, 3.5)] },
      { id: 'schlitten', score: [tone(0, 1)] },
    ]);
    expect(b.tones).toHaveLength(1);
    expect(b.off.schlitten).toBe(BEDTIME.from + BEDTIME.max);
    expect(Math.max(...b.tones.map((n) => n[5] + n[1]))).toBeLessThanOrEqual(BEDTIME.from + BEDTIME.max);
    expect(BEDTIME.max).toBe(4);
  });

  it('Töne kommen im Takt der Bilder (sofort, wenn ihre Zeit da ist), jede Taste beendet es: keine Töne mehr, alle Lichter aus', () => {
    const b = bedtime([
      { id: 'hoehle', score: [tone(0), tone(0.5)] },
      { id: 'schlitten', score: [tone(0)] },
    ]);
    expect(dueTones(b, 0, BEDTIME.from)).toEqual([]);
    expect(dueTones(b, 0, BEDTIME.from + 0.1)).toEqual([[880, 0.2, 'sine', 0.03, 1, 0]]);
    expect(dueTones(b, BEDTIME.from + 0.1, BEDTIME.from + 0.6)).toHaveLength(1);
    expect(dueTones(b, 0, 10, true)).toEqual([]);
    expect(lightsOut(b, 0)).toEqual([]);
    expect(lightsOut(b, BEDTIME.from + 0.75)).toEqual(['hoehle']);
    expect(lightsOut(b, 10)).toEqual(['hoehle', 'schlitten']);
    expect(lightsOut(b, 0, true)).toEqual(['hoehle', 'schlitten']);
  });
});

describe('Gute Nacht in der Spielseite (`GoodNights`)', () => {
  it('spielt jeden Ton einmal, sobald seine Zeit da ist; eine Taste beendet es, Aufwachen macht alles wieder hell', () => {
    const n = new GoodNights();
    expect(n.tones(5)).toEqual([]);
    expect(n.out(5)).toEqual([]);
    n.start([{ id: 'hoehle', score: [tone(0), tone(0.5)] }]);
    expect(n.tones(BEDTIME.from + 0.1)).toHaveLength(1);
    expect(n.tones(BEDTIME.from + 0.1)).toEqual([]); // schon gespielt
    expect(n.out(BEDTIME.from + 0.1)).toEqual([]);
    n.end(); // eine Taste
    expect(n.tones(BEDTIME.from + 1)).toEqual([]);
    expect(n.out(BEDTIME.from + 0.2)).toEqual(['hoehle']);
    n.stop(); // aufgewacht
    expect(n.out(10)).toEqual([]);
    n.start([{ id: 'schlitten', score: [tone(0)] }]); // die nächste Nacht beginnt von vorn
    expect(n.tones(BEDTIME.from + 0.1)).toHaveLength(1);
  });
});

describe('verpasste Töne, Tasten und Licht der Fahrzeuge', () => {
  it('bleiben Bilder aus, fallen verpasste Töne weg, statt danach als Akkord zu klingen', () => {
    const n = new GoodNights();
    n.start([
      { id: 'hoehle', score: [tone(0), tone(0.5)] },
      { id: 'schlitten', score: [tone(0, 0.3)] },
    ]);
    expect(n.tones(0)).toEqual([]);
    expect(n.tones(10)).toEqual([]); // der Tab lag im Hintergrund: alles verpasst, nichts auf einmal
    expect(n.tones(11)).toEqual([]);
    const b = bedtime([{ id: 'hoehle', score: [tone(0), tone(0.5)] }]);
    expect(dueTones(b, 0, BEDTIME.from + 0.6)).toHaveLength(1); // nur der zweite (der erste ist zu lange vorbei)
    expect(dueTones(b, 0, BEDTIME.from + BEDTIME.stale - 0.01)).toHaveLength(1); // knapp verspätet: klingt noch
  });

  it('jede Taste beendet „Gute Nacht“: Pfeil, Antippen und Leertaste, solange die Figur schläft; ein Takt nicht', () => {
    expect(endsBedtime({ type: 'move', dir: 'n' }, true)).toBe(true);
    expect(endsBedtime({ type: 'move', dir: 'w', tap: true, fresh: true }, true)).toBe(true);
    expect(endsBedtime({ type: 'action' }, true)).toBe(true);
    expect(endsBedtime({ type: 'tick' }, true)).toBe(false);
    expect(endsBedtime({ type: 'action' }, false)).toBe(false); // wach: nichts zu beenden
  });

  it('warmes Licht ab 20 min (Abend > 0), Lampen erst gut abendlich, beides immer nachts; `late` zählt mindestens 0,6', () => {
    expect(rideLight(0, 0, false, false)).toEqual({ evening: 0, lit: false, warm: false });
    expect(rideLight(0, 0.1, false, false)).toEqual({ evening: 0.1, lit: false, warm: true });
    expect(rideLight(0, 0.5, false, false)).toEqual({ evening: 0.5, lit: true, warm: true });
    expect(rideLight(0.8, 0, false, false)).toEqual({ evening: 0, lit: true, warm: true });
    expect(rideLight(0, 0, false, true)).toEqual({ evening: LATE_EVENING, lit: true, warm: true });
    expect(rideLight(0, 0.9, false, true).evening).toBe(0.9);
    expect(rideLight(0, 0.9, true, true)).toEqual({ evening: 0, lit: false, warm: false }); // schläft: Bild ohne Abend
    expect(rideLight(0.8, 0.9, true, false)).toMatchObject({ lit: true, warm: true });
  });
});
