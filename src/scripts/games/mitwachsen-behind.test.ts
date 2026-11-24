import { describe, expect, it } from 'vitest';
import type { Cell } from './mitwachsen-cell';
import { behind, gangCoords, hullOf, straightCentre } from './mitwachsen-behind';
import type { Gang, Kessel, WorldPack } from './mitwachsen-pack-types';

/** Gang entlang der y-Achse: u = x, t = y; Torreihe bei 0, Mündung bei 5, Boden u −2 … 2, daneben je 2 Felder Wand */
const GANG: Gang = { at: (u, t) => [u, t], depth: 0, end: 5, half: 2, wall: 2 };
const passage = (): Cell => ({ h: 1, ground: 'stone', deco: null, region: 'border', solid: false });
const everywhere = () => true;

/** Ein Paket, das nur ein Bett, einen Klangstein und ein Portal liefert */
const fakePack = (id: WorldPack['id'], gate: WorldPack['gate']): WorldPack => {
  const kessel: Kessel = {
    bed: [0, 20],
    realm: new Set(['0,20']),
    spots: [[1, 20]],
    spawns: new Map(),
    stone: [2, 20],
    portal: ['eiskessel', { gate: [0, 18], home: [0, 22] }],
  };
  return { id, gate, build: () => kessel, place: () => ({ bed: kessel.bed, cells: [] }) };
};

describe('Was hinter dem Gang eines Tors liegt (behind)', () => {
  it('ohne Paket hinter einem Tor ohne Welt, das nie aufgeht: nichts gebaut, die Karte bleibt, wie sie ist', () => {
    const map = new Map<string, Cell>();
    const b = behind(undefined, 1, GANG, everywhere, passage, map, 'sand');
    expect(b.built).toBe(false);
    expect(map.size).toBe(0);
    expect(b.realm.size).toBe(0);
    expect([b.spots, b.portals, b.stones]).toEqual([[], [], []]);
    expect(b.bed).toEqual([0, 8]); // ein Bett am Ende des Gangs, nur damit jede Gegend ein Zuhause hat
  });

  it('ohne Paket hinter einem Tor, das aufgehen kann: eine Klippe, Reihe für Reihe höher, am Eistor aus Eis', () => {
    const map = new Map<string, Cell>();
    const b = behind(undefined, 1, GANG, everywhere, passage, map, 'eis');
    expect(b.built).toBe(true);
    expect(map.size).toBe(3 * 9); // drei Reihen, so breit wie Gang und Wände
    expect(map.get('0,6')).toMatchObject({ h: 3, ground: 'ice', solid: true, region: 'border', biome: 'eis' });
    expect(map.get('-4,8')).toMatchObject({ h: 5, ground: 'ice', biome: 'eis' });
  });

  it('die Klippe eines anderen Tors, das aufgehen kann, ist aus Fels seiner Welt (`closable`)', () => {
    const map = new Map<string, Cell>();
    const b = behind(undefined, 1, GANG, everywhere, passage, map, 'sand', true);
    expect(b.built).toBe(true);
    expect(map.get('0,7')).toMatchObject({ h: 4, ground: 'stone', solid: true, region: 'border', biome: 'sand' });
  });

  it('hinter dem Höhlentor (geht bis zur Bahn-Phase nie auf, aber dahinter liegt eine Welt): ohne Paket eine Felswand', () => {
    const map = new Map<string, Cell>();
    const b = behind(undefined, 1, GANG, everywhere, passage, map, 'hoehle');
    expect(b.built).toBe(true);
    expect(map.size).toBe(3 * 9);
    expect(map.get('0,6')).toMatchObject({ h: 3, ground: 'stone', solid: true, region: 'border', biome: 'hoehle' });
    expect([b.spots, b.portals, b.stones, b.realm.size]).toEqual([[], [], [], 0]);
  });

  it('mit Paket: seine Welt; ihr Klangstein erzählt die zweite Fassung der Geschichte des Tors, wenn es eine gibt', () => {
    const eis = behind(fakePack('eis', 'eis'), 1, GANG, everywhere, passage, new Map(), 'eis');
    expect(eis.built).toBe(true);
    expect(eis.bed).toEqual([0, 20]);
    expect(eis.stones).toEqual([['eis-offen', [2, 20]]]);
    expect(eis.portals.map(([id]) => id)).toEqual(['eiskessel']);
    // die Höhlen-Geschichte hat auch eine zweite Fassung: Ihr Stein steht am Höhlenbett
    const hoehle = behind(fakePack('hoehle', 'hoehle'), 1, GANG, everywhere, passage, new Map(), 'hoehle');
    expect(hoehle.stones).toEqual([['hoehle-offen', [2, 20]]]);
    expect(hoehle.built).toBe(true);
    // ein Tor ohne zweite Fassung: dann kein Stein mit Geschichte
    const sand = behind(fakePack('eis', 'sand'), 1, GANG, everywhere, passage, new Map(), 'sand');
    expect(sand.stones).toEqual([]);
  });
});

describe('Platz einer Welt hinter ihrem Gang', () => {
  const room = { rx: 10, ry: 20, gap: 2 };

  it('gerade hinter dem Gang, so nah wie möglich: die ganze Hülle in `beyond`', () => {
    // frei erst ab t = 8: Die Hülle reicht 22 Felder vor die Mitte
    expect(straightCentre(GANG, (_x, y) => y >= 8, room)).toBe(30);
    expect(straightCentre(GANG, everywhere, room)).toBe(GANG.end + room.ry); // ohne Grenze gleich am Ende des Gangs
    // seitlich gesperrt: weiter hinaus, bis die Hülle vorbei ist
    expect(straightCentre(GANG, (x, y) => y >= 8 && !(x > 10 && y < 40), room)).toBe(52);
  });

  it('Lage im Raster des Gangs, auch gedreht (`gangCoords`)', () => {
    const turned: Gang = { ...GANG, at: (u, t) => [t, 3 - u] };
    expect(gangCoords(turned, turned.at(4, 9))).toEqual([4, 9]);
    expect(gangCoords(GANG, [-2, 7])).toEqual([-2, 7]);
  });

  it('Hülle: Ellipse samt Abstand und die Verlängerung des Gangs bis dorthin (`hullOf`)', () => {
    const hull = hullOf(GANG, 30, room);
    expect(hull(0, 30)).toBe(true);
    expect(hull(11, 30)).toBe(true); // im Abstand
    expect(hull(13, 30)).toBe(false);
    expect(hull(0, 51)).toBe(true);
    expect(hull(0, 53)).toBe(false);
    expect(hull(6, 7)).toBe(true); // Verlängerung des Gangs samt Wand und Abstand
    expect(hull(7, 7)).toBe(false);
    expect(hull(0, 5)).toBe(false); // der Gang im Felsring gehört nicht dazu
  });
});
