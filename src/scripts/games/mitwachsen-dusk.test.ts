import { describe, expect, it } from 'vitest';
import { DUSK_DAY, DUSK_NIGHT, dayOf, nightIn, nightMix, sunLevel, type Rgb } from './mitwachsen-dusk';
import { MOOD_LIGHT, REGIONS } from '../../data/games/mitwachsen';

const lum = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const NIGHT: Rgb = [0.01, 0.02, 0.05];
const DUSK: Rgb = [0.1, 0.15, 0.25];

describe('Nie dunkler als die Dämmerung (mitwachsen-dusk.ts)', () => {
  it('Dämmerung: Nacht 0,8 heißt Tageslicht 0,4', () => {
    expect(DUSK_NIGHT).toBeCloseTo(0.8);
    expect(dayOf(DUSK_NIGHT)).toBeCloseTo(DUSK_DAY);
  });

  it('die Nacht wird nur in der Grotte gedeckelt', () => {
    expect(nightIn('lichtung', 1)).toBe(1);
    expect(nightIn('eis', 1)).toBe(1);
    expect(nightIn('hoehle', 1)).toBe(REGIONS.find((r) => r.id === 'hoehle')!.night);
    expect(dayOf(nightIn('hoehle', 1))).toBeGreaterThanOrEqual(DUSK_DAY - 1e-9);
    expect(nightIn('hoehle', 0.3)).toBe(0.3);
  });

  it('Sonne: in der Grotte nie unter 0,4, auch wenn ihre Stimmung dämpft; sonst Tageslicht mal Stimmung', () => {
    const dim = 1 + (MOOD_LIGHT.hoehle!.bright - 1) * 0.4; // so gewichtet die 3D-Ansicht die Stimmung ganz nah
    expect(dim).toBeLessThan(1);
    for (const n of [0, 0.4, 0.8, 1])
      expect(sunLevel('hoehle', nightIn('hoehle', n), dim)).toBeGreaterThanOrEqual(DUSK_DAY);
    expect(sunLevel('hoehle', 0, 1)).toBe(1);
    expect(sunLevel('lichtung', 1, 1)).toBeCloseTo(0.25);
    expect(sunLevel('lichtung', 0.8, dim)).toBeCloseTo(0.4 * dim);
  });

  it('Himmel: in der Grotte nur so weit zur Nacht, dass er nicht dunkler wird als die Dämmerung', () => {
    const bright: Rgb = [0.4, 0.35, 0.6];
    const t = nightMix('hoehle', 0.8, bright, NIGHT, DUSK);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(0.8);
    expect(lum(mix(bright, NIGHT, t))).toBeCloseTo(lum(DUSK));
    expect(nightMix('hoehle', 0.05, bright, NIGHT, DUSK)).toBe(0.05); // wenig Nacht: wie sie ist
    expect(nightMix('hoehle', 0.8, [0.05, 0.05, 0.05], NIGHT, DUSK)).toBe(0); // schon dunkler: gar nicht
    expect(nightMix('lichtung', 0.8, bright, NIGHT, DUSK)).toBe(0.8);
  });
});
