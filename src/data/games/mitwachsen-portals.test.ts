import { describe, expect, it } from 'vitest';
import { GATES, THEME_COLORS } from './mitwachsen';
import {
  CENTRE_TOP,
  FRAME_RING,
  GOLD,
  GRID,
  PLATFORMS,
  SUB,
  dim,
  emptySocketVoxels,
  frameOffColor,
  platformLook,
  platformVoxels,
  sleepingVoxels,
  voxelSpan,
} from './mitwachsen-portals';

const field = (v: { x: number; z: number }) => [Math.floor(v.x / SUB), Math.floor(v.z / SUB)] as const;
const isCorner = ([fx, fz]: readonly [number, number]) => fx !== 1 && fz !== 1;

describe('Portal-Plattformen: Form', () => {
  const shape = (rows: readonly string[]) => rows.map((r) => r.replace(/[^.]/g, '#')).join('\n');

  for (const g of GATES) {
    it(`${g.id}: drei Lagen zu 9 × 9 Voxeln, nur bekannte Farben`, () => {
      const layers = PLATFORMS[g.id];
      expect(layers).toHaveLength(3);
      for (const rows of layers) {
        expect(rows).toHaveLength(GRID);
        for (const row of rows) expect(row).toHaveLength(GRID);
      }
      const chars = layers.flat().join('').replace(/\./g, '').length;
      expect(platformVoxels(g.id)).toHaveLength(chars); // jedes Zeichen hat eine Farbe
    });

    it(`${g.id}: Achteck wie alle anderen, Gold-Rahmen aus 16 Voxeln, Bild auf dem Mittelfeld`, () => {
      expect(shape(PLATFORMS[g.id][0]!)).toBe(shape(PLATFORMS.eis[0]!));
      const v = platformVoxels(g.id);
      const frame = v.filter((x) => x.role === 'frame');
      expect(frame).toHaveLength(16);
      for (const f of frame) expect([f.color, f.glow]).toEqual([GOLD.top, true]);
      expect(v.filter((x) => x.role === 'picture')).toHaveLength(9);
      expect(v.filter((x) => x.role === 'access')).toHaveLength(12);
      expect(v.some((x) => x.role === 'picture' && x.glow)).toBe(true); // das Bild leuchtet
    });

    it(`${g.id}: Zierde nur auf den Eckfeldern und niedrig; Seitenmitten frei`, () => {
      for (const v of platformVoxels(g.id).filter((x) => x.layer > 0 && x.role === 'deco')) {
        expect(isCorner(field(v)), `${v.x},${v.z}`).toBe(true);
        expect(voxelSpan(v)[1]).toBeLessThanOrEqual(0.9);
      }
      for (const v of platformVoxels(g.id).filter((x) => x.role === 'picture'))
        expect(voxelSpan(v)).toEqual([0.25, CENTRE_TOP]);
    });
  }

  it('Gold hebt sich in jeder Welt vom Sockel daneben ab (bereit und nach der Ankunft)', () => {
    const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]!));
    // Paare (Gold, Nachbar im Sockel) je Welt und Zustand; die Mitte liegt unter dem Bild
    const pairs = GATES.flatMap((g) =>
      (['ready', 'arrived'] as const).flatMap((look) => {
        const base = platformLook(g.id, 'gate', look).filter((v) => v.layer === 0);
        const at = new Map(base.map((v) => [`${v.x},${v.z}`, v]));
        return base
          .filter((v) => v.gold)
          .flatMap((v) => [
            at.get(`${v.x + 1},${v.z}`),
            at.get(`${v.x - 1},${v.z}`),
            at.get(`${v.x},${v.z + 1}`),
            at.get(`${v.x},${v.z - 1}`),
          ])
          .filter((n) => n && !n.gold && n.role !== 'core')
          .map((n) => ({ n: n!, label: `${g.id} ${look} ${n!.x},${n!.z}` }));
      }),
    );
    expect(pairs.length).toBeGreaterThan(100);
    // Glut lag bei gut 50
    for (const { n, label } of pairs) expect(dist(n.color, GOLD.top), label).toBeGreaterThanOrEqual(70);
  });

  it('Rahmen-Ring fürs Lauflicht: 16 verschiedene Plätze, genau die des Gold-Rahmens', () => {
    const frame = platformVoxels('eis')
      .filter((v) => v.role === 'frame')
      .map((v) => `${v.x},${v.z}`)
      .sort();
    expect(FRAME_RING.map(([x, z]) => `${x},${z}`).sort()).toEqual(frame);
  });
});

describe('Portal-Plattformen: Zustände', () => {
  it('schlafend in ihrer Welt: nichts leuchtet, kein Gold, das Bild nur eingeritzt', () => {
    for (const g of GATES) {
      const v = sleepingVoxels(g.id);
      expect(v.every((x) => !x.glow)).toBe(true);
      expect(v.some((x) => x.color === GOLD.top)).toBe(false);
      expect(new Set(v.filter((x) => x.role === 'picture').map((x) => x.color))).toEqual(new Set(['#6b6f78']));
      expect(v.filter((x) => x.role === 'frame').every((x) => x.color === frameOffColor(g.id))).toBe(true);
    }
  });

  it('schlafendes Gegenstück am Bett: leerer grauer Sockel, für alle Welten gleich, ohne Bild und ohne Zierde', () => {
    const v = emptySocketVoxels();
    const colors = new Set(v.map((x) => x.color));
    expect(colors).toEqual(new Set(['#8f949b', '#a8adb3']));
    for (const g of GATES) for (const c of Object.values(THEME_COLORS[g.id])) expect(colors.has(c)).toBe(false);
    expect(v.every((x) => !x.glow)).toBe(true);
    // über dem Sockel nur die erhöhte Mitte und je ein Eckstein: keine Zierde einer Welt
    const above = v.filter((x) => x.layer > 0);
    expect(above.filter((x) => x.role === 'deco')).toHaveLength(4);
    expect(above.filter((x) => x.role === 'picture')).toHaveLength(9);
    expect(platformLook('lava', 'home', 'asleep')).toEqual(v);
  });

  it('bereit: Gold um die Mitte; nach der Ankunft: Gold auf den vier Zugängen, der Rahmen in Sockelfarbe', () => {
    for (const g of GATES) {
      const ready = platformLook(g.id, 'gate', 'ready');
      expect(ready.filter((v) => v.gold).every((v) => v.role === 'frame')).toBe(true);
      expect(ready.filter((v) => v.gold)).toHaveLength(16);
      const arrived = platformLook(g.id, 'home', 'arrived');
      expect(arrived.filter((v) => v.gold).every((v) => v.role === 'access')).toBe(true);
      expect(arrived.filter((v) => v.gold)).toHaveLength(12);
      expect(arrived.filter((v) => v.role === 'frame').every((v) => v.color === frameOffColor(g.id))).toBe(true);
      expect(platformLook(g.id, 'gate', 'asleep')).toEqual(sleepingVoxels(g.id));
    }
  });

  it('matt heißt halb zum Grau hin', () => {
    expect(dim('#ffffff')).toBe('#b5b7bc');
    expect(dim('#6b6f78')).toBe('#6b6f78');
  });
});
