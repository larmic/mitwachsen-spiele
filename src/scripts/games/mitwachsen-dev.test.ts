import { describe, expect, it } from 'vitest';
import { DEV_BUILT, DEV_EVENING, DEV_PARAM, devLate, devProgress, glimpse, sandbox } from './mitwachsen-dev';
import type { Progress } from './mitwachsen-state';
import { PACK_IDS } from './mitwachsen-packs';
import type { PackId } from './mitwachsen-pack-types';
import { REGIONS } from '../../data/games/mitwachsen';
import { full } from './mitwachsen-guide';

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
    expect(glimpse('?entwickler=bahn', PACK_IDS)).toEqual({ packs: ['bahn', 'hoehle', 'fahrt'], home: 'lichtung' });
    expect(glimpse('?entwickler=hoehle,bahn', PACK_IDS)).toEqual({
      packs: ['hoehle', 'bahn', 'fahrt'],
      home: 'hoehle',
    });
    expect(glimpse('?entwickler=bahn,eis', PACK_IDS)).toEqual({
      packs: ['bahn', 'eis', 'hoehle', 'fahrt'],
      home: 'eis',
    });
    expect(glimpse('?entwickler=bahn', ['eis', 'bahn'])).toEqual({ packs: ['bahn'], home: 'lichtung' }); // ohne Grotte
    expect(glimpse('?entwickler=fahrt', PACK_IDS)).toEqual({ packs: ['fahrt'], home: 'lichtung' }); // ohne eigene Welt
    // vor Tok (`&bau=0`) braucht es die Eis-Welt: ihr Tor ist dann offen
    expect(glimpse('?entwickler=bahn&bau=0', PACK_IDS)).toEqual({
      packs: ['bahn', 'hoehle', 'fahrt', 'eis'],
      home: 'lichtung',
    });
  });

  const saved: Progress = {
    met: [],
    garden: [{ id: 'lichtung:hase', species: 'hase' }],
    openGates: [],
    portals: [],
    position: [3, 4],
    day: 2,
    heard: [],
    packs: { eis: { snowmen: 1 }, fahrt: { hoehle: { stage: 'faellig' } } },
  };

  it('spielt der Bahn ihren Ausbau vor (nur im Arbeitsspeicher): 2, mit `&bau=1` nur bis zum Prellbock; der Zug steht da', () => {
    expect(DEV_BUILT).toBe('bau');
    const built = (dev: PackId[], search: string) => devProgress(dev, search, saved).packs.bahn;
    expect(built(['bahn', 'hoehle'], '?entwickler=bahn')).toEqual({ built: 2 });
    expect(built(['bahn', 'hoehle'], '?entwickler=bahn&bau=1')).toEqual({ built: 1 });
    expect(built(['bahn'], '?entwickler=bahn&bau=7')).toEqual({ built: 2 });
    expect(devProgress(['bahn'], '?entwickler=bahn&bau=1', saved)).toEqual({
      ...saved,
      packs: { ...saved.packs, bahn: { built: 1 }, fahrt: { hoehle: { stage: 'bereit' } } },
    }); // der Zug steht am Bahnhof (Stufe `bereit` wie nach Bau 1), sonst bleibt alles
    const further = { ...saved, packs: { fahrt: { hoehle: { stage: 'fest' }, schlitten: { stage: 'fest' } } } };
    expect(devProgress(['bahn'], '?entwickler=bahn', further).packs.fahrt).toEqual(further.packs.fahrt); // schon weiter
    expect(devProgress(['hoehle'], '?entwickler=hoehle&bau=1', saved)).toBe(saved); // ohne Bahn nichts
    expect(devProgress([], '', saved)).toBe(saved);
  });

  it('`&bau=0`: der Stand, in dem Tok kommt (Eistor offen, Eis-Leiste voll, erste Heimfahrt mit dem Schlitten)', () => {
    const p = devProgress(['bahn', 'hoehle', 'eis'], '?entwickler=bahn&bau=0', saved);
    expect(p.openGates).toEqual(['eis']);
    const eis = REGIONS.find((r) => r.id === 'eis')!.animals.map((a) => `eis:${a.species}`);
    expect(p.garden.map((a) => a.id)).toEqual(['lichtung:hase', ...eis]);
    expect(p.packs).toEqual({
      eis: { snowmen: 1 },
      bahn: { built: 0 },
      fahrt: { hoehle: { stage: 'faellig' }, schlitten: { stage: 'fest' } },
    });
    expect(
      full(
        p,
        REGIONS.find((r) => r.id === 'eis')!,
      ),
    ).toBe(true);
    // zweimal vorgespielt: nichts doppelt
    expect(devProgress(['bahn'], '?entwickler=bahn&bau=0', p).garden).toEqual(p.garden);
    expect([p.position, p.met, p.day]).toEqual([saved.position, saved.met, saved.day]);
  });

  it('`&abend=1`: Abend für die Regeln, nur im Blick hinein', () => {
    expect(DEV_EVENING).toBe('abend');
    expect(devLate(['bahn'], '?entwickler=bahn&bau=0&abend=1')).toBe(true);
    expect(devLate(['bahn'], '?entwickler=bahn&bau=0')).toBe(false);
    expect(devLate([], '?abend=1')).toBe(false); // ohne Schalter nie
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
    expect(PACK_IDS).toEqual(['eis', 'hoehle', 'bahn', 'fahrt']);
    const { GATES } = await import('../../data/games/mitwachsen');
    expect(GATES.find((g) => g.id === 'hoehle')?.opens).toBe('never');
  });
});
