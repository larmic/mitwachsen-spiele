// Strecke des Schlittens: Spur im Kessel und Gang, Schuppen, Halte und Warteplätze (Eigenschafts-Tests über Seeds).
// Eigene Datei, damit sie im tiefen Lauf neben den Fahrregeln (mitwachsen-sled.test.ts) in einem eigenen Worker läuft
import { describe, expect, it } from 'vitest';
import { DIRS } from '../../../../lib/games/front';
import { type Point } from '../../../../data/games/mitwachsen';
import { crossings } from '../../mitwachsen-border';
import type { Gang } from '../../mitwachsen-pack-types';
import { platformCells } from '../../mitwachsen-portal';
import { PLATE_ROW } from '../../mitwachsen-plate';
import { canStep, createWorld, type World } from '../../mitwachsen-world';
import { EIS_PACK, seedChunks, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { BESIDE, plateRow } from '../../mitwachsen-bay';
import { SHED_NEAR, SLIDE_GAP, shedOf, trackU } from './mitwachsen-sled-ground';
import { RIDE_SEATS, STOP_STAGES, onFootpath, sledRoute, trackAt, type Route } from './mitwachsen-sled-route';

const ICE = [EIS_PACK];
const keyOf = ([x, y]: Point) => `${x},${y}`;
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const OPEN = ['eis'] as const;
const both = (w: World, a: Point, b: Point) => canStep(w, [...OPEN], ...a, ...b) && canStep(w, [...OPEN], ...b, ...a);
/** Felder bis `r` (Schachbrett) um `p` */
const around = ([x, y]: Point, r: number): Point[] =>
  Array.from({ length: (2 * r + 1) ** 2 }, (_, i): Point => [
    x + (i % (2 * r + 1)) - r,
    y + Math.floor(i / (2 * r + 1)) - r,
  ]);
/** So weit von der Tür (Schachbrett) darf die Strecke dicht an Warteplätze, Plattformen und Klangsteine (aus der Bucht hinaus) */
const BAY_EXIT = 10;

/** Was an Strecke, Schuppen und Halten einer Welt nicht stimmt (leer, wenn alles passt) */
function routeFaults(w: World, r: Route): string[] {
  const inner = r.path.findIndex((p) => keyOf(p) === keyOf(trackAt(w.gates.get('eis')!, 0))); // davor Kessel und Gang
  if (inner < 2) return ['keine Tür auf der Strecke'];
  return [
    ...pathFaults(w, r, inner),
    ...slideFaults(w, r, inner),
    ...apartFaults(w, r),
    ...stopFaults(w, r),
    ...shedFaults(w, r),
    ...footFaults(w, r),
  ];
}

/** Zusammenhängend, ohne Wiederholung, in beiden Richtungen begehbar; im Kessel und Gang genau die Felder mit `ride` */
function pathFaults(w: World, r: Route, inner: number): string[] {
  const wrong: string[] = [];
  if (new Set(r.path.map(keyOf)).size !== r.path.length) wrong.push('Feld doppelt');
  r.path.forEach((p, i) => {
    const q = r.path[i + 1];
    if (q && (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) !== 1 || !both(w, p, q))) wrong.push(`Lücke ${keyOf(p)}`);
    if (!!w.cell(...p).ride !== i < inner) wrong.push(`ride ${keyOf(p)}`);
  });
  // Länge (gemessen 104 bis 194 Felder über Seeds 1 bis 500)
  if (r.path.length < 95 || r.path.length > 210) wrong.push(`Länge ${r.path.length}`);
  return wrong;
}

/** Rutschspur: mindestens SLIDE_GAP Felder weg; im Gang genau 2, eins von fünf Feldern der Reihe */
function slideFaults(w: World, r: Route, inner: number): string[] {
  const wrong: string[] = [];
  const g = w.gates.get('eis')!;
  const across = [-g.out[1], g.out[0]] as const;
  for (const p of r.path.slice(0, inner)) {
    if (around(p, SLIDE_GAP - 1).some((q) => w.cell(...q).slide)) wrong.push(`an der Rutschspur ${keyOf(p)}`);
    if (w.cell(...p).region === 'eis') continue;
    const row = [-2, -1, 0, 1, 2].map((u): Point => [p[0] + across[0] * (u + 2), p[1] + across[1] * (u + 2)]);
    if (!w.cell(...row[2]!).slide || row.filter((q) => w.cell(...q).ride).length !== 1) wrong.push(`Gang ${keyOf(p)}`);
  }
  return wrong;
}

/**
 * Nie auf Torplatte, Platz des Pinguins, Klangstein, Wasser oder einer Plattform; Abstand ≥ 2 zu Trögen, zu
 * Plattformen, Klangsteinen und Warteplätzen an der Weltgrenze nur beim Weg aus der Bucht nicht
 */
function apartFaults(w: World, r: Route): string[] {
  const wrong: string[] = [];
  const g = w.gates.get('eis')!;
  const door = trackAt(g, 0);
  const plates = [-1, 0, 1, BESIDE].map((u) => keyOf(plateRow(g, u)));
  const portals = [...w.portals.values()].flatMap((p) => [p.gate, p.home].flatMap((c) => platformCells(c)));
  const near = new Set([
    ...portals.flatMap(({ x, y }) => around([x, y], 1).map(keyOf)),
    ...[...w.stones.values()].flatMap((s) => around(s, 1).map(keyOf)),
    ...crossings(w).flatMap((c) => [...c.seats.values()].flat().map(keyOf)),
  ]);
  const troughs = new Set(
    Object.values(w.homes).flatMap((h) => [h.food, h.water].flatMap((t) => around(t, 1).map(keyOf))),
  );
  for (const p of r.path) {
    const c = w.cell(...p);
    if (c.plate || plates.includes(keyOf(p)) || c.story || c.ground === 'water' || c.portal)
      wrong.push(`auf ${keyOf(p)}`);
    if (troughs.has(keyOf(p))) wrong.push(`am Trog ${keyOf(p)}`);
    if (near.has(keyOf(p)) && (cheb(p, door) > BAY_EXIT || w.realm(...p) !== 'lichtung'))
      wrong.push(`dicht ${keyOf(p)}`);
  }
  return wrong;
}

/**
 * Halt auf der Lichtung neben der Plattform des Eistor-Portals am Bett (im Bereich seiner Stufe), nicht auf dem
 * Fußweg, zwei Felder weg von Wasser; Halte an den Enden
 */
function stopFaults(w: World, r: Route): string[] {
  const wrong: string[] = [];
  const g = w.gates.get('eis')!;
  const plate = w.portals.get('eis')!.home;
  const out = r.stops.out;
  const dist = Math.hypot(out[0] - plate[0], out[1] - plate[1]);
  if (dist > STOP_STAGES[r.stage].r) wrong.push(`Halt ${keyOf(out)}: ${dist.toFixed(1)} von der Plattform`);
  if (onFootpath(w, g, out) || around(out, 1).some((q) => w.cell(...q).ground === 'water'))
    wrong.push('Halt am Weg oder Teich');
  if (keyOf(r.path.at(-1)!) !== keyOf(out) || keyOf(r.path[0]!) !== keyOf(r.stops.home)) wrong.push('Halte');
  return wrong;
}

/**
 * Schuppen gleich neben der Plattform des Eis-Portals am Schneebett, nicht auf der Strecke; kein Wohnort, kein
 * Wohnplatz der Eis-Tiere auf Strecke oder Schuppen; je Halt 8 feste Warteplätze abseits davon
 */
function shedFaults(w: World, r: Route): string[] {
  const wrong: string[] = [];
  const plate = w.portals.get('eiskessel')!.home;
  const [sx, sy] = r.shed.reduce(([a, b], [x, y]) => [a + x / r.shed.length, b + y / r.shed.length], [0, 0]);
  const shedR = Math.hypot(sx - plate[0], sy - plate[1]);
  if (shedR < SHED_NEAR.near || shedR > SHED_NEAR.far) wrong.push(`Schuppen ${shedR.toFixed(1)} von der Plattform`);
  for (const p of r.shed)
    if (r.on.has(keyOf(p)) || w.realm(...p) !== 'eis' || w.cell(...p).solid) wrong.push(`Schuppen ${keyOf(p)}`);
  const taken = new Set([...r.path, ...r.shed].map(keyOf));
  for (const [id, p] of w.spawns) if (id.startsWith('eis:') && taken.has(keyOf(p))) wrong.push(`Wohnort ${id}`);
  if (w.spotsOf('eis').some((p) => taken.has(keyOf(p)))) wrong.push('Wohnplatz auf der Strecke');
  for (const seats of [r.seats.home, r.seats.out]) {
    if (seats.length !== RIDE_SEATS || new Set(seats.map(keyOf)).size !== RIDE_SEATS) wrong.push('Warteplätze');
    for (const s of seats) if (around(s, 1).some((q) => taken.has(keyOf(q)))) wrong.push(`Warteplatz ${keyOf(s)}`);
  }
  return wrong;
}

/** Der Fußweg vom Bett der Lichtung zum Schneebett bleibt frei, auch wenn Schlitten, Rentier und Schuppen dort stehen */
function footFaults(w: World, r: Route): string[] {
  const shut = new Set([...r.shed, ...r.path.slice(0, 2), ...r.path.slice(-2)].map(keyOf));
  const start = w.homes.lichtung.wake[0]!;
  const goal = keyOf(w.homes.eis.wake[0]!);
  const seen = new Set([keyOf(start)]);
  const queue: Point[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (keyOf([x, y]) === goal) return [];
    for (const [dx, dy] of Object.values(DIRS)) {
      const k = `${x + dx},${y + dy}`;
      if (seen.has(k) || shut.has(k) || !canStep(w, [...OPEN], x, y, x + dx, y + dy)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return ['Fußweg Bett → Schneebett versperrt'];
}

describe('Strecke des Schlittens (Eis-Welt)', () => {
  it('trackU: In jeder Lage des Tors liegt die Spur im Gang auf derselben Linie wie u = −2 der Torplatte', () => {
    for (const out of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const across: Point = out[0] ? [0, 1] : [1, 0];
      const at = (u: number, t: number): Point => [across[0] * (7 + u) + out[0] * t, across[1] * (7 + u) + out[1] * t];
      const gang: Gang = { at, depth: 40, end: 50, half: 2, wall: 2 };
      const g = { mid: at(0, 40), out };
      expect(at(trackU(gang), 40 - PLATE_ROW), `out ${out.join()}`).toEqual(plateRow(g, -2));
      expect(at(trackU(gang), 45), `out ${out.join()}`).toEqual(trackAt(g, 5));
      expect(Math.abs(trackU(gang))).toBe(2);
    }
  });

  it('shedOf: 3 Felder breit, 2 tief, gleich hinter dem Halt in Fahrtrichtung', () => {
    expect(shedOf([10, 10], [1, 0])).toEqual([
      [11, 9],
      [11, 10],
      [11, 11],
      [12, 9],
      [12, 10],
      [12, 11],
    ]);
    expect(shedOf([0, 0], [0, -1]).map(([, y]) => y)).toEqual([-1, -1, -1, -2, -2, -2]);
  });

  it('ohne Paket der Eis-Welt keine Strecke; je Welt einmal berechnet', () => {
    expect(sledRoute(createWorld(1, []))).toBeUndefined();
    const w = worldOf(1, ICE);
    expect(sledRoute(w)).toBe(sledRoute(w));
  });

  // Tief (MITWACHSEN_DEEP) Seeds 1 bis 50 in zwei Abschnitten, sonst die Stichprobe. Eine ganze Welt zu bauen kostet
  // gut 0,2 s, 500 Seeds sprengten die Frist des Jobs `static` (gemessen: über 1 bis 500 lief alles grün); 100 Seeds
  // kosteten 24 s und brachten test:deep in gates:ci über 150 s (Schritt 4 der Bahn), darum 50 wie die übrigen
  // Strecken-Prüfungen weit über den 20 Seeds der anderen Welt-Tests. Die Welten werden hier frisch gebaut (nicht
  // `worldOf`), sonst blieben sie alle im Speicher
  it.each(seedChunks(seedsFor(seedRange(1, 50)), 25))(
    'Strecke, Schuppen und Halte: zusammenhängend und begehbar, neben der Rutschspur, fern von Platte, Warteplätzen und Plattformen, Halt im Bereich, Fußweg frei (Seeds $label)',
    ({ seeds }) => {
      const wrong: string[] = [];
      let fallback = 0;
      for (const seed of seeds) {
        const w = createWorld(seed, ICE);
        const r = sledRoute(w);
        if (!r) {
          wrong.push(`Seed ${seed}: keine Strecke`);
          continue;
        }
        if (r.stage > 0) fallback++;
        wrong.push(...routeFaults(w, r).map((f) => `Seed ${seed}: ${f}`));
      }
      expect(wrong).toEqual([]);
      // Ausweichstufen zählen: Der Wunschbereich passt fast immer (gemessen über Seeds 1 bis 500: immer)
      expect(fallback, `Ausweichstufe in ${fallback} von ${seeds.length} Seeds`).toBeLessThanOrEqual(seeds.length / 10);
    },
  );
});
