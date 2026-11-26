// Gleis der Höhlenbahn als Boden – rein und deterministisch: Derselbe Seed und Ausbau ergeben dasselbe Gleis. Das Paket
// der Bahn legt es in die fertig gebaute Karte (`WorldPack.lay`), erst ab Ausbau 1 (`packs.bahn.built`, vorher legt es
// nichts und die Lichtung bleibt, wie sie ist), nur auf Lichtung, Gang und Grotte, und rechnet es nur aus deren Feldern
// (es kennt kein anderes Paket). Die eine Linie:
// - Bahnhof Bär auf der Lichtung (mitwachsen-bear.ts): je Seed gesucht, Mitte 13 bis 16 Felder vom Bett, 20 bis 30°
//   neben dem Strahl vom Bett zum Höhlentor, 12 bis 16 Schritte vom Bett, Bahnsteig 2 × 7 mit dem Gleis daneben. Wo er
//   liegt, markiert `Cell.stop` (gebaut wird der Bahnsteig später). Der Fußweg vom Bett zur Torplatte weicht ihm aus.
// - Von dort die Trasse (mitwachsen-trace.ts) bis vor die Bucht, durch das Tunnelportal und den oben offenen Einschnitt
//   auf die Spur u −2 der Bucht, bis an den Prellbock vor der Tür (Ende des Ausbaus 1). Portal, Einschnitt, die Felder
//   davor und die, auf denen die Trasse in diese Spur einbiegt, liegen fest und werden eben gemacht (der Einschnitt geht
//   durch das Gelände). Auf der Lichtung darf die Trasse in Hügel einschneiden und Teiche auf einem Damm queren.
// - Ausbau 2: durch die Tür und den Gang auf derselben Spur, in der Grotte bis an das Gleis hinter dem Bahnhof Fledermaus
//   (dessen Platz die Grotte frei hält und markiert, `Cell.stop`), so lang wie der Bahnsteig.
// Die Trasse meidet Wiese, Tröge, Unterstand, Plattformen, Torplatten und Klangsteine samt einem Feld ringsum (in der
// Grotte auch den Platz des künftigen Klangsteins am Lokschuppen, `Cell.stone`) und den
// Fußweg vom Bett zur Torplatte; sie biegt rechtwinklig mit mindestens vier Feldern Gerade dazwischen, Rampen höchstens
// eine Stufe je drei Felder. Gesucht wird begrenzt (`LINE.tries`, `LINE.budget`). Das Gleis ist Boden (`Cell.ride`,
// begehbar wie die Rutschspur); was dort liegt, sagt `Cell.rail`. Gibt es keinen Platz (Teiche liegen im Bereich von
// Bahnhof Bär; offene Frage an den Vater, docs/todo.md), liegt kein Gleis. Teil des Pakets der Bahn (index.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden)

import { fromKey } from '../../../../lib/games/chunks';
import type { Point } from '../../../../data/games/mitwachsen';
import { LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { RideId } from '../../../../data/games/mitwachsen-rides';
import type { Cell, Rail } from '../../mitwachsen-cell';
import type { Door, Laid } from '../../mitwachsen-pack-types';
import { aroundOf, bayAt, bearFits, bearSpots, level, snapshot, wallOf, type Station } from './mitwachsen-bear';
import { builtOf } from './mitwachsen-built';
import { clearWay, footpath, kept, key, near, settle, standable, stepsTo, walk } from './mitwachsen-ground';
import { LETTERS, STEPS, dirOf, gridOf, trace, type Grid, type Leg } from './mitwachsen-trace';

const RIDE: RideId = 'hoehle';
const RULES = { straight: LINE.straight, ramp: LINE.ramp, turn: LINE.turn };
/** Auf der Lichtung mit Einschnitten, in der Grotte liegt das Gleis auf dem Boden */
const CUT_RULES = { ...RULES, cut: LINE.dig };
/** Reihen vor der Tür bis zum äußeren Ende der festen Strecke: Bucht (3), Einschnitt, Portal, gerade Felder davor */
export const APPROACH = 3 + LINE.cut + 1 + LINE.lead;
/** t des Tunnelportals und des Einschnitts (Reihen vor der Tür, negativ) */
export const PORTAL_T = -(3 + LINE.cut + 1);

/** Die Linie, wie sie gelegt wurde: alle Felder von Bahnhof Bär an, wo Ausbau 1 endet (`buffer`), und die zwei Bahnhöfe */
export type Line = {
  cells: Point[];
  buffer: number;
  bear: { lane: Point[]; platform: Point[] };
  bat?: { lane: Point[]; platform: Point[] };
};

/**
 * Raster um die Felder `ends` (mit Rand), offen, wo `ok` gilt; Wasser (nur wo `ok` es zulässt) gilt als Damm auf Höhe 1,
 * der `LINE.dam` mehr kostet
 */
function gridAround(
  map: Map<string, Cell>,
  ends: readonly Point[],
  ok: (c: Cell, x: number, y: number) => boolean,
): Grid {
  const xs = ends.map((p) => p[0]),
    ys = ends.map((p) => p[1]);
  const m = LINE.margin;
  return gridOf(Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m, (x, y) => {
    const c = map.get(key(x, y));
    if (!c || !ok(c, x, y)) return null;
    return c.ground === 'water' ? [1, LINE.dam] : [c.h, 0];
  });
}

/**
 * Das Gleis als Felder schreiben: Richtungen in Reihe der Linie (zurück, vor), Ausbau, wie weit das Stück in seinem
 * Ausbau liegt (`along`, für die Gleiswelle beim Bau), was dort steht. Der Bahnsteig von Bahnhof Bär liegt eine Stufe
 * über dem Gleis (Holzplanken auf festgetretenem Boden, `path`); den
 * Platz von Bahnhof Fledermaus markiert vor Bau 2 nur `Cell.stop`, ab Ausbau 2 liegt sein Bahnsteig wie der von Bahnhof
 * Bär eine Stufe über dem Gleis (Stein), und die Rückwand des Lokschuppens daneben ist fest (`shedOf`)
 */
function write(map: Map<string, Cell>, line: Line, parts: ReadonlyMap<number, Rail['part']>, built: number) {
  const { cells, buffer } = line;
  const rest = Math.max(1, cells.length - 1 - buffer);
  cells.forEach((p, i) => {
    const back = i > 0 ? LETTERS[dirOf(p, cells[i - 1]!)] : '';
    const on = i < cells.length - 1 ? LETTERS[dirOf(p, cells[i + 1]!)] : '';
    const part = parts.get(i);
    const along = i <= buffer ? i / Math.max(1, buffer) : (i - buffer) / rest;
    const rail: Rail = { to: `${back}${on}`, stage: i <= buffer ? 1 : 2, along, ...(part && { part }) };
    const c = map.get(key(...p))!;
    map.set(key(...p), { ...c, ride: RIDE, rail });
  });
  for (const p of line.bear.platform) {
    const c = map.get(key(...p));
    const lane = map.get(key(...line.bear.lane[0]!))!;
    if (c)
      map.set(key(...p), {
        ...c,
        h: lane.h + 1,
        ground: 'path',
        deco: null,
        tufts: undefined,
        solid: false,
        stop: RIDE,
      });
  }
  const bat = line.bat;
  const laneH = bat && map.get(key(...bat.lane[0]!))?.h;
  for (const p of bat?.platform ?? []) {
    const c = map.get(key(...p));
    if (c && built >= 2 && laneH !== undefined)
      map.set(key(...p), { ...c, h: laneH + 1, ground: 'stone', deco: null, solid: false, stop: RIDE });
    else if (c) map.set(key(...p), { ...c, stop: RIDE });
  }
  if (bat && built >= 2)
    for (const p of shedOf(map, bat).wall) map.set(key(...p), { ...map.get(key(...p))!, solid: true });
}

/** Der Lokschuppen neben Bahnhof Fledermaus, aus dem Platz, den die Grotte frei hält (`Cell.shed`) */
export type Shed = { cells: Point[]; wall: Point[]; home?: Point; dir: Point };

/**
 * Lokschuppen: die Felder seines Platzes (`Cell.shed`, gleich neben dem Gleis von Bahnhof Fledermaus), die Rückwand (die
 * Reihe fern vom Gleis, fest), Toks Platz darunter (`home`: das Feld in der Mitte, nicht in der vorderen Reihe, dort
 * schläft der Siebenschläfer) und vom Gleis weg
 * (`dir`). Leer ohne Platz
 */
export function shedOf(cells: { get(k: string): Cell | undefined }, bat: Pick<Station, 'lane'>): Shed {
  const lane = bat.lane;
  const out: Point[] = [];
  for (const [x, y] of lane)
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) if (cells.get(key(x + dx, y + dy))?.shed === RIDE) out.push([x + dx, y + dy]);
  const all = [...new Map(out.map((p) => [key(...p), p])).values()];
  const mid = lane[Math.floor(lane.length / 2)]!;
  if (!all.length) return { cells: [], wall: [], dir: [0, 0] };
  const cx = all.reduce((a, p) => a + p[0], 0) / all.length,
    cy = all.reduce((a, p) => a + p[1], 0) / all.length;
  const [ax, ay] = [lane.at(-1)![0] - lane[0]![0], lane.at(-1)![1] - lane[0]![1]];
  const dir: Point = Math.abs(ax) > Math.abs(ay) ? [0, Math.sign(cy - mid[1]) || 1] : [Math.sign(cx - mid[0]) || 1, 0];
  const depth = (p: Point) => p[0] * dir[0] + p[1] * dir[1];
  const back = Math.max(...all.map(depth));
  const wall = all.filter((p) => depth(p) === back);
  const free = all.filter((p) => depth(p) !== back);
  const far = (p: Point) => Math.hypot(p[0] - cx, p[1] - cy);
  const home = free.filter((p) => depth(p) !== Math.min(...free.map(depth))).sort((a, b) => far(a) - far(b))[0];
  return { cells: all, wall, dir, ...(home && { home }) };
}

/** Hängen die Felder als Kette von Nachbarn zusammen, ohne ein Feld zweimal und ohne sich selbst zu berühren? */
export function clean(cells: readonly Point[]): boolean {
  const at = new Map(cells.map((p, i) => [key(...p), i]));
  if (at.size !== cells.length) return false;
  return cells.every((p, i) =>
    STEPS.every(([dx, dy]) => {
      const j = at.get(key(p[0] + dx, p[1] + dy));
      return j === undefined || Math.abs(j - i) === 1;
    }),
  );
}

/**
 * Feste Strecke vor der Tür des Höhlentors: Bucht, Einschnitt, Portal, gerade Felder davor (`approach`, zur Tür hin);
 * dahinter die Felder, auf denen das Gleis in diese Spur einbiegt (`lead`). Alles eben und frei gemacht (der Einschnitt
 * geht durch das Gelände), dazu wenn nötig ein freier Gang vor der Bucht (`clearWay`). `reserved`: alle diese Felder
 */
function approachOf(map: Map<string, Cell>, g: Door, wake: readonly Point[]) {
  const at = bayAt(g);
  const approach = Array.from({ length: APPROACH }, (_, i) => at(LINE.lane, -APPROACH + i));
  const lead = Array.from({ length: LINE.straight + 2 }, (_, i) => at(LINE.lane, -APPROACH - 1 - i));
  for (const p of [...lead, ...approach]) {
    const c = map.get(key(...p));
    const keep = c && c.region === 'lichtung' && c.ground !== 'water' && c.ground !== 'stone';
    map.set(key(...p), { h: 1, ground: keep ? c.ground : 'grass', deco: null, region: 'lichtung', solid: false });
  }
  settle(map, [...lead, ...approach]);
  const reserved = new Set([...approach, ...lead].map((p) => key(...p)));
  clearWay(map, at, wake, reserved);
  return { approach, fixed: new Set(approach.map((p) => key(...p))), reserved };
}

/** Bahnhof Bär, eben gemacht: Liegt er `LINE.bear.steps` Schritte vom Bett, alle Felder zu Fuß erreichbar? */
function bearSteps(map: Map<string, Cell>, station: Station, wake: readonly Point[], walked: ReadonlySet<string>) {
  const [lo, hi] = LINE.bear.steps;
  if (![...station.lane, ...station.platform].every((p) => walked.has(key(...p)))) return false;
  const steps = stepsTo(map, wake, new Set(station.platform.map((p) => key(...p))));
  return steps >= lo && steps <= hi;
}

/** Hängen `from` und `to` über offene Felder des Rasters zusammen (vier Richtungen, ohne Regeln eines Gleises)? */
export function joined(grid: Grid, from: Point, to: Point): boolean {
  const idx = ([x, y]: Point) => (y - grid.y0) * grid.w + (x - grid.x0);
  const inside = ([x, y]: Point) => x >= grid.x0 && y >= grid.y0 && x < grid.x0 + grid.w && y < grid.y0 + grid.h;
  if (!inside(from) || !inside(to) || !grid.open[idx(from)]) return false;
  const seen = new Uint8Array(grid.w * grid.h);
  const queue: Point[] = [from];
  seen[idx(from)] = 1;
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (x === to[0] && y === to[1]) return true;
    for (const [dx, dy] of STEPS) {
      const q: Point = [x + dx, y + dy];
      if (!inside(q) || seen[idx(q)] || !grid.open[idx(q)]) continue;
      seen[idx(q)] = 1;
      queue.push(q);
    }
  }
  return false;
}

/** Was die Suche der Trasse auf der Lichtung kennt: feste Strecke, Ziel, Bett und wer wohin kommt */
type Ground = {
  map: Map<string, Cell>;
  g: Door;
  home: { bed: Point; wake: readonly Point[] };
  fixed: ReadonlySet<string>;
  reserved: ReadonlySet<string>;
  goal: Point;
};

/**
 * Trasse von Bahnhof Bär (eben gemacht) bis vor die Bucht: Der Fußweg vom Bett zur Torplatte weicht dem Bahnhof aus,
 * zuerst innen zwischen Bahnhof und Strahl, sonst außen um ihn herum (`wallOf`); die Trasse meidet ihn. Gesucht wird nur,
 * wo Bahnhof und Ziel überhaupt zusammenhängen (`joined`), höchstens `budget.left` Mal. null, wenn nichts passt
 */
function traceFrom(at: Ground, station: Station, walked: ReadonlySet<string>, budget: { left: number }) {
  const { map, g, home, fixed, reserved, goal } = at;
  const out = dirOf([0, 0], g.out);
  const all = [...station.lane, ...station.platform];
  const taken = new Set(all.map((p) => key(...p)));
  const start = station.lane.at(-1)!;
  const dir = station.dir ?? out;
  const first: Point = [start[0] + STEPS[dir]![0], start[1] + STEPS[dir]![1]];
  for (const inner of [true, false]) {
    const blocked = new Set([...reserved, ...aroundOf(station), ...wallOf(station, g, home.bed, inner)]);
    const path = new Set(footpath(map, home.wake, bayAt(g)(0, -2), blocked).map((p) => key(...p)));
    if (!path.size) continue;
    const grid = gridAround(
      map,
      [start, goal],
      (c, x, y) =>
        !c.solid &&
        !c.gate &&
        c.region === 'lichtung' &&
        (walked.has(key(x, y)) || c.ground === 'water') &&
        !taken.has(key(x, y)) &&
        (!fixed.has(key(x, y)) || (x === goal[0] && y === goal[1])) &&
        !path.has(key(x, y)) &&
        !near(map, [x, y], 1, kept),
    );
    if (!joined(grid, first, goal) || budget.left <= 0) continue;
    budget.left--;
    const z = map.get(key(...start))!.h;
    const leg: Leg = { from: start, z, dir, run: LINE.bear.long, flat: LINE.ramp, to: goal, toDir: out };
    const found = trace(grid, leg, CUT_RULES, LINE.budget);
    if (found) return found;
  }
  return null;
}

/**
 * Das Gleis auf der Lichtung: Bahnhof Bär (der erste Platz im Bereich des Konzepts, `LINE.bear.steps` Schritte vom Bett,
 * von dem aus eine Trasse bis vor die Bucht passt; höchstens `LINE.tries` Trassen-Suchen) und die Felder von seinem
 * Prellbock bis an den Prellbock vor der Tür; null, wenn nichts passt. Einschnitte und Dämme der Trasse werden ins
 * Gelände gelegt
 */
function lichtungLine(map: Map<string, Cell>, g: Door, home: { bed: Point; wake: readonly Point[] }) {
  const { approach, fixed, reserved } = approachOf(map, g, home.wake);
  const reach = walk(map, home.wake);
  const at: Ground = { map, g, home, fixed, reserved, goal: approach[0]! };
  const budget = { left: LINE.tries };
  for (const station of bearSpots(g, home.bed)) {
    if (budget.left <= 0) break;
    if (!bearFits(station, g, home.bed, map, reach, reserved)) continue;
    const undo = snapshot(map, [...station.lane, ...station.platform]);
    level(map, station);
    const walked = walk(map, home.wake);
    const found = bearSteps(map, station, home.wake, walked) && traceFrom(at, station, walked, budget);
    const cells = found ? [...station.lane, ...found.cells.slice(1), ...approach.slice(1)] : [];
    if (found && clean(cells)) {
      // Einschnitte: das Gleis tiefer als das Gelände, die Felder ringsum rücken mit herunter; Dämme durch Teiche
      found.cells.forEach((p, i) => {
        const c = map.get(key(...p))!;
        if (c.ground === 'water') map.set(key(...p), { ...c, h: 1, ground: 'grass', deco: null });
        else if (found.z[i]! < c.h) map.set(key(...p), { ...c, h: found.z[i]! });
      });
      settle(map, found.cells, 3);
      return { station, cells };
    }
    undo();
  }
  return null;
}

/**
 * Das Gleis der Höhlenbahn in die Karte legen (`WorldPack.lay`): Lichtung bis zum Prellbock, mit der Grotte (ihre
 * Felder sind da) weiter bis zum Bahnhof Fledermaus. Liefert die Linie, null, wenn auf der Lichtung keine passt
 */
export function layLine({ seed, map, gates, beds, packs }: Laid): Line | null {
  if (!builtOf(packs)) {
    remember(seed, map, gates, beds); // vor Ausbau 1 bleibt die Lichtung, wie sie ist (Tok rechnet nur den Platz)
    return null;
  }
  const g = gates.get('hoehle');
  const home = beds.get('lichtung');
  const lichtung = g && home && lichtungLine(map, g, home);
  if (!g || !home || !lichtung) return null;
  const line: Line = { cells: lichtung.cells, buffer: lichtung.cells.length - 1, bear: lichtung.station };
  const bat = grotto(map, g, beds.get('hoehle')?.bed, line.cells);
  if (bat) {
    line.cells = [...line.cells, ...bat.cells];
    line.bat = bat.station;
  }
  const portal = line.buffer - (2 + LINE.cut + 1); // Prellbock in Reihe −1, Portal in Reihe −(3 + cut + 1)
  const parts = new Map<number, Rail['part']>([
    [0, 'end'],
    [portal, 'portal'],
    ...Array.from({ length: LINE.cut }, (_, i): [number, Rail['part']] => [portal + 1 + i, 'cut']),
    [line.buffer, line.bat ? 'buffer' : 'end'],
  ]);
  if (line.bat) parts.set(line.cells.length - 1, 'end');
  write(map, line, parts, builtOf(packs));
  return line;
}

/**
 * Ausbau 2: vom Prellbock (letztes Feld von `before`) durch Tür und Gang in die Grotte, bis an das Ende des Gleises
 * hinter dem Bahnsteig von Bahnhof Fledermaus (Platz aus `Cell.stop` der Grotte, das Gleis auf der Seite fern vom
 * Höhlenbett); null ohne Grotte oder ohne Weg
 */
function grotto(
  map: Map<string, Cell>,
  g: Door,
  bed: Point | undefined,
  before: readonly Point[],
): { station: Station; cells: Point[] } | null {
  const platform: Point[] = [];
  for (const [k, c] of map) if (c.stop === RIDE && c.region === 'hoehle') platform.push(fromKey(k));
  if (!bed || !platform.length) return null;
  const xs = platform.map((p) => p[0]),
    ys = platform.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const alongY = y1 - y0 > x1 - x0;
  const lanes: Point[][] = alongY
    ? [x0 - 1, x1 + 1].map((x) => Array.from({ length: y1 - y0 + 1 }, (_, i): Point => [x, y0 + i]))
    : [y0 - 1, y1 + 1].map((y) => Array.from({ length: x1 - x0 + 1 }, (_, i): Point => [x0 + i, y]));
  const far = (l: Point[]) => Math.hypot(l[0]![0] - bed[0], l[0]![1] - bed[1]);
  const lane = lanes.sort((a, b) => far(b) - far(a))[0]!;
  const taken = new Set(platform.map((p) => key(...p)));
  const used = new Set(before.map((p) => key(...p)));
  const start = before.at(-1)!;
  const door = bayAt(g)(LINE.lane, 0);
  const grid = gridAround(map, [start, ...lane], (c, x, y) => {
    if (x === door[0] && y === door[1]) return c.gate === 'hoehle';
    return (
      (c.region === 'hoehle' || c.region === 'wild') &&
      standable(c) &&
      !taken.has(key(x, y)) &&
      !used.has(key(x, y)) &&
      !near(map, [x, y], 1, (n) => !!n.portal || !!n.garden || !!n.stone) // nicht am Platz des Klangsteins am Lokschuppen
    );
  });
  const out = dirOf([0, 0], g.out);
  let best: { cells: Point[]; cost: number } | null = null;
  const z = map.get(key(...start))!.h;
  for (const way of [lane, [...lane].reverse()]) {
    const toDir = dirOf(way[0]!, way[1]!);
    const leg: Leg = { from: start, z, dir: out, run: RULES.straight + 1, flat: LINE.ramp, to: way[0]!, toDir };
    const found = trace(grid, leg, RULES);
    const h = map.get(key(...way[0]!))?.h;
    const flat = way.every(
      (p) => grid.open[(p[1] - grid.y0) * grid.w + (p[0] - grid.x0)] && map.get(key(...p))?.h === h,
    );
    if (found && flat && (!best || found.cost < best.cost))
      best = { cells: [...found.cells.slice(1), ...way.slice(1)], cost: found.cost };
  }
  if (!best || !clean([...before, ...best.cells])) return null;
  return { station: { lane: best.cells.slice(-lane.length), platform }, cells: best.cells };
}

/** Vor Ausbau 1: Kopie der Karte je Seed, aus der `futureBear` den künftigen Bahnhof Bär rechnet (höchstens `KEEP` Seeds) */
const before = new Map<number, Pick<Laid, 'map' | 'gates' | 'beds'>>();
/** Gerechnete künftige Bahnhöfe Bär je Seed (null: Auf der Lichtung passt keine Linie) */
const bears = new Map<number, Station | null>();
const KEEP = 4;

function remember(seed: number, map: Map<string, Cell>, gates: Laid['gates'], beds: Laid['beds']) {
  before.delete(seed);
  bears.delete(seed);
  before.set(seed, { map: new Map(map), gates, beds }); // die Karte wie bei Ausbau 1, bevor die Lichtung sich schließt
  for (const k of before.keys()) if (before.size > KEEP) before.delete(k);
}

/**
 * Wo Bahnhof Bär liegen wird, solange noch nichts gebaut ist (Ausbau 0; Tok wartet dort): derselbe Platz, den Ausbau 1
 * legt, gerechnet auf einer Kopie der Karte, ohne die Welt zu ändern, erst wenn Tok ihn braucht, und je Seed einmal
 * (die Suche dauert im Mittel gut 40 ms). null, wenn auf der Lichtung keine Linie passt; undefined, wenn das Paket die
 * Welt dieses Seeds nicht vor Ausbau 1 gesehen hat
 */
export function futureBear(seed: number): Station | null | undefined {
  if (bears.has(seed)) return bears.get(seed);
  const laid = before.get(seed);
  if (!laid) return undefined;
  const g = laid.gates.get('hoehle');
  const home = laid.beds.get('lichtung');
  const found = (g && home && lichtungLine(laid.map, g, home)?.station) || null;
  bears.set(seed, found);
  before.delete(seed); // gerechnet: Die Kopie braucht es nicht mehr
  for (const k of bears.keys()) if (bears.size > KEEP) bears.delete(k);
  return found;
}
