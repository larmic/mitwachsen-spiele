// Was hinter dem Gang eines Tors liegt – rein und deterministisch: die Welt aus ihrem Paket (worlds/<welt>/) oder,
// wenn das Paket fehlt (noch nicht geladen, Laden gescheitert), eine Klippe am Ende des Gangs (am Eistor aus Eis, am
// Höhlentor aus Fels). Hinter einem Tor ohne Welt, das nie aufgeht, steht nichts: Der Gang endet in der Landschaft.
// Wo eine Welt liegen darf: hinter dem Felsring, fern der anderen Gänge und außerhalb der Hülle jeder Welt, die in
// `REGIONS` vor ihr steht (`hullOf`, ohne deren Paket berechnet). Teil von mitwachsen-world.ts, je Gegend einmal.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { keyOf, regionBehind, type GateId, type Point, type Room } from '../../data/games/mitwachsen';
import { openStory, type StoryId } from '../../data/games/mitwachsen-stories';
import type { Cell, Ground } from './mitwachsen-cell';
import type { Beyond, Gang, Kessel, WorldPack } from './mitwachsen-pack-types';
import type { Portal, PortalId } from './mitwachsen-portal';

/**
 * Was hinter dem Tor liegt: die Welt aus dem Paket mit Portal und Klangstein, ohne Paket nur eine Klippe (ohne beide)
 * oder gar nichts (`built` false: Das Tor geht nie auf, die Welt baut hier nichts, die Gegend hat keine Felder)
 */
export type Behind = Omit<Kessel, 'stone' | 'portal'> & {
  portals: [PortalId, Portal][];
  stones: [StoryId, Point][];
  built: boolean;
};

const CLOSED = [3, 4, 5]; // Klippe am Ende des Gangs ohne Welt-Paket: Reihe für Reihe höher, wie die Kesselklippen
/** Boden der Klippe je Tor: am Eistor Eis, sonst Fels */
const CLIFF: Partial<Record<GateId, Ground>> = { eis: 'ice' };

/**
 * Die Welt hinter dem Gang des Tors `gate` in die Karte bauen (`map`, dort liegt schon der Gang). Mit Paket erzählt ihr
 * Klangstein die zweite Fassung der Geschichte des Tors (`openStory`, beim Eistor „Wenn das Tor offen ist“), dazu ihre
 * weiteren Klangsteine (`Kessel.more`, Grotte: `lichtgeister`). Ohne Paket
 * steht hinter dem Gang eines Tors, das aufgehen kann (`closable`: es hat einen Schlüssel), eine Klippe (am Eistor aus
 * Eis, sonst aus Fels, `CLIFF`), ebenso hinter einem, dessen Gegend eine Welt hat (`Region.room`: das Höhlentor);
 * hinter einem anderen, das nie aufgeht, gar nichts. Die Welt hat dann keine Felder, keine Wohnorte und kein Portal;
 * ihr Bett liegt am Ende des Gangs (in der Klippe), nur damit jede Gegend ein Zuhause hat.
 */
export function behind(
  pack: WorldPack | undefined,
  seed: number,
  gang: Gang,
  beyond: Beyond,
  passage: (x: number, y: number) => Cell,
  map: Map<string, Cell>,
  gate: GateId,
  closable = !!keyOf(gate) || !!regionBehind(gate)?.room, // kann das Tor aufgehen, oder liegt dahinter eine Welt?
): Behind {
  if (pack?.build) {
    const { stone, portal, more = [], ...rest } = pack.build(seed, gang, beyond, passage, map);
    const story = openStory(gate);
    return {
      ...rest,
      portals: [portal],
      stones: [...(story ? [[story, stone] as [StoryId, Point]] : []), ...more],
      built: true,
    };
  }
  const bed = gang.at(0, gang.end + CLOSED.length);
  const none = { bed, realm: new Set<string>(), spots: [], spawns: new Map<string, Point>(), portals: [], stones: [] };
  if (!closable) return { ...none, built: false };
  const span = gang.half + gang.wall;
  const ground = CLIFF[gate] ?? 'stone';
  CLOSED.forEach((h, i) => {
    for (let u = -span; u <= span; u++) {
      const [x, y] = gang.at(u, gang.end + 1 + i);
      map.set(`${x},${y}`, { h, ground, deco: 'rock', region: 'border', solid: true, biome: gate });
    }
  });
  return { ...none, built: true };
}

/** So viele Felder bleibt die Welt hinter einem Tor (samt Klippen) mindestens von den Ausgängen der anderen Gänge weg */
export const EXIT_GAP = 12;

/**
 * Wo eine Welt mit dem Platz `room` gerade hinter dem Gang liegt (wie der Gletscherkessel): t ihrer Mitte, so nah wie
 * möglich am Ende des Gangs, aber mit ihrer ganzen Hülle (Ellipse samt Abstand) in `beyond`. Geprüft wird die Hülle an
 * ihrem Rand: Die Lichtung samt Felsring ist eine Ellipse um die Mitte der Welt, die nie in der Hülle liegt; berührt sie
 * die Hülle, dann auch ihren Rand (ebenso die Kreise um die Ausgänge der anderen Gänge und die Hüllen anderer Welten).
 */
export function straightCentre(gang: Gang, beyond: Beyond, { rx, ry, gap }: Room): number {
  const A = rx + gap,
    B = ry + gap;
  let centre = gang.end + ry;
  const clear = (c: number) => {
    for (let u = -A; u <= A; u++) {
      const h = Math.ceil(B * Math.sqrt(1 - (u / A) ** 2));
      if (!beyond(...gang.at(u, c - h)) || !beyond(...gang.at(u, c + h))) return false;
    }
    for (let v = -B; v <= B; v++) {
      const h = Math.ceil(A * Math.sqrt(1 - (v / B) ** 2));
      if (!beyond(...gang.at(-h, c + v)) || !beyond(...gang.at(h, c + v))) return false;
    }
    return true;
  };
  while (!clear(centre) && centre < gang.end + 400) centre++;
  return centre;
}

/** Lage (u, t) eines Felds im Raster des Gangs (umgekehrt zu `gang.at`) */
export function gangCoords(gang: Pick<Gang, 'at'>, [x, y]: Point): Point {
  const [ox, oy] = gang.at(0, 0);
  const [ax, ay] = gang.at(1, 0);
  const [tx, ty] = gang.at(0, 1);
  return [(x - ox) * (ax - ox) + (y - oy) * (ay - oy), (x - ox) * (tx - ox) + (y - oy) * (ty - oy)];
}

/**
 * Hülle einer Welt, die gerade hinter ihrem Gang liegt (`straightCentre`, Mitte bei t = `centre`): ihre Ellipse samt
 * Abstand und die Verlängerung ihres Gangs bis dorthin (samt Wänden und Abstand). Eine spätere Welt bleibt draußen.
 */
export function hullOf(gang: Gang, centre: number, { rx, ry, gap }: Room): Beyond {
  const [A, B, side] = [rx + gap, ry + gap, gang.half + gang.wall + gap];
  return (x, y) => {
    const [u, t] = gangCoords(gang, [x, y]);
    return (u / A) ** 2 + ((t - centre) / B) ** 2 < 1 || (Math.abs(u) <= side && t > gang.end && t < centre);
  };
}

/**
 * Land der Welt hinter dem Tor `gate` (ihr Platz `Region.room`), wenn sie gerade hinter ihrem Gang liegt, wie es auch
 * ohne ihr Paket feststeht: ihre Hülle (`hullOf` um `straightCentre` in `beyond`, wie spätere Welten sie freihalten;
 * darin liegen alle ihre Felder, Test). Erst beim ersten Fragen berechnet. Keines ohne Welt und bei einer, deren Gang
 * biegen darf (`bend`: Sie steht zuletzt, ihr Land ist, was die anderen freilassen)
 */
export function landOf(gang: Gang, gate: GateId, beyond: () => Beyond): Beyond | undefined {
  const room = regionBehind(gate)?.room;
  if (!room || room.bend) return undefined;
  let hull: Beyond | undefined;
  return (x, y) => (hull ??= hullOf(gang, straightCentre(gang, beyond(), room), room))(x, y);
}

/**
 * Wo die Welt hinter dem Tor `own` liegen darf (`Beyond` für ihr Paket): ganz hinter dem Felsring (`beyond`) und
 * mindestens `EXIT_GAP` Felder von jedem Ausgang der anderen Gänge (`gangs` ohne `own`: ihre erste Reihe ganz hinter
 * dem Felsring, `end`, in der Breite von Tor und Türmen, `span` Felder zu jeder Seite)
 */
export function roomBehind(
  beyond: Beyond,
  span: number,
  gangs: readonly (Pick<Gang, 'at' | 'end'> & { id: GateId })[],
  own: GateId,
): Beyond {
  const exits = gangs
    .filter((g) => g.id !== own)
    .flatMap((g) => Array.from({ length: 2 * span + 1 }, (_, k) => g.at(k - span, g.end)));
  return (x, y) => beyond(x, y) && exits.every(([ex, ey]) => (x - ex) ** 2 + (y - ey) ** 2 >= EXIT_GAP ** 2);
}
