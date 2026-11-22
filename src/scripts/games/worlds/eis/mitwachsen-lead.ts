// Der verlaufene Pinguin führt die Figur zum Eistor – rein, ohne DOM: Er taucht neben ihr auf, watschelt zu ihr (Hüpfer,
// Herz) und geht dann ein paar Felder voraus Richtung Bucht, dann wartet er und piept. Läuft sie weg, holt er sie ein
// und stellt sich wieder vor sie; er blockiert nie. Sein Ziel ist der Platz neben der Torplatte. Nachts schläft er neben
// dem Bett, morgens führt er weiter. Wann er fällig ist und wo die Bucht liegt, steht in mitwachsen-guide.ts; wie er in
// der Bucht an der Platte wartet, in mitwachsen-bay.ts; was dann geschieht (das Eistor geht auf, er rutscht heim), in
// mitwachsen-ritual.ts. Beide gehören zum Welt-Paket der Eis-Welt (index.ts, `pack.lead`): Die
// Ansicht reicht sie `step` erst herein, wenn er fällig ist (mitwachsen-state.ts); so bleibt die Spielseite schlank.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“)

import { DIRS } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { dirTo, freeNear, occupied } from '../../mitwachsen-free';
import {
  APPEAR,
  DUE,
  FAR,
  GUIDE,
  GUIDE_GATE,
  LOST,
  NEAR,
  PACE,
  PEEP_EVERY,
  leader,
  wanted,
  type GuideEvents as Events,
  type Guided,
} from '../../mitwachsen-guide';
import { homeAt } from '../../mitwachsen-home';
import { BESIDE, atPlate, plateRow } from './mitwachsen-bay';
import { ALL, flood, key } from './mitwachsen-flood';
import { homeward, opens, slideOn } from './mitwachsen-ritual';

export { hold } from './mitwachsen-ritual';
import { canStep, type World } from '../../mitwachsen-world';

type Walker = Guided['animals'][number];
type Explored = (x: number, y: number) => boolean;

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const SIDE = Array.from({ length: 2 * NEAR + 1 }, (_, i) => i - NEAR);
const AROUND = SIDE.flatMap((dx) => SIDE.map((dy): Point => [dx, dy])).filter(([dx, dy]) => dx || dy); // bis `NEAR` weit
export const COME = 40; // so viele Takte watschelt er höchstens zur Figur, dann freut er sich, wo er ist
const LOOK = 10; // so viele Takte schaut er nach dem Einholen zum Tor, bevor er sich zur Figur umdreht

/**
 * Weg zum Tor: Schritte bis zu seinem Platz neben der Torplatte (`BESIDE`) von jedem Feld aus, von dem man dorthin
 * kommt (Breitensuche rückwärts mit `canStep`, alle Tore zu, höchstens 40 000 Felder). Einmal je Welt.
 */
export const toGate = (world: World) =>
  flood(
    world,
    'gate',
    () => {
      const g = world.gates.get(GUIDE_GATE);
      return g ? [plateRow(g, BESIDE)] : [];
    },
    (x, y, tx, ty) => canStep(world, [], x, y, tx, ty),
  );

/** Feld zum Auftauchen: 4 bis 6 Felder neben der Figur, frei, erkundet, mit Weg zum Tor; das dem Tor nächste zuerst */
function spotNear(s: Guided, world: World, explored: Explored): Point | null {
  const field = toGate(world);
  let best: Point | null = null;
  let bestD = Infinity;
  const [near, far] = APPEAR;
  for (let dy = -far; dy <= far; dy++)
    for (let dx = -far; dx <= far; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < near) continue;
      const [x, y] = [s.player.x + dx, s.player.y + dy];
      const d = field.get(key(x, y));
      if (d === undefined || d >= bestD || !explored(x, y) || world.cell(x, y).portal) continue;
      if (occupied(s, x, y, GUIDE)) continue;
      [best, bestD] = [[x, y], d];
    }
  return best;
}

/**
 * Nach jedem Befehl: Ist er fällig und steht die Figur am Bett der Lichtung, taucht er auf (gut 2 s danach, nach dem
 * Laden beim Aufwachen). Ist er da, führt er im Takt; beim Einschlafen setzt er sich neben das Bett, beim Aufwachen
 * piept er zur Begrüßung. Stehen beide in der Bucht, wartet er an der Torplatte (mitwachsen-bay.ts); steht die Figur
 * darauf, geht das Tor auf, und er rutscht heim (mitwachsen-ritual.ts).
 */
export function guide(s: Guided, world: World, cmd: 'move' | 'action' | 'tick', events: Events, explored: Explored) {
  const g = s.animals.find((a) => a.id === GUIDE);
  if (s.openGates.includes(GUIDE_GATE)) {
    if (g && g.mode !== 'home') homeward(s, world, g, cmd, events);
    return;
  }
  const woke = events.some((e) => e.type === 'wake');
  if (!g) {
    if (!due(s, world)) return;
    if (!woke && cmd === 'tick' && s.guideDue < 0) s.guideDue = s.tick + DUE;
    if (woke || (cmd === 'tick' && s.guideDue >= 0 && s.tick >= s.guideDue)) appear(s, world, explored, events);
    return;
  }
  if (g.mode !== 'lead') return;
  if (events.some((e) => e.type === 'sleep')) return bedside(s, world, g);
  if (woke) return peep(s, g, events); // morgens: zur Begrüßung
  if (opens(s, world, g, events)) return; // die Figur steht auf der Platte, er in der Bucht: Das Eistor geht auf
  // ein Takt: In der Bucht wartet er an der Torplatte (mitwachsen-bay.ts), sonst führt er
  if (cmd === 'tick' && !s.sleeping && !atPlate(s, world, g, events)) lead(s, world, g, events, explored);
}

/**
 * Soll er jetzt kommen? Wach, Leiste der Lichtung voll und die Figur auf der Lichtung in der Nähe des Betts (höchstens
 * so weit, wie die Wiese reicht). Geht sie vorher weg, beginnen die gut 2 s am Bett neu.
 */
function due(s: Guided, world: World) {
  if (s.sleeping || !wanted(s)) return false;
  const { x, y } = s.player;
  const home = homeAt(world, x, y);
  if (home.realm === 'lichtung' && Math.max(Math.abs(x - home.bed[0]), Math.abs(y - home.bed[1])) <= home.meadow)
    return true;
  s.guideDue = -1;
  return false;
}

function appear(s: Guided, world: World, explored: Explored, events: Events) {
  const at = spotNear(s, world, explored);
  if (!at) return; // gleich noch einmal versuchen (z. B. alles ringsum noch im Nebel)
  const [x, y] = at;
  s.animals.push({
    id: GUIDE,
    species: 'pinguin',
    x,
    y,
    dir: dirTo(s.player.x - x, s.player.y - y),
    mode: 'lead',
    home: { kind: 'region', region: 'eis' },
    realm: 'eis',
    spawn: at,
    rest: PEEP_EVERY,
  });
  s.guideDue = s.tick; // erst watschelt er zur Figur
  events.push({ type: 'guide', id: GUIDE, species: 'pinguin', x, y });
}

/**
 * Ankommen: Er watschelt zur Figur; ist er bei ihr (höchstens `NEAR` Felder weg), hüpft er und zeigt ein Herz
 * (`arrive`), danach führt er. Kommt er in `COME` Takten nicht durch (ringsum Tiere der Wiese), freut er sich dort, wo
 * er gerade ist.
 */
function come(s: Guided, world: World, g: Walker, events: Events) {
  const p = s.player;
  if (cheb(g, p) > NEAR && s.tick - s.guideDue < COME) {
    if (s.tick % PACE.chase !== 0) return;
    const step = towards(
      s,
      world,
      g,
      AROUND.map(([dx, dy]): Point => [p.x + dx, p.y + dy]),
    );
    if (step) {
      g.dir = dirTo(step[0] - g.x, step[1] - g.y);
      [g.x, g.y] = step;
    }
    return;
  }
  s.guideDue = -1;
  g.dir = dirTo(p.x - g.x, p.y - g.y);
  g.rest = PEEP_EVERY;
  events.push({ type: 'arrive', id: g.id, species: g.species });
}

function peep(s: Guided, g: Walker, events: Events) {
  g.dir = dirTo(s.player.x - g.x, s.player.y - g.y);
  g.rest = PEEP_EVERY;
  events.push({ type: 'peep', id: g.id, species: g.species });
}

/** Nachts: Er setzt sich neben das Bett (nicht auf einen Platz zum Aufwachen) und schläft mit */
function bedside(s: Guided, world: World, g: Walker) {
  s.guideDue = -1; // morgens wartet er am Bett, er muss nicht mehr ankommen
  const { bed, wake } = homeAt(world, s.player.x, s.player.y);
  const waking = new Set(wake.map(([x, y]) => key(x, y)));
  const near = (x: number, y: number) => Math.max(Math.abs(x - bed[0]), Math.abs(y - bed[1])) <= 2;
  const spot = freeNear(s, world, bed, (x, y) => near(x, y) && !waking.has(key(x, y)), g.id);
  if (spot) [g.x, g.y] = spot;
  g.dir = dirTo(bed[0] - g.x, bed[1] - g.y);
}

/**
 * Ein Takt Führen: Ist die Figur weit weg, taucht er neben ihr wieder auf und watschelt zu ihr. Ist sie mehr als `FAR` Felder weg oder nicht
 * mehr hinter ihm, holt er sie ein und stellt sich wieder vor sie. Kommt sie auf `NEAR` heran, geht er weiter Richtung
 * Tor; sonst wartet er, schaut sie an und piept (an seinem Platz, mit ihr daneben, schaut er zur Torplatte).
 */
function lead(s: Guided, world: World, g: Walker, events: Events, explored: Explored) {
  const p = s.player;
  if (cheb(g, p) > LOST) {
    const at = spotNear(s, world, explored);
    if (!at) return;
    [g.x, g.y] = at;
    g.dir = dirTo(p.x - g.x, p.y - g.y);
    s.guideDue = s.tick; // erst watschelt er wieder zu ihr
    events.push({ type: 'guide', id: g.id, species: g.species, x: g.x, y: g.y });
    return;
  }
  if (s.guideDue >= 0) return come(s, world, g, events);
  if (g.rest > 0) g.rest--;
  const field = toGate(world);
  const dg = field.get(key(g.x, g.y)) ?? Infinity;
  const dp = field.get(key(p.x, p.y));
  const gap = cheb(g, p);
  if (dp === undefined || gap > FAR || dg >= dp) {
    if (s.tick % PACE.chase === 0) chase(s, world, g, field);
    return;
  }
  if ((gap <= NEAR || g.wait) && dg > 0) {
    // nah bei ihr oder beide in der Bucht (`wait`, mitwachsen-bay.ts): weiter, bis neben die Platte
    if (s.tick % PACE.lead === 0) forward(s, world, g, field);
    return;
  }
  const door = world.gates.get(GUIDE_GATE);
  if (dg === 0 && gap <= NEAR && door)
    g.dir = dirTo(door.out[1], -door.out[0]); // zur Platte (u −)
  else if (g.rest <= 0) peep(s, g, events);
  else if (g.rest <= PEEP_EVERY) g.dir = dirTo(p.x - g.x, p.y - g.y); // sonst schaut er nach dem Einholen noch zum Tor
}

/** Nachbarfelder auf dem Weg zum Tor, die näher am Tor liegen, das nächste zuerst */
function downhill(field: Map<string, number>, x: number, y: number): Point[] {
  const here = field.get(key(x, y)) ?? Infinity;
  return ALL.map(([dx, dy]): Point => [x + dx, y + dy])
    .filter(([nx, ny]) => (field.get(key(nx, ny)) ?? Infinity) < here)
    .sort((a, b) => field.get(key(...a))! - field.get(key(...b))!);
}

/** Einen Schritt weiter Richtung Tor, auf ein freies Feld; liefert false, wenn keins frei ist */
function forward(s: Guided, world: World, g: Walker, field: Map<string, number>): boolean {
  for (const [x, y] of downhill(field, g.x, g.y)) {
    if (occupied(s, x, y, g.id) || !canStep(world, s.openGates, g.x, g.y, x, y)) continue;
    g.dir = dirTo(x - g.x, y - g.y);
    [g.x, g.y] = [x, y];
    return true;
  }
  return false;
}

/**
 * Einholen: zu dem Feld, das `NEAR` Schritte vor der Figur auf dem Weg zum Tor liegt (ist es besetzt, ein Stück weiter),
 * auf kürzestem Weg um die Figur herum; vor ihr schaut er kurz zum Tor. Ohne Weg zum Tor läuft er zur Figur hin.
 */
function chase(s: Guided, world: World, g: Walker, field: Map<string, number>) {
  const p = s.player;
  let front: Point = [p.x, p.y];
  const goals: Point[] = [];
  for (let i = 0; i < NEAR + 2; i++) {
    const next = downhill(field, ...front)[0];
    if (!next) break;
    front = next;
    if (i >= NEAR - 1 && !occupied(s, ...front, g.id)) goals.push(front);
  }
  const step = towards(s, world, g, goals.length ? goals : ALL.map(([dx, dy]): Point => [p.x + dx, p.y + dy]));
  if (step) {
    g.dir = dirTo(step[0] - g.x, step[1] - g.y);
    [g.x, g.y] = step;
  }
  // Wieder vor ihr (gleich führt er weiter): Er schaut eine Sekunde zum Tor, dann dreht er sich zu ihr um
  const ahead = (field.get(key(g.x, g.y)) ?? Infinity) < (field.get(key(p.x, p.y)) ?? -1) && cheb(g, p) <= FAR;
  const next = ahead && downhill(field, g.x, g.y)[0];
  if (!next) return;
  g.dir = dirTo(next[0] - g.x, next[1] - g.y);
  g.rest = Math.max(g.rest, PEEP_EVERY + LOOK);
}

/** Erster Schritt auf dem kürzesten Weg zu einem der Ziele (Breitensuche über freie Felder in der Nähe) oder null */
function towards(s: Guided, world: World, g: Walker, goals: readonly Point[]): Point | null {
  const wanted = new Set(goals.map(([x, y]) => key(x, y)));
  if (wanted.has(key(g.x, g.y))) return null; // schon da
  const first = new Map<string, Point | null>([[key(g.x, g.y), null]]);
  const queue: Point[] = [[g.x, g.y]];
  for (let i = 0; i < queue.length && i < 900; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of ALL) {
      const [nx, ny] = [x + dx, y + dy];
      const k = key(nx, ny);
      if (first.has(k) || Math.max(Math.abs(nx - g.x), Math.abs(ny - g.y)) > LOST + 4) continue;
      if (occupied(s, nx, ny, g.id) || !canStep(world, s.openGates, x, y, nx, ny)) continue;
      const via = first.get(key(x, y)) ?? [nx, ny];
      if (wanted.has(k)) return via;
      first.set(k, via);
      queue.push([nx, ny]);
    }
  }
  return null;
}

/**
 * Die Figur ist in den führenden Pinguin hineingelaufen (er hat dabei gesungen): Er hüpft ein Feld voraus Richtung Tor
 * oder, wenn dort nichts frei ist, tauscht er mit ihr den Platz. So blockiert er nie. Ist das Tor offen, rutscht er
 * statt zu hüpfen ein Feld weiter Richtung Schneebett (im Vorspiel nicht: Er bleibt vor der Tür).
 */
export function meetGuide(s: Guided, world: World, events: Events) {
  const g = leader(s);
  const [dx, dy] = DIRS[s.player.dir];
  if (!g || g.x !== s.player.x + dx || g.y !== s.player.y + dy) return;
  if (!events.some((e) => e.type === 'sing' && e.id === g.id)) return;
  // im Vorspiel bleibt er vor der Tür (die Flügel sind noch zu): nicht rutschen, nicht tauschen
  if (
    s.openGates.includes(GUIDE_GATE)
      ? s.tick < s.ritual || slideOn(s, world, g, events)
      : forward(s, world, g, toGate(world))
  )
    return;
  const p = s.player;
  if (!canStep(world, s.openGates, p.x, p.y, g.x, g.y) || !canStep(world, s.openGates, g.x, g.y, p.x, p.y)) return;
  [g.x, g.y, p.x, p.y] = [p.x, p.y, g.x, g.y];
  g.dir = dirTo(-dx, -dy);
  events.push({ type: 'swap', id: g.id });
}
