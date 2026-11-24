// Farben der Grotte (Konzept „Höhle nach dem ersten Spielen“, Punkt 4, Schritt 7): Stalagmiten und Felsbrocken mit
// dunklem Fuß und der Farbe ihrer Zone an der Spitze, Flecken im Grottenboden in 2D, der Boden in 3D etwas dunkler, und
// der reine Kontrasttest mit den echten Farben: dunkle Dinge gegen den Boden, Leuchtendes gegen die Maske, Gold gegen den
// Boden. Helligkeit heißt relative Luminanz (wie WCAG), Kontrast (L1 + 0,05) / (L2 + 0,05).
import { describe, expect, it } from 'vitest';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { SHROOM_COLORS } from '../../../../data/games/mitwachsen-hoehle';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { Box } from '../../mitwachsen-view';
import { caveBoxes, columnBoxes, lighten, patchOf } from './mitwachsen-cave-look';
import { fromMouth } from './mitwachsen-grotte';
import { tipOf } from './mitwachsen-fill';
import { FLOOR, brightness, masked, rgbOf, type Rgb } from './mitwachsen-mask';
import { view } from './view-2d';
import { view3d } from './view-3d';

const C = GROTTE_COLORS;
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [brightness(a), brightness(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Jeder Boden der Grotte, wie er gezeichnet wird: 2D (Kern) mit beiden Flecken, 3D */
const FLOORS: [string, Rgb][] = [
  ['2D', FLOOR],
  ['Fleck kühl', rgbOf(C.patches[0])],
  ['Fleck rosé', rgbOf(C.patches[1])],
  ['3D', rgbOf(C.floor)],
];
/** Boden unter der vollen Maske (abseits der Figur), auch auf den Flecken */
const DARK = FLOORS.map(([name, c]): [string, Rgb] => [name, masked(c, GROTTE.dark.mask)]);
/** Was leuchtet: Kristalle (auch Büsche, Lampen, Bogen, Säulen), Leuchtpilze (auch Beete und Schale) */
const GLOWING = [...C.crystals, ...SHROOM_COLORS];

/** Farbton (0 … 360) und Sättigung (HSL, 0 … 1) */
function hueSat(hex: string): [number, number] {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255) as unknown as [number, number, number];
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const d = max - min;
  if (d === 0) return [0, 0];
  const hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, d / (1 - Math.abs(max + min - 1))];
}
/** Liest sich als Gold: Farbton nahe dem des Golds (±15°, Gold selbst: 37°, 0,86) und nicht grau, oder Gelb bis Orange kräftig */
const GOLD_HUE = hueSat(GOLD.top)[0];
const goldish = (hex: string) => {
  const [h, s] = hueSat(hex);
  return (Math.abs(h - GOLD_HUE) <= 15 && s > 0.35) || (h >= 20 && h <= 65 && s > 0.6);
};
/** Liest sich als Wasser: Türkis bis Blau */
const watery = (hex: string) => {
  const [h, s] = hueSat(hex);
  return h >= 160 && h <= 220 && s > 0.3;
};

const cell = (deco: Cell['deco'], extra: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grotto',
  deco,
  region: 'hoehle',
  solid: !!deco,
  biome: 'hoehle',
  ...extra,
});
const world = { homes: { hoehle: { shelterStem: [0, 0], shelter: { x0: 0, x1: 0, y1: 0 } } } } as never;
const lowest = (boxes: readonly Box[]) => boxes.reduce((a, b) => (b[2] < a[2] ? b : a));
const highest = (boxes: readonly Box[]) => boxes.reduce((a, b) => (b[2] > a[2] ? b : a));

describe('Farben der Grotte: Kontrast mit den echten Farben', () => {
  it('dunkle Dinge gegen den Boden mindestens 3 : 1: Fuß und Mitte der Stalagmiten und Felsbrocken auf jedem Boden (2D, Flecken, 3D)', () => {
    const bad = C.stal.flatMap((c) =>
      FLOORS.filter(([, f]) => contrast(rgbOf(c), f) < 3).map(
        ([n, f]) => `${c} auf ${n}: ${contrast(rgbOf(c), f).toFixed(2)}`,
      ),
    );
    expect(bad).toEqual([]);
    // der Fuß wie im Konzept, etwa 4 : 1 gegen den Boden in 2D
    expect(C.stal[0]).toBe('#5a5478');
    expect(contrast(rgbOf(C.stal[0]), FLOOR)).toBeGreaterThan(4);
  });

  it('Leuchtendes gegen die Maske mindestens 3 : 1: Kristalle und Leuchtpilze gegen den Boden unter der vollen Maske, auch auf den Flecken', () => {
    const bad = GLOWING.flatMap((c) =>
      DARK.filter(([, f]) => contrast(rgbOf(c), f) < 3).map(
        ([n, f]) => `${c} über ${n}: ${contrast(rgbOf(c), f).toFixed(2)}`,
      ),
    );
    expect(bad).toEqual([]);
    // Säulen leuchten in den Farben der Kristalle (beim Klingen noch heller)
    const column = columnBoxes(cell('column', { note: 0 }), 3, 4)[1]!;
    expect(C.crystals).toContain(column[6]);
    expect(brightness(rgbOf(lighten(C.crystals[0], 0.3)))).toBeGreaterThan(brightness(rgbOf(C.crystals[0])));
  });

  it('Gold gegen den Boden: im Licht die Seite des Golds mindestens 2,4 : 1 auf jedem Boden, im Dunkel sein Licht mindestens 3 : 1', () => {
    for (const [name, f] of FLOORS) expect(contrast(rgbOf(GOLD.side), f), name).toBeGreaterThanOrEqual(2.4);
    for (const [name, f] of DARK) expect(contrast(rgbOf(GOLD.light), f), name).toBeGreaterThanOrEqual(3);
    // der Boden bleibt hell: Die Flecken sind kaum dunkler als er, der Boden in 3D heller als in 2D (die Maske rechnet mit 2D)
    for (const p of C.patches) expect(brightness(rgbOf(p))).toBeGreaterThan(brightness(FLOOR) * 0.85);
    expect(brightness(rgbOf(C.floor))).toBeGreaterThan(brightness(FLOOR));
  });

  it('keine neue Farbe liest sich als Gold, Türkis bleibt dem Wasser: Spitzen, Fuß und Flecken', () => {
    // auch die hellen Tupfen obenauf, wie sie gezeichnet werden
    const tips = Object.values(C.tips);
    const own = [...tips, ...tips.map((c) => lighten(c, 0.3)), ...C.stal, ...C.patches];
    expect(own.filter(goldish)).toEqual([]);
    expect(own.filter(watery)).toEqual([]);
    expect(own.filter((c) => Object.values(GOLD).includes(c as never))).toEqual([]);
    expect(watery(C.water[0])).toBe(true); // die Probe trifft das Wasser
    expect(goldish(GOLD.top)).toBe(true); // und das Gold
    expect(goldish('#c99a5a')).toBe(true); // auch ein Ocker nahe am Gold (der erste Entwurf des Lehmhangs)
  });
});

describe('Farben je Zone (`tipOf`)', () => {
  it('Pilzgarten grün, Kristallhalle lila, Tropfsteingrotte rosa, Lehmhang ocker; je Zone eine eigene Farbe', () => {
    const { garden, hall, drip, clay } = GROTTE;
    expect(tipOf(...fromMouth([garden.across, garden.out]))).toBe(C.tips.garden);
    expect(tipOf(...fromMouth([hall.across, hall.out]))).toBe(C.tips.hall);
    expect(tipOf(...fromMouth([drip.across, drip.out]))).toBe(C.tips.drip);
    // der ganze Hang, auch an beiden Enden (er liegt von `out - long/2` bis `out + long/2` um `out`)
    for (const dv of [-(clay.long >> 1), 0, clay.long >> 1])
      for (const du of [0, 2 * clay.step - 1])
        expect(tipOf(...fromMouth([clay.across - du, clay.out + dv])), `${du} ${dv}`).toBe(C.tips.clay);
    expect(C.tips).toEqual({ garden: '#86b45a', hall: '#8f6ad8', drip: '#c0609a', clay: '#a9825e' });
    expect(new Set(Object.values(C.tips)).size).toBe(4);
  });

  it('der See hat keine eigene Farbe (Türkis nur fürs Wasser): dort und am Ende die Tropfsteingrotte', () => {
    expect(tipOf(...fromMouth([GROTTE.lake.across, GROTTE.lake.out]))).toBe(C.tips.drip);
    expect(tipOf(...fromMouth(GROTTE.portal))).toBe(C.tips.drip);
    // überall in der Grotte eine der vier Farben
    const seen = new Set<string>();
    for (let v = -GROTTE.shape.ry; v <= GROTTE.shape.ry; v += 4)
      for (let u = -GROTTE.shape.rx; u <= GROTTE.shape.rx; u += 4) seen.add(tipOf(u, v));
    expect([...seen].sort()).toEqual(Object.values(C.tips).sort());
  });
});

describe('Stalagmiten und Felsbrocken: dunkler Fuß, Spitze in der Farbe der Zone', () => {
  it('Stalagmit: unten der Fuß, oben die Spitze in seiner Farbe (`Cell.color`) mit hellem Tupfen; drei Höhen wie bisher', () => {
    for (const note of [0, 1, 2]) {
      const boxes = caveBoxes(world, cell('stalagmite', { note, color: C.tips.drip }), 3, 4)!;
      expect(lowest(boxes)[6]).toBe(C.stal[0]);
      expect(highest(boxes)[6]).toBe(C.tips.drip);
      expect(highest(boxes)[7]).toBe(lighten(C.tips.drip, 0.3));
      const top = Math.max(...boxes.map((b) => b[2] + b[5]));
      expect(top).toBeCloseTo(1 + 1.15 * (1 + note * 0.5), 5);
    }
    // ohne Farbe (ältere Felder) lila wie die Halle; draußen in der Landschaft zeichnet die Ansicht wie immer
    expect(highest(caveBoxes(world, cell('stalagmite'), 0, 0)!)[6]).toBe(C.tips.hall);
    expect(caveBoxes(world, cell('stalagmite', { region: 'wild' }), 0, 0)).toBeNull();
  });

  it('Felsbrocken: dunkler Fuß, obenauf eine Kappe in seiner Farbe; draußen wie immer', () => {
    const boxes = caveBoxes(world, cell('boulder', { color: C.tips.clay }), 3, 4)!;
    expect(lowest(boxes)[6]).toBe(C.stal[0]);
    expect(highest(boxes).slice(6, 8)).toEqual([C.tips.clay, lighten(C.tips.clay, 0.3)]);
    expect(caveBoxes(world, cell('boulder', { region: 'wild' }), 0, 0)).toBeNull();
  });
});

describe('Flecken im Grottenboden (2D) und Boden in 3D', () => {
  const { cool, warm } = GROTTE.patch;
  it('2D: wo das Rauschen des Bodens unter `cool` liegt kühl lila, über `warm` zart rosé, dazwischen nichts', () => {
    expect(patchOf(cell(null, { shade: cool - 0.1 }))).toBe(C.patches[0]);
    expect(patchOf(cell(null, { shade: warm + 0.1 }))).toBe(C.patches[1]);
    expect(patchOf(cell(null, { shade: 0 }))).toBeUndefined();
    expect(patchOf(cell(null))).toBeUndefined();
    const flat = view.ground(cell(null, { shade: -1 }), 2, 3, false)!;
    expect(flat).toEqual([2, 3, 1, 1, 1, 0.01, C.patches[0], C.patches[0]]);
    expect(view.ground(cell(null, { shade: 0 }), 2, 3, false)).toBeNull();
  });

  it('2D: Licht und Randschatten haben Vorrang; kein Fleck auf Moos, Steg, Fels oder draußen', () => {
    expect(view.ground(cell(null, { shade: -1, light: 0.3 }), 2, 3, false)?.[6]).not.toBe(C.patches[0]);
    expect(view.ground(cell(null, { shade: -1, dim: 0.2 }), 2, 3, false)?.[6]).not.toBe(C.patches[0]);
    for (const c of [
      cell(null, { shade: -1, ground: 'grass' }),
      cell('jetty', { shade: -1, ground: 'path' }),
      cell('rock', { shade: -1, region: 'border' }),
      cell(null, { shade: -1, region: 'wild' }),
    ])
      expect(patchOf(c), `${c.ground} ${c.region}`).toBeUndefined();
  });

  it('3D: der Boden etwas dunkler als früher (#e6e2f2), ohne Flecken', () => {
    expect(view3d.ground(cell(null), [])?.top).toBe(C.floor);
    expect(view3d.ground(cell(null, { shade: -1 }), [])?.top).toBe(C.floor);
    expect(brightness(rgbOf(C.floor))).toBeLessThan(brightness(rgbOf('#e6e2f2')));
  });
});
