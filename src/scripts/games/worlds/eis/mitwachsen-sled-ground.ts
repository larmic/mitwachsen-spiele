// Strecke des Schlittens im Gletscherkessel und Platz seines Schuppens – rein und deterministisch, im Bau des Kessels
// ganz zuletzt (nach Glockenspiel, vor Wohnplätzen und Wohnorten der Tiere): So wird nichts neu gewürfelt, und
// gespeicherte Schneemänner bleiben, wo sie sind. Die Strecke ist eine Schneespur neben der Rutschspur: vom ersten
// Feld hinter dem Tor gerade durch den Gang (zwei Felder neben der Rutschspur, `trackU`), dann auf dem günstigsten Weg
// (Suche mit Kosten) bis vor den Schuppen. Der Schuppen (3 × 2 Felder, `shedOf`) steht gleich neben der Plattform des
// Eis-Portals am Schneebett (dort sieht man ihn vom Bett aus), auf der Seite der Strecke; die Strecke läuft gerade in
// seine Tür. Auf Strecke und Schuppen weichen nur
// Tannen und Eisblöcke; Felder der Strecke tragen `ride`. Den Schuppen zeigt erst das Fahrzeug (ein Körper, keine
// Zierde im Feld). Auf der Lichtung liegt die Strecke nie im Feld (mitwachsen-sled-route.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import { fromKey } from '../../../../lib/games/chunks';
import type { Point } from '../../../../data/games/mitwachsen';
import type { RideId } from '../../../../data/games/mitwachsen-rides';
import type { Cell } from '../../mitwachsen-cell';
import type { Gang, KesselPlace } from '../../mitwachsen-pack-types';
import { key } from './mitwachsen-flood';

/** Lage des Tals samt Mitte (t im Gang), wie `placeKessel` sie liefert */
type Valley = KesselPlace & { centre: number };

/** So weit (Luftlinie) steht die Mitte des Schuppens von der Mitte der Plattform des Eis-Portals am Schneebett */
export const SHED_NEAR = { near: 4, far: 9 } as const;
/** Die Strecke hält mindestens so viele Felder Abstand zur Rutschspur (Schachbrett-Abstand) */
export const SLIDE_GAP = 2;
/** … und so viele zu Plattformen des Eis-Portals (am Gegenstück, das auf der Achse der Rutschspur steht: |u| ≥ 4) */
const PLATFORM_GAP = 3;
const RIDE: RideId = 'schlitten';
/** Kosten eines Felds, auf dem eine Tanne oder ein Eisblock weichen müsste (lieber außen herum) */
const CLEAR = 12;
/** Kosten eines Felds neben einem Schneehaufen, Kristall, einer Fischkiste oder einem Eiszapfen */
const BESIDE_THING = 3;

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Gang-u der Strecke: Sie liegt in der Bucht vor dem Tor bei u = −2 der Torplatte (`plateRow`, u wächst nach
 * [−out.y, out.x]); `gang.at` zählt u in Richtung von x bzw. y. Je nach Lage des Tors ist das +2 oder −2.
 */
export function trackU(gang: Pick<Gang, 'at'>): number {
  const [ox, oy] = gang.at(0, 0);
  const out = [gang.at(0, 1)[0] - ox, gang.at(0, 1)[1] - oy] as const;
  const across = [gang.at(1, 0)[0] - ox, gang.at(1, 0)[1] - oy] as const;
  return -2 * (across[0] * -out[1] + across[1] * out[0]);
}

/**
 * Felder des Schuppens vor dem Halt `stop`, in den die Strecke aus Richtung `[dx, dy]` (vom vorletzten Feld zum Halt)
 * hineinläuft: 3 Felder breit, 2 tief, gleich hinter dem Halt
 */
export function shedOf([sx, sy]: Point, [dx, dy]: Point): Point[] {
  const out: Point[] = [];
  for (let a = 1; a <= 2; a++) for (let b = -1; b <= 1; b++) out.push([sx + dx * a - dy * b, sy + dy * a + dx * b]);
  return out;
}

/** Ist das Feld ein Eisblock zum Klettern (eine Stufe über dem Schnee, kein See, kein Eisberg)? */
const isBlock = (c: Cell) => c.ground === 'ice' && c.h >= 2 && !c.solid && !c.color && !c.slide;
/** Muss hier etwas weichen (Tanne, Eisblock)? */
const blocked = (c: Cell) => c.tree === 'snowpine' || isBlock(c);
/** Das Feld, wenn Tanne oder Eisblock geweicht sind: Schnee auf seiner Höhe (der Block sinkt auf den Schnee ringsum) */
const cleared = (c: Cell): Cell =>
  c.tree === 'snowpine'
    ? { ...c, deco: null, solid: false, tree: undefined }
    : isBlock(c)
      ? { ...c, ground: 'snow', h: c.h - 1 }
      : c;

/** Alle Felder bis `r` (Schachbrett) um die Felder `cells` */
function grow(cells: Iterable<string>, r: number): Set<string> {
  const out = new Set<string>();
  for (const k of cells) {
    const [x, y] = fromKey(k);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.add(key(x + dx, y + dy));
  }
  return out;
}

/**
 * Wo die Strecke nie liegt: Rutschspur und `SLIDE_GAP − 1` daneben, Plattformen samt `PLATFORM_GAP − 1`, Wiese,
 * Klangstein, Fischkisten und Eiszapfen samt Nachbarn; außerdem jedes Feld, das nicht blanker Boden des Kessels ist
 * (Seen, Eisfall, Eisberg, Wasser, Festes außer Tannen)
 */
function forbidden(cells: readonly Point[], map: ReadonlyMap<string, Cell>) {
  const pick = (f: (c: Cell) => boolean) => cells.map(([x, y]) => key(x, y)).filter((k) => f(map.get(k)!));
  const near = new Set([
    ...grow(
      pick((c) => !!c.slide),
      SLIDE_GAP - 1,
    ),
    ...grow(
      pick((c) => !!c.portal),
      PLATFORM_GAP - 1,
    ),
    ...grow(
      pick((c) => !!c.garden || c.deco === 'klangstein' || c.deco === 'fishcrate' || c.deco === 'icicle'),
      1,
    ),
  ]);
  return (x: number, y: number) => {
    const c = map.get(key(x, y));
    if (!c || c.region !== 'eis' || near.has(key(x, y)) || c.ground === 'water' || c.deco === 'bed') return true;
    if (c.solid) return c.tree !== 'snowpine';
    return c.ground === 'ice' && !isBlock(c);
  };
}

/**
 * Strecke und Schuppen in die Karte bauen (`map`, der fertige Kessel): Liefert die Felder von Strecke und Schuppen
 * (als "x,y"; dort wohnt kein Tier). Findet sich kein Platz, bleibt alles, wie es war (dann gibt es keinen Schlitten).
 */
export function sledGround(gang: Gang, place: Valley, map: Map<string, Cell>): ReadonlySet<string> {
  const u = trackU(gang);
  const straight: Point[] = [];
  let t = gang.depth + 1;
  for (; t < place.centre && map.get(key(...gang.at(u, t)))?.region !== 'eis'; t++) straight.push(gang.at(u, t));
  const mouth = gang.at(u, t);
  const no = forbidden(place.cells, map);
  if (no(...mouth)) return new Set();
  const height = (x: number, y: number) => cleared(map.get(key(x, y))!).h;
  const spots = shedSpots(gang, place, map, no, height);
  for (const { stop, dir, shed } of spots) {
    const shut = new Set(
      [...shed, ...N4.map(([dx, dy]): Point => [stop[0] + dx, stop[1] + dy]), stop].map((p) => key(...p)),
    );
    const before: Point = [stop[0] - dir[0], stop[1] - dir[1]];
    shut.delete(key(...before));
    const way = cheapest(mouth, before, (x, y) => no(x, y) || shut.has(key(x, y)), map, height);
    if (!way) continue;
    const track = induced([...straight, ...way, stop], height);
    for (const [x, y] of [...track, ...shed]) map.set(key(x, y), cleared(map.get(key(x, y))!));
    for (const [x, y] of track) map.set(key(x, y), { ...map.get(key(x, y))!, ride: RIDE });
    return new Set([...track, ...shed].map((p) => key(...p)));
  }
  return new Set();
}

type ShedSpot = { stop: Point; dir: Point; shed: Point[]; cost: number };

/**
 * Plätze für den Schuppen, der beste zuerst: Mitte `SHED_NEAR` von der Plattform des Eis-Portals am Schneebett, auf der
 * Seite der Strecke (über die Rutschspur führt sie nie), alle Felder samt Halt und dem Feld davor eben und erlaubt.
 * Bevorzugt, wo am wenigsten weichen muss, dann so nah wie möglich an der Plattform. Ohne Plattform keiner.
 */
function shedSpots(
  gang: Gang,
  { cells }: Valley,
  map: ReadonlyMap<string, Cell>,
  no: (x: number, y: number) => boolean,
  height: (x: number, y: number) => number,
): ShedSpot[] {
  const [ox, oy] = gang.at(0, 0);
  const across = [gang.at(1, 0)[0] - ox, gang.at(1, 0)[1] - oy] as const;
  const side = Math.sign(trackU(gang));
  const plate = cells.find(([x, y]) => {
    const p = map.get(key(x, y))?.portal;
    return p?.side === 'home' && p.at === 'centre';
  });
  if (!plate) return [];
  const spots: ShedSpot[] = [];
  for (const stop of cells)
    for (const dir of N4) {
      const [cx, cy] = [stop[0] + dir[0] * 1.5 - plate[0], stop[1] + dir[1] * 1.5 - plate[1]];
      const r = Math.hypot(cx, cy);
      if (r < SHED_NEAR.near || r > SHED_NEAR.far) continue;
      if ((cx * across[0] + cy * across[1]) * side <= 0) continue;
      const shed = shedOf(stop, dir);
      const all = [...shed, stop, [stop[0] - dir[0], stop[1] - dir[1]] as const];
      if (all.some(([x, y]) => no(x, y))) continue;
      const h = height(...stop);
      if (all.some(([x, y]) => height(x, y) !== h)) continue;
      const clear = all.filter(([x, y]) => blocked(map.get(key(x, y))!)).length;
      spots.push({ stop, dir, shed, cost: clear * 100 + r });
    }
  return spots.sort((a, b) => a.cost - b.cost || a.stop[0] - b.stop[0] || a.stop[1] - b.stop[1]);
}

/**
 * Günstigster Weg von `from` nach `to` über erlaubte Felder (Schritte höchstens eine Stufe, nachdem Tannen und
 * Eisblöcke geweicht sind): jedes Feld 1, Tanne oder Eisblock darauf `CLEAR`, neben Haufen, Kristall, Kiste oder
 * Zapfen `BESIDE_THING`, Höhenwechsel 1 mehr. Ohne Weg undefined.
 */
function cheapest(
  from: Point,
  to: Point,
  no: (x: number, y: number) => boolean,
  map: ReadonlyMap<string, Cell>,
  height: (x: number, y: number) => number,
): Point[] | undefined {
  const cost = (x: number, y: number) => {
    const c = map.get(key(x, y))!;
    let n = 1 + (blocked(c) ? CLEAR : 0) + (c.deco === 'cloudpuff' ? 1 : 0);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const d = map.get(key(x + dx, y + dy));
        if (d && d.solid && d.tree !== 'snowpine' && d.region === 'eis') n += BESIDE_THING;
      }
    return n;
  };
  const dist = new Map<string, number>([[key(...from), 0]]);
  const prev = new Map<string, string>();
  const buckets: Point[][] = [[from]];
  for (let d = 0; d < buckets.length; d++)
    for (const [x, y] of buckets[d] ?? []) {
      if (dist.get(key(x, y)) !== d) continue;
      if (x === to[0] && y === to[1]) {
        const path: Point[] = [];
        for (let k: string | undefined = key(x, y); k; k = prev.get(k)) path.unshift(fromKey(k));
        return path;
      }
      for (const [dx, dy] of N4) {
        const [nx, ny] = [x + dx, y + dy];
        if (no(nx, ny) || Math.abs(height(nx, ny) - height(x, y)) > 1) continue;
        const nd = d + cost(nx, ny) + (height(nx, ny) !== height(x, y) ? 1 : 0);
        if (nd >= (dist.get(key(nx, ny)) ?? Infinity)) continue;
        dist.set(key(nx, ny), nd);
        prev.set(key(nx, ny), key(x, y));
        (buckets[nd] ??= []).push([nx, ny]);
      }
    }
  return undefined;
}

/**
 * Abkürzungen herausnehmen: Berührt ein Feld ein späteres (nicht das nächste), fällt alles dazwischen weg. So berührt
 * jedes Feld der Strecke nur seinen Vorgänger und Nachfolger, und eine Suche über die Felder mit `ride` findet genau sie.
 */
function induced(path: readonly Point[], height: (x: number, y: number) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i]!;
    out.push([x, y]);
    for (let j = path.length - 1; j > i + 1; j--) {
      const [jx, jy] = path[j]!;
      if (Math.abs(jx - x) + Math.abs(jy - y) === 1 && Math.abs(height(jx, jy) - height(x, y)) <= 1) {
        i = j - 1;
        break;
      }
    }
  }
  return out;
}
