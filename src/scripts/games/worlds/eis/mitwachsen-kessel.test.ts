// Gletscherkessel hinter dem Eistor: Lage hinter dem Felsring und was jeder Kessel hat (Tests je Seed); das Tal im
// Einzelnen prüft mitwachsen-valley.test.ts
import { describe, expect, it } from 'vitest';
import { DIRS } from '../../../../lib/games/front';
import { type GateId } from '../../../../data/games/mitwachsen';
import { ICE_STONE } from '../../../../data/games/mitwachsen-stories';
import { platformArea, withNeighbours } from '../../mitwachsen-portal';
import { ICE_ANIMALS, KESSEL } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import { HAUNTS } from './mitwachsen-haunts';
import { SEATS, crossings } from '../../mitwachsen-border';
import { GATE_HALF, TOWER, beyondRing, canStep, gatePlaces, kesselPlace, standHeight } from '../../mitwachsen-world';
import { wildAnimals } from '../../mitwachsen-wild';
import { EIS_PACK, reachable, seedChunks, seedRange, seedsFor, worldOf } from '../../test-worlds';

/** Nur das Paket dieser Welt: Ein neues Paket baut die Welten dieser Tests nicht mit */
const ICE = [EIS_PACK];
/** Zuhause der Lichtung: Bett in ihrer Mitte, in jeder Welt gleich */
const LICHTUNG = worldOf(1, ICE).homes.lichtung;
const START = LICHTUNG.wake[0]!;
/** Die acht Nachbarfelder und das Feld selbst */
const RING_1 = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const));

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

  // Tief (MITWACHSEN_DEEP) 500 Seeds in vier Abschnitten, sonst die Stichprobe (seedsFor): Fast die ganze Zeit kosten
  // `kesselPlace` und `gatePlaces` (Torplätze aus dem Rauschen)
  it.each(seedChunks(seedsFor(seedRange(1, 500)), 125))(
    'liegt ganz hinter dem Felsring, berührt weder die Lichtung noch einen anderen Gang oder ein Torhaus und bleibt 12 Felder von jedem fremden Gangausgang (Seeds $label)',
    ({ seeds }) => {
      // Ein `expect` je Seed statt je Feld: sonst dauert der Lauf mit Abdeckung in der Pipeline zu lange
      const key = (x: number, y: number) => x * 4096 + y;
      for (const seed of seeds) {
        const { cells, bed } = kesselPlace(seed, EIS_PACK);
        const kessel = new Set(cells.map(([x, y]) => key(x, y)));
        expect(kessel.has(key(...bed)), `Seed ${seed}`).toBe(true);
        // Rahmen um den Kessel: Felder weiter als `r` davon weg brauchen keinen Blick in die Menge (gleiches Ergebnis, schneller)
        const xs = cells.map(([x]) => x),
          ys = cells.map(([, y]) => y);
        const [bx0, bx1, by0, by1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const far = (x: number, y: number, r: number) => x < bx0 - r || x > bx1 + r || y < by0 - r || y > by1 + r;
        const wrong: string[] = cells
          .filter(([x, y]) => !beyondRing(x, y))
          .map(([x, y]) => `${x},${y} vor dem Felsring`);
        for (const g of gatePlaces(seed).values()) {
          // Den eigenen Gang berührt er an dessen Ende (dort geht es hinein), aber er liegt nicht darauf
          const near: readonly (readonly [number, number])[] = g.id === 'eis' ? [[0, 0]] : RING_1;
          const gang = gangCells(g.mid, g.out);
          for (const [x, y] of gang)
            if (!far(x, y, 1) && near.some(([dx, dy]) => kessel.has(key(x + dx, y + dy))))
              wrong.push(`Gang ${g.id} bei ${x},${y}`);
          if (g.id === 'eis') continue;
          // Ausgang eines fremden Gangs (seine letzte Reihe, schon ganz hinter dem Felsring): weniger als 12 Felder?
          for (const [x, y] of gang.slice(-(2 * span + 1)))
            if (!far(x, y, 12) && DISC_12.some(([dx, dy]) => kessel.has(key(x + dx, y + dy))))
              wrong.push(`Ausgang ${g.id} bei ${x},${y}`);
        }
        expect(wrong, `Seed ${seed}`).toEqual([]);
      }
    },
  );

  for (const seed of [1, 42, 2026, 7]) {
    const w = worldOf(seed, ICE);
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
