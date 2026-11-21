import { describe, expect, it } from 'vitest';
import { worldOf } from '../../test-worlds';
import type { SkyScene } from '../../mitwachsen-sky';
import { bergPeak, iceWeather, rims } from './mitwachsen-ice-sky';

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

describe('Fahne auf dem Eisberg (Eis-Welt)', () => {
  /** Was die Ebene über dem Bild zeichnet, als Liste der Rechtecke samt Farbe; Kamera auf dem Gipfel oder bei `cam` */
  function draw(seed: number, now: number, reduced: boolean, wind = 0, cam?: readonly [number, number]) {
    const world = worldOf(seed);
    const [px, py] = cam ?? bergPeak(world)!;
    const rects: string[] = [];
    const ctx = { fillStyle: '', globalAlpha: 1 } as unknown as CanvasRenderingContext2D;
    ctx.fillRect = (x, y, w, h) => void rects.push(`${ctx.fillStyle as string} ${x},${y} ${w}×${h}`);
    const sc: SkyScene = {
      width: 800,
      height: 600,
      zoom: 1,
      now,
      cam: { x: px, y: py },
      reduced,
      mood: { id: 'eis', strength: 1 },
      wind,
      weather: { cloud: 0, rain: 0, rainbow: 0, snow: 0, wind, gust: 0, sparkle: 0 },
      aurora: 0,
      explored: () => true,
    };
    iceWeather(ctx, world, sc, (x, y, z) => [400 + (x - px) * 32, 300 + (y - py) * 16 - z * 16]);
    return rects;
  }
  const PENNANT = ['#e8504a', '#ffffff', '#3f8fd8', '#6dbd47'];
  /** Rechtecke der Fahne: in ihren vier Farben (Flocken sind halbdurchsichtig, andere Dinge fern) */
  const flag = (rects: string[]) => rects.filter((r) => PENNANT.some((c) => r.startsWith(`${c} `)));

  it('steht auf dem Gipfel und weht dort auch ohne Pustewind, waagerecht', () => {
    for (const seed of [1, 42, 2026]) {
      const a = flag(draw(seed, 1000, false));
      const b = flag(draw(seed, 1400, false));
      expect(a, `Seed ${seed}`).toHaveLength(4);
      expect(a, `Seed ${seed}: flattert`).not.toEqual(b);
      // waagerecht: die vier Streifen liegen nebeneinander, nicht untereinander
      const xs = a.map((r) => Number(r.split(' ')[1]!.split(',')[0]));
      expect(new Set(xs).size, `Seed ${seed}`).toBe(4);
      // auf dem Gipfel: Stange ein halbes Feld hinter seiner Mitte (Kamera dort, Mitte des Bilds bei 400, 300), die
      // Fahne oben an ihr, über dem Gipfel
      const [x0, y0] = a[0]!.split(' ')[1]!.split(',').map(Number) as [number, number];
      expect(x0, `Seed ${seed}: an der Stange`).toBeGreaterThanOrEqual(400);
      expect(x0, `Seed ${seed}: an der Stange`).toBeLessThanOrEqual(425);
      expect(y0, `Seed ${seed}: über dem Gipfel`).toBeLessThan(300 - 5 * 16);
      expect(y0, `Seed ${seed}: oben an der Stange`).toBeGreaterThan(300 - 8 * 16);
    }
  });

  it('ist vom Hauptweg aus zu sehen: auf der Achse des Tals neben dem Eisberg und bis 15 Felder davor und dahinter', () => {
    for (const seed of [1, 42, 2026]) {
      const world = worldOf(seed);
      const [px, py] = bergPeak(world)!;
      const [bx, by] = world.homes.eis.bed;
      const gate = world.portals.get('eiskessel')!.gate;
      const along = gate[0] !== bx ? ([1, 0] as const) : ([0, 1] as const); // das Tal läuft entlang einer Achse
      for (const k of [-15, 0, 15]) {
        const cam = along[0] ? ([px + k, by] as const) : ([bx, py + k] as const);
        expect(flag(draw(seed, 1000, false, 0, cam)), `Seed ${seed}: ${k} Felder`).toHaveLength(4);
      }
    }
  });

  it('steht bei reduzierter Bewegung still waagerecht, auch im Pustewind', () => {
    for (const seed of [1, 42]) {
      for (const wind of [0, 1]) {
        const a = flag(draw(seed, 1000, true, wind));
        expect(a, `Seed ${seed}`).toHaveLength(4);
        expect(flag(draw(seed, 5321, true, wind)), `Seed ${seed}`).toEqual(a);
        const xs = a.map((r) => Number(r.split(' ')[1]!.split(',')[0]));
        expect(new Set(xs).size, `Seed ${seed}: waagerecht`).toBe(4);
      }
    }
  });
});
