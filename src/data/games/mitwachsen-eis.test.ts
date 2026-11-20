import { describe, expect, it } from 'vitest';
import { REGIONS, SPECIES, WILD_SPECIES, speciesOf } from './mitwachsen';
import { ICE_SPECIES } from './mitwachsen-eis';
import { ICE_ANIMALS } from './worlds/eis/mitwachsen-kessel';

describe('Tiere der Eis-Welt', () => {
  const eis = REGIONS.find((r) => r.id === 'eis')!;

  it('zehn Arten mit je drei Tieren wohnen in der Eis-Welt, keine davon in der Landschaft', () => {
    expect(eis.animals.map((a) => a.species)).toEqual(Object.keys(ICE_SPECIES));
    expect(eis.animals).toHaveLength(10);
    expect(eis.herd).toBe(3);
    for (const id of Object.keys(ICE_SPECIES)) {
      expect(SPECIES[id as keyof typeof ICE_SPECIES]).toBe(ICE_SPECIES[id as keyof typeof ICE_SPECIES]);
      expect(
        REGIONS[0].animals.some((a) => a.species === id),
        id,
      ).toBe(false);
      expect(WILD_SPECIES, id).not.toContain(id);
      expect(speciesOf(`eis:${id}:3`)).toBe(id);
    }
  });

  it('das Welt-Paket kennt für jede Art der Eis-Welt einen Wunschort, in derselben Reihenfolge; der Kern kennt keinen', () => {
    expect(ICE_ANIMALS.map((a) => a.species)).toEqual(eis.animals.map((a) => a.species));
    expect(eis.animals.every((a) => a.at === undefined)).toBe(true);
  });

  it('jede Gegend, die nicht hinter einem Tor liegt, kennt im Kern für jede Art einen Wunschort (sonst fehlte das Tier still)', () => {
    for (const r of REGIONS.filter((g) => !g.behind))
      for (const a of r.animals) expect(a.at, `${r.id}:${a.species}`).toBeDefined();
  });

  it('Wunschorte liegen im Kessel um die Schneewiese (relativ zum Schneebett), gut verteilt', () => {
    for (const { species, at } of ICE_ANIMALS) {
      const r = Math.hypot(...at);
      expect(r, species).toBeGreaterThan(6); // nicht auf der Schneewiese
      expect(r, species).toBeLessThan(15); // sicher im Kessel, wie auch immer er liegt
      for (const o of ICE_ANIMALS)
        if (o.species !== species) expect(Math.hypot(at[0] - o.at[0], at[1] - o.at[1])).toBeGreaterThanOrEqual(5);
    }
  });

  it('jedes Modell hat Augen, die zur Kamera zeigen können (vorn und an beiden Seiten); der Lemming ist größer gezeichnet', () => {
    for (const sp of Object.values(ICE_SPECIES)) {
      const faces = new Set(sp.parts.map((p) => p[8]).filter(Boolean));
      expect([...faces].sort(), sp.id).toEqual(['f', 'l', 'r']);
      expect(sp.name.length, sp.id).toBeGreaterThan(0);
    }
    expect(ICE_SPECIES.lemming.scale).toBeCloseTo(1.3);
  });
});

describe('Töne aller Tiere', () => {
  it('Töne aller Tiere in der Pentatonik C–D–E–G–A (klingen immer zusammen)', () => {
    const PENTA = [0, 2, 4, 7, 9]; // Halbtöne über C
    for (const sp of Object.values(SPECIES))
      for (const hz of sp.tone.notes) {
        const semis = 12 * Math.log2(hz / 261.63);
        expect(Math.abs(semis - Math.round(semis)), `${sp.id}: ${hz} Hz`).toBeLessThan(0.05); // sauber gestimmt
        expect(PENTA, `${sp.id}: ${hz} Hz`).toContain(((Math.round(semis) % 12) + 12) % 12);
      }
  });

  it('Eis-Tiere von tief (Walross, Moschusochse, Eisbär) bis hoch (Lemming, Papageitaucher)', () => {
    const low = (id: keyof typeof ICE_SPECIES) => Math.min(...ICE_SPECIES[id].tone.notes);
    const deep = ['walross', 'moschusochse', 'eisbaer'] as const;
    const high = ['lemming', 'papageitaucher'] as const;
    const middle = (Object.keys(ICE_SPECIES) as (keyof typeof ICE_SPECIES)[]).filter(
      (id) => !(deep as readonly string[]).includes(id) && !(high as readonly string[]).includes(id),
    );
    expect(middle).toHaveLength(5);
    for (const id of middle) {
      for (const d of deep) expect(low(d), `${d} unter ${id}`).toBeLessThan(low(id));
      for (const h of high) expect(low(h), `${h} über ${id}`).toBeGreaterThan(low(id));
    }
  });
});
