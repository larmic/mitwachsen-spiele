import { describe, expect, it } from 'vitest';
import { DEV_PARAM, glimpse, sandbox } from './mitwachsen-dev';
import { PACK_IDS } from './mitwachsen-packs';

describe('Entwickler-Schalter', () => {
  it('blickt nur in eine Welt mit Paket, und nur über die Adresse', () => {
    expect(DEV_PARAM).toBe('entwickler');
    expect(glimpse('?entwickler=hoehle', PACK_IDS)).toBe('hoehle');
    expect(glimpse('?x=1&entwickler=eis', PACK_IDS)).toBe('eis');
    expect(glimpse('', PACK_IDS)).toBeNull(); // ohne Schalter
    expect(glimpse('?entwickler=lichtung', PACK_IDS)).toBeNull(); // die Lichtung hat kein Paket
    expect(glimpse('?entwickler=wasser', PACK_IDS)).toBeNull(); // noch keine Welt
    expect(glimpse('?entwickler=hoehle', ['eis'])).toBeNull(); // Paket fehlt
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

  it('das Höhlenpaket gibt es (Lader), das Höhlentor geht trotzdem nie auf', async () => {
    expect(PACK_IDS).toEqual(['eis', 'hoehle']);
    const { GATES } = await import('../../data/games/mitwachsen');
    expect(GATES.find((g) => g.id === 'hoehle')?.opens).toBe('never');
  });
});
