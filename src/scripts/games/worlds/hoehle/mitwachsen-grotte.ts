// Kristallgrotte hinter dem Höhlentor (Gegend 'hoehle') – rein und deterministisch: Derselbe Seed ergibt dieselbe Grotte.
// Eine große, oben offene Höhle (`GROTTE.shape`, etwa 10.000 Bodenfelder) hinter dem Gang, wo sie Platz hat
// (mitwachsen-site.ts: gerade dahinter oder um eine Ecke, fern der Eis-Welt). Ringsum Felsklippen in Terrassen 3, 4 und 5
// in den zart lila-grauen Schichten des Höhlentors; der Gang ist der einzige Zugang. Von der Mündung aus: der Lampengang
// mit Kristall-Lampen links und rechts, der freie Platz für den Bahnhof Fledermaus und daneben für den Lokschuppen (beide
// kommen mit dem Zug), das Höhlenbett unter dem ersten Lichtschacht mit Mooswiese, Pilzschale, Steintrog und dem
// Unterstand dahinter (vorn offen, seine Rückwand ist die Kristallwand), links der Pilzgarten mit Leuchtpilzen, rechts die Kristallhalle (zweiter Lichtschacht, fünf
// Kristallsäulen, der Kristallbogen), in der Mitte die Tropfsteingrotte mit Stalagmiten in drei Höhen und einem
// Felsbecken, hinten der stille See mit Steg zur Kristallinsel (dritter Lichtschacht), daneben der Geröllhang in drei
// Stufen und ganz am Ende die Plattform des Portals `hoehlensee` (schläft noch), ihr Gegenstück im Kreis um das Bett.
// Licht ohne Punktlichter: Unter den Schächten und neben Kristallen und Leuchtpilzen ist der Boden heller (`Cell.light`).
// Lagen rechnen von der Mündung aus. Teil des Welt-Pakets der Höhlenwelt (index.ts), nachgeladen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { hash, rand01, valueNoise } from '../../../../lib/games/rng';
import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { HOMES } from '../../../../data/games/mitwachsen-homes';
import { CAVE_PORTAL } from '../../../../data/games/mitwachsen-portals';
import { BED_STONE } from '../../../../data/games/mitwachsen-stories';
import type { Cell } from '../../mitwachsen-cell';
import { placeHome } from '../../mitwachsen-home';
import type { Beyond, Gang, Kessel, KesselPlace } from '../../mitwachsen-pack-types';
import { PLATFORM_HALF, platformCells, ringSpots, type Portal } from '../../mitwachsen-portal';
import { OBSTACLE_GAP } from '../../mitwachsen-world';
import { siteOf, type Site } from './mitwachsen-site';

const { rx, ry } = GROTTE.shape;
const OUTER = { rx: rx + GROTTE.cliff, ry: ry + GROTTE.cliff }; // fester Außenrand der Klippen
/** Platz der Grotte samt Klippen und Abstand (`Region.room` der Höhlenwelt sagt dem Kern dasselbe, Test) */
export const GROTTE_ROOM = { rx: OUTER.rx, ry: OUTER.ry, gap: GROTTE.gap };
/** So weit (Anteil am Quadrat des Radius) wellt sich der Rand innen höchstens nach innen */
const WOBBLE = 0.08;
const key = (x: number, y: number) => `${x},${y}`;
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Lage (u, v) von der Mitte der Grotte für eine Lage [quer, vom Tor weg] von der Mündung aus */
export const fromMouth = ([across, out]: readonly [number, number]): Point => [across, out - ry];
/** Lage [quer, vom Tor weg] von der Mündung aus für (u, v) von der Mitte */
const mouthward = (u: number, v: number): Point => [u, v + ry];

/** Liegt (u, v) innerhalb des festen Außenrands der Klippen? */
const inside = (u: number, v: number) => (u / OUTER.rx) ** 2 + (v / OUTER.ry) ** 2 < 1;

/** Wozu gehört (u, v): Boden innen (der Rand innen leicht gewellt, nur nach innen), Klippe ringsum, sonst nichts */
function zone(seed: number, u: number, v: number): 'floor' | 'cliff' | null {
  if (!inside(u, v)) return null;
  return (u / rx) ** 2 + (v / ry) ** 2 < 1 - valueNoise(seed + 71, u, v, 5) * WOBBLE ? 'floor' : 'cliff';
}

/** Die Grotte samt ihrer Lage (`Site`) */
type Grotto = KesselPlace & { site: Site };

/** Wo die Grotte liegt: Bett und alle Felder samt Klippen (ohne die Grotte zu bauen); hängt nicht vom Seed ab */
export function placeGrotte(_seed: number, gang: Gang, beyond: Beyond): Grotto {
  const site = siteOf(gang, beyond, GROTTE_ROOM);
  const cells: Point[] = [];
  for (let v = -OUTER.ry; v <= OUTER.ry; v++)
    for (let u = -OUTER.rx; u <= OUTER.rx; u++) if (inside(u, v)) cells.push(site.at(u, v));
  return { bed: site.at(...fromMouth([0, GROTTE.bed])), cells, site };
}

const floor = (h = 1): Cell => ({ h, ground: 'grotto', deco: null, region: 'hoehle', solid: false, biome: 'hoehle' });
/** Felsklippe: fest wie der Felsring; antwortet wie Fels mit Wackeln und „boing“ */
const cliff = (h: number): Cell => ({
  h,
  ground: 'grotto',
  deco: 'rock',
  region: 'border',
  solid: true,
  biome: 'hoehle',
});
const moss = (): Cell => ({ ...floor(), ground: 'grass', tufts: 0 });
const water = (): Cell => ({ ...floor(0), ground: 'water' });
const thing = (deco: Cell['deco'], extra: Partial<Cell> = {}): Cell => ({ ...floor(), deco, solid: true, ...extra });

/**
 * Die Grotte in die Karte der festen Felder bauen (`map`, dort liegt schon der Gang durch den Felsring): Verlängerung
 * des Gangs, Klippen, Boden mit allen Zonen, Zuhause, Portal und Licht. Liefert Bett, Felder (`realm`), Wohnplätze, den
 * Platz des Klangsteins (der Stein mit seiner Geschichte kommt später) und das Portal.
 */
export function buildGrotte(
  seed: number,
  gang: Gang,
  beyond: Beyond,
  _passage: (x: number, y: number) => Cell,
  map: Map<string, Cell>,
): Kessel {
  const { site, bed } = placeGrotte(seed, gang, beyond);
  const set = (x: number, y: number, c: Cell) => map.set(key(x, y), c);
  const realm = new Set<string>();
  // Verlängerung des Gangs: Felswände, Boden aus Grottenstein
  for (const [x, y] of site.walls) set(x, y, cliff(3));
  for (const [x, y] of site.floor) set(x, y, floor());
  for (const [x, y] of [...site.walls, ...site.floor]) realm.add(key(x, y));
  // Gang ab seiner Mitte gehört zur Höhlenwelt (dort wechselt die Tieranzeige)
  for (let t = gang.depth + 1 + Math.floor((gang.end - gang.depth) / 2); t <= gang.end; t++)
    for (let u = -gang.half - gang.wall; u <= gang.half + gang.wall; u++) realm.add(key(...gang.at(u, t)));

  const at = (p: readonly [number, number]) => site.at(...fromMouth(p));
  const home = placeHome('hoehle', bed);
  const ringHome = ringSpots([angleTo(bed, gang.at(0, gang.depth))], HOMES.hoehle.portalRing, bed)[0]!;
  const free = keepFree(site, bed, ringHome);
  // Klippen und Boden
  for (let v = -OUTER.ry; v <= OUTER.ry; v++)
    for (let u = -OUTER.rx; u <= OUTER.rx; u++) {
      const z = zone(seed, u, v);
      if (!z) continue;
      const [x, y] = site.at(u, v);
      realm.add(key(x, y));
      if (z === 'cliff') set(x, y, v < 0 && Math.abs(u) <= gang.half ? floor() : cliffCell(seed, u, v));
      else set(x, y, ground(seed, u, v, free(u, v)));
    }
  features(site, map);
  homeGround(home, set);
  const portal = platforms(site, bed, ringHome, map);
  scatter(seed, site, free, map);
  level([...realm], map);
  const reach = reachOf(home.wake, map);
  for (const k of realm) {
    // was man nicht erreichen kann, wird Fels: keine Ecke, die man sieht, aber nie betritt
    const c = map.get(k);
    if (c && c.region === 'hoehle' && !c.solid && c.ground !== 'water' && !reach.has(k))
      map.set(k, { ...cliff(Math.max(2, c.h + 1)), region: 'hoehle' });
  }
  light(realm, at, map);
  const stone: Point = [bed[0] + BED_STONE[0], bed[1] + BED_STONE[1]];
  return { bed, realm, spots: spotsOf(site, reach, map), spawns: new Map(), stone, portal: [CAVE_PORTAL, portal] };
}

/** Winkel von `a` nach `b` */
const angleTo = (a: Point, b: Point) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/** Felsklippe in Terrassen: innen 3, dann 4, außen 5, hier und da ein Block höher */
function cliffCell(seed: number, u: number, v: number): Cell {
  const o = (u / OUTER.rx) ** 2 + (v / OUTER.ry) ** 2;
  return cliff((o < 0.75 ? 3 : o < 0.87 ? 4 : 5) + (hash(seed, u, v, 72) % 7 === 0 ? 1 : 0));
}

/** Boden: Grottenstein auf Höhe 1, wo nichts frei bleiben muss sanfte Hügel auf Höhe 2 */
function ground(seed: number, u: number, v: number, free: boolean): Cell {
  return floor(!free && valueNoise(seed + 73, u, v, 8) > 0.74 ? 2 : 1);
}

/** Liegt (u, v) im Kreis mit Radius r um die Lage `p` (von der Mündung aus)? */
const near = (u: number, v: number, p: readonly [number, number], r: number) => {
  const [pu, pv] = fromMouth(p);
  return Math.hypot(u - pu, v - pv) <= r;
};
/** Liegt (u, v) im Rechteck von `p` aus, `du` quer und `dv` vom Tor weg zu beiden Seiten? */
const box = (u: number, v: number, p: readonly [number, number], du: number, dv: number) => {
  const [pu, pv] = fromMouth(p);
  return Math.abs(u - pu) <= du && Math.abs(v - pv) <= dv;
};

/** Liegt (u, v) im Streifen seitlich neben dem Weg (`out` hinter der Mündung, `long` lang, `wide` breit, ab `side`)? */
const strip =
  ({ out, long, wide, side }: { out: number; long: number; wide: number; side: number }) =>
  (u: number, v: number) => {
    const [, o] = mouthward(u, v);
    return u >= side && u < side + wide && o >= out && o < out + long;
  };
/** Platz für den Bahnhof Fledermaus: Streifen seitlich neben dem Weg */
export const stationAt = strip(GROTTE.station);
/** Platz für den Lokschuppen: neben dem Bahnhof, zwei Felder weiter außen */
export const shedAt = strip(GROTTE.shed);

/**
 * Was frei bleibt (keine Hügel, keine Kristalle, keine Stalagmiten), in (u, v) von der Mitte: die Mündung mit dem
 * Lampengang, die Plätze von Bahnhof und Lokschuppen, der Weg in der Mitte (die Mitte bleibt licht), das Bett mit Mooswiese, das
 * Gegenstück des Portals, die Zonen mit ihren eigenen Dingen (Pilzgarten, Kristallhalle, Felsbecken, See, Geröllhang)
 * und die Plattform am Ende
 */
function keepFree(site: Site, bed: Point, ring: Point) {
  const { lamps, garden, hall, lake, scree, portal } = GROTTE;
  const [bu, bv] = site.uv(...bed);
  const [ru, rv] = site.uv(...ring);
  return (u: number, v: number) => {
    const [, o] = mouthward(u, v);
    if (o < lamps.to + 4 && Math.abs(u) <= 6) return true; // Mündung und Lampengang
    if (Math.abs(u) <= 3) return true; // der Weg durch die Mitte
    if (Math.hypot(u - bu, v - bv) <= GROTTE.flat + 3) return true;
    if (Math.max(Math.abs(u - ru), Math.abs(v - rv)) <= PLATFORM_HALF + 3) return true;
    if (stationAt(u, v) || stationAt(u + 1, v) || stationAt(u - 1, v)) return true;
    if (shedAt(u, v) || shedAt(u + 1, v) || shedAt(u - 1, v)) return true;
    if (near(u, v, [garden.across, garden.out], garden.r)) return true;
    if (box(u, v, [hall.across, hall.out + 2], 7, 9)) return true; // Säulen und Bogen mit Platz ringsum
    if (near(u, v, [GROTTE.drip.across - 6, GROTTE.drip.out], 4)) return true; // Felsbecken
    const [lu, lv] = fromMouth([lake.across, lake.out]);
    if (((u - lu) / (lake.rx + 3)) ** 2 + ((v - lv) / (lake.ry + 3)) ** 2 < 1) return true;
    if (box(u, v, [scree.across + 1, scree.out], 9, scree.half + 2)) return true;
    return box(u, v, portal, PLATFORM_HALF + 3, PLATFORM_HALF + 3);
  };
}

/** Ein Ding auf ein Feld der Grotte setzen (Lage [quer, vom Tor weg] von der Mündung aus; nie auf die Klippen) */
type Put = (p: readonly [number, number], c: Cell) => void;

/**
 * Die Zonen mit ihren festen Dingen: Kristall-Lampen im Lampengang, Pilzgarten (Mooswiese), Kristallsäulen und
 * Kristallbogen in der Halle, Felsbecken mit Moosrand, stiller See mit Steg und Kristallinsel, Geröllhang in drei Stufen
 */
function features(site: Site, map: Map<string, Cell>) {
  const put: Put = (p, c) => {
    const [x, y] = site.at(...fromMouth(p));
    if (map.get(key(x, y))?.region === 'hoehle') map.set(key(x, y), c);
  };
  const { lamps, garden, drip, scree } = GROTTE;
  // Lampengang: links und rechts je eine Lampe alle `every` Felder, im Wechsel lila, türkis, rosa
  for (let o = 1, i = 0; o <= lamps.to; o += lamps.every, i++)
    for (const u of [-4, 4]) put([u, o], thing('cavelamp', { color: GROTTE_COLORS.crystals[i % 3] }));
  // Pilzgarten: Mooswiese
  for (let dv = -garden.r; dv <= garden.r; dv++)
    for (let du = -garden.r; du <= garden.r; du++)
      if (Math.hypot(du, dv) <= garden.r) put([garden.across + du, garden.out + dv], moss());
  hallOf(put);
  // Felsbecken 3 × 2 mit Moosrand
  for (let dv = -2; dv <= 1; dv++)
    for (let du = -2; du <= 2; du++)
      put([drip.across - 6 + du, drip.out + dv], Math.abs(du) <= 1 && dv >= -1 && dv <= 0 ? water() : moss());
  lakeOf(put);
  // Geröllhang: drei Stufen nach außen, jede eine Ebene höher (2, 3, 4)
  for (let s = 0; s < 3; s++)
    for (let du = 0; du < scree.step; du++)
      for (let dv = -scree.half; dv <= scree.half; dv++)
        put([scree.across - scree.step + s * scree.step + du, scree.out + dv], { ...floor(2 + s), ground: 'stone' });
}

/** Kristallhalle: fünf Säulen in einer Reihe (je ein Feld dazwischen), dahinter der Kristallbogen, am Rand hohe Kristalle */
function hallOf(put: Put) {
  const { hall } = GROTTE;
  const [kr, kt, kp] = GROTTE_COLORS.crystals;
  hall.columns.forEach((h, i) => put([hall.across - 4 + 2 * i, hall.out - 3], thing('column', { note: h })));
  for (let i = 0; i < 5; i++)
    put([hall.across - 2 + i, hall.out + hall.arch - 3], { ...thing('crystalarch', { note: i }), solid: i % 4 === 0 });
  for (const [du, dv, color] of [
    [-7, 3, kr],
    [7, 1, kp],
    [-6, 9, kt],
    [6, 10, kr],
  ] as const)
    put([hall.across + du, hall.out + dv], thing('crystal', { color }));
}

/** Stiller See, Kristallinsel in der Mitte (Kristalle an ihrem Rand), Steg vom vorderen Ufer zur Insel */
function lakeOf(put: Put) {
  const { lake } = GROTTE;
  const isleCrystal = thing('crystal', { color: GROTTE_COLORS.crystals[1] });
  for (let dv = -lake.ry; dv <= lake.ry; dv++)
    for (let du = -lake.rx; du <= lake.rx; du++) {
      if ((du / lake.rx) ** 2 + (dv / lake.ry) ** 2 >= 1) continue;
      const p: [number, number] = [lake.across + du, lake.out + dv];
      const r = Math.hypot(du, dv);
      if (r <= lake.isle) put(p, r > lake.isle - 1 && (du + dv) % 2 === 0 && du !== 0 ? isleCrystal : floor());
      else put(p, Math.abs(du) <= 1 && dv < 0 ? { ...floor(), ground: 'path' } : water());
    }
}

/** Zuhause in der Grotte: Höhlenbett, Mooswiese mit Pilzschale und Steintrog, Unterstand an der Kristallwand */
function homeGround(h: ReturnType<typeof placeHome>, set: (x: number, y: number, c: Cell) => void) {
  const [bx, by] = h.bed;
  const r = h.meadow;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (Math.hypot(dx, dy) <= r + 0.5) set(bx + dx, by + dy, { ...moss(), garden: true });
  const fixed = (deco: Cell['deco']): Cell => ({ ...moss(), garden: true, deco, solid: true });
  set(bx, by, { ...moss(), deco: 'bed', solid: true });
  set(...h.food, fixed('shroombowl'));
  set(...h.water, fixed('stonetrough'));
  const { x0, y0, x1, y1 } = h.shelter;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, { ...moss(), garden: true, roof: true });
  for (let x = x0; x <= x1; x++) set(x, y0 - 1, fixed('shed')); // Rückwand: die Kristallwand, ihre Mitte ist `shelterStem`
}

/**
 * Die beiden Plattformen des Portals `hoehlensee` (3 × 3, flach, ringsum ebener Boden): hinter dem See am Ende der
 * Grotte und im Kreis um das Höhlenbett in Richtung des Tors. Es schläft noch (`later`): Erwachen soll es erst, wenn der
 * Maulwurf eingezogen ist (kommt mit Tok und dem Zug).
 */
function platforms(site: Site, bed: Point, ring: Point, map: Map<string, Cell>): Portal {
  const portal: Portal = { gate: site.at(...fromMouth(GROTTE.portal)), home: ring, bed, later: true };
  for (const side of ['gate', 'home'] as const) {
    const [cx, cy] = portal[side];
    const around = PLATFORM_HALF + 1;
    for (let dy = -around; dy <= around; dy++)
      for (let dx = -around; dx <= around; dx++) {
        const c = map.get(key(cx + dx, cy + dy));
        if (c?.region === 'hoehle' && !c.garden && !c.solid) map.set(key(cx + dx, cy + dy), { ...c, h: 1 });
      }
    for (const { x, y, at } of platformCells([cx, cy]))
      map.set(key(x, y), {
        ...floor(),
        garden: map.get(key(x, y))?.garden,
        deco: at === 'centre' ? 'portal' : 'portalrim',
        portal: { id: CAVE_PORTAL, side, at },
      });
  }
  return portal;
}

/**
 * Dinge auf dem freien Boden (etwa 5 je 100 Felder, die Mitte bleibt licht): Kristalle in drei Farben, Stalagmiten in
 * drei Höhen (in der Tropfsteingrotte dichter), kleine Leuchtpilze (im Pilzgarten dichter, begehbar). Feste Dinge stehen
 * einzeln: im Umkreis von `OBSTACLE_GAP` Feldern kein anderes, so bleibt jeder Weg frei.
 */
function scatter(seed: number, site: Site, free: (u: number, v: number) => boolean, map: Map<string, Cell>) {
  const { things, drip, hall, garden } = GROTTE;
  const solidNear = (x: number, y: number) => {
    for (let dy = -OBSTACLE_GAP; dy <= OBSTACLE_GAP; dy++)
      for (let dx = -OBSTACLE_GAP; dx <= OBSTACLE_GAP; dx++) {
        const n = map.get(key(x + dx, y + dy));
        if (!n || n.solid || n.ground === 'water' || n.portal || n.region !== 'hoehle') return true;
      }
    return false;
  };
  for (let v = -ry; v <= ry; v++)
    for (let u = -rx; u <= rx; u++) {
      const [x, y] = site.at(u, v);
      const c = map.get(key(x, y));
      if (!c || c.region !== 'hoehle' || c.solid || c.deco || c.garden || c.portal || c.ground === 'water') continue;
      const roll = rand01(seed, x, y, 74);
      const pick = hash(seed, x, y, 75);
      if (near(u, v, [garden.across, garden.out], garden.r)) {
        if (roll < 0.12) map.set(key(x, y), { ...c, deco: 'glowshroom', color: GROTTE_COLORS.shrooms[pick % 3] });
        continue;
      }
      if (free(u, v) || c.ground !== 'grotto') continue;
      const inDrip = near(u, v, [drip.across, drip.out], drip.r);
      const inHall = near(u, v, [hall.across, hall.out], hall.r);
      const crystal = things.crystal * (inHall ? 3 : 1);
      const stalagmite = things.stalagmite * (inDrip ? 6 : 1);
      if (roll < crystal + stalagmite) {
        if (solidNear(x, y)) continue;
        map.set(
          key(x, y),
          roll < crystal
            ? { ...c, deco: 'crystal', solid: true, color: GROTTE_COLORS.crystals[pick % 3] }
            : { ...c, deco: 'stalagmite', solid: true, note: pick % 3 },
        );
      } else if (roll < crystal + stalagmite + things.shroom)
        map.set(key(x, y), { ...c, deco: 'glowshroom', color: GROTTE_COLORS.shrooms[pick % 3] });
    }
}

/**
 * Keine Stufe höher als eins (wie auf der Lichtung): Boden wird nur abgesenkt; Bett, Wiese, Plattformen und Wege
 * ziehen die Hügel ringsum herunter
 */
function level(cells: readonly string[], map: Map<string, Cell>) {
  const land = (c: Cell | undefined) => !!c && !c.solid && c.ground !== 'water';
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of cells) {
      let c = map.get(k);
      if (!land(c) || c!.region !== 'hoehle') continue;
      const [x, y] = k.split(',').map(Number) as [number, number];
      for (const [dx, dy] of NEIGHBOURS) {
        const n = map.get(key(x + dx, y + dy));
        if (!land(n) || c!.h <= n!.h + 1) continue;
        map.set(k, (c = { ...c!, h: n!.h + 1 }));
        changed = true;
      }
    }
  }
}

const stand = (c: Cell | undefined) => !!c && !c.solid && !c.gate && c.ground !== 'water';

/** Felder, die vom Bett aus zu Fuß erreichbar sind (eine Stufe hinauf, herunter immer), als "x,y" */
function reachOf(wake: readonly Point[], map: ReadonlyMap<string, Cell>): Set<string> {
  const seen = new Set<string>();
  const queue = wake.filter(([x, y]) => stand(map.get(key(x, y))));
  for (const [x, y] of queue) seen.add(key(x, y));
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const c = map.get(key(x, y))!; // nur Felder, auf denen man steht, kommen in die Liste
    for (const [dx, dy] of NEIGHBOURS) {
      const k = key(x + dx, y + dy);
      const n = map.get(k);
      if (seen.has(k) || !stand(n) || n!.h - c.h > 1) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return seen;
}

/**
 * Licht ohne Punktlichter: unter den drei Lichtschächten ein Lichtfleck (Radius `GROTTE.shaft.r`, in der Mitte bis 35 %
 * heller), Kristalle, Leuchtpilze, Säulen und Lampen machen ihr Feld und die acht Nachbarn um `GROTTE.glow` heller.
 * Höchstens 0,5: Hell wird es, nie grell.
 */
function light(realm: ReadonlySet<string>, at: (p: readonly [number, number]) => Point, map: Map<string, Cell>) {
  const shafts = GROTTE.shafts.map(at);
  const lit = new Map<string, number>();
  const glows = (c: Cell) =>
    c.deco === 'crystal' || c.deco === 'glowshroom' || c.deco === 'column' || c.deco === 'cavelamp';
  for (const k of realm) {
    const c = map.get(k);
    if (!c) continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    let l = 0;
    for (const [sx, sy] of shafts) {
      const d = Math.hypot(x - sx, y - sy);
      if (d < GROTTE.shaft.r) l = Math.max(l, GROTTE.shaft.light * (1 - d / GROTTE.shaft.r));
    }
    if (l > 0) lit.set(k, l);
    if (!glows(c)) continue;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const n = key(x + dx, y + dy);
        if (realm.has(n)) lit.set(n, (lit.get(n) ?? 0) + GROTTE.glow);
      }
  }
  for (const [k, l] of lit) {
    const c = map.get(k);
    if (c && c.region !== 'border') map.set(k, { ...c, light: Math.min(0.5, Math.round(l * 100) / 100) });
  }
}

/**
 * Wohnplätze der Höhlen-Tiere (sie kommen später): vom Bett aus erreichbare Felder der Grotte außerhalb der Mooswiese
 * und der Plattformen, nicht in der Mündung (zwei Felder Abstand zum Gang) und nicht auf dem Platz von Bahnhof und Lokschuppen
 */
function spotsOf(site: Site, reach: ReadonlySet<string>, map: ReadonlyMap<string, Cell>): Point[] {
  const out: Point[] = [];
  for (const k of reach) {
    const c = map.get(k)!;
    if (c.region !== 'hoehle' || c.garden || c.portal) continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    const [u, v] = site.uv(x, y);
    const [, o] = mouthward(u, v);
    if (o < 2 || stationAt(u, v) || shedAt(u, v) || !(u ** 2 / rx ** 2 + v ** 2 / ry ** 2 < 1)) continue;
    out.push([x, y]);
  }
  return out;
}
