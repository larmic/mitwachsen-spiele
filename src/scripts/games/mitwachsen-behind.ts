// Was hinter dem Gang eines Tors liegt – rein und deterministisch: die Welt aus ihrem Paket (worlds/<welt>/) oder,
// wenn das Paket fehlt (noch nicht geladen, Laden gescheitert), eine Klippe am Ende des Gangs (am Eistor aus Eis).
// Hinter einem Tor, das nie aufgeht, steht ohne Paket nichts: Der Gang endet in der Landschaft. Teil von
// mitwachsen-world.ts, je Gegend hinter einem Tor einmal.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { keyOf, type GateId, type Point } from '../../data/games/mitwachsen';
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
 * Klangstein die zweite Fassung der Geschichte des Tors (`openStory`, beim Eistor „Wenn das Tor offen ist“). Ohne Paket
 * steht hinter dem Gang eines Tors, das aufgehen kann (`closable`: es hat einen Schlüssel), eine Klippe (am Eistor aus
 * Eis, sonst aus Fels, `CLIFF`); hinter einem, das nie
 * aufgeht, gar nichts. Die Welt hat dann keine Felder, keine Wohnorte und kein Portal; ihr Bett liegt am Ende des Gangs
 * (in der Klippe), nur damit jede Gegend ein Zuhause hat.
 */
export function behind(
  pack: WorldPack | undefined,
  seed: number,
  gang: Gang,
  beyond: Beyond,
  passage: (x: number, y: number) => Cell,
  map: Map<string, Cell>,
  gate: GateId,
  closable = !!keyOf(gate), // kann das Tor aufgehen? (es hat einen Schlüssel)
): Behind {
  if (pack) {
    const { stone, portal, ...rest } = pack.build(seed, gang, beyond, passage, map);
    const story = openStory(gate);
    return { ...rest, portals: [portal], stones: story ? [[story, stone]] : [], built: true };
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
