// Gletscherkessel hinter dem Eistor (Gegend 'eis') – rein und deterministisch: Derselbe Seed ergibt denselben Kessel.
// Er liegt fest am Ende des Gangs hinter dem Eistor, ganz hinter dem Felsring der Lichtung, im selben Koordinatenraum.
// Ringsum feste Eisklippen, der Gang ist der einzige Zugang. In der Mitte das Schneebett mit Schneewiese, Eisschale,
// Wassertrog aus Eis, Iglu und Klangstein, seitlich das Eisloch, drei Fischkisten, ein Moosfleck, die beiden
// Plattformen des Eis-Portals (hinter der Mündung und im Kreis um das Bett), vom Tor bis ans Bett die Rutschspur.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt“, Kessel)

import { fromKey } from '../../lib/games/chunks';
import { hash, valueNoise } from '../../lib/games/rng';
import type { Point } from '../../data/games/mitwachsen';
import { KESSEL } from '../../data/games/mitwachsen-eis';
import { HOMES } from '../../data/games/mitwachsen-homes';
import { ICE_PORTAL } from '../../data/games/mitwachsen-portals';
import { ICE_STONE } from '../../data/games/mitwachsen-stories';
import type { Cell } from './mitwachsen-cell';
import { placeHome } from './mitwachsen-home';
import { PLATFORM_HALF, platformCells, ringSpots, type Portal, type PortalId } from './mitwachsen-portal';

/** Gang hinter einem Tor, in Koordinaten u (entlang des Tors) und t (nach außen) */
export type Gang = {
  at: (u: number, t: number) => Point;
  depth: number; // t der Torreihe
  end: number; // letzte Reihe des Gangs durch den Felsring
  half: number; // Boden des Gangs: u von −half bis half
  wall: number; // daneben auf jeder Seite so viele Felder Wand
};

/** Lage des Kessels: Mitte (dort steht das Schneebett) und alle Felder samt Klippen */
export type KesselPlace = { bed: Point; centre: number; cells: readonly Point[] };

/**
 * Der gebaute Kessel: Bett, Felder der Eis-Welt (Kessel und Gang ab der Mitte), Wohnplätze ihrer Tiere, Klangstein und
 * das Eis-Portal (als Eintrag für `world.portals`)
 */
export type Kessel = {
  bed: Point;
  realm: ReadonlySet<string>;
  spots: readonly Point[];
  stone: Point;
  portal: [PortalId, Portal];
};

const key = (x: number, y: number) => `${x},${y}`;
const { rx, ry } = KESSEL.shape;
const OUTER = { rx: rx + KESSEL.cliff, ry: ry + KESSEL.cliff }; // fester Außenrand der Klippen
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Wozu gehört (u, v), gemessen von der Mitte des Kessels: Boden innen, Klippe ringsum (Rand leicht gewellt), sonst nichts */
function zone(seed: number, u: number, v: number): 'floor' | 'cliff' | null {
  if ((u / OUTER.rx) ** 2 + (v / OUTER.ry) ** 2 >= 1) return null;
  const wobble = 1 + (valueNoise(seed + 61, u, v, 5) - 0.5) * 0.2;
  return (u / rx) ** 2 + (v / ry) ** 2 < wobble ? 'floor' : 'cliff';
}

/**
 * Wo der Kessel liegt: so nah wie möglich hinter dem Gang, aber ganz hinter dem Felsring (`beyond`), mit `KESSEL.gap`
 * Feldern Abstand. Weiter nach außen bleibt man jenseits des Felsrings, darum genügt je Spalte das innerste Feld.
 */
export function placeKessel(seed: number, gang: Gang, beyond: (x: number, y: number) => boolean): KesselPlace {
  const A = OUTER.rx + KESSEL.gap,
    B = OUTER.ry + KESSEL.gap;
  let centre = gang.end + OUTER.ry;
  const clear = (c: number) => {
    for (let u = -A; u <= A; u++)
      if (!beyond(...gang.at(u, c - Math.ceil(B * Math.sqrt(1 - (u / A) ** 2))))) return false;
    return true;
  };
  while (!clear(centre) && centre < gang.end + 400) centre++;
  const cells: Point[] = [];
  for (let v = -OUTER.ry; v <= OUTER.ry; v++)
    for (let u = -OUTER.rx; u <= OUTER.rx; u++) if (zone(seed, u, v)) cells.push(gang.at(u, centre + v));
  return { bed: gang.at(0, centre), centre, cells };
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
  beyond: (x: number, y: number) => boolean,
  passage: (x: number, y: number) => Cell,
  map: Map<string, Cell>,
): Kessel {
  const place = placeKessel(seed, gang, beyond);
  const { centre } = place;
  const realm = new Set<string>();
  const set = (x: number, y: number, c: Cell) => map.set(key(x, y), c);
  // Gang bis an die Klippen verlängern: Boden in der Mitte, daneben Eiswände
  for (let t = gang.end + 1; t <= centre - OUTER.ry; t++)
    for (let u = -gang.half - gang.wall; u <= gang.half + gang.wall; u++)
      set(...gang.at(u, t), Math.abs(u) <= gang.half ? passage(...gang.at(u, t)) : cliff(3));
  // Klippen und Boden; durch die Klippen auf der Seite des Tors führt der Gang (die Mündung)
  for (let v = -OUTER.ry; v <= OUTER.ry; v++)
    for (let u = -OUTER.rx; u <= OUTER.rx; u++) {
      const z = zone(seed, u, v);
      if (!z) continue;
      const [x, y] = gang.at(u, centre + v);
      realm.add(key(x, y));
      const mouth = z === 'cliff' && v < 0 && Math.abs(u) <= gang.half;
      set(x, y, mouth ? passage(x, y) : z === 'cliff' ? cliffCell(seed, u, v, x, y) : floorCell(seed, place.bed, x, y));
    }
  home(gang, place, set);
  forage(gang, place, map);
  const portal = platforms(gang, place, map);
  const slide = slidePath(gang, place.bed, map);
  for (const [x, y] of slide) {
    const c = map.get(key(x, y))!; // die Spur läuft nur über gebaute Felder
    set(x, y, { ...c, h: c.region === 'eis' ? 1 : c.h, slide: true }); // im Kessel eben
  }
  // Eis-Welt: der ganze Kessel und der Gang ab seiner Mitte (dort wechselt auch die Tieranzeige)
  let inner = gang.depth + 1;
  while (map.get(key(...gang.at(0, inner)))?.region !== 'eis' && inner < centre) inner++;
  for (let t = gang.depth + 1 + Math.floor((inner - gang.depth - 1) / 2); t < centre; t++)
    for (let u = -gang.half - gang.wall; u <= gang.half + gang.wall; u++) realm.add(key(...gang.at(u, t)));
  const stone: Point = [place.bed[0] + ICE_STONE[0], place.bed[1] + ICE_STONE[1]];
  return { bed: place.bed, realm, spots: spotsOf(place, map), stone, portal: [ICE_PORTAL, portal] };
}

/** Eisklippe in Terrassen: innen 3, dann 4, außen 5, hier und da ein Block höher */
function cliffCell(seed: number, u: number, v: number, x: number, y: number): Cell {
  const o = (u / OUTER.rx) ** 2 + (v / OUTER.ry) ** 2;
  return cliff((o < 0.75 ? 3 : o < 0.87 ? 4 : 5) + (hash(seed, x, y, 62) % 6 === 0 ? 1 : 0));
}

/** Boden im Kessel: Schnee mit sanften Hügeln (nie mehr als eine Stufe) und Eisflächen; um das Bett eben */
function floorCell(seed: number, bed: Point, x: number, y: number): Cell {
  if (Math.hypot(x - bed[0], y - bed[1]) <= KESSEL.flat) return snow(1);
  const c = snow(valueNoise(seed + 63, x, y, 7) > 0.62 ? 2 : 1);
  return valueNoise(seed + 64, x, y, 6) < 0.2 ? { ...c, ground: 'ice' } : c;
}

/** Zuhause im Kessel: Schneebett, Schneewiese mit Eisschale und Wassertrog, Iglu mit fester Rückwand, Eisloch */
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
  const [hx, hy] = gang.at(across, centre + out);
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= hr) set(hx + dx, hy + dy, { ...snow(0), ground: 'water' });
      else if (d <= hr + 2) set(hx + dx, hy + dy, snow(1));
    }
}

/**
 * Futter im Kessel: drei Fischkisten (fest wie ein Busch; einzeln, ringsum ebener Schnee) und ein Moosfleck als
 * Kulisse (grünes Moos unter dem Schnee, begehbar)
 */
function forage(gang: Gang, { centre }: KesselPlace, map: Map<string, Cell>) {
  const { across, out, r } = KESSEL.moss;
  for (let dv = -2; dv <= 2; dv++)
    for (let du = -2; du <= 2; du++) {
      const [x, y] = gang.at(across + du, centre + out + dv);
      const c = map.get(key(x, y));
      if (c?.region === 'eis' && !c.solid && Math.hypot(du, dv) <= r) map.set(key(x, y), { ...c, ground: 'grass' });
    }
  for (const [u, v] of KESSEL.crates) {
    for (let dv = -1; dv <= 1; dv++)
      for (let du = -1; du <= 1; du++) map.set(key(...gang.at(u + du, centre + v + dv)), snow(1));
    map.set(key(...gang.at(u, centre + v)), { ...snow(1), deco: 'fishcrate', solid: true });
  }
}

/**
 * Die beiden Plattformen des Eis-Portals (3 × 3, flach, ringsum zwei Felder ebener Schnee): gleich hinter der
 * Gangmündung und im Kreis um das Schneebett (`HOMES.eis.portalRing`) in Richtung des Tors. Es erwacht, sobald die
 * Figur am Schneebett ankommt (`bed`).
 */
function platforms(gang: Gang, { bed, centre }: KesselPlace, map: Map<string, Cell>): Portal {
  const [mx, my] = gang.at(0, gang.depth);
  const [home] = ringSpots([Math.atan2(my - bed[1], mx - bed[0])], HOMES.eis.portalRing, bed);
  const portal: Portal = { gate: gang.at(KESSEL.portal[0], centre + KESSEL.portal[1]), home: home!, bed };
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

/** Schneeboden des Kessels ohne Bau darauf: Nur ihn ebnen die Plattformen, Wiese, Kisten und Klippen bleiben */
const plain = (c: Cell | undefined) => c?.region === 'eis' && !c.deco && !c.garden && !c.solid;

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
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (goal.has(key(x, y))) {
      const path: Point[] = [];
      for (let k = key(x, y); k; k = from.get(k) ?? '') path.unshift(fromKey(k));
      return [...straight, ...path];
    }
    const next = NEIGHBOURS.map(([dx, dy]): Point => [x + dx, y + dy]).sort((a, b) => toBed(...a) - toBed(...b));
    for (const [nx, ny] of next) {
      const k = key(nx, ny);
      if (from.has(k) || !stand(map, nx, ny) || map.get(k)!.portal) continue; // die Spur weicht den Plattformen aus
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
  const out: Point[] = [];
  const mouth = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (stand(map, x + dx, y + dy) && map.get(key(x + dx, y + dy))!.region !== 'eis') return true;
    return false;
  };
  const seen = new Set<string>();
  const queue = placeHome('eis', bed).wake.filter(([x, y]) => stand(map, x, y));
  for (const [x, y] of queue) seen.add(key(x, y));
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const c = map.get(key(x, y))!; // nur Felder, auf denen man steht, kommen in die Liste
    if (c.region === 'eis' && !c.garden && !c.portal && !mouth(x, y)) out.push([x, y]);
    for (const [dx, dy] of NEIGHBOURS) {
      const k = key(x + dx, y + dy);
      const n = map.get(k);
      if (seen.has(k) || !stand(map, x + dx, y + dy) || n!.h - c.h > 1) continue; // eine Stufe hinauf, herunter immer
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return out;
}
