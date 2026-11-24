// Wann ein Welt-Paket gebraucht wird – rein, ohne DOM: Die Spielseite lädt das Paket einer Welt (worlds/<welt>/) erst,
// wenn ihr Tor im Spiel eine Rolle spielt, nicht schon beim Start. Ist es beim Öffnen einer Welt nötig, wartet der
// Start darauf; sonst kommt es im Takt nach, sobald es nötig wird (mitwachsen-packs.ts, larmic-mitwachsen.ts).
// Typen der Pakete: mitwachsen-pack-types.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import {
  GATES,
  REGIONS,
  keyInPlay,
  keyOf,
  realmOfAnimal,
  regionBehind,
  type GateId,
  type Point,
  type Region,
  type RegionId,
} from '../../data/games/mitwachsen';
import { GUIDE_GATE, pending, type Guided } from './mitwachsen-guide';
import type { Beyond, PackId } from './mitwachsen-pack-types';
import { startRealm, type Realms } from './mitwachsen-home';

/** So nah (in Feldern, auch schräg) muss die Figur dem Tor kommen, dann kommt das Paket seiner Welt schon einmal */
export const NEAR_GATE = 40;

/**
 * Was die Entscheidung vom Spielstand braucht: offene Tore, Tiere zu Hause und die Orte, an denen die Figur ist oder
 * gespeichert war (`at`: Position und, solange ein Paket fehlt, die gehaltene Position im Spielstand); `ride`: Pakete,
 * die ein Fahrzeug braucht, vor dessen Halt die Figur steht (Vorladen, `preloadOf` in mitwachsen-preload.ts)
 */
export type Need = Pick<Guided, 'openGates' | 'garden'> & {
  at: readonly (readonly [number, number] | undefined)[];
  ride?: readonly PackId[];
};

/** Ein Tor, wie die Entscheidung es braucht: seine Mitte und das Land seiner Welt (`GatePlace` in mitwachsen-world.ts) */
export type GateAt = { mid: Point; land?: Beyond };

/**
 * Braucht das Spiel das Paket der Welt hinter dem Tor `gate` (ohne Angabe das Eistor)? Ja, wenn das Tor offen ist, wenn
 * sein Bote fällig ist oder noch nicht eingezogen (beim Eistor der verlaufene Pinguin, `pending`), wenn ein Tier der
 * Welt schon zu Hause wohnt oder wenn ein Ort in `at` dazu gehört (`packAt`; nur an einem Tor, dessen Bote schon kommen
 * kann, `keyInPlay`: das Höhlentor erst mit offenem Eistor). Jedes Tor für sich (`Packs` fragt je Paket).
 */
export function needsPack(
  s: Need,
  gates: ReadonlyMap<GateId, GateAt>,
  beyond: Beyond,
  gate: GateId = GUIDE_GATE,
): boolean {
  const realm = regionBehind(gate)?.id;
  if (s.openGates.includes(gate) || pending(s, gate)) return true;
  if (realm && s.garden.some((a) => realmOfAnimal(a.id) === realm)) return true;
  // Nähe zählt nur an einem Tor, dessen Bote schon kommen kann: Ein Tor, das (noch) nicht aufgeht, lädt nichts im
  // Vorbeigehen (das Höhlentor vor der Eis-Welt: Tok kommt erst danach)
  return keyInPlay(gate, s.openGates) && s.at.some((p) => !!p && packAt(p, gates, beyond, gate));
}

/**
 * Braucht das Spiel das Paket der Bahn (worlds/bahn/: Tok, das Gleis der Höhlenbahn, der Zug)? Sobald das Eistor offen
 * ist (Tok kommt erst nach der Eis-Welt; wann genau, regelt der Schritt „Tok erscheint“). Was davon zu sehen ist, sagen
 * der Spielstand der Fahrzeuge und der Ausbau (`packs.bahn.built`): bei 0 und ohne fälligen Tok nichts
 */
export const bahnWanted = (s: Pick<Need, 'openGates'>): boolean => s.openGates.includes('eis');

/**
 * Braucht das Spiel das Paket der Fahrzeuge (worlds/fahrt/: die Fahr-Engine)? Sobald es ein Fahrzeug geben kann: Das
 * Eistor ist offen (der Schlitten; die Bahn kommt erst danach, `bahnWanted`). Ohne es fährt nichts, zu Fuß geht alles
 */
export const fahrtWanted = (s: Pick<Need, 'openGates'>): boolean => s.openGates.includes('eis');

/**
 * Gehört ein Ort zur Welt hinter dem Tor `gate` oder ist ihr nah? Hinter dem Felsring im Land einer Welt (`land`, auch
 * ohne ihr Paket bekannt) nur zu ihr, so nah ein anderes Tor auch ist. Sonst ja, wenn er höchstens `NEAR_GATE` Felder
 * vom Tor entfernt ist oder hinter dem Felsring liegt und dieses Tor von allen, die aufgehen können, das nächste ist
 * (dorthin führt nur der Gang dieses Tors; so auch eine Stelle des alten Gletscherkessels, die heute neben dem Tal
 * liegt). Eine gespeicherte Position dort hält der Spielstand, solange das Paket fehlt.
 */
export function packAt(
  [x, y]: readonly [number, number],
  gates: ReadonlyMap<GateId, GateAt>,
  beyond: Beyond,
  gate: GateId = GUIDE_GATE,
): boolean {
  const mid = gates.get(gate)?.mid;
  if (!mid) return false;
  const opening = GATES.flatMap((g) => {
    const at = keyOf(g.id) ? gates.get(g.id) : undefined;
    return at ? [{ id: g.id, ...at }] : [];
  });
  const outside = beyond(x, y);
  const owner = outside ? opening.find((g) => g.land?.(x, y)) : undefined;
  if (owner) return owner.id === gate;
  if (Math.max(Math.abs(x - mid[0]), Math.abs(y - mid[1])) <= NEAR_GATE) return true;
  const far = (m: Point) => (x - m[0]) ** 2 + (y - m[1]) ** 2;
  return outside && opening.every((g) => far(mid) <= far(g.mid));
}

/**
 * Hält der Spielstand die gespeicherte Position `p` fest, weil das Paket der Gegend `region` fehlt? Ja, wenn der Bote
 * ihres Tors schon kommen kann (`keyInPlay` mit den offenen Toren `open`: Dann kommt ihr Paket dort), die Welt sie ohne
 * Paket gebaut hat (keine Wohnplätze) und `p` zu ihr gehört oder ihr nah ist (`packAt`): Die Welt wüsste sonst nicht,
 * ob die Figur dort war.
 */
export const holds = (
  world: { gates: ReadonlyMap<GateId, GateAt>; spotsOf(realm: RegionId): readonly Point[] },
  region: Region,
  p: readonly [number, number],
  beyond: Beyond,
  open: readonly GateId[],
): boolean =>
  !!region.behind &&
  keyInPlay(region.behind, open) &&
  !world.spotsOf(region.id).length &&
  packAt(p, world.gates, beyond, region.behind);

/**
 * Gegend, in deren Bett die Figur aufwacht (`startRealm`). Eine Position hinter dem Felsring, die heute zu keinem Feld
 * einer Welt mehr gehört (die Welt wurde umgebaut: aus dem Gletscherkessel wurde das Gletschertal, Spielstand Version
 * 5), gehört zur Welt, in deren Land sie liegt, sonst zur Welt hinter dem nächsten Tor mit Schlüssel (`packAt`); ist
 * ihr Tor offen und ihr Paket da (sie hat Wohnplätze): Start in ihrem Bett.
 */
export function wakeRealm(
  world: Realms & { gates: ReadonlyMap<GateId, GateAt>; spotsOf(realm: RegionId): readonly Point[] },
  open: readonly GateId[],
  position: readonly [number, number] | undefined,
  beyond: Beyond,
): RegionId {
  const realm = startRealm(world, open, position);
  if (realm !== REGIONS[0].id || !position?.every(Number.isInteger) || !beyond(...position)) return realm;
  const owner = REGIONS.find(
    (r) =>
      r.behind &&
      open.includes(r.behind) &&
      world.spotsOf(r.id).length &&
      packAt(position, world.gates, beyond, r.behind),
  );
  return owner?.id ?? realm;
}
