// Füllung der Kristallgrotte – rein und deterministisch: Derselbe Seed ergibt dieselbe Füllung. Was auf der Lichtung
// Bäume und Büsche sind, ist in der Grotte: Stalagmiten-Gruppen (3 bis 5 in drei Höhen, fest wie Bäume, dazwischen
// begehbare Lücken), niedrige leuchtende Kristallbüsche (fest wie ein Busch), Felsbrocken, flache Felsinseln mit Moos
// obenauf (eine Stufe hoch, begehbar), kleine türkise Pfützen und, nur unter den Lichtschächten, Moos und Farn.
// Stalagmiten und Felsbrocken tragen die Farbe ihrer Zone an der Spitze (`tipOf`, `Cell.color`), Kristalle die Farbe
// ihrer Zone (`crystalOf`). Dazu die Fülle (`adornGrotte`, flach und begehbar, nach allem anderen): Kristallfelder,
// Adern im Boden in Rosa oder Lila (`veinOf`, nie Türkis), Leuchtmoos am Fuß der Felswände und unter den Schächten,
// ein kleiner Wasserfall am See. Am Rand
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

type TipZone = keyof typeof GROTTE_COLORS.tips;

/** Die nächste Zone für (u, v) von der Mitte (Abstand zu ihrem Rand) */
function zoneOf(u: number, v: number): TipZone {
  let best = TIP_ZONES[0]!;
  let near = Infinity;
  for (const z of TIP_ZONES) {
    const d = Math.hypot(u - z[1], v - z[2]) - z[3];
    if (d < near) [best, near] = [z, d];
  }
  return best[0];
}

/**
 * Farbe der Spitze eines Stalagmiten oder Felsbrockens bei (u, v) von der Mitte: die der nächsten Zone (Abstand zu ihrem
 * Rand), so hat jede Zone ihre Farbe und die Grotte keine Lücke; der See hat keine (Türkis bleibt dem Wasser), dort und am
 * Ende gilt die Tropfsteingrotte. Nur Rechnen, keine Suche
 */
export const tipOf = (u: number, v: number): string => GROTTE_COLORS.tips[zoneOf(u, v)];

/**
 * Kristallfarbe je Zone: Kristallhalle lila, Tropfsteingrotte (auch am See) rosa, Pilzgarten rosa (zu den bunten Beeten),
 * Lehmhang lila (Ocker läse sich als Gold); nie Türkis, das bleibt dem Wasser
 */
const CRYSTAL_OF: Record<TipZone, string> = (() => {
  const [lila, , rosa] = GROTTE_COLORS.crystals;
  return { hall: lila, drip: rosa, garden: rosa, clay: lila };
})();

/**
 * Farbe der Kristalle der Füllung bei (u, v) von der Mitte (Kristallfelder, Kristallbüsche, verstreute Kristalle): eine
 * je Zone, das hilft beim Orientieren; nie Türkis (ein Kristallfeld liegt flach am Boden und läse sich als Wasser)
 */
export const crystalOf = (u: number, v: number): string => CRYSTAL_OF[zoneOf(u, v)];

/** Farbe der Adern im Boden bei (u, v) von der Mitte: in der Tropfsteingrotte rosa, sonst lila; nie Türkis oder Blau */
export const veinOf = (u: number, v: number): string => GROTTE_COLORS.veins[zoneOf(u, v) === 'drip' ? 1 : 0];

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
            ? { ...c, deco: 'crystalbush', solid: true, color: crystalOf(u, v) }
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
 * Moos, darauf hier und da Farn oder Leuchtmoos (begehbar); nie auf Feldern, die ganz frei bleiben (`keep`: Weg, Gleis,
 * Bahnhof)
 */
export function shadeGrotte(seed: number, site: Site, keep: Keep, map: Map<string, Cell>) {
  const { r, fern, glow } = GROTTE.fill.shade;
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
        const glowy = !ferny && d >= 1.5 && rand01(seed, x, y, 102) < glow; // Leuchtmoos: eigener Wurf, Farn bleibt
        const deco = ferny ? 'fern' : glowy ? 'glowmoss' : undefined;
        map.set(key(x, y), { ...c, ground: 'grass', tufts: 0, ...(deco && { deco }) });
      }
  }
}

/** Die vier Nachbarn in der Reihe von `Cell.note` am Leuchtmoos: 0 Norden, 1 Osten, 2 Süden, 3 Westen */
export const SIDES: readonly Point[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
/** In dieser Reihe sucht das Leuchtmoos seine Wand: zuerst Norden (von der Kamera aus hinten, dort sieht man es wachsen) */
const WALL_FIRST = [0, 1, 3, 2] as const;

/**
 * Die Fülle der Grotte (Schritt 8 der Rückmeldung), nach Füllung, Verstreuen und Moos, nur auf freiem Grottenboden und
 * nie auf Feldern, die frei bleiben (`free`: Wege, Mitte, Spur des Gleises, Bahnhof, Zonen): Kristallfelder, Adern im
 * Boden, Leuchtmoos am Fuß der Felswände (alles flach und begehbar, eigene Würfe je Feld: was schon steht, bleibt, wie es
 * war) und der Wasserfall am See. Nur Rechnen über Raster und Nachbarn, keine Suche
 */
export function adornGrotte(seed: number, site: Site, free: Keep, map: Map<string, Cell>) {
  const at = (u: number, v: number) => site.at(u, v);
  const open = (u: number, v: number) => {
    const c = map.get(key(...at(u, v)));
    return plain(c) && !free(u, v) ? c : null;
  };
  fields(seed, open, at, map);
  veins(seed, open, at, map);
  wallMoss(seed, open, at, map);
  waterfall(site, map);
}

/** Kristallfelder: je Feld des Rasters ein Feld aus 3 bis 6 Feldern niedriger Splitter in der Farbe der Zone, Mitte `note` 1 */
function fields(seed: number, open: Open, at: At, map: Map<string, Cell>) {
  const { every, chance } = GROTTE.fill.fields;
  for (const [u, v] of grid(seed, every, 110)) {
    const mid = open(u, v);
    if (!mid || rand01(seed, u, v, 112) >= chance) continue;
    const color = crystalOf(u, v);
    const want = 3 + (hash(seed, u, v, 113) % 4);
    const turn = hash(seed, u, v, 114);
    const cells: Point[] = [];
    for (let i = 0; i < 8 && cells.length < want - 1; i++) {
      const [du, dv] = RING1[(i + turn) % 8]!;
      if (open(u + du, v + dv)?.h === mid.h) cells.push([u + du, v + dv]);
    }
    if (cells.length < 2) continue;
    map.set(key(...at(u, v)), { ...mid, deco: 'crystalfield', color, note: 1 });
    for (const p of cells) map.set(key(...at(...p)), { ...open(...p)!, deco: 'crystalfield', color, note: 0 }); // eben geprüft
  }
}
/** Die acht Nachbarn, rundherum */
const RING1: readonly Point[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/**
 * Adern im Boden: je Feld des Rasters ein flacher Streifen von `long` Feldern, gerade oder schräg, hier und da um ein
 * Feld versetzt; `note` die Richtung in der Welt (0 waagrecht, 1 senkrecht, 2 fallend, 3 steigend), Farbe nach der Zone
 */
function veins(seed: number, open: Open, at: At, map: Map<string, Cell>) {
  const { every, chance, long } = GROTTE.fill.veins;
  for (const [u0, v0] of grid(seed, every, 120)) {
    if (!open(u0, v0) || rand01(seed, u0, v0, 122) >= chance) continue;
    const color = veinOf(u0, v0);
    const [du, dv] = RING1[hash(seed, u0, v0, 123) % 8]!;
    const length = long[0] + (hash(seed, u0, v0, 124) % (long[1] - long[0] + 1));
    let [u, v] = [u0, v0];
    for (let i = 0; i < length; i++) {
      const c = open(u, v);
      if (!c) break;
      // Richtung in der Welt: vom Feld zum nächsten (die Grotte kann gedreht oder gespiegelt liegen)
      const [x, y] = at(u, v);
      const [nx, ny] = at(u + du, v + dv);
      const [wx, wy] = [nx - x, ny - y];
      const note = wx === 0 ? 1 : wy === 0 ? 0 : wx === wy ? 2 : 3;
      map.set(key(x, y), { ...c, deco: 'vein', color, note });
      [u, v] = [u + du, v + dv];
    }
  }
}

/**
 * Leuchtmoos am Fuß der Felswände: auf dem Anteil `GROTTE.fill.moss.wall` der freien Felder, die an eine Felsklippe
 * stoßen; `note` die Seite der Wand (zuerst Norden), dort wächst es hoch
 */
function wallMoss(seed: number, open: Open, at: At, map: Map<string, Cell>) {
  const { wall } = GROTTE.fill.moss;
  for (let v = -ry; v <= ry; v++)
    for (let u = -rx; u <= rx; u++) {
      const c = open(u, v);
      if (!c) continue;
      const [x, y] = at(u, v);
      if (rand01(seed, x, y, 130) >= wall) continue;
      const side = WALL_FIRST.find((i) => {
        const [dx, dy] = SIDES[i]!;
        const n = map.get(key(x + dx, y + dy));
        return n?.region === 'border' && n.solid;
      });
      if (side !== undefined) map.set(key(x, y), { ...c, deco: 'glowmoss', note: side });
    }
}

/**
 * Der Wasserfall am See: von der Mitte des Sees `GROTTE.waterfall.side` Felder seitlich nach Norden (in der Welt) bis ans
 * Ufer, das erste Feld Grottenboden hinter dem Wasser (Steg und Kristallinsel davor zählen nicht); so fällt das Wasser
 * nach Süden, zur Kamera hin, in den See. Das Feld bleibt Boden (fest), nie Wasser; kein Weg und kein Gleis wird Wasser.
 * Er schneidet nichts ab: Westen, Osten, Norden und die beiden Ecken im Norden sind begehbarer Boden gleicher Höhe, so
 * kommt man oben um ihn herum; sonst die andere Seite oder ein Stück weiter
 */
function waterfall(site: Site, map: Map<string, Cell>) {
  const { lake, waterfall } = GROTTE;
  const [lx, ly] = site.at(lake.across, lake.out - ry);
  const s = waterfall.side;
  for (const dx of [s, -s, s + 2, -s - 2, s - 2, 2 - s, 0]) {
    let wet = false;
    for (let dy = 0; dy <= lake.rx + lake.ry; dy++) {
      const [x, y] = [lx + dx, ly - dy];
      const c = map.get(key(x, y));
      if (c?.ground === 'water') wet = true;
      else if (wet) {
        if (!plain(c) || !AROUND_FALL.every(([ax, ay]) => walkable(map.get(key(x + ax, y + ay)), c.h))) break;
        map.set(key(x, y), { ...c, deco: 'waterfall', solid: true });
        return;
      }
    }
  }
}
/** Nachbarn des Wasserfalls, über die man um ihn herumgeht: Westen, Nordwesten, Norden, Nordosten, Osten (in der Welt) */
const AROUND_FALL: readonly Point[] = [
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
];
/** Begehbarer Grottenboden der Höhe `h` (kein Wasser, nichts Festes) */
const walkable = (c: Cell | undefined, h: number) =>
  !!c && c.region === 'hoehle' && !c.solid && c.ground !== 'water' && c.h === h;
