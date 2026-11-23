import { describe, expect, it } from 'vitest';
import { RAIL_COLORS } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { Cell, Rail } from '../../mitwachsen-cell';
import { railsOrder } from '../../mitwachsen-view';
import { Views3D } from '../../mitwachsen-view-3d';
import { BAHN_PACK, BUILT, HOEHLE_PACK, SAMPLE_SEEDS, worldOf } from '../../test-worlds';
import { bayAt } from './mitwachsen-bear';
import { LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import { builtOf } from './mitwachsen-built';
import { railBoxes } from './mitwachsen-rail-look';
import { view } from './view-2d';
import { view3d } from './view-3d';
import { pack } from '.';

const cell = (rail?: Rail, h = 1): Cell => ({
  h,
  ground: 'grass',
  deco: null,
  region: 'lichtung',
  solid: false,
  ride: 'hoehle',
  rail,
});
const at = (built?: number) => ({ packs: built === undefined ? {} : { bahn: { built } } });
const has = (boxes: readonly (readonly unknown[])[] | null, color: string) => !!boxes?.some((b) => b.includes(color));

describe('Aussehen des Gleises (2D und 3D gleich)', () => {
  it('in der Tür des Höhlentors liegt das Gleis bei Ausbau 2 unter der Tür: 2D zeichnet es gleich und die Tür darüber', () => {
    const w = worldOf(SAMPLE_SEEDS[0]!, [HOEHLE_PACK, BAHN_PACK], BUILT);
    const door = bayAt(w.gates.get('hoehle')!)(LINE.lane, 0);
    const c = w.cell(...door);
    const boxes = view.rails!(c, ...door, at(2));
    expect(c.gate).toBe('hoehle');
    expect(boxes?.length).toBeGreaterThan(0);
    expect(railsOrder(c, boxes!)).toEqual({ now: boxes, later: [], deco: true });
    // auf freiem Feld wie die Dinge der Welt-Pakete in der Reihe der Vorderkante, ohne Büschel, Blumen und Deko
    const plain = cell({ to: 'ns', stage: 1 });
    const own = railBoxes(plain, 0, 0, at(1))!;
    expect(railsOrder(plain, own)).toEqual({ now: [], later: own, deco: false });
  });

  it('Ausbau aus dem Spielstand: fehlt er oder ist er falsch, 0', () => {
    expect(builtOf({})).toBe(0);
    expect(builtOf({ bahn: { built: 1 } })).toBe(1);
    expect(builtOf({ bahn: { built: 2 } })).toBe(2);
    expect(builtOf({ bahn: { built: 3 } })).toBe(0);
    expect(builtOf({ bahn: 'x' })).toBe(0);
  });

  it('bei Ausbau 0 liegt nichts, bei 1 nur die Lichtung bis zum Prellbock, bei 2 alles', () => {
    const one = cell({ to: 'ns', stage: 1 });
    const two = cell({ to: 'ns', stage: 2 });
    expect(railBoxes(cell(), 0, 0, at(2))).toBeNull(); // Strecke ohne Gleisstück
    expect(railBoxes(one, 0, 0, at())).toBeNull();
    expect(railBoxes(one, 0, 0, at(1))?.length).toBeGreaterThan(0);
    expect(railBoxes(two, 0, 0, at(1))).toBeNull();
    expect(railBoxes(two, 0, 0, at(2))?.length).toBeGreaterThan(0);
  });

  it('Holzschwellen und graue Schienen auf dem Boden, im Feld, gerade und als Kurve gedreht', () => {
    for (const to of ['ns', 'ew', 'ne', 'es', 'sw', 'nw', 'n', 's']) {
      const boxes = railBoxes(cell({ to, stage: 1 }, 2), 5, 7, at(1))!;
      expect(has(boxes, RAIL_COLORS.sleeper[0]) && has(boxes, RAIL_COLORS.rail[0]), to).toBe(true);
      for (const [x, y, z, w, d] of boxes) {
        expect(x >= 5 - 1e-9 && x + w <= 6 + 1e-9 && y >= 7 - 0.06 && y + d <= 8 + 1e-9, `${to}: ${x},${y}`).toBe(true);
        expect(z).toBeGreaterThanOrEqual(2); // auf dem Boden des Felds (Höhe 2)
      }
    }
    // gerade von oben nach unten: Schienen längs (tief), von links nach rechts: Schienen quer (breit)
    const rails = (to: string) =>
      railBoxes(cell({ to, stage: 1 }), 0, 0, at(1))!.filter((b) => b[6] === RAIL_COLORS.rail[0]);
    expect(rails('ns').every((b) => b[4] === 1)).toBe(true);
    expect(rails('ew').every((b) => b[3] === 1)).toBe(true);
  });

  it('Prellbock an den Enden der Linie, vor der Tür nur solange der Ausbau 1 ist', () => {
    const red = RAIL_COLORS.buffer[0];
    expect(has(railBoxes(cell({ to: 'n', stage: 1, part: 'end' }), 0, 0, at(1)), red)).toBe(true);
    expect(has(railBoxes(cell({ to: 'n', stage: 2, part: 'end' }), 0, 0, at(2)), red)).toBe(true);
    const door = cell({ to: 'ew', stage: 1, part: 'buffer' });
    expect(has(railBoxes(door, 0, 0, at(1)), red)).toBe(true);
    expect(has(railBoxes(door, 0, 0, at(2)), red)).toBe(false); // weiter durch die Tür
    expect(has(railBoxes(cell({ to: 'ns', stage: 1 }), 0, 0, at(1)), red)).toBe(false);
  });

  it('Tunnelportal aus Stein mit Grasdach, Einschnitt mit niedrigen Wänden, quer zum Gleis', () => {
    const portal = railBoxes(cell({ to: 'ew', stage: 1, part: 'portal' }), 0, 0, at(1))!;
    expect(has(portal, RAIL_COLORS.stone[0]) && has(portal, RAIL_COLORS.grass[0])).toBe(true);
    expect(Math.max(...portal.map((b) => b[2] + b[5]))).toBeGreaterThan(1.5); // das Dach über dem Zug
    const pillars = portal.filter((b) => b[5] === 1.5);
    expect(pillars.map((b) => b[1]).sort()).toEqual([0, 0.86]); // links und rechts der Fahrt (oben und unten im Bild)
    const cut = railBoxes(cell({ to: 'ns', stage: 1, part: 'cut' }), 0, 0, at(1))!;
    const walls = cut.filter((b) => b[6] === RAIL_COLORS.stone[0]);
    expect(walls).toHaveLength(2);
    expect(walls.every((b) => b[5] < 0.5 && b[4] === 1)).toBe(true); // niedrig, oben offen, längs
  });

  it('kein Gold (die Aktionsfarbe) am Gleis', () => {
    const all = Object.values(RAIL_COLORS).flat();
    expect(all.some((c) => /^#f0a5|^#ffd4/i.test(c))).toBe(false);
  });

  it('Paket: 2D und 3D zeichnen dasselbe Gleis, die 3D-Ansicht baut bei neuem Ausbau neu', async () => {
    expect(pack.id).toBe('bahn');
    expect(pack.gate).toBeUndefined(); // keine eigene Welt hinter einem Tor
    expect(view.rails).toBe(railBoxes);
    expect(view.sky).toBeUndefined();
    expect(view3d.rails).toBe(railBoxes);
    expect(view3d.stamp?.({})).not.toBe(view3d.stamp?.({ bahn: { built: 1 } }));
    const views = new Views3D();
    await views.use(pack, () => {});
    const c = cell({ to: 'ns', stage: 1 });
    expect(views.rails(c, 0, 0, at(1))).toEqual(railBoxes(c, 0, 0, at(1)));
    expect(views.stamp({ bahn: { built: 2 } })).toBe('bahn2');
    expect(views.look('hoehle')).toBeUndefined();
  });
});
