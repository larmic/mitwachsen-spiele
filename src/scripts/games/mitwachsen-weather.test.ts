import { describe, expect, it } from 'vitest';
import { hash } from '../../lib/games/rng';
import {
  BLOCK,
  FADE,
  GUST,
  RAINBOW,
  SPARKLE,
  gustAt,
  gustOf,
  kindOf,
  raining,
  sheltering,
  weatherLook,
  windAt,
  windy,
} from './mitwachsen-weather';

const CALM = { cloud: 0, rain: 0, rainbow: 0, snow: 0, wind: 0, gust: 0, sparkle: 0 };

describe('Wetter', () => {
  it('jeder Tag beginnt mit Sonne; danach gibt es Sonne, Wolken und Regen, gleich bei gleichem Seed und Tag', () => {
    const kinds = new Set<string>();
    for (let day = 0; day < 20; day++) {
      expect(kindOf(4, day, 0)).toBe('sun');
      for (let b = 1; b < 12; b++) {
        kinds.add(kindOf(4, day, b));
        expect(kindOf(4, day, b)).toBe(kindOf(4, day, b));
      }
    }
    expect([...kinds].sort()).toEqual(['clouds', 'rain', 'sun']);
  });

  it('regnet genau in Regen-Abschnitten', () => {
    for (let b = 0; b < 30; b++) expect(raining(9, 2, b * BLOCK + 10)).toBe(kindOf(9, 2, b) === 'rain');
  });

  it('wechselt weich: zu Beginn eines Abschnitts noch wie davor, nach dem Übergang wie jetzt', () => {
    for (let b = 1; b < 30; b++) {
      const before = weatherLook(9, 2, b * BLOCK - 1);
      const start = weatherLook(9, 2, b * BLOCK);
      expect(Math.abs(start.cloud - before.cloud)).toBeLessThan(0.01);
      expect(Math.abs(start.rain - before.rain)).toBeLessThan(0.01);
      const settled = weatherLook(9, 2, b * BLOCK + FADE);
      expect(settled.rain).toBe(kindOf(9, 2, b) === 'rain' ? 1 : 0);
      for (const v of Object.values(weatherLook(9, 2, b * BLOCK + 77))) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('nach dem Regen steht eine Weile ein Regenbogen, sonst nie', () => {
    let seen = 0;
    for (let day = 0; day < 10; day++)
      for (let b = 1; b < 12; b++) {
        const afterRain = kindOf(3, day, b) === 'sun' && kindOf(3, day, b - 1) === 'rain';
        const mid = weatherLook(3, day, b * BLOCK + RAINBOW / 2).rainbow;
        if (afterRain) {
          expect(mid).toBe(1);
          seen++;
        } else expect(mid).toBe(0);
        expect(weatherLook(3, day, b * BLOCK + RAINBOW + 1).rainbow).toBe(0);
      }
    expect(seen).toBeGreaterThan(0);
  });

  it('Wind: überall eine leichte Brise, am stärksten Richtung Wolken, bei Regen mehr', () => {
    expect(windAt({ id: 'eis', strength: 0 }, CALM)).toBeCloseTo(0.15);
    expect(windAt({ id: 'wolken', strength: 1 }, CALM)).toBeGreaterThan(windAt({ id: 'wald', strength: 1 }, CALM));
    expect(windAt({ id: 'eis', strength: 0 }, { ...CALM, cloud: 1, rain: 1 })).toBeGreaterThan(0.5);
    expect(windAt({ id: 'wolken', strength: 1 }, { ...CALM, cloud: 1, rain: 1 })).toBeGreaterThan(0.9);
  });

  it('Pustewind: Wind und Böen wehen kräftig, nie mehr als 1', () => {
    const breeze = windAt({ id: 'eis', strength: 1 }, { ...CALM, cloud: 0.2, wind: 1 });
    expect(breeze).toBeGreaterThan(0.6);
    expect(windAt({ id: 'eis', strength: 1 }, { ...CALM, cloud: 0.2, wind: 1, gust: 1 })).toBeGreaterThan(breeze);
    expect(windAt({ id: 'wolken', strength: 1 }, { ...CALM, cloud: 1, rain: 1, wind: 1, gust: 1 })).toBe(1);
  });
});

/** So würfelte die Lichtung ihr Wetter vor der Eis-Welt (Vergleich: Die Reihe der Lichtung bleibt genau gleich) */
const before = (seed: number, day: number, block: number) => {
  if (block <= 0) return 'sun';
  const roll = hash(seed, day, block, 31) % 4;
  return roll < 2 ? 'sun' : roll === 2 ? 'clouds' : 'rain';
};

describe('Wetter je Gegend', () => {
  it('Lichtung: dieselbe Wetterreihe wie bisher, ohne Schnee, Wind und Glitzerluft', () => {
    for (const seed of [1, 42, 2026, 0xdeadbeef])
      for (let day = 0; day < 15; day++)
        for (let b = 0; b < 25; b++) {
          expect(kindOf(seed, day, b)).toBe(before(seed, day, b));
          expect(kindOf(seed, day, b, 'lichtung', false)).toBe(before(seed, day, b));
          const look = weatherLook(seed, day, b * BLOCK + ((b * 337) % BLOCK));
          expect([look.snow, look.wind, look.gust, look.sparkle]).toEqual([0, 0, 0, 0]);
          expect(sheltering(seed, day, b * BLOCK + 5, 'lichtung')).toBe(before(seed, day, b) === 'rain');
        }
  });

  it('Eis: nie Regen, nie Wolken – Sonne, leiser Schneefall und Pustewind', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 20; seed++)
      for (let day = 0; day < 10; day++)
        for (let b = 0; b < 20; b++) {
          kinds.add(kindOf(seed, day, b, 'eis'));
          const look = weatherLook(seed, day, b * BLOCK + 1234, 'eis');
          expect(look.rain).toBe(0);
          expect(look.rainbow).toBe(0);
          expect(look.cloud).toBeLessThanOrEqual(0.2); // höchstens leicht milchig, nie dunkel
        }
    expect([...kinds].sort()).toEqual(['snow', 'sun', 'wind']);
  });

  it('Eis: erster Abschnitt jedes Tages ist sonnig', () => {
    for (let day = 0; day < 30; day++) {
      expect(kindOf(7, day, 0, 'eis')).toBe('sun');
      expect(weatherLook(7, day, BLOCK - 1, 'eis')).toEqual(CALM);
    }
  });

  it('Pustewind etwa 25 %, Schneefall etwa 25 %, und Schutz suchen die Tiere der Eis-Welt nur beim Wind', () => {
    const count = { sun: 0, snow: 0, wind: 0 } as Record<string, number>;
    let n = 0;
    for (let seed = 0; seed < 40; seed++)
      for (let day = 0; day < 10; day++)
        for (let b = 1; b < 25; b++) {
          const kind = kindOf(seed, day, b, 'eis');
          count[kind] = (count[kind] ?? 0) + 1;
          n++;
          expect(windy(seed, day, b * BLOCK + 9)).toBe(kind === 'wind');
          expect(sheltering(seed, day, b * BLOCK + 9, 'eis')).toBe(kind === 'wind');
        }
    expect(count.wind! / n).toBeGreaterThan(0.2);
    expect(count.wind! / n).toBeLessThan(0.3);
    expect(count.snow! / n).toBeGreaterThan(0.2);
    expect(count.snow! / n).toBeLessThan(0.3);
    expect(count.sun! / n).toBeGreaterThan(0.45);
  });

  it('kein Pustewind, bevor der Pinguin zu Hause ist: an seiner Stelle scheint die Sonne', () => {
    for (let day = 0; day < 10; day++)
      for (let b = 0; b < 25; b++) {
        const kind = kindOf(3, day, b, 'eis');
        expect(kindOf(3, day, b, 'eis', false)).toBe(kind === 'wind' ? 'sun' : kind);
        expect(windy(3, day, b * BLOCK + 50, false)).toBe(false);
        expect(sheltering(3, day, b * BLOCK + 50, 'eis', false)).toBe(false);
        const look = weatherLook(3, day, b * BLOCK + 1500, 'eis', false);
        expect([look.wind, look.gust, look.sparkle]).toEqual([0, 0, 0]);
      }
  });

  it('Böen deterministisch: je Fenster genau eine, 6 bis 10 s lang, alle 25 bis 40 s', () => {
    let last = -Infinity;
    for (let w = 0; w < 200; w++) {
      const { start, len } = gustOf(5, 2, w * GUST + 17);
      expect(gustOf(5, 2, w * GUST + GUST - 1)).toEqual({ start, len }); // dasselbe Fenster, dieselbe Böe
      expect(len).toBeGreaterThanOrEqual(60);
      expect(len).toBeLessThanOrEqual(100);
      expect(start).toBeGreaterThanOrEqual(w * GUST);
      expect(start + len).toBeLessThanOrEqual((w + 1) * GUST);
      if (w > 0) {
        expect(start - last).toBeGreaterThanOrEqual(250);
        expect(start - last).toBeLessThanOrEqual(400);
      }
      last = start;
      expect(gustAt(5, 2, start - 1)).toBe(0);
      expect(gustAt(5, 2, start + Math.floor(len / 2))).toBeGreaterThan(0.95); // Spitze in der Mitte
      expect(gustAt(5, 2, start + len)).toBe(0);
    }
  });

  it('Böen gibt es nur im Pustewind; er weht weich an und ab', () => {
    for (let b = 1; b < 40; b++) {
      const wind = kindOf(11, 1, b, 'eis') === 'wind';
      let peak = 0;
      for (let t = b * BLOCK + FADE; t < (b + 1) * BLOCK; t += 7) {
        const look = weatherLook(11, 1, t, 'eis');
        expect(look.wind).toBe(wind ? 1 : 0);
        expect(look.gust).toBeCloseTo(wind ? gustAt(11, 1, t) : 0);
        peak = Math.max(peak, look.gust);
      }
      if (wind) expect(peak).toBeGreaterThan(0.9);
      const start = weatherLook(11, 1, b * BLOCK, 'eis').wind;
      expect(Math.abs(start - weatherLook(11, 1, b * BLOCK - 1, 'eis').wind)).toBeLessThan(0.01);
    }
  });

  it('Glitzerluft nach dem Wind: 1,5 Minuten, sonst nie', () => {
    let seen = 0;
    for (let day = 0; day < 15; day++)
      for (let b = 1; b < 15; b++) {
        const afterWind = kindOf(8, day, b, 'eis') !== 'wind' && kindOf(8, day, b - 1, 'eis') === 'wind';
        const mid = weatherLook(8, day, b * BLOCK + SPARKLE / 2, 'eis').sparkle;
        if (afterWind) {
          expect(mid).toBe(1);
          seen++;
        } else expect(mid).toBe(0);
        expect(weatherLook(8, day, b * BLOCK + SPARKLE + 1, 'eis').sparkle).toBe(0);
      }
    expect(seen).toBeGreaterThan(0);
  });
});
