// Tok erscheint – rein, ohne DOM: der Bote der Höhlenwelt nach dem Muster des verlaufenen Pinguins, im Paket der Bahn
// (`WorldRules.herald`, mitwachsen-herald.ts). Ist noch nichts gebaut (Ausbau 0), das Eistor offen, die Eis-Leiste voll
// (von jeder Eis-Art wohnt ein Tier auf der Schneewiese) und hat der Schlitten das Kind schon einmal heimgebracht, wird
// er fällig, sobald die Figur wach auf der Lichtung höchstens `TOK_NEAR` Felder vom Bett steht: `DUE` Takte später (beim
// Aufwachen sofort) klopft es, und er hüpft aus einem Hügel Steinkrümel 4 bis 6 Felder neben ihr, auf dem Feld, das dem
// künftigen Bahnhof Bär am nächsten liegt, mit „Ju-hu“. Er hüpft zur Figur (Hüpfer, Herz), dann stellt er sich an den
// künftigen Bahnsteig und ruft dort höchstens alle 4 s. Geht sie vorher weg, beginnt die Wartezeit neu. Am Abend (die
// Uhr des Kinds hat `BED_AT` erreicht, `late`) kommt er schon schlafend und liegt neben dem Bett („Zzz“); er wacht erst
// am nächsten echten Spieltag auf (mehr als `BREAK` Pause, `wakeTok` in mitwachsen-tok-save.ts), Schlafen im Spiel weckt
// ihn nicht. Gespeichert wird nur `packs.fahrt.hoehle = { stage: 'faellig', schlaeft? }`, nie wo er steht. Er steht nie
// im Weg: Läuft die Figur in ihn hinein, singt und hüpft er (Regeln des Kerns); schläft er, schnarcht er leise.
// Bis zum Freischalten (`BAHN_LIVE`) holt das Spiel dieses Paket nie von selbst: Dann gibt es Tok nur im Blick hinein.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint)

import { DIRS } from '../../../../lib/games/front';
import { REGIONS, animalId, type Point } from '../../../../data/games/mitwachsen';
import { APPEAR, DUE, NEAR, PACE, PEEP_EVERY, full } from '../../mitwachsen-guide';
import type { HeraldEvents as Events, HeraldRules, Heralded } from '../../mitwachsen-herald';
import { dirTo, freeNear, occupied } from '../../mitwachsen-free';
import { canStep, standHeight, type World } from '../../mitwachsen-world';
import { bayAt, bearSpots, centreOf } from './mitwachsen-bear';
import { builtOf } from './mitwachsen-built';
import { futureBear } from './mitwachsen-line';
import { sledHome, tokOf, withTok } from './mitwachsen-tok-save';

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

const posts = new WeakMap<World, { post: Point; field: Map<string, number> } | null>();
/**
 * Toks Platz am künftigen Bahnsteig: das Feld des künftigen Bahnhofs Bär, das dem Bett am nächsten liegt (`futureBear`;
 * passt dort keine Linie, das nächste freie Feld an der Mitte des besten Platzes im Bereich des Konzepts), dazu die
 * Schritte bis dorthin von jedem Feld der Lichtung in der Nähe (Breitensuche rückwärts, höchstens 6000 Felder). Je Welt
 * einmal; null ohne Höhlentor
 */
export function postOf(world: World): { post: Point; field: Map<string, number> } | null {
  if (posts.has(world)) return posts.get(world)!;
  const bed = world.homes.lichtung.bed;
  const g = world.gates.get('hoehle');
  let found: { post: Point; field: Map<string, number> } | null = null;
  if (g) {
    const far = (p: Point) => Math.hypot(p[0] - bed[0], p[1] - bed[1]);
    const stands = (p: Point) => standHeight(world, [], ...p) !== null && world.cell(...p).region === 'lichtung';
    const station = futureBear(world.seed);
    const platform = station?.platform.filter(stands).sort((a, b) => far(a) - far(b))[0];
    const ideal = bearSpots(g, bed)[0];
    const guess = ideal ? centreOf(ideal) : bayAt(g)(0, -6);
    const post =
      platform ??
      freeNear({ sleeping: true, player: { x: 0, y: 0 }, animals: [], openGates: [] }, world, roundP(guess), (x, y) =>
        stands([x, y]),
      );
    if (post) found = { post, field: fieldTo(world, post) };
  }
  posts.set(world, found);
  return found;
}

const roundP = (p: Point): Point => [Math.round(p[0]), Math.round(p[1])];

function fieldTo(world: World, goal: Point): Map<string, number> {
  const field = new Map<string, number>([[key(...goal), 0]]);
  const queue: Point[] = [goal];
  for (let i = 0; i < queue.length && field.size < 6000; i++) {
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
  if (!tokWanted(s)) {
    s.heraldDue = -1;
    return;
  }
  const t = s.animals.find((a) => a.id === TOK);
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

/** Vor dem Schritt der Figur (`HeraldRules.meet`): In den schlafenden Tok gelaufen, schnarcht er leise, sie bleibt stehen */
export function tokMeet(s: Heralded, _world: World, cmd: { dir: keyof typeof DIRS }, events: Events): boolean {
  const [dx, dy] = DIRS[cmd.dir];
  const t = s.animals.find((a) => a.id === TOK && a.nap);
  if (!t || t.x !== s.player.x + dx || t.y !== s.player.y + dy) return false;
  s.player.dir = cmd.dir;
  events.push({ type: 'herald', what: 'snore', id: TOK, x: t.x, y: t.y });
  return true;
}

/** Toks Regeln für `step` (`WorldRules.herald`) */
export const TOK_RULES: HeraldRules = { step: tokStep, meet: tokMeet };
