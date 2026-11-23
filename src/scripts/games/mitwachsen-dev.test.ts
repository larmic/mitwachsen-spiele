import { describe, expect, it } from 'vitest';
import { DEV_BUILT, DEV_PARAM, devPacks, glimpse, sandbox } from './mitwachsen-dev';
import { PACK_IDS } from './mitwachsen-packs';

describe('Entwickler-Schalter', () => {
  it('blickt nur in eine Welt mit Paket, und nur über die Adresse', () => {
    expect(DEV_PARAM).toBe('entwickler');
    expect(glimpse('?entwickler=hoehle', PACK_IDS)).toEqual({ packs: ['hoehle'], home: 'hoehle' });
    expect(glimpse('?x=1&entwickler=eis', PACK_IDS)).toEqual({ packs: ['eis'], home: 'eis' });
    const none = { packs: [], home: null };
    expect(glimpse('', PACK_IDS)).toEqual(none); // ohne Schalter
    expect(glimpse('?entwickler=lichtung', PACK_IDS)).toEqual(none); // die Lichtung hat kein Paket
    expect(glimpse('?entwickler=wasser', PACK_IDS)).toEqual(none); // noch keine Welt
    expect(glimpse('?entwickler=hoehle', ['eis'])).toEqual(none); // Paket fehlt
  });

  it('die Bahn: holt die Grotte mit, die Figur wacht im Bett der Lichtung auf (oder der zuerst genannten Welt)', () => {
    expect(glimpse('?entwickler=bahn', PACK_IDS)).toEqual({ packs: ['bahn', 'hoehle'], home: null });
    expect(glimpse('?entwickler=hoehle,bahn', PACK_IDS)).toEqual({ packs: ['hoehle', 'bahn'], home: 'hoehle' });
    expect(glimpse('?entwickler=bahn,eis', PACK_IDS)).toEqual({ packs: ['bahn', 'eis', 'hoehle'], home: 'eis' });
    expect(glimpse('?entwickler=bahn', ['eis', 'bahn'])).toEqual({ packs: ['bahn'], home: null }); // ohne Grotte
  });

  it('spielt der Bahn ihren Ausbau vor (nur im Arbeitsspeicher): 2, mit `&bau=1` nur bis zum Prellbock', () => {
    expect(DEV_BUILT).toBe('bau');
    expect(devPacks(['bahn', 'hoehle'], '?entwickler=bahn')).toEqual({ bahn: { built: 2 } });
    expect(devPacks(['bahn', 'hoehle'], '?entwickler=bahn&bau=1')).toEqual({ bahn: { built: 1 } });
    expect(devPacks(['bahn'], '?entwickler=bahn&bau=7')).toEqual({ bahn: { built: 2 } });
    expect(devPacks(['hoehle'], '?entwickler=hoehle&bau=1')).toEqual({}); // ohne Bahn nichts
    expect(devPacks([], '')).toEqual({});
  });

  it('Speicher im Blick hinein: liest den Spielstand, schreibt nur in den Arbeitsspeicher', () => {
    const real = new Map<string, string>([
      ['a', '1'],
      ['b', '2'],
    ]);
    const store = {
      getItem: (k: string) => real.get(k) ?? null,
      setItem: (k: string, v: string) => void real.set(k, v),
      removeItem: (k: string) => void real.delete(k),
    };
    const box = sandbox(store);
    expect(box.getItem('a')).toBe('1');
    box.setItem('a', '9');
    box.setItem('c', '3');
    box.removeItem('b');
    expect([box.getItem('a'), box.getItem('b'), box.getItem('c')]).toEqual(['9', null, '3']);
    expect([...real]).toEqual([
      ['a', '1'],
      ['b', '2'],
    ]); // der echte Speicher bleibt, wie er war
  });

  it('Höhlenpaket und Bahn gibt es (Lader), das Höhlentor geht trotzdem nie auf', async () => {
    expect(PACK_IDS).toEqual(['eis', 'hoehle', 'bahn']);
    const { GATES } = await import('../../data/games/mitwachsen');
    expect(GATES.find((g) => g.id === 'hoehle')?.opens).toBe('never');
  });
});
