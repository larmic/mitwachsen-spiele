// Spielstand der Fahrzeuge – rein, im Welt-Paket der Eis-Welt (später im eigenen Paket `worlds/fahrt/`): Wie weit jedes
// Fahrzeug ist, steht in `State.packs.fahrt` (eigener Schlüssel, nicht `packs.eis`: den schreibt der Schneemann jedes
// Mal neu). Kein Eintrag: noch nicht da. `bereit`: erschienen, goldener Rahmen an der Tür. `fest`: erste Heimfahrt
// gemacht (Festfahrt), Wimpel, Halt auf der Lichtung. Wo ein Fahrzeug steht, wird nie gespeichert. Die Migration
// steckt hier (`rideOf`), der Kern trägt den Eintrag nur.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Der Schlitten“ und „Speichern“)

import type { RideId } from '../../../../data/games/mitwachsen-rides';

/** Stufe eines Fahrzeugs im Spielstand (Teilmenge des Formats aus dem Konzept „Reisewege“) */
export type RideStage = 'bereit' | 'fest';
/** Gespeicherter Zustand der Fahrzeuge (`packs.fahrt`), je Kennung */
export type RideSave = Partial<Record<RideId, { stage: RideStage }>>;

const STAGES: readonly string[] = ['bereit', 'fest'] satisfies RideStage[];
const EMPTY: Readonly<RideSave> = Object.freeze({});
// je gelesenem Eintrag einmal aufräumen: Regeln und Ansicht fragen in jedem Takt und Bild
const clean = new WeakMap<object, Readonly<RideSave>>();

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Migration im Paket: Stufen der Fahrzeuge aus dem gespeicherten Zustand der Welt-Pakete (`packs`). Ältere Stände ohne
 * Eintrag ergeben lauter fehlende Fahrzeuge; kaputte Einträge und unbekannte Stufen fallen weg. Unbekannte Kennungen
 * mit gültiger Stufe bleiben (ein späteres Fahrzeug). Format 1 ist das erste; ein späteres zieht hier um.
 */
export function rideOf(packs: Readonly<Record<string, unknown>>): Readonly<RideSave> {
  const raw = packs.fahrt;
  if (!isRecord(raw)) return EMPTY;
  let rides = clean.get(raw);
  if (!rides) clean.set(raw, (rides = migrate(raw)));
  return rides;
}

const migrate = (raw: Record<string, unknown>): RideSave =>
  Object.fromEntries(
    Object.entries(raw).flatMap(([id, v]) =>
      isRecord(v) && typeof v.stage === 'string' && STAGES.includes(v.stage) ? [[id, { stage: v.stage }]] : [],
    ),
  );

/** Stufe eines Fahrzeugs (undefined: noch nicht da) */
export const stageOf = (packs: Readonly<Record<string, unknown>>, id: RideId): RideStage | undefined =>
  rideOf(packs)[id]?.stage;

/**
 * Neuer Zustand der Pakete mit dieser Stufe für ein Fahrzeug. Alles andere bleibt, wie es ist: andere Pakete und, im
 * Eintrag `fahrt`, die anderen Fahrzeuge (auch in einem Format, das erst ein späteres Spiel kennt).
 */
export const withRide = (
  packs: Readonly<Record<string, unknown>>,
  id: RideId,
  stage: RideStage,
): Record<string, unknown> => ({
  ...packs,
  fahrt: { ...(isRecord(packs.fahrt) ? packs.fahrt : {}), [id]: { stage } },
});
