// Bild und Ton des Grubenbähnchens Funkel (Rückmeldung zur Höhle, Schritt 15): Körper am Halt und unterwegs, Gold nur an
// der Tür bis zur ersten Fahrt, eigenes schmales Gleisbild, Töne in der Pentatonik
import { describe, expect, it } from 'vitest';
import type { Part } from '../../../../lib/games/front';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { FUNKEL_COLORS, GRUBE_RAIL, funkelParts } from '../../../../data/games/worlds/grube/mitwachsen-funkel-model';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { withRidden } from '../../mitwachsen-ride-save';
import type { RideAt } from '../../mitwachsen-ride-view';
import { initialState, type State } from '../../mitwachsen-state';
import { DUG, GRUBE_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { FUNKEL, funkelRoute } from './mitwachsen-funkel';
import { FUNKEL_ID, JUMP, funkelBodies, funkelFx, funkelScores, grubeRails, railShape } from './mitwachsen-funkel-look';
import { pack } from './index';

const world = worldOf(1, [HOEHLE_PACK, GRUBE_PACK], DUG);
const route = funkelRoute(world, { packs: DUG })!;
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const colors = (parts: readonly Part[]) => new Set(parts.flatMap((p) => [p[6], p[7] ?? p[6]]));
const gold = (parts: readonly Part[]) => parts.some((p) => p[6] === GOLD.side || p[7] === GOLD.top);
const PENTA = [0, 2, 4, 7, 9];
const penta = (hz: number) => PENTA.includes(((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12);

/** Wach in der Grotte, auf dem Bahnsteig neben dem Halt */
function inCave(packs: Record<string, unknown> = DUG, more: Partial<State> = {}): State {
  const s = initialState(world, { packs });
  const [x, y] = route.seats.home[0]!;
  return { ...s, sleeping: false, player: { x, y, dir: 'n' }, animals: [], ...more };
}

describe('Bild von Funkel', () => {
  it('am Halt: Lok vorn, erster Wagen am Sitz, zweiter dahinter, jeder in Fahrtrichtung; nur in der Grotte', () => {
    const bodies = funkelBodies(inCave(), world, AT);
    expect(bodies.map((b) => b.id)).toEqual([`${FUNKEL_ID}:loco`, `${FUNKEL_ID}:seat`, `${FUNKEL_ID}:rear`]);
    const [loco, seat, rear] = bodies;
    expect([seat!.x, seat!.y]).toEqual(route.stops.home);
    expect([loco!.x, loco!.y]).toEqual(route.path[1]);
    expect([rear!.x, rear!.y]).toEqual(route.path.at(-2));
    expect(bodies.some((b) => b.seat)).toBe(false); // ohne Fahrt sitzt niemand drin
    const bed = world.homes.lichtung.bed;
    expect(funkelBodies(inCave(DUG, { player: { x: bed[0], y: bed[1], dir: 's' } }), world, AT)).toEqual([]);
    expect(funkelBodies(inCave({}), world, AT)).toEqual([]); // vor dem Graben kein Bähnchen
  });

  it('Petrol und Creme; Gold nur am Rahmen der Tür des ersten Wagens bis zur ersten Fahrt, nicht wenn es schläft', () => {
    const bodies = funkelBodies(inCave(), world, AT);
    const all = colors(bodies.flatMap((b) => b.parts));
    expect(all.has(FUNKEL_COLORS.petrol[0])).toBe(true);
    expect(all.has(FUNKEL_COLORS.cream[0])).toBe(true);
    expect(bodies.filter((b) => gold(b.parts)).map((b) => b.id)).toEqual([`${FUNKEL_ID}:seat`]);
    const after = funkelBodies(inCave(withRidden({ ...DUG }, 'grube')), world, AT);
    expect(after.some((b) => gold(b.parts))).toBe(false);
    const dozing = funkelBodies(inCave(DUG, { dozing: ['grube'] }), world, AT);
    expect(dozing.some((b) => gold(b.parts))).toBe(false);
    // während einer Fahrt kein Gold, auch nicht in der ersten eigenen (dort gibt es nichts zu tun), wie beim Zug
    const going = {
      phase: 'go',
      at: 0,
      pos: 10,
      speed: 0.8,
      to: 'home',
      feast: false,
      jingleAt: 0,
      greeted: [],
    } as const;
    for (const id of ['grube', 'hoehle'] as const) {
      const riding = funkelBodies(inCave(DUG, { ride: { ...going, id, greeted: [] } }), world, AT);
      expect(riding.some((b) => gold(b.parts))).toBe(false);
    }
    // die Tür geht zum Bahnsteig auf, wenn das Kind anstößt
    const nudged = funkelBodies(inCave(DUG, { nudged: { id: 'grube', at: 0 }, tick: 3 }), world, AT);
    expect(nudged[1]!.parts.length).toBe(bodies[1]!.parts.length + 1);
  });

  it('keine Augen, kein Gesicht im Dunkeln: die runde Lampe ist sein Gesicht; sie leuchtet beim Fahren und am Abend', () => {
    for (const kind of ['loco', 'seat', 'rear'] as const)
      for (const lit of [false, true]) expect(funkelParts({ kind, lit }).some((p) => p[8] === 'f')).toBe(false);
    const off = colors(funkelParts({ kind: 'loco' }));
    const on = colors(funkelParts({ kind: 'loco', lit: true }));
    expect(off.has(FUNKEL_COLORS.lamp) && !off.has(FUNKEL_COLORS.lit)).toBe(true);
    expect(on.has(FUNKEL_COLORS.lit)).toBe(true);
    const evening = funkelBodies(inCave(), world, { ...AT, lit: true });
    expect(colors(evening[0]!.parts).has(FUNKEL_COLORS.lit)).toBe(true);
    // am Halt leuchtet die Lampe am Abend: die Dunkelmaske öffnet dort ein kleines Loch (`glow`), ohne Licht nicht
    expect(evening.filter((b) => b.glow).map((b) => b.id)).toEqual([`${FUNKEL_ID}:loco`]);
    expect(funkelBodies(inCave(), world, AT).some((b) => b.glow)).toBe(false);
  });

  it('unterwegs: die Figur sitzt im ersten Wagen, die Wagen gleiten; bei reduzierter Bewegung in Sprüngen', () => {
    const ride = {
      id: 'grube',
      phase: 'go',
      at: 0,
      pos: 40.5,
      speed: 0.8,
      to: 'home',
      feast: false,
      jingleAt: 0,
      greeted: [],
    } as const;
    const s = inCave(DUG, { ride: { ...ride, greeted: [] } });
    const bodies = funkelBodies(s, world, AT);
    expect(bodies.find((b) => b.seat)?.id).toBe(`${FUNKEL_ID}:seat`);
    expect(colors(bodies[0]!.parts).has(FUNKEL_COLORS.lit)).toBe(true);
    expect(bodies.some((x) => x.glow)).toBe(false); // beim Fahren öffnet die Maske um Sitz und Lampe (`seat`)
    const [a, b] = [route.path[40]!, route.path[41]!];
    expect(bodies[1]!.x).toBeCloseTo(a[0] + (b[0] - a[0]) * 0.5);
    expect(bodies[1]!.y).toBeCloseTo(a[1] + (b[1] - a[1]) * 0.5);
    const calm = funkelBodies(s, world, { ...AT, reduced: true });
    const jump = route.path[Math.floor(40.5 / JUMP) * JUMP]!;
    expect([calm[1]!.x, calm[1]!.y]).toEqual(jump);
    // fährt die Figur mit einem anderen Fahrzeug, steht Funkel am Halt, ohne sie
    const other = funkelBodies({ ...s, ride: { ...s.ride!, id: 'hoehle' } }, world, AT);
    expect(other.some((x) => x.seat)).toBe(false);
  });

  it('eigenes schmales Gleis: gerade und Kurven in allen Richtungen, im Feld (die Farben gegen das Gleis der Höhlenbahn prüft mitwachsen-ride-mix.test.ts)', () => {
    for (const to of ['ns', 'ew', 'ne', 'es', 'sw', 'wn']) {
      const shape = railShape(to)!;
      expect(shape.length).toBeGreaterThan(3);
      for (const [x, y, , w, d] of shape) {
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(x + w).toBeLessThanOrEqual(1 + 1e-9);
        expect(y + d).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    expect(railShape('nn')).toBeUndefined();
    expect(new Set(railShape('ns')!.flatMap((b) => [b[6], b[7]]))).toEqual(
      new Set([...GRUBE_RAIL.sleeper, ...GRUBE_RAIL.rail]),
    );
    // jedes Feld der Runde zeigt sein Gleis; daneben nichts
    const missing = route.path.filter((p) => !grubeRails(world.cell(...p), ...p, { packs: DUG, reduced: false }));
    expect(missing).toEqual([]);
    const [bx, by] = world.homes.hoehle.bed;
    expect(grubeRails(world.cell(bx, by), bx, by, { packs: DUG, reduced: false })).toBeNull();
    expect(pack.view?.rails).toBe(grubeRails);
  });

  it('3D ohne eigenen Teil mit Three.js: dasselbe Gleis aus derselben Datei', async () => {
    const v = await pack.view3d!();
    expect(v.rails).toBe(grubeRails);
  });
});

describe('Töne von Funkel', () => {
  const ev = (what: RideEvent['what'], more: Partial<RideEvent> = {}): RideEvent => ({
    type: 'ride',
    what,
    id: 'grube',
    x: 0,
    y: 0,
    ...more,
  });
  const all: RideEvent['what'][] = [
    'nudge',
    'go',
    'stop',
    'board',
    'arrive',
    'leave',
    'wave',
    'alight',
    'snore',
    'shoo',
  ];

  it('sein Signal D5 → A5 beim Anstoßen und Losfahren, abwärts bei der Ankunft; alles in der C-Pentatonik, leise', () => {
    expect(funkelScores(ev('go')).map(([f]) => f)).toEqual(FUNKEL.signal);
    expect(funkelScores(ev('nudge')).map(([f]) => f)).toEqual(FUNKEL.signal);
    expect(funkelScores(ev('arrive')).map(([f]) => f)).toEqual([...FUNKEL.signal].reverse());
    const tones = all.flatMap((w) => funkelScores(ev(w, { ring: true })));
    expect(tones.filter(([f]) => !penta(f))).toEqual([]);
    expect(Math.max(...tones.map(([, , , gain]) => gain))).toBeLessThanOrEqual(0.06);
    // nie mehr als zwei Töne zugleich (weit unter den sechs Stimmen von sfx.ts)
    for (const w of all) {
      const score = funkelScores(ev(w, { ring: true }));
      const at = (t: number) => score.filter(([, len, , , , d]) => d <= t && t < d + len).length;
      expect(Math.max(0, ...score.map(([, , , , , d]) => at(d)))).toBeLessThanOrEqual(2);
    }
  });

  it('antwortet nur auf seine eigenen Ereignisse; Figur hüpft beim Winken und Aussteigen, Zzz beim Schlafen', () => {
    expect(funkelFx(ev('go', { id: 'hoehle' }))).toBeUndefined();
    expect(funkelFx(ev('board', { id: 'schlitten' }))).toBeUndefined();
    expect(funkelFx(ev('alight'))).toMatchObject({ who: 'player', heart: true });
    expect(funkelFx(ev('wave'))).toMatchObject({ who: 'player' });
    expect(funkelFx(ev('shoo', { who: 'a' }))).toMatchObject({ who: 'a' });
    expect(funkelFx(ev('snore'))).toMatchObject({ zzz: true });
    expect(pack.view?.rideFx === funkelFx).toBe(true);
  });
});
