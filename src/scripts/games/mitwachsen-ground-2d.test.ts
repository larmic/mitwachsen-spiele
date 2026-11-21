// Böden der Welten in der 2D-Ansicht: Der Kern hält Schneebett und Eis der Eis-Welt als eigene Kopie, damit die Farben
// ohne Welt-Paket zeichnen. Diese Tests halten die Kopie gleich mit `ICE_COLORS` aus dem Paket (2D passt zu 3D und Iglu).
import { describe, expect, it } from 'vitest';
import { ICE_COLORS } from '../../data/games/worlds/eis/mitwachsen-ice-colors';
import { BED_SNOW, flatColors } from './mitwachsen-ground-2d';
import type { Cell } from './mitwachsen-world';

const cell = (c: Partial<Cell>) => c as Cell;

describe('Böden hinter den Toren (2D)', () => {
  it('Schneebett hat die Farben des Welt-Pakets', () => {
    expect(BED_SNOW).toEqual(ICE_COLORS.snow);
  });

  it('Eisklippe: Eis an der Seite, Schnee obenauf', () => {
    expect(flatColors(cell({ biome: 'eis', region: 'border', ground: 'snow' }))).toEqual([
      ICE_COLORS.ice[0],
      '#f4f8fb',
    ]);
  });

  it('gefärbte Klippe und Stufe des Eisbergs: Seite in ihrer Farbe, glattes Eis obenauf', () => {
    expect(flatColors(cell({ biome: 'eis', region: 'border', ground: 'snow', color: '#5b8def' }))).toEqual([
      '#5b8def',
      ICE_COLORS.ice[1],
    ]);
    expect(flatColors(cell({ biome: 'eis', ground: 'ice', color: '#8ec5ff' }))).toEqual(['#8ec5ff', ICE_COLORS.ice[1]]);
  });

  it('glattes Eis hat die Farben des Welt-Pakets', () => {
    expect(flatColors(cell({ ground: 'ice' }))).toEqual(ICE_COLORS.ice);
  });

  it('Böden ohne Eintrag zeichnet die Ansicht mit Texturen', () => {
    expect(flatColors(cell({ ground: 'grass' }))).toBeUndefined();
    expect(flatColors(cell({ ground: 'path' }))).toBeUndefined();
  });
});
