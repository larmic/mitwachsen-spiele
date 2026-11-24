// Haken der Pakete für `step` (hooksOf): Fahr-Engine mit den Fahrzeugen der Pakete, Bote
import { describe, expect, it } from 'vitest';
import { RIDES } from '../../data/games/mitwachsen-rides';
import { hooksOf } from './mitwachsen-herald';
import type { RideEngine, RideRules, Vehicle } from './mitwachsen-rider';

const RULES: RideRules = { tick: () => {}, move: () => false, blocks: () => false };
const sled: Vehicle = { spec: RIDES[0], route: () => undefined };
const train: Vehicle = { spec: RIDES[1]!, route: () => undefined };
const bump = () => false;

describe('Haken der Pakete (hooksOf)', () => {
  it('Fahrzeuge: die Fahr-Engine (Paket der Fahrzeuge) mit den Fahrzeugen aller Pakete, in ihrer Reihe; je Satz einmal gebaut', () => {
    const seen: (readonly Vehicle[])[] = [];
    const engine: RideEngine = (v) => (seen.push(v), RULES);
    const packs = [
      { rules: { bump, vehicle: sled } },
      { rules: { bump, ride: engine } },
      { rules: { bump, vehicle: train } },
    ];
    expect(hooksOf(packs).ride).toBe(RULES);
    expect(seen).toEqual([[sled, train]]);
    hooksOf(packs);
    hooksOf([...packs]);
    expect(seen).toHaveLength(1); // dieselben Fahrzeuge: nicht neu gebaut (`step` fragt in jedem Befehl)
    hooksOf(packs.slice(0, 2)); // ein Paket fehlt: neu
    expect(seen.at(-1)).toEqual([sled]);
  });

  it('ohne Fahr-Engine oder ohne Fahrzeug fährt nichts; `meet` fragt dann nur den Boten', () => {
    const engine: RideEngine = () => RULES;
    expect(hooksOf([{ rules: { vehicle: sled } }]).ride).toBeUndefined(); // Paket der Fahrzeuge fehlt
    expect(hooksOf([{ rules: { ride: engine } }]).ride).toBeUndefined(); // kein Fahrzeug da
    const { meet } = hooksOf([]);
    expect(meet({} as never, {} as never, { type: 'move', dir: 'n' }, [] as never)).toBe(false);
  });
});
