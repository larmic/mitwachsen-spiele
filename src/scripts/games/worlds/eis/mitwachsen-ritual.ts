// Das Eistor geht mit dem verlaufenen Pinguin auf – rein, ohne DOM: Ist der Pinguin in der Bucht vor dem Tor und steht
// die wache Figur seit 0,4 s auf der Torplatte (nur Stehen zählt, Drüberlaufen öffnet nie) oder läuft sie gegen die
// Tür, geht es für immer auf (`gate`, sofort gespeichert). Erst das Vorspiel je Torlage (`preTicks`, Nord 0,6 s, Ost
// und West 1,2 s, Süd 3,5 s), ohne Sperre: Der Pinguin watschelt vor die Tür und hüpft, die 3D-Ansicht dreht zur Front;
// nur in die noch geschlossenen Flügel geht kein Schritt (`shut`). Dann das Ritual, 3 s in jeder Lage: Er hüpft noch
// einmal, die Flügel schwingen auf, ein kalter Atemzug weht Schnee auf die Lichtung, nach 2,4 s rutscht er durch den
// Gang hinter die Mündung und wartet dort; jeder Pfeil lässt die Figur solange nur hüpfen. Gleich in 2D, 3D und bei
// reduzierter Bewegung: Die Kamera steuert nichts. Betritt die Figur die Eis-Welt, rutscht er voraus zum Schneebett und
// zieht als erstes Tier auf der Schneewiese ein. Mit den Regeln des Führens (mitwachsen-lead.ts) Teil
// des Welt-Pakets der Eis-Welt; Bild und Ton macht die Ansicht.
// Spezifikation: docs/specs/mitwachsen.md (Regel 8a „Das Eistor geht auf“)

import { DIRS } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { dirTo, freeNear, occupied } from '../../mitwachsen-free';
import { GUIDE_GATE, RITUAL, SLIDE, opening, type GuideEvents as Events, type Guided } from '../../mitwachsen-guide';
import { atHome, meadowSpots } from '../../mitwachsen-meadow';
import { ALL, flood, key } from './mitwachsen-flood';
import { inBay } from '../../mitwachsen-bay';
import { canStep, type World } from '../../mitwachsen-world';
import type { WorldRules } from '../../mitwachsen-pack-types';

type Walker = Guided['animals'][number];

export const HOP_AGAIN = 4; // zweiter Hüpfer vor der Tür (0,4 s)
export const BREATH = 18; // der kalte Atemzug aus dem Tor (1,8 s)
export const OPEN_TICKS = 4; // so lange (0,4 s) steht die Figur auf der Torplatte, dann geht das Tor auf
export const WINGS = 12; // so viele Takte nach Beginn des Rituals schwingen die Flügel auf (1,2 s, nach dem Eiszapfen-Lied)
export const PRE_HOP = 5; // im Vorspiel hüpft er vor der Tür alle 0,5 s
/**
 * Vorspiel in Takten aus der Lage des Tors (`out`): Nord 6, Süd 35, Ost und West 12. Doppelt zu `leadTicks` in
 * mitwachsen-turn-pace.ts, das hier nicht hergeben darf (sonst wird es eine eigene Datei, die Kern, Paket und Drehung
 * nachladen); ein Test hält beide gleich
 */
export const preTicks = (out: Point) => (out[1] < 0 ? 6 : out[1] > 0 ? 35 : 12);
// Takte je Feld beim Rutschen zum Schneebett: so schnell wie beim Führen (PACE.lead), schneller als die Figur mit
// gehaltener Taste, damit er wirklich vorausrutscht (die Ansicht gleitet mit)
export const SLIDE_PACE = 2;
const REALM = 'eis'; // die Gegend hinter dem Eistor

/**
 * Ist der Pinguin (bei der Figur angekommen) in der Bucht und steht die wache Figur seit `OPEN_TICKS` Takten auf der
 * Torplatte (`still`: Jeder Schritt zählt neu, darum öffnet Drüberlaufen nie) oder ist sie eben gegen die Tür gelaufen
 * (Ereignis `bump`, zählt wie die Platte), geht das Tor auf: Es kommt zu den offenen Toren (Ereignis `gate`, die Ansicht
 * speichert sofort; `at`: Takte, bis die Flügel aufschwingen), der Pinguin watschelt vor die Mitte der
 * Tür, schaut zur Figur und hüpft mit seinem Ton (`peep`). Nach dem Vorspiel der Lage (`preTicks`, ohne Sperre:
 * Läuft die Figur weg, geht das Tor trotzdem auf) beginnt das Ritual (`ritual`, `hold`), nie schon beim Betreten der
 * Platte. Liefert true, wenn das Tor aufging.
 */
export function opens(s: Guided, world: World, g: Walker, events: Events): boolean {
  const door = world.gates.get(GUIDE_GATE);
  if (!door || s.sleeping || s.guideDue >= 0 || !inBay(door, g.x, g.y)) return false;
  const p = s.player;
  const [dx, dy] = DIRS[p.dir];
  const stands = world.cell(p.x, p.y).plate === GUIDE_GATE && s.still >= OPEN_TICKS;
  const knocks = world.cell(p.x + dx, p.y + dy).gate === GUIDE_GATE && events.some((e) => e.type === 'bump');
  if (!stands && !knocks) return false;
  s.openGates.push(GUIDE_GATE);
  const pre = preTicks(door.out);
  s.ritual = s.tick + pre;
  const front: Point = [door.mid[0] - door.out[0], door.mid[1] - door.out[1]];
  if (!occupied(s, ...front, g.id)) [g.x, g.y] = front;
  g.dir = dirTo(s.player.x - g.x, s.player.y - g.y);
  events.push({ type: 'gate', id: GUIDE_GATE, at: pre + WINGS }, { type: 'peep', id: g.id, species: g.species });
  return true;
}

/**
 * Während das Ritual läuft (`RITUAL` Takte nach dem Vorspiel), lässt jeder Pfeil die Figur nur hüpfen (`hop`); im
 * Vorspiel und danach ist sie frei
 */
export function hold(s: Guided, events: Events): boolean {
  if (s.tick < s.ritual || !opening(s, RITUAL)) return false; // im Vorspiel frei
  events.push({ type: 'hop' });
  return true;
}

/**
 * Im Vorspiel ist das Tor schon offen gespeichert, seine Flügel sind aber noch zu: Ein Pfeil in die Tür lässt die Figur
 * nur hüpfen (`hop`), sie läuft nie durch die geschlossenen Flügel. Danach sperrt das Ritual (`hold`) ohnehin, bis sie
 * offen sind. Eine Regel der Eis-Welt (`rules.bump`), sonst bleibt alles frei
 */
export const shut: WorldRules['bump'] = (s, c, _x, _y, events) =>
  c.gate === GUIDE_GATE && s.tick < s.ritual && !!events.push({ type: 'hop' });

/**
 * Nach jedem Befehl, solange das Eistor offen ist und der Pinguin noch nicht auf der Schneewiese wohnt: Vorspiel und
 * Ritual vor der Tür, dann hinter die Gangmündung (nach dem Laden, auch mitten im Vorspiel, wartet er gleich dort), und
 * steht die Figur in der Eis-Welt, rutscht er voraus zum Schneebett. Nachts ruht er, wo er ist.
 */
export function homeward(s: Guided, world: World, g: Walker, cmd: 'move' | 'action' | 'tick', events: Events) {
  const door = world.gates.get(GUIDE_GATE);
  if (s.tick < s.ritual) {
    // Vorspiel: Er hüpft vor der Tür, bis die Kamera vorn ist
    if (cmd === 'tick' && s.tick % PRE_HOP === 0) events.push({ type: 'bob', id: g.id });
    return;
  }
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

/**
 * Weg zur Schneewiese: Schritte von jedem Feld der Eis-Welt bis auf die Wiese (Breitensuche rückwärts mit `canStep`,
 * Eistor offen). Einmal je Welt.
 */
export const toMeadow = (world: World) =>
  flood(
    world,
    'meadow',
    () => meadowSpots(world, REALM).map(([x, y]): Point => [x, y]),
    (x, y, tx, ty) => world.realm(x, y) === REALM && canStep(world, [GUIDE_GATE], x, y, tx, ty),
  );

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
