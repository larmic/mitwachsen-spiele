// Der Maulwurf gräbt den Glitzergang (Rückmeldung zur Höhle, Schritt 17) – rein, ohne DOM: Der erste Maulwurf, der mit
// Bau 2 der Bahn am Bahnhof Fledermaus einzieht (`FIRST_MOLE` im Spielstand `garden`), ist der Bote der Grubenbahn. Am
// nächsten echten Spieltag nach seinem Einzug (dieselbe Regel wie in mitwachsen-tired.ts: mehr als `BREAK` Pause,
// `WorldPack.dawn`) ist das Graben fällig (`packs.fahrt.grube`, Stufe `faellig`); alte Spielstände, in denen er schon
// zu Hause wohnt, bekommen es genauso am nächsten echten Spieltag. Kommt die wache Figur dann in die Nähe des
// Grubenhalts (`DIG_NEAR`), hüpft der Maulwurf aus der Erde neben den Halt und klopft, eine Erdwelle läuft einmal die
// künftige Runde entlang (8 s wie die Gleiswelle, `DIG`), aus Fels werden Rinne und Tore, das Gleis liegt (die Stufe
// `bereit` wird gespeichert und die Welt neu gebaut, `relay`), und Funkel rollt aus dem Gang an seinen Halt. Solange
// hüpft die Figur auf jeden Pfeil nur (`hold`: auch kein Einsteigen). Wie weit das Graben ist, steht nur im Zustand
// (`State.dig`, nicht gespeichert): Wer vor dem Augenblick `pop` neu lädt, sieht es noch einmal; danach ist der Gang
// gegraben. Danach läuft der Maulwurf von selbst zurück auf seinen Platz am Höhlenbett. Teil des Pakets der Grubenbahn
// (`rules.herald`, `dawn`); Bild und Ton in mitwachsen-dig-look.ts.
// Spezifikation: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“, Der Maulwurf gräbt)

import type { Point } from '../../../../data/games/mitwachsen';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import { DIG, DIG_NEAR } from '../../../../data/games/worlds/grube/mitwachsen-dig-model';
import { DIRS } from '../../../../lib/games/front';
import { dirTo, freeNear, type Crowd } from '../../mitwachsen-free';
import type { HeraldEvents as Events, HeraldRules, Heralded } from '../../mitwachsen-herald';
import { rideOf, withRide } from '../../mitwachsen-ride-save';
import type { MoveCmd } from '../../mitwachsen-rider';
import { canStep, type World } from '../../mitwachsen-world';
import { FUNKEL, SEAT, laneOf } from './mitwachsen-funkel';

/** Wohnt der erste Maulwurf zu Hause am Höhlenbett (er zog mit Bau 2 ein)? */
export const moleHome = (garden: readonly { id: string }[]): boolean => garden.some((a) => a.id === FIRST_MOLE);

/**
 * Ein neuer echter Spieltag (`WorldPack.dawn`): Wohnt der erste Maulwurf zu Hause und hat Funkel noch keinen Eintrag,
 * ist heute das Graben fällig (Stufe `faellig`). Sonst bleibt alles, wie es ist (auch ein schon fälliges Graben)
 */
export function digDawn(packs: Readonly<Record<string, unknown>>, garden: readonly { id: string }[]) {
  return !rideOf(packs)[FUNKEL.id] && moleHome(garden) ? withRide(packs, FUNKEL.id, 'faellig') : { ...packs };
}

/** Ist das Graben fällig (Stufe `faellig`, der Gang ist noch Fels)? */
export const digDue = (packs: Readonly<Record<string, unknown>>): boolean =>
  rideOf(packs)[FUNKEL.id]?.stage === 'faellig';

/** Takt eines Augenblicks im Graben, das um `from` begann */
export const digBeat = (from: number, beat: number) => from + Math.round(beat * DIG.ticks);

/**
 * Wie weit das Graben ist (0 … 1, `frac` der Bruchteil des laufenden Takts für das Bild), undefined, wenn gerade nicht
 * gegraben wird
 */
export function digAt(s: Pick<Heralded, 'tick' | 'dig'>, frac = 0): number | undefined {
  const d = s.dig;
  if (!d || s.tick >= d.to) return undefined;
  return Math.min(1, Math.max(0, (s.tick + frac - d.from) / (d.to - d.from)));
}

/** Der Sitz am Grubenhalt (Feld `SEAT` der künftigen Runde); undefined ohne Grotte */
export const haltOf = (world: World): Point | undefined => laneOf(world)[SEAT];

/**
 * Beginnt jetzt das Graben? Es ist fällig, die wache Figur steht in der Grotte höchstens `DIG_NEAR` Felder (Schachbrett)
 * vom Sitz am Grubenhalt, sie fährt nicht, und kein Bote arbeitet gerade
 */
export function canDig(s: Heralded & { ride?: unknown }, world: World): boolean {
  if (s.dig || s.work || s.ride || s.sleeping || !digDue(s.packs)) return false;
  const seat = haltOf(world);
  if (!seat || world.realm(s.player.x, s.player.y) !== 'hoehle') return false;
  return Math.max(Math.abs(s.player.x - seat[0]), Math.abs(s.player.y - seat[1])) <= DIG_NEAR;
}

const paws = new WeakMap<World, ReadonlySet<string>>();
/**
 * Felder der Grotte, die die Tiere vom Höhlenbett aus erreichen, ohne die künftige Schleife zu betreten (`Cell.lane`:
 * Gleis, Zaun, Rand; wie die Grotte ihre Wohnplätze wählt), als `x,y`; also nichts, was die Schleife einschließt. Je
 * Welt einmal
 */
export function pawsOf(world: World): ReadonlySet<string> {
  const known = paws.get(world);
  if (known) return known;
  const seen = new Set<string>();
  const bed = world.homes.hoehle?.bed;
  const queue: Point[] = [];
  const visit = (x: number, y: number) => {
    const k = `${x},${y}`;
    if (seen.has(k) || world.realm(x, y) !== 'hoehle') return;
    const c = world.cell(x, y);
    if (c.solid || c.lane || c.ride) return;
    seen.add(k);
    queue.push([x, y]);
  };
  if (bed) for (const [dx, dy] of Object.values(DIRS)) visit(bed[0] + dx, bed[1] + dy);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of Object.values(DIRS)) if (canStep(world, [], x, y, x + dx, y + dy)) visit(x + dx, y + dy);
  }
  paws.set(world, seen);
  return seen;
}

/**
 * Wo der Maulwurf am Halt klopft: das freie Feld nächst dem Sitz, das die Tiere vom Bett aus erreichen, ohne die Schleife
 * zu betreten (`pawsOf`: nie in der Schleife, nie auf dem Bahnsteig), also hinter dem Bahnsteig; null, wenn es keins gibt
 */
export function digSpot(s: Crowd, world: World): Point | null {
  const seat = haltOf(world);
  if (!seat) return null;
  const reach = pawsOf(world);
  const free = (x: number, y: number) => !world.cell(x, y).stop && reach.has(`${x},${y}`);
  return freeNear(s, world, seat, free, FIRST_MOLE);
}

/**
 * Das Graben beginnt (`DIG.ticks` Takte): Der Maulwurf hüpft aus der Erde auf sein Feld am Halt (`digSpot`), schaut zum
 * Sitz und bleibt dort, bis es fertig ist. Wohnt er nicht zu Hause (er folgt der Figur, ein altes Paket), klopft es
 * trotzdem dort
 */
export function startDig(s: Heralded, world: World, events: Events) {
  const seat = haltOf(world)!;
  s.dig = { from: s.tick, to: s.tick + DIG.ticks };
  let at: Point = seat;
  const mole = s.animals.find((a) => a.id === FIRST_MOLE && a.mode === 'home');
  const spot = mole && digSpot(s, world);
  if (mole && spot) {
    [mole.x, mole.y] = spot;
    mole.dir = dirTo(seat[0] - spot[0], seat[1] - spot[1]);
    mole.rest = DIG.ticks + 10; // er bleibt am Halt, bis Funkel da ist, dann läuft er heim
    at = spot;
  }
  events.push({ type: 'herald', what: 'dig', id: FIRST_MOLE, x: at[0], y: at[1] });
}

/**
 * Nach jedem Befehl, solange gegraben wird: zum Augenblick `pop` ist der Gang gegraben (Stufe `bereit`, gleich
 * gespeichert, die Welt wird neu gebaut, `relay`; die Stufe bleibt, wie sie war, wenn sie schon weiter ist), am Ende
 * steht Funkel am Halt und das Graben ist vorbei (`State.dig` fällt weg)
 */
export function digOn(s: Heralded, world: World, events: Events) {
  const d = s.dig;
  if (!d) return;
  const [x, y] = haltOf(world) ?? [s.player.x, s.player.y];
  if (!d.laid && s.tick >= digBeat(d.from, DIG.pop)) {
    s.dig = { ...d, laid: true };
    if (digDue(s.packs)) s.packs = withRide(s.packs, FUNKEL.id, 'bereit');
    events.push({ type: 'herald', what: 'dug', id: FIRST_MOLE, x, y, relay: true, persist: true });
  }
  if (s.tick >= d.to) {
    delete s.dig;
    events.push({ type: 'herald', what: 'rolled', id: FIRST_MOLE, x, y });
  }
}

/** Nach jedem Befehl (`HeraldRules.step`): fällig und nah genug, beginnt das Graben (nur im Takt), sonst geht es weiter */
export function digStep(s: Heralded, world: World, cmd: 'move' | 'action' | 'tick', events: Events) {
  if (s.dig) return digOn(s, world, events);
  if (cmd === 'tick' && canDig(s, world)) startDig(s, world, events);
}

/** Vor allem anderen (`HeraldRules.hold`): Solange gegraben wird, hüpft die Figur auf jeden Pfeil nur */
export function digHold(s: Heralded, cmd: Pick<MoveCmd, 'dir'>, events: Events): boolean {
  if (!s.dig) return false;
  s.player.dir = cmd.dir;
  events.push({ type: 'hop' });
  return true;
}

/** Der Maulwurf als Bote der Grubenbahn (`pack.rules.herald`); hineinlaufen tut nichts Eigenes (`meet`) */
export const DIG_RULES: HeraldRules = { step: digStep, meet: () => false, hold: digHold };
