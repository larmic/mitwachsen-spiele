// Das Eistor geht mit dem verlaufenen Pinguin auf – rein, ohne DOM: Stehen Figur und Pinguin in der Bucht vor dem Tor,
// geht es für immer auf (`gate`, sofort gespeichert). Das Ritual dauert 3 s: Der Pinguin watschelt vor die Tür, hüpft
// zweimal, ein kalter Atemzug weht Schnee auf die Lichtung, nach 2,4 s rutscht er durch den Gang hinter die Mündung und
// wartet dort; jeder Pfeil lässt die Figur solange nur hüpfen. Betritt die Figur die Eis-Welt, rutscht er voraus zum
// Schneebett und zieht als erstes Tier auf der Schneewiese ein. Mit den Regeln des Führens (mitwachsen-lead.ts) Teil
// des Welt-Pakets der Eis-Welt; Bild und Ton macht die Ansicht.
// Spezifikation: docs/specs/mitwachsen.md (Regel 8a „Das Eistor geht auf“)

import { DIRS } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { dirTo, freeNear, occupied } from '../../mitwachsen-free';
import {
  GUIDE_GATE,
  RITUAL,
  SLIDE,
  bay,
  opening,
  type GuideEvents as Events,
  type Guided,
} from '../../mitwachsen-guide';
import { atHome, meadowSpots } from '../../mitwachsen-meadow';
import { canStep, type World } from '../../mitwachsen-world';

type Walker = Guided['animals'][number];

export const HOP_AGAIN = 4; // zweiter Hüpfer vor der Tür (0,4 s)
export const BREATH = 18; // der kalte Atemzug aus dem Tor (1,8 s)
// Takte je Feld beim Rutschen zum Schneebett: so schnell wie beim Führen (PACE.lead), schneller als die Figur mit
// gehaltener Taste, damit er wirklich vorausrutscht (die Ansicht gleitet mit)
export const SLIDE_PACE = 2;
const REALM = 'eis'; // die Gegend hinter dem Eistor

const key = (x: number, y: number) => `${x},${y}`;
const ALL = Object.values(DIRS);

/**
 * Stehen Figur und Pinguin (bei ihr angekommen) in der Bucht, geht das Tor auf: Es kommt zu den offenen Toren (Ereignis
 * `gate`, die Ansicht speichert sofort), der Pinguin watschelt vor die Mitte der Tür, schaut zur Figur und hüpft mit
 * seinem Ton (`peep`). Liefert true, wenn das Tor aufging.
 */
export function opens(s: Guided, world: World, g: Walker, events: Events): boolean {
  const door = world.gates.get(GUIDE_GATE);
  if (!door || s.sleeping || s.guideDue >= 0) return false;
  const cells = new Set(bay(door).map(([x, y]) => key(x, y)));
  if (!cells.has(key(g.x, g.y)) || !cells.has(key(s.player.x, s.player.y))) return false;
  s.openGates.push(GUIDE_GATE);
  s.ritual = s.tick;
  const front: Point = [door.mid[0] - door.out[0], door.mid[1] - door.out[1]];
  if (!occupied(s, ...front, g.id)) [g.x, g.y] = front;
  g.dir = dirTo(s.player.x - g.x, s.player.y - g.y);
  events.push({ type: 'gate', id: GUIDE_GATE }, { type: 'peep', id: g.id, species: g.species });
  return true;
}

/** Während das Tor aufgeht (`RITUAL` Takte), lässt jeder Pfeil die Figur nur hüpfen (`hop`); danach ist sie frei */
export function hold(s: Guided, events: Events): boolean {
  if (!opening(s, RITUAL)) return false;
  events.push({ type: 'hop' });
  return true;
}

/**
 * Nach jedem Befehl, solange das Eistor offen ist und der Pinguin noch nicht auf der Schneewiese wohnt: das Ritual vor
 * der Tür, dann hinter die Gangmündung (nach dem Laden wartet er gleich dort), und steht die Figur in der Eis-Welt,
 * rutscht er voraus zum Schneebett. Nachts ruht er, wo er ist.
 */
export function homeward(s: Guided, world: World, g: Walker, cmd: 'move' | 'action' | 'tick', events: Events) {
  const door = world.gates.get(GUIDE_GATE);
  if (opening(s, SLIDE)) {
    // vor der Tür: zweiter Hüpfer, dann weht ein kalter Atemzug aus dem Tor
    const t = cmd === 'tick' ? s.tick - s.ritual : -1;
    if (t === HOP_AGAIN) events.push({ type: 'peep', id: g.id, species: g.species });
    if (t === BREATH && door) events.push({ type: 'breath', x: door.mid[0], y: door.mid[1] });
    return;
  }
  if (g.mode !== 'lead' || world.realm(g.x, g.y) !== REALM) return behind(s, world, g, events);
  if (cmd !== 'tick' || s.sleeping || s.tick % SLIDE_PACE !== 0) return;
  if (world.realm(s.player.x, s.player.y) === REALM) slideOn(s, world, g, events);
}

/** Feld gleich hinter der Gangmündung, auf der Achse des Tors: Dort wartet der Pinguin, bis die Figur nachkommt */
export function mouth(world: World): Point | null {
  const door = world.gates.get(GUIDE_GATE);
  if (!door) return null;
  for (let k = 1; k < 80; k++) {
    const [x, y] = [door.mid[0] + door.out[0] * k, door.mid[1] + door.out[1] * k];
    if (world.cell(x, y).region === REALM) return [x, y];
  }
  return null;
}

/**
 * Hinter die Gangmündung: nach dem Ritual rutscht er durch den Gang (`slide`: Die Ansicht lässt ihn gleiten, er dreht
 * sich um, hüpft und zeigt ein Herz); nach dem Laden steht er still dort. Er wartet mit Blick zum Tor.
 */
function behind(s: Guided, world: World, g: Walker, events: Events) {
  const spot = mouth(world);
  const free = (x: number, y: number) => atHome(world, { kind: 'region', region: REALM }, x, y);
  const at = spot && freeNear(s, world, spot, free, g.id);
  if (!at) return;
  const slid = g.mode === 'lead'; // kommt gerade aus dem Ritual
  s.followers = s.followers.filter((f) => f !== g.id);
  g.mode = 'lead';
  [g.x, g.y] = at;
  g.spawn = at;
  const door = world.gates.get(GUIDE_GATE)!;
  g.dir = dirTo(-door.out[0], -door.out[1]);
  if (slid) events.push({ type: 'slide', id: g.id, species: g.species });
}

const fields = new WeakMap<World, Map<string, number>>();
/**
 * Weg zur Schneewiese: Schritte von jedem Feld der Eis-Welt bis auf die Wiese (Breitensuche rückwärts mit `canStep`,
 * Eistor offen). Einmal je Welt.
 */
export function toMeadow(world: World): Map<string, number> {
  let field = fields.get(world);
  if (field) return field;
  field = new Map();
  const queue = meadowSpots(world, REALM).map(([x, y]): Point => [x, y]);
  for (const [x, y] of queue) field.set(key(x, y), 0);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const n = field.get(key(x, y))!;
    for (const [dx, dy] of ALL) {
      const [nx, ny] = [x + dx, y + dy];
      if (field.has(key(nx, ny)) || world.realm(nx, ny) !== REALM) continue;
      if (!canStep(world, [GUIDE_GATE], nx, ny, x, y)) continue;
      field.set(key(nx, ny), n + 1);
      queue.push([nx, ny]);
    }
  }
  fields.set(world, field);
  return field;
}

/**
 * Ein Feld weiter Richtung Schneewiese, lieber auf der Rutschspur (`cell.slide`); ist keins frei, wartet er (false). Auf
 * der Wiese zieht er ein. Auch, wenn die Figur in ihn hineinläuft: Er rutscht ein Feld voraus oder tauscht mit ihr den
 * Platz (`meetGuide`) und blockiert nie.
 */
export function slideOn(s: Guided, world: World, g: Walker, events: Events): boolean {
  const field = toMeadow(world);
  const here = field.get(key(g.x, g.y)) ?? Infinity;
  const rank = ([x, y]: Point) => (field.get(key(x, y)) ?? Infinity) + (world.cell(x, y).slide ? 0 : 0.5);
  const next = ALL.map(([dx, dy]): Point => [g.x + dx, g.y + dy])
    .filter(([x, y]) => (field.get(key(x, y)) ?? Infinity) < here)
    .sort((a, b) => rank(a) - rank(b))
    .find(([x, y]) => !occupied(s, x, y, g.id) && canStep(world, s.openGates, g.x, g.y, x, y));
  if (!next) return false;
  g.dir = dirTo(next[0] - g.x, next[1] - g.y);
  [g.x, g.y] = next;
  if (field.get(key(...next)) === 0) moveIn(s, world, g, events);
  return true;
}

/** Auf der Schneewiese: Er zieht als erstes Tier ein (`home`), bekommt einen eigenen Platz, heute bleibt es windstill */
function moveIn(s: Guided, world: World, g: Walker, events: Events) {
  g.mode = 'home';
  g.home = { kind: 'garden' };
  g.rest = 2;
  if (!s.garden.some((p) => p.id === g.id)) s.garden.push({ id: g.id, species: g.species });
  s.calm = s.day;
  const taken = new Set(s.animals.filter((o) => o.mode === 'home' && o !== g).map((o) => key(...o.spawn)));
  g.spawn = meadowSpots(world, REALM).find(([x, y]) => !taken.has(key(x, y))) ?? [g.x, g.y];
  events.push({ type: 'home', id: g.id, species: g.species });
}
