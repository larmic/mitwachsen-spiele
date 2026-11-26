import { describe, expect, it } from 'vitest';
import {
  DEV_BAY,
  DEV_BUILT,
  DEV_EVENING,
  DEV_FEAST,
  DEV_DIG,
  DEV_ICE,
  DEV_LAMP,
  DEV_OPEN,
  DEV_PARAM,
  DEV_PRELOAD,
  devLamp,
  devLate,
  devProgress,
  glimpse,
  sandbox,
} from './mitwachsen-dev';
import type { Progress } from './mitwachsen-state';
import { PACK_IDS } from './mitwachsen-packs';
import type { PackId } from './mitwachsen-pack-types';
import { GATES, REGIONS, keyOf } from '../../data/games/mitwachsen';
import { full } from './mitwachsen-guide';
import { FIRST_MOLE } from '../../data/games/mitwachsen-hoehle';

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

  it('die Grubenbahn: holt Grotte und Fahr-Engine mit, die Figur wacht im Höhlenbett auf', () => {
    expect(glimpse('?entwickler=grube', PACK_IDS)).toEqual({ packs: ['grube', 'hoehle', 'fahrt'], home: 'hoehle' });
    expect(glimpse('?entwickler=grube,bahn', PACK_IDS)).toEqual({
      packs: ['grube', 'bahn', 'hoehle', 'fahrt'],
      home: 'hoehle',
    });
    expect(glimpse('?entwickler=bahn,grube', PACK_IDS).home).toBe('hoehle'); // die Bahn hat kein eigenes Bett
    expect(glimpse('?entwickler=grube', ['eis'])).toEqual({ packs: [], home: null }); // Paket fehlt
  });

  const saved: Progress = {
    met: [],
    garden: [{ id: 'lichtung:hase', species: 'hase' }],
    openGates: [],
    portals: [],
    position: [3, 4],
    day: 2,
    heard: [],
    found: [],
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
    // Ausbau 2 kommt erst nach dem Hau-ruck: das Höhlentor offen, Stufe `offen`; der Maulwurf zog mit Bau 2 ein
    const mole = { id: FIRST_MOLE, species: 'maulwurf' as const };
    expect(devProgress(['bahn'], '?entwickler=bahn', saved)).toEqual({
      ...saved,
      openGates: [...saved.openGates, 'hoehle'],
      garden: [...saved.garden, mole],
      packs: { ...saved.packs, bahn: { built: 2 }, fahrt: { hoehle: { stage: 'offen' } } },
    });
    const twice = devProgress(['bahn'], '?entwickler=bahn', devProgress(['bahn'], '?entwickler=bahn', saved));
    expect(twice.garden).toEqual([...saved.garden, mole]); // nichts doppelt
    // `&bau=1&tor=1`: das Hau-ruck ist gemacht (Tor offen, Stufe `offen`), Bau 2 kommt mit der nächsten Fahrt
    expect(DEV_OPEN).toBe('tor');
    expect(devProgress(['bahn'], '?entwickler=bahn&bau=1&tor=1', saved)).toEqual({
      ...saved,
      openGates: [...saved.openGates, 'hoehle'],
      packs: { ...saved.packs, bahn: { built: 1 }, fahrt: { hoehle: { stage: 'offen' } } },
    });
    expect(devProgress(['bahn'], '?entwickler=bahn&tor=1', saved).packs.bahn).toEqual({ built: 2 }); // bei 2 ohnehin offen
    // mit `&vorladen=1` bleibt es zu (die Grotte kommt erst über das Vorladen am Halt, nicht mit dem offenen Tor)
    expect(devProgress(['bahn'], '?entwickler=bahn&vorladen=1', saved).openGates).toEqual(saved.openGates);
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

  it('`&eis=1` (mit `&bau=1` oder 2): die Eis-Welt dazu wie im echten Spielstand, Schlitten und Zug in einem Spiel', () => {
    expect(DEV_ICE).toBe('eis');
    expect(glimpse('?entwickler=bahn&bau=1&eis=1', PACK_IDS)).toEqual({
      packs: ['bahn', 'hoehle', 'fahrt', 'eis'],
      home: 'lichtung', // die Figur wacht weiter auf der Lichtung auf, nah am Bahnhof
    });
    expect(glimpse('?entwickler=bahn&bau=1', PACK_IDS).packs).not.toContain('eis'); // ohne: wie bisher
    const p = devProgress(['bahn', 'hoehle', 'fahrt', 'eis'], '?entwickler=bahn&bau=1&eis=1', saved);
    expect(p.openGates).toContain('eis');
    expect(
      full(
        p,
        REGIONS.find((r) => r.id === 'eis')!,
      ),
    ).toBe(true);
    expect(p.packs).toMatchObject({
      bahn: { built: 1 },
      fahrt: { hoehle: { stage: 'bereit' }, schlitten: { stage: 'fest' } },
    });
    const two = devProgress(['bahn', 'hoehle', 'fahrt', 'eis'], '?entwickler=bahn&eis=1', saved);
    expect([...two.openGates].sort()).toEqual(['eis', 'hoehle']);
    expect(two.packs).toMatchObject({
      bahn: { built: 2 },
      fahrt: { hoehle: { stage: 'offen' }, schlitten: { stage: 'fest' } },
    });
    expect(devProgress(['bahn'], '?entwickler=bahn&bau=1&eis=1', p).garden).toEqual(p.garden); // nichts doppelt
  });

  it('`&vorladen=1`: die Bahn bringt die Grotte nicht mit, sie kommt erst über das Vorladen am Halt (der Zug schläft bis dahin)', () => {
    expect(DEV_PRELOAD).toBe('vorladen');
    expect(glimpse('?entwickler=bahn&bau=1&vorladen=1', PACK_IDS)).toEqual({
      packs: ['bahn', 'fahrt'],
      home: 'lichtung',
    });
    expect(glimpse('?entwickler=bahn&vorladen=0', PACK_IDS).packs).toContain('hoehle');
    // selbst genannt, kommt sie trotzdem
    expect(glimpse('?entwickler=hoehle,bahn&vorladen=1', PACK_IDS).packs).toContain('hoehle');
  });

  it('die Grubenbahn: Funkel steht an seinem Halt (Stufe bereit, der Gang ist gegraben); ein weiterer Stand bleibt', () => {
    const dev: PackId[] = ['grube', 'hoehle', 'fahrt'];
    const p = devProgress(dev, '?entwickler=grube', saved);
    expect(p.packs.fahrt).toEqual({ ...(saved.packs.fahrt as object), grube: { stage: 'bereit' } });
    expect(p.garden).toEqual(saved.garden); // sonst bleibt der Spielstand, wie er ist
    expect(p.openGates).toEqual(saved.openGates);
    expect(saved.packs.fahrt).not.toHaveProperty('grube'); // nur im Arbeitsspeicher
    const ridden = {
      ...saved,
      packs: { fahrt: { grube: { stage: 'bereit', gefahren: true }, schlitten: { stage: 'fest' } } },
    };
    expect(devProgress(dev, '?entwickler=grube', ridden).packs.fahrt).toEqual(ridden.packs.fahrt);
    // mit der Bahn: beides
    const both = devProgress(['grube', 'bahn', 'hoehle', 'fahrt'], '?entwickler=grube,bahn', saved).packs.fahrt;
    expect(both).toMatchObject({ grube: { stage: 'bereit' }, hoehle: { stage: 'offen' } });
    expect(devProgress(['hoehle'], '?entwickler=hoehle', saved)).toBe(saved); // ohne Grubenbahn nichts
  });

  it('die Grubenbahn mit `&graben=1`: der Gang noch Fels, der erste Maulwurf zu Hause, das Graben fällig', () => {
    expect(DEV_DIG).toBe('graben');
    const dev: PackId[] = ['grube', 'hoehle', 'fahrt'];
    const p = devProgress(dev, '?entwickler=grube&graben=1', saved);
    expect(p.packs.fahrt).toEqual({ ...(saved.packs.fahrt as object), grube: { stage: 'faellig' } });
    expect(p.garden.filter((a) => a.id === FIRST_MOLE)).toEqual([{ id: FIRST_MOLE, species: 'maulwurf' }]);
    expect(p.met).toContain(FIRST_MOLE);
    expect(saved.garden.some((a) => a.id === FIRST_MOLE)).toBe(false); // nur im Arbeitsspeicher
    const again = devProgress(dev, '?entwickler=grube&graben=1', p); // schon zu Hause: nicht doppelt
    expect(again.garden.filter((a) => a.id === FIRST_MOLE)).toHaveLength(1);
  });

  it('`&abend=1`: Abend für die Regeln, nur im Blick hinein', () => {
    expect(DEV_EVENING).toBe('abend');
    expect(devLate(['bahn'], '?entwickler=bahn&bau=0&abend=1')).toBe(true);
    expect(devLate(['bahn'], '?entwickler=bahn&bau=0')).toBe(false);
    expect(devLate([], '?abend=1')).toBe(false); // ohne Schalter nie
  });

  it('`&laterne=1`: die Figur wacht im Höhlenbett mit der Kristall-Laterne in der Hand auf (Lichtgeister), sonst nie', () => {
    expect(DEV_LAMP).toBe('laterne');
    const home = glimpse('?entwickler=hoehle&laterne=1', PACK_IDS).home;
    expect(devLamp(home, '?entwickler=hoehle&laterne=1')).toBe('hoehle');
    expect(devLamp(home, '?entwickler=hoehle')).toBeUndefined();
    expect(devLamp('lichtung', '?entwickler=bahn&laterne=1')).toBeUndefined(); // nur im Höhlenbett
    expect(devLamp(null, '?laterne=1')).toBeUndefined(); // ohne Schalter nie
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

  it('`&bucht=1` (mit `&bau=1`): die erste Fahrt ist gemacht, Tok wartet in der Bucht (zu Fuß zum Hau-ruck)', () => {
    expect(DEV_BAY).toBe('bucht');
    expect(devProgress(['bahn'], '?entwickler=bahn&bau=1&bucht=1', saved).packs.fahrt).toEqual({
      hoehle: { stage: 'bereit', gefahren: true },
    });
    expect(devProgress(['bahn'], '?entwickler=bahn&bau=1&bucht=1', saved).openGates).toEqual(saved.openGates); // Tor zu
  });

  it('`&fest=1` (Ausbau 2): Höhlen-Leiste voll, die Figur wacht im Höhlenbett auf; die nächste Fahrt auf die Lichtung ist die Laternenfahrt', () => {
    expect(DEV_FEAST).toBe('fest');
    const cave = REGIONS.find((r) => r.id === 'hoehle')!;
    const p = devProgress(['bahn', 'hoehle', 'fahrt'], '?entwickler=bahn&fest=1', saved);
    expect(full(p, cave)).toBe(true);
    expect(p.garden.filter((a) => a.id === FIRST_MOLE)).toHaveLength(1);
    expect(p.openGates).toContain('hoehle');
    expect(p.packs.fahrt).toMatchObject({ hoehle: { stage: 'offen' } });
    expect(glimpse('?entwickler=bahn&fest=1', PACK_IDS).home).toBe('hoehle');
    expect(glimpse('?entwickler=bahn', PACK_IDS).home).toBe('lichtung');
    expect(glimpse('?entwickler=eis,bahn&fest=1', PACK_IDS).home).toBe('eis'); // eine genannte Welt geht vor
    // ohne `&fest=1` oder bei Ausbau 1 bleibt die Leiste, wie sie ist
    expect(full(devProgress(['bahn'], '?entwickler=bahn', saved), cave)).toBe(false);
    expect(devProgress(['bahn'], '?entwickler=bahn&bau=1&fest=1', saved).garden).toEqual(saved.garden);
    // dann wacht die Figur auch nicht im Höhlenbett auf (das Tor bleibt zu, mit `&vorladen=1` fehlt die Grotte)
    expect(glimpse('?entwickler=bahn&bau=1&fest=1', PACK_IDS).home).toBe('lichtung');
    expect(glimpse('?entwickler=bahn&bau=0&fest=1', PACK_IDS).home).toBe('lichtung');
    expect(glimpse('?entwickler=bahn&vorladen=1&fest=1', PACK_IDS).home).toBe('lichtung');
  });

  it('Höhlenpaket und Bahn gibt es (Lader); das Höhlentor hat seinen Schlüssel Tok, mit und ohne Schalter', () => {
    expect(PACK_IDS).toEqual(['eis', 'hoehle', 'bahn', 'fahrt', 'grube']);
    expect(GATES.find((g) => g.id === 'hoehle')?.opens).toEqual({ key: 'tok', after: 'eis' });
    expect(keyOf('hoehle')).toBe('tok');
    expect(keyOf('eis')).toBe('pinguin');
    expect(keyOf('sand')).toBeUndefined();
  });
});
