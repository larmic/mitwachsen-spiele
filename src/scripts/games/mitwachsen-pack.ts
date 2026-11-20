// Wann ein Welt-Paket gebraucht wird – rein, ohne DOM: Die Spielseite lädt das Paket einer Welt (worlds/<welt>/) erst,
// wenn ihr Tor im Spiel eine Rolle spielt, nicht schon beim Start. Ist es beim Öffnen einer Welt nötig, wartet der
// Start darauf; sonst kommt es im Takt nach, sobald es nötig wird (mitwachsen-packs.ts, larmic-mitwachsen.ts).
// Typen der Pakete: mitwachsen-pack-types.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { GATES, REGIONS, realmOfAnimal, type GateId, type Point } from '../../data/games/mitwachsen';
import { GUIDE_GATE, pending, type Guided } from './mitwachsen-guide';
import type { Beyond } from './mitwachsen-pack-types';

/** So nah (in Feldern, auch schräg) muss die Figur dem Tor kommen, dann kommt das Paket seiner Welt schon einmal */
export const NEAR_GATE = 40;

/**
 * Was die Entscheidung vom Spielstand braucht: offene Tore, Tiere zu Hause und die Orte, an denen die Figur ist oder
 * gespeichert war (`at`: Position und, solange ein Paket fehlt, die gehaltene Position im Spielstand)
 */
export type Need = Pick<Guided, 'openGates' | 'garden'> & { at: readonly (readonly [number, number] | undefined)[] };

/**
 * Braucht das Spiel das Paket der Welt hinter dem Tor `gate` (heute nur das Eistor)? Ja, wenn das Tor offen ist, wenn
 * sein Schlüssel fällig ist (der verlaufene Pinguin, `pending`), wenn ein Tier der Welt schon zu Hause wohnt oder wenn
 * ein Ort in `at` dazu gehört (`packAt`).
 */
export function needsPack(
  s: Need,
  gates: ReadonlyMap<GateId, { mid: Point }>,
  beyond: Beyond,
  gate: GateId = GUIDE_GATE,
): boolean {
  const realm = REGIONS.find((r) => r.behind === gate)?.id;
  if (s.openGates.includes(gate) || (gate === GUIDE_GATE && pending(s))) return true;
  if (realm && s.garden.some((a) => realmOfAnimal(a.id) === realm)) return true;
  return s.at.some((p) => !!p && packAt(p, gates, beyond, gate));
}

/**
 * Gehört ein Ort zur Welt hinter dem Tor `gate` oder ist ihr nah? Ja, wenn er höchstens `NEAR_GATE` Felder vom Tor
 * entfernt ist oder hinter dem Felsring liegt und dieses Tor von allen, die aufgehen können, das nächste ist (dorthin
 * führt nur der Gang dieses Tors). Eine gespeicherte Position dort hält der Spielstand, solange das Paket fehlt.
 */
export function packAt(
  [x, y]: readonly [number, number],
  gates: ReadonlyMap<GateId, { mid: Point }>,
  beyond: Beyond,
  gate: GateId = GUIDE_GATE,
): boolean {
  const mid = gates.get(gate)?.mid;
  if (!mid) return false;
  if (Math.max(Math.abs(x - mid[0]), Math.abs(y - mid[1])) <= NEAR_GATE) return true;
  const far = (m: Point) => (x - m[0]) ** 2 + (y - m[1]) ** 2;
  const opening = GATES.filter((g) => g.opens !== 'never').map((g) => gates.get(g.id)?.mid);
  return beyond(x, y) && opening.every((m) => !m || far(mid) <= far(m));
}
