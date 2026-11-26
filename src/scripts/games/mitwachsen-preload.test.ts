// Vorladen am Halt (mitwachsen-preload.ts, `RIDE_PRELOAD`): welche Pakete ein Fahrzeug braucht, ab wann sie geholt
// werden und wann es schläft. Die Regeln des schlafenden Zugs prüft worlds/bahn/mitwachsen-train.test.ts
import { describe, expect, it } from 'vitest';
import type { Point } from '../../data/games/mitwachsen';
import { RIDE_PRELOAD } from '../../data/games/mitwachsen-rides';
import { bahnWanted } from './mitwachsen-pack';
import { dozingOf, preloadOf } from './mitwachsen-preload';
import { withTok } from './mitwachsen-ride-save';
import type { RideRoute } from './mitwachsen-rider';
import type { World } from './mitwachsen-world';
import { BAHN_PACK, BUILT, EIS_PACK, FAHRT_PACK, HOEHLE_PACK, worldOf } from './test-worlds';
import { withBuilt } from './worlds/bahn/mitwachsen-built';
import { trainRoute } from './worlds/bahn/mitwachsen-train';
import { sledRoute } from './worlds/eis/mitwachsen-sled-route';

/** Nach Bau 1: Ausbau 1, der Zug steht da */
const READY = withBuilt(withTok({}, { stage: 'bereit' }), 1);
/** Lichtung mit Gleis, ohne Grotte (ihr Paket fehlt) und mit ihr */
const ALONE = worldOf(1, [BAHN_PACK], { bahn: { built: 1 } });
const FULL = worldOf(1, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 1 } });
const S = { packs: READY, openGates: ['eis' as const] };
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const halts = (r: RideRoute) => [r.stops.home, r.stops.out, ...(r.cars?.home ?? []), ...(r.cars?.out ?? [])];

/** Ein Feld, das genau `d` Felder (Schachbrett) vom nächsten Halt-Feld liegt, vom Sitz auf der Lichtung aus gesucht */
function at(world: World, r: RideRoute, d: number): Point {
  const [sx, sy] = r.stops.out;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const)
    for (let i = 0; i < 40; i++) {
      const p: Point = [sx + dx * i, sy + dy * i];
      if (Math.min(...halts(r).map((h) => cheb(h, p))) === d && world.realm(...p) === 'lichtung') return p;
    }
  throw new Error(`kein Feld ${d} Felder vor dem Halt`);
}

describe('Vorladen am Halt (preloadOf, RIDE_PRELOAD)', () => {
  const r = trainRoute(ALONE, S)!;

  it('ab 6 Feldern vor einem Halt des Zugs (Schachbrett, auch vor den Wagen): Fahr-Engine und Grotte, bei 7 nichts', () => {
    expect(RIDE_PRELOAD).toBe(6);
    const packs = [BAHN_PACK, FAHRT_PACK];
    expect(preloadOf(packs, ALONE, S, [at(ALONE, r, 6)]).sort()).toEqual(['fahrt', 'hoehle']);
    expect(preloadOf(packs, ALONE, S, [at(ALONE, r, 0)]).sort()).toEqual(['fahrt', 'hoehle']);
    expect(preloadOf(packs, ALONE, S, [at(ALONE, r, 7)])).toEqual([]);
    // auch am Prellbock in der Bucht (der andere Halt), und eine gehaltene Position zählt mit
    expect(preloadOf(packs, ALONE, S, [undefined, r.stops.home]).sort()).toEqual(['fahrt', 'hoehle']);
  });

  it('nie das Paket der Bahn selbst (ohne es gibt es keinen Halt) und nie die Lichtung; vor Bau 1 nichts', () => {
    const near = [at(ALONE, r, 0)];
    const got = preloadOf([BAHN_PACK, FAHRT_PACK], ALONE, S, near);
    expect(got).not.toContain('bahn');
    expect(got).not.toContain('lichtung');
    const before = worldOf(1, [BAHN_PACK]);
    expect(preloadOf([BAHN_PACK, FAHRT_PACK], before, { packs: {}, openGates: ['eis'] }, near)).toEqual([]);
  });

  it('am Halt des Schlittens nur die Fahr-Engine (er lebt im Paket der Eis-Welt, seine Ziel-Gegend)', () => {
    const w = worldOf(1, [EIS_PACK]);
    const sled = sledRoute(w)!;
    expect(preloadOf([EIS_PACK, FAHRT_PACK], w, { packs: {}, openGates: ['eis'] }, [sled.stops.out])).toEqual([
      'fahrt',
    ]);
  });

  it('für das Kind: mit offenem Eistor kommt das Paket der Bahn, also holt Bahnhof Bär die Grotte vor', () => {
    expect(bahnWanted(S)).toBe(true);
    const child = [EIS_PACK, BAHN_PACK, FAHRT_PACK];
    expect(preloadOf(child, ALONE, S, [at(ALONE, r, 2)])).toContain('hoehle');
  });
});

describe('Schlafende Fahrzeuge (dozingOf)', () => {
  /** Ausbau 2 (der Zug fährt in die Grotte) ohne und mit Grotte */
  const ALONE2 = worldOf(1, [BAHN_PACK], BUILT);
  const FULL2 = worldOf(1, [HOEHLE_PACK, BAHN_PACK], BUILT);
  const FAR = { packs: withBuilt(READY, 2), tick: 10 };
  const NOW = { packs: READY, tick: 10 };

  it('der Zug schläft ab Ausbau 2, solange die Grotte (seine Ziel-Gegend) oder die Fahr-Engine fehlt; mit beiden ist er wach', () => {
    expect(dozingOf([BAHN_PACK, FAHRT_PACK], ALONE2, FAR)).toEqual(['hoehle']);
    expect(dozingOf([BAHN_PACK, FAHRT_PACK], FULL2, FAR)).toEqual([]);
    expect(dozingOf([BAHN_PACK], FULL2, FAR)).toEqual(['hoehle']); // ohne Fahr-Engine
    expect(dozingOf([], ALONE2, FAR)).toEqual([]); // ohne Paket der Bahn kein Zug
  });

  it('bei Ausbau 1 wartet er nicht auf die Grotte (die erste Fahrt endet am Prellbock), nur auf die Fahr-Engine', () => {
    expect(dozingOf([BAHN_PACK, FAHRT_PACK], ALONE, NOW)).toEqual([]);
    expect(dozingOf([BAHN_PACK], ALONE, NOW)).toEqual(['hoehle']);
    expect(dozingOf([BAHN_PACK, FAHRT_PACK], FULL, NOW)).toEqual([]);
  });

  it('solange ein Bote baut (Tok: Bau 1), schläft nichts; danach wieder', () => {
    const work = { from: 0, to: 20 };
    expect(dozingOf([BAHN_PACK], ALONE2, { ...FAR, work })).toEqual([]);
    expect(dozingOf([BAHN_PACK, FAHRT_PACK], ALONE2, { ...FAR, work })).toEqual([]);
    expect(dozingOf([BAHN_PACK, FAHRT_PACK], ALONE2, { ...FAR, tick: 20, work })).toEqual(['hoehle']);
  });

  it('Schlitten, Rodelreifen und Schneeraupe brauchen nur die Fahr-Engine', () => {
    const w = worldOf(1, [EIS_PACK]);
    expect(dozingOf([EIS_PACK, FAHRT_PACK], w, { packs: {}, tick: 0 })).toEqual([]);
    // ohne Fahr-Engine schlafen alle Fahrzeuge der Eis-Welt: Schlitten, Rodelreifen und Schneeraupe (`rules.more`)
    expect(dozingOf([EIS_PACK], w, { packs: {}, tick: 0 })).toEqual(['schlitten', 'rodel', 'raupe']);
  });
});
