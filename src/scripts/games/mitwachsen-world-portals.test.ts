// Portal-Plattformen und Torhäuser in der gebauten Welt (aus mitwachsen-world.test.ts geteilt, damit die Worker
// parallel laufen)
import { beforeAll, describe, expect, it } from 'vitest';
import { DIRS } from '../../lib/games/front';
import { GATES } from '../../data/games/mitwachsen';
import { BED_STONE } from '../../data/games/mitwachsen-stories';
import { platformCells, platformLift } from './mitwachsen-portal';
import { GATE_HALF, HOUSE_DEPTH, TOWER, portalPlaces, standHeight } from './mitwachsen-world';
import { APRON } from './mitwachsen-apron';
import { reachable, seedChunks, seedRange, seedsFor, worldOf } from './test-worlds';

/** Zuhause der Lichtung: Bett in ihrer Mitte, in jeder Welt gleich */
const LICHTUNG = worldOf(1).homes.lichtung;
const START = LICHTUNG.wake[0]!;
/** Dieselben Seeds wie die Tests je Seed in mitwachsen-world.test.ts */
const SEEDS = [1, 42, 2026, 7, 99, 123456, 15838, 23757, 55433, 95028];
// Die Welten einmal vorab bauen (Frist der Hooks: vitest.config.ts): Sonst zahlt der erste Test je Seed den Bau (`worldOf`)
beforeAll(() => SEEDS.forEach((s) => worldOf(s)));

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

  // Tief (MITWACHSEN_DEEP) 3000 Seeds in sechs Abschnitten, sonst die Stichprobe (seedsFor): Fast die ganze Zeit kostet
  // `portalPlaces` (Torplätze aus dem Rauschen)
  it.each(seedChunks(seedsFor(seedRange(1, 3000)), 500))(
    'im Ring um das Bett: keine Plattform berührt eine andere, die Wiese, das Bett, Tröge, Unterstand oder Klangstein (Seeds $label)',
    ({ seeds }) => {
      const fixed: (readonly [number, number])[] = [
        LICHTUNG.bed,
        LICHTUNG.food,
        LICHTUNG.water,
        LICHTUNG.shelterStem,
        BED_STONE,
      ];
      const { x0, y0, x1, y1 } = LICHTUNG.shelter;
      // Fehler sammeln, ein `expect` je Seed statt je Feld
      for (const seed of seeds) {
        const homes = [...portalPlaces(seed).values()].map((p) => p.home);
        const wrong: string[] = [];
        for (const a of homes) {
          for (const b of homes) if (a !== b && cheb(a, b) < 4) wrong.push(`${a.join()} zu nah an ${b.join()}`);
          for (const { x, y } of platformCells(a)) {
            const [dx, dy] = [x - LICHTUNG.bed[0], y - LICHTUNG.bed[1]];
            if (Math.hypot(dx, dy) <= LICHTUNG.meadow + 0.5) wrong.push(`${x},${y} auf der Wiese`);
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) wrong.push(`${x},${y} im Unterstand`);
          }
          // auch der freie Ring um die Plattform liegt nicht auf Bett, Trog, Pilzstiel oder Klangstein
          for (const f of fixed) if (cheb(a, f) <= 2) wrong.push(`${a.join()} zu nah an ${f.join()}`);
        }
        expect(wrong, `Seed ${seed}`).toEqual([]);
      }
    },
  );

  it('auf der Plattform steht man etwas höher: auf dem Rand der Sockel, auf der Mitte das Bild', () => {
    const w = worldOf(1);
    const { gate } = w.portals.get('eis')!;
    const lifts = platformCells(gate).map(({ x, y }) => platformLift(w.cell(x, y)));
    expect(new Set(lifts)).toEqual(new Set([0.25, 0.375]));
    expect(platformLift(w.cell(gate[0] + 3, gate[1]))).toBe(0);
  });
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
    for (const w of [1, 42, 2026].map((s) => worldOf(s)))
      for (const g of w.gates.values()) {
        const along = [g.out[1], -g.out[0]] as const; // quer zum Tor
        const at = (u: number, t: number) =>
          w.cell(g.mid[0] + along[0] * u + g.out[0] * t, g.mid[1] + along[1] * u + g.out[1] * t);
        for (const [u, t] of inside) expect(at(u!, t!).h, `${w.seed} ${g.id} u=${u} t=${t}`).toBe(at(u!, 0).h);
      }
  });

  it('vor jedem Zugang liegt ein Vorfeld im Boden seiner Welt, nach vorn schmaler; begehbar bleibt alles wie zuvor', () => {
    const U = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
    for (const w of [1, 42, 2026].map((s) => worldOf(s)))
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
