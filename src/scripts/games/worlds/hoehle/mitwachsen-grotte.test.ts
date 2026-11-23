import { describe, expect, it } from 'vitest';
import { MOOD_LIGHT, REGIONS, type Point } from '../../../../data/games/mitwachsen';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { DIRS } from '../../../../lib/games/front';
import { platformsToWake } from '../../mitwachsen-portal';
import { DUSK_DAY, DUSK_SKY, dayOf, nightIn, nightMix, sunLevel, type Rgb } from '../../mitwachsen-dusk';
import { beyondRing, canStep, kesselPlace, type World } from '../../mitwachsen-world';
import { HOEHLE_PACK, PACKS, REGRESSION_SEEDS, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { GROTTE_ROOM, fromMouth, shedAt, stationAt } from './mitwachsen-grotte';
import type { Site } from './mitwachsen-site';

const CAVE = [HOEHLE_PACK];
/** Seeds, deren Grotte um eine Ecke liegt (die Eis-Welt liegt gerade dahinter im Weg) */
const TURNED = [26, 30];
/** Eigenschafts-Tests, die ganze Welten bauen: wenige Seeds, im tiefen Lauf 20 */
const SEEDS = seedsFor(seedRange(1, 20), [...SAMPLE_SEEDS, ...TURNED]);

type Placed = { bed: Point; cells: readonly Point[]; site: Site };
const placeOf = (seed: number) => kesselPlace(seed, HOEHLE_PACK) as Placed;
const key = ([x, y]: readonly [number, number]) => `${x},${y}`;

/** Schritte vom Bett zu jedem erreichbaren Feld der Welt (Breitensuche, das Höhlentor zu) */
function stepsFrom(w: World, start: Point): Map<string, number> {
  const dist = new Map<string, number>([[key(start), 0]]);
  const queue: Point[] = [start];
  for (let i = 0; i < queue.length && dist.size < 40000; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of Object.values(DIRS)) {
      const n: Point = [x + dx, y + dy];
      if (dist.has(key(n)) || !canStep(w, [], x, y, n[0], n[1])) continue;
      dist.set(key(n), dist.get(key([x, y]))! + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** Lage eines Felds von der Mündung aus [quer, vom Tor weg] */
const mouthOf = (site: Site, [x, y]: Point): Point => {
  const [u, v] = site.uv(x, y);
  return [u + 0, v + GROTTE.shape.ry]; // + 0: ohne −0
};

describe('Kristallgrotte: Lage', () => {
  it('der Kern kennt ihren Platz (`Region.room`) wie das Paket; nach ihr, die um eine Ecke darf, kommt keine Welt', () => {
    const room = REGIONS.find((r) => r.id === 'hoehle')!.room!;
    expect({ rx: room.rx, ry: room.ry, gap: room.gap }).toEqual(GROTTE_ROOM);
    expect(room.bend).toBe(true);
    const withRoom = REGIONS.filter((r) => r.room);
    expect(withRoom.findIndex((r) => r.room!.bend)).toBe(withRoom.length - 1);
  });

  // nur die Lagen (schnell): viele Seeds, auch ohne den tiefen Lauf genug, um beide Arten (gerade, um die Ecke) zu sehen
  const PLACES = seedsFor(seedRange(1, 300), seedRange(1, 60));
  it('liegt ganz hinter dem Felsring, nie in der Eis-Welt; der Weg dorthin auch nicht (gerade oder um eine Ecke)', () => {
    const bad: string[] = [];
    let turned = 0;
    for (const seed of PLACES) {
      const cave = placeOf(seed);
      const ice = new Set(kesselPlace(seed, PACKS[0]).cells.map(key));
      if (cave.site.turn) turned++;
      for (const p of [...cave.cells, ...cave.site.floor, ...cave.site.walls]) {
        if (ice.has(key(p))) bad.push(`Seed ${seed}: ${key(p)} in der Eis-Welt`);
        if (!beyondRing(...p)) bad.push(`Seed ${seed}: ${key(p)} im Felsring`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(turned).toBeGreaterThan(0);
    for (const seed of TURNED) expect(placeOf(seed).site.turn, `Seed ${seed}`).toBe(true);
  });

  it('der Weg vom Felsring bis an die Klippen bleibt kurz (gerade meist ganz kurz, um die Ecke kürzer als 100 Felder)', () => {
    const lengths = PLACES.map((seed) => placeOf(seed).site.floor.length / 5);
    expect(Math.max(...lengths)).toBeLessThan(100);
    expect(lengths.filter((l) => l <= 10).length).toBeGreaterThan(lengths.length / 2);
  });
});

describe('Kristallgrotte: Gelände', () => {
  for (const seed of SEEDS) {
    const w = worldOf(seed, CAVE);
    const { site, bed } = placeOf(seed);
    const home = w.homes.hoehle;
    const steps = stepsFrom(w, home.wake[0]!);
    const floor = [...steps.keys()].filter((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number];
      return w.cell(x, y).region === 'hoehle';
    });

    it(`Seed ${seed}: etwa 10.000 Felder, jedes begehbare Feld vom Bett aus erreichbar, der Gang bis zum Tor auch`, () => {
      expect(bed).toEqual(home.bed);
      const cells = placeOf(seed).cells.filter(([x, y]) => w.cell(x, y).region === 'hoehle');
      expect(cells.length).toBeGreaterThan(9000);
      expect(cells.length).toBeLessThan(10500);
      const lost = cells.filter(([x, y]) => {
        const c = w.cell(x, y);
        return !c.solid && c.ground !== 'water' && !steps.has(key([x, y]));
      });
      expect(lost.map(key).slice(0, 5), `Seed ${seed}`).toEqual([]);
      // durch die Verlängerung und den Gang bis vor das Höhlentor (das zu bleibt)
      const gate = w.gates.get('hoehle')!;
      const inner: Point = [gate.mid[0] + gate.out[0], gate.mid[1] + gate.out[1]];
      expect(steps.has(key(inner)), `Seed ${seed}`).toBe(true);
      expect(w.realm(...home.bed)).toBe('hoehle');
      expect(w.climate(...home.bed)).toEqual({ id: 'hoehle', strength: 1 });
    });

    it(`Seed ${seed}: Bett 28 Felder hinter der Mündung, das fernste Feld weit weg; Portal am See schläft noch`, () => {
      expect(mouthOf(site, home.bed)).toEqual([0, GROTTE.bed]);
      const far = Math.max(...floor.map((k) => steps.get(k)!));
      expect(far).toBeGreaterThan(110);
      expect(far).toBeLessThan(160);
      const portal = w.portals.get('hoehlensee')!;
      expect(portal.later).toBe(true);
      expect(portal.bed).toEqual(home.bed);
      expect(mouthOf(site, portal.gate)).toEqual(GROTTE.portal);
      expect(steps.get(key(portal.gate))).toBeGreaterThan(100); // der lange Weg ans Ende
      expect(Math.round(Math.hypot(portal.home[0] - home.bed[0], portal.home[1] - home.bed[1]))).toBe(9);
      // auch am Bett und auf der Plattform erwacht es nicht
      for (const p of [home.wake[0]!, portal.gate])
        expect(platformsToWake(w.portals, [], p[0], p[1], () => true)).not.toContain('hoehlensee');
    });

    it(`Seed ${seed}: Zonen: Lampengang, Plätze von Bahnhof und Lokschuppen, Unterstand, Pilzgarten, Halle, Tropfsteine, See, Hang`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p), m: mouthOf(site, p) }));
      const count = (f: (e: (typeof all)[number]) => boolean) => all.filter(f).length;
      expect(count(({ c, m }) => c.deco === 'cavelamp' && m[1] <= GROTTE.lamps.to)).toBeGreaterThanOrEqual(4);
      // Bahnhof Fledermaus: eben und frei, noch ohne Bahnsteig
      const station = all.filter(({ p }) => stationAt(...site.uv(...p)));
      expect(station.length).toBe(GROTTE.station.long * GROTTE.station.wide);
      expect(station.every(({ c }) => c.h === 1 && !c.solid && !c.deco)).toBe(true);
      // Lokschuppen (kommt mit dem Zug): daneben eben und frei, zwei Felder fern von Bahnsteig, Trögen und Plattformen
      const lok = all.filter(({ p }) => shedAt(...site.uv(...p)));
      expect(lok.length).toBe(GROTTE.shed.long * GROTTE.shed.wide);
      const portal = w.portals.get('hoehlensee')!;
      const others: Point[] = [
        ...station.map(({ p }) => p),
        home.food,
        home.water,
        ...[portal.home, portal.gate].flatMap(([px, py]) =>
          [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy): Point => [px + dx, py + dy])),
        ),
      ];
      const tooClose = lok.filter(
        ({ p, c }) =>
          c.region !== 'hoehle' ||
          c.h !== 1 ||
          c.solid ||
          !!c.deco ||
          !!c.garden ||
          !!c.portal ||
          others.some(([ox, oy]) => Math.max(Math.abs(ox - p[0]), Math.abs(oy - p[1])) < 3),
      );
      expect(
        tooClose.map(({ p }) => p.join(',')),
        `Seed ${seed}`,
      ).toEqual([]);
      // Unterstand am Bett: Dach, dahinter die Kristallwand
      const { x0, y0, x1, y1 } = home.shelter;
      const shed: string[] = [];
      for (let x = x0; x <= x1; x++) {
        const wall = w.cell(x, y0 - 1);
        if (wall.deco !== 'shed' || !wall.solid) shed.push(`Wand ${x},${y0 - 1}`);
        for (let y = y0; y <= y1; y++) if (!w.cell(x, y).roof || !w.cell(x, y).garden) shed.push(`Dach ${x},${y}`);
      }
      expect(shed, `Seed ${seed}`).toEqual([]);
      expect(count(({ c }) => c.deco === 'column')).toBe(5);
      expect(
        all
          .filter(({ c }) => c.deco === 'column')
          .map(({ c }) => c.note)
          .sort(),
      ).toEqual([2, 3, 3, 4, 5]);
      expect(count(({ c }) => c.deco === 'crystalarch')).toBe(5);
      expect(count(({ c }) => c.deco === 'crystalarch' && c.solid)).toBe(2); // nur die Pfeiler
      expect(count(({ c }) => c.deco === 'glowshroom')).toBeGreaterThan(10);
      const notes = new Set(all.filter(({ c }) => c.deco === 'stalagmite').map(({ c }) => c.note));
      expect([...notes].sort()).toEqual([0, 1, 2]); // drei Höhen
      expect(count(({ c, m }) => c.ground === 'water' && m[1] > 100)).toBeGreaterThan(150); // der stille See
      expect(count(({ c, m }) => c.ground === 'water' && m[1] < 100)).toBe(6); // das Felsbecken 3 × 2
      expect(count(({ c }) => c.ground === 'path')).toBeGreaterThan(10); // der Steg
      const isle = w.cell(...site.at(...fromMouth([GROTTE.lake.across, GROTTE.lake.out])));
      expect(isle.ground).toBe('grotto');
      expect(steps.has(key(site.at(...fromMouth([GROTTE.lake.across, GROTTE.lake.out]))))).toBe(true); // über den Steg
      const scree = new Set(all.filter(({ c }) => c.ground === 'stone').map(({ c }) => c.h));
      expect([...scree].sort()).toEqual([2, 3, 4]);
    });

    it(`Seed ${seed}: etwa 5 Dinge je 100 Felder, die Mitte bleibt licht; keine Stufe höher als eins`, () => {
      const cells = floor.map((k) => k.split(',').map(Number) as [number, number]);
      const all = placeOf(seed).cells.filter(([x, y]) => w.cell(x, y).region === 'hoehle');
      const things = all.filter(([x, y]) => {
        const d = w.cell(x, y).deco;
        return d === 'crystal' || d === 'stalagmite' || d === 'glowshroom';
      });
      const per100 = (things.length / all.length) * 100;
      expect(per100).toBeGreaterThan(3);
      expect(per100).toBeLessThan(8);
      // der Weg durch die Mitte: frei bis zum See (am Bett führt er um die Mooswiese herum)
      const blocked: number[] = [];
      for (let out = 1; out < GROTTE.lake.out - GROTTE.lake.ry - 1; out++) {
        if (Math.abs(out - GROTTE.bed) <= GROTTE.flat + 1) continue;
        if (w.cell(...site.at(...fromMouth([0, out]))).solid) blocked.push(out);
      }
      expect(blocked, `Seed ${seed}`).toEqual([]);
      const steep = cells.filter(([x, y]) =>
        Object.values(DIRS).some(([dx, dy]) => {
          const n = w.cell(x + dx, y + dy);
          return n.region === 'hoehle' && !n.solid && n.ground !== 'water' && Math.abs(n.h - w.cell(x, y).h) > 1;
        }),
      );
      expect(steep.map(key).slice(0, 3)).toEqual([]);
    });

    it(`Seed ${seed}: Licht: Lichtflecken unter den drei Schächten, Kristalle machen ihre Nachbarn heller, nie grell`, () => {
      const all = placeOf(seed).cells.map((p) => w.cell(...p));
      expect(all.every((c) => (c.light ?? 0) >= 0 && (c.light ?? 0) <= 0.5)).toBe(true);
      const dim = GROTTE.shafts.filter((s) => {
        const c = w.cell(...site.at(...fromMouth(s)));
        return !c.solid && (c.light ?? 0) < GROTTE.shaft.light - 0.01;
      });
      expect(dim, `Seed ${seed}`).toEqual([]);
      const crystal = placeOf(seed).cells.find(([x, y]) => w.cell(x, y).deco === 'crystal')!;
      const n = w.cell(crystal[0] + 1, crystal[1]);
      if (n.region === 'hoehle') expect(n.light ?? 0).toBeGreaterThanOrEqual(GROTTE.glow);
    });
  }
});

describe('Kristallgrotte: nie dunkler als die Dämmerung', () => {
  /** relative Helligkeit einer Farbe (#rrggbb, 0 … 1) */
  const lum = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = v.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it('Höhlenhimmel und Nebel-Maske heller als der Himmel der Lichtung in der Dämmerung (Tageslicht 0,4)', () => {
    // Dämmerung: Himmel der 3D-Ansicht (#9fd6f0) zu 80 % zum Nachthimmel (#141a3a), so steht es in DUSK_SKY
    const mix = (a: number, b: number) => Math.round(a * 0.2 + b * 0.8);
    const dusk = [
      [0x9f, 0x14],
      [0xd6, 0x1a],
      [0xf0, 0x3a],
    ].map(([a, b]) => mix(a!, b!).toString(16).padStart(2, '0'));
    expect(DUSK_SKY).toBe(`#${dusk.join('')}`);
    for (const c of [GROTTE_COLORS.sky, GROTTE_COLORS.mist, ...GROTTE_COLORS.heaven])
      expect(lum(c), c).toBeGreaterThan(lum(DUSK_SKY));
  });

  it('nachts (dunkelste Nacht der Grotte) Höhlenhimmel und Nebel-Maske nicht dunkler als die Dämmerung, wie die 3D-Ansicht mischt', () => {
    // Three.js mischt Farben linear zum Nachthimmel #141a3a (mitwachsen-3d.ts)
    const lin = (hex: string): Rgb =>
      [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as unknown as Rgb;
    const l = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as unknown as Rgb;
    const [dark, dusk] = [lin('#141a3a'), lin(DUSK_SKY)];
    const night = nightIn('hoehle', 1);
    const low = [GROTTE_COLORS.sky, GROTTE_COLORS.mist].filter(
      (c) => l(mix(lin(c), dark, nightMix('hoehle', night, lin(c), dark, dusk))) < l(dusk) - 1e-9,
    );
    expect(low).toEqual([]);
  });

  it('Licht: die Sonne in der Grotte nie schwächer als 0,4, auch ganz nah mit gedämpfter Stimmung', () => {
    const bright = 1 + (MOOD_LIGHT.hoehle!.bright - 1) * 0.4; // so rechnet die 3D-Ansicht die Stimmung ein
    const night = nightIn('hoehle', 1);
    expect(dayOf(night)).toBeCloseTo(DUSK_DAY); // Tageslicht der 3D-Ansicht bei der dunkelsten Nacht
    expect(sunLevel('hoehle', night, bright)).toBeGreaterThanOrEqual(DUSK_DAY);
  });

  it('Lichtflecken machen nur heller (0 … 0,5), Schächte bis 35 %', () => {
    expect(GROTTE.shaft).toEqual({ r: 2.5, light: 0.35 });
    expect(GROTTE.glow).toBe(0.15);
  });
});

describe('Kristallgrotte: Regressions-Seeds bauen', () => {
  it('jede Welt der Regressions-Seeds hat eine Grotte mit Wohnplätzen', () => {
    for (const seed of REGRESSION_SEEDS) expect(worldOf(seed, CAVE).spotsOf('hoehle').length).toBeGreaterThan(5000);
  });
});
