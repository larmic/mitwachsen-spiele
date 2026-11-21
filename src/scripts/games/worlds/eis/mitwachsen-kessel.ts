// Gletscherkessel hinter dem Eistor (Gegend 'eis') – rein und deterministisch: Derselbe Seed ergibt denselben Kessel.
// Er ist ein langes Gletschertal (`KESSEL.shape`), das vom Ende des Gangs hinter dem Eistor weg nach außen läuft, ganz
// hinter dem Felsring der Lichtung und fern der Ausgänge der anderen Gänge, im selben Koordinatenraum. Ringsum feste
// Eisklippen, der Gang ist der einzige Zugang. Nah an der Mündung das Schneebett (`KESSEL.bed`) mit Schneewiese,
// Eisschale, Wassertrog aus Eis, Iglu und Klangstein, daneben das Eisloch und der Moosfleck; sechs Fischkisten über das
// Tal verteilt; die Plattform des Eis-Portals ganz hinten am Talende (der Heimweg), ihr Gegenstück im Kreis um das Bett;
// vom Tor bis ans Bett die Rutschspur. Lagen darin rechnen vom Schneebett aus. Ringsum Winterlandschaft wie draußen in
// der Eis-Welt (`eisCell`): Hügel in drei Stufen, Tannenhaine, Eisblöcke, dazu Eiskristalle und Schneewehen
// (mitwachsen-frost.ts).
// Teil des Welt-Pakets der Eis-Welt (index.ts), nachgeladen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Gletscherkessel“)

import { fromKey } from '../../../../lib/games/chunks';
import { hash, rand01, valueNoise } from '../../../../lib/games/rng';
import { REGIONS, type Point } from '../../../../data/games/mitwachsen';
import { ICE_ANIMALS, KESSEL } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import { HOMES } from '../../../../data/games/mitwachsen-homes';
import { ICE_PORTAL } from '../../../../data/games/mitwachsen-portals';
import { ICE_STONE } from '../../../../data/games/mitwachsen-stories';
import type { Cell } from '../../mitwachsen-cell';
import { placeHome } from '../../mitwachsen-home';
import type { Beyond, Gang, Kessel, KesselPlace } from '../../mitwachsen-pack-types';
import { PLATFORM_HALF, platformCells, ringSpots, type Portal } from '../../mitwachsen-portal';
import { findSpawns } from '../../mitwachsen-spawns';
import { OBSTACLE_GAP, eisCell } from '../../mitwachsen-world';
import { frost, type Wild } from './mitwachsen-frost';

const key = (x: number, y: number) => `${x},${y}`;
const EIS = REGIONS.find((r) => r.id === 'eis')!; // die Eis-Welt steht fest in REGIONS
const { rx, ry } = KESSEL.shape;
const OUTER = { rx: rx + KESSEL.cliff, ry: ry + KESSEL.cliff }; // fester Außenrand der Klippen
/** Reihe des Schneebetts, gemessen von der Mitte des Tals: `KESSEL.bed` Felder hinter dem inneren Rand an der Mündung */
const BED_V = -ry + KESSEL.bed;
/** Lage (u, v) von der Mitte des Tals für eine Lage [quer, vom Tor weg] vom Schneebett aus */
const fromBed = ([across, out]: readonly [number, number]): Point => [across, BED_V + out];
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Wozu gehört (u, v), gemessen von der Mitte des Tals: Boden innen, Klippe ringsum, sonst nichts. Der Rand innen ist
 * leicht gewellt, aber nur nach innen: So bleiben die Klippen auch an den Enden des langen Tals mindestens
 * `KESSEL.cliff` Felder dick.
 */
function zone(seed: number, u: number, v: number): 'floor' | 'cliff' | null {
  if (!inside(u, v)) return null;
  if (zones.seed !== seed) zones = { seed, grid: new Int8Array(ZONE_W * (2 * OUTER.ry + 1)) };
  const i = (v + OUTER.ry) * ZONE_W + u + OUTER.rx;
  zones.grid[i] ||= (u / rx) ** 2 + (v / ry) ** 2 < 1 - valueNoise(seed + 61, u, v, 5) * WOBBLE ? 1 : 2;
  return zones.grid[i] === 1 ? 'floor' : 'cliff';
}
// Rand je Feld einmal rechnen (der Bau fragt jedes Feld vielfach): 0 offen, 1 Boden, 2 Klippe; für den letzten Seed
const ZONE_W = 2 * (rx + KESSEL.cliff) + 1;
let zones = { seed: NaN, grid: new Int8Array(0) };
/** Liegt (u, v) innerhalb des festen Außenrands der Klippen? */
const inside = (u: number, v: number) => (u / OUTER.rx) ** 2 + (v / OUTER.ry) ** 2 < 1;
/** So weit (Anteil am Quadrat des Radius) wellt sich der Rand innen höchstens nach innen */
const WOBBLE = 0.08;

/**
 * Wo das Tal liegt: so nah wie möglich hinter dem Gang, aber ganz hinter dem Felsring (`beyond`), mit `KESSEL.gap`
 * Feldern Abstand. Geprüft wird die ganze Hülle (Ellipse samt Abstand) an ihrem Rand: Die Lichtung samt Felsring ist
 * eine Ellipse um die Mitte der Welt, die nie in der Hülle liegt; berührt sie die Hülle, dann auch ihren Rand (ebenso
 * die Kreise um die Ausgänge der anderen Gänge, die `beyond` ausspart). Die Lage hängt nicht vom Seed ab, nur vom Gang.
 */
export function placeKessel(_seed: number, gang: Gang, beyond: Beyond): KesselPlace {
  const A = OUTER.rx + KESSEL.gap,
    B = OUTER.ry + KESSEL.gap;
  let centre = gang.end + OUTER.ry;
  const clear = (c: number) => {
    for (let u = -A; u <= A; u++) {
      const h = Math.ceil(B * Math.sqrt(1 - (u / A) ** 2));
      if (!beyond(...gang.at(u, c - h)) || !beyond(...gang.at(u, c + h))) return false;
    }
    for (let v = -B; v <= B; v++) {
      const h = Math.ceil(A * Math.sqrt(1 - (v / B) ** 2));
      if (!beyond(...gang.at(-h, c + v)) || !beyond(...gang.at(h, c + v))) return false;
    }
    return true;
  };
  while (!clear(centre) && centre < gang.end + 400) centre++;
  const cells: Point[] = []; // Boden und Klippen: alles innerhalb des festen Außenrands (wie `zone`, ohne Rauschen)
  for (let v = -OUTER.ry; v <= OUTER.ry; v++)
    for (let u = -OUTER.rx; u <= OUTER.rx; u++) if (inside(u, v)) cells.push(gang.at(u, centre + v));
  return { bed: gang.at(0, centre + BED_V), centre, cells };
}

const snow = (h: number): Cell => ({ h, ground: 'snow', deco: null, region: 'eis', solid: false, biome: 'eis' });
/** Eisklippe: fest wie der Felsring (nicht zu betreten); antwortet wie Fels mit Wackeln und „boing“ */
const cliff = (h: number): Cell => ({ h, ground: 'ice', deco: 'rock', region: 'border', solid: true, biome: 'eis' });

/**
 * Den Kessel in die Karte der festen Felder bauen (`map`, dort liegt schon der Gang durch den Felsring): Gang bis zum
 * Kessel verlängern, Klippen, Boden, Zuhause, Eisloch und Rutschspur. `passage` liefert ein Feld des Gangs.
 */
export function buildKessel(
  seed: number,
  gang: Gang,
  beyond: Beyond,
  passage: (x: number, y: number) => Cell,
  map: Map<string, Cell>,
): Kessel {
  const place = placeKessel(seed, gang, beyond);
  const { centre } = place;
  const set = (x: number, y: number, c: Cell) => map.set(key(x, y), c);
  // Gang bis an die Klippen verlängern: Boden in der Mitte, daneben Eiswände
  for (let t = gang.end + 1; t <= centre - OUTER.ry; t++)
    for (let u = -gang.half - gang.wall; u <= gang.half + gang.wall; u++)
      set(...gang.at(u, t), Math.abs(u) <= gang.half ? passage(...gang.at(u, t)) : cliff(3));
  const free = keepFree(seed, gang, place);
  const realm = land(seed, gang, place, free, passage, set);
  home(gang, place, set);
  forage(gang, place, map);
  const portal = platforms(gang, place, map);
  for (const [x, y] of slidePath(gang, place.bed, map)) {
    // Tannen auf der Spur und bis zwei Felder daneben weichen, die Spur bleibt frei
    for (const [dx, dy] of NEAR_2) {
      const n = map.get(key(x + dx, y + dy));
      if (n?.tree === 'snowpine') set(x + dx, y + dy, unpine(n));
    }
    const c = map.get(key(x, y))!; // die Spur läuft nur über gebaute Felder
    set(x, y, { ...c, h: c.region === 'eis' ? 1 : c.h, slide: true }); // im Kessel eben
  }
  level(place.cells, map);
  frost(seed, winter(seed, gang, place, free, map), map); // Kristalle und Schneewehen nach Tannen und Eisblöcken
  // Eis-Welt: der ganze Kessel und der Gang ab seiner Mitte (dort wechselt auch die Tieranzeige)
  let inner = gang.depth + 1;
  while (map.get(key(...gang.at(0, inner)))?.region !== 'eis' && inner < centre) inner++;
  for (let t = gang.depth + 1 + Math.floor((inner - gang.depth - 1) / 2); t < centre; t++)
    for (let u = -gang.half - gang.wall; u <= gang.half + gang.wall; u++) realm.add(key(...gang.at(u, t)));
  const stone: Point = [place.bed[0] + ICE_STONE[0], place.bed[1] + ICE_STONE[1]];
  const spots = spotsOf(place, map);
  const spawns = findSpawns(seed, { ...EIS, animals: ICE_ANIMALS }, spots, place.bed); // Wunschorte nur hier
  return { bed: place.bed, realm, spots, spawns, stone, portal: [ICE_PORTAL, portal] };
}

/**
 * Klippen und Boden des Kessels setzen; durch die Klippen auf der Seite des Tors führt der Gang (die Mündung).
 * Liefert alle Felder des Kessels (für `realm`).
 */
function land(
  seed: number,
  gang: Gang,
  place: KesselPlace,
  free: (u: number, v: number) => boolean,
  passage: (x: number, y: number) => Cell,
  set: (x: number, y: number, c: Cell) => void,
): Set<string> {
  const realm = new Set<string>();
  const wet = icePatches(seed, gang, place, free);
  const pines = new Set<string>(); // Tannen (als u,v), sie stehen einzeln wie die Bäume der Lichtung
  /** Darf bei (u, v) eine Tanne stehen? Ringsum zwei Felder Boden (keine Nischen an der Klippe), keine Tanne nah */
  const pineFits = (u: number, v: number) => {
    for (let dv = -OBSTACLE_GAP; dv <= OBSTACLE_GAP; dv++)
      for (let du = -OBSTACLE_GAP; du <= OBSTACLE_GAP; du++)
        if (zone(seed, u + du, v + dv) !== 'floor' || pines.has(key(u + du, v + dv))) return false;
    return true;
  };
  for (let v = -OUTER.ry; v <= OUTER.ry; v++)
    for (let u = -OUTER.rx; u <= OUTER.rx; u++) {
      const z = zone(seed, u, v);
      if (!z) continue;
      const [x, y] = gang.at(u, place.centre + v);
      realm.add(key(x, y));
      if (z === 'cliff') {
        set(x, y, v < 0 && Math.abs(u) <= gang.half ? passage(x, y) : cliffCell(seed, u, v, x, y));
        continue;
      }
      const c = floorCell(seed, place.bed, x, y, free(u, v) ? null : wet(u, v), pineFits(u, v));
      if (c.deco === 'tree') pines.add(key(u, v));
      set(x, y, c);
    }
  return realm;
}

/** Eisklippe in Terrassen: innen 3, dann 4, außen 5, hier und da ein Block höher */
function cliffCell(seed: number, u: number, v: number, x: number, y: number): Cell {
  const o = (u / OUTER.rx) ** 2 + (v / OUTER.ry) ** 2;
  return cliff((o < 0.75 ? 3 : o < 0.87 ? 4 : 5) + (hash(seed, x, y, 62) % 6 === 0 ? 1 : 0));
}

/** Höhe des Kessel-Bodens vor dem Ebnen: Hügel in drei Stufen */
const hill = (seed: number, x: number, y: number) => {
  const n = valueNoise(seed + 63, x, y, 7);
  return n < 0.53 ? 1 : n < 0.74 ? 2 : 3;
};
/** Rauschen der Tannenhaine (Hain über `GROVE`) */
const grove = (seed: number, x: number, y: number) => valueNoise(seed + 65, x, y, 9);
const GROVE = 0.62;
/**
 * So viele Schneetannen und Eisblöcke hat jeder Kessel mindestens (fehlen welche, wachsen sie nach). Im Hain stehen die
 * Tannen dichter als draußen (dort 3 %, `OBSTACLE_GAP` dünnt aus): So wird das weite Tal nicht leer, etwa 5 Dinge je
 * 100 Felder.
 */
export const KESSEL_WILDS = { pines: 4, blocks: 2, patches: 2, patchR: 2.2 } as const;

/**
 * Boden im Kessel wie die Eis-Welt draußen (`eisCell`): Schnee mit Hügeln in drei Stufen, kleine Eisflächen (`wet` aus
 * `icePatches`), Tannenhaine (Schneetannen 10 % im Hain, sonst 0,8 %); um das Bett eben. Wo der Kessel frei bleibt
 * (`wet` null), wachsen keine Tannen; Tannen nur, wo Platz ist (`pine`). Eisblöcke setzt erst `winter`.
 */
function floorCell(seed: number, bed: Point, x: number, y: number, wet: number | null, pine: boolean): Cell {
  if (Math.hypot(x - bed[0], y - bed[1]) <= KESSEL.flat) return snow(1);
  const pines = wet === null || !pine ? 0 : grove(seed, x, y) > GROVE ? 0.1 : 0.008;
  return eisCell(snow(hill(seed, x, y)), wet ?? 1, rand01(seed, x, y, 66), pines, 0);
}

/**
 * Ein, zwei kleine Eisflächen (Radius `patchR`) auf ebenem Grund (Höhe 1) außerhalb dessen, was frei bleibt, mindestens
 * zehn Felder voneinander. Liefert das `wet` für `eisCell`: unter 0,2 genau auf einer Eisfläche.
 */
function icePatches(seed: number, gang: Gang, place: KesselPlace, free: (u: number, v: number) => boolean) {
  const { patches, patchR } = KESSEL_WILDS;
  // je Feld einmal: Boden auf Höhe 1? (nur dort wird `eisCell` zu Eis; der Boden liegt ganz in rx × ry)
  const W = 2 * rx + 5;
  const low = new Uint8Array(W * (2 * ry + 5));
  for (let v = -ry; v <= ry; v++)
    for (let u = -rx; u <= rx; u++)
      if (zone(seed, u, v) === 'floor' && hill(seed, ...gang.at(u, place.centre + v)) === 1)
        low[(v + ry + 2) * W + u + rx + 2] = 1;
  /** Wie eben ist es um (u, v): so viele der 5 × 5 Felder sind Boden auf Höhe 1 */
  const flat = (u: number, v: number) => {
    let n = 0;
    for (let dv = -2; dv <= 2; dv++)
      for (let du = -2; du <= 2; du++) n += low[(v + dv + ry + 2) * W + u + du + rx + 2] ?? 0;
    return n;
  };
  const spots: { p: Point; n: number }[] = [];
  for (let v = -ry; v <= ry; v++)
    for (let u = -rx; u <= rx; u++)
      if (!free(u, v) && zone(seed, u, v) === 'floor') spots.push({ p: [u, v], n: flat(u, v) });
  // die ebensten Stellen zuerst (ganz ebene unter sich gewürfelt), mindestens halb eben
  spots.sort((a, b) => b.n - a.n || hash(seed, ...a.p, 67) - hash(seed, ...b.p, 67));
  const centres: Point[] = [];
  for (const { p, n } of spots)
    if (n >= 13 && centres.length < patches && centres.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 10))
      centres.push(p);
  return (u: number, v: number) => Math.min(1, ...centres.map(([a, b]) => (Math.hypot(u - a, v - b) / patchR) * 0.2));
}

/**
 * Nach dem Ebnen: Eisblöcke zum Klettern (1 %, eine Stufe höher, nur wo alle vier Nachbarn mindestens so hoch sind, so
 * bleiben sie Blöcke und nie mehr als eine Stufe; nie auf Höhe 3, nicht an der Spur) und so viele Tannen und Eisblöcke
 * nachgepflanzt, dass jeder Kessel `KESSEL_WILDS` hat: Tannen dort, wo der Hain am dichtesten ist. Liefert die Felder,
 * auf denen so etwas wachsen darf (für Kristalle und Schneewehen).
 */
function winter(
  seed: number,
  gang: Gang,
  place: KesselPlace,
  free: (u: number, v: number) => boolean,
  map: Map<string, Cell>,
): Wild[] {
  const at = (x: number, y: number) => map.get(key(x, y));
  const wild: { x: number; y: number; u: number; v: number }[] = [];
  for (let v = -ry; v <= ry; v++)
    for (let u = -rx; u <= rx; u++)
      if (zone(seed, u, v) === 'floor' && !free(u, v)) {
        const [x, y] = gang.at(u, place.centre + v);
        wild.push({ x, y, u, v });
      }
  const slideNear = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (at(x + dx, y + dy)?.slide) return true;
    return false;
  };
  const bare = (c: Cell | undefined): c is Cell =>
    !!c && c.region === 'eis' && !c.solid && c.ground === 'snow' && !c.slide && !c.garden && !c.portal;
  const blockFits = (x: number, y: number) => {
    const c = at(x, y);
    return (
      bare(c) &&
      c.h <= 2 &&
      !slideNear(x, y, 1) &&
      NEIGHBOURS.every(([dx, dy]) => {
        const n = at(x + dx, y + dy);
        return !!n && n.region === 'eis' && n.ground !== 'water' && n.h >= c.h;
      })
    );
  };
  const pineFits = ({ x, y, u, v }: (typeof wild)[number]) => {
    if (!bare(at(x, y)) || slideNear(x, y, 2)) return false;
    for (let dv = -OBSTACLE_GAP; dv <= OBSTACLE_GAP; dv++)
      for (let du = -OBSTACLE_GAP; du <= OBSTACLE_GAP; du++) {
        const n = at(...gang.at(u + du, place.centre + v + dv));
        if (zone(seed, u + du, v + dv) !== 'floor' || !n || n.deco === 'tree') return false;
      }
    return true;
  };
  const raise = (x: number, y: number) => {
    const c = at(x, y)!; // nur geprüfte Felder
    map.set(key(x, y), { ...c, ground: 'ice', h: c.h + 1 });
  };
  const roll = (x: number, y: number) => rand01(seed, x, y, 68);
  let blocks = 0;
  for (const { x, y } of wild)
    if (roll(x, y) < 0.01 && blockFits(x, y)) {
      raise(x, y);
      blocks++;
    }
  for (const { x, y } of [...wild].sort((a, b) => roll(a.x, a.y) - roll(b.x, b.y))) {
    if (blocks >= KESSEL_WILDS.blocks) break;
    if (!blockFits(x, y)) continue;
    raise(x, y);
    blocks++;
  }
  let pines = wild.filter(({ x, y }) => at(x, y)?.tree === 'snowpine').length;
  for (const w of [...wild].sort((a, b) => grove(seed, b.x, b.y) - grove(seed, a.x, a.y))) {
    if (pines >= KESSEL_WILDS.pines) break;
    if (!pineFits(w)) continue;
    const c = at(w.x, w.y)!; // pineFits prüft das Feld
    map.set(key(w.x, w.y), { ...c, deco: 'tree', solid: true, tree: 'snowpine' });
    pines++;
  }
  return wild;
}

/**
 * Was im Tal frei bleibt (keine Tannen, keine Eisblöcke), gemessen in (u, v) von der Mitte: die Mündung, das Bett
 * mit Schneewiese, das Gegenstück des Eis-Portals im Kreis um das Bett, das Ufer des Eislochs, das Umfeld der
 * Fischkisten, der Moosfleck und die Plattform am Talende. Die Rutschspur hält `buildKessel` frei.
 */
function keepFree(seed: number, gang: Gang, { centre, bed }: KesselPlace) {
  const { hole, moss } = KESSEL;
  const [hu, hv] = fromBed([hole.across, hole.out]);
  const [mu, mv] = fromBed([moss.across, moss.out]);
  const portal = fromBed(KESSEL.portal);
  const crates = KESSEL.crates.map(fromBed);
  const ringPortal: Point = [0, BED_V - HOMES.eis.portalRing]; // Gegenstück im Kreis um das Bett, Richtung Tor
  // Die Mündung: sechs Reihen ab dem ersten Bodenfeld vor dem Gang (der Rand ist gewellt, darum gemessen)
  let mouth = -OUTER.ry;
  for (let u = -gang.half - 3; u <= gang.half + 3; u++) {
    let v = -OUTER.ry;
    while (v < 0 && zone(seed, u, v) !== 'floor') v++;
    mouth = Math.max(mouth, v);
  }
  return (u: number, v: number) => {
    const [x, y] = gang.at(u, centre + v);
    if (Math.hypot(x - bed[0], y - bed[1]) <= KESSEL.flat + 2) return true;
    if (Math.abs(u) <= gang.half + 3 && v < mouth + 6) return true;
    if (Math.hypot(u - hu, v - hv) <= hole.r + 4) return true;
    if (Math.hypot(u - mu, v - mv) <= moss.r + 2) return true;
    const near = ([a, b]: readonly [number, number], r: number) => Math.max(Math.abs(u - a), Math.abs(v - b)) <= r;
    return near(portal, PLATFORM_HALF + 3) || near(ringPortal, PLATFORM_HALF + 3) || crates.some((p) => near(p, 3));
  };
}

/** Lage (u, t) im Gang-Raster für eine Lage [quer, vom Tor weg] vom Schneebett aus */
const uv = (centre: number, p: readonly [number, number]): Point => {
  const [u, v] = fromBed(p);
  return [u, centre + v];
};

/** Eine Tanne weicht: Schnee auf derselben Höhe */
const unpine = (c: Cell): Cell => ({ ...c, deco: null, solid: false, tree: undefined });

/** Ein Feld und alle Felder bis zwei weit */
const NEAR_2 = [-2, -1, 0, 1, 2].flatMap((dy) => [-2, -1, 0, 1, 2].map((dx) => [dx, dy] as const));

/**
 * Keine Stufe höher als eins (wie `smooth` auf der Lichtung): Boden des Kessels wird nur abgesenkt; das ebene Bett,
 * die Wiese, die Spur, die Kisten und das Ufer ziehen die Hügel ringsum herunter
 */
function level(cells: readonly Point[], map: Map<string, Cell>) {
  const land = (c: Cell | undefined) => !!c && !c.solid && c.ground !== 'water';
  let changed = true;
  while (changed) {
    changed = false;
    for (const [x, y] of cells) {
      let c = map.get(key(x, y));
      if (!land(c) || c!.region !== 'eis') continue;
      for (const [dx, dy] of NEIGHBOURS) {
        const n = map.get(key(x + dx, y + dy));
        if (!land(n) || c!.h <= n!.h + 1) continue;
        map.set(key(x, y), (c = { ...c!, h: n!.h + 1 }));
        changed = true;
      }
    }
  }
}

/** Zuhause im Tal: Schneebett, Schneewiese mit Eisschale und Wassertrog, Iglu mit fester Rückwand, Eisloch */
function home(gang: Gang, { bed, centre }: KesselPlace, set: (x: number, y: number, c: Cell) => void) {
  const h = placeHome('eis', bed);
  const r = h.meadow;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (Math.hypot(dx, dy) <= r + 0.5) set(bed[0] + dx, bed[1] + dy, { ...snow(1), garden: true });
  const fixed = (deco: Cell['deco']): Cell => ({ ...snow(1), garden: true, deco, solid: true });
  set(...bed, { ...snow(1), deco: 'bed', solid: true });
  set(...h.food, fixed('icebowl'));
  set(...h.water, fixed('watertrough'));
  const [sx, sy] = [bed[0] + ICE_STONE[0], bed[1] + ICE_STONE[1]]; // Klangstein mit der Eis-Geschichte, wenn das Tor offen ist
  set(sx, sy, { ...fixed('klangstein'), story: 'eis-offen' });
  const { x0, y0, x1, y1 } = h.shelter;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, { ...snow(1), garden: true, roof: true });
  for (let x = x0; x <= x1; x++) set(x, y0 - 1, fixed('igloo')); // Rückwand, die Mitte ist `shelterStem`
  // Eisloch: Wasser zum Schöpfen, ringsum ebenes Ufer
  const { across, out, r: hr } = KESSEL.hole;
  const [hx, hy] = gang.at(...uv(centre, [across, out]));
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= hr) set(hx + dx, hy + dy, { ...snow(0), ground: 'water' });
      else if (d <= hr + 2) set(hx + dx, hy + dy, snow(1));
    }
}

/**
 * Futter im Tal: sechs Fischkisten (fest wie ein Busch; einzeln, ringsum ebener Schnee) und ein Moosfleck als
 * Kulisse (grünes Moos unter dem Schnee, begehbar)
 */
function forage(gang: Gang, { centre }: KesselPlace, map: Map<string, Cell>) {
  const { across, out, r } = KESSEL.moss;
  const [mu, mv] = uv(centre, [across, out]);
  for (let dv = -2; dv <= 2; dv++)
    for (let du = -2; du <= 2; du++) {
      const [x, y] = gang.at(mu + du, mv + dv);
      const c = map.get(key(x, y));
      if (c?.region === 'eis' && !c.solid && Math.hypot(du, dv) <= r) map.set(key(x, y), { ...c, ground: 'grass' });
    }
  for (const crate of KESSEL.crates) {
    const [u, t] = uv(centre, crate);
    for (let dv = -1; dv <= 1; dv++) for (let du = -1; du <= 1; du++) map.set(key(...gang.at(u + du, t + dv)), snow(1));
    map.set(key(...gang.at(u, t)), { ...snow(1), deco: 'fishcrate', solid: true });
  }
}

/**
 * Die beiden Plattformen des Eis-Portals (3 × 3, flach, ringsum zwei Felder ebener Schnee): ganz hinten am Talende
 * und im Kreis um das Schneebett (`HOMES.eis.portalRing`) in Richtung des Tors. Es erwacht, sobald die
 * Figur am Schneebett ankommt (`bed`).
 */
function platforms(gang: Gang, { bed, centre }: KesselPlace, map: Map<string, Cell>): Portal {
  const [mx, my] = gang.at(0, gang.depth);
  const [home] = ringSpots([Math.atan2(my - bed[1], mx - bed[0])], HOMES.eis.portalRing, bed);
  const portal: Portal = { gate: gang.at(...uv(centre, KESSEL.portal)), home: home!, bed };
  for (const side of ['gate', 'home'] as const) {
    const [cx, cy] = portal[side];
    const ring = PLATFORM_HALF + 1;
    for (let dy = -ring; dy <= ring; dy++)
      for (let dx = -ring; dx <= ring; dx++)
        if (plain(map.get(key(cx + dx, cy + dy)))) map.set(key(cx + dx, cy + dy), snow(1));
    for (const { x, y, at } of platformCells([cx, cy]))
      map.set(key(x, y), {
        ...snow(1),
        deco: at === 'centre' ? 'portal' : 'portalrim',
        portal: { id: ICE_PORTAL, side, at },
      });
  }
  return portal;
}

/** Schneeboden des Kessels ohne Bau darauf (Tannen weichen): Nur ihn ebnen die Plattformen, Wiese, Kisten und Klippen bleiben */
const plain = (c: Cell | undefined) =>
  c?.region === 'eis' && !c.garden && ((!c.deco && !c.solid) || c.tree === 'snowpine');

const stand = (map: ReadonlyMap<string, Cell>, x: number, y: number) => {
  const c = map.get(key(x, y));
  return !!c && !c.solid && !c.gate && c.ground !== 'water';
};

/**
 * Rutschspur: vom ersten Feld hinter dem Tor gerade durch den Gang, dann auf kürzestem Weg bis neben das Schneebett
 * (Breitensuche, bevorzugt in Richtung Bett). Durchgehend begehbar.
 */
function slidePath(gang: Gang, bed: Point, map: ReadonlyMap<string, Cell>): Point[] {
  const straight: Point[] = [];
  for (let t = gang.depth + 1; t <= gang.end; t++) straight.push(gang.at(0, t));
  const start = gang.at(0, gang.end + 1);
  const goal = new Set(NEIGHBOURS.map(([dx, dy]) => key(bed[0] + dx, bed[1] + dy)));
  const from = new Map<string, string>([[key(...start), '']]);
  const queue: Point[] = [start];
  const toBed = (x: number, y: number) => Math.hypot(x - bed[0], y - bed[1]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (goal.has(key(x, y))) {
      const path: Point[] = [];
      for (let k = key(x, y); k; k = from.get(k) ?? '') path.unshift(fromKey(k));
      return [...straight, ...path];
    }
    const next = NEIGHBOURS.map(([dx, dy]): Point => [x + dx, y + dy]).sort((a, b) => toBed(...a) - toBed(...b));
    for (const [nx, ny] of next) {
      const k = key(nx, ny);
      const pine = map.get(k)?.tree === 'snowpine'; // Tannen weichen der Spur (sie läuft wie im Kessel ohne Tannen)
      if (from.has(k) || !(pine || stand(map, nx, ny)) || map.get(k)!.portal) continue; // weicht den Plattformen aus
      from.set(k, key(x, y));
      queue.push([nx, ny]);
    }
  }
  return straight;
}

/**
 * Wohnplätze der Eis-Tiere: vom Schneebett aus erreichbare Felder des Kessels außerhalb der Schneewiese und der
 * Portal-Plattformen, nicht in der Mündung (zwei Felder Abstand zum Gang, so versperrt kein Tier den Weg hinein)
 */
function spotsOf({ bed }: KesselPlace, map: ReadonlyMap<string, Cell>): Point[] {
  const seen = new Set<string>();
  const queue = placeHome('eis', bed).wake.filter(([x, y]) => stand(map, x, y));
  for (const [x, y] of queue) seen.add(key(x, y));
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const c = map.get(key(x, y))!; // nur Felder, auf denen man steht, kommen in die Liste
    for (const [dx, dy] of NEIGHBOURS) {
      const k = key(x + dx, y + dy);
      const n = map.get(k);
      if (seen.has(k) || !stand(map, x + dx, y + dy) || n!.h - c.h > 1) continue; // eine Stufe hinauf, herunter immer
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  // Mündung: bis zwei Felder um den Gang (begehbar außerhalb des Kessels; hinter den dicken Klippen liegt nichts nah)
  const mouth = new Set<string>();
  for (const [x, y] of queue)
    if (map.get(key(x, y))!.region !== 'eis') for (const [dx, dy] of NEAR_2) mouth.add(key(x + dx, y + dy));
  return queue.filter(([x, y]) => {
    const c = map.get(key(x, y))!;
    return c.region === 'eis' && !c.garden && !c.portal && !mouth.has(key(x, y));
  });
}
