import { describe, expect, it } from 'vitest';
import { DIRS } from '../../lib/games/front';
import { GATES, HOME, REGIONS, type GateId } from '../../data/games/mitwachsen';
import { BED_STONE } from '../../data/games/mitwachsen-stories';
import { platformCells, platformLift } from './mitwachsen-portal';
import {
  GATE_HALF,
  HOUSE_DEPTH,
  TOWER,
  canStep,
  createWorld,
  gatePlaces,
  portalPlaces,
  standHeight,
  wildAnimals,
  type Cell,
  type World,
} from './mitwachsen-world';

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
const START = HOME.wake[0]!;
const SEEDS = [1, 42, 2026, 7, 99, 123456, 15838, 23757, 55433, 95028];

describe('Welt aus dem Seed', () => {
  it('entsteht aus demselben Seed immer gleich, aus einem anderen anders', () => {
    const a = createWorld(1234),
      b = createWorld(1234),
      c = createWorld(99);
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
    const w = createWorld(seed);

    it(`Seed ${seed}: In der Mitte steht nur das Bett, ringsum ist es frei`, () => {
      expect(w.cell(HOME.bed[0], HOME.bed[1]).deco).toBe('bed');
      for (let y = -HOME.clear; y <= HOME.clear; y++)
        for (let x = -HOME.clear; x <= HOME.clear; x++) {
          if (x === HOME.bed[0] && y === HOME.bed[1]) continue;
          expect(standHeight(w, [], x, y), `${x},${y}`).toBe(1);
        }
      for (const [x, y] of HOME.wake) expect(standHeight(w, [], x, y)).not.toBeNull();
    });

    it(`Seed ${seed}: Alle Tiere wohnen erreichbar auf der Lichtung (vier je Art), die Landschaft bleibt draußen`, () => {
      const cells = reachable(w, [], START);
      const set = new Set(cells.map(([x, y]) => `${x},${y}`));
      expect(w.spawns.size).toBe(lichtung.animals.length * lichtung.herd); // 40 Tiere, vier je Art
      const spots = new Set<string>();
      for (const [id, [x, y]] of w.spawns) {
        expect(w.cell(x, y).region, id).toBe('lichtung');
        expect(set.has(`${x},${y}`), id).toBe(true);
        spots.add(`${x},${y}`);
      }
      expect(spots.size).toBe(w.spawns.size); // jedes Tier hat seinen eigenen Platz
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
        expect(Math.hypot(mid[0] - HOME.bed[0], mid[1] - HOME.bed[1])).toBeGreaterThan(60);
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
        expect(g.locked).toBe(true);
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
    expect(mids(createWorld(5).gates)).toBe(mids(gatePlaces(5))); // die gebaute Welt hat dieselben Tore
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
      const w = createWorld(seed);
      const reach = new Set(reachable(w, [], START).map(([x, y]) => `${x},${y}`));
      let meadow = 0;
      for (let y = -HOME.meadow; y <= HOME.meadow; y++)
        for (let x = -HOME.meadow; x <= HOME.meadow; x++) {
          if (Math.hypot(x, y) > HOME.meadow) continue;
          const c = w.cell(HOME.bed[0] + x, HOME.bed[1] + y);
          if (c.deco === 'bed' || c.portal) continue;
          expect(c.garden, `${x},${y}`).toBe(true);
          if (c.solid) continue; // Tröge
          meadow++;
          expect(standHeight(w, [], HOME.bed[0] + x, HOME.bed[1] + y)).toBe(1);
          expect(reach.has(`${HOME.bed[0] + x},${HOME.bed[1] + y}`)).toBe(true);
        }
      expect(meadow).toBeGreaterThan(90);
      expect(w.cell(...HOME.food).deco).toBe('trough');
      expect(w.cell(...HOME.water).deco).toBe('watertrough');
      // Tiere der Lichtung wohnen nicht auf der Wiese
      for (const [x, y] of w.spawns.values()) expect(w.cell(x, y).garden).toBeUndefined();
    });
  }
});

describe('Stimmung der Richtungen', () => {
  for (const seed of [4, 77]) {
    const w = createWorld(seed);
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
    const w = createWorld(11);
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
    const w = createWorld(8),
      again = createWorld(8);
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
      const w = createWorld(seed);
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
            expect(c.solid, `${g.id} ${side} ${at}`).toBe(at === 'corner'); // nur die Ecken mit Zierde sind fest
            expect(c.h).toBe(w.cell(cx, cy).h); // flach
            if (at !== 'corner') expect(reach.has(`${x},${y}`), `${g.id} ${side} ${at} erreichbar`).toBe(true);
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
        expect(Math.abs(Math.hypot(p.home[0] - HOME.bed[0], p.home[1] - HOME.bed[1]) - HOME.portalRing)).toBeLessThan(
          1,
        );
        expect(cheb(p.gate, w.stones.get(g.id)!), `${g.id}: Klangstein nicht an der Plattform`).toBeGreaterThan(2);
      }
    });
  }

  it('im Ring um das Bett: keine Plattform berührt eine andere, die Wiese, das Bett, Tröge, Unterstand oder Klangstein (viele Seeds)', () => {
    const fixed: (readonly [number, number])[] = [HOME.bed, HOME.food, HOME.water, HOME.shelterStem, BED_STONE];
    const { x0, y0, x1, y1 } = HOME.shelter;
    for (let seed = 1; seed <= 3000; seed++) {
      const homes = [...portalPlaces(seed).values()].map((p) => p.home);
      for (const a of homes) {
        for (const b of homes) if (a !== b) expect(cheb(a, b), `Seed ${seed}`).toBeGreaterThanOrEqual(4);
        for (const { x, y } of platformCells(a)) {
          const [dx, dy] = [x - HOME.bed[0], y - HOME.bed[1]];
          expect(Math.hypot(dx, dy), `Seed ${seed}: nicht auf der Wiese`).toBeGreaterThan(HOME.meadow + 0.5);
          expect(x >= x0 && x <= x1 && y >= y0 && y <= y1, `Seed ${seed}: Unterstand`).toBe(false);
        }
        // auch der freie Ring um die Plattform liegt nicht auf Bett, Trog, Pilzstiel oder Klangstein
        for (const f of fixed) expect(cheb(a, f), `Seed ${seed}`).toBeGreaterThan(2);
      }
    }
  });

  it('auf der Plattform steht man etwas höher: auf dem Rand der Sockel, auf der Mitte das Bild', () => {
    const w = createWorld(1);
    const { gate } = w.portals.get('eis')!;
    const lifts = platformCells(gate).map(({ x, y }) => platformLift(w.cell(x, y)));
    expect(new Set(lifts)).toEqual(new Set([0.25, 0.4]));
    expect(platformLift(w.cell(gate[0] + 3, gate[1]))).toBe(0);
  });
});

describe('Klangsteine', () => {
  for (const seed of [1, 42, 2026]) {
    const w = createWorld(seed);
    it(`Seed ${seed}: einer am Bett, einer vor jedem Tor; fest, erreichbar, der Weg zum Tor bleibt frei`, () => {
      expect([...w.stones.keys()].sort()).toEqual(['bett', ...GATES.map((g) => g.id)].sort());
      const reach = new Set(reachable(w, [], START, 200000).map(([x, y]) => `${x},${y}`));
      for (const [id, [x, y]] of w.stones) {
        const c = w.cell(x, y);
        expect([c.deco, c.story, c.solid], id).toEqual(['klangstein', id, true]);
        const sides = Object.values(DIRS).map(([dx, dy]) => `${x + dx},${y + dy}`);
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
          expect(reach.has(`${g.mid[0] - g.out[0] * k},${g.mid[1] - g.out[1] * k}`)).toBe(true);
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
    for (const w of [1, 42, 2026].map(createWorld))
      for (const g of w.gates.values()) {
        const along = [g.out[1], -g.out[0]] as const; // quer zum Tor
        const at = (u: number, t: number) =>
          w.cell(g.mid[0] + along[0] * u + g.out[0] * t, g.mid[1] + along[1] * u + g.out[1] * t);
        for (const [u, t] of inside) expect(at(u!, t!).h, `${w.seed} ${g.id} u=${u} t=${t}`).toBe(at(u!, 0).h);
      }
  });
});
