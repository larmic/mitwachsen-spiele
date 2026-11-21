import { describe, expect, it } from 'vitest';
import { drawDeco, type DecoAt } from './mitwachsen-view';
import { mapColor } from './mitwachsen-map';
import type { Cell } from './mitwachsen-world';
import type { SkyScene } from './mitwachsen-sky';
import { EIS_PACK, worldOf } from './test-worlds';

const at: DecoAt = { now: 0, reduced: true, picked: {} };
const world = worldOf(1);
const view = EIS_PACK.view!;
/** Erstes Feld im Kessel (um das Schneebett) mit dieser Deko-Art */
function find(deco: Cell['deco']): [number, number, Cell] {
  const [bx, by] = world.homes.eis.bed;
  for (let y = by - 25; y <= by + 25; y++)
    for (let x = bx - 25; x <= bx + 25; x++) {
      const c = world.cell(x, y);
      if (c.deco === deco) return [x, y, c];
    }
  throw new Error(`keine ${deco}`);
}

describe('Haken der 2D-Ansicht für Welt-Pakete (drawDeco)', () => {
  it('Dinge der Eis-Welt zeichnet ihr Paket: Iglu, Eisschale, Fischkiste (voll, nach dem Fangen leer)', () => {
    const [ix, iy, igloo] = find('igloo');
    expect(drawDeco(view, world, igloo, ix, iy, at)).not.toBeNull();
    const [bx, by, bowl] = find('icebowl');
    expect(drawDeco(view, world, bowl, bx, by, at)!.length).toBeGreaterThan(0);
    const [cx, cy, crate] = find('fishcrate');
    const full = drawDeco(view, world, crate, cx, cy, at)!;
    const empty = drawDeco(view, world, crate, cx, cy, { ...at, picked: { [`${cx},${cy}`]: 1 } })!;
    expect(full.length).toBeGreaterThan(empty.length); // voll: Fische und Flossen dazu
  });

  it('solange das Paket lädt: ein einfacher Block in Kartenfarbe; andere Dinge zeichnet die Ansicht selbst', () => {
    const [cx, cy, crate] = find('fishcrate');
    const block = drawDeco(null, world, crate, cx, cy, at)!;
    expect(block).toHaveLength(1);
    expect(block[0]![6]).toBe(mapColor(crate));
    const tree: Cell = { h: 1, ground: 'grass', deco: 'tree', region: 'lichtung', solid: true };
    expect(drawDeco(null, world, tree, 0, 0, at)).toBeNull();
    expect(drawDeco(view, world, tree, 0, 0, at)).toBeNull();
    expect(drawDeco(view, world, { ...tree, deco: null }, 0, 0, at)).toBeNull();
  });

  it('Eiskristall: das Paket zeichnet ihn in seiner Farbe, am Tag blitzt ab und zu ein Funke (nie bei reduzierter Bewegung)', () => {
    const [x, y, crystal] = find('crystal');
    const still = drawDeco(view, world, crystal, x, y, at)!;
    expect(still.every((b) => b[6] === crystal.color && b[8] === undefined)).toBe(true);
    const sparks = Array.from({ length: 80 }, (_, i) =>
      drawDeco(view, world, crystal, x, y, { ...at, reduced: false, now: i * 100 })!,
    );
    expect(sparks.some((b) => b.length > still.length && b.at(-1)![6] === '#ffffff')).toBe(true);
    expect(sparks.some((b) => b.length === still.length)).toBe(true); // meist ohne Funke
  });

  it('Polarlicht in 2D: Hof nur um Eiskristalle, die in diesem Bild gezeichnet wurden (nicht im Nebel, nicht in 3D)', () => {
    const [x, y, crystal] = find('crystal');
    let rects = 0;
    const ctx = { fillStyle: '', globalAlpha: 1, fillRect: () => void rects++ } as unknown as CanvasRenderingContext2D;
    const sc = { width: 40, height: 40, zoom: 1, now: 500, reduced: true, aurora: 1 } as SkyScene;
    const count = (now: number) => {
      rects = 0;
      view.sky.aurora(ctx, { ...sc, now }, () => [0, 0]);
      return rects;
    };
    const veil = count(400); // nur die Schleier am Himmel
    drawDeco(view, world, crystal, x, y, { ...at, now: 500 });
    expect(count(500)).toBe(veil + 2); // Hof in seiner Farbe, innen weiß
    expect(count(600)).toBe(veil); // im nächsten Bild nicht mehr gezeichnet: kein Hof
  });

  it('Karte: Eiskristalle in ihrer Farbe (nur in der Eis-Welt), Schneewehen wie Schnee', () => {
    const [, , crystal] = find('crystal');
    expect(mapColor(crystal)).toBe(crystal.color);
    expect(mapColor(crystal)).not.toBe(mapColor({ ...crystal, deco: null, solid: false })); // hebt sich vom Schnee ab
    const [, , drift] = find('cloudpuff');
    expect(mapColor(drift)).toBe(mapColor({ ...drift, deco: null })); // nur Bild, auf der Karte nicht zu sehen
    const cave: Cell = {
      h: 1,
      ground: 'cave',
      deco: 'crystal',
      color: '#b48cf0',
      region: 'wild',
      solid: true,
      biome: 'hoehle',
    };
    expect(mapColor(cave)).toBe(mapColor({ ...cave, deco: null })); // in der Höhle wie bisher
  });

  it('die Rutschspur glänzt erst bei offenem Eistor', () => {
    const slide: Cell = { h: 1, ground: 'ice', deco: null, region: 'eis', solid: false, slide: true };
    expect(view.ground(slide, 3, 4, false)).toBeNull();
    expect(view.ground(slide, 3, 4, true)?.slice(0, 3)).toEqual([3.12, 4, 1]);
    expect(view.ground({ ...slide, slide: undefined }, 3, 4, true)).toBeNull();
  });
});
