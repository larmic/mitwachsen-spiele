import { afterEach, describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { BAHN_LIVE, tryBahn } from '../../../../data/games/mitwachsen-live';
import { bahnWanted } from '../../mitwachsen-pack';
import { initialState, step, type GameEvent, type State } from '../../mitwachsen-state';
import type { Cell } from '../../mitwachsen-cell';
import type { World } from '../../mitwachsen-world';
import { BAHN_PACK, BUILT, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { withBuilt } from './mitwachsen-built';
import { layStones } from './mitwachsen-stones';

const SEED = 1;
const W1 = worldOf(SEED, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 1 } });
const W2 = worldOf(SEED, [HOEHLE_PACK, BAHN_PACK], BUILT);
const TRAIN_STONES = ['bahnhof', 'lokschuppen'];
const trainStones = (w: World) => [...w.stones.keys()].filter((id) => TRAIN_STONES.includes(id)).sort();

/** Vom Nachbarfeld in den Stein laufen: die Ereignisse dieses Schritts */
function walkInto(w: World, stone: Point, packs: Record<string, unknown>): GameEvent[] {
  const [dir, [dx, dy]] = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(([, [dx, dy]]) => {
    const c = w.cell(stone[0] - dx, stone[1] - dy);
    return !c.solid && c.ground !== 'water';
  })!;
  const s0 = initialState(w, { packs, openGates: ['eis'] });
  const s: State = {
    ...s0,
    sleeping: false,
    wokeAt: -100,
    player: { x: stone[0] - dx, y: stone[1] - dy, dir },
    animals: [],
  };
  return step(s, w, { type: 'move', dir, fresh: true }).events;
}

describe('Klangsteine der Bahn (mitwachsen-stones.ts)', () => {
  afterEach(() => tryBahn(false));

  it('Freigabe (beide Stellungen): bis zum Freischalten holt das Spiel das Paket nie, also gibt es keinen Stein der Bahn', () => {
    expect(BAHN_LIVE).toBe(false);
    expect(bahnWanted({ openGates: ['eis'] })).toBe(false);
    const cave = worldOf(SEED, [HOEHLE_PACK]); // wie für das Kind (die Grotte nur im Blick hinein)
    expect(trainStones(cave)).toEqual([]);
    expect(cave.stones.has('hoehle-offen')).toBe(true); // der Stein am Höhlenbett gehört der Grotte, nicht der Bahn
    // angeschaltet (Entwickler-Schalter `tryBahn`, oder später `BAHN_LIVE`): mit dem Paket kommen sie mit dem Ausbau
    tryBahn();
    expect(bahnWanted({ openGates: ['eis'] }, true)).toBe(true);
    expect(trainStones(W1)).toEqual(['bahnhof']);
  });

  it('vor Ausbau 1 setzt das Paket keinen Stein, mit Ausbau 1 den am Bahnhof Bär, mit Ausbau 2 auch den am Lokschuppen', () => {
    const map = new Map<string, Cell>();
    const beds = new Map([['lichtung' as const, { bed: [0, 0] as Point, wake: [] }]]);
    expect(layStones({ map, beds, packs: {} }, null)).toEqual([]);
    expect(layStones({ map, beds, packs: withBuilt({}, 1) }, null)).toEqual([]); // ohne Gleis keine Steine
    expect(trainStones(W1)).toEqual(['bahnhof']);
    expect(trainStones(W2)).toEqual(['bahnhof', 'lokschuppen']);
    expect(W1.stones.get('bahnhof')).toEqual(W2.stones.get('bahnhof'));
    // Bau 2 im Spiel: Die Welt baut neu (`relay`), der Stein am Lokschuppen kommt dazu, als Feld und in `stones`
    const relaid = W1.relay(BUILT).world;
    expect(trainStones(relaid)).toEqual(['bahnhof', 'lokschuppen']);
    const shed = relaid.stones.get('lokschuppen')!;
    expect(relaid.cell(...shed)).toMatchObject({ deco: 'klangstein', story: 'lokschuppen', solid: true });
    expect(W1.cell(...shed)).toMatchObject({ stone: 'lokschuppen', solid: false }); // vorher nur frei gehalten
    expect(W1.cell(...shed).story).toBeUndefined();
  });

  it('hineinlaufen erzählt die Geschichte des Steins: am Bahnhof Bär `bahnhof`, am Lokschuppen `lokschuppen`', () => {
    const bear = walkInto(W2, W2.stones.get('bahnhof')!, BUILT).filter((e) => e.type === 'story');
    expect(bear).toEqual([{ type: 'story', id: 'bahnhof', first: true }]);
    const shed = walkInto(W2, W2.stones.get('lokschuppen')!, BUILT).filter((e) => e.type === 'story');
    expect(shed).toEqual([{ type: 'story', id: 'lokschuppen', first: true }]);
  });
});
