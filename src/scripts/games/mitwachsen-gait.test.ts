import { describe, expect, it } from 'vitest';
import { NIBBLE_EVERY, SNAP_DELAY, hopOf, nibblers, snaps } from './mitwachsen-gait';

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

  it('Fischfresser machen beim Füttern mit Fisch einen kurzen Schnapp-Hüpfer; Moosfresser und Tiere der Lichtung nicht', () => {
    const fish = (id: string) => snaps(id, 'fish');
    expect(['eis:pinguin', 'eis:robbe:2', 'eis:eisbaer', 'eis:polarfuchs'].every(fish)).toBe(true);
    expect(['eis:rentier', 'eis:moschusochse', 'eis:lemming', 'lichtung:hase', 'player'].some(fish)).toBe(false);
    expect(SNAP_DELAY).toBeGreaterThan(0);
    expect(hopOf('eis:pinguin', 0, 1e9, 90)).toBeGreaterThan(0.1); // mitten im Schnapp-Hüpfer
    expect(hopOf('eis:pinguin', 0, 1e9, -50)).toBe(0); // noch nicht dran
    expect(hopOf('eis:pinguin', 0, 1e9, 400)).toBe(0); // vorbei
  });

  it('in der Grotte naschen die Pilzfresser beim Füttern mit Pilzen, die Moosfresser am Tropfmoos, wenn Wasser in den Trog kommt', () => {
    const shrooms = ['hoehle:maulwurf', 'hoehle:dachs:1', 'hoehle:siebenschlaefer', 'hoehle:murmeltier:3'];
    const moss = ['hoehle:grottenolm', 'hoehle:eidechse:2', 'hoehle:fledermaus', 'hoehle:gluehwuermchen'];
    expect(shrooms.every((id) => snaps(id, 'pilze'))).toBe(true);
    expect(moss.some((id) => snaps(id, 'pilze'))).toBe(false);
    expect(moss.every((id) => snaps(id, 'water'))).toBe(true);
    expect(shrooms.some((id) => snaps(id, 'water'))).toBe(false);
    // jedes Tier nascht genau bei einem Futter; Beeren und Wasser auf Lichtung und Schneewiese bleiben ohne Schnappen
    for (const id of [...shrooms, ...moss])
      expect([snaps(id, 'pilze'), snaps(id, 'water')].filter(Boolean)).toHaveLength(1);
    expect([...shrooms, ...moss, 'eis:pinguin', 'lichtung:hase'].some((id) => snaps(id, 'berries'))).toBe(false);
    expect(['eis:rentier', 'eis:pinguin', 'lichtung:hase', 'player'].some((id) => snaps(id, 'water'))).toBe(false);
  });

  it('Moosfresser naschen selbst: zu Hause und neben Tropfmoos alle NIBBLE_EVERY Takte, je Tier versetzt, nachts nicht', () => {
    const moss = new Set(['5,0']); // Tropfmoos bei (5, 0); bei (9, 0) ein Sitzplatz der Fledermaus
    const cell = (x: number, y: number) => ({
      deco: moss.has(`${x},${y}`) ? 'dripmoss' : null,
      perch: x === 9 && y === 1 ? 2 : undefined,
    });
    const animals = [
      { id: 'hoehle:grottenolm', x: 0, y: 9, mode: 'home' }, // zu Hause
      { id: 'hoehle:eidechse:2', x: 4, y: 0, mode: 'wander' }, // unterwegs neben dem Tropfmoos
      { id: 'hoehle:gluehwuermchen', x: 20, y: 20, mode: 'wander' }, // unterwegs, kein Moos in der Nähe
      { id: 'hoehle:fledermaus', x: 9, y: 1, mode: 'wander' }, // hängt kopfüber, auch wenn dort Moos wäre
      { id: 'hoehle:maulwurf', x: 0, y: 8, mode: 'home' }, // Pilzfresser: nascht kein Moos
      { id: 'eis:pinguin', x: 5, y: 1, mode: 'home' },
    ];
    moss.add('10,1');
    const counts = new Map<string, number[]>();
    for (let tick = 0; tick < NIBBLE_EVERY * 4; tick++)
      for (const id of nibblers({ tick, sleeping: false, animals }, cell))
        counts.set(id, [...(counts.get(id) ?? []), tick]);
    expect([...counts.keys()].sort()).toEqual(['hoehle:eidechse:2', 'hoehle:grottenolm']);
    for (const ticks of counts.values()) {
      expect(ticks).toHaveLength(4); // ohne Zutun des Kinds, in gleichem Abstand
      expect(ticks.slice(1).map((t, i) => t - ticks[i]!)).toEqual([NIBBLE_EVERY, NIBBLE_EVERY, NIBBLE_EVERY]);
    }
    expect(counts.get('hoehle:grottenolm')![0]).not.toBe(counts.get('hoehle:eidechse:2')![0]); // versetzt
    const all = Array.from({ length: NIBBLE_EVERY }, (_, tick) => nibblers({ tick, sleeping: true, animals }, cell));
    expect(all.flat()).toEqual([]); // nachts schläft auch der Appetit
  });

  it('beim Singen hüpft jedes Wesen zusätzlich, 320 ms lang', () => {
    expect(hopOf('eis:walross', 0, 160)).toBeCloseTo(0.3);
    expect(hopOf('player', 0, 400)).toBe(0);
  });
});
