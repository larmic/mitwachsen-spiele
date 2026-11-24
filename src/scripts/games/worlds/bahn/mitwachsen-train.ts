// Der Zug der Höhlenbahn – rein, ohne DOM: was die Fahr-Engine (Paket der Fahrzeuge, worlds/fahrt/) über ihn wissen muss
// (`train`, `WorldRules.vehicle` aus dem Paket der Bahn). Er erscheint nie von selbst: Tok baut ihn (Bau 1, Stufe
// `bereit`). Seine Strecke ist das Gleis (`trainRoute`, aus den Feldern der Welt): von Bahnhof Bär auf der Lichtung bis
// an den Prellbock in der Bucht vor dem Höhlentor (Ausbau 1), mit Ausbau 2 und offenem Höhlentor weiter durch Tür und
// Gang bis zum Bahnhof Fledermaus in der Grotte. Lok und zwei Wagen belegen am Halt `CARS` Felder des Gleises, die
// Figur sitzt im mittleren Wagen (`SEAT` Felder vom Ende); jeder Wagen ist zum Einsteigen da. Vor dem Sitz müssen die
// Wagen davor und zwei Felder frei sein. Tunnelportal, Einschnitt und Gang sind der Tunnel (`dark`): davor „Uh-uh“,
// darin gedimmtes Licht. Warteplätze für folgende Tiere: die Bank auf dem Bahnsteig (`SEATS`-Muster), in der Bucht
// Felder neben dem Gleis (nicht auf Torplatte und Toks Platz). Nach der ersten Fahrt hat die Tür keinen goldenen Rahmen
// mehr (`gefahren`, gespeichert); kommt sie (Ausbau 1) am Prellbock an, hüpft Tok aus dem hinteren Wagen an seinen Platz
// neben der Torplatte (`BESIDE`, `landed`).
// Steht die Figur 6 Felder vor einem Halt (`RIDE_PRELOAD`), holt das Spiel die Grotte (`needs`) und die Fahr-Engine;
// solange die Engine fehlt oder (ab Ausbau 2) die Grotte, schläft der Zug am Halt (mitwachsen-preload.ts).
// Bis zum Freischalten (`BAHN_LIVE`) holt das Spiel das Paket der Bahn nie von selbst: Dann gibt es den Zug nur im
// Blick hinein (Entwickler-Schalter).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Fahren)

import { animalId, type Point } from '../../../../data/games/mitwachsen';
import { BESIDE, plateRow } from '../../mitwachsen-bay';
import { dirTo, freeNear } from '../../mitwachsen-free';
import { heraldOf } from '../../mitwachsen-herald';
import { tokOf, withRidden } from '../../mitwachsen-ride-save';
import type { End, RideEvents, RideRoute, Rider, Vehicle } from '../../mitwachsen-rider';
import { standHeight, type World } from '../../mitwachsen-world';
import { builtOf } from './mitwachsen-built';
import { key } from './mitwachsen-ground';
import { CARS, SEAT, TRAIN, lineOf } from './mitwachsen-train-line';
import { arrive2, depart2, hold2 } from './mitwachsen-build2';

export { CARS, SEAT, TRAIN, bearEnd, lineOf } from './mitwachsen-train-line';
/** So viele Felder vor dem Sitz müssen frei sein: die Wagen davor und zwei Felder */
export const AHEAD = CARS - 1 - SEAT + 2;
/** So viele Warteplätze hat jeder Halt (die Bank auf dem Bahnsteig, in der Bucht neben dem Gleis) */
const WAIT = 8;

/** Fährt der Zug bis in die Grotte? Erst ab Ausbau 2 und mit offenem Höhlentor (sonst bis zum Prellbock in der Bucht) */
export const farOf = (s: Pick<Rider, 'packs' | 'openGates'>) => builtOf(s.packs) >= 2 && s.openGates.includes('hoehle');

/**
 * Warteplätze an einem Halt: zuerst die Felder eines Bahnsteigs (`Cell.stop`, die Bank auf Bahnhof Bär und der
 * Steinbahnsteig von Bahnhof Fledermaus), sonst (in der Bucht) Felder neben dem Gleis; nie auf dem Gleis, einer Torplatte,
 * einer Plattform, Toks Platz neben der Torplatte; die nächsten zuerst
 */
function seatsNear(world: World, seat: Point, on: ReadonlySet<string>): Point[] {
  const g = world.gates.get('hoehle');
  const tok = g && plateRow(g, BESIDE);
  const out: { p: Point; d: number }[] = [];
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const p: Point = [seat[0] + dx, seat[1] + dy];
      const c = world.cell(...p);
      if (on.has(key(...p)) || c.plate || c.portal || c.gate || standHeight(world, [], ...p) === null) continue;
      if (tok && p[0] === tok[0] && p[1] === tok[1]) continue;
      if (c.region !== world.cell(...seat).region) continue;
      out.push({ p, d: Math.hypot(dx, dy) - (c.stop === TRAIN.id ? 10 : 0) });
    }
  return out
    .sort((a, b) => a.d - b.d)
    .slice(0, WAIT)
    .map((o) => o.p);
}

const routes = new WeakMap<World, Map<boolean, RideRoute | null>>();
/**
 * Strecke des Zugs in einer Welt (`Vehicle.route`): `path` die Felder des Sitzes vom Halt in der Welt (Prellbock in der
 * Bucht bzw. Bahnhof Fledermaus) bis zum Halt an Bahnhof Bär; je Halt die Felder der Wagen (`cars`), Warteplätze,
 * Tunnel. Undefined ohne Gleis (vor Ausbau 1) oder wenn es zu kurz ist. Je Welt und Ziel einmal
 */
export function trainRoute(world: World, s: Pick<Rider, 'packs' | 'openGates'>): RideRoute | undefined {
  if (builtOf(s.packs) < 1) return undefined;
  const far = farOf(s);
  let byFar = routes.get(world);
  if (!byFar) routes.set(world, (byFar = new Map<boolean, RideRoute | null>()));
  if (!byFar.has(far)) byFar.set(far, build(world, far));
  return byFar.get(far) ?? undefined;
}

function build(world: World, far: boolean): RideRoute | null {
  const line = lineOf(world, far);
  const n = line.length;
  if (n < 2 * CARS + 2) return null;
  const path = line.slice(SEAT, n - SEAT).reverse();
  const on = new Set(line.map((p) => key(...p)));
  const dark = new Set(
    line
      .filter((p) => {
        const c = world.cell(...p);
        return c.rail?.part === 'portal' || c.rail?.part === 'cut' || !!c.gate || c.region === 'wild';
      })
      .map((p) => key(...p)),
  );
  const home = path[0]!,
    out = path.at(-1)!;
  return {
    path,
    stops: { home, out },
    shed: [],
    seats: { home: seatsNear(world, home, on), out: seatsNear(world, out, on) },
    on,
    cars: { home: line.slice(n - CARS), out: line.slice(0, CARS) },
    ahead: AHEAD,
    dark,
  };
}

/** Fährt die Figur gerade im Zug durch den Tunnel (Tunnelportal, Einschnitt, Gang)? */
export function inTunnel(s: Pick<Rider, 'ride' | 'player' | 'packs' | 'openGates'>, world: World): boolean {
  if (s.ride?.id !== TRAIN.id) return false;
  return !!trainRoute(world, s)?.dark?.has(key(s.player.x, s.player.y));
}

/**
 * Nach dem Aussteigen (`Vehicle.landed`): Kam der Zug am Prellbock in der Bucht an (Ausbau 1, nur bis dorthin) und
 * sitzt Tok noch im hinteren Wagen, hüpft er heraus an seinen Platz neben der Torplatte (`BESIDE`; besetzt: das nächste
 * freie Feld in der Nähe) und ist wieder ein Wesen (`guest`). Dort wartet er; wo, wird nicht gespeichert: Nach dem
 * Laden setzt ihn `backToBay` (mitwachsen-tok.ts) wieder in die Bucht (schläft die Figur, neben das Bett), solange der
 * Zug noch nicht in die Grotte fährt
 */
export function tokOut(s: Rider, world: World, end: End, events: RideEvents) {
  const g = world.gates.get('hoehle');
  if (end !== 'home' || farOf(s) || !g || !tokOf(s.packs) || heraldOf(s)) return;
  const spot = freeNear(s, world, plateRow(g, BESIDE), (x, y) => !world.cell(x, y).plate && !world.cell(x, y).ride);
  if (!spot) return;
  const [x, y] = spot;
  const id = animalId('hoehle', 'tok'); // wie `TOK` in mitwachsen-tok.ts (das importiert das Bild des Zugs)
  const dir = dirTo(g.mid[0] - x, g.mid[1] - y); // schaut zum Tor
  const home = { kind: 'region', region: 'hoehle' } as const;
  s.animals.push({ id, species: 'tok', x, y, dir, mode: 'herald', home, realm: 'hoehle', spawn: [x, y], rest: 0 });
  events.push({ type: 'ride', what: 'guest', id: TRAIN.id, x, y, who: id });
}

/**
 * Nach dem Aussteigen (`Vehicle.landed`): Die erste Fahrt ist gemacht (`gefahren`, gespeichert: kein goldener Rahmen
 * mehr an der Tür), Tok hüpft in der Bucht aus (`tokOut`); am Bahnhof Fledermaus nach Bau 2 zieht der Maulwurf ein, und
 * Tok hüpft in den Lokschuppen (`arrive2`, mitwachsen-build2.ts)
 */
export function landed(s: Rider, world: World, end: End, events: RideEvents) {
  s.packs = withRidden(s.packs, TRAIN.id);
  tokOut(s, world, end, events);
  if (end === 'home' && farOf(s)) arrive2(s, world, events);
}

/**
 * Der Zug für die Fahr-Engine (`pack.rules.vehicle`): Eintrag, Strecke, nach der ersten Fahrt (`landed`); seine
 * Ziel-Gegend ist die Grotte (`needs`): vorgeladen schon, solange er nur bis zum Prellbock fährt, damit sie da ist, wenn
 * Bau 2 kommt; schlafen (Vorladen, mitwachsen-preload.ts) muss er ohne sie erst ab Ausbau 2, wenn er hineinfährt
 * (`reaches`). Die erste Fahrt wartet nie auf die Grotte. Bau 2 (mitwachsen-build2.ts): beginnt beim Abfahren von
 * Bahnhof Bär nach dem Hau-ruck (`depart`), der Zug hält am Prellbock, bis Tok fertig ist (`hold`)
 */
export const train: Vehicle = {
  spec: TRAIN,
  route: trainRoute,
  landed,
  depart: depart2,
  hold: hold2,
  needs: ['hoehle'],
  reaches: (s) => builtOf(s.packs) >= 2,
};
