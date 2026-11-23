import { describe, expect, it } from 'vitest';
import type { Point } from '../../data/games/mitwachsen';
import { PORTALS, PORTAL_IDS, type PortalId } from '../../data/games/mitwachsen-portals';
import {
  BED_ARRIVAL,
  PLATFORM_HALF,
  PORTAL_WAKE,
  RING_GAP,
  platformArea,
  platformCells,
  platformLift,
  platformsToWake,
  portalColor,
  ringSpots,
  stepOn,
  type PlatformSpot,
  type Portal,
} from './mitwachsen-portal';

const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const portals = new Map<PortalId, Portal>([
  ['eis', { gate: [50, 0], home: [9, 0] }],
  ['lava', { gate: [-50, 0], home: [-9, 0] }],
]);
/** Was auf einem Feld liegt: die Plattformen aus `portals` */
const spotAt = (x: number, y: number): PlatformSpot | undefined => {
  for (const [id, p] of portals)
    for (const side of ['gate', 'home'] as const) {
      const c = platformCells(p[side]).find((f) => f.x === x && f.y === y);
      if (c) return { id, side, at: c.at };
    }
  return undefined;
};

describe('Portal-Plattformen: Form und Lage', () => {
  it('3 × 3 Felder: eine Mitte, vier Seitenmitten, vier Ecken', () => {
    const cells = platformCells([5, 5]);
    expect(cells).toHaveLength(9);
    expect(cells.filter((c) => c.at === 'centre')).toEqual([{ x: 5, y: 5, at: 'centre' }]);
    expect(cells.filter((c) => c.at === 'edge').map((c) => [c.x, c.y])).toEqual([
      [5, 4],
      [4, 5],
      [6, 5],
      [5, 6],
    ]);
    expect(cells.filter((c) => c.at === 'corner')).toHaveLength(4);
  });

  it('auf dem Sockel steht man höher, auf der Mitte noch etwas mehr; daneben nicht', () => {
    expect(platformLift({})).toBe(0);
    expect(platformLift({ portal: { at: 'edge' } })).toBe(0.25);
    expect(platformLift({ portal: { at: 'centre' } })).toBe(0.375);
  });

  it('im Kreis: wird es beim Runden eng, nimmt eine Plattform die nächste andere Rundung', () => {
    // zwei Winkel so dicht, dass die einfach gerundeten Plätze sich berühren würden
    const angles = [0.1, 0.48];
    const naive = angles.map((a): Point => [Math.round(Math.cos(a) * 9), Math.round(Math.sin(a) * 9)]);
    expect(cheb(naive[0]!, naive[1]!)).toBeLessThan(RING_GAP);
    const spots = ringSpots(angles, 9, [0, 0]);
    expect(cheb(spots[0]!, spots[1]!)).toBeGreaterThanOrEqual(RING_GAP);
    for (const s of spots) expect(Math.abs(Math.hypot(...s) - 9)).toBeLessThan(1);
    // um einen anderen Mittelpunkt verschoben
    expect(ringSpots([0], 9, [3, 4])).toEqual([[12, 4]]);
  });

  it('Plattformen samt Nachbarfeldern sind Durchgänge', () => {
    const area = new Set(platformArea(portals));
    for (const k of ['50,0', '52,0', '48,1', '9,-2', '-9,0', '-11,0']) expect(area.has(k), k).toBe(true);
    for (const k of ['53,0', '52,2', '0,0']) expect(area.has(k), k).toBe(false);
  });
});

describe('Portal-Plattformen: Erwachen', () => {
  const all = () => true;
  it('am Tor, sobald die Figur zwei Felder heran ist, auch schräg; nur, wenn die Mitte erkundet ist', () => {
    const reach = PLATFORM_HALF + PORTAL_WAKE;
    expect(platformsToWake(portals, [], 50 + reach, reach, all)).toEqual(['eis']);
    expect(platformsToWake(portals, [], 50 - reach - 1, 0, all)).toEqual([]);
    expect(platformsToWake(portals, [], 50, 0, () => false)).toEqual([]);
    expect(platformsToWake(portals, ['eis'], 50, 0, all)).toEqual([]); // schon wach
  });

  it('das Gegenstück am Bett weckt nichts', () => {
    expect(platformsToWake(portals, [], 9, 0, all)).toEqual([]);
  });
});

describe('Eis-Portal (Gletscherkessel)', () => {
  const all = () => true;
  // Plattform hinter der Gangmündung, Gegenstück im Kreis um das Schneebett bei (0, 100)
  const ice = new Map<PortalId, Portal>([['eiskessel', { gate: [0, 82], home: [0, 91], bed: [0, 100] }]]);

  it('schläft bis zur ersten Ankunft am Schneebett, dann erwachen beide (nicht durch Nähe zur Plattform)', () => {
    for (const [x, y] of [
      [0, 82], // auf der Plattform hinter der Mündung
      [3, 82],
      [0, 91], // auf dem Gegenstück
      [0, 100 - BED_ARRIVAL - 1], // drei Felder vor dem Bett
    ] as const)
      expect(platformsToWake(ice, [], x, y, all), `${x},${y}`).toEqual([]);
    for (const [x, y] of [
      [0, 100 - BED_ARRIVAL],
      [BED_ARRIVAL, 100 + BED_ARRIVAL], // auch schräg
      [1, 100],
    ] as const)
      expect(platformsToWake(ice, [], x, y, all), `${x},${y}`).toEqual(['eiskessel']);
    expect(platformsToWake(ice, [], 1, 100, (x, y) => !(x === 0 && y === 100))).toEqual([]); // Bett noch im Nebel
    expect(platformsToWake(ice, ['eiskessel'], 1, 100, all)).toEqual([]); // schon wach
  });

  it('Thema Eis (Eisscholle, Schneeflocke) und Gegend Eis-Welt; die Portale der Tore stehen auf der Lichtung', () => {
    expect(PORTALS.eiskessel).toEqual({ theme: 'eis', realm: 'eis' });
    expect(portalColor('eiskessel')).toBe(portalColor('eis'));
    expect(PORTAL_IDS).toHaveLength(10);
    for (const id of PORTAL_IDS.filter((p) => p !== 'eiskessel' && p !== 'hoehlensee'))
      expect(PORTALS[id], id).toEqual({ theme: id, realm: 'lichtung' });
  });
});

describe('Portal am stillen See (Kristallgrotte)', () => {
  const all = () => true;
  const cave = new Map<PortalId, Portal>([
    ['hoehlensee', { gate: [0, 130], home: [0, 19], bed: [0, 28], later: true }],
  ]);

  it('erwacht noch nicht, weder am Höhlenbett noch an der Plattform (erst nach dem Maulwurf, kommt später)', () => {
    for (const [x, y] of [
      [1, 28], // am Bett
      [0, 130], // auf der Plattform am See
      [0, 19], // auf dem Gegenstück
    ] as const)
      expect(platformsToWake(cave, [], x, y, all), `${x},${y}`).toEqual([]);
    // ohne `later` erwachte es am Bett wie das Eis-Portal
    expect(
      platformsToWake(new Map([['hoehlensee', { ...cave.get('hoehlensee')!, later: undefined }]]), [], 1, 28, all),
    ).toEqual(['hoehlensee']);
  });

  it('Thema Höhle (Kristallnest), Gegend Höhlenwelt', () => {
    expect(PORTALS.hoehlensee).toEqual({ theme: 'hoehle', realm: 'hoehle' });
    expect(portalColor('hoehlensee')).toBe(portalColor('hoehle'));
  });
});

describe('Portal-Plattformen: Reisen', () => {
  it('nur auf der Mitte einer wachen Plattform, zum Mittelfeld des Gegenstücks', () => {
    expect(stepOn(portals, spotAt, ['eis'], null, 50, 0)).toEqual({
      arrived: [9, 0],
      ready: null,
      travel: { id: 'eis', to: 'home', at: [9, 0] },
    });
    expect(stepOn(portals, spotAt, ['eis'], null, 9, 0).travel).toEqual({ id: 'eis', to: 'gate', at: [50, 0] });
    // Rand, schlafende Plattform, kein Portal
    expect(stepOn(portals, spotAt, ['eis'], null, 51, 0).travel).toBeNull();
    expect(stepOn(portals, spotAt, [], null, 50, 0).travel).toBeNull();
    expect(stepOn(portals, spotAt, ['eis'], null, 0, 0)).toEqual({ arrived: null, ready: null, travel: null });
  });

  it('angekommen: auf der Mitte bleiben reist nicht; runter macht bereit, wieder rauf reist zurück', () => {
    expect(stepOn(portals, spotAt, ['eis'], [9, 0], 9, 0)).toEqual({ arrived: [9, 0], ready: null, travel: null });
    const off = stepOn(portals, spotAt, ['eis'], [9, 0], 9, 1);
    expect(off).toEqual({ arrived: null, ready: 'eis', travel: null });
    expect(stepOn(portals, spotAt, ['eis'], off.arrived, 9, 0).travel).toEqual({ id: 'eis', to: 'gate', at: [50, 0] });
  });

  it('wer woanders angekommen ist und eine andere Mitte betritt, reist gleich', () => {
    const r = stepOn(portals, spotAt, ['eis', 'lava'], [9, 0], -9, 0);
    expect(r).toEqual({ arrived: [-50, 0], ready: 'eis', travel: { id: 'lava', to: 'gate', at: [-50, 0] } });
  });
});
