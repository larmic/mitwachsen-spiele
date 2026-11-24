// Schlitten und Zug in einem Spiel (Fehler vom 24.11.2026: Beim Einsteigen in den Zug kam das Bild des Schlittens):
// Mit beiden Paketen, in beiden Reihenfolgen, antwortet jedes Fahrzeug nur auf seine eigene Fahrt – Körper, Sitz der
// Figur, Spur am Boden, Ton und Freude. Im Kern, weil ein Welt-Paket kein anderes importiert (world-packs-stay-apart)
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../lib/games/front';
import type { Point } from '../../data/games/mitwachsen';
import type { Ride, RideEvent } from './mitwachsen-pack-types';
import { withRide, withTok } from './mitwachsen-ride-save';
import { ownSeat, rideOfBody, seatOf, type RideAt, type RideBody, type RideFx } from './mitwachsen-ride-view';
import { initialState, step, type Cmd, type GameEvent, type State } from './mitwachsen-state';
import type { View2D } from './mitwachsen-view';
import type { World } from './mitwachsen-world';
import { BAHN_PACK, EIS_PACK, FAHRT_PACK, HOEHLE_PACK, worldOf } from './test-worlds';
import { withBuilt } from './worlds/bahn/mitwachsen-built';
import { stationOf } from './worlds/bahn/mitwachsen-station-look';
import { SEAT } from './worlds/bahn/mitwachsen-train';
import { trainFx } from './worlds/bahn/mitwachsen-train-look';
import { rideFx as sledFx, sledBodies, sledMarks } from './worlds/eis/mitwachsen-sled-look';
import { sledRoute } from './worlds/eis/mitwachsen-sled-route';

/** Eis-Welt, Grotte und Bahn bei Ausbau 1: der Zug fährt von Bahnhof Bär zur Bucht, der Schlitten hält auf der Lichtung */
const W = worldOf(1, [EIS_PACK, HOEHLE_PACK, BAHN_PACK], { bahn: { built: 1 } });
/** Der Zug steht da, der Schlitten ist schon gefahren (Stufe `fest`, er hält auch auf der Lichtung) */
const PACKS = withRide(withBuilt(withTok({}, { stage: 'bereit' }), 1), 'schlitten', 'fest');
const AT: RideAt = { now: 0, frac: 0.5, reduced: false, lit: true };
/** Beide Reihenfolgen, in denen die Pakete ankommen können */
const ORDERS = [
  ['Eis zuerst', [EIS_PACK, BAHN_PACK]],
  ['Bahn zuerst', [BAHN_PACK, EIS_PACK]],
] as const;
const viewsOf = (packs: readonly { view?: View2D }[]) => packs.flatMap((p) => (p.view ? [p.view] : []));
/** Wie die Spielseite: Körper aller Pakete hintereinander (`Renderer.all`), die Figur nur im Fahrzeug ihrer Fahrt */
const bodiesOf = (views: readonly View2D[], s: State, w: World = W): readonly RideBody[] =>
  ownSeat(
    views.flatMap((v) => v.bodies?.(s, w, AT) ?? []),
    s.ride?.id,
  );
/** Wie die Spielseite: die erste Antwort auf ein Ereignis eines Fahrzeugs (`Renderer.first`) */
const fxOf = (views: readonly View2D[], e: RideEvent, s: State): RideFx | undefined => {
  for (const v of views) {
    const fx = v.rideFx?.(e, s);
    if (fx) return fx;
  }
  return undefined;
};

/** Auf dem Bahnsteig von Bahnhof Bär neben dem mittleren Wagen, samt Richtung zum Zug */
function onPlatform(): { at: Point; dir: Dir } {
  const st = stationOf(W)!;
  const row = st.rows[SEAT]!;
  const lane = st.line[SEAT]!;
  const dir = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(
    ([, [dx, dy]]) => row.edge[0] + dx === lane[0] && row.edge[1] + dy === lane[1],
  )![0];
  return { at: row.edge, dir };
}

function play(s: State, cmds: readonly Cmd[], rules: readonly (typeof EIS_PACK)[]) {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, W, c, undefined, undefined, [...rules, FAHRT_PACK]);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
const rideEvents = (e: readonly GameEvent[]) => e.filter((x): x is RideEvent => x.type === 'ride');
const TICK: Cmd = { type: 'tick' };

function awake(p: Point): State {
  const s = initialState(W, { packs: PACKS, openGates: ['eis'] });
  return { ...s, sleeping: false, wokeAt: -100, player: { x: p[0], y: p[1], dir: 's' }, animals: [] };
}

describe('Schlitten und Zug in einem Spiel: jedes Fahrzeug antwortet nur auf seine Fahrt', () => {
  const { at, dir } = onPlatform();
  const r = sledRoute(W)!;

  it('die Welt hat beides: Schlitten mit Halt auf der Lichtung und den Zug an Bahnhof Bär', () => {
    expect(r).toBeDefined();
    expect(W.realm(...r.stops.out)).toBe('lichtung');
    expect(W.realm(...at)).toBe('lichtung');
  });

  it.each(ORDERS)(
    '%s: in den Zug gestiegen sitzt die Figur im Zug; der Schlitten steht still an seinem Halt',
    (_, packs) => {
      const views = viewsOf(packs);
      const before = awake(at);
      const run = play(before, [{ type: 'move', dir, fresh: true }], packs);
      expect(run.s.ride?.id).toBe('hoehle');
      const sledNow = sledBodies(run.s, W, AT);
      // der Schlitten wie ohne Fahrt: nicht unterwegs, ohne Figur, ohne Sitz (vorher sprang er auf seine Strecke)
      expect(sledNow).toEqual(sledBodies({ ...run.s, ride: undefined }, W, AT));
      expect(sledNow.some((b) => b.seat)).toBe(false);
      const go = play(
        run.s,
        Array.from({ length: 30 }, () => TICK),
        packs,
      ).s; // unterwegs
      expect(go.ride?.id).toBe('hoehle');
      for (const s of [run.s, go]) {
        const all = bodiesOf(views, s);
        expect(all.filter((b) => b.seat).map((b) => rideOfBody(b.id))).toEqual(['hoehle']);
        expect(rideOfBody(seatOf(all)!.id)).toBe('hoehle');
        expect(sledBodies(s, W, AT).some((b) => b.seat || b.key.split(':').at(-1)?.[3] === '1')).toBe(false);
      }
      // Ton und Freude: das Einsteigen in den Zug klingt wie der Zug, nie wie der Schlitten
      const board = rideEvents(run.events).find((e) => e.what === 'board')!;
      expect(board.id).toBe('hoehle');
      expect(fxOf(views, board, run.s)).toEqual(trainFx(board, run.s));
      expect(fxOf(views, board, run.s)?.score).not.toEqual(sledFx(board, run.s).score);
    },
  );

  it.each(ORDERS)(
    '%s: im Schlitten sitzt die Figur im Schlitten; der Zug hat keinen Sitz und klingt nicht',
    (_, packs) => {
      const views = viewsOf(packs);
      const ride: Ride = {
        id: 'schlitten',
        phase: 'go',
        at: 0,
        pos: 5,
        speed: 0.5,
        to: 'home',
        feast: false,
        jingleAt: 0,
        greeted: [],
      };
      const s = { ...awake(r.path[r.path.length - 1 - 5]!), ride };
      const all = bodiesOf(views, s);
      expect(all.filter((b) => b.seat).map((b) => rideOfBody(b.id))).toEqual(['schlitten']);
      const board: RideEvent = { type: 'ride', id: 'schlitten', what: 'board', x: s.player.x, y: s.player.y };
      expect(fxOf(views, board, s)).toEqual(sledFx(board, s));
      expect(trainFx(board, s)).toBeUndefined();
    },
  );

  it('die Laternenfahrt des Zugs lässt die Schneespur des Schlittens, wie sie ist', () => {
    const feast: Ride = {
      id: 'hoehle',
      phase: 'go',
      at: 0,
      pos: 3,
      speed: 0.5,
      to: 'home',
      feast: true,
      jingleAt: 0,
      greeted: [],
    };
    const s = awake(at);
    expect(sledMarks({ ...s, ride: feast }, W)).toEqual(sledMarks(s, W));
  });

  it('der Kern hält es auch so: meldet ein fremdes Fahrzeug einen Sitz, sitzt die Figur doch nur in ihrem', () => {
    const stray: RideBody = { id: 'ride:schlitten', key: 'k', x: 1, y: 1, z: 1, dir: 'n', parts: [], seat: true };
    const own: RideBody = { id: 'ride:hoehle:mitte', key: 'm', x: 5, y: 5, z: 1, dir: 'n', parts: [], seat: true };
    expect(seatOf(ownSeat([stray, own], 'hoehle'))).toEqual(own);
    expect(seatOf(ownSeat([stray, own], undefined))).toBeUndefined(); // ohne Fahrt sitzt sie nirgends
    const list = [own];
    expect(ownSeat(list, 'hoehle')).toBe(list); // nichts zu tun: dieselbe Liste
  });
});
