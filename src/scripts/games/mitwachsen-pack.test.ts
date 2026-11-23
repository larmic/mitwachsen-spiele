import { describe, expect, it } from 'vitest';
import { REGIONS, regionAnimalList } from '../../data/games/mitwachsen';
import { NEAR_GATE, bahnWanted, holds, needsPack, packAt, type Need } from './mitwachsen-pack';
import { beyondRing, createWorld, gatePlaces } from './mitwachsen-world';
import { bareOf, worldOf } from './test-worlds';

const SEED = 1;
const gates = gatePlaces(SEED);
const eis = gates.get('eis')!;
const need = (extra: Partial<Need> = {}): Need => ({ openGates: [], garden: [], at: [[0, 0]], ...extra });
/** Alle Tiere der Lichtung auf der Wiese: Dann ist der verlaufene Pinguin fällig */
const fullMeadow = regionAnimalList(REGIONS[0]).map(({ id, species }) => ({ id, species }));

describe('Welt-Pakete: wann das Paket der Eis-Welt nötig ist (needsPack)', () => {
  it('neue Welt, Figur am Bett der Lichtung, Tor zu: nicht nötig (Start ohne Paket)', () => {
    expect(needsPack(need(), gates, beyondRing)).toBe(false);
    expect(needsPack(need({ at: [] }), gates, beyondRing)).toBe(false);
  });

  it('Eistor offen: nötig', () => {
    expect(needsPack(need({ openGates: ['eis'] }), gates, beyondRing)).toBe(true);
  });

  it('Pinguin fällig (Leiste der Lichtung voll, Tor zu): nötig', () => {
    expect(needsPack(need({ garden: fullMeadow }), gates, beyondRing)).toBe(true);
    const oneMissing = fullMeadow.filter((a) => a.species !== fullMeadow[0]!.species); // eine Art fehlt noch
    expect(needsPack(need({ garden: oneMissing }), gates, beyondRing)).toBe(false);
  });

  it('ein Eis-Tier wohnt schon zu Hause: nötig (sein Zuhause liegt im Kessel)', () => {
    expect(needsPack(need({ garden: [{ id: 'eis:robbe:1', species: 'robbe' }] }), gates, beyondRing)).toBe(true);
  });

  it(`Figur höchstens NEAR_GATE (${NEAR_GATE}) Felder vom Eistor: nötig, weiter weg nicht`, () => {
    const [mx, my] = eis.mid;
    const [ox, oy] = eis.out;
    const near: [number, number] = [mx - ox * NEAR_GATE, my - oy * NEAR_GATE];
    const far: [number, number] = [mx - ox * (NEAR_GATE + 1), my - oy * (NEAR_GATE + 1)];
    expect(needsPack(need({ at: [near] }), gates, beyondRing)).toBe(true);
    expect(beyondRing(...far)).toBe(false); // ein Feld weiter liegt auf der Lichtung …
    expect(packAt(far, gates, beyondRing)).toBe(false); // … und braucht das Paket nicht
    expect(needsPack(need({ at: [far] }), gates, beyondRing)).toBe(false);
  });

  it('der Abstand zählt auch schräg (in beide Richtungen gleich weit): genau NEAR_GATE ja, eins mehr nein', () => {
    const [mx, my] = eis.mid;
    const [sx, sy] = [Math.sign(-mx) || 1, Math.sign(-my) || 1]; // schräg zur Mitte der Lichtung hin
    const at = (d: number, e: number): [number, number] => [mx + sx * d, my + sy * e];
    expect(packAt(at(NEAR_GATE, NEAR_GATE), gates, beyondRing)).toBe(true);
    expect(packAt(at(NEAR_GATE, 7), gates, beyondRing)).toBe(true);
    expect(beyondRing(...at(NEAR_GATE + 1, NEAR_GATE + 1))).toBe(false);
    expect(packAt(at(NEAR_GATE + 1, NEAR_GATE + 1), gates, beyondRing)).toBe(false);
    expect(packAt(at(NEAR_GATE + 1, 7), gates, beyondRing)).toBe(false);
  });

  it('gespeicherte Position im Kessel (hinter dem Felsring, im Bereich des Eis-Gangs): nötig, auch als gehaltene', () => {
    const full = worldOf(SEED);
    const spots = full.spotsOf('eis');
    expect(spots.length).toBeGreaterThan(0);
    for (const p of spots) expect(packAt(p, gates, beyondRing), `${p[0]},${p[1]}`).toBe(true);
    expect(needsPack(need({ at: [[0, 0], spots[0]] }), gates, beyondRing)).toBe(true); // held
    expect(needsPack(need({ at: [undefined] }), gates, beyondRing)).toBe(false);
  });

  it('auf der Lichtung (außer nah am Eistor) und bei unbekanntem Tor: nicht nötig', () => {
    const lichtung = worldOf(SEED).spotsOf('lichtung');
    const [mx, my] = eis.mid;
    for (const p of lichtung)
      if (Math.max(Math.abs(p[0] - mx), Math.abs(p[1] - my)) > NEAR_GATE)
        expect(packAt(p, gates, beyondRing)).toBe(false);
    expect(packAt([0, 0], new Map(), beyondRing)).toBe(false);
    expect(needsPack(need(), gates, beyondRing, 'sand')).toBe(false); // ein Tor ohne Welt dahinter
  });
});

describe('Welt-Pakete je Tor: das Höhlentor (noch ohne Schlüssel und ohne Paket)', () => {
  const hoehle = gates.get('hoehle')!;
  const nearHoehle: [number, number] = [hoehle.mid[0] - hoehle.out[0] * 3, hoehle.mid[1] - hoehle.out[1] * 3];

  it('jedes Tor für sich: Was das Paket der Eis-Welt braucht, braucht die Höhlenwelt nicht', () => {
    for (const n of [need({ openGates: ['eis'] }), need({ garden: fullMeadow }), need({ at: [eis.mid] })]) {
      expect(needsPack(n, gates, beyondRing, 'eis')).toBe(true);
      expect(needsPack(n, gates, beyondRing, 'hoehle')).toBe(false);
    }
    expect(needsPack(need({ openGates: ['hoehle'] }), gates, beyondRing, 'hoehle')).toBe(true); // Tor offen
    // nah an seinem Tor: nichts, es geht nie auf (die Höhlenwelt ist noch nicht für das Kind)
    expect(needsPack(need({ at: [nearHoehle] }), gates, beyondRing, 'hoehle')).toBe(false);
    expect(needsPack(need({ at: [hoehle.mid] }), gates, beyondRing, 'hoehle')).toBe(false);
    expect(needsPack(need({ at: [nearHoehle] }), gates, beyondRing, 'eis')).toBe(false);
  });

  it('holds: Eine Position hält der Spielstand nur für eine Welt hinter einem Tor, das aufgehen kann, ohne ihr Paket', () => {
    const [eisRegion, hoehleRegion] = [REGIONS[1]!, REGIONS[2]!];
    expect([eisRegion.id, hoehleRegion.id]).toEqual(['eis', 'hoehle']);
    const nearEis: [number, number] = [eis.mid[0] - eis.out[0] * 3, eis.mid[1] - eis.out[1] * 3];
    expect(holds(bareOf(SEED), eisRegion, nearEis, beyondRing)).toBe(true); // Paket fehlt: festhalten
    expect(holds(worldOf(SEED), eisRegion, nearEis, beyondRing)).toBe(false); // Paket da
    expect(holds(bareOf(SEED), hoehleRegion, nearHoehle, beyondRing)).toBe(false); // das Höhlentor geht nie auf
    expect(holds(bareOf(SEED), REGIONS[0], [0, 0], beyondRing)).toBe(false); // die Lichtung liegt hinter keinem Tor
    expect(holds(createWorld(SEED, []), eisRegion, [0, 0], beyondRing)).toBe(false); // am Bett: nicht ihre Welt
  });
});

describe('Welt-Pakete: wann das Paket der Bahn nötig ist (bahnWanted, Freigabe BAHN_LIVE)', () => {
  it('vor dem Freischalten nie, wie weit das Kind auch ist; danach, sobald das Eistor offen ist', () => {
    const at: Need['at'] = [[0, 0]];
    expect(bahnWanted({ openGates: [] })).toBe(false);
    expect(bahnWanted({ openGates: ['eis'] })).toBe(false); // BAHN_LIVE ist aus
    expect(bahnWanted({ openGates: ['eis', 'hoehle'] }, false)).toBe(false);
    expect(bahnWanted({ openGates: [] }, true)).toBe(false); // freigeschaltet: erst nach der Eis-Welt
    expect(bahnWanted({ openGates: ['eis'] }, true)).toBe(true);
    expect(at).toHaveLength(1);
  });
});
