// Welt aus dem Seed: Lichtung, Zuhause, Landschaft, Klangsteine, Welt-Pakete. Nach Thema geteilt, damit die Worker
// parallel laufen: Gletscherkessel in worlds/eis/mitwachsen-kessel.test.ts und mitwachsen-valley.test.ts,
// Portal-Plattformen und Torhäuser in mitwachsen-world-portals.test.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import { DIRS } from '../../lib/games/front';
import { GATES, REGIONS, type GateId } from '../../data/games/mitwachsen';
import { HOMES } from '../../data/games/mitwachsen-homes';
import { crossings } from './mitwachsen-border';
import {
  GATE_HALF,
  beyondRing,
  canStep,
  createWorld,
  gatePlaces,
  kesselPlace,
  standHeight,
  type Cell,
  type World,
} from './mitwachsen-world';
import { wildAnimals } from './mitwachsen-wild';
import { homeAt } from './mitwachsen-home';
import { PLATE_HALF, plateMid } from './mitwachsen-plate';
import { BESIDE, bay, inBay, plateRow } from './mitwachsen-bay';
import { EIS_PACK, FAHRT_PACK, PACKS, reachable, worldOf } from './test-worlds';

const lichtung = REGIONS[0];
/** Zuhause der Lichtung: Bett in ihrer Mitte, in jeder Welt gleich */
const LICHTUNG = worldOf(1).homes.lichtung;
const START = LICHTUNG.wake[0]!;
/** Seeds der Tests je Seed (Portal-Plattformen in mitwachsen-world-portals.test.ts nutzen dieselben) */
const SEEDS = [1, 42, 2026, 7, 99, 123456, 15838, 23757, 55433, 95028];
// Die Welten der Tests einmal vorab bauen (Frist der Hooks: vitest.config.ts): Sonst zahlt der erste Test je Seed den Bau (`worldOf`)
beforeAll(() => [...SEEDS, 3, 4, 5, 11, 77].forEach((s) => worldOf(s)));

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
        // das Eistor öffnet der Pinguin, das Höhlentor Tok
        const opens = { eis: { key: 'pinguin' }, hoehle: { key: 'tok', after: 'eis' } } as Record<string, unknown>;
        expect(g.opens).toEqual(opens[g.id] ?? 'never');
      }
    });

    it(`Seed ${seed}: Vor jedem Zugang liegt eine ebene, begehbare Torplatte (3 × 1, Reihe 2 der Bucht), nicht Portal-Plattform, nicht Warteplatz, keine Deko, kein Wasser`, () => {
      const key = ([x, y]: readonly [number, number]) => `${x},${y}`;
      const seats = new Set(crossings(w).flatMap((c) => [...c.seats.values()].flat().map(key)));
      const reach = new Set(reachable(w, [], START).map(key));
      for (const g of GATES) {
        const place = w.gates.get(g.id)!;
        const [mx, my] = plateMid(place);
        const along = [Math.abs(place.out[1]), Math.abs(place.out[0])] as const;
        const at = (u: number, t = 0) =>
          [mx + along[0] * u - place.out[0] * t, my + along[1] * u - place.out[1] * t] as const;
        expect(w.cell(...place.mid).h, `${g.id} Tormitte so hoch wie die Platte (3D hängt sie ins Torhaus)`).toBe(1);
        const row2 = bay(place)
          .slice(place.cells.length, 2 * place.cells.length)
          .map(key); // Reihe 2 der Bucht
        for (let u = -PLATE_HALF; u <= PLATE_HALF; u++) {
          const c = w.cell(...at(u));
          const where = `${g.id} ${key(at(u))}`;
          expect(row2, where).toContain(key(at(u)));
          expect([c.plate, c.h, c.deco, c.solid, c.ground === 'water', !!c.portal, !!c.tufts], where).toEqual([
            g.id,
            1,
            null,
            false,
            false,
            false,
            false,
          ]);
          expect(standHeight(w, [], ...at(u)), where).toBe(1);
          expect(reach.has(key(at(u))), where).toBe(true);
          expect(seats.has(key(at(u))), where).toBe(false);
        }
        // davor (Reihe 3) eben und frei: Nichts Höheres verdeckt die Platte, geradeaus kommt man hin
        for (let u = -PLATE_HALF; u <= PLATE_HALF; u++)
          expect([w.cell(...at(u, 1)).h, w.cell(...at(u, 1)).solid], `${g.id} vor der Platte`).toEqual([1, false]);
        // genau drei Felder: daneben, davor und dahinter keine Platte
        for (const [u, t] of [
          [-2, 0],
          [2, 0],
          [0, 1],
          [0, -1],
        ] as const)
          expect(w.cell(...at(u, t)).plate, `${g.id} neben der Platte`).toBeUndefined();
        // der Platz des führenden Pinguins neben der Platte (Eistor; dort beginnt sein Weg zum Tor, mitwachsen-lead.ts):
        // in der Bucht, eben, erreichbar, kein Portal, kein Warteplatz – sonst fände er nie hin, und das Kind säße fest
        const side = plateRow(place, BESIDE);
        const c = w.cell(...side);
        expect(
          [inBay(place, ...side), standHeight(w, [], ...side), reach.has(key(side)), seats.has(key(side)), !!c.portal],
          `${g.id} Platz neben der Platte`,
        ).toEqual([true, 1, true, false, false]);
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
          if (w.realm(x, y) !== 'lichtung') continue; // dort liegt die Welt hinter einem Tor (die Grotte reicht weit)
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
    it(`Seed ${seed}: jede Gegend mit Welt hat ein Zuhause: Bett, Wiese, Tröge und Unterstand liegen in ihr, wie HOMES sie legt`, () => {
      const w = worldOf(seed);
      expect(w.homes.lichtung.bed).toEqual([0, 0]); // das Bett der Lichtung steht in ihrer Mitte
      // die Lichtung und jede Gegend, deren Paket es gibt
      for (const r of REGIONS.filter((g) => g.id === 'lichtung' || PACKS.some((p) => p.id === g.id))) {
        const home = w.homes[r.id];
        const plan = HOMES[r.id];
        const at = ([x, y]: readonly [number, number]) => [home.bed[0] + x, home.bed[1] + y];
        expect(home.realm).toBe(r.id);
        expect(w.cell(...home.bed).deco).toBe('bed');
        expect(home.food).toEqual(at(plan.food));
        expect(home.water).toEqual(at(plan.water));
        expect(home.shelterStem).toEqual(at(plan.shelterStem));
        expect(home.wake).toEqual(plan.wake.map(at));
        // Lichtung: Futtertrog und Riesenpilz; Eis-Welt: Eisschale und Iglu (Mitte seiner Rückwand); Grotte: Pilzschale,
        // Steintrog und Unterstand (Mitte der Kristallwand)
        const [food, water, stem] = {
          lichtung: ['trough', 'watertrough', 'shelterpilz'],
          eis: ['icebowl', 'watertrough', 'igloo'],
          hoehle: ['shroombowl', 'stonetrough', 'shed'],
        }[r.id];
        const many = r.id === 'lichtung' ? 1000 : 500;
        expect(w.cell(...home.food).deco).toBe(food);
        expect(w.cell(...home.water).deco).toBe(water);
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

describe('Klangsteine', () => {
  for (const seed of [1, 42, 2026]) {
    const w = worldOf(seed);
    it(`Seed ${seed}: einer am Bett, einer vor jedem Tor, einer am Schneebett, einer am Höhlenbett; fest, erreichbar, der Weg zum Tor bleibt frei`, () => {
      // ohne das Paket der Bahn (Tests ohne Bahn) keine Steine der Bahn
      expect([...w.stones.keys()].sort()).toEqual(
        ['bett', ...GATES.map((g) => g.id), 'eis-offen', 'hoehle-offen'].sort(),
      );
      // die der Lichtung bei geschlossenen Toren; der am Schneebett liegt im Gletscherkessel: erreichbar, sobald das Eistor
      // offen ist, der am Höhlenbett in der Grotte, sobald auch das Höhlentor offen ist
      const keys = (open: GateId[]) => new Set(reachable(w, open, START, 200000).map(([x, y]) => `${x},${y}`));
      const [lichtung, kessel, grotte] = [keys([]), keys(['eis']), keys(['eis', 'hoehle'])];
      for (const [id, [x, y]] of w.stones) {
        const c = w.cell(x, y);
        expect([c.deco, c.story, c.solid], id).toEqual(['klangstein', id, true]);
        const sides = Object.values(DIRS).map(([dx, dy]) => `${x + dx},${y + dy}`);
        const reach = id === 'eis-offen' ? kessel : id === 'hoehle-offen' ? grotte : lichtung;
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

    it(`Seed ${seed}: Hinter dem Höhlentor steht ohne Paket eine Felswand, mit Paket die Grotte`, () => {
      expect(bare.worlds).toEqual(['eis', 'hoehle']); // gebaut hinter beiden Toren: Eisklippe und Felswand
      expect(bare.spotsOf('hoehle')).toEqual([]);
      expect(crossings(bare).map((c) => c.gate.id)).toEqual(['eis', 'hoehle']);
      expect(bare.homes.hoehle.realm).toBe('hoehle'); // ein Zuhause hat sie trotzdem (TypeScript verlangt es)
      const gate = bare.gates.get('hoehle')!;
      // gleich hinter der Mündung des Gangs: drei Reihen Fels, Reihe für Reihe höher, so breit wie Gang und Türme
      const rows = [1, 2, 3].map((t) => {
        const [x, y] = [gate.mid[0] + gate.out[0] * (gate.deep + t), gate.mid[1] + gate.out[1] * (gate.deep + t)];
        return bare.cell(x, y);
      });
      expect(rows.map((c) => [c.h, c.ground, c.solid, c.region])).toEqual([
        [3, 'stone', true, 'border'],
        [4, 'stone', true, 'border'],
        [5, 'stone', true, 'border'],
      ]);
      // mit Paket: die Grotte, aber das Tor bleibt zu (niemand kommt von der Lichtung hinein)
      const w = worldOf(seed);
      expect(w.spotsOf('hoehle').length).toBeGreaterThan(5000);
      const seen = reachable(w, ['eis'], START, 200000);
      expect(seen.some(([x, y]) => w.realm(x, y) === 'hoehle' && w.cell(x, y).region === 'hoehle')).toBe(false);
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
    const full = worldOf(seed, [EIS_PACK]);
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
    expect(world.attach(FAHRT_PACK)).toEqual({ world, chunks: [] }); // die Fahrzeuge bauen nichts: kein Neubau
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
