import { describe, expect, it } from 'vitest';
import { GATES, THEME_COLORS } from './mitwachsen';
import {
  CENTRE_TOP,
  FRAME_RING,
  GOLD,
  GRID,
  LOOKS,
  SOCKET_TOP,
  SUB,
  dim,
  emptySocketVoxels,
  platformLook,
  platformVoxels,
  sleepingVoxels,
  voxelSpan,
  type PlatformVoxel,
} from './mitwachsen-portals';

type Gold = PlatformVoxel & { gold?: true };
const field = (v: { x: number; z: number }) => [Math.floor(v.x / SUB), Math.floor(v.z / SUB)] as const;
const key = (v: Pick<PlatformVoxel, 'x' | 'z' | 'layer'>) => `${v.x},${v.z},${v.layer}`;
/** Oberster Voxel je Säule des Sockels (ohne Bild und Zierde) */
const socketTops = (vs: readonly Gold[]) => {
  const top = new Map<string, Gold>();
  for (const v of vs.filter((x) => x.layer < 2)) {
    const k = `${v.x},${v.z}`;
    if ((top.get(k)?.layer ?? -1) < v.layer) top.set(k, v);
  }
  return top;
};

describe('Portal-Plattformen: Form', () => {
  const shape = (vs: readonly PlatformVoxel[]) =>
    vs
      .filter((v) => v.role !== 'deco' && v.role !== 'picture')
      .map(key)
      .sort();

  it('ein Voxel ist 1/8 Feld, so groß wie ein Pixel der Bodentexturen; Sockel 0,25 hoch, Mitte eine Lage höher', () => {
    expect([SUB, GRID]).toEqual([8, 24]);
    expect([SOCKET_TOP, CENTRE_TOP]).toEqual([0.25, 0.375]);
  });

  for (const g of GATES) {
    it(`${g.id}: gleiche runde Platte wie alle anderen, jeder Voxel einmal, nur bekannte Farben`, () => {
      const v = platformVoxels(g.id);
      expect(shape(v)).toEqual(shape(platformVoxels('eis')));
      expect(new Set(v.map(key)).size).toBe(v.length);
      for (const x of v) expect(x.color, key(x)).toMatch(/^#[0-9a-f]{6}$/);
      for (const x of v) expect(x.x >= 0 && x.x < GRID && x.z >= 0 && x.z < GRID).toBe(true);
      // runde Ecken: die äußerste Ecke ist leer, die Mitte jedes Eckfelds voll
      expect(v.some((x) => x.x === 0 && x.z === 0)).toBe(false);
      for (const [fx, fz] of [
        [0, 0],
        [2, 0],
        [0, 2],
        [2, 2],
      ] as const)
        expect(v.some((x) => x.x === fx * SUB + 4 && x.z === fz * SUB + 4 && x.layer === 1)).toBe(true);
    });

    it(`${g.id}: Sockel zwei Lagen, außen eine; Bild 8 × 8 eine Lage höher auf dem Mittelfeld, es leuchtet`, () => {
      const v = platformVoxels(g.id);
      const tops = [...socketTops(v).values()];
      for (const t of tops) expect([0, 1]).toContain(t.layer);
      expect(tops.some((t) => t.layer === 0)).toBe(true); // die Schwelle außen
      const picture = v.filter((x) => x.role === 'picture');
      expect(picture).toHaveLength(64);
      for (const p of picture) {
        expect(field(p)).toEqual([1, 1]);
        expect(voxelSpan(p)).toEqual([SOCKET_TOP, CENTRE_TOP]);
      }
      expect(picture.some((x) => x.glow)).toBe(true);
      expect(LOOKS[g.id].picture.every((row) => row.length === 8)).toBe(true);
    });

    it(`${g.id}: Zierde nur klein in der äußersten Spitze der Ecken, höchstens drei Lagen über dem Sockel`, () => {
      const deco = platformVoxels(g.id).filter((x) => x.role === 'deco');
      expect(deco.length).toBeGreaterThan(0);
      for (const d of deco) {
        const [fx, fz] = field(d);
        expect(fx !== 1 && fz !== 1, key(d)).toBe(true);
        // im äußeren Viertel des Eckfelds: Die Figur steht in der Feldmitte daneben
        const ax = Math.min(d.x % SUB, SUB - 1 - (d.x % SUB)),
          az = Math.min(d.z % SUB, SUB - 1 - (d.z % SUB));
        expect(Math.max(ax, az), key(d)).toBeLessThanOrEqual(3);
        expect(voxelSpan(d)[1]).toBeLessThanOrEqual(SOCKET_TOP + 0.375);
      }
    });
  }

  it('Gold hebt sich in jeder Welt vom Sockel daneben ab (bereit und nach der Ankunft)', () => {
    const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]!));
    // Paare (Gold, Nachbar auf dem Sockel) je Welt und Zustand; die Mitte liegt unter dem Bild
    const pairs = GATES.flatMap((g) =>
      (['ready', 'arrived'] as const).flatMap((look) => {
        const tops = socketTops(platformLook(g.id, 'gate', look));
        const at = (x: number, z: number) => tops.get(`${x},${z}`);
        return [...tops.values()]
          .filter((v) => v.gold)
          .flatMap((v) => [at(v.x + 1, v.z), at(v.x - 1, v.z), at(v.x, v.z + 1), at(v.x, v.z - 1)])
          .filter((n): n is Gold => !!n && !n.gold && n.role !== 'core')
          .map((n) => ({ n, label: `${g.id} ${look} ${n.x},${n.z}` }));
      }),
    );
    expect(pairs.length).toBeGreaterThan(400);
    for (const { n, label } of pairs) expect(dist(n.color, GOLD.top), label).toBeGreaterThanOrEqual(70);
  });

  it('Rahmen-Ring fürs Lauflicht: verschiedene Plätze, genau die des Gold-Rahmens', () => {
    const frame = [
      ...new Set(
        platformVoxels('eis')
          .filter((v) => v.role === 'frame')
          .map((v) => `${v.x},${v.z}`),
      ),
    ].sort();
    expect(frame).toHaveLength(4 * (SUB + 1));
    expect(FRAME_RING.map(([x, z]) => `${x},${z}`).sort()).toEqual(frame);
  });
});

describe('Portal-Plattformen: Zustände', () => {
  it('schlafend in ihrer Welt: nichts leuchtet, kein Gold, das Bild nur grau eingeritzt', () => {
    for (const g of GATES) {
      const v = sleepingVoxels(g.id);
      expect(v.every((x) => !x.glow)).toBe(true);
      expect(v.some((x) => x.color === GOLD.top)).toBe(false);
      expect(v.filter((x) => x.role === 'picture').some((x) => x.color === '#6b6f78')).toBe(true);
    }
  });

  it('schlafendes Gegenstück am Bett: leerer grauer Sockel, für alle Welten gleich, ohne Bild und ohne Zierde', () => {
    const v = emptySocketVoxels();
    const colors = new Set(v.map((x) => x.color));
    expect(colors).toEqual(new Set(['#8f949b', '#a8adb3']));
    for (const g of GATES) for (const c of Object.values(THEME_COLORS[g.id])) expect(colors.has(c)).toBe(false);
    expect(v.every((x) => !x.glow)).toBe(true);
    expect(v.some((x) => x.role === 'deco')).toBe(false);
    expect(v.filter((x) => x.role === 'picture')).toHaveLength(64); // nur die erhöhte Mitte
    expect(platformLook('lava', 'home', 'asleep')).toEqual(v);
  });

  it('bereit: Gold um die Mitte; nach der Ankunft: goldene Pfeile in den vier Seitenfeldern, der Rahmen ohne Gold', () => {
    for (const g of GATES) {
      const ready = platformLook(g.id, 'gate', 'ready');
      expect(ready.filter((v) => v.gold).every((v) => v.role === 'frame')).toBe(true);
      expect(ready.filter((v) => v.role === 'frame').every((v) => v.gold)).toBe(true);
      const arrived = platformLook(g.id, 'home', 'arrived');
      const gold = arrived.filter((v) => v.gold);
      expect(gold.every((v) => v.role === 'access')).toBe(true);
      expect(arrived.filter((v) => v.role === 'frame').some((v) => v.gold)).toBe(false);
      expect(new Set(gold.map((v) => field(v).join()))).toEqual(new Set(['1,0', '1,2', '0,1', '2,1']));
      expect(platformLook(g.id, 'gate', 'asleep')).toEqual(sleepingVoxels(g.id));
    }
  });

  it('die Pfeile zeigen nach außen: zur Kante hin schmaler', () => {
    const gold = platformLook('sand', 'gate', 'arrived').filter(
      (v) => v.gold && v.layer === 1 && field(v).join() === '1,2',
    );
    const width = (z: number) => new Set(gold.filter((v) => v.z === z).map((v) => v.x)).size;
    const rows = [...new Set(gold.map((v) => v.z))].sort((a, b) => a - b);
    expect(Math.max(...rows.map(width))).toBe(4);
    const tip = gold.filter((v) => v.z === rows.at(-1)).map((v) => v.x);
    expect(tip.sort()).toEqual([SUB + 3, SUB + 4]); // die Spitze in der Mitte, an der Außenkante
  });

  it('matt heißt halb zum Grau hin', () => {
    expect(dim('#ffffff')).toBe('#b5b7bc');
    expect(dim('#6b6f78')).toBe('#6b6f78');
  });
});
