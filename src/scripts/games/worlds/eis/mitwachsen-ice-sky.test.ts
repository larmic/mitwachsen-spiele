import { describe, expect, it } from 'vitest';
import { worldOf } from '../../test-worlds';
import { rims } from './mitwachsen-ice-sky';

describe('Pulverfahnen beim Pustewind (Eis-Welt)', () => {
  it('wehen von den Kanten der Eisklippen rings um das ganze Tal: an beiden Seitenwänden und am Talende', () => {
    for (const seed of [1, 42, 2026]) {
      const world = worldOf(seed);
      const [bx, by] = world.homes.eis.bed;
      const { out } = world.gates.get('eis')!;
      const edges = rims(world);
      for (const [x, y] of edges)
        expect(world.cell(x, y), `Seed ${seed}: ${x},${y}`).toMatchObject({ region: 'border', biome: 'eis' });
      // vom Bett aus gesehen: quer zum Tor (Seitenwände) und vom Tor weg (Talende)
      const across = edges.map(([x, y]) => (x - bx) * -out[1] + (y - by) * out[0]);
      const along = edges.map(([x, y]) => (x - bx) * out[0] + (y - by) * out[1]);
      expect(Math.min(...across), `Seed ${seed}: eine Seitenwand`).toBeLessThan(-35);
      expect(Math.max(...across), `Seed ${seed}: andere Seitenwand`).toBeGreaterThan(35);
      expect(Math.max(...along), `Seed ${seed}: Talende`).toBeGreaterThan(100);
      expect(edges.filter((_, i) => along[i]! > 40).length, `Seed ${seed}: hinten im Tal`).toBeGreaterThan(10);
    }
  });
});
