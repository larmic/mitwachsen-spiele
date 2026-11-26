// Das Grubenbähnchen Funkel – rein, ohne DOM: was das Paket der Grubenbahn in die Grotte legt (`layGrube`,
// `WorldPack.lay`) und was die Fahr-Engine (Paket der Fahrzeuge, worlds/fahrt/) über das Bähnchen wissen muss (`funkel`,
// `WorldRules.vehicle`). Die Grotte hält seine Schleife frei und markiert sie (`Cell.lane`, worlds/hoehle/mitwachsen-lane.ts);
// dieses Paket rechnet nur aus diesen Feldern und importiert das Paket der Höhle nicht. Vor dem Graben (kein Eintrag
// `packs.fahrt.grube`) legt es nichts: Gang und Nachbarn bleiben Fels. Ist der Gang gegraben (Stufe `bereit`), liegt das
// schmale Gleis auf der ganzen Runde (`Cell.ride`, Richtungen in `Lane.to`), Gang und Nachbarn sind Grottenboden; fest
// für Füße bleiben die beiden Enden des Gangs (die Klingeltore, `Cell.chimeGate`: Läuft die Figur dagegen, klingt das Tor,
// `ringGate`), die Nachbarn neben offenem Gleis (ihre Pfosten) und die Zaunkristalle zur Höhle hin. So kommt man zu Fuß
// nie in den Gang, nur mit dem Bähnchen; gesperrt ist dabei nichts, was zählt (keine Tiere, nichts zum Sammeln).
// Funkel erscheint nie von selbst: Der Maulwurf gräbt den Gang (mitwachsen-dig.ts), mit ihm kommt der Klangstein `grube`
// am Ende des Bahnsteigs (`grubeStone`); fahren tut es zuerst niemand, die Lampe ist sein Gesicht. Lok und zwei Wagen belegen am Halt drei Felder des Gleises, die Figur sitzt im ersten Wagen hinter der Lok.
// Eine Runde fährt immer vorwärts und kommt am selben Halt wieder an (`RideRoute.loop`); ausgestiegen wird auf den
// Bahnsteig an der Tür. Nach der ersten Fahrt hat die Tür keinen goldenen Rahmen mehr (`gefahren`, gespeichert).
// Spezifikation: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“)

import type { Point } from '../../../../data/games/mitwachsen';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import type { StoryId } from '../../../../data/games/mitwachsen-stories';
import { FENCE_CRYSTAL } from '../../../../data/games/worlds/grube/mitwachsen-funkel-model';
import type { Cell } from '../../mitwachsen-cell';
import type { Laid, WorldRules } from '../../mitwachsen-pack-types';
import { rank, stageOf, withRidden } from '../../mitwachsen-ride-save';
import { MAX_LAPS, type RideRoute, type Rider, type Vehicle } from '../../mitwachsen-rider';
import type { World } from '../../mitwachsen-world';

/** Funkel in `RIDES` */
export const FUNKEL = RIDES.find((r) => r.id === 'grube')!;
/** Feld des Sitzes auf dem Gleis des Halts, vom ersten Feld in Fahrtrichtung an (der hintere Wagen steht eins davor) */
export const SEAT = 5;
/** So viele Warteplätze auf dem Bahnsteig für folgende Tiere */
const WAIT = 8;
/** So weit ums Höhlenbett wird nach dem Halt gesucht (er liegt etwa 16 Felder weg) */
const SEARCH = 30;
/** Richtungen des Gleises: Buchstabe und Schritt */
const STEPS: readonly (readonly [string, number, number])[] = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
];

const key = (x: number, y: number) => `${x},${y}`;
const near8 = (x: number, y: number) =>
  [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx): Point => [x + dx, y + dy])).filter(([a, b]) => a !== x || b !== y);

/** Ist der Gang gegraben (Funkel ist da, ab Stufe `bereit`)? */
export const dug = (packs: Readonly<Record<string, unknown>>) => rank(stageOf(packs, FUNKEL.id)) >= rank('bereit');

/** Richtung von `a` zum Nachbarfeld `b` als Buchstabe */
const dirOf = (a: Point, b: Point) => STEPS.find(([, dx, dy]) => a[0] + dx === b[0] && a[1] + dy === b[1])?.[0] ?? '';

/**
 * Das Gleis der Grubenbahn legen (`WorldPack.lay`): erst, wenn der Gang gegraben ist (`dug`); vorher bleibt alles, wie
 * die Grotte es gebaut hat. Liefert den Klangstein am Grubenhalt (`grube`, kommt mit dem Graben; `grubeStone`)
 */
export function layGrube(laid: Laid): [StoryId, Point][] {
  if (!dug(laid.packs)) return [];
  const lane: [Point, Cell][] = [];
  for (const [k, c] of laid.map)
    if (c.lane?.ride === FUNKEL.id) lane.push([k.split(',').map(Number) as unknown as Point, c]);
  const track = lane.filter(([, c]) => c.lane!.at !== undefined).sort(([, a], [, b]) => a.lane!.at! - b.lane!.at!);
  if (track.length < 3) return [];
  const onTrack = new Map(track.map(([p, c]) => [key(...p), c.lane!.part]));
  const gang = track.filter(([, c]) => c.lane!.part === 'gang');
  // die beiden Enden des Gangs sind die Klingeltore: am Eingang (`in`, zuerst gefahren) und am Ausgang (`out`)
  const ends = new Map<string, 'in' | 'out'>();
  if (gang[0]) ends.set(key(...gang[0][0]), 'in');
  if (gang.at(-1)) ends.set(key(...gang.at(-1)![0]), 'out');
  const floor = (c: Cell, solid: boolean): Cell => ({ ...c, h: 1, deco: null, region: 'hoehle', solid });
  track.forEach(([p, c], i) => {
    const [prev, next] = [track[(i + track.length - 1) % track.length]![0], track[(i + 1) % track.length]![0]];
    const to = dirOf(p, prev) + dirOf(p, next);
    const gate = ends.get(key(...p));
    const base = c.lane!.part === 'gang' ? { ...floor(c, !!gate), ...(gate && { chimeGate: gate }) } : c;
    laid.map.set(key(...p), { ...base, ride: FUNKEL.id, lane: { ...c.lane!, to } });
  });
  for (const [p, c] of lane) {
    if (c.lane!.part === 'fence')
      laid.map.set(key(...p), { ...c, deco: 'crystalbush', solid: true, color: FENCE_CRYSTAL });
    // Nachbarn des Gangs werden Boden, neben offenem Gleis bleiben sie als Pfosten der Tore stehen
    else if (c.lane!.part === 'side' && !near8(...p).some((q) => onTrack.get(key(...q)) === 'open'))
      laid.map.set(key(...p), floor(c, false));
  }
  const stone = grubeStone(laid.map, track[SEAT]?.[0]);
  if (!stone) return [];
  laid.map.set(key(...stone), {
    ...laid.map.get(key(...stone))!,
    deco: 'klangstein',
    solid: true,
    story: 'grube',
    tufts: undefined,
  });
  lapStones(laid.map, track[SEAT]![0], stone).forEach((p, i) =>
    laid.map.set(key(...p), {
      ...laid.map.get(key(...p))!,
      deco: 'lapstone',
      solid: true,
      note: i + 1,
      tufts: undefined,
    }),
  );
  return [['grube', stone]];
}

/**
 * Plätze der vier Zahlensteine am Grubenhalt (Issue 48), in der Reihenfolge 1 bis 4: in der äußeren Reihe des
 * Bahnsteigs (kein Gleis unter den acht Nachbarn), am Ende gegenüber vom Klangstein `stone`, weiter als `STONES_FROM_SEAT`
 * vom Sitz (kein Warteplatz, das Aussteigen bleibt frei). Im Bild von links nach rechts (bei einem Bahnsteig von Nord
 * nach Süd von oben nach unten). Die innere Reihe davor bleibt frei: Von dort und von außen läuft man hinein. Leer, wenn
 * keine vier Platz haben
 */
export function lapStones(map: ReadonlyMap<string, Cell>, seat: Point, stone: Point): Point[] {
  const far = ([x, y]: Point, [ox, oy]: Point) => Math.hypot(x - ox, y - oy);
  const outer: Point[] = [];
  for (const [k, c] of map) {
    if (c.stop !== FUNKEL.id || !standable(c) || c.deco || c.ride) continue;
    const p = k.split(',').map(Number) as unknown as Point;
    if (far(p, seat) > STONES_FROM_SEAT && !near8(...p).some((q) => map.get(key(...q))?.ride)) outer.push(p);
  }
  const picked = outer.sort((a, b) => far(b, stone) - far(a, stone) || a[0] - b[0] || a[1] - b[1]).slice(0, MAX_LAPS);
  return picked.length < MAX_LAPS ? [] : picked.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
/** So weit (Felder) stehen die Zahlensteine mindestens vom Sitz: hinter den Warteplätzen (der fernste liegt 2,24 weg) */
export const STONES_FROM_SEAT = 2.5;

const stones = new WeakMap<World, readonly Point[]>();
/** Die Zahlensteine einer Welt in der Reihenfolge 1 bis 4 (leer vor dem Graben oder ohne Grotte), je Welt einmal */
export function lapStonesOf(world: World, s: Pick<Rider, 'packs'>): readonly Point[] {
  const seat = funkelRoute(world, s)?.stops.home;
  if (!seat) return [];
  let found = stones.get(world);
  if (found) return found;
  const all: [number, Point][] = [];
  for (let dy = -8; dy <= 8; dy++)
    for (let dx = -8; dx <= 8; dx++) {
      const c = world.cell(seat[0] + dx, seat[1] + dy);
      if (c.deco === 'lapstone') all.push([c.note ?? 0, [seat[0] + dx, seat[1] + dy]]);
    }
  stones.set(world, (found = all.sort((a, b) => a[0] - b[0]).map(([, p]) => p)));
  return found;
}

/** So viele Runden sind für Funkel gewählt (ohne Wahl und nach dem Neuladen eine) */
export const lapsOf = (s: Pick<Rider, 'laps'>) => s.laps?.[FUNKEL.id] ?? 1;

/** So weit (Felder) steht der Klangstein am Grubenhalt mindestens vom Sitz: hinter den Warteplätzen, am Ende des Bahnsteigs */
export const STONE_FROM_SEAT = 4;
/** Kann man auf dem Feld stehen (frei, kein Wasser, kein Tor)? */
const standable = (c: Cell | undefined): c is Cell => !!c && !c.solid && c.ground !== 'water' && !c.gate;

/**
 * Platz des Klangsteins am Grubenhalt: auf dem Bahnsteig (`Cell.stop` `'grube'`; dort wohnt kein Tier, so nimmt er
 * keinem einen Wohnplatz) in seiner äußeren Reihe (kein Gleis unter den acht Nachbarn), mindestens `STONE_FROM_SEAT`
 * Felder vom Sitz (die Warteplätze und das Aussteigen bleiben frei), ringsum alle acht Nachbarn frei und auf derselben
 * Höhe (man kommt immer um ihn herum, er schneidet keinen Weg ab), nichts Gemiedenes (Plattform, Wiese, Torplatte,
 * Klangstein) näher als zwei Felder; davon das am Ende des Bahnsteigs, am weitesten vom Sitz. Undefined, wenn keins passt
 */
export function grubeStone(map: ReadonlyMap<string, Cell>, seat: Point | undefined): Point | undefined {
  if (!seat) return undefined;
  const kept = (c: Cell | undefined) => !!c && (!!c.portal || !!c.garden || !!c.plate || c.deco === 'klangstein');
  const fits = ([x, y]: Point) => {
    const c = map.get(key(x, y));
    if (!standable(c) || c.deco || c.ride || c.region !== 'hoehle') return false;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const n = map.get(key(x + dx, y + dy));
        if (kept(n)) return false;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 1 || (!dx && !dy)) continue;
        if (!standable(n) || n.ride || n.h !== c.h) return false;
      }
    return true;
  };
  const far = ([x, y]: Point) => Math.hypot(x - seat[0], y - seat[1]);
  const platform: Point[] = [];
  for (const [k, c] of map) if (c.stop === FUNKEL.id) platform.push(k.split(',').map(Number) as unknown as Point);
  return platform
    .filter((p) => far(p) >= STONE_FROM_SEAT && fits(p))
    .sort((a, b) => far(b) - far(a) || a[0] - b[0] || a[1] - b[1])[0];
}

/**
 * Das Gleis der Runde in Reihe, ab dem ersten Feld des Halts (`Lane.at` 0), aus den Feldern der Welt; leer ohne Gleis.
 * `laid` false: die künftige Runde, wie die Grotte sie markiert, auch vor dem Graben (für die Erdwelle, mitwachsen-dig.ts)
 */
function trackOf(world: World, laid = true): Point[] {
  const [bx, by] = world.homes.hoehle.bed;
  const laidAt = (x: number, y: number, at: number) => {
    const c = world.cell(x, y);
    return (!laid || c.ride === FUNKEL.id) && c.lane?.ride === FUNKEL.id && c.lane.at === at;
  };
  let start: Point | undefined;
  for (let y = by - SEARCH; y <= by + SEARCH && !start; y++)
    for (let x = bx - SEARCH; x <= bx + SEARCH && !start; x++) if (laidAt(x, y, 0)) start = [x, y];
  const track: Point[] = [];
  for (let p = start; p && track.length < 1000;) {
    track.push(p);
    const [x, y] = p;
    const i = track.length;
    p = STEPS.map(([, dx, dy]): Point => [x + dx, y + dy]).find(([a, b]) => laidAt(a, b, i));
  }
  return track;
}

/** Warteplätze auf dem Bahnsteig (`Cell.stop` `'grube'`), die nächsten zum Sitz zuerst */
export function platformNear(world: World, [sx, sy]: Point): Point[] {
  const out: { p: Point; d: number }[] = [];
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const p: Point = [sx + dx, sy + dy];
      const c = world.cell(...p);
      if (c.stop === FUNKEL.id && !c.solid && !c.ride) out.push({ p, d: Math.hypot(dx, dy) });
    }
  return out.sort((a, b) => a.d - b.d).map((o) => o.p);
}

const lanes = new WeakMap<World, readonly Point[]>();
/**
 * Die künftige Runde in Reihe (vom ersten Feld des Halts an), auch vor dem Graben, wie die Grotte sie markiert
 * (`Cell.lane` mit `at`); leer ohne Grotte. Je Welt einmal
 */
export function laneOf(world: World): readonly Point[] {
  if (!world.spotsOf('hoehle').length) return [];
  let found = lanes.get(world);
  if (!found) lanes.set(world, (found = trackOf(world, false)));
  return found;
}

const routes = new WeakMap<World, RideRoute | null>();

/** Die Runde schließt sich: Das letzte Feld liegt neben dem ersten */
const closed = (t: readonly Point[]) => {
  const [a, b] = [t[0], t.at(-1)];
  return !!a && !!b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
};

/**
 * Strecke von Funkel in einer Welt (`Vehicle.route`, eine Schleife, `RideRoute.loop`): `path` vom Sitz (`SEAT` Felder
 * ins Gleis des Halts) einmal ganz herum zurück zum Sitz; am Halt Lok (davor), erster Wagen (Sitz) und zweiter Wagen
 * (dahinter) als `cars`, Warteplätze auf dem Bahnsteig. Undefined, solange der Gang nicht gegraben ist oder die Grotte
 * fehlt. Je Welt einmal
 */
export function funkelRoute(world: World, s: Pick<Rider, 'packs'>): RideRoute | undefined {
  if (!dug(s.packs) || !world.spotsOf('hoehle').length) return undefined;
  if (!routes.has(world)) routes.set(world, build(world));
  return routes.get(world) ?? undefined;
}

function build(world: World): RideRoute | null {
  const track = trackOf(world);
  if (track.length <= SEAT + 2 || !closed(track)) return null;
  const path = [...track.slice(SEAT), ...track.slice(0, SEAT), track[SEAT]!];
  const seat = path[0]!;
  const cars = [path[1]!, seat, path.at(-2)!];
  const seats = platformNear(world, seat).slice(0, WAIT);
  return {
    path,
    stops: { home: seat, out: seat },
    shed: [],
    seats: { home: seats, out: seats },
    on: new Set(track.map((p) => key(...p))),
    cars: { home: cars, out: cars },
    ahead: 2,
    loop: true,
  };
}

/** Aussteigen auf den Bahnsteig an der Tür: Felder des Bahnsteigs neben dem Sitz, die nächsten zuerst */
export function funkelExit(world: World, s: Pick<Rider, 'packs'>): Point[] {
  const r = funkelRoute(world, s);
  return r
    ? platformNear(world, r.stops.home).filter(([x, y]) => Math.hypot(x - r.stops.home[0], y - r.stops.home[1]) < 2.5)
    : [];
}

/** Funkel für die Fahr-Engine (`pack.rules.vehicle`): Eintrag, Strecke, Aussteigen am Bahnsteig, nach der ersten Fahrt `gefahren` */
export const funkel: Vehicle = {
  spec: FUNKEL,
  route: funkelRoute,
  exit: (s, world) => funkelExit(world, s),
  landed(s) {
    s.packs = withRidden(s.packs, FUNKEL.id); // kein goldener Rahmen mehr an der Tür
  },
  laps: lapsOf, // so viele Runden, wie am Zahlenstein gewählt
};

/**
 * Zu Fuß in einen Zahlenstein gelaufen (`WorldRules.bump`): Er ist gewählt (Ereignis `lapstone`, so viele Töne wie
 * seine Zahl, er leuchtet). Zu Fuß gegen ein Klingeltor gelaufen: Es klingt (Ereignis `chimegate`, drei Töne, die Scheibe
 * wackelt, Funkel am Halt tutet und blinkt; mitwachsen-gang-look.ts), die Figur bleibt stehen, ohne anzustoßen. Kein
 * „noch nicht“, kein Gold: Das Tor ist für Füße nur zu eng
 */
export const ringGate: WorldRules['bump'] = (s, c, x, y, events) => {
  if (c.deco === 'lapstone' && c.note) {
    // Zahlenstein: Hineinlaufen wählt so viele Runden (bleibt, bis ein anderer gewählt wird; nicht gespeichert)
    s.laps = { ...s.laps, [FUNKEL.id]: c.note };
    events.push({ type: 'lapstone', x, y, n: c.note });
    return true;
  }
  if (!c.chimeGate) return false;
  // schläft Funkel (es fehlt ein Paket), klingt nur das Tor: er antwortet nicht und lädt nicht ein
  events.push({ type: 'chimegate', x, y, answer: !s.dozing?.includes(FUNKEL.id) });
  return true;
};
