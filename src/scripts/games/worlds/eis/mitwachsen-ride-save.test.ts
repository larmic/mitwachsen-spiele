import { describe, expect, it } from 'vitest';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import { initialState, progressOf, step, type State } from '../../mitwachsen-state';
import { kesselPlace } from '../../mitwachsen-world';
import { EIS_PACK, PACKS, worldOf } from '../../test-worlds';
import { rideOf, stageOf, withRide } from './mitwachsen-ride-save';
import { stageAt } from './mitwachsen-snowman';

const [SLED] = RIDES;

describe('Spielstand der Fahrzeuge (packs.fahrt)', () => {
  it('der Schlitten ist das erste Fahrzeug: Eis-Welt, Fahrt 15–20 s, Signal in der Pentatonik', () => {
    expect(SLED.id).toBe('schlitten');
    expect(SLED.gate).toBe('eis');
    expect(SLED.ticks).toEqual([150, 200]);
    expect(SLED.signal.length).toBeGreaterThanOrEqual(2);
    expect(SLED.signal.length).toBeLessThanOrEqual(3);
    // jeder Ton liegt auf C, D, E, G oder A (in irgendeiner Oktave)
    const semis = SLED.signal.map((hz) => ((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12);
    expect(semis.every((n) => [0, 2, 4, 7, 9].includes(n))).toBe(true);
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
      zug: { stage: 'faellig' }, // eine Stufe, die dieses Spiel nicht kennt
      tok: 'fest',
      ballon: null,
      drache: { stage: 3 },
      wal: [],
    };
    expect(rideOf({ fahrt })).toEqual({ schlitten: { stage: 'bereit' }, boot: { stage: 'fest' } });
    expect(stageOf({ fahrt }, 'schlitten')).toBe('bereit');
    expect(stageOf({ fahrt: { schlitten: { stage: 'kaputt' } } }, 'schlitten')).toBeUndefined();
    expect(rideOf({ fahrt })).toBe(rideOf({ fahrt })); // je Eintrag einmal aufgeräumt
  });

  it('withRide schreibt die Stufe; andere Pakete und fremde Einträge unter fahrt bleiben, wie sie sind', () => {
    const eis = { v: 1, snow: { '3,4': 2 } };
    const zug = { stage: 'faellig', gleis: 2 };
    const before = { eis, fahrt: { zug } };
    const after = withRide(before, 'schlitten', 'bereit');
    expect(after).toEqual({ eis, fahrt: { zug, schlitten: { stage: 'bereit' } } });
    expect(before).toEqual({ eis, fahrt: { zug } }); // nichts verändert
    expect(stageOf(withRide(after, 'schlitten', 'fest'), 'schlitten')).toBe('fest');
    expect(withRide({ fahrt: 'kaputt' }, 'schlitten', 'fest')).toEqual({ fahrt: { schlitten: { stage: 'fest' } } });
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
