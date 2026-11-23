// Fahrzeuge – nur Typen: was die Regeln eines Fahrzeugs vom Zustand sehen (`Rider`) und welche Haken `step` ihnen
// gibt (`RideRules`). Die Regeln selbst bringt das Welt-Paket mit (`WorldRules.ride`, worlds/eis/mitwachsen-ride.ts).
// Eigene Datei, weil mitwachsen-pack-types.ts von der Welt importiert wird und darum `World` nicht kennen darf.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import type { Dir } from '../../lib/games/front';
import type { BorderEvent } from './mitwachsen-border';
import type { Guided } from './mitwachsen-guide';
import type { Ride, RideEvent } from './mitwachsen-pack-types';
import type { World } from './mitwachsen-world';

/**
 * Ein Pfeil (Befehl `move`): `fresh` neu gedrückt oder gemerkter Tipp (nicht gehalten, `InputPace.lastFresh`), `tap`
 * das Fahrzeug angetippt
 */
export type MoveCmd = { type: 'move'; dir: Dir; fresh?: true; tap?: true };

/**
 * Was die Regeln eines Fahrzeugs vom Zustand sehen und ändern dürfen: wie beim Pinguin (`Guided`), dazu den
 * gespeicherten Zustand der Pakete (`packs.fahrt`), die laufende Fahrt (`ride`, nicht gespeichert) und den Takt, ab dem
 * das Fahrzeug erscheint (`rideDue`, danach der Takt, an dem es herbeitrabt bzw. zuletzt angestoßen wurde; -1: nicht
 * fällig; nicht gespeichert)
 */
export type Rider = Guided & { packs: Record<string, unknown>; ride?: Ride; rideDue: number };

/**
 * Ereignisse, die ein Fahrzeug ausgibt: seine eigenen, dazu Warten der folgenden Tiere, Wechsel der Gegend und `bump`
 * (gegen den Schuppen gelaufen, wie gegen jede Wand)
 */
export type RideEvents = { push(...e: (RideEvent | BorderEvent | { type: 'bump' })[]): unknown };

/**
 * Haken eines Fahrzeugs in `step` (aus dem Welt-Paket als `WorldRules.ride`). `tick`: nach dem Takt der Tiere (fällig,
 * erscheinen, fahren). `move`: vor allem anderen; true, wenn der Zug damit erledigt ist (einsteigen, anstoßen, während
 * der Fahrt immer; ein Antippen immer, sobald das Fahrzeug eine Strecke hat: gelaufen wird per Antippen nie).
 * `blocks`: Darf das Tier `a` nicht auf (x, y) gehen (Halte, Fahrzeug, Schuppen, Strecke)?
 */
export type RideRules = {
  tick(s: Rider, world: World, events: RideEvents): void;
  move(s: Rider, world: World, cmd: MoveCmd, events: RideEvents): boolean;
  blocks(s: Rider, world: World, a: Rider['animals'][number], x: number, y: number): boolean;
};
