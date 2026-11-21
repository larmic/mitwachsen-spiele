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
import { STORIES, type StoryId } from '../../data/games/mitwachsen-stories';
import { beyondRing, canStep, standHeight, type World } from './mitwachsen-world';
import { packAt, wakeRealm } from './mitwachsen-pack';
import { scatter, scatterArrivals } from './mitwachsen-scatter';
import { canStay, wildAnimals } from './mitwachsen-wild';
import { chore, regrow, type ChoreEvent } from './mitwachsen-chores';
import { homeAt } from './mitwachsen-home';
import { landed, wakePortals, type PortalEvent } from './mitwachsen-travel';
import { PORTAL_IDS, type PortalId } from '../../data/games/mitwachsen-portals';
import { sheltering } from './mitwachsen-weather';
import { PENGUIN, atHome, meadowSpots, shelterPlaces, slipPast, windOk, type Home } from './mitwachsen-meadow';
import { comesHome, homeward, ownSpot, walkHome } from './mitwachsen-arrive';
import { dirTo, freeNear, occupied } from './mitwachsen-free';
import { crossBorder, type BorderEvent, type Mode } from './mitwachsen-border';
import { lost, type GuideEvent, type GuideRules } from './mitwachsen-guide';
import type { PackEvent, WorldRules } from './mitwachsen-pack-types';
import { listen } from './mitwachsen-listen';

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

export type State = Omit<Progress, 'position'> & {
  tick: number;
  rng: number;
  player: { x: number; y: number; dir: Dir };
  sleeping: boolean;
  sleptAt: number;
  wokeAt: number;
  animals: Animal[];
  followers: string[]; // Reihenfolge = Platz in der Kette hinter der Figur
  arrived: readonly [number, number] | null; // Mittelfeld, auf dem die Figur angekommen ist: erst runter, dann wieder rauf (nicht gespeichert)
  picked: Record<string, number>; // Büsche ohne Beeren und leere Fischkisten: "x,y" → Takt des Leerens (nicht gespeichert)
  dayStart: number; // Takt, an dem der heutige Tag begann (Aufwachen): Das Wetter zählt ab hier, jeder Tag beginnt mit Sonne
  basket: boolean; // Korb mit Beeren auf dem Rücken (nach dem Pflücken, bis zum Futtertrog)
  bucket: boolean; // Eimer mit Wasser in der Hand (nach dem Schöpfen, bis zum Wassertrog)
  fish: boolean; // Netz mit Fischen in der linken Hand (nach dem Fangen an der Fischkiste, bis zur Eisschale)
  calm: number; // Tag, an dem der Pinguin auf die Schneewiese gezogen ist: an ihm weht kein Pustewind (nicht gespeichert)
  guideDue: number; // verlaufener Pinguin: Takt, ab dem er auftaucht bzw. aufgetaucht ist (nicht gespeichert, mitwachsen-guide.ts)
  ritual: number; // Takt, an dem das Eistor mit dem Pinguin aufging (-1: noch nicht; nicht gespeichert, worlds/eis/mitwachsen-ritual.ts)
  still: number; // Takte, die die Figur auf demselben Feld steht: jeder Schritt setzt ihn auf 0 (nicht gespeichert; Torplatte)
  held?: readonly [number, number]; // gespeicherte Position, solange ein Welt-Paket fehlt: bleibt im Spielstand (Abschnitt „Welt-Pakete“)
};

/** Was gespeichert wird (und im Zustand steht, bis auf die Position: die hat die Figur) */
export type Progress = {
  met: string[];
  garden: HomeAnimal[];
  openGates: GateId[];
  portals: PortalId[]; // wache Portal-Plattformen (je Portal eine, mit Gegenstück am Bett)
  position: [number, number];
  day: number; // Tage, die die Welt schon erlebt hat (jedes Schlafen zählt einen); Blumen wachsen damit
  heard: StoryId[]; // Geschichten, deren Klangstein schon einmal erklungen ist
  // Zustand der Welt-Pakete je Kennung, in ihrem eigenen Format (Eis-Welt: gebaute Schneemänner); der Kern trägt ihn nur,
  // auch solange ein Paket fehlt (`WorldRules` in mitwachsen-pack-types.ts)
  packs: Record<string, unknown>;
};

export type Step = { state: State; events: GameEvent[] };
type Explored = (x: number, y: number) => boolean;
const EVERYWHERE: Explored = () => true;
export type Cmd = { type: 'move'; dir: Dir } | { type: 'action' } | { type: 'tick'; held?: boolean }; // held: Pfeil unten
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
  | PortalEvent // Plattformen erwachen, reisen, wieder bereit (mitwachsen-travel.ts)
  | ChoreEvent // Handgriffe: pflücken, fangen, nachwachsen, füttern, schöpfen, tränken (mitwachsen-chores.ts)
  | BorderEvent // Weltgrenze am Tor: warten, wieder einreihen, Gegend wechseln (mitwachsen-border.ts)
  | GuideEvent // der verlaufene Pinguin taucht auf und piept (mitwachsen-guide.ts)
  | PackEvent // Regeln einer Welt aus ihrem Paket: Schneehaufen wächst, Eiszapfen klingt (mitwachsen-pack-types.ts)
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

/** Ein Tier an seinem Platz (Wohnort, Platz auf der Wiese oder in der Landschaft), schaut nach vorn */
const settle = (id: string, species: SpeciesId, [x, y]: Point, mode: Mode, home: Home, realm: RegionId): Animal => ({
  id,
  species,
  x,
  y,
  dir: 's',
  mode,
  home,
  realm,
  spawn: [x, y],
  rest: 5,
});

export function initialState(world: World, saved: Partial<Progress> = {}, rngSeed = 1): State {
  const garden = saved.garden ?? [];
  // Nur Tore, die überhaupt aufgehen können, bleiben aus dem Spielstand offen
  const open = (saved.openGates ?? []).filter((id) => GATES.some((g) => g.id === id && g.opens !== 'never'));
  const animals = placeAnimals(world, open, garden, new Set());
  const [bx, by] = world.homes[wakeRealm(world, open, saved.position, beyondRing)].bed;
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
    // Erwachte Portale und gehörte Steine bleiben, auch wenn die Welt sie gerade nicht kennt (Welt-Paket fehlt)
    portals: (saved.portals ?? []).filter((id) => PORTAL_IDS.includes(id)),
    arrived: null,
    picked: {},
    basket: false,
    bucket: false,
    fish: false,
    day: saved.day ?? 0,
    dayStart: 0,
    heard: (saved.heard ?? []).filter((id) => Object.hasOwn(STORIES, id)),
    calm: -1,
    guideDue: -1,
    ritual: -1,
    still: 0,
    packs: { ...saved.packs }, // auch ohne Paket bleibt sein Zustand, wie er ist
  };
  // Fehlt das Paket der Welt, zu der die Position gehört, wüsste die Welt nicht, ob die Figur dort war: Position behalten
  if (saved.position && !world.spotsOf('eis').length && packAt(saved.position, world.gates, beyondRing))
    s.held = [...saved.position];
  scatter(s, world, () => random(s)); // jeder Besuch: Die Tiere wohnen woanders
  syncWild(s, world);
  return s;
}

/**
 * Tiere der Gegenden, die noch nicht da sind (`present`): frei umherlaufend an ihrem Wohnort, zu Hause auf der Wiese
 * ihrer Gegend. Ohne das Paket ihrer Welt kennt die Welt weder Wohnort noch Wiese: Dann fehlen sie (noch nicht da), nie
 * getroffen, nie gezeichnet, und bleiben doch im Spielstand.
 */
function placeAnimals(world: World, open: GateId[], garden: HomeAnimal[], present: ReadonlySet<string>): Animal[] {
  const atHomeIds = new Set(garden.map((p) => p.id));
  const animals: Animal[] = [];
  for (const r of REGIONS)
    for (const { id, species } of regionAnimalList(r)) {
      const at = world.spawns.get(id); // die Welt kennt den erreichbaren Wohnort
      // der verlaufene Pinguin wohnt nicht hinter seinem Tor, solange es den Schlüssel hat und zu ist (`lost`)
      if (at && !atHomeIds.has(id) && !present.has(id) && !lost(id, open))
        animals.push(settle(id, species, at, 'wander', { kind: 'region', region: r.id }, r.id));
    }
  const placed = new Map<RegionId, number>(); // je Gegend: so viele Tiere stehen schon auf ihrer Wiese
  for (const p of garden) {
    const realm = realmOfAnimal(p.id);
    if (present.has(p.id) || !meadowSpots(world, realm).length) continue; // ohne Paket: keine Wiese
    const i = placed.get(realm) ?? 0;
    placed.set(realm, i + 1);
    animals.push(settle(p.id, p.species, cycle(meadowSpots(world, realm), i), 'home', { kind: 'garden' }, realm));
  }
  return animals;
}

/**
 * Ein Welt-Paket kam mitten im Spiel an (`world`: die Welt mit ihm, `World.attach`). Die Tiere seiner Welt ziehen ein,
 * auf ihre Wiese bzw. frei umherlaufend verteilt wie beim Öffnen (`scatter`), aber mit eigenem Zufall aus Seed und Tag:
 * Der Zufall des Spielstands (`rng`) bleibt unberührt, alle anderen Tiere, Wiese, Portale und Nebel bleiben, wie sie
 * sind (Tiere der Landschaft nur, wo sie noch stehen können). Die gehaltene Position braucht es nicht mehr: Die Figur
 * ist, wo sie ist.
 */
export function attachPack(state: State, world: World): State {
  const s: State = { ...state };
  delete s.held;
  s.animals = state.animals.filter((a) => canStay(world, a));
  const fresh = placeAnimals(world, s.openGates, s.garden, new Set(s.animals.map((a) => a.id)));
  s.animals.push(...scatterArrivals(s, fresh, world, s.day)); // verteilt nur die neuen Tiere
  return s;
}

export const progressOf = (s: State): Progress => ({
  met: [...s.met],
  garden: [...s.garden],
  openGates: [...s.openGates],
  portals: [...s.portals],
  position: s.held ? [...s.held] : [s.player.x, s.player.y],
  day: s.day,
  heard: [...s.heard],
  packs: { ...s.packs },
});

/** Tiere einer Gegend (Kennungen) */
export const regionAnimals = (region: RegionId): string[] =>
  regionAnimalList(REGIONS.find((r) => r.id === region)!).map((a) => a.id);

// ---------- Ein Schritt ----------

/**
 * Ein Befehl. `explored(x, y)` sagt, ob ein Feld schon aus dem Nebel ist (der Nebel gehört der Ansicht): Nur dort
 * erwacht eine Portal-Plattform. Ohne Angabe gilt alles als erkundet. `guide` sind die Regeln des verlaufenen Pinguins
 * (worlds/eis/mitwachsen-lead.ts, aus dem Welt-Paket), die die Ansicht erst hereinreicht, wenn er fällig ist; ohne sie
 * taucht er nicht auf. `rules`: Regeln der Welten aus ihren geladenen Paketen (`WorldPack.rules`, Eis-Welt: Schneemänner).
 */
export function step(
  state: State,
  world: World,
  cmd: Cmd,
  explored: Explored = EVERYWHERE,
  guide?: GuideRules,
  rules: readonly { rules?: WorldRules }[] = [],
): Step {
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
  // Stehzeit (Torplatte): Es zählen nur Takte ohne gedrückten Pfeil; jede Eingabe setzt sie auf 0, und nur Eingaben
  // versetzen die Figur (Schritt, Reise, Bett), Takte nie
  s.still = cmd.type === 'tick' && !cmd.held ? s.still + 1 : 0;
  if (cmd.type === 'tick') tick(s, world, events);
  else if (s.sleeping) wake(s, world, events);
  else if (cmd.type === 'move' && !guide?.hold(s, events)) {
    // Ein Schritt (während das Eistor aufgeht, hüpft die Figur stattdessen nur: `hold` in worlds/eis/mitwachsen-ritual.ts)
    const from: Point = [s.player.x, s.player.y];
    move(s, world, cmd.dir, events, rules);
    guide?.meetGuide(s, world, events); // in den führenden Pinguin gelaufen: Er hüpft voraus oder tauscht den Platz
    // Neues Feld: Plattformen (reisen, wieder bereit), dann die Weltgrenze am Tor (warten, wieder einreihen)
    if (s.player.x !== from[0] || s.player.y !== from[1]) {
      landed(s, world, events);
      crossBorder(s, world, from, events);
    }
  } else if (cmd.type === 'action') action(s, world, events);
  wakePortals(s, world, explored, events); // Portal-Plattformen in der Nähe erwachen (mitwachsen-travel.ts)
  guide?.guide(s, world, cmd.type, events, explored); // der verlaufene Pinguin taucht auf und führt
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
    if (a.mode !== 'wander' && a.mode !== 'home') continue; // folgt, wartet an der Weltgrenze oder führt
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
    // Ein Tier der Wiese, das noch draußen steht (eingezogen, als die Figur nah an der Wiese war), findet selbst hin
    if (walkHome(s, world, a, goal)) continue;
    // Außerhalb des Zuhauses (nach einem Platztausch) zieht es heim, sonst läuft es zufällig
    const away = !atHome(world, a.home, a.x, a.y);
    // zielstrebig heim (außerhalb des Zuhauses) oder zum eigenen Platz auf der Wiese, sonst zufällig
    const order =
      away || arriving
        ? [...ALL_DIRS].sort((p, q) => dist(a, p, goal) - dist(a, q, goal))
        : [pick(ALL_DIRS, random(s))];
    // Im Iglu schlüpft ein Tier an den schon Sitzenden vorbei zu seinem Platz, sonst blieben die hinteren Plätze zu
    if (spot && slipPast(s, world, a, order[0], places)) continue;
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
  // Tauschen: ein folgendes Tier, eines auf dem Weg zur Wiese oder eines, das auf dem Feld der Figur zu Hause ist
  if (climbable && (animal.mode === 'follow' || homeward(world, animal) || atHome(world, animal.home, p.x, p.y))) {
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

function move(s: State, world: World, dir: Dir, events: GameEvent[], packs: readonly { rules?: WorldRules }[]) {
  const p = s.player;
  p.dir = dir;
  const [dx, dy] = DIRS[dir];
  const [tx, ty] = [p.x + dx, p.y + dy];
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
  // Regeln der Welten aus ihren Paketen: etwa ein Schneehaufen, der um eine Kugel wächst (worlds/eis/mitwachsen-snowman.ts)
  const move = { here: world.cell(p.x, p.y), walks: canStep(world, s.openGates, p.x, p.y, tx, ty) };
  if (packs.some((r) => r.rules?.bump(s, world.cell(tx, ty), tx, ty, events, move))) return;
  // Ins Bett laufen: Die Figur legt sich schlafen (nicht gleich nach dem Aufwachen, sonst schläft sie aus Versehen ein)
  if (world.cell(tx, ty).deco === 'bed' && s.tick - s.wokeAt >= WAKE_GRACE) return sleep(s, world, events);
  if (!move.walks) {
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
 * Zu Hause: Kommt die Figur nah an die Wiese ums Bett einer Gegend, lösen sich alle folgenden Tiere dieser Gegend
 * zugleich aus der Kette, auch die hinteren; ebenso ein folgendes Tier, das selbst die Wiese seiner Gegend betritt
 * (`comesHome`). Jedes singt, bekommt einen eigenen Platz auf der Wiese, läuft von selbst dorthin und bleibt für immer
 * dort. Auf der Wiese einer anderen Gegend zieht es nicht ein.
 */
function bringHome(s: State, world: World, events: GameEvent[]) {
  for (const id of [...s.followers]) {
    const a = s.animals.find((x) => x.id === id)!;
    if (!comesHome(world, a, s.player)) continue;
    a.mode = 'home';
    a.home = { kind: 'garden' };
    a.rest = 2;
    s.followers = s.followers.filter((f) => f !== id);
    if (!s.garden.some((x) => x.id === id)) s.garden.push({ id, species: a.species });
    if (id === PENGUIN) s.calm = s.day; // heute bleibt es windstill
    ownSpot(world, s.animals, a, random(s)); // ein Platz der Wiese, den noch kein anderes Tier hat
    events.push({ type: 'home', id, species: a.species });
  }
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
  s.player = { x: bx, y: by, dir: 's' };
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
  s.player = { x: spot[0], y: spot[1], dir: 's' };
  scatter(s, world, () => random(s)); // ein neuer Morgen: Die verlorenen Tiere sind woanders unterwegs
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
        s.animals.push(settle(w.id, w.species, [w.x, w.y], 'wander', { kind: 'wild', cx, cy }, realmOfAnimal(w.id)));
      }
}
