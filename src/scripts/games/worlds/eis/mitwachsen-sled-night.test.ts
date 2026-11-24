// Gute Nacht des Schlittens (Schritt 13 der Bahn, „Gute Nacht, Fahrzeuge“): leise Schellen und die Laterne aus, wenn die
// Figur im Lichtungsbett schläft und der Schlitten in Sichtweite steht
import { describe, expect, it } from 'vitest';
import { withRide } from '../../mitwachsen-ride-save';
import type { RideAt } from '../../mitwachsen-ride-view';
import { initialState, type State } from '../../mitwachsen-state';
import { EIS_PACK, worldOf } from '../../test-worlds';
import { SLED_NIGHT, sledGoodNight } from './mitwachsen-sled-look';
import { view as iceView } from './view-2d';

const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const PENTA = new Set([0, 2, 4, 7, 9]);
const semis = (hz: number) => ((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12;

describe('Gute Nacht des Schlittens', () => {
  const SLED_HOME = withRide({}, 'schlitten', 'fest');
  const W = worldOf(1, [EIS_PACK]);
  const bed = W.homes.lichtung.bed;
  const asleep = (packs: Record<string, unknown> = SLED_HOME): State => ({
    ...initialState(W, { packs, openGates: ['eis'] }),
    sleeping: true,
    player: { x: bed[0], y: bed[1], dir: 's' },
  });

  it('er bimmelt leise, steht er in Sichtweite und hält schon auf der Lichtung', () => {
    expect(iceView).toHaveProperty('goodNight', sledGoodNight);
    expect(sledGoodNight(asleep(), W)).toEqual({ id: 'schlitten', score: SLED_NIGHT });
    expect(sledGoodNight(asleep(withRide({}, 'schlitten', 'bereit')), W)).toBeUndefined(); // hält noch nicht auf der Lichtung
    expect(sledGoodNight({ ...asleep(), sleeping: false }, W)).toBeUndefined();
    expect(SLED_NIGHT.every(([f]) => PENTA.has(semis(f)))).toBe(true);
    expect(Math.max(...SLED_NIGHT.map((n) => n[5] + n[1]))).toBeLessThan(1);
  });

  it('nach „Gute Nacht“ ist seine Laterne aus', () => {
    const s = { ...asleep(), sleeping: false };
    const lit = (a: RideAt) => iceView.bodies!(s, W, a).find((b) => b.id === 'ride:schlitten')!.key;
    expect(lit({ ...AT, lit: true })).not.toBe(lit({ ...AT, lit: true, asleep: ['schlitten'] }));
    expect(lit({ ...AT, lit: true, asleep: ['schlitten'] })).toBe(lit(AT));
  });
});
