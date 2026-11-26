// Hinführen zu Sehenswürdigkeiten – rein, ohne DOM (Issue 28, Review vom 25.11.2026): Die Figur sieht 7 Felder weit,
// die Welten haben über 13 000 Felder; ohne Hilfe findet ein Kind von 3 das Schöne nur durch Zufall. Darum ruft jede
// Sehenswürdigkeit leise mit ihrem eigenen Klang, und ein Funkelfreund fliegt ein Stück voraus. Eine Sehenswürdigkeit
// ist alles, wo das Kind etwas tun kann: Spielzeug (Glockenspiele, Schneehaufen, Netze, Laterne, Steg), Klangsteine
// und Halte der Fahrzeuge bis zur ersten Fahrt. Jede trägt sich als `Sight` ein: die Klangsteine hier, Spielzeug und
// der Halt eines Fahrzeugs im Paket seiner Welt (`WorldPack.sights`; ein Test verlangt den Halt für jedes Fahrzeug).
//
// Regeln: Immer nur ein Ziel, das nächste nicht gefundene, bereite Ding in der Gegend der Figur, vom Bett nach hinten.
// Der Ruf kommt höchstens alle `CALL_EVERY` Takte und nur bis `HEAR` Felder. Der Freund erscheint bis `LURE` Felder,
// bleibt `AHEAD` Schritte vor der Figur auf ihrem Weg und gibt auf, wenn sie `GIVE_UP` Takte nicht näher kommt:
// höchstens `TRIES` Versuche je Ziel und Spieltag, danach `REST` Takte Ruhe. Nicht folgen hat keine Folge. Nach dem
// ersten Finden ist für immer Ruhe (`found`, gespeichert); das Ding selbst bleibt, wie es ist. Vorrang haben die alten
// Führer, und es gibt Ruhezeiten (`quiet`). Ton und Freund dürfen zu Unerkundetem führen: die bewusste Ausnahme von
// „aus dem Nebel kommt nichts“. Kein Gold, kein Pfeil, kein Text.
// Bild und Ton: mitwachsen-sight-look.ts. Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Hinführen“)

import type { Point, RegionId } from '../../data/games/mitwachsen';
import type { StoryId } from '../../data/games/mitwachsen-stories';
import type { Cell } from './mitwachsen-cell';
import { leader, opening } from './mitwachsen-guide';
import { heraldOf, type HeraldEvent, type Heralded } from './mitwachsen-herald';
import type { PackEvent, RideEvent } from './mitwachsen-pack-types';
import type { Rider } from './mitwachsen-rider';
import { heardStone } from './mitwachsen-story';
import { canStep, type World } from './mitwachsen-world';

/** So weit (Felder, Luftlinie) hört man den Ruf */
export const HEAR = 16;
/** So weit lockt der Freund; weiter weg als `LOSE` fliegt er fort, ohne dass es als Versuch zählt */
export const LURE = 25;
export const LOSE = 32;
/** Der Ruf kommt höchstens so oft (Takte, 7 s) */
export const CALL_EVERY = 70;
/** So viele Schritte bleibt der Freund vor der Figur; so nah am Ding schwebt er über ihm */
export const AHEAD = 3;
export const NEAR = 2;
/** Kommt die Figur so viele Takte nicht näher (15 s), gibt der Freund auf: ein Versuch */
export const GIVE_UP = 150;
/** Versuche je Ziel und Spieltag; Ruhe nach einem Versuch (30 s) und nach dem Finden (1 min), in Takten */
export const TRIES = 2;
export const REST = 300;
export const PAUSE = 600;
/** So lange nach dem Aufwachen lockt nichts (20 s) */
export const CALM = 200;

/**
 * Welche Sehenswürdigkeit ein Ereignis der Welt-Regeln als gefunden meldet (`null`: keine, mit Grund). Jede neue Art
 * von `PackEvent` muss hier stehen, sonst baut es nicht: So bekommt jedes neue Spielzeug einen Eintrag oder einen Grund
 */
export const SIGHT_OF: Record<PackEvent['type'], string | null> = {
  snowman: 'eis:schneehaufen',
  icicle: 'eis:glockenspiel',
  column: 'hoehle:saeulen',
  olm: 'hoehle:steg',
  web: 'hoehle:netze',
  lantern: 'hoehle:laterne',
  chimegate: null, // Klingeltore liegen an der Strecke von Funkel: Dorthin führt sein Halt
  heave: null, // Hau-ruck am Höhlentor: Dorthin führt Tok
};

/** Womit ein Ding ruft: sein eigenes Ereignis (die Ansicht spielt dessen Klang leiser) oder die Melodie seines Steins */
export type SightCall = PackEvent | RideEvent | HeraldEvent | { type: 'story'; id: StoryId };

/** Was die Regeln des Hinführens vom Zustand brauchen (Teil des Zustands der Regeln) */
export type Sighted = Rider &
  Heralded & {
    wokeAt: number;
    late: boolean;
    heard: readonly StoryId[];
    lamp?: RegionId;
    dig?: unknown;
    found: string[]; // gefundene Sehenswürdigkeiten (gespeichert)
    lure?: Lure;
  };

/**
 * Eine Sehenswürdigkeit: feste Kennung (steht im Spielstand), ihre Felder in dieser Welt, die noch locken (`cells`,
 * leer: hier keins; es zählen nur die in der Gegend der Figur), ob schon gelockt werden darf (`ready`, ohne: immer) und
 * ob sie nach dem Spielstand schon gefunden ist (`done`: Klangstein gehört, Fahrzeug gefahren; ohne: es zählt das
 * Ereignis aus `SIGHT_OF`). `call`: ihr Ruf, wenn sie vom Feld `at` aus lockt
 */
export type Sight = {
  id: string;
  cells(world: World, s: Sighted): readonly Point[];
  ready?(s: Sighted, world: World): boolean;
  done?(s: Sighted): boolean;
  call(world: World, at: Point): SightCall;
};

/**
 * Der Freund, solange er führt: Ziel (`id`, Feld `at`), sein Feld (`x`, `y`), kleinster Abstand der Figur zum Ziel
 * bisher (`best`), Takte ohne Fortschritt (`stalled`) und für welches Feld der Figur sein Platz gerechnet ist (`from`)
 */
export type Friend = { id: string; at: Point; x: number; y: number; best: number; stalled: number; from: string };

/**
 * Buch des Hinführens (nicht gespeichert): Spieltag, Versuche je Ziel an ihm, Takt des letzten Rufs, Ruhe bis zu
 * diesem Takt, das Ziel seit der letzten Wahl und der Freund
 */
export type Lure = {
  day: number;
  tries: Record<string, number>;
  callAt: number;
  restUntil: number;
  goal?: { id: string; at: Point };
  friend?: Friend;
};

export type SightEvent = {
  type: 'sight';
  what: 'call' | 'friend' | 'found' | 'leave'; // ruft, Freund erscheint, gefunden (er freut sich), Freund fliegt fort
  id: string;
  x: number;
  y: number;
  near?: number; // Ruf: wie nah (0 an der Hörgrenze … 1 am Ding)
  call?: SightCall;
};
type Events = { readonly type: string }[] & { push(e: SightEvent): unknown };

const key = (x: number, y: number) => `${x},${y}`;
const dist = (a: { x: number; y: number }, [x, y]: Point) => Math.hypot(a.x - x, a.y - y);

const scans = new WeakMap<World, Map<string, Point[]>>();
/**
 * Alle Felder einer Gegend, auf die `is` passt (je Welt und `name` einmal): vom Bett aus über die zusammenhängenden
 * Felder der Gegend gesucht, auch über feste. Für Pakete, deren Spielzeug nur als Zierde im Feld steht
 */
export function cellsOf(world: World, realm: RegionId, name: string, is: (c: Cell) => boolean): readonly Point[] {
  let known = scans.get(world);
  if (!known) scans.set(world, (known = new Map<string, Point[]>()));
  const had = known.get(name);
  if (had) return had;
  const out: Point[] = [];
  const bed = world.homes[realm]?.bed;
  const seen = new Set(bed ? [key(...bed)] : []);
  const queue: Point[] = bed ? [bed] : [];
  for (let i = 0; i < queue.length && i < 60_000; i++) {
    const [x, y] = queue[i]!;
    if (is(world.cell(x, y))) out.push([x, y]);
    for (const [dx, dy] of N4) {
      const k = key(x + dx, y + dy);
      if (seen.has(k) || world.realm(x + dx, y + dy) !== realm || world.cell(x + dx, y + dy).region !== realm) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  known.set(name, out);
  return out;
}
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Klangsteine: Es lockt jeder Stein, dessen Geschichte noch nie erklang (gefunden heißt gehört, `heard`) */
export const STONES: Sight = {
  id: 'klangstein',
  cells: (world, s) => [...world.stones].flatMap(([id, p]) => (heardStone(s, id) ? [] : [p])),
  call: (world, at) => ({ type: 'story', id: world.cell(...at).story ?? 'bett' }),
};

/**
 * Alle Sehenswürdigkeiten: die Klangsteine und was die geladenen Pakete eintragen (Spielzeug ihrer Welt, der Halt ihres
 * Fahrzeugs: `haltSight` in mitwachsen-ride-kit.ts)
 */
export const sightsOf = (packs: readonly { sights?: readonly Sight[] }[]): Sight[] => [
  STONES,
  ...packs.flatMap((p) => p.sights ?? []),
];

/**
 * Ruhezeiten und Vorrang: Nichts lockt im Schlaf, beim Fahren, am Abend, kurz nach dem Aufwachen, solange der Pinguin
 * fällig ist oder führt, ein Bote wach wartet (Tok vor seinem Bau; nicht, wenn er nach Bau 2 nur noch wohnt, `solo`),
 * gebaut oder gegraben wird, das Hau-ruck läuft oder das Eistor aufgeht
 */
export function quiet(s: Sighted): boolean {
  const herald = heraldOf(s);
  return (
    s.sleeping ||
    !!s.ride ||
    s.late ||
    s.tick - s.wokeAt < CALM ||
    s.guideDue >= 0 ||
    !!leader(s) ||
    (!!herald && !herald.nap && !herald.solo) ||
    !!s.work ||
    !!s.dig ||
    !!s.heave ||
    opening(s)
  );
}

/**
 * Ziele in der Gegend der Figur, vom Bett nach hinten: je Sehenswürdigkeit, die noch nicht gefunden und bereit ist, ihr
 * der Figur nächstes Feld; geordnet nach dem Abstand ihres dem Bett nächsten Felds (so lernt das Kind das Muster an
 * etwas Nahem), bei Gleichstand nach der Kennung
 */
export function goalsOf(s: Sighted, world: World, sights: readonly Sight[]): { sight: Sight; at: Point }[] {
  const realm = world.realm(s.player.x, s.player.y);
  const bed = world.homes[realm]?.bed ?? [0, 0];
  const far = ([x, y]: Point) => Math.hypot(x - bed[0], y - bed[1]);
  return sights
    .flatMap((sight) => {
      if (s.found.includes(sight.id) || sight.done?.(s) || sight.ready?.(s, world) === false) return [];
      const cells = sight.cells(world, s).filter((p) => world.realm(...p) === realm);
      if (!cells.length) return [];
      const at = cells.reduce((a, b) => (dist(s.player, b) < dist(s.player, a) ? b : a));
      return [{ sight, at, order: Math.min(...cells.map(far)) }];
    })
    .sort((a, b) => a.order - b.order || (a.sight.id < b.sight.id ? -1 : 1));
}

/**
 * Feld des Freunds: `AHEAD` Schritte vor der Figur auf ihrem kürzesten Weg zum Ziel (Breitensuche über begehbare
 * Felder bis `LOSE` um die Figur; am Ziel reicht ein Nachbarfeld, viele Dinge sind fest). Ist sie schon nah oder gibt
 * es keinen Weg, das Ziel selbst bzw. das Feld in gerader Richtung
 */
export function aheadOf(s: Pick<Sighted, 'player' | 'openGates'>, world: World, at: Point): Point {
  const { x: px, y: py } = s.player;
  const gap = Math.hypot(at[0] - px, at[1] - py);
  if (gap <= NEAR + 1) return at;
  const prev = new Map<string, Point | null>([[key(px, py), null]]);
  const queue: Point[] = [[px, py]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (Math.max(Math.abs(x - at[0]), Math.abs(y - at[1])) <= 1) {
      const path: Point[] = [];
      for (let p: Point | null = [x, y]; p; p = prev.get(key(...p)) ?? null) path.unshift(p);
      return path[Math.min(AHEAD, path.length - 1)]!;
    }
    for (const [dx, dy] of N4) {
      const [nx, ny] = [x + dx, y + dy];
      if (prev.has(key(nx, ny)) || Math.max(Math.abs(nx - px), Math.abs(ny - py)) > LOSE) continue;
      if (!canStep(world, s.openGates, x, y, nx, ny)) continue;
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  return [Math.round(px + ((at[0] - px) / gap) * AHEAD), Math.round(py + ((at[1] - py) / gap) * AHEAD)];
}

/** Ein Ereignis der Welt-Regeln oder ein Spielstand meldet ein Ding als gefunden: merken, freuen, Ruhe */
function note(s: Sighted, l: Lure, events: Events, sights: readonly Sight[]) {
  for (const e of [...events]) {
    const id = (SIGHT_OF as Record<string, string | null | undefined>)[e.type];
    if (!id || s.found.includes(id) || !sights.some((x) => x.id === id)) continue;
    s.found = [...s.found, id].sort();
    const { x, y } = e as unknown as { x: number; y: number };
    events.push({ type: 'sight', what: 'found', id, x, y });
    l.restUntil = s.tick + PAUSE;
    if (l.friend?.id === id) delete l.friend;
    if (l.goal?.id === id) delete l.goal;
  }
}

const leave = (l: Lure, events: Events) => {
  const f = l.friend;
  if (f) events.push({ type: 'sight', what: 'leave', id: f.id, x: f.x, y: f.y });
  delete l.friend;
};

/** Der Freund in diesem Takt: erscheinen, vorausfliegen, aufgeben */
function friend(s: Sighted, world: World, l: Lure, sight: Sight, at: Point, events: Events) {
  const gap = dist(s.player, at);
  const f = l.friend;
  if (!f) {
    if (gap > LURE || gap <= NEAR || s.tick < l.restUntil) return;
    const [x, y] = aheadOf(s, world, at);
    l.friend = { id: sight.id, at, x, y, best: gap, stalled: 0, from: key(s.player.x, s.player.y) };
    events.push({ type: 'sight', what: 'friend', id: sight.id, x, y });
    return;
  }
  if (gap > LOSE) return leave(l, events);
  const closer = gap < f.best - 0.5;
  const next = { ...f, best: closer ? gap : f.best, stalled: closer ? 0 : f.stalled + 1 };
  if (next.stalled > GIVE_UP) {
    l.tries = { ...l.tries, [sight.id]: (l.tries[sight.id] ?? 0) + 1 };
    l.restUntil = s.tick + REST;
    return leave(l, events);
  }
  const here = key(s.player.x, s.player.y);
  if (here !== f.from) [next.x, next.y, next.from] = [...aheadOf(s, world, at), here];
  l.friend = next;
}

/**
 * Hinführen in einem Befehl (`step` ruft es zuletzt): merkt, was die Ereignisse dieses Befehls gefunden haben; in
 * jedem Takt wählt es das Ziel (jede Sekunde neu, mit Freund jeden Takt dasselbe), ruft und führt den Freund
 */
export function sightStep(
  s: Sighted,
  world: World,
  cmd: 'move' | 'action' | 'tick',
  events: Events,
  sights: readonly Sight[],
) {
  const old = s.lure?.day === s.day ? s.lure : undefined;
  const l: Lure = { day: s.day, tries: {}, callAt: -CALL_EVERY, restUntil: 0, ...old };
  s.lure = l;
  note(s, l, events, sights);
  if (cmd !== 'tick') return;
  if (quiet(s)) {
    delete l.friend; // still fort: Ein anderer führt, oder es ist Ruhezeit
    delete l.goal;
    return;
  }
  if (s.tick % 10 === 0) {
    const goal = goalsOf(s, world, sights).find((g) => (l.tries[g.sight.id] ?? 0) < TRIES);
    if (goal) l.goal = { id: goal.sight.id, at: goal.at };
    else delete l.goal;
    if (l.friend && (l.friend.id !== l.goal?.id || key(...l.friend.at) !== key(...l.goal.at))) leave(l, events);
  }
  const sight = l.goal && sights.find((x) => x.id === l.goal!.id);
  if (!l.goal || !sight) return;
  const [x, y] = l.goal.at;
  const gap = dist(s.player, l.goal.at);
  if (gap <= HEAR && s.tick - l.callAt >= CALL_EVERY) {
    l.callAt = s.tick;
    events.push({
      type: 'sight',
      what: 'call',
      id: sight.id,
      x,
      y,
      near: 1 - gap / HEAR,
      call: sight.call(world, l.goal.at),
    });
  }
  friend(s, world, l, sight, l.goal.at, events);
}
