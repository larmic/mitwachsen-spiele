import { describe, expect, it } from 'vitest';
import { TURN_MS, gateward, turnAlbum, type Turn } from './mitwachsen-border-view';
import { crossings } from './mitwachsen-border';
import { worldOf } from './test-worlds';

describe('Bild der Weltgrenze', () => {
  it('die Leiste klappt beim Wechsel der Gegend um: erst flach, dann die neue Gegend; bei reduzierter Bewegung sofort', () => {
    const t: Turn = {};
    expect(turnAlbum(t, 'lichtung', 0, false)).toEqual(['lichtung', 1]); // erstes Bild: kein Umklappen
    expect(turnAlbum(t, 'lichtung', 5000, false)).toEqual(['lichtung', 1]);
    expect(turnAlbum(t, 'eis', 10_000, false)).toEqual(['lichtung', 1]); // der Wechsel beginnt
    expect(turnAlbum(t, 'eis', 10_000 + TURN_MS / 4, false)).toEqual(['lichtung', 0.5]);
    expect(turnAlbum(t, 'eis', 10_000 + TURN_MS / 2, false)).toEqual(['eis', 0]); // ganz flach
    expect(turnAlbum(t, 'eis', 10_000 + (TURN_MS * 3) / 4, false)).toEqual(['eis', 0.5]);
    expect(turnAlbum(t, 'eis', 10_000 + TURN_MS, false)).toEqual(['eis', 1]);
    expect(turnAlbum(t, 'lichtung', 20_000, true)).toEqual(['lichtung', 1]); // reduzierte Bewegung: sofort
  });

  it('der Pfeil über einem wartenden Tier zeigt zum nächsten ersten Feld seiner Seite (Tor bzw. Gangmündung)', () => {
    const world = worldOf(1);
    const c = crossings(world)[0]!;
    for (const side of ['lichtung', 'eis'] as const) {
      const [x, y] = c.seats.get(side)![0]!;
      const to = gateward(world, { x, y, realm: side })!;
      expect(c.entries.get(to.join(',')), side).toBe(side);
    }
    expect(gateward(world, { x: 0, y: 0, realm: 'lichtung' })).not.toBeNull();
  });
});
