// Füllung der Kristallgrotte – rein und deterministisch: Derselbe Seed ergibt dieselbe Füllung. Was auf der Lichtung
// Bäume und Büsche sind, ist in der Grotte: Stalagmiten-Gruppen (3 bis 5 in drei Höhen, fest wie Bäume, dazwischen
// begehbare Lücken), niedrige leuchtende Kristallbüsche (fest wie ein Busch), Felsbrocken, flache Felsinseln mit Moos
// obenauf (eine Stufe hoch, begehbar), kleine türkise Pfützen und, nur unter den Lichtschächten, Moos und Farn.
// Stalagmiten und Felsbrocken tragen die Farbe ihrer Zone an der Spitze (`tipOf`, `Cell.color`). Am Rand
// und in der Tropfsteingrotte dichter, die Mitte und die Wege bleiben frei, ebenso die Spur für das künftige Gleis von
// der Mündung bis zum Platz des Bahnhofs (`corridorAt`). Feste Dinge halten `OBSTACLE_GAP` Felder Abstand zu allem
// anderen Festen (nur die Glieder einer Gruppe stehen enger, mit einem freien Feld dazwischen), so bleibt jedes Feld
// erreichbar. Teil des Welt-Pakets der Höhlenwelt (mitwachsen-grotte.ts ruft es beim Bauen).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“, Füllung)

import { hash, rand01 } from '../../../../lib/games/rng';
import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import { GATE_HALF, OBSTACLE_GAP } from '../../mitwachsen-world';
import type { Site } from './mitwachsen-site';

const { rx, ry } = GROTTE.shape;
const key = (x: number, y: number) => `${x},${y}`;
/** (u, v) von der Mitte: frei zu halten? */
type Keep = (u: number, v: number) => boolean;

/**
 * Spur für das Gleis (Paket der Bahn, worlds/bahn/), in (u, v) von der Mitte: von der Mündung so breit wie der Gang
 * geradeaus, zwischen den Kristall-Lampen hindurch, hinter der letzten Lampe quer hinüber bis an die Spur hinter dem
 * Platz des Bahnhofs (ein Feld weiter außen als der Bahnsteig, dort hält der Zug: Der Weg zum Bahnsteig kreuzt kein Gleis)
 */
export function corridorAt(u: number, v: number): boolean {
  const o = v + ry;
  const { station, lamps } = GROTTE;
  if (o < 0 || o >= station.out) return false;
  if (Math.abs(u) <= GATE_HALF) return true;
  return o > lamps.to && u >= -GATE_HALF && u <= station.side + station.wide;
}

/** Zonen der Füllung: Rand (nah an den Klippen), Tropfsteingrotte, sonst die Seiten */
export type FillZone = 'rim' | 'drip' | 'side';

/** Zone der Füllung für (u, v) von der Mitte */
export function fillZone(u: number, v: number): FillZone {
  const { drip } = GROTTE;
  if (Math.hypot(u - drip.across, v + ry - drip.out) <= drip.r + 3) return 'drip';
  return (u / rx) ** 2 + (v / ry) ** 2 > 0.6 ? 'rim' : 'side';
}

/** Zonen mit eigener Farbe der Spitzen: Mitte (u, v von der Mitte der Grotte) und Radius */
const TIP_ZONES: readonly (readonly [keyof typeof GROTTE_COLORS.tips, number, number, number])[] = (() => {
  const { garden, hall, drip, clay } = GROTTE;
  return [
    ['garden', garden.across, garden.out - ry, garden.r],
    ['hall', hall.across, hall.out - ry, hall.r],
    ['drip', drip.across, drip.out - ry, drip.r],
    // Lehmhang: zwei Stufen nach außen von seiner Innenkante, `long` Felder lang um `out` (wie `mitwachsen-grotte.ts`
    // ihn baut: von `out - long/2` an)
    [
      'clay',
      clay.across - clay.step + 0.5,
      clay.out - (clay.long >> 1) + (clay.long - 1) / 2 - ry,
      clay.step + clay.long / 2,
    ],
  ];
})();

/**
 * Farbe der Spitze eines Stalagmiten oder Felsbrockens bei (u, v) von der Mitte: die der nächsten Zone (Abstand zu ihrem
 * Rand), so hat jede Zone ihre Farbe und die Grotte keine Lücke; der See hat keine (Türkis bleibt dem Wasser), dort und am
 * Ende gilt die Tropfsteingrotte. Nur Rechnen, keine Suche
 */
export function tipOf(u: number, v: number): string {
  let best = TIP_ZONES[0]!;
  let near = Infinity;
  for (const z of TIP_ZONES) {
    const d = Math.hypot(u - z[1], v - z[2]) - z[3];
    if (d < near) [best, near] = [z, d];
  }
  return GROTTE_COLORS.tips[best[0]];
}

/** Grottenboden ohne alles: hier darf etwas hin */
const plain = (c: Cell | undefined): c is Cell =>
  !!c && c.region === 'hoehle' && !c.solid && !c.deco && !c.garden && !c.portal && c.ground === 'grotto';

/**
 * Glieder einer Stalagmiten-Gruppe vom Platz der Gruppe aus: je zwei mindestens zwei Felder auseinander (Chebyshev),
 * dazwischen bleibt ein Feld frei
 */
const MEMBERS: readonly Point[] = [
  [0, 0],
  [2, 0],
  [-1, 2],
  [1, -2],
  [-2, -1],
  [3, 2],
  [-3, 1],
];

/**
 * Die Grotte füllen (`map`, Boden, Zonen und Zuhause stehen schon): Felsinseln, Stalagmiten-Gruppen, Kristallbüsche,
 * Felsbrocken und Pfützen, nie auf Feldern, die frei bleiben (`free`)
 */
export function fillGrotte(seed: number, site: Site, free: Keep, map: Map<string, Cell>) {
  const at = (u: number, v: number) => site.at(u, v);
  const open = (u: number, v: number) => {
    const [x, y] = at(u, v);
    const c = map.get(key(x, y));
    return plain(c) && !free(u, v) ? c : null;
  };
  /** kein Festes, kein Wasser, keine Plattform und nichts außerhalb der Grotte bis `gap` Felder um (x, y), außer `own` */
  const clear = (x: number, y: number, own: ReadonlySet<string> = new Set()) => {
    for (let dy = -OBSTACLE_GAP; dy <= OBSTACLE_GAP; dy++)
      for (let dx = -OBSTACLE_GAP; dx <= OBSTACLE_GAP; dx++) {
        const k = key(x + dx, y + dy);
        if (own.has(k)) continue;
        const n = map.get(k);
        if (!n || n.solid || n.ground === 'water' || n.portal || n.region !== 'hoehle') return false;
      }
    return true;
  };
  islands(seed, open, at, map);
  groups(seed, open, at, clear, map);
  singles(seed, open, at, clear, map);
}

type Open = (u: number, v: number) => Cell | null;
type At = (u: number, v: number) => Point;

/** Je Feld eines Rasters von `every` Feldern ein Platz (u, v), leicht versetzt je Seed */
function grid(seed: number, every: number, salt: number): Point[] {
  const out: Point[] = [];
  for (let gv = -ry; gv <= ry; gv += every)
    for (let gu = -rx; gu <= rx; gu += every)
      out.push([gu + (hash(seed, gu, gv, salt) % every), gv + (hash(seed, gu, gv, salt + 1) % every)]);
  return out;
}

/** Flache Felsinseln mit Moos obenauf: 3 × 2 oder 2 × 3, eine Stufe über ebenem Boden, ringsum begehbarer Boden */
function islands(seed: number, open: Open, at: At, map: Map<string, Cell>) {
  const { every, chance } = GROTTE.fill.islands;
  for (const [u, v] of grid(seed, every, 90)) {
    if (rand01(seed, u, v, 92) >= chance) continue;
    const [wu, wv] = hash(seed, u, v, 93) % 2 ? [3, 2] : [2, 3];
    for (const [cu, cv] of islandAt(open, u, v, wu, wv)) {
      const [x, y] = at(cu, cv);
      map.set(key(x, y), { ...map.get(key(x, y))!, h: 2, deco: 'mosstop' }); // eben geprüft: ein Feld der Grotte
    }
  }
}

/** Felder einer Felsinsel `wu` × `wv` ab (u, v), wenn sie auf ebenem, freiem Boden Platz hat (ringsum ein Feld), sonst keine */
function islandAt(open: Open, u: number, v: number, wu: number, wv: number): Point[] {
  const cells: Point[] = [];
  for (let dv = -1; dv <= wv; dv++)
    for (let du = -1; du <= wu; du++) {
      const c = open(u + du, v + dv);
      const inner = du >= 0 && du < wu && dv >= 0 && dv < wv;
      if (inner && c?.h !== 1) return [];
      if (!inner && (!c || c.h > 2)) return []; // der Rand ringsum: freier Grottenboden
      if (inner) cells.push([u + du, v + dv]);
    }
  return cells;
}

/** Stalagmiten-Gruppen: je 3 bis 5 in drei Höhen, enger beisammen als andere feste Dinge, mit Lücken dazwischen */
function groups(
  seed: number,
  open: Open,
  at: At,
  clear: (x: number, y: number, own?: ReadonlySet<string>) => boolean,
  map: Map<string, Cell>,
) {
  const { every, ...chance } = GROTTE.fill.groups;
  for (const [u, v] of grid(seed, every, 94)) {
    if (!open(u, v) || rand01(seed, u, v, 96) >= chance[fillZone(u, v)]) continue;
    const want = 3 + (hash(seed, u, v, 97) % 3);
    const turn = hash(seed, u, v, 98);
    const [fu, fv] = [turn & 1 ? -1 : 1, turn & 2 ? -1 : 1]; // gespiegelt je Gruppe
    const own: Point[] = [];
    for (let i = 0; i < MEMBERS.length && own.length < want; i++) {
      const [du, dv] = MEMBERS[(i + turn) % MEMBERS.length]!;
      const p: Point = [u + du * fu, v + dv * fv];
      if (!open(...p) || own.some(([a, b]) => Math.max(Math.abs(a - p[0]), Math.abs(b - p[1])) < 2)) continue;
      const keys = new Set(own.map((q) => key(...at(...q))));
      if (clear(...at(...p), keys)) own.push(p);
    }
    if (own.length < 3) continue;
    own.forEach((p, i) => {
      const [x, y] = at(...p);
      const color = tipOf(...p);
      map.set(key(x, y), { ...map.get(key(x, y))!, deco: 'stalagmite', solid: true, note: (i + turn) % 3, color });
    });
  }
}

/** Kristallbüsche und Felsbrocken (fest, einzeln) und kleine türkise Pfützen (begehbar, ein oder zwei Felder) */
function singles(seed: number, open: Open, at: At, clear: (x: number, y: number) => boolean, map: Map<string, Cell>) {
  const { bush, boulder, puddle } = GROTTE.fill;
  const weight = { rim: [1, 1.6, 0.8], drip: [0.6, 1, 2.5], side: [1, 0.6, 1] } as const;
  for (let v = -ry; v <= ry; v++)
    for (let u = -rx; u <= rx; u++) {
      const c = open(u, v);
      if (!c) continue;
      const [x, y] = at(u, v);
      const [wb, wr, wp] = weight[fillZone(u, v)];
      const roll = rand01(seed, x, y, 99);
      const pick = hash(seed, x, y, 100);
      if (roll < bush * wb + boulder * wr) {
        if (!clear(x, y)) continue;
        const crystal = roll < bush * wb;
        map.set(
          key(x, y),
          crystal
            ? { ...c, deco: 'crystalbush', solid: true, color: GROTTE_COLORS.crystals[pick % 3] }
            : { ...c, deco: 'boulder', solid: true, color: tipOf(u, v) },
        );
      } else if (roll < bush * wb + boulder * wr + puddle * wp && c.h === 1) {
        map.set(key(x, y), { ...c, deco: 'puddle' });
        const next = open(u + 1, v);
        if (pick % 2 && next?.h === 1) map.set(key(...at(u + 1, v)), { ...next, deco: 'puddle' });
      }
    }
}

/**
 * Moos und Farn nur unter den Lichtschächten: bis `GROTTE.fill.shade.r` Felder um ihre Mitte wird freier Grottenboden zu
 * Moos, darauf hier und da Farn (begehbar); nie auf Feldern, die ganz frei bleiben (`keep`: Weg, Gleis, Bahnhof)
 */
export function shadeGrotte(seed: number, site: Site, keep: Keep, map: Map<string, Cell>) {
  const { r, fern } = GROTTE.fill.shade;
  for (const [su, so] of GROTTE.shafts) {
    const sv = so - ry;
    for (let dv = -r; dv <= r; dv++)
      for (let du = -r; du <= r; du++) {
        const d = Math.hypot(du, dv);
        const [u, v] = [su + du, sv + dv];
        const [x, y] = site.at(u, v);
        const c = map.get(key(x, y));
        if (d > r || !plain(c) || keep(u, v)) continue;
        const ferny = d >= 1.5 && rand01(seed, x, y, 101) < fern;
        map.set(key(x, y), { ...c, ground: 'grass', tufts: 0, ...(ferny ? { deco: 'fern' as const } : {}) });
      }
  }
}
