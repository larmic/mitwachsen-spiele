import { beforeAll, describe, expect, it } from 'vitest';
import { fromKey } from '../../lib/games/chunks';
import { DIRS } from '../../lib/games/front';
import { GATES, REGIONS, type GateId } from '../../data/games/mitwachsen';
import { HOMES } from '../../data/games/mitwachsen-homes';
import { BED_STONE, ICE_STONE } from '../../data/games/mitwachsen-stories';
import { PLATFORM_HALF, platformArea, platformCells, platformLift, withNeighbours } from './mitwachsen-portal';
import { ICE_ANIMALS, KESSEL, KESSEL_COLORS } from '../../data/games/worlds/eis/mitwachsen-kessel';
import { KESSEL_WILDS } from './worlds/eis/mitwachsen-kessel';
import { FROST, HEAPS } from './worlds/eis/mitwachsen-frost';
import { HAUNTS } from './worlds/eis/mitwachsen-haunts';
import { bergPeak } from './worlds/eis/mitwachsen-ice-sky';
import { ICE_CRYSTALS } from '../../data/games/mitwachsen-eis';
import { SEATS, crossings } from './mitwachsen-border';
import {
  GATE_HALF,
  HOUSE_DEPTH,
  TOWER,
  beyondRing,
  canStep,
  createWorld,
  gatePlaces,
  kesselPlace,
  portalPlaces,
  standHeight,
  type Cell,
  type World,
} from './mitwachsen-world';
import { wildAnimals } from './mitwachsen-wild';
import { homeAt } from './mitwachsen-home';
import { APRON } from './mitwachsen-apron';
import { EIS_PACK, PACKS, worldOf } from './test-worlds';

/** Alle Felder, die von `start` aus zu Fuß erreichbar sind (bis `limit` Felder) */
function reachable(world: World, open: GateId[], start: readonly [number, number], limit = 30000) {
  const seen = new Set<string>([`${start[0]},${start[1]}`]);
  const queue: [number, number][] = [[start[0], start[1]]];
  while (queue.length && seen.size < limit) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of Object.values(DIRS)) {
      const k = `${x + dx},${y + dy}`;
      if (seen.has(k) || !canStep(world, open, x, y, x + dx, y + dy)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return [...seen].map((k) => k.split(',').map(Number) as [number, number]);
}
const lichtung = REGIONS[0];
/** Zuhause der Lichtung: Bett in ihrer Mitte, in jeder Welt gleich */
const LICHTUNG = worldOf(1).homes.lichtung;
const START = LICHTUNG.wake[0]!;
const SEEDS = [1, 42, 2026, 7, 99, 123456, 15838, 23757, 55433, 95028];
/** Die acht Nachbarfelder und das Feld selbst */
const RING_1 = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const));

describe('Welt aus dem Seed', () => {
  it('entsteht aus demselben Seed immer gleich, aus einem anderen anders', () => {
    const a = createWorld(1234, PACKS),
      b = createWorld(1234, PACKS),
      c = createWorld(99, PACKS);
    let differs = 0;
    for (let y = -60; y < 60; y += 3)
      for (let x = -60; x < 60; x += 3) {
        expect(a.cell(x, y)).toEqual(b.cell(x, y));
        if (JSON.stringify(a.cell(x, y)) !== JSON.stringify(c.cell(x, y))) differs++;
      }
    expect(differs).toBeGreaterThan(100);
  });
});

describe('Start auf der Lichtung', () => {
  for (const seed of SEEDS) {
    const w = worldOf(seed);

    it(`Seed ${seed}: In der Mitte steht nur das Bett, ringsum ist es frei`, () => {
      expect(w.cell(LICHTUNG.bed[0], LICHTUNG.bed[1]).deco).toBe('bed');
      for (let y = -LICHTUNG.clear; y <= LICHTUNG.clear; y++)
        for (let x = -LICHTUNG.clear; x <= LICHTUNG.clear; x++) {
          if (x === LICHTUNG.bed[0] && y === LICHTUNG.bed[1]) continue;
          expect(standHeight(w, [], x, y), `${x},${y}`).toBe(1);
        }
      for (const [x, y] of LICHTUNG.wake) expect(standHeight(w, [], x, y)).not.toBeNull();
    });

    it(`Seed ${seed}: Alle Tiere wohnen erreichbar auf der Lichtung (vier je Art), die Landschaft bleibt draußen`, () => {
      const cells = reachable(w, [], START);
      const set = new Set(cells.map(([x, y]) => `${x},${y}`));
      const own = [...w.spawns].filter(([id]) => id.startsWith('lichtung:'));
      expect(own).toHaveLength(lichtung.animals.length * lichtung.herd); // 48 Tiere, vier je Art
      const spots = new Set<string>();
      for (const [id, [x, y]] of own) {
        expect(w.cell(x, y).region, id).toBe('lichtung');
        expect(set.has(`${x},${y}`), id).toBe(true);
        spots.add(`${x},${y}`);
      }
      expect(spots.size).toBe(own.length); // jedes Tier hat seinen eigenen Platz
      expect(cells.some(([x, y]) => w.cell(x, y).region === 'wild')).toBe(false);
      expect(cells.length).toBeGreaterThan(9000); // groß genug zum Erkunden
    });

    it(`Seed ${seed}: Auf der Lichtung ist keine Stufe höher als eins, man kommt überall wieder heraus`, () => {
      const cells = reachable(w, [], START);
      for (const [x, y] of cells)
        for (const [dx, dy] of Object.values(DIRS)) {
          const a = standHeight(w, [], x, y)!,
            b = standHeight(w, [], x + dx, y + dy);
          if (b !== null) expect(Math.abs(b - a), `${x},${y} → ${x + dx},${y + dy}`).toBeLessThanOrEqual(1);
        }
    });

    it(`Seed ${seed}: Der Felsring ist nicht zu betreten`, () => {
      let rocks = 0;
      for (let y = -110; y <= 110; y += 2)
        for (let x = -110; x <= 110; x += 2)
          if (w.cell(x, y).deco === 'rock') {
            rocks++;
            expect(standHeight(w, [], x, y), `${x},${y}`).toBeNull();
          }
      expect(rocks).toBeGreaterThan(500);
    });

    it(`Seed ${seed}: Bäume und Büsche stehen einzeln, man kann um jeden herumgehen`, () => {
      const solid = (x: number, y: number) => ['tree', 'bush'].includes(w.cell(x, y).deco ?? '');
      /** Hindernisse im Umkreis von zwei Feldern um (x, y), ohne (x, y) selbst */
      const neighbours = (x: number, y: number) =>
        [-2, -1, 0, 1, 2]
          .flatMap((dy) => [-2, -1, 0, 1, 2].map((dx): [number, number] => [x + dx, y + dy]))
          .filter(([nx, ny]) => (nx !== x || ny !== y) && solid(nx, ny));
      let trees = 0;
      for (let y = -lichtung.shape.ry; y <= lichtung.shape.ry; y++)
        for (let x = -lichtung.shape.rx; x <= lichtung.shape.rx; x++) {
          if (w.cell(x, y).region !== 'lichtung' || !solid(x, y)) continue;
          trees++;
          expect(neighbours(x, y), `${x},${y}`).toEqual([]);
        }
      expect(trees).toBeGreaterThan(50); // es gibt sie aber noch
    });

    it(`Seed ${seed}: Die großen Tore liegen weit vom Bett`, () => {
      for (const { mid } of w.gates.values())
        expect(Math.hypot(mid[0] - LICHTUNG.bed[0], mid[1] - LICHTUNG.bed[1])).toBeGreaterThan(60);
    });

    it(`Seed ${seed}: In der Landschaft klettert man eine Stufe hinauf und fällt beliebig tief herunter`, () => {
      let up = 0,
        down = 0;
      for (let y = 130; y < 170; y++)
        for (let x = -200; x < 200; x++) {
          const a = standHeight(w, [], x, y),
            b = standHeight(w, [], x + 1, y);
          if (a === null || b === null) continue;
          expect(canStep(w, [], x, y, x + 1, y)).toBe(b - a <= 1);
          if (b - a >= 2) up++;
          if (a - b >= 2) down++;
        }
      expect(up + down).toBeGreaterThan(0); // es gibt Stellen mit großem Höhenunterschied
    });

    it(`Seed ${seed}: Acht große Tore zu je fünf Feldern, alle verschlossen, mit Türmen daneben`, () => {
      expect([...w.gates.keys()].sort()).toEqual(GATES.map((g) => g.id).sort());
      for (const g of GATES) {
        const { cells, out } = w.gates.get(g.id)!;
        const [mx, my] = cells[2]!; // mittleres Torfeld
        expect(cells).toHaveLength(5);
        const [ax, ay] = [Math.abs(out[1]), Math.abs(out[0])]; // entlang der Torreihe
        for (const k of [3, 4]) {
          for (const [x, y] of [
            [mx + ax * k, my + ay * k],
            [mx - ax * k, my - ay * k],
          ] as const) {
            expect(w.cell(x, y).deco, `${g.id} Turm`).toBe('gatetower');
            expect(standHeight(w, [], x, y)).toBeNull();
          }
        }
        for (const [x, y] of cells) {
          expect(w.cell(x, y).deco).toBe('biggate');
          expect(w.cell(x, y).gate).toBe(g.id);
          expect(standHeight(w, [], x, y)).toBeNull();
        }
        expect(g.opens).toEqual(g.id === 'eis' ? { key: 'pinguin' } : 'never'); // das Eistor öffnet der Pinguin
      }
    });

    it(`Seed ${seed}: Vor jedem großen Tor kommt man hin, dahinter nie (auch nicht außen herum)`, () => {
      const cells = reachable(w, [], START);
      const set = new Set(cells.map(([x, y]) => `${x},${y}`));
      for (const g of GATES) {
        const { cells: row, out } = w.gates.get(g.id)!;
        for (const [x, y] of row) {
          expect(set.has(`${x - out[0]},${y - out[1]}`), `${g.id} davor`).toBe(true);
          expect(set.has(`${x + out[0]},${y + out[1]}`), `${g.id} dahinter`).toBe(false);
          expect(w.cell(x + out[0], y + out[1]).biome, `${g.id} Gang in seine Welt`).toBe(g.id);
        }
      }
      expect(cells.some(([x, y]) => w.cell(x, y).biome)).toBe(false);
    });

    it(`Seed ${seed}: Hinter jedem Tor liegt in seiner Richtung seine Welt`, () => {
      const { rx, ry } = lichtung.shape;
      for (const { id, angle } of w.gates.values())
        for (const k of [1.6, 2.2, 3]) {
          const x = Math.round(Math.cos(angle) * rx * k),
            y = Math.round(Math.sin(angle) * ry * k);
          expect(w.cell(x, y).biome, `${id} bei ${x},${y}`).toBe(id);
        }
    });
  }

  it('Lage und Reihenfolge der Tore würfelt der Seed', () => {
    const mids = (gates: World['gates']) => GATES.map((g) => gates.get(g.id)!.mid.join(',')).join(' ');
    expect(mids(gatePlaces(5))).not.toBe(mids(gatePlaces(6)));
    expect(mids(gatePlaces(5))).toBe(mids(gatePlaces(5)));
    expect(mids(worldOf(5).gates)).toBe(mids(gatePlaces(5))); // die gebaute Welt hat dieselben Tore
  });

  it('Die fünf Felder jedes großen Tores liegen in einer geraden Reihe, Tore weit auseinander (viele Seeds)', () => {
    for (let seed = 1; seed < 400; seed += 25) {
      const gates = gatePlaces(seed * 4513); // nur die Tore: schnell, auch auf dem langsamen Runner der Pipeline
      const all = [...gates.values()];
      for (const a of all)
        for (const b of all)
          if (a !== b) expect(Math.hypot(a.mid[0] - b.mid[0], a.mid[1] - b.mid[1])).toBeGreaterThan(30);
      for (const { cells } of gates.values()) {
        const xs = new Set(cells.map(([x]) => x)),
          ys = new Set(cells.map(([, y]) => y));
        expect(xs.size === 1 || ys.size === 1, `Seed ${seed * 4513}`).toBe(true);
      }
    }
  });

  for (const seed of [3, 42]) {
    it(`Seed ${seed}: Ums Bett liegt die Wiese, eben und frei, mit Futter- und Wassertrog`, () => {
      const w = worldOf(seed);
      const reach = new Set(reachable(w, [], START).map(([x, y]) => `${x},${y}`));
      let meadow = 0;
      for (let y = -LICHTUNG.meadow; y <= LICHTUNG.meadow; y++)
        for (let x = -LICHTUNG.meadow; x <= LICHTUNG.meadow; x++) {
          if (Math.hypot(x, y) > LICHTUNG.meadow) continue;
          const c = w.cell(LICHTUNG.bed[0] + x, LICHTUNG.bed[1] + y);
          if (c.deco === 'bed' || c.portal) continue;
          expect(c.garden, `${x},${y}`).toBe(true);
          if (c.solid) continue; // Tröge
          meadow++;
          expect(standHeight(w, [], LICHTUNG.bed[0] + x, LICHTUNG.bed[1] + y)).toBe(1);
          expect(reach.has(`${LICHTUNG.bed[0] + x},${LICHTUNG.bed[1] + y}`)).toBe(true);
        }
      expect(meadow).toBeGreaterThan(90);
      expect(w.cell(...LICHTUNG.food).deco).toBe('trough');
      expect(w.cell(...LICHTUNG.water).deco).toBe('watertrough');
      // Tiere der Lichtung wohnen nicht auf der Wiese
      for (const [x, y] of w.spawns.values()) expect(w.cell(x, y).garden).toBeUndefined();
    });
  }
});

describe('Zuhause je Gegend', () => {
  for (const seed of [1, 42]) {
    it(`Seed ${seed}: jede Gegend hat ein Zuhause: Bett, Wiese, Tröge und Unterstand liegen in ihr, wie HOMES sie legt`, () => {
      const w = worldOf(seed);
      expect(w.homes.lichtung.bed).toEqual([0, 0]); // das Bett der Lichtung steht in ihrer Mitte
      for (const r of REGIONS) {
        const home = w.homes[r.id];
        const plan = HOMES[r.id];
        const at = ([x, y]: readonly [number, number]) => [home.bed[0] + x, home.bed[1] + y];
        expect(home.realm).toBe(r.id);
        expect(w.cell(...home.bed).deco).toBe('bed');
        expect(home.food).toEqual(at(plan.food));
        expect(home.water).toEqual(at(plan.water));
        expect(home.shelterStem).toEqual(at(plan.shelterStem));
        expect(home.wake).toEqual(plan.wake.map(at));
        // Lichtung: Futtertrog und Riesenpilz; Eis-Welt: Eisschale und Iglu (Mitte seiner Rückwand)
        const [food, stem, many] = r.id === 'lichtung' ? ['trough', 'shelterpilz', 1000] : ['icebowl', 'igloo', 500];
        expect(w.cell(...home.food).deco).toBe(food);
        expect(w.cell(...home.water).deco).toBe('watertrough');
        expect(w.cell(...home.shelterStem).deco).toBe(stem);
        for (const [x, y] of home.wake) expect(standHeight(w, [], x, y)).not.toBeNull();
        for (const p of [home.bed, home.food, home.water, home.shelterStem, ...home.wake])
          expect(w.realm(...p), p.join(',')).toBe(r.id);
        expect(homeAt(w, ...home.bed)).toBe(home);
        const spots = w.spotsOf(r.id);
        expect(spots.length).toBeGreaterThan(many);
        for (const [x, y] of spots) {
          expect(w.realm(x, y)).toBe(r.id);
          expect(w.cell(x, y).garden).toBeUndefined();
        }
      }
    });
  }
});

const keyOf = ([x, y]: readonly [number, number]) => `${x},${y}`;
const chebOf = (a: readonly number[], b: readonly number[]) =>
  Math.max(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!));

/** Feld (dx, dy) um eine Plattform: frei und nicht im Gang; im äußeren Ring auch eben und keine Plattform */
function ringFree(w: World, gang: ReadonlySet<string>, [cx, cy]: readonly [number, number], dx: number, dy: number) {
  const c = w.cell(cx + dx, cy + dy);
  const free = !c.solid && c.ground !== 'water' && !c.garden && !gang.has(`${cx + dx},${cy + dy}`);
  return free && (Math.max(Math.abs(dx), Math.abs(dy)) < 2 || (!c.portal && c.h === 1));
}

/** Was an einer Plattform des Eis-Portals nicht stimmt: Felder, Ring ringsum, Zugänge (leer, wenn alles passt) */
function icePlatformFaults(w: World, side: 'gate' | 'home', reach: ReadonlySet<string>): string[] {
  const wrong: string[] = [];
  const centre = w.portals.get('eiskessel')![side];
  const crossing = crossings(w)[0]!;
  for (const { x, y, at } of platformCells(centre)) {
    const c = w.cell(x, y);
    if (JSON.stringify(c.portal) !== JSON.stringify({ id: 'eiskessel', side, at }))
      wrong.push(`${side} ${x},${y} Feld`);
    if (c.solid || c.h !== w.cell(...centre).h || c.slide || c.garden) wrong.push(`${side} ${x},${y} flach und frei`);
    if (w.realm(x, y) !== 'eis' || c.region !== 'eis' || !reach.has(`${x},${y}`))
      wrong.push(`${side} ${x},${y} Kessel`);
  }
  // ringsum zwei Felder ebener Schnee, frei, nicht im Gang; von allen vier Seiten erreichbar
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      if (!ringFree(w, crossing.cells, centre, dx, dy)) wrong.push(`${side} Ring ${dx},${dy}`);
  for (const [dx, dy] of Object.values(DIRS))
    if (!reach.has(`${centre[0] + 2 * dx},${centre[1] + 2 * dy}`)) wrong.push(`${side} Zugang ${dx},${dy}`);
  return wrong;
}

/** Was am Eis-Portal einer Welt nicht stimmt: beide Plattformen, ihre Lage, Warteplätze (leer, wenn alles passt) */
function icePortalFaults(w: World): string[] {
  const home = w.homes.eis;
  const gate = w.gates.get('eis')!;
  const p = w.portals.get('eiskessel')!;
  const crossing = crossings(w)[0]!;
  const reach = new Set(reachable(w, [], home.wake[0]!, 200000).map(keyOf)); // vom Schneebett aus, Tor zu
  const wrong = [...icePlatformFaults(w, 'gate', reach), ...icePlatformFaults(w, 'home', reach)];
  if (keyOf(p.bed!) !== keyOf(home.bed)) wrong.push('erwacht nicht am Schneebett');
  // kein Warteplatz auf einer der Plattformen oder an ihren Zugängen (Durchgänge wie an den Toren)
  const area = new Set(platformArea(new Map([['eiskessel', p]])));
  for (const seat of crossing.seats.get('eis')!) if (area.has(keyOf(seat))) wrong.push(`Warteplatz ${keyOf(seat)}`);
  // ganz hinten am Talende: weit vom Schneebett, höchstens 20 Felder vor dem hintersten Boden des Tals
  const along = ([x, y]: readonly number[]) => (x! - home.bed[0]) * gate.out[0] + (y! - home.bed[1]) * gate.out[1];
  const end = Math.max(...[...w.spawns.values(), ...w.spotsOf('eis')].map(along));
  if (along(p.gate) < 100 || end - along(p.gate) > 20) wrong.push(`nicht am Talende (${along(p.gate)} von ${end})`);
  // im Kreis um das Schneebett, in Richtung des Tors; berührt weder Wiese, Iglu, Tröge noch Klangstein
  const [vx, vy] = [p.home[0] - home.bed[0], p.home[1] - home.bed[1]];
  if (Math.abs(Math.hypot(vx, vy) - home.portalRing) >= 1) wrong.push('nicht im Ring um das Schneebett');
  if (vx * -gate.out[0] + vy * -gate.out[1] <= 0.95 * Math.hypot(vx, vy)) wrong.push('nicht in Richtung des Tors');
  for (const f of [home.bed, home.food, home.water, home.shelterStem, w.stones.get('eis-offen')!])
    if (chebOf(p.home, f) <= 2) wrong.push(`an ${keyOf(f)}`);
  const { x0, y0, x1, y1 } = home.shelter;
  for (const { x, y } of platformCells(p.home))
    if (x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 2 && y <= y1 + 1) wrong.push(`Iglu ${x},${y}`);
  return wrong;
}

describe('Gletscherkessel hinter dem Eistor (Eis-Welt)', () => {
  const span = GATE_HALF + TOWER;
  /** Felder eines Torhauses und seines Gangs: Reihe für Reihe nach außen, bis eine ganz hinter dem Felsring liegt */
  function gangCells(mid: readonly [number, number], out: readonly [number, number]) {
    const along = [out[1], -out[0]] as const;
    const cells: [number, number][] = [];
    for (let t = 0; t < 200; t++) {
      const row = Array.from({ length: 2 * span + 1 }, (_, i): [number, number] => [
        mid[0] + along[0] * (i - span) + out[0] * t,
        mid[1] + along[1] * (i - span) + out[1] * t,
      ]);
      cells.push(...row);
      if (t > 0 && row.every(([x, y]) => beyondRing(x, y))) break;
    }
    return cells;
  }

  /** Abstände bis 12 Felder (rund): So weit bleibt das Tal samt Klippen von jedem fremden Gangausgang weg */
  const DISC_12 = Array.from({ length: 25 * 25 }, (_, i) => [(i % 25) - 12, Math.floor(i / 25) - 12] as const).filter(
    ([dx, dy]) => Math.hypot(dx, dy) < 12,
  );

  it('liegt ganz hinter dem Felsring, berührt weder die Lichtung noch einen anderen Gang oder ein Torhaus und bleibt 12 Felder von jedem fremden Gangausgang (500 Seeds)', () => {
    // Ein `expect` je Seed statt je Feld: sonst dauert der Lauf mit Abdeckung in der Pipeline zu lange
    const key = (x: number, y: number) => x * 4096 + y;
    for (let seed = 1; seed <= 500; seed++) {
      const { cells, bed } = kesselPlace(seed, EIS_PACK);
      const kessel = new Set(cells.map(([x, y]) => key(x, y)));
      expect(kessel.has(key(...bed)), `Seed ${seed}`).toBe(true);
      const wrong: string[] = cells.filter(([x, y]) => !beyondRing(x, y)).map(([x, y]) => `${x},${y} vor dem Felsring`);
      for (const g of gatePlaces(seed).values()) {
        // Den eigenen Gang berührt er an dessen Ende (dort geht es hinein), aber er liegt nicht darauf
        const near: readonly (readonly [number, number])[] = g.id === 'eis' ? [[0, 0]] : RING_1;
        const gang = gangCells(g.mid, g.out);
        for (const [x, y] of gang)
          if (near.some(([dx, dy]) => kessel.has(key(x + dx, y + dy)))) wrong.push(`Gang ${g.id} bei ${x},${y}`);
        if (g.id === 'eis') continue;
        // Ausgang eines fremden Gangs (seine letzte Reihe, schon ganz hinter dem Felsring): weniger als 12 Felder?
        for (const [x, y] of gang.slice(-(2 * span + 1)))
          if (DISC_12.some(([dx, dy]) => kessel.has(key(x + dx, y + dy)))) wrong.push(`Ausgang ${g.id} bei ${x},${y}`);
      }
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
  });

  /** Seeds der Tal-Tests: Eine Welt zu bauen kostet etwa 0,15 s, darum teilen sich die Tests dieselben 20 (`worldOf`) */
  const VALLEY_SEEDS = Array.from({ length: 20 }, (_, i) => 121 + i);
  // einmal vorab bauen, mit eigener Frist: In der Pipeline (mit Abdeckung) dauert das länger als ein einzelner Test darf
  beforeAll(() => VALLEY_SEEDS.forEach(worldOf), 120_000);

  it('Jedes begehbare Feld im Tal ist vom Schneebett aus erreichbar (20 Seeds)', () => {
    // über den Felsring und die Gangausgänge prüfen die 500 Seeds oben
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed);
      const { cells } = kesselPlace(seed, EIS_PACK);
      const inKessel = new Set(cells.map(([x, y]) => `${x},${y}`));
      // Suche nur über Felder des Kessels: der Boden hängt in sich zusammen, ohne Umweg über den Gang
      const start = w.homes.eis.wake[0]!;
      const seen = new Set([start.join(',')]);
      const queue: (readonly [number, number])[] = [start];
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i]!;
        for (const [dx, dy] of Object.values(DIRS)) {
          const k = `${x + dx},${y + dy}`;
          if (seen.has(k) || !inKessel.has(k) || !canStep(w, ['eis'], x, y, x + dx, y + dy)) continue;
          seen.add(k);
          queue.push([x + dx, y + dy]);
        }
      }
      const cut = cells.filter(
        ([x, y]) => w.cell(x, y).region === 'eis' && standHeight(w, [], x, y) !== null && !seen.has(`${x},${y}`),
      );
      expect(cut, `Seed ${seed}`).toEqual([]);
    }
  });

  /**
   * Eisblock im Kessel: Eis eine Stufe über dem Boden (Seen liegen auf Höhe 1, die Spur ist eben; die Stufen des
   * Eisbergs sind gefärbt)
   */
  const isBlock = (c: Cell) => c.ground === 'ice' && c.h >= 2 && !c.slide && !c.solid && !c.color;
  /** Stufe des Eisbergs */
  const isBerg = (c: Cell) => c.region === 'eis' && c.color === KESSEL_COLORS.berg;
  /**
   * Was an Tannen und Eisblöcken im Kessel falsch ist: zu nah an Bett, Spur, Kisten, Eisloch oder Plattformen; Tannen
   * nicht einzeln, Eisblöcke nicht über allen Nachbarn
   */
  function wildFaults(w: World, kessel: readonly (readonly [number, number])[]) {
    const bed = w.homes.eis.bed;
    const pick = (f: (c: Cell) => boolean) => kessel.filter(([x, y]) => f(w.cell(x, y)));
    const cheb = (a: readonly [number, number], b: readonly [number, number]) =>
      Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    const near = (list: readonly (readonly [number, number])[], p: readonly [number, number], r: number) =>
      list.some((q) => cheb(q, p) <= r);
    const slide = pick((c) => !!c.slide);
    const crates = pick((c) => c.deco === 'fishcrate');
    const water = pick((c) => c.ground === 'water');
    const portals = [...w.portals.values()].flatMap((p) => [p.gate, p.home]);
    const wrong: string[] = [];
    for (const p of pick((c) => c.tree === 'snowpine' || isBlock(c))) {
      const pine = w.cell(...p).tree === 'snowpine';
      const at = `${pine ? 'Tanne' : 'Eisblock'} ${p.join(',')}`;
      if (Math.hypot(p[0] - bed[0], p[1] - bed[1]) <= KESSEL.flat + 2) wrong.push(`am Bett ${at}`);
      if (near(slide, p, pine ? 2 : 1)) wrong.push(`an der Spur ${at}`);
      if (near(crates, p, 3)) wrong.push(`an einer Kiste ${at}`);
      if (near(water, p, 2)) wrong.push(`am Eisloch ${at}`);
      if (near(portals, p, PLATFORM_HALF + 1)) wrong.push(`an einer Plattform ${at}`);
      if (pine) {
        const around = RING_2.map(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy));
        if (around.some((n) => n.deco === 'tree' || n.region !== 'eis')) wrong.push(`nicht einzeln ${at}`);
      } else {
        const h = w.cell(...p).h;
        if (h > 3) wrong.push(`zu hoch ${at}`);
        const sides = Object.values(DIRS).map(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy));
        if (sides.some((n) => n.h < h - 1)) wrong.push(`kein Block ${at}`); // abgesenkt, nur noch eine Eisfläche
      }
    }
    return wrong;
  }
  /** Ring um ein Feld bis zwei Felder weit, ohne das Feld selbst */
  const RING_2 = [-2, -1, 0, 1, 2]
    .flatMap((dy) => [-2, -1, 0, 1, 2].map((dx) => [dx, dy] as const))
    .filter(([dx, dy]) => dx || dy);

  it('Winterlandschaft: Tannen, Eisblöcke und Hügel in drei Stufen; Bett, Spur, Kisten, Plattformen und Eislöcher bleiben frei (20 Seeds)', () => {
    let high = 0,
      ground = 0;
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed);
      const kessel = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const wrong = wildFaults(w, kessel);
      // jeder Kessel, nicht nur im Mittel: ein paar Tannen und Eisblöcke zum Klettern
      const count = (f: (c: Cell) => boolean) => kessel.filter(([x, y]) => f(w.cell(x, y))).length;
      const pines = count((c) => c.tree === 'snowpine');
      const blocks = count(isBlock);
      if (pines < KESSEL_WILDS.pines) wrong.push(`nur ${pines} Tannen`);
      if (blocks < KESSEL_WILDS.blocks) wrong.push(`nur ${blocks} Eisblöcke`);
      for (const [x, y] of kessel) {
        const h = standHeight(w, [], x, y);
        if (h === null) continue;
        ground++;
        if (h >= 2) high++;
        if (h > (isBerg(w.cell(x, y)) ? KESSEL.berg.top : 3)) wrong.push(`zu hoch ${x},${y}`); // Hügel bis 3
        const steps = Object.values(DIRS).map(([dx, dy]) => standHeight(w, [], x + dx, y + dy));
        if (steps.some((to) => to !== null && Math.abs(to - h) > 1)) wrong.push(`Stufe ${x},${y}`);
      }
      // Wohnplätze nie auf Tannen
      wrong.push(
        ...w
          .spotsOf('eis')
          .filter(([x, y]) => standHeight(w, [], x, y) === null)
          .map((p) => `Wohnplatz ${p.join(',')}`),
      );
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
    // gut 40 % des Bodens auf Höhe 2 oder 3
    expect(high / ground).toBeGreaterThan(0.38);
    expect(high / ground).toBeLessThan(0.52);
  });

  /** Was an Eiskristallen und Schneewehen im Kessel falsch ist */
  function frostFaults(w: World, kessel: readonly (readonly [number, number])[]) {
    const bed = w.homes.eis.bed;
    const pick = (f: (c: Cell) => boolean) => kessel.filter(([x, y]) => f(w.cell(x, y)));
    const near = (list: readonly (readonly [number, number])[], p: readonly [number, number], r: number) =>
      list.some((q) => chebOf(q, p) <= r);
    const slide = pick((c) => !!c.slide);
    const crates = pick((c) => c.deco === 'fishcrate');
    const water = pick((c) => c.ground === 'water');
    const portals = [...w.portals.values()].flatMap((p) => [p.gate, p.home]);
    const wrong: string[] = [];
    for (const p of pick((c) => c.deco === 'crystal')) {
      const c = w.cell(...p);
      const at = `Kristall ${p.join(',')}`;
      if (!c.solid || c.region !== 'eis' || c.biome !== 'eis') wrong.push(`nicht fest im Kessel ${at}`);
      if (!ICE_CRYSTALS.includes(c.color as (typeof ICE_CRYSTALS)[number])) wrong.push(`Farbe ${c.color} ${at}`);
      if (Math.hypot(p[0] - bed[0], p[1] - bed[1]) <= KESSEL.flat + 2) wrong.push(`am Bett ${at}`);
      if (near(slide, p, 2)) wrong.push(`an der Spur ${at}`);
      if (near(crates, p, 3) || near(water, p, 2)) wrong.push(`an Kiste oder Eisloch ${at}`);
      if (near(portals, p, PLATFORM_HALF + 2)) wrong.push(`am Plattform-Ring ${at}`);
      // nie an der Mündung: kein Feld des Gangs bis drei Felder weit
      const mouth = RING_3.some(([dx, dy]) => {
        const n = w.cell(p[0] + dx, p[1] + dy);
        return n.region !== 'eis' && n.region !== 'border';
      });
      if (mouth) wrong.push(`an der Mündung ${at}`);
      // mit Lücke: alle acht Nachbarn begehbar und gleich hoch, so geht man immer um ihn herum
      const ring = RING_1.filter(([dx, dy]) => dx || dy).map(([dx, dy]) => [p[0] + dx, p[1] + dy] as const);
      if (ring.some(([x, y]) => standHeight(w, ['eis'], x, y) !== c.h)) wrong.push(`ohne Lücke ${at}`);
    }
    for (const p of pick((c) => c.deco === 'cloudpuff')) {
      const at = `Schneewehe ${p.join(',')}`;
      if (standHeight(w, ['eis'], ...p) === null) wrong.push(`nicht begehbar ${at}`);
      if (w.cell(...p).ground !== 'snow' || w.cell(...p).slide) wrong.push(`nicht auf Schnee ${at}`);
      // im Lee einer Tanne: Der Pustewind weht nach rechts (+x)
      if (![1, 2].some((d) => w.cell(p[0] - d, p[1]).tree === 'snowpine')) wrong.push(`nicht im Lee ${at}`);
    }
    return wrong;
  }
  const RING_3 = [-3, -2, -1, 0, 1, 2, 3].flatMap((dy) => [-3, -2, -1, 0, 1, 2, 3].map((dx) => [dx, dy] as const));

  it('Eiskristalle in kleinen Gruppen an Klippenfuß und Kuppen, mit Lücke; Schneewehen im Lee der Tannen (20 Seeds)', () => {
    let special = 0,
      all = 0;
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed);
      const kessel = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const wrong = frostFaults(w, kessel);
      const crystals = kessel.filter(([x, y]) => w.cell(x, y).deco === 'crystal');
      const drifts = kessel.filter(([x, y]) => w.cell(x, y).deco === 'cloudpuff');
      if (crystals.length < FROST.least) wrong.push(`nur ${crystals.length} Kristalle`);
      if (crystals.length > FROST.groups * FROST.size + FROST.least) wrong.push(`${crystals.length} Kristalle`);
      if (!drifts.length) wrong.push('keine Schneewehe');
      // in Gruppen: jeder Kristall hat einen zweiten höchstens zwei Felder weit
      for (const p of crystals)
        if (!crystals.some((q) => q !== p && chebOf(p, q) <= 2)) wrong.push(`allein ${p.join(',')}`);
      for (const p of crystals) {
        all++;
        const cliff = RING_3.some(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy).region === 'border');
        if (cliff || w.cell(...p).h === 3) special++;
      }
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
    expect(special / all).toBeGreaterThan(0.6); // meist am Klippenfuß oder auf einer Kuppe
  });

  /** Was an den Schneehaufen im Tal falsch ist (sie werden zu Schneemännern, fest in jeder Stufe) */
  function heapFaults(w: World, kessel: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const heaps = kessel.filter(([x, y]) => w.cell(x, y).deco === 'snowheap');
    const wrong: string[] = [];
    // gut ein Dutzend; gemessen über 100 Seeds immer alle `HEAPS.count` (14), weniger als 10 wäre zu karg
    if (heaps.length < 10 || heaps.length > HEAPS.count) wrong.push(`${heaps.length} Schneehaufen`);
    for (const p of heaps) {
      const c = w.cell(...p);
      const at = `Schneehaufen ${p.join(',')}`;
      if (!c.solid || c.region !== 'eis' || c.ground !== 'snow') wrong.push(`nicht fest auf Schnee ${at}`);
      if (heaps.some((q) => q !== p && Math.hypot(q[0] - p[0], q[1] - p[1]) < HEAPS.spacing)) wrong.push(`dicht ${at}`);
      // ringsum zwei Felder frei: nichts Festes, kein Wasser, keine Spur, keine Plattform, keine Wiese
      for (const [dx, dy] of RING_2) {
        const n = w.cell(p[0] + dx, p[1] + dy);
        if (n.solid || n.ground === 'water' || n.slide || n.portal || n.garden) wrong.push(`eng ${at}`);
      }
      // alle acht Nachbarn gleich hoch und vom Schneebett aus erreichbar: Man läuft immer um ihn herum
      for (const [dx, dy] of RING_1.filter(([dx, dy]) => dx || dy)) {
        if (standHeight(w, [], p[0] + dx, p[1] + dy) !== c.h) wrong.push(`ohne Lücke ${at}`);
        if (!reach.has(keyOf([p[0] + dx, p[1] + dy]))) wrong.push(`nicht erreichbar ${at}`);
      }
    }
    return wrong;
  }

  it('Schneehaufen liegen einzeln und weit verstreut, ringsum frei und erreichbar; sie sperren nie etwas ab (20 Seeds)', () => {
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed);
      const kessel = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const reach = new Set(reachable(w, [], w.homes.eis.wake[0]!, 200000).map(keyOf));
      const wrong = heapFaults(w, kessel, reach);
      // ohne die Haufen wäre kein Feld mehr erreichbar: Jedes begehbare Feld des Tals ist es schon mit ihnen
      wrong.push(
        ...kessel
          .filter(([x, y]) => standHeight(w, [], x, y) !== null && !reach.has(`${x},${y}`))
          .map((p) => `abgesperrt ${p.join(',')}`),
      );
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
  });

  /** Eislöcher: zusammenhängende Wasserflächen im Tal (Nachbarn über Seiten) */
  function holesOf(w: World, floor: readonly (readonly [number, number])[]) {
    const water = new Set(floor.filter(([x, y]) => w.cell(x, y).ground === 'water').map(keyOf));
    const holes: (readonly [number, number])[][] = [];
    const seen = new Set<string>();
    for (const k of water) {
      if (seen.has(k)) continue;
      seen.add(k);
      const hole = [fromKey(k)];
      for (let i = 0; i < hole.length; i++)
        for (const [dx, dy] of Object.values(DIRS)) {
          const n = `${hole[i]![0] + dx},${hole[i]![1] + dy}`;
          if (!water.has(n) || seen.has(n)) continue;
          seen.add(n);
          hole.push(fromKey(n));
        }
      holes.push(hole);
    }
    return holes;
  }

  /**
   * Was an einem Eisloch falsch ist: zu klein, ohne weiße Scholle, Ufer (alles näher als `hole.r + shore` an der Mitte
   * des Lochs) nicht eben aus Eis oder nicht erreichbar
   */
  function holeFaults(w: World, hole: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const wrong: string[] = [];
    const at = hole[0]!.join(',');
    if (hole.length < 5) wrong.push(`Loch ${at} mit ${hole.length} Feldern`);
    const floes = hole.filter(([x, y]) => w.cell(x, y).deco === 'floe');
    if (!floes.length) wrong.push(`Loch ${at} ohne Scholle`);
    wrong.push(
      ...floes.filter(([x, y]) => w.cell(x, y).color !== KESSEL_COLORS.floe[1]).map((p) => `Scholle ${keyOf(p)}`),
    );
    const mx = hole.reduce((a, [x]) => a + x, 0) / hole.length;
    const my = hole.reduce((a, [, y]) => a + y, 0) / hole.length;
    const r = KESSEL.hole.r + KESSEL.hole.shore;
    const shore: (readonly [number, number])[] = [];
    for (let y = Math.floor(my - r); y <= Math.ceil(my + r); y++)
      for (let x = Math.floor(mx - r); x <= Math.ceil(mx + r); x++)
        if (Math.hypot(x - mx, y - my) < r && w.cell(x, y).ground !== 'water') shore.push([x, y]);
    if (shore.length < 16) wrong.push(`Loch ${at} mit ${shore.length} Feldern Ufer`);
    for (const [x, y] of shore)
      if (w.cell(x, y).ground !== 'ice' || standHeight(w, [], x, y) !== 1 || !reach.has(`${x},${y}`))
        wrong.push(`Ufer ${x},${y}`);
    return wrong;
  }

  /** Was an den Seen falsch ist: zu klein, nicht erreichbar, Spur, Kiste oder Plattform am Wasser, zu viel Eis */
  function lakeFaults(w: World, floor: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const wrong: string[] = [];
    const cell = ([x, y]: readonly [number, number]) => w.cell(x, y);
    const lake = floor.filter((p) => cell(p).ground === 'ice' && cell(p).h === 1 && !cell(p).slide);
    if (lake.length < 250) wrong.push(`nur ${lake.length} Felder Seen`);
    wrong.push(...lake.filter((p) => !reach.has(keyOf(p))).map((p) => `See ${keyOf(p)} nicht erreichbar`));
    // Spur, Kisten und Plattformen bleiben vom Wasser weg: Ihre Wege führen nie über ein Loch
    const marked = floor.filter((p) => cell(p).slide || cell(p).portal || cell(p).deco === 'fishcrate');
    for (const [x, y] of marked)
      if (RING_1.some(([dx, dy]) => w.cell(x + dx, y + dy).ground === 'water')) wrong.push(`am Wasser ${x},${y}`);
    const icy = floor.filter((p) => ['ice', 'water'].includes(cell(p).ground)).length;
    if (icy / floor.length > 0.15) wrong.push(`${((icy / floor.length) * 100).toFixed(1)} % Eis und Wasser`);
    return wrong;
  }

  it('Zugefrorene Seen mit je einem Eisloch: Schollen darauf, Ufer eben und erreichbar, Eis und Wasser höchstens 15 % des Bodens, kein Weg abgeschnitten (20 Seeds)', () => {
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed);
      const floor = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const reach = new Set(reachable(w, [], w.homes.eis.wake[0]!, 200000).map(keyOf));
      // je See ein Loch (Wasser, Höhe 0), darauf mindestens eine weiße Scholle; ringsum ebenes Ufer aus Eis, erreichbar
      const holes = holesOf(w, floor);
      const wrong = holes.flatMap((hole) => holeFaults(w, hole, reach));
      if (holes.length !== KESSEL.lakes.length) wrong.push(`${holes.length} Eislöcher`);
      // Seen: glattes Eis auf Höhe 1, begehbar und vom Schneebett erreichbar (ein See schneidet keinen Weg ab)
      wrong.push(...lakeFaults(w, floor, reach));
      // Wohnplätze nur auf erreichbarem Boden (keine Inseln)
      wrong.push(
        ...w
          .spotsOf('eis')
          .filter((p) => !reach.has(keyOf(p)))
          .map((p) => `Wohnplatz ${keyOf(p)}`),
      );
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
  });

  /**
   * Was an der Wand des Eisfalls falsch ist: eine Klippe höher als der Fall, kein Becken aus erreichbarem Eis davor, zu
   * wenig Seiten zur Kamera (sie blickt von Süden: Wo der Fall nach Süden über das Feld davor ragt, zeigt sie seine Seite)
   */
  function fallWallFaults(
    w: World,
    cells: readonly (readonly [number, number])[],
    fall: readonly (readonly [number, number])[],
  ) {
    const wrong: string[] = [];
    const isFall = (x: number, y: number) => !!w.cell(x, y).color && w.cell(x, y).region === 'border';
    for (const [x, y] of cells)
      if (w.cell(x, y).region === 'border' && w.cell(x, y).h > KESSEL.fall.h) wrong.push(`Klippe ${x},${y}`);
    const reach = new Set(reachable(w, [], w.homes.eis.wake[0]!, 200000).map(keyOf));
    const foot = fall
      .flatMap(([x, y]) => RING_1.map(([dx, dy]) => [x + dx, y + dy] as const))
      .filter(([x, y]) => w.cell(x, y).region === 'eis');
    if (foot.length < 10) wrong.push(`nur ${foot.length} Felder am Fuß`);
    for (const [x, y] of foot)
      if (w.cell(x, y).ground !== 'ice' || w.cell(x, y).h !== 1 || !reach.has(`${x},${y}`)) wrong.push(`Fuß ${x},${y}`);
    const faces = fall.filter(([x, y]) => !isFall(x, y + 1) && w.cell(x, y + 1).h < KESSEL.fall.h).length;
    if (faces < 6) wrong.push(`nur ${faces} Seiten zur Kamera`);
    return wrong;
  }

  it('Eisfall am Talende: glatte Wand aus gefrorenem Wasser in der Mitte des hinteren Endes, so hoch wie die höchsten Klippen, davor ein Becken aus Eis; von der Kamera (Süden) aus zu sehen, gleich wie das Tal läuft; in Sichtweite der Plattform des Eis-Portals (20 Seeds)', () => {
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed);
      const home = w.homes.eis;
      const { out } = w.gates.get('eis')!;
      const cells = kesselPlace(seed, EIS_PACK).cells;
      const along = ([x, y]: readonly number[]) => (x! - home.bed[0]) * out[0] + (y! - home.bed[1]) * out[1];
      const across = ([x, y]: readonly number[]) => (x! - home.bed[0]) * out[1] - (y! - home.bed[1]) * out[0];
      const fall = cells.filter(([x, y]) => w.cell(x, y).color && w.cell(x, y).region === 'border');
      const wrong: string[] = [];
      if (fall.length < 40) wrong.push(`nur ${fall.length} Felder Eisfall`);
      const end = Math.max(...w.spotsOf('eis').map(along)); // hinterster Wohnplatz im Tal
      for (const p of fall) {
        const c = w.cell(...p);
        if (c.color !== KESSEL_COLORS.fall || !c.solid || c.deco !== 'rock') wrong.push(`Eisfall ${keyOf(p)}`);
        if (c.h !== KESSEL.fall.h) wrong.push(`Eisfall ${keyOf(p)} mit Höhe ${c.h}`);
        if (along(p) < end - 5 || Math.abs(across(p)) > KESSEL.fall.half) wrong.push(`nicht am Talende ${keyOf(p)}`);
      }
      wrong.push(...fallWallFaults(w, cells, fall));
      // nur Klippen sind gefärbt (keine Bodenfelder außer Kristallen, Schollen und den Stufen des Eisbergs)
      for (const [x, y] of cells) {
        const c = w.cell(x, y);
        if (c.color && c.region !== 'border' && c.deco !== 'crystal' && c.deco !== 'floe' && !isBerg(c))
          wrong.push(`Farbe ${x},${y}`);
      }
      const gate = w.portals.get('eiskessel')!.gate;
      const near = Math.min(...fall.map((p) => Math.hypot(p[0] - gate[0], p[1] - gate[1])));
      if (near > 20) wrong.push(`Plattform ${near.toFixed(1)} Felder vom Eisfall`);
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
  });

  /** Fehler in der Höhe des Tals: absolute Höhe über 5 oder mehr als eine Stufe zwischen Nachbarn */
  function heightFaults(w: World, floor: readonly (readonly [number, number])[]) {
    const wrong: string[] = [];
    for (const [x, y] of floor) {
      const h = standHeight(w, [], x, y);
      if (h === null) continue;
      if (h > KESSEL.berg.top) wrong.push(`zu hoch ${x},${y}`);
      for (const [dx, dy] of Object.values(DIRS)) {
        const to = standHeight(w, [], x + dx, y + dy);
        if (to !== null && Math.abs(to - h) > 1) wrong.push(`Stufe ${x},${y} → ${x + dx},${y + dy}`);
      }
    }
    return wrong;
  }

  /**
   * Was an den Stufen des Eisbergs falsch ist: zu wenige, nicht aus begehbarem Eis auf Höhe 2 bis 5, nicht erreichbar,
   * eine Höhe fehlt, Tanne, Kristall, Eisblock oder Wasser bis zwei Felder daneben
   */
  function stepFaults(w: World, berg: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const wrong: string[] = [];
    if (berg.length < 60) wrong.push(`nur ${berg.length} Felder Eisberg`);
    for (const p of berg) {
      const c = w.cell(...p);
      if (c.ground !== 'ice' || c.solid || c.h < 2 || c.h > KESSEL.berg.top) wrong.push(`Stufe ${keyOf(p)} (${c.h})`);
      if (!reach.has(keyOf(p))) wrong.push(`Stufe ${keyOf(p)} nicht erreichbar`);
      for (const [dx, dy] of RING_2) {
        const n = w.cell(p[0] + dx, p[1] + dy);
        if (n.deco === 'tree' || n.deco === 'crystal' || isBlock(n) || n.ground === 'water')
          wrong.push(`${n.deco ?? n.ground} am Eisberg`);
      }
    }
    // jede Höhe von 2 bis 5 kommt vor: Stufe für Stufe hinauf
    for (let h = 2; h <= KESSEL.berg.top; h++) if (!berg.some((p) => w.cell(...p).h === h)) wrong.push(`keine ${h}`);
    return wrong;
  }

  /**
   * Was am Eisberg falsch ist: Stufen nicht aus begehbarem Eis, nicht erreichbar, eine Höhe fehlt, Gipfel nicht auf 5,
   * fern vom See oder vom Hauptweg (der Achse vom Schneebett zum Eis-Portal), kein Steg, etwas wächst darauf
   */
  function bergFaults(w: World, floor: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const bed = w.homes.eis.bed;
    const gate = w.portals.get('eiskessel')!.gate;
    const out = [Math.sign(gate[0] - bed[0]), Math.sign(gate[1] - bed[1])] as const;
    /** Abstand quer zur Achse des Tals */
    const across = ([x, y]: readonly number[]) => Math.abs(out[0] ? y! - bed[1] : x! - bed[0]);
    const berg = floor.filter(([x, y]) => isBerg(w.cell(x, y)));
    const wrong = stepFaults(w, berg, reach);
    // Gipfel auf Höhe 5, dort steht die Fahne
    const peak = bergPeak(w);
    if (!peak || w.cell(...peak).h !== KESSEL.berg.top || !isBerg(w.cell(...peak))) return [...wrong, 'kein Gipfel'];
    if (!reach.has(keyOf(peak))) wrong.push('Gipfel nicht erreichbar');
    // am See: offenes Wasser seines Eislochs nah
    const water = floor.filter(([x, y]) => w.cell(x, y).ground === 'water');
    const d = Math.min(...water.map((p) => Math.hypot(p[0] - peak[0], p[1] - peak[1])));
    if (d < 8 || d > 16) wrong.push(`Eisloch ${d.toFixed(1)} Felder vom Gipfel`);
    // in Sichtweite des Hauptwegs (3D zeigt etwa 40 Felder weit)
    if (across(peak) > 40) wrong.push(`Gipfel ${across(peak)} Felder neben der Achse`);
    // Steg: in der Reihe des Gipfels durchgehend glattes Eis auf Höhe 1, von `steg` Feldern neben der Achse bis an die
    // unterste Stufe (dazwischen das Eis ringsum)
    const { steg, plateau, top, step } = KESSEL.berg;
    const side = Math.sign(out[0] ? peak[1] - bed[1] : peak[0] - bed[0]);
    const foot = across(peak) - Math.ceil(plateau + (top - 2) * step); // letztes Feld vor der untersten Stufe
    for (let a = steg; a <= foot; a++) {
      const p: [number, number] = out[0] ? [peak[0], bed[1] + side * a] : [bed[0] + side * a, peak[1]];
      const c = w.cell(...p);
      if (c.region !== 'eis' || c.ground !== 'ice' || c.h !== 1 || c.solid) wrong.push(`Steg unterbrochen bei ${a}`);
    }
    return wrong;
  }

  it('Eisberg am See: Stufe für Stufe bis Höhe 5 erreichbar, nie mehr als eine Stufe, Fahne auf dem Gipfel, Steg zur Mitte des Tals, in Sichtweite des Hauptwegs; Seeufer und Eislöcher bleiben erreichbar (20 Seeds)', () => {
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed);
      const floor = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const reach = new Set(reachable(w, [], w.homes.eis.wake[0]!, 200000).map(keyOf));
      const wrong = [...heightFaults(w, floor), ...bergFaults(w, floor, reach)];
      // Seeufer und Eislöcher bleiben erreichbar (auch der See am Eisberg)
      wrong.push(...holesOf(w, floor).flatMap((hole) => holeFaults(w, hole, reach)), ...lakeFaults(w, floor, reach));
      expect([...new Set(wrong)], `Seed ${seed}`).toEqual([]);
    }
  });

  it('Eis-Portal: Plattform am Talende und im Ring um das Schneebett: 3 × 3, erreichbar, ringsum frei (24 Seeds)', () => {
    for (const seed of [1, 42, 2026, 7, ...VALLEY_SEEDS])
      expect(icePortalFaults(worldOf(seed)), `Seed ${seed}`).toEqual([]);
  });

  it('Gletschertal: Dichte 4 bis 6 Dinge je 100 Felder; Wege wie auf der Lichtung: Tor → Schneebett kurz, das fernste Feld weit (20 Seeds)', () => {
    let things = 0,
      walk = 0;
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed);
      const floor = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const open = floor.filter(([x, y]) => standHeight(w, ['eis'], x, y) !== null);
      // Dinge: Tannen, Eisblöcke, Kristalle, Schneewehen, Fischkisten (nicht Bett, Wiese und Plattformen)
      const n = floor.filter(([x, y]) => {
        const c = w.cell(x, y);
        return (!!c.deco && !c.garden && !c.portal) || isBlock(c);
      }).length;
      expect(n / open.length, `Seed ${seed}`).toBeGreaterThan(0.035);
      expect(n / open.length, `Seed ${seed}`).toBeLessThan(0.07);
      things += n;
      walk += open.length;
      // Laufwege (Schritte, Tor offen): vom ersten Feld hinter dem Tor zum Schneebett und vom Bett zum fernsten Feld
      const gate = w.gates.get('eis')!;
      const from = (start: readonly [number, number]) => {
        const dist = new Map([[keyOf(start), 0]]);
        const queue = [start];
        for (let i = 0; i < queue.length; i++) {
          const [x, y] = queue[i]!;
          for (const [dx, dy] of Object.values(DIRS)) {
            const k = `${x + dx},${y + dy}`;
            if (dist.has(k) || !canStep(w, ['eis'], x, y, x + dx, y + dy) || w.realm(x + dx, y + dy) !== 'eis')
              continue;
            dist.set(k, dist.get(keyOf([x, y]))! + 1);
            queue.push([x + dx, y + dy]);
          }
        }
        return dist;
      };
      const bed = from(w.homes.eis.wake[0]!);
      let t = 1;
      while (w.realm(gate.mid[0] + gate.out[0] * t, gate.mid[1] + gate.out[1] * t) !== 'eis') t++;
      const toBed = t + bed.get(keyOf([gate.mid[0] + gate.out[0] * t, gate.mid[1] + gate.out[1] * t]))!;
      // gemessen: im Tal selbst (ab dem ersten Feld hinter dem Gang) 40 bis 52 Schritte, mit dem Gang 52 bis 74
      expect(toBed - t, `Seed ${seed}: Mündung → Schneebett (Schritte)`).toBeGreaterThanOrEqual(38);
      expect(toBed - t, `Seed ${seed}: Mündung → Schneebett (Schritte)`).toBeLessThanOrEqual(56);
      expect(toBed, `Seed ${seed}: Tor → Schneebett`).toBeLessThanOrEqual(78);
      const far = Math.max(...bed.values());
      // gemessen 138 bis 141 (Lichtung 111 bis 124)
      expect(far, `Seed ${seed}: fernstes Feld`).toBeGreaterThanOrEqual(130);
      expect(far, `Seed ${seed}: fernstes Feld`).toBeLessThanOrEqual(150);
      // das Schneebett liegt nah an der Mündung: etwa 30 Felder hinter dem ersten Feld des Tals
      const mouth = Math.max(
        ...[...crossings(w)[0]!.entries]
          .filter(([, r]) => r === 'eis')
          .map(([k]) => {
            const [x, y] = k.split(',').map(Number) as [number, number];
            return chebOf([x, y], w.homes.eis.bed);
          }),
      );
      expect(mouth, `Seed ${seed}: Mündung → Schneebett`).toBeGreaterThanOrEqual(25);
      expect(mouth, `Seed ${seed}: Mündung → Schneebett`).toBeLessThanOrEqual(36);
    }
    expect(things / walk).toBeGreaterThan(0.04);
    expect(things / walk).toBeLessThan(0.06);
  });

  for (const seed of [1, 42, 2026, 7]) {
    const w = worldOf(seed);
    const home = w.homes.eis;
    const gate = w.gates.get('eis')!;
    const LIMIT = 200000;
    const fromLichtung = (open: GateId[]) => reachable(w, open, START, LIMIT);
    const fromSnowBed = (open: GateId[]) => reachable(w, open, home.wake[0]!, LIMIT);
    /** Felder des Kessels (Klippen, Boden, Mündung) */
    const kessel = kesselPlace(seed, EIS_PACK).cells;
    const floor = kessel.filter(([x, y]) => w.cell(x, y).region === 'eis' && standHeight(w, [], x, y) !== null);

    it(`Seed ${seed}: Bei geschlossenem Tor kommt man weder hinein noch heraus, bei offenem ist jedes Kesselfeld erreichbar`, () => {
      const closed = fromLichtung([]);
      expect(closed.some(([x, y]) => w.realm(x, y) === 'eis')).toBe(false);
      const inside = fromSnowBed([]);
      expect(inside.length).toBeLessThan(LIMIT); // die Landschaft draußen bleibt draußen
      expect(inside.some(([x, y]) => w.cell(x, y).region === 'lichtung')).toBe(false);
      const open = new Set(fromLichtung(['eis']).map(([x, y]) => `${x},${y}`));
      expect(open.size).toBeLessThan(LIMIT); // auch mit offenem Tor nur Lichtung und Kessel, keine Landschaft
      for (const [x, y] of floor) expect(open.has(`${x},${y}`), `${x},${y}`).toBe(true);
      expect(floor.length).toBeGreaterThan(10000); // etwa 88 × 160 Felder
    });

    it(`Seed ${seed}: Im Kessel ist keine Stufe höher als eins; ringsum feste Eisklippen`, () => {
      for (const [x, y] of fromSnowBed([]))
        for (const [dx, dy] of Object.values(DIRS)) {
          const a = standHeight(w, [], x, y)!,
            b = standHeight(w, [], x + dx, y + dy);
          if (b !== null) expect(Math.abs(b - a), `${x},${y} → ${x + dx},${y + dy}`).toBeLessThanOrEqual(1);
        }
      const cliffs = kessel.filter(([x, y]) => w.cell(x, y).region === 'border');
      expect(cliffs.length).toBeGreaterThan(500);
      for (const [x, y] of cliffs) {
        expect([w.cell(x, y).biome, w.cell(x, y).deco, standHeight(w, ['eis'], x, y)]).toEqual(['eis', 'rock', null]);
        expect(w.cell(x, y).h).toBeGreaterThanOrEqual(3);
      }
    });

    it(`Seed ${seed}: Schneebett ringsum frei, Schneewiese eben mit Eisschale, Wassertrog und Iglu`, () => {
      const bed = w.cell(...home.bed);
      expect([bed.deco, bed.biome, bed.solid]).toEqual(['bed', 'eis', true]);
      for (let dy = -home.clear; dy <= home.clear; dy++)
        for (let dx = -home.clear; dx <= home.clear; dx++)
          if (dx || dy) expect(standHeight(w, [], home.bed[0] + dx, home.bed[1] + dy), `${dx},${dy}`).toBe(1);
      for (let dy = -home.meadow; dy <= home.meadow; dy++)
        for (let dx = -home.meadow; dx <= home.meadow; dx++) {
          const [x, y] = [home.bed[0] + dx, home.bed[1] + dy];
          if (Math.hypot(dx, dy) > home.meadow || (dx === 0 && dy === 0)) continue;
          expect(w.cell(x, y).garden, `${dx},${dy}`).toBe(true);
          expect(w.cell(x, y).h).toBe(1);
        }
      expect([w.cell(...home.food).deco, w.cell(...home.food).solid]).toEqual(['icebowl', true]);
      expect([w.cell(...home.water).deco, w.cell(...home.water).biome]).toEqual(['watertrough', 'eis']);
      const { x0, y0, x1, y1 } = home.shelter;
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          expect(w.cell(x, y).roof, `Iglu ${x},${y}`).toBe(true);
          expect(standHeight(w, [], x, y)).toBe(1);
        }
        expect([w.cell(x, y0 - 1).deco, w.cell(x, y0 - 1).solid], 'feste Rückwand').toEqual(['igloo', true]);
      }
      expect(home.shelterStem).toEqual([(x0 + x1) / 2, y0 - 1]);
    });

    it(`Seed ${seed}: Eislöcher mit Wasser und erreichbarem Ufer`, () => {
      const water = kessel.filter(([x, y]) => w.cell(x, y).ground === 'water');
      expect(water.length).toBeGreaterThanOrEqual(5 * KESSEL.lakes.length);
      const reach = new Set(fromSnowBed([]).map(([x, y]) => `${x},${y}`));
      for (const [x, y] of water) expect(w.realm(x, y)).toBe('eis');
      expect(
        water.some(([x, y]) => Object.values(DIRS).some(([dx, dy]) => reach.has(`${x + dx},${y + dy}`))),
        'Ufer',
      ).toBe(true);
    });

    it(`Seed ${seed}: sechs Fischkisten, drei 8 bis 14 Felder von der Schneewiese, drei weit hinten im Tal; einzeln, ringsum frei und erreichbar`, () => {
      const crates = kessel.filter(([x, y]) => w.cell(x, y).deco === 'fishcrate');
      expect(crates).toHaveLength(6);
      const meadow = kessel.filter(([x, y]) => w.cell(x, y).garden);
      const reach = new Set(fromSnowBed([]).map(([x, y]) => `${x},${y}`));
      const fromMeadow = ([x, y]: readonly [number, number]) =>
        Math.min(...meadow.map(([mx, my]) => Math.hypot(x - mx, y - my)));
      const near = crates.filter((p) => fromMeadow(p) <= 14);
      expect(near).toHaveLength(3);
      for (const p of near) expect(fromMeadow(p), p.join()).toBeGreaterThanOrEqual(8);
      for (const p of crates) if (!near.includes(p)) expect(fromMeadow(p), p.join()).toBeGreaterThan(40);
      for (const [x, y] of crates) {
        const c = w.cell(x, y);
        expect([c.solid, c.region, c.biome, standHeight(w, ['eis'], x, y)]).toEqual([true, 'eis', 'eis', null]);
        // ringsum frei: alle acht Nachbarn begehbar und vom Schneebett aus erreichbar, man kommt von jeder Seite heran
        for (const [dx, dy] of RING_1)
          if (dx || dy) expect(reach.has(`${x + dx},${y + dy}`), `${x + dx},${y + dy}`).toBe(true);
      }
      // weit auseinander: Das Kind läuft zu jeder einen kleinen Weg
      for (const a of crates)
        for (const b of crates) if (a !== b) expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(12);
      // eine nahe dem Eisloch
      const water = kessel.filter(([x, y]) => w.cell(x, y).ground === 'water');
      expect(crates.some(([x, y]) => water.some(([wx, wy]) => Math.hypot(x - wx, y - wy) < 8))).toBe(true);
    });

    it(`Seed ${seed}: Moosfleck im Kessel (grünes Moos unter dem Schnee, begehbar, nur Kulisse)`, () => {
      const moss = kessel.filter(([x, y]) => w.cell(x, y).ground === 'grass');
      expect(moss.length).toBeGreaterThanOrEqual(5);
      const reach = new Set(fromSnowBed([]).map(([x, y]) => `${x},${y}`));
      for (const [x, y] of moss) {
        expect([w.cell(x, y).region, w.cell(x, y).garden], `${x},${y}`).toEqual(['eis', undefined]);
        expect(reach.has(`${x},${y}`), `${x},${y}`).toBe(true);
      }
    });

    it(`Seed ${seed}: Klangstein am Schneebett, außerhalb des freien Platzes, im Kessel erreichbar`, () => {
      const [sx, sy] = w.stones.get('eis-offen')!;
      expect([sx - home.bed[0], sy - home.bed[1]]).toEqual([...ICE_STONE]);
      expect(Math.max(Math.abs(ICE_STONE[0]), Math.abs(ICE_STONE[1]))).toBeGreaterThan(home.clear);
      const c = w.cell(sx, sy);
      expect([c.deco, c.story, c.solid, w.realm(sx, sy)]).toEqual(['klangstein', 'eis-offen', true, 'eis']);
      const reach = new Set(fromSnowBed([]).map(([x, y]) => `${x},${y}`));
      expect(Object.values(DIRS).some(([dx, dy]) => reach.has(`${sx + dx},${sy + dy}`))).toBe(true);
    });

    it(`Seed ${seed}: Rutschspur vom Tor bis ans Schneebett nah an der Mündung, durchgehend begehbar`, () => {
      const start: [number, number] = [gate.mid[0] + gate.out[0], gate.mid[1] + gate.out[1]];
      expect(w.cell(...start).slide).toBe(true);
      // nur über Felder der Spur: vom ersten Feld hinter dem Tor bis neben das Bett
      const seen = new Set([start.join(',')]);
      const queue = [start];
      while (queue.length) {
        const [x, y] = queue.shift()!;
        for (const [dx, dy] of Object.values(DIRS)) {
          const k = `${x + dx},${y + dy}`;
          if (seen.has(k) || !w.cell(x + dx, y + dy).slide || !canStep(w, ['eis'], x, y, x + dx, y + dy)) continue;
          seen.add(k);
          queue.push([x + dx, y + dy]);
        }
      }
      const besideBed = Object.values(DIRS).map(([dx, dy]) => `${home.bed[0] + dx},${home.bed[1] + dy}`);
      expect(besideBed.some((k) => seen.has(k))).toBe(true);
      expect(seen.size).toBeGreaterThan(20);
    });

    it(`Seed ${seed}: Die Gegend wechselt genau in der Mitte des Gangs zur Eis-Welt`, () => {
      const at = (t: number) => [gate.mid[0] + gate.out[0] * t, gate.mid[1] + gate.out[1] * t] as const;
      let n = 1;
      while (w.cell(...at(n)).region !== 'eis') n++; // Gang: vom Tor bis zum Boden des Kessels
      const gang = Array.from({ length: n - 1 }, (_, i) => w.realm(...at(i + 1)));
      const first = gang.indexOf('eis');
      expect(first).toBe(Math.floor(gang.length / 2));
      expect(gang.slice(first).every((r) => r === 'eis')).toBe(true);
      for (const p of gate.cells) expect(w.realm(...p)).toBe('lichtung');
      for (const [x, y] of kessel) expect(w.realm(x, y)).toBe('eis');
      expect(w.climate(...home.bed)).toEqual({ id: 'eis', strength: 1 }); // kühles Licht im Kessel
    });

    it(`Seed ${seed}: 50 Eis-Tiere wohnen erreichbar im Tal, fünf je Art, keins auf der Lichtung, der Schneewiese oder einer Plattform`, () => {
      const ice = [...w.spawns].filter(([id]) => id.startsWith('eis:'));
      expect(ice).toHaveLength(50);
      const spots = new Set(w.spotsOf('eis').map(([x, y]) => `${x},${y}`));
      const reach = new Set(fromSnowBed([]).map(([x, y]) => `${x},${y}`));
      const perSpecies = new Map<string, number>();
      for (const [id, [x, y]] of ice) {
        const species = id.split(':')[1]!;
        perSpecies.set(species, (perSpecies.get(species) ?? 0) + 1);
        const c = w.cell(x, y);
        expect([w.realm(x, y), c.region, c.garden, c.portal], id).toEqual(['eis', 'eis', undefined, undefined]);
        expect(spots.has(`${x},${y}`) && reach.has(`${x},${y}`), id).toBe(true);
        expect(Math.max(Math.abs(x - home.bed[0]), Math.abs(y - home.bed[1])), id).toBeGreaterThanOrEqual(6);
      }
      expect([...perSpecies.values()]).toEqual(Array(10).fill(5));
      expect(new Set(ice.map(([, [x, y]]) => `${x},${y}`)).size).toBe(50); // jedes auf eigenem Platz
      // nicht in der Mündung: zwei Felder Abstand zum Gang (begehbar, aber nicht Boden des Kessels)
      const gangNear = ([x, y]: readonly [number, number]) =>
        [-2, -1, 0, 1, 2].some((dy) =>
          [-2, -1, 0, 1, 2].some((dx) => {
            const c = w.cell(x + dx, y + dy);
            return c.region !== 'eis' && standHeight(w, ['eis'], x + dx, y + dy) !== null;
          }),
        );
      for (const [id, p] of ice) expect(gangNear(p), id).toBe(false);
    });

    it(`Seed ${seed}: Jede Eis-Art hat ihren Lieblingsort (Wohnort des ersten Tiers): näher an ihrem Thema als ein zufälliger Platz im Tal`, () => {
      const spots = w.spotsOf('eis');
      for (const { species, near } of ICE_ANIMALS) {
        const theme = kessel.filter(([x, y]) => HAUNTS[near](w.cell(x, y)));
        expect(theme.length, `${species}: ${near}`).toBeGreaterThan(0);
        const dist = ([x, y]: readonly [number, number]) =>
          Math.min(...theme.map(([tx, ty]) => Math.hypot(x - tx, y - ty)));
        const chance = spots.reduce((sum, p) => sum + dist(p), 0) / spots.length; // ein zufälliger Platz im Mittel
        const first = w.spawns.get(`eis:${species}`)!;
        expect(dist(first), species).toBeLessThan(Math.min(4, chance / 2)); // gleich daneben
      }
      // Robbe, Walross und Papageitaucher an drei verschiedenen Seen: ihr nächstes Eisloch liegt je woanders
      const water = kessel.filter(([x, y]) => HAUNTS.lake(w.cell(x, y)));
      const hole = (species: string) => {
        const [x, y] = w.spawns.get(`eis:${species}`)!;
        return water.reduce((b, p) => (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? p : b));
      };
      const holes = ['robbe', 'walross', 'papageitaucher'].map(hole);
      for (const [i, a] of holes.entries())
        for (const b of holes.slice(i + 1)) expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(15);
      // der Papageitaucher am kleinen See gleich hinter dem Bett, Robbe und Walross an den großen weiter hinten
      const bedTo = ([x, y]: readonly [number, number]) => Math.hypot(x - home.bed[0], y - home.bed[1]);
      expect(bedTo(hole('papageitaucher'))).toBeLessThan(15);
      expect(Math.min(bedTo(hole('robbe')), bedTo(hole('walross')))).toBeGreaterThan(30);
      // über das Tal verteilt: vom Iglu am Bett bis an den Eisfall am Talende
      const fromBed = ICE_ANIMALS.map(({ species }) => {
        const [x, y] = w.spawns.get(`eis:${species}`)!;
        return Math.hypot(x - home.bed[0], y - home.bed[1]);
      });
      expect(Math.min(...fromBed)).toBeLessThan(12);
      expect(Math.max(...fromBed)).toBeGreaterThan(80);
    });

    it(`Seed ${seed}: Weltgrenze: erstes Feld je Seite; Warteplätze erreichbar, außerhalb der Durchgänge, nicht im Gang`, () => {
      const all = crossings(w);
      expect(all.map((c) => [c.gate.id, ...c.realms])).toEqual([['eis', 'lichtung', 'eis']]);
      const c = all[0]!;
      const key = ([x, y]: readonly [number, number]) => `${x},${y}`;
      // Durchgang: Torreihe, Gang und Mündung, bei offenem Tor begehbar, bis vor den Boden des Kessels
      expect(gate.cells.every((p) => c.cells.has(key(p)))).toBe(true);
      for (const k of c.cells) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        expect([standHeight(w, ['eis'], x, y) !== null, w.cell(x, y).region !== 'eis'], k).toEqual([true, true]);
      }
      // Erstes Feld: von der Lichtung aus die Torreihe, vom Kessel aus die Gangmündung (daneben Boden des Kessels)
      const firsts = (side: string) => [...c.entries].filter(([, r]) => r === side).map(([k]) => k);
      expect(firsts('lichtung').sort()).toEqual(gate.cells.map(key).sort());
      expect(firsts('eis').length).toBeGreaterThan(0);
      for (const k of firsts('eis')) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        const floorNear = Object.values(DIRS).some(([dx, dy]) => w.cell(x + dx, y + dy).region === 'eis');
        expect(floorNear, k).toBe(true);
      }
      // Warteplätze: je Seite SEATS Stück auf eigenen Feldern, der nächste zuerst
      const passages = new Set([
        ...platformArea(w.portals),
        ...withNeighbours([...w.gates.values()].flatMap((g) => g.cells)),
        ...withNeighbours([...c.cells].map((k) => k.split(',').map(Number) as [number, number])),
      ]);
      const open = new Set(fromLichtung(['eis']).map(key));
      const across = ([x, y]: readonly [number, number]) =>
        Math.abs((x - gate.mid[0]) * gate.out[1] - (y - gate.mid[1]) * gate.out[0]);
      for (const side of ['lichtung', 'eis'] as const) {
        const seats = c.seats.get(side)!;
        expect(seats).toHaveLength(SEATS);
        expect(new Set(seats.map(key)).size).toBe(SEATS);
        const near = firsts(side).map((k) => k.split(',').map(Number) as [number, number]);
        const dist = ([x, y]: readonly [number, number]) =>
          Math.min(...near.map(([fx, fy]) => Math.max(Math.abs(x - fx), Math.abs(y - fy))));
        expect(seats.map(dist)).toEqual(seats.map(dist).sort((a, b) => a - b)); // nebeneinander, der nächste zuerst
        for (const p of seats) {
          const stone = RING_1.some(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy).story);
          expect(
            [
              w.realm(...p),
              open.has(key(p)),
              passages.has(key(p)),
              w.cell(p[0], p[1]).garden,
              stone,
              across(p) > GATE_HALF,
            ],
            `${side} ${key(p)}`,
          ).toEqual([side, true, false, undefined, false, true]);
          expect(dist(p)).toBeLessThanOrEqual(12);
        }
      }
    });

    it(`Seed ${seed}: Im Kessel und in der Eiswelt draußen wohnen keine Tiere der Landschaft`, () => {
      const chunks = new Set(kessel.map(([x, y]) => `${Math.floor(x / 16)},${Math.floor(y / 16)}`));
      for (const k of chunks) {
        const [cx, cy] = k.split(',').map(Number) as [number, number];
        for (const a of wildAnimals(w, cx, cy)) {
          expect(w.realm(a.x, a.y)).toBe('lichtung');
          expect(w.cell(a.x, a.y).biome).not.toBe('eis');
        }
      }
    });
  }
});

describe('Stimmung der Richtungen', () => {
  for (const seed of [4, 77]) {
    const w = worldOf(seed);
    const { rx, ry } = lichtung.shape;
    // Felder der Lichtung, gruppiert nach der Welt, in deren Richtung sie liegen (nur starke Stimmung)
    const strong = new Map<string, Cell[]>();
    for (let y = -ry; y <= ry; y += 1)
      for (let x = -rx; x <= rx; x += 1) {
        const c = w.cell(x, y);
        const cl = w.climate(x, y);
        if (c.region !== 'lichtung' || cl.strength < 0.7) continue;
        strong.set(cl.id, [...(strong.get(cl.id) ?? []), c]);
      }
    const share = (cells: Cell[], ok: (c: Cell) => boolean, of: (c: Cell) => boolean = () => true) =>
      cells.filter((c) => of(c) && ok(c)).length / Math.max(1, cells.filter(of).length);

    it(`Seed ${seed}: am Bett ist es neutral`, () => {
      for (let y = -12; y <= 12; y++)
        for (let x = -12; x <= 12; x++) {
          expect(w.climate(x, y).strength, `${x},${y}`).toBe(0);
          expect(w.cell(x, y).tint).toBeUndefined();
        }
    });

    it(`Seed ${seed}: nah am Rand eine Ahnung der Welt: vereinzelt Schnee, Herbst- und Blütenbäume, Moos`, () => {
      const isTree = (c: Cell) => c.deco === 'tree';
      const snow = share(strong.get('eis')!, (c) => c.ground === 'snow');
      expect(snow).toBeGreaterThan(0.01);
      expect(snow).toBeLessThan(0.2); // nur Flecken, keine Schneelandschaft
      // Baumarten nur prüfen, wo am Rand genug Bäume stehen
      const trees = (id: string) => strong.get(id)!.filter(isTree).length;
      if (trees('wald') >= 8)
        expect(share(strong.get('wald')!, (c) => c.tree === 'autumn' || c.tree === 'red', isTree)).toBeGreaterThan(
          0.15,
        );
      if (trees('wasser') >= 8)
        expect(share(strong.get('wasser')!, (c) => c.tree === 'blossom', isTree)).toBeGreaterThan(0.15);
      const moss = share(strong.get('pilze')!, (c) => c.ground === 'moss');
      expect(moss).toBeGreaterThan(0.005);
      expect(moss).toBeLessThan(0.2);
      expect(share(strong.get('sand')!, (c) => !!c.tint)).toBeGreaterThan(0.5);
    });
  }
});

describe('Landschaft', () => {
  it('ist meist sanft: Nachbarfelder unterscheiden sich selten um mehr als eine Ebene', () => {
    const w = worldOf(11);
    let steep = 0,
      total = 0;
    for (let y = 130; y < 190; y++)
      for (let x = -40; x < 40; x++) {
        const a = w.cell(x, y),
          b = w.cell(x + 1, y);
        if (a.ground !== 'grass' || b.ground !== 'grass') continue; // Wasser und Klettersteine zählen nicht
        total++;
        if (Math.abs(a.h - b.h) > 1) steep++;
      }
    expect(steep / total).toBeLessThan(0.02);
  });

  it('hat Tiere, immer dieselben an derselben Stelle, auf Feldern der Landschaft', () => {
    const w = createWorld(8, PACKS),
      again = createWorld(8, PACKS);
    const all = [];
    for (let cy = 8; cy < 14; cy++)
      // weit draußen, hinter dem Felsring
      for (let cx = -3; cx < 3; cx++) {
        const spawns = wildAnimals(w, cx, cy);
        expect(spawns).toEqual(wildAnimals(again, cx, cy));
        for (const s of spawns) {
          expect(w.cell(s.x, s.y).region).toBe('wild');
          expect(standHeight(w, [], s.x, s.y)).not.toBeNull();
        }
        all.push(...spawns);
      }
    expect(all.length).toBeGreaterThan(5);
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
  });
});

describe('Portal-Plattformen', () => {
  /** Die 16 Felder im Abstand 2 um eine Mitte */
  const RING = Array.from({ length: 25 }, (_, i) => [(i % 5) - 2, Math.floor(i / 5) - 2] as const).filter(
    ([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy)) === 2,
  );
  const cheb = (a: readonly number[], b: readonly number[]) =>
    Math.max(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!));
  for (const seed of SEEDS) {
    it(`Seed ${seed}: 3 × 3 Felder am Tor und am Bett, von allen vier Seiten erreichbar, ringsum frei`, () => {
      const w = worldOf(seed);
      const reach = new Set(reachable(w, [], START, 200000).map(([x, y]) => `${x},${y}`));
      for (const g of GATES) {
        const p = w.portals.get(g.id)!;
        for (const [centre, side] of [
          [p.gate, 'gate'],
          [p.home, 'home'],
        ] as const) {
          const [cx, cy] = centre;
          for (const { x, y, at } of platformCells(centre)) {
            const c = w.cell(x, y);
            expect(c.portal, `${g.id} ${side} ${x},${y}`).toEqual({ id: g.id, side, at });
            expect(c.solid, `${g.id} ${side} ${at}`).toBeFalsy(); // alle neun Felder begehbar, auch die Ecken
            expect(c.h).toBe(w.cell(cx, cy).h); // flach
            expect(reach.has(`${x},${y}`), `${g.id} ${side} ${at} erreichbar`).toBe(true);
          }
          // ringsum ein Feld frei, und jede Seitenmitte hat davor ein begehbares Feld: Man kommt von allen Seiten drauf
          for (const [dx, dy] of RING) {
            const c = w.cell(cx + dx, cy + dy);
            expect(c.solid || c.ground === 'water' || !!c.portal, `${g.id} ${side} Ring ${dx},${dy}`).toBe(false);
          }
          for (const [dx, dy] of Object.values(DIRS))
            expect(reach.has(`${cx + 2 * dx},${cy + 2 * dy}`), `${g.id} ${side} Zugang ${dx},${dy}`).toBe(true);
          // ein Feld weiter steht kein Baum, dessen Krone die Plattform verdeckte
          for (let d = -3; d <= 3; d++)
            for (const [x, y] of [
              [cx + d, cy - 3],
              [cx + d, cy + 3],
              [cx - 3, cy + d],
              [cx + 3, cy + d],
            ] as const)
              expect(['tree', 'bush'], `${g.id} ${side} Baum ${x},${y}`).not.toContain(w.cell(x, y).deco);
        }
        // am Tor gleich neben dem Turm, im Ring um das Bett etwa neun Felder weit
        const { mid } = w.gates.get(g.id)!;
        expect(Math.hypot(p.gate[0] - mid[0], p.gate[1] - mid[1]), `${g.id} nah am Tor`).toBeLessThanOrEqual(7);
        expect(
          Math.abs(Math.hypot(p.home[0] - LICHTUNG.bed[0], p.home[1] - LICHTUNG.bed[1]) - LICHTUNG.portalRing),
        ).toBeLessThan(1);
        expect(cheb(p.gate, w.stones.get(g.id)!), `${g.id}: Klangstein nicht an der Plattform`).toBeGreaterThan(2);
      }
    });
  }

  it('im Ring um das Bett: keine Plattform berührt eine andere, die Wiese, das Bett, Tröge, Unterstand oder Klangstein (viele Seeds)', () => {
    const fixed: (readonly [number, number])[] = [
      LICHTUNG.bed,
      LICHTUNG.food,
      LICHTUNG.water,
      LICHTUNG.shelterStem,
      BED_STONE,
    ];
    const { x0, y0, x1, y1 } = LICHTUNG.shelter;
    for (let seed = 1; seed <= 3000; seed++) {
      const homes = [...portalPlaces(seed).values()].map((p) => p.home);
      for (const a of homes) {
        for (const b of homes) if (a !== b) expect(cheb(a, b), `Seed ${seed}`).toBeGreaterThanOrEqual(4);
        for (const { x, y } of platformCells(a)) {
          const [dx, dy] = [x - LICHTUNG.bed[0], y - LICHTUNG.bed[1]];
          expect(Math.hypot(dx, dy), `Seed ${seed}: nicht auf der Wiese`).toBeGreaterThan(LICHTUNG.meadow + 0.5);
          expect(x >= x0 && x <= x1 && y >= y0 && y <= y1, `Seed ${seed}: Unterstand`).toBe(false);
        }
        // auch der freie Ring um die Plattform liegt nicht auf Bett, Trog, Pilzstiel oder Klangstein
        for (const f of fixed) expect(cheb(a, f), `Seed ${seed}`).toBeGreaterThan(2);
      }
    }
  });

  it('auf der Plattform steht man etwas höher: auf dem Rand der Sockel, auf der Mitte das Bild', () => {
    const w = worldOf(1);
    const { gate } = w.portals.get('eis')!;
    const lifts = platformCells(gate).map(({ x, y }) => platformLift(w.cell(x, y)));
    expect(new Set(lifts)).toEqual(new Set([0.25, 0.375]));
    expect(platformLift(w.cell(gate[0] + 3, gate[1]))).toBe(0);
  });
});

describe('Klangsteine', () => {
  for (const seed of [1, 42, 2026]) {
    const w = createWorld(seed, PACKS);
    it(`Seed ${seed}: einer am Bett, einer vor jedem Tor, einer am Schneebett; fest, erreichbar, der Weg zum Tor bleibt frei`, () => {
      expect([...w.stones.keys()].sort()).toEqual(['bett', ...GATES.map((g) => g.id), 'eis-offen'].sort());
      // die der Lichtung bei geschlossenen Toren; der am Schneebett liegt im Gletscherkessel: erreichbar, sobald das Eistor offen ist
      const keys = (open: GateId[]) => new Set(reachable(w, open, START, 200000).map(([x, y]) => `${x},${y}`));
      const [lichtung, kessel] = [keys([]), keys(['eis'])];
      for (const [id, [x, y]] of w.stones) {
        const c = w.cell(x, y);
        expect([c.deco, c.story, c.solid], id).toEqual(['klangstein', id, true]);
        const sides = Object.values(DIRS).map(([dx, dy]) => `${x + dx},${y + dy}`);
        const reach = id === 'eis-offen' ? kessel : lichtung;
        expect(
          sides.some((k) => reach.has(k)),
          `${id}: man kommt heran`,
        ).toBe(true);
      }
      for (const g of w.gates.values()) {
        const [sx, sy] = w.stones.get(g.id)!;
        // nicht im Tor und nicht direkt davor; die Bucht vor der Tormitte bleibt frei
        for (const [x, y] of g.cells) expect(Math.abs(x - sx) + Math.abs(y - sy), g.id).toBeGreaterThan(1);
        for (let k = 1; k <= 3; k++)
          expect(lichtung.has(`${g.mid[0] - g.out[0] * k},${g.mid[1] - g.out[1] * k}`)).toBe(true);
      }
    });
  }
});

describe('Torhaus und Felsring', () => {
  /** Felder hinter den Türmen, die das Torhaus ganz umschließt: [quer zum Tor, Reihe hinter der Torreihe] */
  const inside = Array.from({ length: HOUSE_DEPTH }, (_, i) => i + 1).flatMap((t) =>
    Array.from({ length: TOWER }, (_, i) => GATE_HALF + 1 + i).flatMap((u) => [
      [u, t],
      [-u, t],
    ]),
  );

  it('hinter den Türmen ragt kein Fels ins Torhaus (seine Wände lägen in den Turmwänden und flackerten)', () => {
    for (const w of [1, 42, 2026].map(worldOf))
      for (const g of w.gates.values()) {
        const along = [g.out[1], -g.out[0]] as const; // quer zum Tor
        const at = (u: number, t: number) =>
          w.cell(g.mid[0] + along[0] * u + g.out[0] * t, g.mid[1] + along[1] * u + g.out[1] * t);
        for (const [u, t] of inside) expect(at(u!, t!).h, `${w.seed} ${g.id} u=${u} t=${t}`).toBe(at(u!, 0).h);
      }
  });

  it('vor jedem Zugang liegt ein Vorfeld im Boden seiner Welt, nach vorn schmaler; begehbar bleibt alles wie zuvor', () => {
    const U = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
    for (const w of [1, 42, 2026].map(worldOf))
      for (const g of w.gates.values()) {
        const along = [g.out[1], -g.out[0]] as const;
        const xy = (u: number, t: number) =>
          [g.mid[0] + along[0] * u - g.out[0] * t, g.mid[1] + along[1] * u - g.out[1] * t] as const;
        const row = (t: number) => U.filter((u) => w.cell(...xy(u, t)).ground === APRON[g.id]);
        // direkt vor der Torreihe mitten im Weg, weiter vorn weniger (Sand und Schnee gibt es auch sonst auf der Lichtung)
        expect(w.cell(...xy(0, 1)).ground, `${w.seed} ${g.id}`).toBe(APRON[g.id]);
        expect(row(1).length).toBeGreaterThanOrEqual(row(5).length);
        // Klangstein und Bäume bleiben fest wie zuvor; alles andere im Vorfeld ist Lichtung und begehbar
        const cells = [1, 2, 3].flatMap((t) => row(t).map((u) => xy(u, t)));
        for (const at of cells.filter((p) => !w.cell(...p).solid)) {
          expect(w.cell(...at).region).toBe('lichtung');
          expect(standHeight(w, [], ...at), `${w.seed} ${g.id} ${at.join()}`).not.toBeNull();
        }
      }
  });
});

describe('Welt-Pakete', () => {
  for (const seed of [1, 42]) {
    const full = worldOf(seed);
    const bare = createWorld(seed, []);

    it(`Seed ${seed}: Die Lichtung ist mit und ohne Paket der Eis-Welt Feld für Feld gleich, ihre Tiere wohnen gleich`, () => {
      const [RX, RY] = [Math.ceil(lichtung.shape.rx * 1.3), Math.ceil(lichtung.shape.ry * 1.3)]; // samt Felsring
      const differ: string[] = [];
      for (let y = -RY; y <= RY; y++)
        for (let x = -RX; x <= RX; x++) {
          const a = full.cell(x, y);
          if (a.region !== 'lichtung' && !a.gate && !(a.region === 'border' && !a.biome)) continue;
          if (JSON.stringify(a) !== JSON.stringify(bare.cell(x, y))) differ.push(`${x},${y}`);
        }
      expect(differ).toEqual([]);
      const lichtungIds = [...full.spawns.keys()].filter((id) => id.startsWith('lichtung:'));
      expect(lichtungIds.length).toBeGreaterThan(0);
      for (const id of lichtungIds) expect(bare.spawns.get(id), id).toEqual(full.spawns.get(id));
      expect(bare.spotsOf('lichtung')).toEqual(full.spotsOf('lichtung'));
      expect([...bare.gates.keys()]).toEqual([...full.gates.keys()]);
    });

    it(`Seed ${seed}: Ohne Paket endet der Gang des Eistors an einer Eisklippe: keine Eis-Welt, kein Eis-Portal, kein Loch`, () => {
      expect(bare.spotsOf('eis')).toEqual([]);
      expect([...bare.spawns.keys()].some((id) => id.startsWith('eis:'))).toBe(false);
      expect(bare.portals.has('eiskessel')).toBe(false);
      expect(bare.stones.has('eis-offen')).toBe(false);
      // Bei offenem Eistor kommt man durch den Gang, aber nicht weiter: hinter dem Felsring nur sein Boden
      const gate = bare.gates.get('eis')!;
      const along = [gate.out[1], -gate.out[0]] as const;
      const seen = reachable(bare, ['eis'], START, 60000);
      expect(seen.length).toBeLessThan(60000);
      expect(seen.some(([x, y]) => bare.realm(x, y) === 'eis')).toBe(false);
      const beyond = seen.filter(([x, y]) => beyondRing(x, y));
      expect(beyond.length).toBeGreaterThan(0); // der Gang führt bis hinter den Felsring
      for (const [x, y] of beyond) {
        const u = (x - gate.mid[0]) * along[0] + (y - gate.mid[1]) * along[1];
        expect(Math.abs(u), `${x},${y}`).toBeLessThanOrEqual(GATE_HALF);
      }
      const end = Math.max(
        ...beyond.map(([x, y]) => (x - gate.mid[0]) * gate.out[0] + (y - gate.mid[1]) * gate.out[1]),
      );
      const [cx, cy] = [gate.mid[0] + gate.out[0] * (end + 1), gate.mid[1] + gate.out[1] * (end + 1)];
      expect(bare.cell(cx, cy)).toMatchObject({ ground: 'ice', solid: true, region: 'border' }); // Eisklippe
      // Das Bett der Eis-Welt liegt in der Klippe: Jede Gegend hat ein Zuhause, aber niemand kommt hin
      expect(standHeight(bare, ['eis'], ...bare.homes.eis.bed)).toBeNull();
    });
  }

  it('attach baut das Paket im Spiel ein: Feld für Feld wie gleich mit Paket gebaut, nur die betroffenen Stücke neu', () => {
    const seed = 42;
    const full = worldOf(seed);
    const late = createWorld(seed, []);
    // Gespielt wird schon: Stücke der Lichtung samt Felsring und um das Eistor sind berechnet
    const [RX, RY] = [Math.ceil(lichtung.shape.rx * 1.3), Math.ceil(lichtung.shape.ry * 1.3)];
    for (let y = -RY; y <= RY; y++) for (let x = -RX; x <= RX; x++) late.cell(x, y);
    const { world, chunks } = late.attach(EIS_PACK);
    const kessel = kesselPlace(seed, EIS_PACK).cells;
    const differ: string[] = [];
    for (const [x, y] of kessel)
      if (JSON.stringify(world.cell(x, y)) !== JSON.stringify(full.cell(x, y))) differ.push(`${x},${y}`);
    for (let y = -RY; y <= RY; y++)
      for (let x = -RX; x <= RX; x++)
        if (JSON.stringify(world.cell(x, y)) !== JSON.stringify(full.cell(x, y))) differ.push(`${x},${y}`);
    expect(differ).toEqual([]);
    expect(world.spotsOf('eis')).toEqual(full.spotsOf('eis'));
    expect([...world.spawns]).toEqual([...full.spawns]);
    expect([...world.portals]).toEqual([...full.portals]);
    expect([...world.stones]).toEqual([...full.stones]);
    expect(world.homes).toEqual(full.homes);
    const [bx, by] = full.homes.eis.bed;
    expect(world.realm(bx, by)).toBe('eis');
    expect(world.climate(bx, by)).toEqual({ id: 'eis', strength: 1 });
    // Neu entstehen nur Stücke, in denen sich etwas ändert (Gangende und Kessel), keins um das Bett der Lichtung
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks).not.toContain('0,0');
    const gate = full.gates.get('eis')!;
    for (const k of chunks) {
      const [cx, cy] = k.split(',').map(Number) as [number, number];
      const d = Math.hypot((cx + 0.5) * 16 - gate.mid[0], (cy + 0.5) * 16 - gate.mid[1]);
      expect(d, k).toBeGreaterThan(8); // hinter dem Felsring, nicht am Tor selbst
    }
    expect(world.cell(0, 0)).toBe(late.cell(0, 0)); // unveränderte Stücke werden übernommen, nicht neu gebaut
    expect(world.attach(EIS_PACK)).toEqual({ world, chunks: [] }); // zweimal einbauen ändert nichts
  });

  it('attach merkt sich, womit die Welt gebaut wurde, auch wenn die Liste der Pakete danach wächst', () => {
    const list: (typeof EIS_PACK)[] = [];
    const w = createWorld(3, list);
    list.push(EIS_PACK); // so lädt das Spiel: erst in die Liste, dann einbauen
    const { world, chunks } = w.attach(EIS_PACK);
    expect(chunks.length).toBeGreaterThan(0);
    expect(world.spotsOf('eis').length).toBeGreaterThan(0);
  });

  it('die Lage des Kessels kommt aus dem Paket, wie beim Bauen', () => {
    expect(kesselPlace(1, EIS_PACK).bed).toEqual(worldOf(1).homes.eis.bed);
  });
});
