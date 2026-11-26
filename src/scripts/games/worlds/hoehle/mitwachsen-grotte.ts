// Kristallgrotte hinter dem Höhlentor (Gegend 'hoehle') – rein und deterministisch: Derselbe Seed ergibt dieselbe Grotte.
// Eine große, oben offene Höhle (`GROTTE.shape`, etwa 10.000 Bodenfelder) hinter dem Gang, wo sie Platz hat
// (mitwachsen-site.ts: gerade dahinter oder um eine Ecke, fern der Eis-Welt). Ringsum Felsklippen in Terrassen 3, 4 und 5
// in den zart lila-grauen Schichten des Höhlentors; der Gang ist der einzige Zugang. Von der Mündung aus: der Lampengang
// mit Kristall-Lampen links und rechts, der freie Platz für den Bahnhof Fledermaus und daneben für den Lokschuppen (beide
// kommen mit dem Zug), das Höhlenbett unter dem ersten Lichtschacht mit Mooswiese, Pilzschale, Steintrog und dem
// Unterstand dahinter (vorn offen, seine Rückwand ist die Kristallwand), auf dem Weg zum Pilzgarten zwei Pilzbeete,
// links der Pilzgarten mit vier Pilzbeeten und weiß-blauen Deko-Pilzen am Rand und daneben der Lehmhang des Dachses, rechts die Kristallhalle (zweiter Lichtschacht, fünf Kristallsäulen mit den Verstecken der kleinen Lichtgeister, links davor ihr Klangstein `lichtgeister`,
// der Kristallbogen), in der Mitte die Tropfsteingrotte mit Stalagmiten in drei Höhen und einem Felsbecken samt
// Tropfquelle und Tropfmoos, hinten der stille See mit Steg zur Kristallinsel (dritter Lichtschacht), daneben der
// Geröllhang in drei Stufen und ganz am Ende die Plattform des Portals `hoehlensee` (schläft noch), ihr Gegenstück im
// Kreis um das Bett. Dazwischen die Füllung (mitwachsen-fill.ts): Stalagmiten-Gruppen, Kristallbüsche, Felsbrocken,
// Felsinseln mit Moos, Pfützen, unter den Schächten Moos, Farn und Leuchtmoos, danach die Fülle: Kristallfelder, Adern im
// Boden, Leuchtmoos an den Wänden und ein kleiner Wasserfall am See; frei bleiben die Mitte, die Wege und die Spur des
// künftigen Gleises von der Mündung zum Platz des Bahnhofs. Drei bis vier Stalagmiten fern aller Wege werden Netze der
// Tupfspinnen (mitwachsen-spider.ts), die leuchten wie Kristalle.
// Licht ohne Punktlichter: Unter den Schächten und neben Kristallen und Leuchtpilzen ist der Boden heller (`Cell.light`),
// an den Felswänden dunkler, außer auf den Wegen (`Cell.dim`, mitwachsen-glow.ts). Rechts vorn am Bett steht der Sockel
// der Kristall-Laterne (mitwachsen-lantern.ts).
// Lagen rechnen von der Mündung aus. Teil des Welt-Pakets der Höhlenwelt (index.ts), nachgeladen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { fromKey } from '../../../../lib/games/chunks';
import { hash, rand01, valueNoise } from '../../../../lib/games/rng';
import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE, GROTTE_COLORS, JETTY_EAST } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { ARCH_PERCH } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import { HOMES } from '../../../../data/games/mitwachsen-homes';
import { CAVE_PORTAL } from '../../../../data/games/mitwachsen-portals';
import { CAVE_STONE, type StoryId } from '../../../../data/games/mitwachsen-stories';
import type { Cell } from '../../mitwachsen-cell';
import { placeHome } from '../../mitwachsen-home';
import type { Beyond, Gang, Kessel, KesselPlace } from '../../mitwachsen-pack-types';
import { PLATFORM_HALF, platformCells, ringSpots, type Portal } from '../../mitwachsen-portal';
import { findSpawns } from '../../mitwachsen-spawns';
import { OBSTACLE_GAP } from '../../mitwachsen-world';
import { caveHaunts } from './mitwachsen-cave-haunts';
import { adornGrotte, corridorAt, crystalOf, fillGrotte, shadeGrotte, tipOf } from './mitwachsen-fill';
import { dimGrotte } from './mitwachsen-glow';
import { clayOf, laneMarks, lanePlan, laneSide, type LaneMarks } from './mitwachsen-lane';
import { HALL_STAGE, hallStage } from './mitwachsen-hall';
import { plantTorches } from './mitwachsen-torch';
import { caveKeep, placeCave } from './mitwachsen-cave-places';
import { siteOf, type Site } from './mitwachsen-site';
import { spinWebs } from './mitwachsen-spider';

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
  const side = laneSide(site);
  const lane = laneMarks(lanePlan(side, (u, v) => zone(seed, u, v) === 'floor'));
  const free = keepFree(site, bed, ringHome, side, lane.keep);
  // Klippen und Boden; der Glitzergang der Grubenbahn ist bis zum Graben Fels
  for (let v = -OUTER.ry; v <= OUTER.ry; v++)
    for (let u = -OUTER.rx; u <= OUTER.rx; u++) {
      const z = zone(seed, u, v);
      if (!z) continue;
      const [x, y] = site.at(u, v);
      realm.add(key(x, y));
      set(x, y, terrain(seed, u, v, z, { half: gang.half, free, lane }));
    }
  features(site, side, map);
  homeGround(home, set);
  const portal = platforms(site, bed, ringHome, map);
  fillGrotte(seed, site, free, map); // Stalagmiten-Gruppen, Kristallbüsche, Felsbrocken, Felsinseln, Pfützen
  scatter(seed, site, side, free, map);
  shadeGrotte(seed, site, (u, v) => Math.abs(u) <= 3 || nearStation(u, v), map); // Moos und Farn unter den Schächten
  adornGrotte(seed, site, free, map); // Fülle: Kristallfelder, Adern, Leuchtmoos an den Wänden, Wasserfall am See
  level(realm, map);
  const way = pathsOf(site, bed, ringHome);
  plantTorches(map, at, (x, y) => way(...site.uv(x, y))); // Kristallfackeln an den Wegen, ganz zuletzt: nie im Weg
  placeCave(seed, realm, map, at, caveKeep(site, way, free)); // Spielorte (Issue 56), nach Füllung und Fackeln
  const reach = reachOf(home.wake, map);
  for (const k of realm) {
    // was man nicht erreichen kann, wird Fels: keine Ecke, die man sieht, aber nie betritt
    const c = map.get(k);
    if (c && c.region === 'hoehle' && !c.solid && c.ground !== 'water' && !reach.has(k))
      map.set(k, { ...cliff(Math.max(2, c.h + 1)), region: 'hoehle' });
  }
  const path = way;
  spinWebs(seed, (u, v) => site.at(u, v), path, fromMouth([0, GROTTE.bed]), map); // Netze der Tupfspinnen statt einiger Stalagmiten
  light(realm, at, map);
  markStation(realm, site, map);
  dimGrotte(realm, (x, y) => path(...site.uv(x, y)), map); // Ränder im Dunkel, Wege und Licht bleiben hell
  const stone: Point = [bed[0] + CAVE_STONE[0], bed[1] + CAVE_STONE[1]]; // Klangstein `hoehle-offen` (homeGround)
  // Tiere wohnen nur, wo sie zu Fuß hinkommen, ohne die Schleife der Grubenbahn zu queren: Ist der Gang gegraben, sperrt
  // die Fahr-Engine umherlaufenden Tieren das Gleis; was die Schleife einschließt, bleibt so den Kindern
  const spots = spotsOf(
    site,
    reachOf(home.wake, map, (c) => !c.lane),
    map,
  );
  // Wohnorte der Höhlen-Tiere: das erste je Art an seinem Fundort, die anderen verteilt über die Grotte
  const stage = hallStage(site);
  const spawns = findSpawns(seed, caveHaunts(spots, map, at, bed, side, stage(0, HALL_STAGE.arch)), spots, bed);
  const ghosts = stage(...HALL_STAGE.stone); // Klangstein „lichtgeister“ in der Kristallhalle (hallOf)
  const more: [StoryId, Point][] = map.get(key(...ghosts))?.story === 'lichtgeister' ? [['lichtgeister', ghosts]] : [];
  return { bed, realm, spots, spawns, stone, more, portal: [CAVE_PORTAL, portal] };
}

/**
 * Ein Feld der Grotte bei (u, v) von der Mitte: Klippe (in der Mündung Boden, so breit wie der Gang `half`), Boden mit
 * sanften Hügeln, wo nichts frei bleiben muss (`free`); der Glitzergang der Grubenbahn samt Nachbarn ist bis zum Graben
 * Fels, ihr offenes Gleis und der Zaun ebener Boden, ihr Bahnsteig markiert (`lane`)
 */
function terrain(
  seed: number,
  u: number,
  v: number,
  z: 'floor' | 'cliff',
  { half, free, lane }: { half: number; free: (u: number, v: number) => boolean; lane: LaneMarks },
): Cell {
  const mark = lane.at.get(key(u, v));
  if (mark && (mark.part === 'gang' || mark.part === 'side'))
    return { ...(z === 'cliff' ? cliffCell(seed, u, v) : cliff(3)), lane: mark };
  if (z === 'cliff') return v < 0 && Math.abs(u) <= half ? floor() : cliffCell(seed, u, v);
  if (mark) return { ...floor(), lane: mark };
  return { ...ground(seed, u, v, free(u, v)), ...(lane.platform.has(key(u, v)) && { stop: 'grube' }) };
}

/** Plätze von Bahnhof Fledermaus, Lokschuppen und Klangstein, für die Bahn markiert (`Cell.stop`, `shed`, `stone`) */
function markStation(realm: ReadonlySet<string>, site: Site, map: Map<string, Cell>) {
  for (const k of realm) {
    const c = map.get(k);
    const uv = site.uv(...fromKey(k));
    if (c && stationAt(...uv)) map.set(k, { ...c, stop: 'hoehle' });
    else if (c && shedAt(...uv) && !c.solid) map.set(k, { ...c, shed: 'hoehle' });
    else if (c && shedStoneAt(...uv) && !c.solid) map.set(k, { ...c, stone: 'lokschuppen' });
  }
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
/** Platz für den Bahnhof Fledermaus: Streifen seitlich neben dem Weg, auf der Seite, auf der das Gleis ankommt */
export const stationAt = strip(GROTTE.station);
/** Platz für den Lokschuppen: neben dem Bahnhof, zwei Felder weiter außen */
export const shedAt = strip(GROTTE.shed);

/** Platz des Klangsteins `lokschuppen` (Bau 2): neben der vorderen Ecke des Lokschuppens zum Höhlenbett hin */
export const shedStoneAt = strip({ ...GROTTE.shed, out: GROTTE.shed.out + GROTTE.shed.long, long: 1, wide: 1 });

/** Spur des künftigen Gleises, Plätze von Bahnhof und Lokschuppen samt einem Feld quer, Klangstein samt Feld ringsum */
const nearStation = (u: number, v: number) =>
  corridorAt(u, v) ||
  [-1, 0, 1].some((d) => stationAt(u + d, v) || shedAt(u + d, v) || [-1, 0, 1].some((e) => shedStoneAt(u + d, v + e)));

/**
 * Was frei bleibt (keine Hügel, keine Kristalle, keine Stalagmiten, keine Füllung), in (u, v) von der Mitte: die Mündung
 * mit dem Lampengang, die Spur des künftigen Gleises, die Plätze von Bahnhof und Lokschuppen, der Weg in der Mitte (die
 * Mitte bleibt licht), das Bett mit Mooswiese, das Gegenstück des Portals, die Zonen mit ihren eigenen Dingen
 * (Pilzgarten, Lehmhang, Kristallhalle, Felsbecken, See, Geröllhang) und die Plattform am Ende
 */
/**
 * Wege der Grotte (u, v): Mündung und Lampengang, der Weg durch die Mitte, Bett samt Wiese und Gegenstück des Portals,
 * Bahnhof und Lokschuppen. Sie bleiben frei und hell (nie Schatten der Ränder, mitwachsen-glow.ts)
 */
function pathsOf(site: Site, bed: Point, ring: Point) {
  const [bu, bv] = site.uv(...bed);
  const [ru, rv] = site.uv(...ring);
  return (u: number, v: number) => {
    const [, o] = mouthward(u, v);
    if (o < GROTTE.lamps.to + 4 && Math.abs(u) <= 6) return true; // Mündung und Lampengang
    if (Math.abs(u) <= 3) return true; // der Weg durch die Mitte
    if (Math.hypot(u - bu, v - bv) <= GROTTE.flat + 3) return true;
    if (Math.max(Math.abs(u - ru), Math.abs(v - rv)) <= PLATFORM_HALF + 3) return true;
    return nearStation(u, v);
  };
}

function keepFree(site: Site, bed: Point, ring: Point, side: 1 | -1, lane: ReadonlySet<string>) {
  const { garden, clay, lake, scree, portal } = GROTTE;
  const path = pathsOf(site, bed, ring);
  const [hx, hy] = hallStage(site)(0, 0);
  // Bühne der Halle in Weltrichtung: Säulen, Bogen und Klangstein mit Platz ringsum
  const onStage = (u: number, v: number) => {
    const [x, y] = site.at(u, v);
    return Math.abs(x - hx) <= 7 && Math.abs(y - hy + 2) <= 9;
  };
  return (u: number, v: number) => {
    if (path(u, v) || lane.has(key(u, v))) return true; // Wege, Schleife der Grubenbahn samt Bahnsteig
    if (near(u, v, [garden.across, garden.out], garden.r)) return true;
    if (GROTTE.nearBeds.at.some((p) => near(u, v, p, 2.5))) return true; // die Beete näher am Bett, Moos ringsum
    const bank = clayOf(side); // Lehmhang, gegenüber der Kamera
    if (box(u, v, [bank.across - clay.step, bank.out], clay.step + 2, clay.long / 2 + 2)) return true;
    if (onStage(u, v)) return true;
    if (near(u, v, [GROTTE.drip.across + GROTTE.drip.basin, GROTTE.drip.out], 4)) return true; // Felsbecken
    const [lu, lv] = fromMouth([lake.across, lake.out]);
    if (((u - lu) / (lake.rx + 3)) ** 2 + ((v - lv) / (lake.ry + 3)) ** 2 < 1) return true;
    if (box(u, v, [scree.across + 1, scree.out], 9, scree.half + 2)) return true;
    return box(u, v, portal, PLATFORM_HALF + 3, PLATFORM_HALF + 3);
  };
}

/** Ein Ding auf ein Feld der Grotte setzen (Lage [quer, vom Tor weg] von der Mündung aus; nie auf die Klippen, nie auf die Schleife der Grubenbahn) */
type Put = (p: readonly [number, number], c: Cell) => void;

/**
 * Die Zonen mit ihren festen Dingen: Kristall-Lampen im Lampengang, Pilzgarten (Mooswiese mit den Pilzbeeten), Lehmhang,
 * Kristallsäulen und Kristallbogen in der Halle, Felsbecken mit Tropfquelle und Tropfmoos auf dem Moosrand, stiller See
 * mit Steg und Kristallinsel, Geröllhang in drei Stufen
 */
function features(site: Site, side: 1 | -1, map: Map<string, Cell>) {
  const put: Put = (p, c) => {
    const [x, y] = site.at(...fromMouth(p));
    const was = map.get(key(x, y));
    if (was?.region === 'hoehle' && !was.lane) map.set(key(x, y), c); // die Schleife der Grubenbahn bleibt frei
  };
  const { lamps, garden, clay, drip, scree } = GROTTE;
  // Lampengang: links und rechts je eine Lampe alle `every` Felder, im Wechsel lila, türkis, rosa
  for (let o = 1, i = 0; o <= lamps.to; o += lamps.every, i++)
    for (const u of [-4, 4]) put([u, o], thing('cavelamp', { color: GROTTE_COLORS.crystals[i % 3] }));
  // Pilzgarten: Mooswiese
  for (let dv = -garden.r; dv <= garden.r; dv++)
    for (let du = -garden.r; du <= garden.r; du++)
      if (Math.hypot(du, dv) <= garden.r) put([garden.across + du, garden.out + dv], moss());
  for (const [du, dv] of bedSpots())
    put([garden.across + du, garden.out + dv], { ...moss(), deco: 'shroombed', solid: true });
  nearBeds(put);
  // Lehmhang des Dachses: nach außen zwei Stufen Lehm (Höhe 2 und 3), begehbar; nie auf der Seite zur Kamera
  const bank = clayOf(side);
  for (let du = 0; du < 2 * clay.step; du++)
    for (let dv = 0; dv < clay.long; dv++)
      put([bank.across - du, bank.out - (clay.long >> 1) + dv], {
        ...floor(2 + Math.floor(du / clay.step)),
        deco: 'clay',
      });
  hallOf(put, hallStage(site), map);
  // Felsbecken 3 × 2 mit Moosrand: hinten die Tropfquelle (fest), auf dem Rand an den Seiten und hinten Tropfmoos
  // (begehbar), vorn bleibt Moos, von dort schöpft man
  for (let dv = -2; dv <= 1; dv++)
    for (let du = -2; du <= 2; du++) {
      const p = [drip.across + drip.basin + du, drip.out + dv] as const;
      if (Math.abs(du) <= 1 && dv >= -1 && dv <= 0) put(p, water());
      else if (dv === 1 && du === 0) put(p, { ...moss(), deco: 'dripspring', solid: true });
      else put(p, dv >= -1 ? { ...moss(), deco: 'dripmoss' } : moss());
    }
  lakeOf(put, site);
  // Geröllhang: drei Stufen nach außen, jede eine Ebene höher (2, 3, 4)
  for (let s = 0; s < 3; s++)
    for (let du = 0; du < scree.step; du++)
      for (let dv = -scree.half; dv <= scree.half; dv++)
        put([scree.across - scree.step + s * scree.step + du, scree.out + dv], { ...floor(2 + s), ground: 'stone' });
}

/** Zwei Pilzbeete näher am Bett (`GROTTE.nearBeds`), je auf einem kleinen Moosfleck */
function nearBeds(put: Put) {
  const { at, moss: patch } = GROTTE.nearBeds;
  for (const [a, o] of at) {
    for (let dv = -2; dv <= 2; dv++)
      for (let du = -2; du <= 2; du++) if (Math.hypot(du, dv) <= patch) put([a + du, o + dv], moss());
    put([a, o], { ...moss(), deco: 'shroombed', solid: true });
  }
}

/**
 * Lagen der Pilzbeete im Pilzgarten [quer, vom Tor weg] von seiner Mitte: `GROTTE.garden.beds` Beete gleichmäßig im
 * Kreis mit Radius `ring` (je ein Büschel Leuchtpilze zum Sammeln; einzeln, mit freiem Moos ringsum). Die beiden Beete
 * näher am Bett stehen in `GROTTE.nearBeds`
 */
export function bedSpots(): Point[] {
  const { beds, ring } = GROTTE.garden;
  // symmetrisch runden (2,5 wie −2,5 vom Nullpunkt weg; das Epsilon fängt 2,4999… aus sin und cos), + 0: ohne −0
  const round = (v: number) => Math.sign(v) * Math.round(Math.abs(v) + 1e-9) + 0;
  return Array.from({ length: beds }, (_, i) => {
    const a = ((i + 0.5) / beds) * 2 * Math.PI;
    return [round(Math.cos(a) * ring), round(Math.sin(a) * ring)] as Point;
  });
}

/**
 * Kristallhalle: fünf Säulen in einer Reihe (je ein Feld dazwischen), das Säulen-Glockenspiel (mitwachsen-cave-rules.ts),
 * dahinter der Kristallbogen, am Rand hohe Kristalle. Säulen, Bogen und Klangstein stehen auf der Bühne der Halle
 * (`hallStage`, in Weltrichtung): die Reihe quer im Bild, der tiefste Ton links, der Bogen dahinter im Norden. Die
 * Kristalle am Rand liegen im Raster der Grotte
 */
function hallOf(put: Put, stage: ReturnType<typeof hallStage>, map: Map<string, Cell>) {
  const { hall } = GROTTE;
  const [kr, kt, kp] = GROTTE_COLORS.crystals;
  const set = (right: number, front: number, c: Cell) => {
    const k = key(...stage(right, front));
    const was = map.get(k);
    if (was?.region === 'hoehle' && !was.lane) map.set(k, c); // wie `put`: nie auf Klippen oder die Schleife der Grubenbahn
  };
  for (const [du, dv, color] of [
    [-7, 3, kr],
    [7, 1, kp],
    [-6, 9, kt],
    [6, 10, kr],
  ] as const)
    put([hall.across + du, hall.out + dv], thing('crystal', { color }));
  // das Säulen-Glockenspiel: `note` ist der Ton (0 = C5 links … 4 = A5 rechts), die Höhe kommt aus `hall.columns`
  hall.columns.forEach((_, note) => set(-4 + 2 * note, HALL_STAGE.columns, thing('column', { note })));
  // Kristallbogen: Pfeiler an den Enden, darunter drei Felder, an deren Bogen man hängen kann (`perch`: die Fledermäuse)
  for (let i = 0; i < 5; i++)
    set(
      i - 2,
      HALL_STAGE.arch,
      i % 4 === 0 ? thing('crystalarch', { note: i }) : { ...floor(), deco: 'crystalarch', note: i, perch: ARCH_PERCH },
    );
  // Klangstein „lichtgeister“ links vor den Säulen: Hier spielen die kleinen Lichtgeister Verstecken (mitwachsen-ghost.ts)
  set(...HALL_STAGE.stone, thing('klangstein', { story: 'lichtgeister' }));
}

/**
 * Stiller See, Kristallinsel in der Mitte (Kristalle an ihrem Rand), Holzsteg vom vorderen Ufer zur Insel, drei Planken
 * breit (`'jetty'`, begehbar); die Planken an der Insel (`note` ungerade) sind sein Ende: Dort taucht der Grottenolm
 * auf. Läuft der Steg in der Welt von West nach Ost, kommt 2 dazu (`JETTY_EAST`): So liegen seine Bretter in jeder Lage
 * der Grotte quer zur Laufrichtung
 */
function lakeOf(put: Put, site: Pick<Site, 'at'>) {
  const { lake } = GROTTE;
  const east = site.at(0, 1)[1] === site.at(0, 0)[1] ? JETTY_EAST : 0;
  const isleCrystal = thing('crystal', { color: GROTTE_COLORS.crystals[1] });
  const isle = (du: number, dv: number) => Math.hypot(du, dv) <= lake.isle;
  for (let dv = -lake.ry; dv <= lake.ry; dv++)
    for (let du = -lake.rx; du <= lake.rx; du++) {
      if ((du / lake.rx) ** 2 + (dv / lake.ry) ** 2 >= 1) continue;
      const p: [number, number] = [lake.across + du, lake.out + dv];
      const r = Math.hypot(du, dv);
      if (r <= lake.isle) put(p, r > lake.isle - 1 && (du + dv) % 2 === 0 && du !== 0 ? isleCrystal : floor());
      else if (Math.abs(du) <= 1 && dv < 0)
        put(p, { ...floor(), ground: 'path', deco: 'jetty', note: (isle(du, dv + 1) ? 1 : 0) + east });
      else put(p, water());
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
  set(h.bed[0] + GROTTE.lantern[0], h.bed[1] + GROTTE.lantern[1], fixed('lantern')); // Sockel der Kristall-Laterne
  set(h.bed[0] + CAVE_STONE[0], h.bed[1] + CAVE_STONE[1], { ...fixed('klangstein'), story: 'hoehle-offen' }); // zweite Fassung
  const { x0, y0, x1, y1 } = h.shelter;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, { ...moss(), garden: true, roof: true });
  for (let x = x0; x <= x1; x++) set(x, y0 - 1, fixed('shed')); // Rückwand: die Kristallwand, ihre Mitte ist `shelterStem`
}

/**
 * Die beiden Plattformen des Portals `hoehlensee` (3 × 3, flach, ringsum ebener Boden): hinter dem See am Ende der
 * Grotte und im Kreis um das Höhlenbett in Richtung des Tors. Es erwacht erst, wenn der erste Maulwurf zu Hause wohnt
 * (`later`; mit der Bahn zieht er nach Bau 2 als erstes ein, im Blick hinein ohne Bahn bringt ihn das Kind heim), dann
 * beim Ankommen am Höhlenbett wie das Eis-Portal (`bed`).
 */
function platforms(site: Site, bed: Point, ring: Point, map: Map<string, Cell>): Portal {
  const portal: Portal = { gate: site.at(...fromMouth(GROTTE.portal)), home: ring, bed, later: FIRST_MOLE };
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
 * Dinge auf dem freien Boden (etwa 5 je 100 Felder, die Mitte bleibt licht): Kristalle in der Farbe ihrer Zone, Stalagmiten in
 * drei Höhen (in der Tropfsteingrotte dichter, Spitze in der Farbe der Zone), kleine Leuchtpilze (im Pilzgarten
 * dichter, begehbar). Feste Dinge stehen einzeln: im Umkreis von `OBSTACLE_GAP` Feldern kein anderes, so bleibt jeder Weg frei.
 */
function scatter(
  seed: number,
  site: Site,
  side: 1 | -1,
  free: (u: number, v: number) => boolean,
  map: Map<string, Cell>,
) {
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
        if (gardenEdge(u, v, roll)) map.set(key(x, y), { ...c, deco: 'glowshroom', color: GROTTE_COLORS.decoShroom });
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
            ? { ...c, deco: 'crystal', solid: true, color: crystalOf(u, v, side) }
            : { ...c, deco: 'stalagmite', solid: true, note: pick % 3, color: tipOf(u, v, side) },
        );
      } else if (roll < crystal + stalagmite + things.shroom)
        map.set(key(x, y), { ...c, deco: 'glowshroom', color: GROTTE_COLORS.decoShroom });
    }
}

/** Deko-Pilze im Pilzgarten nur am Rand der Wiese (weiß-blau): Zwischen den Beeten steht nichts, was wie ein Sammelpilz aussieht */
const gardenEdge = (u: number, v: number, roll: number) =>
  roll < 0.12 && !near(u, v, [GROTTE.garden.across, GROTTE.garden.out], GROTTE.garden.edge);

/**
 * Keine Stufe höher als eins (wie auf der Lichtung): Boden wird nur abgesenkt; Bett, Wiese, Plattformen und Wege
 * ziehen die Hügel ringsum herunter
 */
function level(cells: ReadonlySet<string>, map: Map<string, Cell>) {
  const land = (c: Cell | undefined): c is Cell => !!c && !c.solid && c.ground !== 'water';
  /** Ein Feld auf Nachbar + 1 absenken; sank es, kommen seine Nachbarn aus `cells` in `next` */
  const lower = (k: string, next: Set<string>) => {
    const c = map.get(k);
    if (!land(c) || c.region !== 'hoehle') return;
    const [x, y] = fromKey(k);
    let h = c.h;
    for (const [dx, dy] of NEIGHBOURS) {
      const n = map.get(key(x + dx, y + dy));
      if (land(n) && n.h + 1 < h) h = n.h + 1;
    }
    if (h === c.h) return;
    map.set(k, { ...c, h });
    for (const [dx, dy] of NEIGHBOURS) if (cells.has(key(x + dx, y + dy))) next.add(key(x + dx, y + dy));
  };
  // Einmal über alle Felder, danach nur die Nachbarn gesunkener; das Ergebnis hängt nicht von der Reihenfolge ab
  let next = new Set<string>();
  for (const k of cells) lower(k, next);
  while (next.size) {
    const todo = next;
    next = new Set();
    for (const k of todo) lower(k, next);
  }
}

const stand = (c: Cell | undefined) => !!c && !c.solid && !c.gate && c.ground !== 'water';

/**
 * Felder, die vom Bett aus zu Fuß erreichbar sind (eine Stufe hinauf, herunter immer), als "x,y"; mit `pass` nur über
 * Felder, die es durchlässt
 */
function reachOf(wake: readonly Point[], map: ReadonlyMap<string, Cell>, pass: (c: Cell) => boolean = () => true) {
  const seen = new Set<string>();
  const ok = (c: Cell | undefined) => stand(c) && pass(c!);
  const queue = wake.filter(([x, y]) => ok(map.get(key(x, y))));
  for (const [x, y] of queue) seen.add(key(x, y));
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const c = map.get(key(x, y))!; // nur Felder, auf denen man steht, kommen in die Liste
    for (const [dx, dy] of NEIGHBOURS) {
      const k = key(x + dx, y + dy);
      const n = map.get(k);
      if (seen.has(k) || !ok(n) || n!.h - c.h > 1) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return seen;
}

/**
 * Licht ohne Punktlichter: unter den drei Lichtschächten ein Lichtfleck (Radius `GROTTE.shaft.r`, in der Mitte bis 35 %
 * heller; welcher Schacht, steht in `Cell.shaft`), Kristalle, Kristallbüsche, Leuchtpilze, Säulen, Lampen und Netze machen ihr
 * Feld und die acht Nachbarn um `GROTTE.glow` heller. Höchstens 0,5: Hell wird es, nie grell.
 */
function light(realm: ReadonlySet<string>, at: (p: readonly [number, number]) => Point, map: Map<string, Cell>) {
  const shafts = GROTTE.shafts.map(at);
  const lit = new Map<string, number>();
  const under = new Map<string, number>(); // Lichtfleck welches Schachts (`Cell.shaft`)
  const glows = (c: Cell) =>
    c.deco === 'crystal' ||
    c.deco === 'glowshroom' ||
    c.deco === 'shroombed' ||
    c.deco === 'column' ||
    c.deco === 'cavelamp' ||
    c.deco === 'torch' ||
    c.deco === 'crystalbush' ||
    c.deco === 'web';
  for (const k of realm) {
    const c = map.get(k);
    if (!c) continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    let l = 0;
    shafts.forEach(([sx, sy], i) => {
      const d = Math.hypot(x - sx, y - sy);
      const here = GROTTE.shaft.light * (1 - d / GROTTE.shaft.r);
      if (d >= GROTTE.shaft.r || here <= l) return;
      l = here; // der hellste Schacht zählt, auch für `Cell.shaft`
      under.set(k, i);
    });
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
    const shaft = under.get(k);
    if (c && c.region !== 'border')
      map.set(k, { ...c, light: Math.min(0.5, Math.round(l * 100) / 100), ...(shaft !== undefined && { shaft }) });
  }
}

/**
 * Wohnplätze der Höhlen-Tiere: vom Bett aus erreichbare Felder der Grotte (`reach`: ohne die Schleife der Grubenbahn
 * zu queren, also nicht in dem, was sie einschließt) außerhalb der Mooswiese
 * und der Plattformen, nicht in der Mündung (zwei Felder Abstand zum Gang), nicht auf dem Platz von Bahnhof und Lokschuppen
 * und nicht auf der Schleife der Grubenbahn samt Zaun und Bahnsteig
 */
function spotsOf(site: Site, reach: ReadonlySet<string>, map: ReadonlyMap<string, Cell>): Point[] {
  const out: Point[] = [];
  for (const k of reach) {
    const c = map.get(k)!;
    // am Klangstein steht mit Bau 2 ein Stein, auf der Schleife der Grubenbahn und ihrem Bahnsteig fährt sie später
    if (c.region !== 'hoehle' || c.garden || c.portal || c.stone || c.lane || c.stop === 'grube') continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    const [u, v] = site.uv(x, y);
    const [, o] = mouthward(u, v);
    // im Lokschuppen nur die vordere Reihe am Gleis (dort schläft der Siebenschläfer), hinten steht mit Bau 2 die Wand
    const shed = shedAt(u, v) && u !== GROTTE.shed.side;
    if (o < 2 || stationAt(u, v) || shed || !(u ** 2 / rx ** 2 + v ** 2 / ry ** 2 < 1)) continue;
    out.push([x, y]);
  }
  return out;
}
