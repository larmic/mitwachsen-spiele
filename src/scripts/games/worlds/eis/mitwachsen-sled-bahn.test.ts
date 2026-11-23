// Schlitten und Höhlenbahn in einer Welt (nach dem Freischalten hat das Kind beide): Die Strecke des Schlittens, seine
// Halte, sein Schuppen und die Warteplätze liegen nie auf Gleis oder Bahnsteig der Bahn; wo sie sich nicht in die Quere
// kommen, fährt der Schlitten wie ohne Bahn. Eigene Datei, damit die Welten mit beiden Paketen im tiefen Lauf in einem
// eigenen Worker entstehen
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../data/games/mitwachsen';
import { BAHN_PACK, BUILT, EIS_PACK, HOEHLE_PACK, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { sledRoute, type Route } from './mitwachsen-sled-route';

const SEEDS = seedsFor(seedRange(1, 20), SAMPLE_SEEDS);
/** Für den Vergleich mit der Welt ohne Bahn (baut je Seed eine Welt mehr; der tiefe Lauf bleibt unter 150 s) */
const SAME = seedsFor(seedRange(1, 10), SAMPLE_SEEDS.slice(0, 3));
const keyOf = ([x, y]: Point) => `${x},${y}`;
const cellsOf = (r: Route) => [...r.path, ...r.shed, r.stops.home, r.stops.out, ...r.seats.home, ...r.seats.out];

describe('Schlitten und Höhlenbahn in einer Welt', () => {
  it.each(SEEDS)('Seed %i: Strecke, Halte, Schuppen und Warteplätze nie auf Gleis oder Bahnsteig der Bahn', (seed) => {
    const w = worldOf(seed, [EIS_PACK, HOEHLE_PACK, BAHN_PACK], BUILT);
    const r = sledRoute(w);
    const bad: string[] = [];
    if (!r) bad.push('kein Schlitten');
    else
      for (const p of cellsOf(r)) {
        const c = w.cell(...p);
        if (c.ride === 'hoehle' || c.stop) bad.push(keyOf(p));
      }
    // die Bahn liegt wirklich (sonst prüfte der Test nichts)
    const g = w.gates.get('hoehle')!;
    if (!w.cell(g.mid[0] + 2 * g.out[1] - g.out[0], g.mid[1] - 2 * g.out[0] - g.out[1]).rail) bad.push('kein Gleis');
    expect(bad, `Seed ${seed}`).toEqual([]);
  });

  it.each(SAME)('Seed %i: Kommt die Bahn dem Schlitten nicht in die Quere, fährt er wie ohne sie', (seed) => {
    const plain = sledRoute(worldOf(seed, [EIS_PACK, HOEHLE_PACK]))!;
    const w = worldOf(seed, [EIS_PACK, HOEHLE_PACK, BAHN_PACK], BUILT);
    const clash = cellsOf(plain).some((p) => {
      const c = w.cell(...p);
      return c.ride === 'hoehle' || !!c.stop;
    });
    if (clash) return; // dann weicht er aus (geprüft oben)
    const r = sledRoute(w)!;
    expect({ path: r.path, stops: r.stops, shed: r.shed }, `Seed ${seed}`).toEqual({
      path: plain.path,
      stops: plain.stops,
      shed: plain.shed,
    });
  });
});
