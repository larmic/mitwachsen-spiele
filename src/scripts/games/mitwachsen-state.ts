// Spielregeln von Mitwachsen als reine Zustandsmaschine – ohne DOM, ohne Timer, ohne Math.random.
// Die Web Component (larmic-mitwachsen.ts) schickt Befehle (`move`, `action`, `tick`) an `step` und reagiert auf die
// Ereignisse, die zurückkommen (Töne, Herzen, Speichern). Zufall kommt aus einer Folge im Zustand.
// Spezifikation: docs/specs/mitwachsen.md

import { chunkOf } from '../../lib/games/chunks';
import { DIRS, type Dir } from '../../lib/games/front';
import { cycle, nextRandom, pick } from '../../lib/games/rng';
import {
  GATES,
  REGIONS,
  realmOfAnimal,
  regionAnimalList,
  type GateId,
  type Point,
  type RegionId,
  type SpeciesId,
} from '../../data/games/mitwachsen';
import type { StoryId } from '../../data/games/mitwachsen-stories';
import { canStep, standHeight, wildAnimals, type World } from './mitwachsen-world';
import { chore, regrow, type ChoreEvent } from './mitwachsen-chores';
import { homeAt, startRealm } from './mitwachsen-home';
import { platformsToWake, stepOn } from './mitwachsen-portal';
import { sheltering } from './mitwachsen-weather';
import { PENGUIN, atHome, meadowSpots, shelterPlaces, windOk, type Home } from './mitwachsen-meadow';
import { dirTo, freeNear, occupied } from './mitwachsen-free';
import { crossBorder, type BorderEvent, type Mode } from './mitwachsen-border';

export const SLEEP_LOCK = 30; // Takte nach dem Einschlafen, in denen Tasten nicht wecken (3 s)
export const WAKE_GRACE = 15; // Takte nach dem Aufwachen, in denen das Bett nur ein Hindernis ist (1,5 s)
export { REGROW } from './mitwachsen-chores';
export const WILD_RADIUS = 1; // Stücke um die Figur, in denen Tiere der Landschaft unterwegs sind
export const WILD_KEEP = 2; // ab diesem Abstand verschwinden sie wieder (und tauchen später an ihrem Platz auf)

export type { Home } from './mitwachsen-meadow';
export type Animal = {
  id: string;
  species: SpeciesId;
  x: number;
  y: number;
  dir: Dir;
  mode: Mode; // umherlaufen, folgen, auf der Wiese wohnen oder an der Weltgrenze warten (mitwachsen-border.ts)
  home: Home;
  realm: RegionId; // Gegend, zu der das Tier gehört: Zu Hause ist es nur auf der Wiese ihres Betts
  spawn: readonly [number, number];
  rest: number; // Takte bis zum nächsten Schritt beim Umherlaufen
};
export type HomeAnimal = { id: string; species: SpeciesId };

export type State = {
  tick: number;
  rng: number;
  player: { x: number; y: number; dir: Dir };
  sleeping: boolean;
  sleptAt: number;
  wokeAt: number;
  animals: Animal[];
  followers: string[]; // Reihenfolge = Platz in der Kette hinter der Figur
  met: string[];
  garden: HomeAnimal[];
  openGates: GateId[];
  portals: GateId[]; // wache Portal-Plattformen (je Tor eine, mit Gegenstück am Bett)
  arrived: readonly [number, number] | null; // Mittelfeld, auf dem die Figur angekommen ist: erst runter, dann wieder rauf (nicht gespeichert)
  picked: Record<string, number>; // Büsche ohne Beeren und leere Fischkisten: "x,y" → Takt des Leerens (nicht gespeichert)
  day: number; // Tage, die die Welt schon erlebt hat (jedes Schlafen zählt einen); Blumen wachsen damit
  dayStart: number; // Takt, an dem der heutige Tag begann (Aufwachen): Das Wetter zählt ab hier, jeder Tag beginnt mit Sonne
  basket: boolean; // Korb mit Beeren auf dem Rücken (nach dem Pflücken, bis zum Futtertrog)
  bucket: boolean; // Eimer mit Wasser in der Hand (nach dem Schöpfen, bis zum Wassertrog)
  fish: boolean; // Netz mit Fischen in der linken Hand (nach dem Fangen an der Fischkiste, bis zur Eisschale)
  heard: StoryId[]; // Geschichten, deren Klangstein schon einmal erklungen ist
  calm: number; // Tag, an dem der Pinguin auf die Schneewiese gezogen ist: an ihm weht kein Pustewind (nicht gespeichert)
};

/** Was gespeichert wird */
export type Progress = {
  met: string[];
  garden: HomeAnimal[];
  openGates: GateId[];
  portals: GateId[];
  position: [number, number];
  day: number;
  heard: StoryId[];
};

export type Step = { state: State; events: GameEvent[] };
type Explored = (x: number, y: number) => boolean;
const EVERYWHERE: Explored = () => true;
export type Cmd = { type: 'move'; dir: Dir } | { type: 'action' } | { type: 'tick' };
export type GameEvent =
  | { type: 'step'; climb: number }
  | { type: 'bump' }
  | { type: 'sing'; id: string; species: SpeciesId; first: boolean }
  | { type: 'follow'; id: string }
  | { type: 'swap'; id: string }
  | { type: 'story'; id: StoryId; first: boolean } // Klangstein angelaufen: Melodie und Geschichte des Ortes
  | { type: 'aside'; id: string; species: SpeciesId } // ein Tier der Wiese macht der Figur Platz
  | { type: 'home'; id: string; species: SpeciesId } // auf der Wiese angekommen
  | { type: 'gate'; id: GateId }
  | { type: 'portal'; id: GateId } // Plattform am Tor (und ihr Gegenstück am Bett) erwacht
  | { type: 'teleport'; id: GateId; to: 'gate' | 'home' }
  | { type: 'ready'; id: GateId } // nach der Ankunft von der Mitte gestiegen: Die Plattform ist wieder bereit
  | ChoreEvent // Handgriffe: pflücken, fangen, nachwachsen, füttern, schöpfen, tränken (mitwachsen-chores.ts)
  | BorderEvent // Weltgrenze am Tor: warten, wieder einreihen, Gegend wechseln (mitwachsen-border.ts)
  | { type: 'call' }
  | { type: 'sleep' }
  | { type: 'wake' };

const ALL_DIRS: Dir[] = ['n', 'e', 's', 'w'];
const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/**
 * Darf ein Tier einen Schritt nach (tx, ty) gehen? Es bleibt in seinem Zuhause; wer draußen steht (`away`), zieht heim,
 * ein Tier der Wiese dabei nur über die Wiese.
 */
function mayWalk(s: State, world: World, a: Animal, away: boolean, tx: number, ty: number): boolean {
  const allowed = away ? a.home.kind !== 'garden' || world.cell(tx, ty).garden === true : atHome(world, a.home, tx, ty);
  return allowed && canStep(world, s.openGates, a.x, a.y, tx, ty) && !occupied(s, tx, ty);
}

function random(s: State): number {
  const [v, next] = nextRandom(s.rng);
  s.rng = next;
  return v;
}

// ---------- Aufbau ----------

export function initialState(world: World, saved: Partial<Progress> = {}, rngSeed = 1): State {
  const garden = saved.garden ?? [];
  const atHomeIds = new Set(garden.map((p) => p.id));
  const animals: Animal[] = [];
  for (const r of REGIONS)
    for (const { id, species } of regionAnimalList(r)) {
      const at = world.spawns.get(id); // die Welt kennt den erreichbaren Wohnort
      if (at && !atHomeIds.has(id))
        animals.push({
          id,
          species,
          x: at[0],
          y: at[1],
          dir: 's',
          mode: 'wander',
          home: { kind: 'region', region: r.id },
          realm: r.id,
          spawn: at,
          rest: 5,
        });
    }
  const placed = new Map<RegionId, number>(); // je Gegend: so viele Tiere stehen schon auf ihrer Wiese
  for (const p of garden) {
    const realm = realmOfAnimal(p.id);
    const i = placed.get(realm) ?? 0;
    placed.set(realm, i + 1);
    const [x, y] = cycle(meadowSpots(world, realm), i);
    animals.push({
      id: p.id,
      species: p.species,
      x,
      y,
      dir: 's',
      mode: 'home',
      home: { kind: 'garden' },
      realm,
      spawn: [x, y],
      rest: 5,
    });
  }
  // Nur Tore, die überhaupt aufgehen können, bleiben aus dem Spielstand offen
  const open = (saved.openGates ?? []).filter((id) => GATES.some((g) => g.id === id && g.opens !== 'never'));
  const [bx, by] = world.homes[startRealm(world, open, saved.position)].bed;
  const s: State = {
    tick: 0,
    rng: rngSeed >>> 0,
    player: { x: bx, y: by, dir: 's' },
    sleeping: true,
    sleptAt: -SLEEP_LOCK, // die erste Taste weckt sofort
    wokeAt: -WAKE_GRACE,
    animals,
    followers: [],
    met: [...(saved.met ?? [])].sort(),
    garden: [...garden],
    openGates: open,
    portals: (saved.portals ?? []).filter((id) => world.portals.has(id)),
    arrived: null,
    picked: {},
    basket: false,
    bucket: false,
    fish: false,
    day: saved.day ?? 0,
    dayStart: 0,
    heard: (saved.heard ?? []).filter((id) => world.stones.has(id)),
    calm: -1,
  };
  scatter(s, world); // jeder Besuch: Die Tiere wohnen woanders
  syncWild(s, world);
  return s;
}

/** Wechselnde Plätze je Gegend: so weit mindestens vom Bett und voneinander (der Gletscherkessel ist klein) */
export const SCATTER: Record<RegionId, { bed: number; apart: number }> = {
  lichtung: { bed: 8, apart: 5 },
  eis: { bed: 6, apart: 4 },
};

/**
 * Tiere der Gegenden, die frei umherlaufen, an neue Plätze verteilen (beim Öffnen und an jedem neuen Morgen):
 * zufällige erreichbare Felder ihrer Gegend, mit Abstand zu deren Bett und zueinander (`SCATTER`). Gleicher Zustand,
 * gleiche Plätze.
 */
function scatter(s: State, world: World) {
  const placed: [number, number][] = []; // die Gegenden liegen weit auseinander: eine Liste für alle genügt
  for (const a of s.animals) {
    if (a.mode !== 'wander' || a.home.kind !== 'region') continue;
    const spots = world.spotsOf(a.realm);
    const [bx, by] = world.homes[a.realm].bed;
    const { bed, apart } = SCATTER[a.realm];
    if (!spots.length) continue;
    for (let tries = 0; tries < 80; tries++) {
      const [x, y] = pick(spots, random(s));
      if (cheb(x, y, bx, by) < bed || !atHome(world, a.home, x, y)) continue; // nicht an Toren
      if (placed.some(([px, py]) => cheb(x, y, px, py) < apart) || occupied(s, x, y, a.id)) continue;
      [a.x, a.y] = [x, y];
      a.spawn = [x, y];
      placed.push([x, y]);
      break;
    }
  }
}

export const progressOf = (s: State): Progress => ({
  met: [...s.met],
  garden: [...s.garden],
  openGates: [...s.openGates],
  portals: [...s.portals],
  position: [s.player.x, s.player.y],
  day: s.day,
  heard: [...s.heard],
});

/** Tiere einer Gegend (Kennungen) */
export const regionAnimals = (region: RegionId): string[] =>
  regionAnimalList(REGIONS.find((r) => r.id === region)!).map((a) => a.id);

// ---------- Ein Schritt ----------

/**
 * Ein Befehl. `explored(x, y)` sagt, ob ein Feld schon aus dem Nebel ist (der Nebel gehört der Ansicht): Nur dort
 * erwacht eine Portal-Plattform. Ohne Angabe gilt alles als erkundet.
 */
export function step(state: State, world: World, cmd: Cmd, explored: Explored = EVERYWHERE): Step {
  // Flache Kopie: Tiere werden beim Ändern ersetzt, nie verändert – alte Zustände bleiben gültig
  const s: State = {
    ...state,
    player: { ...state.player },
    animals: state.animals.map((a) => ({ ...a })),
    followers: [...state.followers],
    met: [...state.met],
    garden: [...state.garden],
    openGates: [...state.openGates],
    portals: [...state.portals],
    picked: { ...state.picked },
  };
  const events: GameEvent[] = [];
  if (cmd.type === 'tick') tick(s, world, events);
  else if (s.sleeping) wake(s, world, events);
  else if (cmd.type === 'move') {
    const from: Point = [s.player.x, s.player.y];
    move(s, world, cmd.dir, events);
    // Neues Feld: Plattformen (reisen, wieder bereit), dann die Weltgrenze am Tor (warten, wieder einreihen)
    if (s.player.x !== from[0] || s.player.y !== from[1]) {
      landed(s, world, events);
      crossBorder(s, world, from, events);
    }
  } else action(s, world, events);
  // Portal-Plattformen in der Nähe erwachen (Regeln in mitwachsen-portal.ts)
  for (const id of s.sleeping ? [] : platformsToWake(world.portals, s.portals, s.player.x, s.player.y, explored)) {
    s.portals.push(id);
    events.push({ type: 'portal', id });
  }
  return { state: s, events };
}

function tick(s: State, world: World, events: GameEvent[]) {
  s.tick++;
  regrow(s, events); // Beeren und Fische wachsen nach, auch nachts
  if (s.sleeping) return; // nachts ist es still
  syncWild(s, world);
  // Regnet es auf der Lichtung bzw. weht in der Eis-Welt der Pustewind, gehen die Tiere der Wiese dieser Gegend unter
  // ihren Unterstand: jedes an einen eigenen Platz darunter oder dicht daneben (Riesenpilz bzw. Iglu)
  const t = s.tick - s.dayStart;
  const places = shelterPlaces(world, s.animals, (realm) => sheltering(world.seed, s.day, t, realm, windOk(s)));
  for (const a of s.animals) {
    if (a.mode === 'follow' || a.mode === 'wait') continue; // folgt der Figur bzw. sitzt auf seinem Warteplatz
    const spot = places.get(a.id);
    const wet = spot !== undefined;
    const goal = spot ?? a.spawn;
    const gap = Math.abs(a.x - goal[0]) + Math.abs(a.y - goal[1]);
    // Gerade heimgekommen oder Regen bzw. Wind: Es läuft zu seinem Platz auf der Wiese bzw. unter dem Dach
    const arriving = a.mode === 'home' && gap > (wet ? 0 : 2);
    if (wet && !arriving) {
      a.rest = Math.max(a.rest, 5); // bleibt im Trockenen bzw. Windstillen
      continue;
    }
    // Steht die Figur daneben, bleibt das Tier stehen und schaut sie an
    if (!arriving && cheb(a.x, a.y, s.player.x, s.player.y) <= 1) {
      a.dir = dirTo(s.player.x - a.x, s.player.y - a.y);
      a.rest = Math.max(a.rest, 5);
      continue;
    }
    if (--a.rest > 0) continue;
    a.rest = arriving ? 3 : 8 + Math.floor(random(s) * 18);
    if (!arriving && random(s) < 0.3) {
      a.dir = pick(ALL_DIRS, random(s));
      continue;
    }
    // Außerhalb des Zuhauses (nach einem Platztausch) zieht es heim, sonst läuft es zufällig
    const away = !atHome(world, a.home, a.x, a.y);
    // zielstrebig heim (außerhalb des Zuhauses) oder zum eigenen Platz auf der Wiese, sonst zufällig
    const order =
      away || arriving
        ? [...ALL_DIRS].sort((p, q) => dist(a, p, goal) - dist(a, q, goal))
        : [pick(ALL_DIRS, random(s))];
    // Im Iglu schlüpft ein Tier an den schon Sitzenden vorbei zu seinem Platz, sonst blieben die hinteren Plätze zu
    if (spot && order[0] && slipPast(s, world, a, order[0], places)) continue;
    for (const d of order) {
      const [dx, dy] = DIRS[d];
      const tx = a.x + dx,
        ty = a.y + dy;
      a.dir = d;
      if (mayWalk(s, world, a, away, tx, ty)) {
        [a.x, a.y] = [tx, ty];
        break;
      }
    }
  }
}

/**
 * Pustewind (Unterstand mit `huddle`, das Iglu): Sitzt auf dem nächsten Feld zum eigenen Platz schon ein Tier auf
 * seinem Platz, tauschen beide; das andere rückt gleich wieder an seinen Platz. Liefert true, wenn getauscht wurde.
 */
function slipPast(s: State, world: World, a: Animal, d: Dir, places: Map<string, [number, number]>): boolean {
  if (!world.homes[a.realm].huddle) return false;
  const [tx, ty] = [a.x + DIRS[d][0], a.y + DIRS[d][1]];
  const other = s.animals.find((o) => o.x === tx && o.y === ty);
  const its = other && places.get(other.id);
  if (!other || its?.[0] !== tx || its[1] !== ty) return false;
  if (!canStep(world, s.openGates, a.x, a.y, tx, ty) || !canStep(world, s.openGates, tx, ty, a.x, a.y)) return false;
  [other.x, other.y, a.x, a.y] = [a.x, a.y, tx, ty];
  a.dir = d;
  return true;
}

/**
 * Die Figur läuft in ein Tier, das ihr folgt oder auf der Wiese wohnt. Ein folgendes Tier tauscht den Platz (umdrehen
 * geht immer). Eines auf der Wiese macht Platz: Es hüpft zur Seite und die Figur geht weiter – so kommt sie auch durch
 * eine volle Wiese. Ist seitlich nichts frei, tauschen beide. Liefert true, wenn der Zug damit erledigt ist.
 */
function meetAnimal(s: State, world: World, animal: Animal, dir: Dir, events: GameEvent[]): boolean {
  const p = s.player;
  const climbable = canStep(world, s.openGates, p.x, p.y, animal.x, animal.y);
  const aside = climbable && animal.mode === 'home' ? asideCell(s, world, animal, dir) : null;
  if (aside) {
    [animal.x, animal.y] = aside;
    animal.dir = dirTo(p.x + DIRS[dir][0] - aside[0], p.y + DIRS[dir][1] - aside[1]); // schaut zur Figur
    animal.rest = Math.max(animal.rest, 8); // bleibt kurz, wo es ist, statt gleich zurückzulaufen
    events.push({ type: 'aside', id: animal.id, species: animal.species });
    return false; // die Figur geht auf das frei gewordene Feld
  }
  if (climbable && (animal.mode === 'follow' || atHome(world, animal.home, p.x, p.y))) {
    const [dx, dy] = DIRS[dir];
    [animal.x, animal.y] = [p.x, p.y];
    animal.dir = dirTo(-dx, -dy);
    [p.x, p.y] = [p.x + dx, p.y + dy];
    events.push({ type: 'swap', id: animal.id });
    bringHome(s, world, events);
    return true;
  }
  sing(s, animal, false, events);
  return true;
}

/**
 * Klangstein angelaufen: Die Geschichte des Ortes erklingt (abspielen und anhalten macht die Ansicht). Tiere in der Nähe
 * drehen sich zur Figur und bleiben eine Weile stehen, als hörten sie mit.
 */
function listen(s: State, id: StoryId, events: GameEvent[]) {
  const first = !s.heard.includes(id);
  if (first) s.heard = [...s.heard, id].sort();
  for (const a of s.animals)
    if (a.mode !== 'follow' && cheb(a.x, a.y, s.player.x, s.player.y) <= 3) {
      a.dir = dirTo(s.player.x - a.x, s.player.y - a.y);
      a.rest = Math.max(a.rest, 40);
    }
  events.push({ type: 'story', id, first });
}

/** Freies Feld neben einem Tier der Wiese, auf das es ausweichen kann: lieber seitlich als weiter geradeaus */
function asideCell(s: State, world: World, a: Animal, dir: Dir): [number, number] | null {
  const sides: Dir[] = dir === 'e' || dir === 'w' ? ['n', 's'] : ['e', 'w'];
  if (random(s) < 0.5) sides.reverse();
  for (const d of [...sides, dir]) {
    const [tx, ty] = [a.x + DIRS[d][0], a.y + DIRS[d][1]];
    if (mayWalk(s, world, a, false, tx, ty)) return [tx, ty];
  }
  return null;
}

const dist = (a: Animal, d: Dir, goal: readonly [number, number]) =>
  Math.abs(a.x + DIRS[d][0] - goal[0]) + Math.abs(a.y + DIRS[d][1] - goal[1]);

function move(s: State, world: World, dir: Dir, events: GameEvent[]) {
  const p = s.player;
  p.dir = dir;
  const [dx, dy] = DIRS[dir];
  const tx = p.x + dx,
    ty = p.y + dy;
  const animal = s.animals.find((a) => a.x === tx && a.y === ty);
  if (animal?.mode === 'wander') {
    // Hineinlaufen reicht: Das Tier singt, freut sich und folgt (die Aktionstaste braucht es dafür nicht)
    return sing(s, animal, true, events);
  }
  if (animal && meetAnimal(s, world, animal, dir, events)) return;
  const story = world.cell(tx, ty).story;
  if (story) return listen(s, story, events);
  // Handgriffe: Beeren pflücken, Fische fangen, Wasser schöpfen, in die Tröge der Wiese bringen (mitwachsen-chores.ts)
  if (chore(s, world, tx, ty, events)) return;
  // Ins Bett laufen: Die Figur legt sich schlafen (nicht gleich nach dem Aufwachen, sonst schläft sie aus Versehen ein)
  if (world.cell(tx, ty).deco === 'bed' && s.tick - s.wokeAt >= WAKE_GRACE) return sleep(s, world, events);
  if (!canStep(world, s.openGates, p.x, p.y, tx, ty)) {
    events.push({ type: 'bump' });
    return;
  }
  const climb = standHeight(world, s.openGates, tx, ty)! - standHeight(world, s.openGates, p.x, p.y)!;
  const from: [number, number] = [p.x, p.y];
  p.x = tx;
  p.y = ty;
  events.push({ type: 'step', climb });
  // Gänsemarsch: Jedes folgende Tier rückt auf den Platz seines Vordermanns
  let prev = from;
  for (const id of s.followers) {
    const a = s.animals.find((x) => x.id === id)!;
    const old: [number, number] = [a.x, a.y];
    if (old[0] !== prev[0] || old[1] !== prev[1]) a.dir = dirTo(prev[0] - a.x, prev[1] - a.y);
    a.x = prev[0];
    a.y = prev[1];
    prev = old;
  }
  bringHome(s, world, events);
}

/**
 * Wer als folgendes Tier die Wiese ums Bett seiner Gegend betritt, ist zu Hause: Es löst sich aus der Kette, singt,
 * bekommt einen eigenen Platz auf der Wiese (dorthin läuft es von selbst) und bleibt für immer dort. Auf der Wiese
 * einer anderen Gegend zieht es nicht ein.
 */
function bringHome(s: State, world: World, events: GameEvent[]) {
  for (const id of [...s.followers]) {
    const a = s.animals.find((x) => x.id === id)!;
    if (!world.cell(a.x, a.y).garden || world.realm(a.x, a.y) !== a.realm) continue;
    a.mode = 'home';
    a.home = { kind: 'garden' };
    a.rest = 2;
    s.followers = s.followers.filter((f) => f !== id);
    if (!s.garden.some((x) => x.id === id)) s.garden.push({ id, species: a.species });
    if (id === PENGUIN) s.calm = s.day; // heute bleibt es windstill
    // Eigener Platz: ein Platz der Wiese, den noch kein anderes Tier als Platz hat
    const spots = meadowSpots(world, a.realm);
    const taken = new Set(
      s.animals.filter((o) => o.mode === 'home' && o !== a).map((o) => `${o.spawn[0]},${o.spawn[1]}`),
    );
    const start = Math.floor(random(s) * spots.length);
    for (let k = 0; k < spots.length; k++) {
      const spot = cycle(spots, start + k);
      if (taken.has(`${spot[0]},${spot[1]}`)) continue;
      a.spawn = spot;
      break;
    }
    events.push({ type: 'home', id, species: a.species });
  }
}

/**
 * Die Figur hat ein neues Feld betreten: nach einer Ankunft wieder bereit, auf der Mitte einer wachen Plattform reisen
 * (Regeln in mitwachsen-portal.ts). Folgende Tiere reisen mit und stellen sich um die Plattform, nie darauf.
 */
function landed(s: State, world: World, events: GameEvent[]) {
  const { x, y } = s.player;
  const r = stepOn(world.portals, (fx, fy) => world.cell(fx, fy).portal, s.portals, s.arrived, x, y);
  s.arrived = r.arrived;
  if (r.ready) events.push({ type: 'ready', id: r.ready });
  if (!r.travel) return;
  const { id, to, at } = r.travel;
  Object.assign(s.player, { x: at[0], y: at[1], dir: 's' });
  for (const f of s.followers) {
    const a = s.animals.find((t) => t.id === f)!;
    const place = freeNear(s, world, at, (fx, fy) => !world.cell(fx, fy).portal, f);
    if (place) [a.x, a.y] = place;
  }
  events.push({ type: 'teleport', id, to });
}

function action(s: State, world: World, events: GameEvent[]) {
  const p = s.player;
  const [dx, dy] = DIRS[p.dir];
  const fx = p.x + dx,
    fy = p.y + dy;
  const [bx, by] = homeAt(world, p.x, p.y).bed; // Bett der Gegend, in der die Figur steht
  const isBed = (x: number, y: number) => x === bx && y === by;
  const [nearest] = s.animals
    .filter((a) => cheb(a.x, a.y, p.x, p.y) <= 1)
    .sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
  const front = s.animals.find((a) => a.x === fx && a.y === fy);
  if (front) return sing(s, front, true, events);
  const story = world.cell(fx, fy).story;
  if (story) return listen(s, story, events);
  if (isBed(fx, fy)) return sleep(s, world, events);
  // Bett daneben: schlafen, außer ein Tier steht näher als das Bett
  const man = (x: number, y: number) => Math.abs(x - p.x) + Math.abs(y - p.y);
  const bedNear = cheb(p.x, p.y, bx, by) <= 1;
  if (bedNear && (!nearest || man(nearest.x, nearest.y) >= man(bx, by))) return sleep(s, world, events);
  if (nearest) return sing(s, nearest, true, events);
  events.push({ type: 'call' });
}

/** Tier singt. Beim ersten Mal ist es getroffen; mit `follow` folgt es der Figur, wenn es frei umherläuft. */
function sing(s: State, a: Animal, follow: boolean, events: GameEvent[]) {
  const first = !s.met.includes(a.id);
  a.dir = dirTo(s.player.x - a.x, s.player.y - a.y);
  events.push({ type: 'sing', id: a.id, species: a.species, first });
  if (first) s.met = [...s.met, a.id].sort();
  if (follow && a.mode === 'wander') {
    a.mode = 'follow';
    s.followers.push(a.id);
    events.push({ type: 'follow', id: a.id });
  }
}

function sleep(s: State, world: World, events: GameEvent[]) {
  const [bx, by] = homeAt(world, s.player.x, s.player.y).bed; // ins Bett der Gegend, in der die Figur steht
  s.sleeping = true;
  s.day++; // über Nacht wächst die Wiese
  s.sleptAt = s.tick;
  // Folgende und an der Weltgrenze wartende Tiere gehen heim: Tiere der Gegenden an ihren Platz, Tiere der Landschaft
  // tauchen dort später wieder auf
  const waiting = s.animals.filter((a) => a.mode === 'wait').map((a) => a.id);
  for (const id of [...s.followers, ...waiting]) {
    const a = s.animals.find((x) => x.id === id)!;
    a.mode = 'wander';
    if (a.home.kind === 'wild') {
      s.animals = s.animals.filter((x) => x.id !== id);
      continue;
    }
    const spot = freeNear(s, world, a.spawn, (x, y) => atHome(world, a.home, x, y), id);
    if (spot) [a.x, a.y] = spot;
  }
  s.followers = [];
  s.arrived = null;
  s.player.x = bx;
  s.player.y = by;
  s.player.dir = 's';
  events.push({ type: 'sleep' });
}

function wake(s: State, world: World, events: GameEvent[]) {
  if (s.tick - s.sleptAt < SLEEP_LOCK) return; // wildes Drücken direkt nach dem Einschlafen weckt nicht
  const home = homeAt(world, s.player.x, s.player.y); // die Figur liegt im Bett dieser Gegend
  const spot =
    home.wake.find(([x, y]) => standHeight(world, s.openGates, x, y) !== null && !occupied(s, x, y)) ??
    freeNear(s, world, home.bed, (x, y) => world.cell(x, y).region === home.realm);
  if (!spot) return;
  s.sleeping = false;
  s.wokeAt = s.tick;
  s.dayStart = s.tick; // ein neuer Morgen: Das Wetter des Tages beginnt von vorn (mit Sonne)
  s.player.x = spot[0];
  s.player.y = spot[1];
  s.player.dir = 's';
  scatter(s, world); // ein neuer Morgen: Die verlorenen Tiere sind woanders unterwegs
  events.push({ type: 'wake' });
}

/** Tiere der Landschaft in der Nähe der Figur auftauchen lassen, weit entfernte (umherlaufende) vergessen */
function syncWild(s: State, world: World) {
  const [pcx, pcy] = chunkOf(s.player.x, s.player.y);
  s.animals = s.animals.filter((a) => {
    if (a.home.kind !== 'wild' || a.mode !== 'wander') return true;
    return Math.max(Math.abs(a.home.cx - pcx), Math.abs(a.home.cy - pcy)) <= WILD_KEEP;
  });
  const present = new Set([...s.animals.map((a) => a.id), ...s.garden.map((p) => p.id)]);
  for (let cy = pcy - WILD_RADIUS; cy <= pcy + WILD_RADIUS; cy++)
    for (let cx = pcx - WILD_RADIUS; cx <= pcx + WILD_RADIUS; cx++)
      for (const w of wildAnimals(world, cx, cy)) {
        if (present.has(w.id) || occupied(s, w.x, w.y)) continue;
        s.animals.push({
          id: w.id,
          species: w.species,
          x: w.x,
          y: w.y,
          dir: 's',
          mode: 'wander',
          home: { kind: 'wild', cx, cy },
          realm: realmOfAnimal(w.id),
          spawn: [w.x, w.y],
          rest: 5,
        });
      }
}
