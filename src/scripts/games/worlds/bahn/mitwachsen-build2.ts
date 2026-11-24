// Bau 2 – rein, ohne DOM: bei der nächsten Fahrt nach dem Hau-ruck (Ausbau 1, Höhlentor offen, Tok wartet in der Bucht).
// Fährt der Zug von Bahnhof Bär zur Grotte hin ab (nach den 2 s, in denen ein Pfeil wieder aussteigt), steht Ausbau 2
// sofort im Spielstand (`packs.bahn.built`, gespeichert), und die Fahrt hält unterwegs einmal (`Vehicle.depart`,
// `Ride.stopover`): am Prellbock in der Bucht, dort, wo der Zug bei Ausbau 1 hielt (`Vehicle.hold`). Bis dahin wartet der
// Bau (`State.work` ohne Ende, Fortschritt 0: Der Prellbock steht noch, durch die Tür liegt noch nichts). Am Prellbock
// hüpft Tok aus der Bucht heran und klopft 3 s lang pink-pink (`BUILD2`); Bahnhof Fledermaus und der Lokschuppen
// entstehen in der Grotte (die Welt wird neu gebaut, `relay`), der Prellbock versinkt, eine Gleiswelle läuft durch Tür und
// Gang bis zum Bahnhof Fledermaus, Tok steigt in den hinteren Wagen, und der Zug fährt weiter. Am Bahnhof Fledermaus
// hüpft der Maulwurf von Toks Helm und zieht als erstes Höhlen-Tier ins Gehege am Höhlenbett (gespeichert wie jedes
// Tier, das einzieht; erst danach erwacht das Portal am stillen See, `Portal.later`), und Tok hüpft an seinen Platz im
// Lokschuppen: Dort wohnt er von nun an (`inShed`/`backToShed` in mitwachsen-tok.ts), ohne den Maulwurf (`solo`).
// Wer mitten in der Fahrt neu lädt, findet Ausbau 2 fertig vor; der Maulwurf läuft dann frei gegenüber dem Bahnhof, bis
// das Kind ihn heimbringt oder wieder mit dem Zug am Bahnhof Fledermaus ankommt (dann zieht er ein). Teil des Pakets der Bahn (Zug: mitwachsen-train.ts; Tok: mitwachsen-tok.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 2)

import { DIRS } from '../../../../lib/games/front';
import { fromKey } from '../../../../lib/games/chunks';
import { animalId, type Point } from '../../../../data/games/mitwachsen';
import { BUILD2, LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import { dirTo, freeNear, occupied, type Crowd } from '../../mitwachsen-free';
import { PACE } from '../../mitwachsen-guide';
import type { HeraldEvents, Heralded } from '../../mitwachsen-herald';
import { meadowSpots } from '../../mitwachsen-meadow';
import { tokOf } from '../../mitwachsen-ride-save';
import type { End, RideEvents, Rider } from '../../mitwachsen-rider';
import { canStep, type World } from '../../mitwachsen-world';
import { builtOf, withBuilt } from './mitwachsen-built';
import { key } from './mitwachsen-ground';
import { shedOf, type Shed } from './mitwachsen-line';
import { SEAT, lineOf } from './mitwachsen-train-line';

/** Tok unter den Wesen (wie `TOK` in mitwachsen-tok.ts, das diese Datei importiert) */
const TOK = animalId('hoehle', 'tok');
const EPS = 1e-6;
/** So nah (Felder) muss Tok am Prellbock sein, wenn er zu klopfen beginnt; weiter weg, steht er gleich dort */
export const NEAR = 2;

type Walker = Heralded['animals'][number];

/** Takt eines Augenblicks in Bau 2, der um `from` begann */
const beat = (from: number, b: number) => from + Math.round(b * BUILD2.ticks);

/** Wartet Bau 2 noch auf den Zug (der Zug ist abgefahren, aber noch nicht am Prellbock)? */
export const waiting = (s: Pick<Heralded, 'work'>): boolean => s.work?.to === Infinity;

/**
 * Beginnt bei dieser Abfahrt Bau 2? Zur Grotte hin (von Bahnhof Bär, `to` home), Ausbau 1, Höhlentor offen (das
 * Hau-ruck ist gemacht), Tok kam, und die Welt kennt die ganze Linie (die Grotte ist da)
 */
export function canBuild2(s: Pick<Rider, 'packs' | 'openGates'>, world: World, to: End): boolean {
  return (
    to === 'home' &&
    builtOf(s.packs) === 1 &&
    s.openGates.includes('hoehle') &&
    tokOf(s.packs) !== undefined &&
    lineOf(world, true).length > lineOf(world, false).length
  );
}

/**
 * Beim Abfahren (`Vehicle.depart`): Beginnt Bau 2, steht Ausbau 2 sofort im Spielstand (die Engine speichert und fährt
 * nun bis in die Grotte), und der Bau wartet, bis der Zug am Prellbock hält (`State.work` ohne Ende). true: Diese Fahrt
 * hält unterwegs einmal
 */
export function depart2(s: Rider, world: World, to: End): boolean {
  if (!canBuild2(s, world, to)) return false;
  s.packs = withBuilt(s.packs, 2);
  s.work = { from: s.tick, to: Infinity };
  return true;
}

/** Bis wohin der Zug bei Bau 2 fährt, bevor Tok klopft: Fortschritt der Fahrt am Halt des Ausbaus 1 (Prellbock) */
export const capOf = (world: World): number => lineOf(world, false).length - 1 - 2 * SEAT;

/**
 * Solange der Halt unterwegs aussteht (`Vehicle.hold`): bis an den Prellbock fahren, dort beginnt Tok zu klopfen (die
 * Arbeit beginnt jetzt, `BUILD2.ticks` Takte), und warten, bis er fertig ist und eingestiegen (dann undefined: weiter)
 */
export function hold2(s: Rider, world: World, events: RideEvents): number | undefined {
  const ride = s.ride;
  if (!ride || !s.work) return undefined;
  const cap = capOf(world);
  if (!waiting(s) || ride.pos < cap - EPS) return cap;
  s.work = { from: s.tick, to: s.tick + BUILD2.ticks };
  const t = s.animals.find((a) => a.id === TOK);
  // kam er unterwegs nicht heran (etwa morgens noch vom Bett der Lichtung her, oder an einer Felskante hängen
  // geblieben), steht er jetzt am Prellbock: Geklopft wird nie ohne ihn
  const spot = t && besideBuffer(s, world);
  if (t && spot && Math.max(Math.abs(t.x - spot[0]), Math.abs(t.y - spot[1])) > NEAR) {
    [t.x, t.y] = spot;
    const buffer = lineOf(world, false).at(-1);
    if (buffer) t.dir = dirTo(buffer[0] - t.x, buffer[1] - t.y);
  }
  events.push({ type: 'herald', what: 'sink', id: TOK, x: t?.x ?? s.player.x, y: t?.y ?? s.player.y });
  return cap;
}

/** Das Feld neben dem Prellbock, an dem Tok klopft: frei, nicht auf dem Gleis und nicht auf der Torplatte */
function besideBuffer(s: Crowd, world: World): Point | null {
  const buffer = lineOf(world, false).at(-1);
  if (!buffer) return null;
  const ok = (x: number, y: number) => !world.cell(x, y).ride && !world.cell(x, y).plate;
  return freeNear(s, world, buffer, ok, TOK);
}

/** Ein Hüpfer auf ein freies Nachbarfeld näher an `goal`; sonst bleibt er stehen */
function hopTo(s: Heralded, world: World, t: Walker, goal: Point) {
  const d = (x: number, y: number) => Math.hypot(x - goal[0], y - goal[1]);
  const next = Object.values(DIRS)
    .map(([dx, dy]): Point => [t.x + dx, t.y + dy])
    .filter(([x, y]) => d(x, y) < d(t.x, t.y) - EPS && !occupied(s, x, y, t.id))
    .filter(([x, y]) => canStep(world, s.openGates, t.x, t.y, x, y))
    .sort((a, b) => d(...a) - d(...b))[0];
  if (!next) return;
  t.dir = dirTo(next[0] - t.x, next[1] - t.y);
  [t.x, t.y] = next;
}

/** Tok hüpft an den Prellbock (ein Feld je `PACE.lead` Takte) und schaut darauf */
function toBuffer(s: Heralded, world: World, t: Walker, buffer: Point) {
  const spot = besideBuffer(s, world);
  if (spot && (t.x !== spot[0] || t.y !== spot[1]) && s.tick % PACE.lead === 0) hopTo(s, world, t, spot);
  t.dir = dirTo(buffer[0] - t.x, buffer[1] - t.y);
}

/**
 * Nach jedem Befehl, solange Bau 2 läuft (`HeraldRules.step`): Tok hüpft an den Prellbock (ein Feld je `PACE.lead`
 * Takte) und schaut darauf; zum Augenblick `pop` entstehen Bahnhof Fledermaus und Lokschuppen (die Welt wird neu
 * gebaut, `relay`), zum Augenblick `board` steigt er in den hinteren Wagen, am Ende ist der Bau fertig. Wartet der Bau
 * noch auf den Zug, hüpft Tok schon an den Prellbock (fährt keiner mehr, fällt der Bau weg)
 */
export function build2Step(s: Heralded & Pick<Rider, 'ride'>, world: World, cmd: string, events: HeraldEvents) {
  if (!s.work) return;
  const t = s.animals.find((a) => a.id === TOK);
  const buffer = lineOf(world, false).at(-1);
  if (waiting(s)) {
    if (!s.ride)
      delete s.work; // Sicherheitsnetz: ohne Fahrt kein Bau
    else if (t && buffer && cmd === 'tick') toBuffer(s, world, t, buffer); // er hüpft schon los, während der Zug fährt
    return;
  }
  if (t && buffer && cmd === 'tick' && s.tick < beat(s.work.from, BUILD2.pop)) toBuffer(s, world, t, buffer);
  if (!s.work.laid && s.tick >= beat(s.work.from, BUILD2.pop)) {
    s.work = { ...s.work, laid: true };
    events.push({
      type: 'herald',
      what: 'pop',
      id: TOK,
      x: buffer?.[0] ?? s.player.x,
      y: buffer?.[1] ?? s.player.y,
      relay: true,
    });
  }
  if (t && s.tick >= beat(s.work.from, BUILD2.board)) {
    s.animals = s.animals.filter((a) => a !== t);
    events.push({ type: 'herald', what: 'board', id: TOK, x: t.x, y: t.y });
  }
  if (s.tick >= s.work.to) delete s.work;
}

const sheds = new WeakMap<World, Shed>();
/** Der Lokschuppen neben Bahnhof Fledermaus in einer Welt (je Welt einmal; ohne Grotte leer) */
export function shedIn(world: World): Shed {
  let found = sheds.get(world);
  if (!found) {
    const far = lineOf(world, true);
    const near = lineOf(world, false);
    const lane = far.length > near.length ? far.slice(-LINE.bear.long) : [];
    found = lane.length
      ? shedOf({ get: (k) => world.cell(...fromKey(k)) }, { lane })
      : { cells: [], wall: [], dir: [0, 0] };
    sheds.set(world, found);
  }
  return found;
}

/** Tok als Wesen in seinem Lokschuppen (ohne den Maulwurf, `solo`), zur Figur gewandt; null, wenn dort nichts frei ist */
export function tokInShed(
  s: Pick<Heralded, 'player' | 'animals' | 'openGates' | 'sleeping'>,
  world: World,
): Walker | null {
  const home = shedIn(world).home;
  const spot =
    home && (occupied(s, ...home, TOK) ? freeNear(s, world, home, (x, y) => !!world.cell(x, y).shed, TOK) : home);
  if (!spot) return null;
  const [x, y] = spot;
  return {
    id: TOK,
    species: 'tok',
    x,
    y,
    dir: dirTo(s.player.x - x, s.player.y - y),
    mode: 'herald',
    home: { kind: 'region', region: 'hoehle' },
    realm: 'hoehle',
    spawn: [x, y],
    rest: 0,
    solo: true,
  };
}

/**
 * Der Maulwurf hüpft von Toks Helm und zieht ein (`home`, gespeichert): auf einem freien Feld neben der Figur, mit einem
 * eigenen Platz auf der Wiese am Höhlenbett, zu dem er selbst läuft. Wohnt er schon zu Hause, nichts. Läuft er schon
 * frei oder folgt er (nach dem Neuladen mitten in der Fahrt, oder ein Paket kam unterwegs an), hüpft er ebenso neben die
 * Figur und zieht ein: Das Portal am stillen See wartet auf genau ihn
 */
export function moleHome(s: Rider, world: World, events: RideEvents) {
  if (s.garden.some((a) => a.id === FIRST_MOLE)) return;
  s.animals = s.animals.filter((a) => a.id !== FIRST_MOLE);
  s.followers = s.followers.filter((f) => f !== FIRST_MOLE);
  const at = freeNear(
    s,
    world,
    [s.player.x, s.player.y],
    (x, y) => world.realm(x, y) === 'hoehle' && !world.cell(x, y).ride,
  );
  const spots = meadowSpots(world, 'hoehle');
  if (!at || !spots.length) return;
  const taken = new Set(s.animals.filter((a) => a.mode === 'home').map((a) => key(...a.spawn)));
  const spawn = spots.find((p) => !taken.has(key(...p))) ?? spots[0]!;
  s.garden.push({ id: FIRST_MOLE, species: 'maulwurf' });
  const dir = dirTo(spawn[0] - at[0], spawn[1] - at[1]);
  const home = { kind: 'garden' } as const;
  s.animals.push({
    id: FIRST_MOLE,
    species: 'maulwurf',
    x: at[0],
    y: at[1],
    dir,
    mode: 'home',
    home,
    realm: 'hoehle',
    spawn,
    rest: 2,
  });
  events.push({ type: 'home', id: FIRST_MOLE, species: 'maulwurf' });
}

/**
 * Angekommen am Bahnhof Fledermaus, nach dem Aussteigen (`Vehicle.landed`): Wohnt der erste Maulwurf noch nicht am
 * Höhlenbett, hüpft er (von Toks Helm) und zieht ein, bei jeder Ankunft, bis er dort wohnt; sitzt Tok noch im hinteren
 * Wagen (Bau 2), hüpft er danach an seinen Platz im Lokschuppen (`guest`)
 */
export function arrive2(s: Rider, world: World, events: RideEvents) {
  if (builtOf(s.packs) < 2) return;
  moleHome(s, world, events);
  if (!tokOf(s.packs) || s.animals.some((a) => a.mode === 'herald')) return;
  const t = tokInShed(s, world);
  if (!t) return;
  s.animals.push(t);
  events.push({ type: 'ride', what: 'guest', id: 'hoehle', x: t.x, y: t.y, who: TOK });
}
