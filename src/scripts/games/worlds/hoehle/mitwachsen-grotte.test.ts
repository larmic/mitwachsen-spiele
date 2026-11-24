import { describe, expect, it } from 'vitest';
import { MOOD_LIGHT, REGIONS, animalId, type Point } from '../../../../data/games/mitwachsen';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { platformsToWake } from '../../mitwachsen-portal';
import { initialState, step, type State } from '../../mitwachsen-state';
import { caveBoxes } from './mitwachsen-cave-look';
import { DUSK_DAY, DUSK_SKY, dayOf, nightIn, nightMix, sunLevel, type Rgb } from '../../mitwachsen-dusk';
import { beyondRing, canStep, kesselPlace, type World } from '../../mitwachsen-world';
import { HOEHLE_PACK, PACKS, REGRESSION_SEEDS, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { GROTTE_ROOM, bedSpots, fromMouth, shedAt, stationAt } from './mitwachsen-grotte';
import { corridorAt, fillZone, type FillZone } from './mitwachsen-fill';
import type { Site } from './mitwachsen-site';
import type { Cell } from '../../mitwachsen-cell';

const CAVE = [HOEHLE_PACK];
/** Seeds, deren Grotte um eine Ecke liegt (die Eis-Welt liegt gerade dahinter im Weg) */
const TURNED = [26, 30];
/** Eigenschafts-Tests, die ganze Welten bauen: wenige Seeds, im tiefen Lauf 20 */
const SEEDS = seedsFor(seedRange(1, 20), [...SAMPLE_SEEDS, ...TURNED]);

type Placed = { bed: Point; cells: readonly Point[]; site: Site };
const placeOf = (seed: number) => kesselPlace(seed, HOEHLE_PACK) as Placed;
const key = ([x, y]: readonly [number, number]) => `${x},${y}`;

/** Ein erreichbares Nachbarfeld von `p` und die Richtung von dort hinein (null: keins) */
function beside(steps: ReadonlyMap<string, number>, p: Point): { at: Point; dir: Dir } | null {
  for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
    const at: Point = [p[0] - dx, p[1] - dy];
    if (steps.has(key(at))) return { at, dir };
  }
  return null;
}

/** Die Figur steht neben `p` (allein, wach, mit `hands`) und läuft hinein: Ereignisse und neuer Zustand */
function walkInto(w: World, steps: ReadonlyMap<string, number>, p: Point, hands: Partial<State> = {}) {
  const from = beside(steps, p);
  if (!from) return null;
  const s: State = {
    ...initialState(w),
    sleeping: false,
    wokeAt: -1e9,
    animals: [],
    ...hands,
    player: { x: from.at[0], y: from.at[1], dir: from.dir },
  };
  const r = step(s, w, { type: 'move', dir: from.dir });
  return { events: r.events, state: r.state };
}

type Placed1 = { p: Point; c: Cell };

/** Was an den Pilzbeeten nicht stimmt: Platz, Boden, Licht, erreichbar, Sammeln, Farben, Abstand */
function bedProblems(w: World, site: Site, steps: ReadonlyMap<string, number>, all: readonly Placed1[]): string[] {
  const bad: string[] = [];
  const beds = all.filter(({ c }) => c.deco === 'shroombed');
  const want = bedSpots().map(([du, dv]) =>
    key(site.at(...fromMouth([GROTTE.garden.across + du, GROTTE.garden.out + dv]))),
  );
  if (
    beds
      .map(({ p }) => key(p))
      .sort()
      .join() !== [...want].sort().join()
  )
    bad.push('Beete nicht an ihren Plätzen');
  const colors = [...GROTTE_COLORS.shrooms] as string[];
  // je Beet drei Leuchtpilze, je einer in Rosa, Türkis und Gelb; abgeerntet keiner mehr
  const caps = ({ p, c }: Placed1, full: boolean) =>
    caveBoxes(w, c, ...p, full)!.flatMap((b) => (colors.includes(b[6]) ? [b[6]] : []));
  for (const bed of beds) {
    const { p, c } = bed;
    if (c.ground !== 'grass' || !c.solid || c.h !== 1) bad.push(`${key(p)}: Beet nicht fest auf Moos`);
    if ((c.light ?? 0) < GROTTE.glow) bad.push(`${key(p)}: Beet leuchtet nicht`);
    const r = walkInto(w, steps, p);
    if (r?.events[0]?.type !== 'gather' || !r.state.shrooms) bad.push(`${key(p)}: nicht erreichbar oder sammelt nicht`);
    if (caps(bed, true).sort().join() !== [...colors].sort().join()) bad.push(`${key(p)}: Farben`);
    if (caps(bed, false).length) bad.push(`${key(p)}: abgeerntet noch Pilze`);
  }
  // je Beet freies Moos ringsum (einzeln wie Busch und Fischkiste)
  const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  if (beds.some((a) => beds.some((b) => a !== b && cheb(a.p, b.p) <= 2))) bad.push('Beete zu dicht');
  return bad;
}

/** Was an Tropfquelle, Tropfmoos und Wasser nicht stimmt: eine Quelle am Becken, die Kanne füllt sich, Moos begehbar */
function dripProblems(w: World, site: Site, steps: ReadonlyMap<string, number>, all: readonly Placed1[]): string[] {
  const bad: string[] = [];
  const springs = all.filter(({ c }) => c.deco === 'dripspring');
  if (springs.length !== 1) bad.push(`${springs.length} Tropfquellen`);
  for (const { p } of springs) {
    const r = walkInto(w, steps, p);
    if (r?.events[0]?.type !== 'fill' || !r.state.bucket) bad.push('an der Tropfquelle füllt sich die Kanne nicht');
    const basin = Object.values(DIRS).filter(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy).ground === 'water');
    if (basin.length !== 1) bad.push('Tropfquelle nicht am Becken');
  }
  const moss = all.filter(({ c }) => c.deco === 'dripmoss');
  if (moss.length < 6) bad.push(`nur ${moss.length} Felder Tropfmoos`);
  for (const { p, c } of moss) if (c.solid || !steps.has(key(p))) bad.push(`${key(p)}: Tropfmoos nicht begehbar`);
  return [...bad, ...scoopProblems(w, site, steps, all)];
}

/** Wo man schöpft: im Felsbecken von vorn (die vordere Reihe des Rands erreichbar) und am See, beides für sich */
function scoopProblems(w: World, site: Site, steps: ReadonlyMap<string, number>, all: readonly Placed1[]): string[] {
  const bad: string[] = [];
  // im Felsbecken schöpft man von vorn: die vordere Reihe des Rands (dv = −2) ist erreichbar, das Wasser dahinter füllt
  const { drip, lake } = GROTTE;
  const inBasin = (du: number, dv: number) => site.at(...fromMouth([drip.across + drip.basin + du, drip.out + dv]));
  for (const du of [-1, 0, 1])
    if (!steps.has(key(inBasin(du, -2)))) bad.push(`Rand vorn am Becken (${du}) unerreichbar`);
  const basin = inBasin(0, -1);
  const scoop = w.cell(...basin).ground === 'water' ? walkInto(w, steps, basin) : null;
  if (scoop?.events[0]?.type !== 'fill') bad.push('im Felsbecken füllt sich die Kanne nicht');
  // und am See
  const inLake = ({ p, c }: Placed1) => {
    const [u, v] = mouthOf(site, p);
    return c.ground === 'water' && ((u - lake.across) / lake.rx) ** 2 + ((v - lake.out) / lake.ry) ** 2 < 1;
  };
  const shore = all.find((q) => inLake(q) && beside(steps, q.p));
  const fill = shore && walkInto(w, steps, shore.p);
  if (fill?.events[0]?.type !== 'fill') bad.push('am See füllt sich die Kanne nicht');
  return bad;
}

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

/** Dinge auf dem Boden der Grotte, die zur Dichte zählen: verstreute Dinge und Füllung */
const THINGS: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>([
  'crystal',
  'stalagmite',
  'glowshroom',
  'crystalbush',
  'boulder',
  'mosstop',
  'puddle',
  'fern',
]);
/** Feste Dinge, die verstreut oder als Füllung stehen */
const SOLID_FILL: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>([
  'crystal',
  'stalagmite',
  'crystalbush',
  'boulder',
]);
/** die acht Nachbarn eines Felds */
const AROUND = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].flatMap((dy) => (dx || dy ? [[dx, dy] as const] : [])));
/** die Felder genau zwei Schritte (Chebyshev) um ein Feld: ein Feld dazwischen frei */
const RING2 = [-2, -1, 0, 1, 2].flatMap((dx) =>
  [-2, -1, 0, 1, 2].flatMap((dy) => (Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? [[dx, dy] as const] : [])),
);

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

    it(`Seed ${seed}: Bett 28 Felder hinter der Mündung, das fernste Feld weit weg; Portal am See schläft, bis der Maulwurf zu Hause ist`, () => {
      expect(mouthOf(site, home.bed)).toEqual([0, GROTTE.bed]);
      const far = Math.max(...floor.map((k) => steps.get(k)!));
      expect(far).toBeGreaterThan(110);
      expect(far).toBeLessThan(160);
      const portal = w.portals.get('hoehlensee')!;
      expect(portal.later).toBe(FIRST_MOLE);
      expect(portal.bed).toEqual(home.bed);
      expect(mouthOf(site, portal.gate)).toEqual(GROTTE.portal);
      expect(steps.get(key(portal.gate))).toBeGreaterThan(100); // der lange Weg ans Ende
      expect(Math.round(Math.hypot(portal.home[0] - home.bed[0], portal.home[1] - home.bed[1]))).toBe(9);
      expect(FIRST_MOLE).toBe(animalId('hoehle', 'maulwurf'));
      // auch am Bett und auf der Plattform erwacht es nicht, solange der erste Maulwurf nicht zu Hause wohnt
      const others = new Set([animalId('hoehle', 'dachs'), animalId('hoehle', 'maulwurf', 2)]);
      for (const p of [home.wake[0]!, portal.gate])
        expect(platformsToWake(w.portals, [], p[0], p[1], () => true, others)).not.toContain('hoehlensee');
      // wohnt er zu Hause, erwacht es beim Ankommen am Höhlenbett (wie das Eis-Portal), nicht an der fernen Plattform
      const mole = new Set([FIRST_MOLE]);
      expect(platformsToWake(w.portals, [], ...home.wake[0]!, () => true, mole)).toContain('hoehlensee');
      expect(platformsToWake(w.portals, [], ...portal.gate, () => true, mole)).not.toContain('hoehlensee');
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
      // Säulen-Glockenspiel: fünf Säulen in einer Reihe quer, Töne 0 (C5) bis 4 (A5) von links nach rechts
      const columns = all.filter(({ c }) => c.deco === 'column').sort((a, b) => a.m[0] - b.m[0]);
      expect(columns.map(({ c }) => c.note)).toEqual([0, 1, 2, 3, 4]);
      expect(new Set(columns.map(({ m }) => m[1])).size).toBe(1);
      expect(columns.every(({ c }) => c.solid && c.region === 'hoehle')).toBe(true);
      expect(count(({ c }) => c.deco === 'crystalarch')).toBe(5);
      expect(count(({ c }) => c.deco === 'crystalarch' && c.solid)).toBe(2); // nur die Pfeiler
      // unter dem Bogen drei Sitzplätze zum Hängen (die Fledermäuse), sonst nirgends
      expect(count(({ c }) => c.perch !== undefined)).toBe(3);
      expect(count(({ c }) => c.perch !== undefined && c.deco === 'crystalarch' && !c.solid)).toBe(3);
      expect(count(({ c }) => c.deco === 'glowshroom')).toBeGreaterThan(10);
      const notes = new Set(all.filter(({ c }) => c.deco === 'stalagmite').map(({ c }) => c.note));
      expect([...notes].sort()).toEqual([0, 1, 2]); // drei Höhen
      expect(count(({ c, m }) => c.ground === 'water' && m[1] > 100)).toBeGreaterThan(150); // der stille See
      expect(count(({ c, m }) => c.ground === 'water' && m[1] < 100)).toBe(6); // das Felsbecken 3 × 2
      expect(count(({ c }) => c.ground === 'path')).toBeGreaterThan(10); // der Steg
      // der Holzsteg: jede Planke begehbar, drei Planken an seinem Ende (`note` 1) grenzen an die Kristallinsel, und
      // neben dem Ende ist Wasser (dort taucht der Grottenolm auf)
      const jetty = all.filter(({ c }) => c.deco === 'jetty');
      expect(jetty.length).toBe(count(({ c }) => c.ground === 'path'));
      expect(jetty.every(({ c }) => !c.solid && c.ground === 'path')).toBe(true);
      const ends = jetty.filter(({ c }) => c.note === 1);
      expect(ends.length).toBe(3);
      expect(ends.every(({ m }) => m[1] === Math.max(...jetty.map((j) => j.m[1])))).toBe(true);
      expect(ends.every(({ p }) => steps.has(key(p)))).toBe(true);
      const isle = w.cell(...site.at(...fromMouth([GROTTE.lake.across, GROTTE.lake.out])));
      expect(isle.ground).toBe('grotto');
      expect(steps.has(key(site.at(...fromMouth([GROTTE.lake.across, GROTTE.lake.out]))))).toBe(true); // über den Steg
      const scree = new Set(all.filter(({ c }) => c.ground === 'stone').map(({ c }) => c.h));
      expect([...scree].sort()).toEqual([2, 3, 4]);
    });

    it(`Seed ${seed}: etwa 8 Dinge je 100 Felder samt Füllung, die Mitte bleibt licht; keine Stufe höher als eins`, () => {
      const cells = floor.map((k) => k.split(',').map(Number) as [number, number]);
      const all = placeOf(seed).cells.filter(([x, y]) => w.cell(x, y).region === 'hoehle');
      const things = all.filter(([x, y]) => THINGS.has(w.cell(x, y).deco));
      const per100 = (things.length / all.length) * 100;
      expect(per100, `Seed ${seed}`).toBeGreaterThan(5);
      expect(per100, `Seed ${seed}`).toBeLessThan(11);
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

    it(`Seed ${seed}: Sammeln: sechs Pilzbeete im Pilzgarten, Tropfquelle und Tropfmoos am Felsbecken, alles erreichbar`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p) }));
      const bad = [...bedProblems(w, site, steps, all), ...dripProblems(w, site, steps, all)];
      // Futter und Wasser am Höhlenbett: mit Pilzen in die Pilzschale, mit der Kanne in den Steintrog
      const feed = walkInto(w, steps, home.food, { shrooms: true });
      if (feed?.events[0]?.type !== 'feed' || feed.state.shrooms) bad.push('Pilzschale nimmt keine Pilze');
      const pour = walkInto(w, steps, home.water, { bucket: true });
      if (pour?.events[0]?.type !== 'pour' || pour.state.bucket) bad.push('Steintrog nimmt kein Wasser');
      expect(bad, `Seed ${seed}`).toEqual([]);
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
      // Kristallbüsche leuchten wie Kristalle
      const bushes = placeOf(seed).cells.filter(([x, y]) => w.cell(x, y).deco === 'crystalbush');
      expect(bushes.filter(([x, y]) => (w.cell(x, y).light ?? 0) < GROTTE.glow).map(key)).toEqual([]);
    });

    it(`Seed ${seed}: Füllung: Stalagmiten-Gruppen, Kristallbüsche, Felsbrocken, Felsinseln, Pfützen, je Zone dicht genug, nichts abgeschnitten`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p), uv: site.uv(...p) }));
      const inGrotto = all.filter(({ c }) => c.region === 'hoehle');
      const is = (deco: Cell['deco']) => inGrotto.filter(({ c }) => c.deco === deco);
      const bad: string[] = [];
      // nichts wird von der Füllung abgeschnitten: kein Feld neben einem festen Ding der Füllung wird Fels, weil man es
      // nicht erreicht (am Rand der Mündung kann zwischen Klippe und Lampe ein einzelnes Feld Fels werden, wie bisher)
      const fillAt = new Set(inGrotto.filter(({ c }) => SOLID_FILL.has(c.deco)).map(({ p }) => key(p)));
      const sealed = inGrotto.filter(
        ({ c, p: [x, y] }) => c.deco === 'rock' && AROUND.some(([dx, dy]) => fillAt.has(key([x + dx, y + dy]))),
      );
      if (sealed.length) bad.push(`${sealed.length} Felder abgeschnitten, etwa ${key(sealed[0]!.p)}`);
      // feste Dinge nie Seite an Seite oder über Eck: zwischen zweien bleibt immer ein begehbares Feld
      const solids = fillAt;
      for (const k of solids) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        for (const [dx, dy] of AROUND) if (solids.has(key([x + dx, y + dy]))) bad.push(`${k}: Nachbar fest`);
        if (!Object.values(DIRS).some(([dx, dy]) => steps.has(key([x + dx, y + dy])))) bad.push(`${k}: unerreichbar`);
      }
      // Stalagmiten-Gruppen: viele Stalagmiten mit einem zweiten genau ein freies Feld daneben, in drei Höhen
      const stal = is('stalagmite');
      const stalKeys = new Set(stal.map(({ p }) => key(p)));
      const grouped = stal.filter(({ p: [x, y] }) => RING2.some(([dx, dy]) => stalKeys.has(key([x + dx, y + dy]))));
      if (grouped.length < 100) bad.push(`nur ${grouped.length} Stalagmiten in Gruppen`);
      if (new Set(grouped.map(({ c }) => c.note)).size !== 3) bad.push('Gruppen nicht in drei Höhen');
      // Kristallbüsche fest und niedrig, Felsbrocken fest, Felsinseln eine Stufe hoch und begehbar, Pfützen begehbar
      const counts = { crystalbush: 20, boulder: 5, mosstop: 30, puddle: 20 } as const;
      for (const [deco, min] of Object.entries(counts) as [keyof typeof counts, number][])
        if (is(deco).length < min) bad.push(`nur ${is(deco).length} ${deco}`);
      for (const { p, c } of [...is('mosstop'), ...is('puddle')])
        if (c.solid || !steps.has(key(p))) bad.push(`${key(p)}: ${c.deco} nicht begehbar`);
      if (is('mosstop').some(({ c }) => c.h !== 2)) bad.push('Felsinsel nicht eine Stufe hoch');
      if ([...is('crystalbush'), ...is('boulder')].some(({ c }) => !c.solid)) bad.push('Busch oder Brocken nicht fest');
      // Dichte je Zone: am Rand und in der Tropfsteingrotte mindestens so dicht wie an den Seiten, keine leer
      const density = (z: FillZone) => {
        const cellsOf = inGrotto.filter(({ uv }) => fillZone(...uv) === z);
        return (cellsOf.filter(({ c }) => SOLID_FILL.has(c.deco)).length / cellsOf.length) * 100;
      };
      for (const z of ['rim', 'drip', 'side'] as const) {
        const d = density(z);
        if (d < 3.5 || d > 14) bad.push(`Zone ${z}: ${d.toFixed(1)} feste Dinge je 100 Felder`);
      }
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Moos und Farn nur unter den Lichtschächten, Lehmhang des Dachses neben dem Pilzgarten`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p), m: mouthOf(site, p) }));
      const bad: string[] = [];
      const underShaft = (m: Point) =>
        GROTTE.shafts.some(([a, o]) => Math.hypot(m[0] - a, m[1] - o) <= GROTTE.fill.shade.r);
      const { garden, drip, clay } = GROTTE;
      const ferns = all.filter(({ c }) => c.region === 'hoehle' && c.deco === 'fern');
      if (ferns.length < 5) bad.push(`nur ${ferns.length} Farne`);
      for (const { p, c, m } of ferns)
        if (!underShaft(m) || c.solid || c.ground !== 'grass') bad.push(`Farn ${key(p)}`);
      // Moos (ground 'grass') nur auf der Mooswiese am Bett, im Pilzgarten, am Felsbecken und unter den Schächten
      const mossy = all.filter(
        ({ c, m }) =>
          c.region === 'hoehle' &&
          c.ground === 'grass' &&
          !c.garden &&
          Math.hypot(m[0] - garden.across, m[1] - garden.out) > garden.r &&
          Math.hypot(m[0] - drip.across - drip.basin, m[1] - drip.out) > 3 &&
          !underShaft(m),
      );
      if (mossy.length) bad.push(`Moos fern der Schächte, etwa ${key(mossy[0]!.p)}`);
      if (
        all.filter(
          ({ c, m }) => c.ground === 'grass' && Math.hypot(m[0] - GROTTE.shafts[1][0], m[1] - GROTTE.shafts[1][1]) <= 3,
        ).length < 10
      )
        bad.push('kein Moos unter dem Schacht der Kristallhalle');
      // Lehmhang: zwei Stufen Lehm (Höhe 2 und 3), begehbar und erreichbar, links neben dem Pilzgarten
      const bank = all.filter(({ c }) => c.deco === 'clay');
      if (bank.length < clay.long * 2) bad.push(`nur ${bank.length} Felder Lehm`);
      for (const { p, c, m } of bank) {
        if (c.solid || !steps.has(key(p)) || c.h < 2 || c.h > 3) bad.push(`Lehm ${key(p)}`);
        if (m[0] > clay.across || Math.abs(m[1] - clay.out) > clay.long) bad.push(`Lehm ${key(p)} nicht am Hang`);
      }
      if (new Set(bank.map(({ c }) => c.h)).size !== 2) bad.push('Lehmhang nicht in zwei Stufen');
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: die Spur des künftigen Gleises von der Mündung bis zum Platz des Bahnhofs bleibt frei und eben`, () => {
      const corridor = placeOf(seed).cells.filter((p) => corridorAt(...site.uv(...p)));
      expect(corridor.length).toBeGreaterThan(40);
      const blocked = corridor.filter((p) => {
        const c = w.cell(...p);
        return c.region !== 'hoehle' || c.solid || !!c.deco || c.h !== 1 || c.ground !== 'grotto' || !steps.has(key(p));
      });
      expect(blocked.map(key), `Seed ${seed}`).toEqual([]);
      // sie reicht von der Mündung (o 0) bis an den Bahnsteig (ein Feld davor, auf der Höhe seiner Felder)
      const mouthward = corridor.map((p) => mouthOf(site, p));
      expect(Math.min(...mouthward.map(([, o]) => o))).toBe(0);
      const { station } = GROTTE;
      expect(mouthward.some(([a, o]) => o === station.out - 1 && a === station.side)).toBe(true);
      // und hinüber bis an die Spur hinter dem Bahnsteig (dort hält der Zug, der Weg zum Bahnsteig kreuzt kein Gleis)
      expect(mouthward.some(([a, o]) => o === station.out - 1 && a === station.side + station.wide)).toBe(true);
    });

    it(`Seed ${seed}: der Platz des Bahnhofs ist für die Bahn markiert, die Spur u −2 der Bucht kommt auf seiner Seite an`, () => {
      const cells = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p) }));
      const stops = cells.filter(({ c }) => c.stop === 'hoehle');
      expect(stops.map(({ p }) => key(p)).sort()).toEqual(
        cells
          .filter(({ p }) => stationAt(...site.uv(...p)))
          .map(({ p }) => key(p))
          .sort(),
      );
      expect(stops).toHaveLength(GROTTE.station.long * GROTTE.station.wide);
      // Spur u −2 der Bucht (u wächst nach [−out.y, out.x], mitwachsen-bay.ts) durch den Gang: in der Grotte bei u +2
      const g = w.gates.get('hoehle')!;
      const lane = (t: number): Point => [
        g.mid[0] + 2 * g.out[1] + g.out[0] * t,
        g.mid[1] - 2 * g.out[0] + g.out[1] * t,
      ];
      if (!site.turn) expect(site.uv(...lane(g.deep + 1))[0]).toBe(2);
      expect(GROTTE.station.side).toBeGreaterThan(2); // der Bahnhof liegt auf der Seite u+
    });
  }
});

describe('Pilzbeete im Kreis', () => {
  it('alle Beete gleich weit von der Mitte des Pilzgartens, der Kreis spiegelgleich (quer und vom Tor weg)', () => {
    const spots = bedSpots();
    expect(spots).toHaveLength(GROTTE.garden.beds);
    expect(spots.map(([u, v]) => Math.round(Math.hypot(u, v)))).toEqual(spots.map(() => GROTTE.garden.ring));
    const all = new Set(spots.map(key));
    const mirror = (f: (p: Point) => Point) => spots.filter((p) => !all.has(key(f(p)))).map(key);
    expect([mirror(([u, v]) => [-u + 0, v]), mirror(([u, v]) => [u, -v + 0])]).toEqual([[], []]);
  });
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
