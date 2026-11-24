import { describe, expect, it } from 'vitest';
import { RIDES } from '../../data/games/mitwachsen-rides';
import { SPECIES } from '../../data/games/mitwachsen';
import { initialState, progressOf, step, type State } from './mitwachsen-state';
import { kesselPlace } from './mitwachsen-world';
import { EIS_PACK, PACKS, worldOf } from './test-worlds';
import {
  rank,
  rideOf,
  ridden,
  sledHome,
  stageOf,
  tokOf,
  wakeRides,
  withRidden,
  withRide,
  withTok,
} from './mitwachsen-ride-save';
import { stageAt } from './worlds/eis/mitwachsen-snowman';

const [SLED, TRAIN] = RIDES;
const semis = (hz: number) => ((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12;

describe('Spielstand der Fahrzeuge (packs.fahrt)', () => {
  it('der Schlitten ist das erste Fahrzeug: Eis-Welt, Fahrt 15–20 s, Signal in der Pentatonik', () => {
    expect(SLED.id).toBe('schlitten');
    expect(SLED.gate).toBe('eis');
    expect(SLED.ticks).toEqual([150, 200]);
    expect(SLED.signal.length).toBeGreaterThanOrEqual(2);
    expect(SLED.signal.length).toBeLessThanOrEqual(3);
    // jeder Ton liegt auf C, D, E, G oder A (in irgendeiner Oktave)
    expect(SLED.signal.map(semis).every((n) => [0, 2, 4, 7, 9].includes(n))).toBe(true);
  });

  it('die Höhlenbahn ist das zweite Fahrzeug: Höhlentor, höchstens 8 Felder je Sekunde, Pfiff A5 → C6, eigenes Signal', () => {
    expect(TRAIN).toMatchObject({ id: 'hoehle', gate: 'hoehle', pace: 0.8, out: 'bereit', pennant: 'kristall' });
    expect(TRAIN!.signal).toEqual([880, 1046.5]);
    expect(TRAIN!.signal.map(semis).every((n) => [0, 2, 4, 7, 9].includes(n))).toBe(true);
    // kein Signal gleicht einem anderen Fahrzeug oder dem Ruf eines Tiers
    const sig = (f: readonly number[]) => [...f].sort().join();
    const signals = RIDES.map((r) => sig(r.signal));
    expect(new Set(signals).size).toBe(RIDES.length);
    const calls = new Set(Object.values(SPECIES).map((sp) => sig(sp.tone.notes)));
    expect(signals.filter((x) => calls.has(x))).toEqual([]);
    expect(SLED.out).toBe('fest'); // der Schlitten hält erst nach seinem Fest auf der Lichtung
  });

  it('Stufen in ihrer Reihenfolge: faellig, bereit, offen, fest', () => {
    expect(['faellig', 'bereit', 'offen', 'fest'].map((x) => rank(x as never))).toEqual([0, 1, 2, 3]);
    expect(rank(undefined)).toBe(-1);
  });

  it('ältere Stände ohne Eintrag: kein Fahrzeug da', () => {
    expect(rideOf({})).toEqual({});
    expect(rideOf({ eis: { v: 1, snow: {} } })).toEqual({});
    expect(stageOf({}, 'schlitten')).toBeUndefined();
  });

  it('Migration: gültige Stufen bleiben, Müll wird verworfen, fremde Kennungen mit gültiger Stufe bleiben', () => {
    for (const raw of [null, 42, 'fest', ['schlitten'], true]) expect(rideOf({ fahrt: raw }), String(raw)).toEqual({});
    const fahrt = {
      schlitten: { stage: 'bereit' },
      boot: { stage: 'fest', schlaeft: true }, // ein späteres Fahrzeug
      hoehle: { stage: 'faellig', schlaeft: 'ja' }, // `schlaeft` zählt nur als true
      zug: { stage: 'unterwegs' }, // eine Stufe, die dieses Spiel nicht kennt
      tok: 'fest',
      ballon: null,
      drache: { stage: 3 },
      wal: [],
    };
    expect(rideOf({ fahrt })).toEqual({
      schlitten: { stage: 'bereit' },
      boot: { stage: 'fest', schlaeft: true },
      hoehle: { stage: 'faellig' },
    });
    expect(stageOf({ fahrt }, 'schlitten')).toBe('bereit');
    expect(stageOf({ fahrt: { schlitten: { stage: 'kaputt' } } }, 'schlitten')).toBeUndefined();
    expect(rideOf({ fahrt })).toBe(rideOf({ fahrt })); // je Eintrag einmal aufgeräumt
  });

  it('withRide schreibt die Stufe; andere Pakete und fremde Einträge unter fahrt bleiben, wie sie sind', () => {
    const eis = { v: 1, snow: { '3,4': 2 } };
    const zug = { stage: 'unterwegs', gleis: 2 };
    const before = { eis, fahrt: { zug } };
    const after = withRide(before, 'schlitten', 'bereit');
    expect(after).toEqual({ eis, fahrt: { zug, schlitten: { stage: 'bereit' } } });
    expect(before).toEqual({ eis, fahrt: { zug } }); // nichts verändert
    expect(stageOf(withRide(after, 'schlitten', 'fest'), 'schlitten')).toBe('fest');
    expect(withRide({ fahrt: 'kaputt' }, 'schlitten', 'fest')).toEqual({ fahrt: { schlitten: { stage: 'fest' } } });
  });

  it('Tok und Bahn stehen im selben Eintrag wie der Schlitten (`packs.fahrt.hoehle`), mit `schlaeft`', () => {
    const packs = withTok(withRide({}, 'schlitten', 'fest'), { stage: 'faellig', schlaeft: true });
    expect(packs).toEqual({ fahrt: { schlitten: { stage: 'fest' }, hoehle: { stage: 'faellig', schlaeft: true } } });
    expect(tokOf(packs)).toEqual({ stage: 'faellig', schlaeft: true });
    expect(sledHome(packs)).toBe(true);
    expect(sledHome(withRide({}, 'schlitten', 'bereit'))).toBe(false);
    expect(stageOf(withTok(packs, { stage: 'bereit' }), 'hoehle')).toBe('bereit');
    expect(withRide(packs, 'hoehle', 'bereit')).toEqual({
      fahrt: { schlitten: { stage: 'fest' }, hoehle: { stage: 'bereit' } },
    });
  });

  it('erste Fahrt gemacht (`gefahren`): nur genau true zählt, bleibt bei neuer Stufe und beim Aufwachen stehen', () => {
    const ready = withTok({}, { stage: 'bereit' });
    expect(ridden(ready, 'hoehle')).toBe(false);
    const after = withRidden(ready, 'hoehle');
    expect(after).toEqual({ fahrt: { hoehle: { stage: 'bereit', gefahren: true } } });
    expect(ridden(after, 'hoehle')).toBe(true);
    expect(withRidden(after, 'hoehle')).toBe(after); // schon gefahren: derselbe Zustand
    expect(withRidden({}, 'hoehle')).toEqual({}); // ohne Eintrag nichts
    expect(ridden(withTok({}, { stage: 'offen' }), 'hoehle')).toBe(true); // ab `offen` ohnehin
    expect(rideOf({ fahrt: { hoehle: { stage: 'bereit', gefahren: 'ja' } } })).toEqual({ hoehle: { stage: 'bereit' } });
    expect(withRide(after, 'hoehle', 'offen')).toEqual({ fahrt: { hoehle: { stage: 'offen', gefahren: true } } });
    const asleep = withTok({}, { stage: 'bereit', schlaeft: true, gefahren: true });
    expect(tokOf(wakeRides(asleep))).toEqual({ stage: 'bereit', gefahren: true });
  });

  it('`schlaeft` gilt für jedes Fahrzeug: am nächsten echten Spieltag fällt es bei allen weg, sonst bleibt alles', () => {
    const both = withRide(withTok({ eis: { x: 1 } }, { stage: 'faellig', schlaeft: true }), 'schlitten', 'fest', true);
    expect(rideOf(both).schlitten).toEqual({ stage: 'fest', schlaeft: true });
    expect(wakeRides(both)).toEqual({
      eis: { x: 1 },
      fahrt: { hoehle: { stage: 'faellig' }, schlitten: { stage: 'fest' } },
    });
    const awake = withRide({}, 'schlitten', 'fest');
    expect(wakeRides(awake)).toEqual(awake);
    expect(wakeRides(awake)).not.toBe(awake);
  });

  it('übersteht Spielstart und Speichern über progressOf', () => {
    const world = worldOf(1, [EIS_PACK]);
    const packs = withRide({}, 'schlitten', 'fest');
    const s = initialState(world, { openGates: ['eis'], packs });
    expect(stageOf(progressOf(s).packs, 'schlitten')).toBe('fest');
  });

  it('der Schneemann schreibt packs.eis neu und lässt packs.fahrt stehen', () => {
    const world = worldOf(1);
    const [hx, hy] = kesselPlace(1, EIS_PACK).cells.find(([x, y]) => world.cell(x, y).deco === 'snowheap')!;
    const packs = withRide({}, 'schlitten', 'bereit');
    const s: State = {
      ...initialState(world, { openGates: ['eis'], packs }),
      sleeping: false,
      wokeAt: -100,
      player: { x: hx, y: hy + 1, dir: 'n' },
    };
    const r = step(s, world, { type: 'move', dir: 'n' }, undefined, undefined, PACKS);
    expect(stageAt(r.state.packs, hx, hy)).toBe(1); // eine Kugel gewachsen
    expect(stageOf(r.state.packs, 'schlitten')).toBe('bereit');
  });
});
