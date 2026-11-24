// Klangsteine der Bahn – rein und deterministisch: Das Paket der Bahn setzt sie beim Legen (`WorldPack.lay`), so wie es
// das Gleis legt, und nur mit dem Ausbau, zu dem sie gehören; vorher und ohne Paket (bis zum Freischalten, `BAHN_LIVE`)
// gibt es sie nicht. Am Bahnhof Bär ab Ausbau 1 (`bahnhof`, neben Toks Häuschen, zwei Felder vom Bahnhof und vom Gleis,
// notfalls drei oder vier),
// am Lokschuppen ab Ausbau 2 (`lokschuppen`, Toks Geschichte, auf dem Platz, den die Grotte neben dem Schuppen frei hält,
// `Cell.stone`). Teil des Pakets der Bahn (index.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Klangsteine“)

import type { Point } from '../../../../data/games/mitwachsen';
import type { StoryId } from '../../../../data/games/mitwachsen-stories';
import type { Cell } from '../../mitwachsen-cell';
import type { Laid } from '../../mitwachsen-pack-types';
import { hutOf, type Station } from './mitwachsen-bear';
import { builtOf } from './mitwachsen-built';
import { N8, kept, key, near, standable, walk } from './mitwachsen-ground';
import { shedOf, type Line } from './mitwachsen-line';

/** So weit (Chebyshev) steht der Stein am Bahnhof Bär von Bahnsteig und Gleis: zwei Felder, passt dort keins, drei, dann vier */
export const STONE_GAPS: readonly number[] = [2, 3, 4];

/** Ein Klangstein auf dem Feld, sonst wie es war */
const stoneOn = (c: Cell, story: StoryId): Cell => ({ ...c, deco: 'klangstein', solid: true, story, tufts: undefined });

/**
 * Passt der Stein hierher: ein freies Feld der Gegend `region`, zu Fuß vom Bett erreichbar (`reach`), ohne Gleis und Bahnsteig, ringsum alle acht Nachbarn frei
 * und auf derselben Höhe (so kommt man immer um ihn herum, er schneidet keinen Weg ab), und nichts Gemiedenes
 * (Plattform, Wiese, Torplatte, Klangstein) näher als zwei Felder
 */
function fits(map: ReadonlyMap<string, Cell>, [x, y]: Point, region: Cell['region'], reach: ReadonlySet<string>) {
  const c = map.get(key(x, y));
  if (!reach.has(key(x, y)) || !standable(c) || c.region !== region || c.ride || c.stop) return false;
  const free = N8.every(([dx, dy]) => {
    const n = map.get(key(x + dx, y + dy));
    return standable(n) && n.region === region && !n.ride && !n.stop && n.h === c.h;
  });
  return free && !near(map as Map<string, Cell>, [x, y], 2, kept);
}

/**
 * Platz des Steins am Bahnhof Bär: unter den Feldern genau zwei Felder von Bahnsteig und Gleis (passt dort keins, drei,
 * dann vier, `STONE_GAPS`) das, das passt (`fits`, erreichbar über `reach`) und Toks Häuschen am nächsten liegt (am Kopf
 * des Bahnhofs fern vom Bett, der Weg vom Bett zum Bahnsteig bleibt, wie er war); undefined, wenn keins passt
 */
export function bearStone(
  map: ReadonlyMap<string, Cell>,
  station: Station,
  bed: Point,
  reach: ReadonlySet<string>,
): Point | undefined {
  const all = [...station.lane, ...station.platform];
  const head = hutOf(station, bed)?.at ?? all.at(-1)!;
  const far = (p: Point) => Math.hypot(p[0] - head[0], p[1] - head[1]);
  const max = Math.max(...STONE_GAPS);
  const rings = new Map<number, Point[]>();
  const seen = new Set<string>();
  for (const [x, y] of all)
    for (let dy = -max; dy <= max; dy++)
      for (let dx = -max; dx <= max; dx++) {
        const p: Point = [x + dx, y + dy];
        if (seen.has(key(...p))) continue;
        seen.add(key(...p));
        const gap = Math.min(...all.map((q) => Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]))));
        rings.set(gap, [...(rings.get(gap) ?? []), p]);
      }
  for (const gap of STONE_GAPS) {
    const best = (rings.get(gap) ?? [])
      .filter((p) => fits(map, p, 'lichtung', reach))
      .sort((a, b) => far(a) - far(b) || a[0] - b[0] || a[1] - b[1])[0];
    if (best) return best;
  }
  return undefined;
}

/**
 * Platz des Steins am Lokschuppen: das Feld, das die Grotte dafür frei hält (`Cell.stone`), nah am Schuppen; undefined
 * ohne Platz oder wenn es nicht passt (`fits`, erreichbar über `reach` vom Höhlenbett)
 */
export function shedStone(
  map: ReadonlyMap<string, Cell>,
  bat: Pick<Station, 'lane'>,
  reach: ReadonlySet<string>,
): Point | undefined {
  const shed = shedOf(map, bat);
  for (const [x, y] of shed.cells)
    for (const [dx, dy] of N8) {
      const p: Point = [x + dx, y + dy];
      if (map.get(key(...p))?.stone === 'lokschuppen' && fits(map, p, 'hoehle', reach)) return p;
    }
  return undefined;
}

/**
 * Die Klangsteine der Bahn in die Karte setzen, nachdem das Gleis liegt (`line`, null ohne Gleis): ab Ausbau 1 am
 * Bahnhof Bär, ab Ausbau 2 am Lokschuppen. Liefert sie für `World.stones`
 */
export function layStones({ map, beds, packs }: Pick<Laid, 'map' | 'beds' | 'packs'>, line: Line | null) {
  const out: [StoryId, Point][] = [];
  const home = beds.get('lichtung');
  if (!line || !home || builtOf(packs) < 1) return out;
  const set = (story: StoryId, p: Point | undefined) => {
    if (!p) return;
    map.set(key(...p), stoneOn(map.get(key(...p))!, story));
    out.push([story, p]);
  };
  set('bahnhof', bearStone(map, line.bear, home.bed, walk(map, home.wake)));
  const cave = beds.get('hoehle');
  if (builtOf(packs) >= 2 && line.bat && cave) set('lokschuppen', shedStone(map, line.bat, walk(map, cave.wake)));
  return out;
}
