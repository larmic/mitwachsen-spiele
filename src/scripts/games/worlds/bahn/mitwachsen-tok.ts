// Tok erscheint – rein, ohne DOM: der Bote der Höhlenwelt nach dem Muster des verlaufenen Pinguins, im Paket der Bahn
// (`WorldRules.herald`, mitwachsen-herald.ts). Ist noch nichts gebaut (Ausbau 0), das Eistor offen, die Eis-Leiste voll
// (von jeder Eis-Art wohnt ein Tier auf der Schneewiese) und hat der Schlitten das Kind schon einmal heimgebracht, wird
// er fällig, sobald die Figur wach auf der Lichtung höchstens `TOK_NEAR` Felder vom Bett steht: `DUE` Takte später (beim
// Aufwachen sofort) klopft es, und er hüpft aus einem Hügel Steinkrümel 4 bis 6 Felder neben ihr, auf dem Feld, das dem
// künftigen Bahnhof Bär am nächsten liegt, mit „Ju-hu“. Er hüpft zur Figur (Hüpfer, Herz), dann stellt er sich an den
// künftigen Bahnsteig und ruft dort höchstens alle 4 s. Geht sie vorher weg, beginnt die Wartezeit neu. Am Abend (die
// Uhr des Kinds hat `BED_AT` erreicht, `late`) kommt er schon schlafend und liegt neben dem Bett („Zzz“); er wacht erst
// am nächsten echten Spieltag auf (mehr als `BREAK` Pause, `wakeTok` in mitwachsen-ride-save.ts), Schlafen im Spiel
// weckt ihn nicht. Gespeichert wird nur `packs.fahrt.hoehle = { stage: 'faellig', schlaeft? }`, nie wo er steht. Er steht nie
// im Weg: Läuft die Figur in ihn hinein, während er an seinem Platz steht, beginnt er Bau 1 (mitwachsen-build.ts; nur
// in einer Welt, in der Bahnhof Bär Platz hat), sonst singt und hüpft er; schläft er, schnarcht er leise. Nach der ersten
// Fahrt wartet er in der Bucht an seinem Platz neben der Torplatte (`BESIDE`, mitwachsen-train.ts): nachts wach neben dem
// Bett der Lichtung, morgens ruft er und geht zurück an seinen Platz (`inBay`); nach dem Laden ebenso (`backToBay`: die
// erste Fahrt ist gemacht, `gefahren`, und der Zug fährt noch nicht in die Grotte). So geht es auch zu Fuß: Tok hüpft
// der Figur voraus in die Bucht, und das Hau-ruck am Höhlentor (Paket der Höhlenwelt) beginnt mit ihm dort.
// Bis zum Freischalten (`BAHN_LIVE`) holt das Spiel dieses Paket nie von selbst: Dann gibt es Tok nur im Blick hinein.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint)

import { DIRS } from '../../../../lib/games/front';
import { BUILD } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import { REGIONS, animalId, type Point } from '../../../../data/games/mitwachsen';
import { APPEAR, DUE, NEAR, PACE, PEEP_EVERY, full } from '../../mitwachsen-guide';
import type { HeraldEvents as Events, HeraldRules, Heralded } from '../../mitwachsen-herald';
import { dirTo, freeNear, occupied } from '../../mitwachsen-free';
import { canStep, standHeight, type World } from '../../mitwachsen-world';
import { BESIDE, plateRow } from '../../mitwachsen-bay';
import { bayAt, bearSpots, centreOf, hutOf, rowsOf, type Station } from './mitwachsen-bear';
import { builtOf } from './mitwachsen-built';
import { beatTick, buildStep, building, canBuild, startBuild } from './mitwachsen-build';
import { futureBear } from './mitwachsen-line';
import { REAR_ROW } from './mitwachsen-station-look';
import { ridden, sledHome, tokOf, withTok } from '../../mitwachsen-ride-save';
import { farOf } from './mitwachsen-train';
import { build2Step, shedIn, tokInShed } from './mitwachsen-build2';
import type { Rider } from '../../mitwachsen-rider';

/** Tok unter den Wesen: ein Gast aus der Höhlenwelt (wie der Pinguin `eis:pinguin`) */
export const TOK = animalId('hoehle', 'tok');
/** So nah (in Feldern, auch schräg) am Bett der Lichtung muss die Figur sein, dann wird er fällig */
export const TOK_NEAR = 6;
/** Höchstens so oft ruft er an seinem Platz (4 s), und nur, wenn die Figur so nah ist, dass sie ihn sieht */
export const CALL_EVERY = PEEP_EVERY;
export const SIGHT = 12;
/** So viele Takte hüpft er höchstens zur Figur, dann freut er sich, wo er ist */
export const COME = 40;

type Walker = Heralded['animals'][number];
type Explored = (x: number, y: number) => boolean;
const STEPS = Object.values(DIRS);
const key = (x: number, y: number) => `${x},${y}`;
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const EIS = REGIONS.find((r) => r.id === 'eis');

/**
 * Soll Tok da sein? Noch nichts gebaut (`packs.bahn.built` 0), Eistor offen, Eis-Leiste voll und die erste Heimfahrt mit
 * dem Schlitten gemacht. Wann er auftaucht, entscheidet zusätzlich die Figur (`nearBed`)
 */
export const tokWanted = (s: Pick<Heralded, 'openGates' | 'garden' | 'packs'>): boolean =>
  builtOf(s.packs) === 0 && s.openGates.includes('eis') && !!EIS && full(s, EIS) && sledHome(s.packs);

/** Steht die Figur wach auf der Lichtung, höchstens `TOK_NEAR` Felder vom Bett? */
export function nearBed(s: Pick<Heralded, 'sleeping' | 'player'>, world: World): boolean {
  const { x, y } = s.player;
  const bed = world.homes.lichtung.bed;
  return !s.sleeping && world.realm(x, y) === 'lichtung' && cheb(s.player, { x: bed[0], y: bed[1] }) <= TOK_NEAR;
}

type Post = { post: Point; field: Map<string, number>; station: Station | null };
const posts = new WeakMap<World, Post | null>();
/**
 * Toks Platz am künftigen Bahnsteig: das Feld des künftigen Bahnhofs Bär, das dem Bett am nächsten liegt (`futureBear`;
 * passt dort keine Linie, das nächste freie Feld an der Mitte des besten Platzes im Bereich des Konzepts), dazu die
 * Schritte bis dorthin von jedem Feld der Lichtung in der Nähe (Breitensuche rückwärts, höchstens 6000 Felder) und der
 * künftige Bahnhof (`station`, null ohne Platz für eine Linie: dann baut er nicht). Je Welt einmal; null ohne Höhlentor
 */
export function postOf(world: World): Post | null {
  if (posts.has(world)) return posts.get(world)!;
  const bed = world.homes.lichtung.bed;
  const g = world.gates.get('hoehle');
  let found: Post | null = null;
  if (g) {
    const far = (p: Point) => Math.hypot(p[0] - bed[0], p[1] - bed[1]);
    const stands = (p: Point) => standHeight(world, [], ...p) !== null && world.cell(...p).region === 'lichtung';
    const station = futureBear(world.seed) ?? null;
    const hut = station && hutOf(station, bed)?.at;
    const off = (p: Point) => !hut || p[0] !== hut[0] || p[1] !== hut[1]; // nicht auf dem Platz von Toks Häuschen
    const platform = station?.platform.filter((p) => stands(p) && off(p)).sort((a, b) => far(a) - far(b))[0];
    const ideal = bearSpots(g, bed)[0];
    const guess = ideal ? centreOf(ideal) : bayAt(g)(0, -6);
    const post =
      platform ??
      freeNear({ sleeping: true, player: { x: 0, y: 0 }, animals: [], openGates: [] }, world, roundP(guess), (x, y) =>
        stands([x, y]),
      );
    if (post) found = { post, field: fieldTo(world, post), station };
  }
  posts.set(world, found);
  return found;
}

const roundP = (p: Point): Point => [Math.round(p[0]), Math.round(p[1])];

function fieldTo(world: World, goal: Point, most = 6000): Map<string, number> {
  const field = new Map<string, number>([[key(...goal), 0]]);
  const queue: Point[] = [goal];
  for (let i = 0; i < queue.length && field.size < most; i++) {
    const [x, y] = queue[i]!;
    const d = field.get(key(x, y))!;
    for (const [dx, dy] of STEPS) {
      const [nx, ny] = [x + dx, y + dy];
      if (field.has(key(nx, ny)) || world.cell(nx, ny).region !== 'lichtung') continue;
      if (!canStep(world, [], nx, ny, x, y)) continue; // von dort hierher
      field.set(key(nx, ny), d + 1);
      queue.push([nx, ny]);
    }
  }
  return field;
}

/**
 * Feld zum Auftauchen: 4 bis 6 Felder neben der Figur (auch schräg), frei, erkundet, keine Plattform, mit Weg zu seinem
 * Platz; das dem künftigen Bahnhof Bär am nächsten zuerst
 */
export function tokSpot(s: Heralded, world: World, explored: Explored): Point | null {
  const at = postOf(world);
  if (!at) return null;
  const [near, far] = APPEAR;
  let best: Point | null = null;
  let bestD = Infinity;
  for (let dy = -far; dy <= far; dy++)
    for (let dx = -far; dx <= far; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < near) continue;
      const [x, y] = [s.player.x + dx, s.player.y + dy];
      const d = Math.hypot(x - at.post[0], y - at.post[1]);
      if (d >= bestD || !at.field.has(key(x, y)) || !explored(x, y) || world.cell(x, y).portal) continue;
      if (occupied(s, x, y, TOK)) continue;
      [best, bestD] = [[x, y], d];
    }
  return best;
}

/** Tok als Wesen auf (x, y), zur Figur gewandt */
const tokAt = (s: Heralded, [x, y]: Point): Walker => ({
  id: TOK,
  species: 'tok',
  x,
  y,
  dir: dirTo(s.player.x - x, s.player.y - y),
  mode: 'herald',
  home: { kind: 'region', region: 'hoehle' },
  realm: 'hoehle',
  spawn: [x, y],
  rest: CALL_EVERY,
});

/**
 * Nach jedem Befehl (`HeraldRules.step`): fällig werden, auftauchen (bzw. am Abend schlafend kommen), zur Figur hüpfen,
 * an seinen Platz gehen, dort rufen; nachts neben dem Bett, morgens ruft er; schläft er seit dem Abend, wacht er auf,
 * sobald der Spielstand es sagt (`wakeTok`)
 */
export function tokStep(
  s: Heralded,
  world: World,
  cmd: 'move' | 'action' | 'tick',
  events: Events,
  explored: Explored,
) {
  if (s.work && builtOf(s.packs) >= 2) return void build2Step(s, world, cmd, events); // Bau 2 (mitwachsen-build2.ts)
  if (s.work) return void build(s, world, cmd, events); // Bau 1 (mitwachsen-build.ts)
  const t = s.animals.find((a) => a.id === TOK);
  if (!tokWanted(s)) {
    s.heraldDue = -1;
    const shed = farOf(s); // nach Bau 2 wohnt er im Lokschuppen
    if (t?.mode === 'herald' && builtOf(s.packs) >= 1)
      (shed ? inShed : inBay)(s, world, t, cmd, events); // nach der ersten Fahrt in der Bucht
    else if (!t) (shed ? backToShed : backToBay)(s, world);
    return;
  }
  const woke = events.some((e) => e.type === 'wake');
  if (!t) return due(s, world, cmd, events, explored, woke);
  if (t.nap) {
    if (!tokOf(s.packs)?.schlaeft) wakeUp(s, world, t, events); // ein neuer echter Spieltag
    return; // schläft er, bleibt er neben dem Bett: Schlafen im Spiel weckt ihn nicht
  }
  if (events.some((e) => e.type === 'sleep')) return void bedside(s, world, t, false);
  if (woke) return greet(s, world, t, events, 'call'); // morgens ruft er zur Begrüßung, wenn sie ihn sieht
  if (cmd !== 'tick' || s.sleeping) return;
  if (s.heraldDue >= 0) return come(s, world, t, events);
  wait(s, world, t, events);
}

/**
 * Noch nicht da: Kam er schon (gespeichert, etwa nach dem Laden), ist er gleich wieder da, still: seit dem Abend
 * schlafend neben dem Bett, sonst an seinem Platz (schläft die Figur, wach neben dem Bett). Sonst wird er fällig,
 * solange die Figur am Bett steht (`nearBed`), und kommt `DUE` Takte nach dem ersten Takt (beim Aufwachen sofort); am
 * Abend schlafend. Geht sie vorher weg, beginnt es neu
 */
function due(s: Heralded, world: World, cmd: string, events: Events, explored: Explored, woke: boolean) {
  const saved = tokOf(s.packs);
  if (saved?.schlaeft) return void lieDown(s, world); // seit dem Abend schläft er neben dem Bett
  if (saved) return settle(s, world);
  if (!nearBed(s, world)) {
    s.heraldDue = -1;
    return;
  }
  if (!woke && cmd === 'tick' && s.heraldDue < 0) s.heraldDue = s.tick + DUE;
  if (!woke && (cmd !== 'tick' || s.heraldDue < 0 || s.tick < s.heraldDue)) return;
  if (s.late) nap(s, world, events);
  else appear(s, world, explored, events);
}

/** Es klopft, und Tok hüpft aus einem Hügel Steinkrümel (gespeichert: Stufe `faellig`) */
function appear(s: Heralded, world: World, explored: Explored, events: Events) {
  const at = tokSpot(s, world, explored);
  if (!at) return; // gleich noch einmal versuchen (etwa alles ringsum noch im Nebel)
  const t = tokAt(s, at);
  s.animals.push(t);
  s.heraldDue = s.tick; // erst hüpft er zur Figur
  s.packs = withTok(s.packs, { stage: tokOf(s.packs)?.stage ?? 'faellig' });
  events.push({ type: 'herald', what: 'appear', id: TOK, x: t.x, y: t.y, persist: true });
}

/** Tok schlafend neben das Bett der Lichtung legen; null, wenn dort kein Feld frei ist (gleich noch einmal) */
function lieDown(s: Heralded, world: World): Walker | null {
  const t = tokAt(s, [s.player.x, s.player.y]);
  s.animals.push(t);
  if (bedside(s, world, t, true)) return t;
  s.animals.pop();
  return null;
}

/**
 * Nach dem Laden (er kam schon und schläft nicht): gleich an seinem Platz am künftigen Bahnsteig (besetzt: das nächste
 * freie Feld mit Weg dorthin), ohne Auftauchen; schläft die Figur, wartet er wach neben dem Bett und ruft am Morgen
 */
function settle(s: Heralded, world: World) {
  s.heraldDue = -1;
  const t = tokAt(s, [s.player.x, s.player.y]);
  s.animals.push(t);
  if (s.sleeping ? bedside(s, world, t, false) : toPost(s, world, t)) return;
  s.animals.pop();
}

function toPost(s: Heralded, world: World, t: Walker): boolean {
  const at = postOf(world);
  if (!at) return false;
  const spot = occupied(s, ...at.post, TOK)
    ? freeNear(s, world, at.post, (x, y) => at.field.has(key(x, y)), TOK)
    : at.post;
  if (!spot) return false;
  [t.x, t.y] = spot;
  t.dir = dirTo(s.player.x - t.x, s.player.y - t.y);
  return true;
}

/** Am Abend: Er kommt schon schlafend und liegt neben dem Bett (gespeichert: `schlaeft`) */
function nap(s: Heralded, world: World, events: Events) {
  const t = lieDown(s, world);
  if (!t) return;
  s.packs = withTok(s.packs, { stage: tokOf(s.packs)?.stage ?? 'faellig', schlaeft: true });
  events.push({ type: 'herald', what: 'nap', id: TOK, x: t.x, y: t.y, persist: true });
}

/**
 * Neben das Bett der Lichtung (nicht auf einen Platz zum Aufwachen), zum Bett gewandt; `asleep`: und er schläft. false,
 * wenn dort kein Feld frei ist
 */
function bedside(s: Heralded, world: World, t: Walker, asleep: boolean): boolean {
  s.heraldDue = -1; // morgens wartet er am Bett, er muss nicht mehr ankommen
  const { bed, wake } = world.homes.lichtung;
  const waking = new Set(wake.map(([x, y]) => key(x, y)));
  const near = (x: number, y: number) =>
    Math.max(Math.abs(x - bed[0]), Math.abs(y - bed[1])) <= 2 && !waking.has(key(x, y)) && !world.cell(x, y).portal;
  const spot = freeNear(s, world, bed, near, t.id);
  if (!spot) return false;
  [t.x, t.y] = spot;
  t.dir = dirTo(bed[0] - t.x, bed[1] - t.y);
  if (asleep) t.nap = true;
  return true;
}

/** Am nächsten echten Spieltag: Er wacht auf, ruft (sieht die Figur ihn) und geht an seinen Platz */
function wakeUp(s: Heralded, world: World, t: Walker, events: Events) {
  delete t.nap;
  greet(s, world, t, events, 'wake');
}

/** Sieht die Figur ihn? Sie steht auf der Lichtung, höchstens `SIGHT` Felder weg */
const sees = (s: Heralded, world: World, t: Walker) =>
  world.realm(s.player.x, s.player.y) === 'lichtung' && cheb(t, s.player) <= SIGHT;

/** Ruf zum Morgen oder Aufwachen, nur wenn die Figur ihn sieht (Töne kommen nicht aus einer Richtung); sonst still */
function greet(s: Heralded, world: World, t: Walker, events: Events, what: 'call' | 'wake') {
  if (sees(s, world, t)) return call(s, t, events, what);
  t.rest = CALL_EVERY;
}

function call(s: Heralded, t: Walker, events: Events, what: 'call' | 'wake' | 'arrive') {
  t.dir = dirTo(s.player.x - t.x, s.player.y - t.y);
  t.rest = CALL_EVERY;
  events.push({ type: 'herald', what, id: t.id, x: t.x, y: t.y });
}

/**
 * Ankommen: Er hüpft zur Figur; ist er bei ihr (höchstens `NEAR` Felder weg), hüpft er und zeigt ein Herz (`arrive`),
 * danach geht er an seinen Platz. Kommt er in `COME` Takten nicht durch, freut er sich dort, wo er gerade ist
 */
function come(s: Heralded, world: World, t: Walker, events: Events) {
  if (cheb(t, s.player) > NEAR && s.tick - s.heraldDue < COME) {
    if (s.tick % PACE.chase === 0) stepTo(s, world, t, (x, y) => Math.hypot(x - s.player.x, y - s.player.y));
    return;
  }
  s.heraldDue = -1;
  call(s, t, events, 'arrive');
}

/**
 * Warten: Er geht an seinen Platz am künftigen Bahnsteig (ein Feld je `PACE.lead` Takte); dort schaut er zur Figur und
 * ruft höchstens alle `CALL_EVERY` Takte, solange sie ihn sieht (höchstens `SIGHT` Felder weg) und nicht neben ihm steht
 */
function wait(s: Heralded, world: World, t: Walker, events: Events) {
  const at = postOf(world);
  if (t.rest > 0) t.rest--;
  if (at && (t.x !== at.post[0] || t.y !== at.post[1])) {
    if (s.tick % PACE.lead === 0) stepTo(s, world, t, (x, y) => at.field.get(key(x, y)) ?? Infinity);
    return;
  }
  if (!sees(s, world, t)) return;
  const gap = cheb(t, s.player);
  t.dir = dirTo(s.player.x - t.x, s.player.y - t.y);
  if (t.rest <= 0 && gap > 1) call(s, t, events, 'call');
}

/** Ein Schritt auf ein freies Nachbarfeld, das nach `cost` näher liegt (das beste zuerst); sonst bleibt er stehen */
function stepTo(s: Heralded, world: World, t: Walker, cost: (x: number, y: number) => number) {
  const here = cost(t.x, t.y);
  const next = STEPS.map(([dx, dy]): Point => [t.x + dx, t.y + dy])
    .filter(([x, y]) => cost(x, y) < here && !occupied(s, x, y, t.id) && canStep(world, s.openGates, t.x, t.y, x, y))
    .sort((a, b) => cost(...a) - cost(...b))[0];
  if (!next) return;
  t.dir = dirTo(next[0] - t.x, next[1] - t.y);
  [t.x, t.y] = next;
}

/**
 * Steht Tok an seinem Platz (auf dem künftigen Bahnsteig oder höchstens ein Feld neben seinem Platz) in einer Welt, in
 * der Bahnhof Bär Platz hat? Nur dann beginnt er zu bauen; unterwegs dorthin singt und hüpft er nur
 */
export function atPost(world: World, t: { x: number; y: number }): boolean {
  const at = postOf(world);
  if (!at?.station || !rowsOf(at.station).length) return false;
  const near = Math.max(Math.abs(t.x - at.post[0]), Math.abs(t.y - at.post[1])) <= 1;
  return near || at.station.platform.some(([x, y]) => x === t.x && y === t.y);
}

/** Das Feld des Bahnsteigs neben dem hinteren Wagen des haltenden Zugs: Dorthin hüpft Tok, bevor er einsteigt */
export function rearOf(world: World): Point | undefined {
  const station = postOf(world)?.station;
  const rows = station ? rowsOf(station) : [];
  return rows[Math.min(REAR_ROW, rows.length - 1)]?.edge;
}

/**
 * Solange er baut: Sobald der Zug heranrollt (`roll`), hüpft Tok über den Bahnsteig an den hinteren Wagen (ein Feld je
 * `PACE.lead` Takte, lieber auf dem Bahnsteig als daneben), dann steigt er ein (`buildStep`)
 */
function build(s: Heralded, world: World, cmd: string, events: Events) {
  const t = s.animals.find((a) => a.id === TOK);
  const rear = rearOf(world);
  if (t && rear && s.work && cmd === 'tick' && s.tick >= beatTick(s.work.from, BUILD.roll[0])) {
    const on = new Set(postOf(world)?.station?.platform.map(([x, y]) => key(x, y)));
    const cost = (x: number, y: number) => Math.hypot(x - rear[0], y - rear[1]) + (on.has(key(x, y)) ? 0 : 2);
    if ((t.x !== rear[0] || t.y !== rear[1]) && s.tick % PACE.lead === 0) stepTo(s, world, t, cost);
  }
  buildStep(s, TOK, events);
}

/**
 * Vor dem Schritt der Figur (`HeraldRules.meet`): Solange Tok baut, hüpft sie auf jeden Pfeil nur. In den schlafenden Tok
 * gelaufen, schnarcht er leise, sie bleibt stehen; in den wachen an seinem Platz (`atPost`), beginnt er den nächsten Bau
 * (Bau 1, solange noch nichts gebaut ist, `canBuild`); sonst singt und hüpft er (Regeln des Kerns)
 */
export function tokMeet(s: Heralded, world: World, cmd: { dir: keyof typeof DIRS }, events: Events): boolean {
  const [dx, dy] = DIRS[cmd.dir];
  if (building(s)) {
    s.player.dir = cmd.dir;
    events.push({ type: 'hop' });
    return true;
  }
  const t = s.animals.find((a) => a.id === TOK);
  if (!t || t.x !== s.player.x + dx || t.y !== s.player.y + dy) return false;
  if (!t.nap && !(canBuild(s) && atPost(world, t))) return false;
  s.player.dir = cmd.dir;
  if (t.nap) events.push({ type: 'herald', what: 'snore', id: TOK, x: t.x, y: t.y });
  else startBuild(s, t, events);
  return true;
}

type Bay = { post: Point; field: Map<string, number> };
const bays = new WeakMap<World, Bay | null>();
/**
 * Toks Platz in der Bucht: neben der Torplatte (`BESIDE`), dazu die Schritte dorthin von der Lichtung (bis zum Bett, die
 * Bucht liegt weiter weg als sein Platz am Bahnsteig). Je Welt einmal; null ohne Höhlentor
 */
export function bayOf(world: World): Bay | null {
  if (bays.has(world)) return bays.get(world)!;
  const g = world.gates.get('hoehle');
  const post = g && plateRow(g, BESIDE);
  const found = post ? { post, field: fieldTo(world, post, 24000) } : null;
  bays.set(world, found);
  return found;
}

/**
 * Tok wartet in der Bucht (nach der ersten Fahrt, mitwachsen-train.ts): Schläft die Figur ein, sitzt er wach neben dem
 * Bett der Lichtung (eingeschlafen wird nie im Zug); morgens ruft er, wenn sie ihn sieht, und hüpft zurück an seinen Platz
 * neben der Torplatte (ein Feld je `PACE.lead` Takte), dort schaut er zum Tor
 */
export function inBay(s: Heralded, world: World, t: Walker, cmd: 'move' | 'action' | 'tick', events: Events) {
  if (events.some((e) => e.type === 'sleep')) return void bedside(s, world, t, false);
  if (events.some((e) => e.type === 'wake')) return greet(s, world, t, events, 'call');
  const at = bayOf(world);
  const g = world.gates.get('hoehle');
  if (cmd !== 'tick' || s.sleeping || !at || !g) return;
  if (t.x === at.post[0] && t.y === at.post[1]) {
    t.dir = dirTo(g.mid[0] - t.x, g.mid[1] - t.y);
    return;
  }
  if (s.tick % PACE.lead === 0) stepTo(s, world, t, (x, y) => at.field.get(key(x, y)) ?? Infinity);
}

/**
 * Nach dem Laden, wenn die erste Fahrt schon gemacht ist (`gefahren`, Ausbau 1, der Zug fährt noch nicht in die Grotte,
 * `farOf`): Tok wartet wieder in der Bucht, nicht im Zug. Schläft die Figur (nach dem Laden immer), sitzt er wach neben
 * dem Bett der Lichtung und hüpft am Morgen an seinen Platz neben der Torplatte (`inBay`); sonst gleich dort (besetzt:
 * das nächste freie Feld mit Weg dorthin)
 */
export function backToBay(s: Heralded, world: World) {
  if (builtOf(s.packs) < 1 || !ridden(s.packs, 'hoehle') || farOf(s) || s.work) return;
  const t = tokAt(s, [s.player.x, s.player.y]);
  s.animals.push(t);
  if (s.sleeping) {
    if (bedside(s, world, t, false)) return;
  } else {
    const at = bayOf(world);
    const free = (x: number, y: number) => !!at?.field.has(key(x, y));
    const spot = at && (occupied(s, ...at.post, TOK) ? freeNear(s, world, at.post, free, TOK) : at.post);
    const g = world.gates.get('hoehle');
    if (spot && g) {
      [t.x, t.y] = spot;
      t.dir = dirTo(g.mid[0] - t.x, g.mid[1] - t.y); // schaut zum Tor
      return;
    }
  }
  s.animals.pop();
}

/**
 * Nach Bau 2 wohnt Tok im Lokschuppen neben Bahnhof Fledermaus (mitwachsen-build2.ts): Dort steht er an seinem Platz und
 * schaut zur Figur, wenn sie in der Grotte nah ist (Rufen kommt nur, wenn man in ihn hineinläuft: Er singt und hüpft);
 * schläft die Figur ein, schläft er dort auch (`nap`, Zzz), morgens wacht er auf und ruft, wenn sie ihn sieht. Steht er
 * nicht an seinem Platz, hüpft er hin
 */
export function inShed(s: Heralded, world: World, t: Walker, cmd: 'move' | 'action' | 'tick', events: Events) {
  if (events.some((e) => e.type === 'sleep')) return void (t.nap = true);
  if (events.some((e) => e.type === 'wake')) {
    delete t.nap;
    if (world.realm(s.player.x, s.player.y) === 'hoehle' && cheb(t, s.player) <= SIGHT) call(s, t, events, 'wake');
    return;
  }
  const home = shedIn(world).home;
  if (cmd !== 'tick' || s.sleeping || !home) return;
  if (t.x !== home[0] || t.y !== home[1]) {
    if (s.tick % PACE.lead === 0) stepTo(s, world, t, (x, y) => Math.hypot(x - home[0], y - home[1]));
    return;
  }
  if (world.realm(s.player.x, s.player.y) === 'hoehle' && cheb(t, s.player) <= SIGHT)
    t.dir = dirTo(s.player.x - t.x, s.player.y - t.y);
}

/**
 * Nach dem Laden (Ausbau 2, Höhlentor offen): Tok ist gleich in seinem Lokschuppen, ohne den Maulwurf (`solo`); schläft
 * die Figur, schläft er dort. Nicht, solange er im Zug sitzt (Bau 2: zwischen Prellbock und Bahnhof Fledermaus) oder
 * baut, und nur, wenn die Grotte da ist (sonst gibt es den Lokschuppen nicht)
 */
export function backToShed(s: Heralded & Pick<Rider, 'ride'>, world: World) {
  if (s.work || s.ride?.stopover) return;
  const t = tokInShed(s, world);
  if (!t) return;
  if (s.sleeping) t.nap = true;
  s.animals.push(t);
}

/** Toks Regeln für `step` (`WorldRules.herald`) */
export const TOK_RULES: HeraldRules = { step: tokStep, meet: tokMeet };
