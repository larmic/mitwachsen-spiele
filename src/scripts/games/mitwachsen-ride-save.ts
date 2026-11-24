// Spielstand der Fahrzeuge – rein, für die Pakete (Fahrzeuge, Eis-Welt, Bahn; nur sie importieren ihn, Regel
// `ride-kit-is-for-packs`, darum nicht im Kern): Wie weit jedes Fahrzeug ist, steht in `State.packs.fahrt` (eigener
// Schlüssel, nicht `packs.eis`: den schreibt der Schneemann jedes Mal neu), je Kennung `{ stage, schlaeft?, gefahren? }`
// (Konzept „Reisewege“). Kein Eintrag: noch nicht da. `faellig`: der Bote kam (Tok). `bereit`: erschienen bzw. gebaut,
// das Fahrzeug steht da, goldener Rahmen an der Tür. `offen`: die erste Fahrt ist gemacht und das Tor offen (kommt mit
// dem Hau-ruck). `fest`: Festfahrt gemacht, Wimpel (Schlitten: erste Heimfahrt, Halt auf der Lichtung). `schlaeft`: der
// Bote kam am Abend und schläft bis zum nächsten echten Spieltag. `gefahren`: die erste Fahrt ist gemacht, das Tor aber
// noch zu (der Zug zwischen erster Fahrt und Hau-ruck: kein goldener Rahmen mehr). Wo ein Fahrzeug steht, wird nie
// gespeichert. Die Migration
// steckt hier (`rideOf`), der Kern trägt den Eintrag nur. Früher getrennt im Paket der Eis-Welt (`rideOf`, `withRide`)
// und im Paket der Bahn (`tokOf`, `withTok`), weil Pakete einander nicht importieren; jetzt eins für alle.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Der Schlitten“, „Tok und die Bahn“ und „Speichern“)

import type { RideId } from '../../data/games/mitwachsen-rides';

/** Stufe eines Fahrzeugs im Spielstand, in ihrer Reihenfolge */
export type RideStage = 'faellig' | 'bereit' | 'offen' | 'fest';
/** Eintrag eines Fahrzeugs (`packs.fahrt.<id>`) */
export type RideEntry = { stage: RideStage; schlaeft?: true; gefahren?: true };
/** Gespeicherter Zustand der Fahrzeuge (`packs.fahrt`), je Kennung */
export type RideSave = Partial<Record<RideId, RideEntry>>;

/** Die Stufen in ihrer Reihenfolge (eine spätere schließt die früheren ein) */
export const STAGES: readonly RideStage[] = ['faellig', 'bereit', 'offen', 'fest'];
const EMPTY: Readonly<RideSave> = Object.freeze({});
// je gelesenem Eintrag einmal aufräumen: Regeln und Ansicht fragen in jedem Takt und Bild
const clean = new WeakMap<object, Readonly<RideSave>>();

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStage = (v: unknown): v is RideStage => typeof v === 'string' && (STAGES as readonly string[]).includes(v);

/** Rang einer Stufe (0 `faellig` … 3 `fest`; ohne Stufe −1): Hat ein Fahrzeug `stage` schon erreicht? */
export const rank = (stage: RideStage | undefined): number => (stage ? STAGES.indexOf(stage) : -1);

/**
 * Migration im Kern der Pakete: Einträge der Fahrzeuge aus dem gespeicherten Zustand der Welt-Pakete (`packs`). Ältere
 * Stände ohne Eintrag ergeben lauter fehlende Fahrzeuge; kaputte Einträge und unbekannte Stufen fallen weg, `schlaeft`
 * und `gefahren` zählen nur, wenn sie genau true sind. Unbekannte Kennungen mit gültiger Stufe bleiben (ein späteres Fahrzeug). Format 1
 * ist das erste; ein späteres zieht hier um.
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
      isRecord(v) && isStage(v.stage)
        ? [[id, entry(v.stage, v.schlaeft === true || undefined, v.gefahren === true || undefined)]]
        : [],
    ),
  );

/** Ein Eintrag nur mit den Merkmalen, die gesetzt sind */
const entry = (stage: RideStage, schlaeft?: true, gefahren?: true): RideEntry => ({
  stage,
  ...(schlaeft && { schlaeft }),
  ...(gefahren && { gefahren }),
});

/** Stufe eines Fahrzeugs (undefined: noch nicht da) */
export const stageOf = (packs: Readonly<Record<string, unknown>>, id: RideId): RideStage | undefined =>
  rideOf(packs)[id]?.stage;

/**
 * Neuer Zustand der Pakete mit diesem Eintrag für ein Fahrzeug (`stage`, dazu `schlaeft`, wenn gesetzt; `gefahren`
 * bleibt, wie es war). Alles andere bleibt, wie es ist: andere Pakete und, im Eintrag `fahrt`, die anderen Fahrzeuge
 * (auch in einem Format, das erst ein späteres Spiel kennt).
 */
export const withRide = (
  packs: Readonly<Record<string, unknown>>,
  id: RideId,
  stage: RideStage,
  schlaeft?: true,
): Record<string, unknown> => put(packs, id, entry(stage, schlaeft, rideOf(packs)[id]?.gefahren));

const put = (packs: Readonly<Record<string, unknown>>, id: RideId, e: RideEntry): Record<string, unknown> => ({
  ...packs,
  fahrt: { ...(isRecord(packs.fahrt) ? packs.fahrt : {}), [id]: e },
});

/**
 * Nach der ersten Fahrt (`gefahren`, gespeichert): Der goldene Rahmen an der Tür fällt weg. Ohne Eintrag oder schon
 * gefahren derselbe Zustand
 */
export function withRidden(packs: Record<string, unknown>, id: RideId): Record<string, unknown> {
  const e = rideOf(packs)[id];
  return !e || e.gefahren ? packs : put(packs, id, { ...e, gefahren: true });
}

/** Hat ein Fahrzeug die Figur schon einmal gefahren (`gefahren` oder eine Stufe ab `offen`)? */
export const ridden = (packs: Readonly<Record<string, unknown>>, id: RideId): boolean =>
  !!rideOf(packs)[id]?.gefahren || rank(stageOf(packs, id)) >= rank('offen');

// ---------- Tok und die Höhlenbahn (`packs.fahrt.hoehle`) ----------

/** Zustand von Tok und Bahn (undefined: Tok ist noch nicht gekommen) */
export const tokOf = (packs: Readonly<Record<string, unknown>>): RideEntry | undefined => rideOf(packs).hoehle;

/** Neuer Zustand der Pakete mit diesem Eintrag für Tok und Bahn; alles andere (andere Fahrzeuge, Pakete) bleibt */
export const withTok = (packs: Readonly<Record<string, unknown>>, save: RideEntry): Record<string, unknown> =>
  put(packs, 'hoehle', entry(save.stage, save.schlaeft, save.gefahren));

/**
 * Hat der Schlitten das Kind schon einmal heimgebracht (Stufe `fest` in `packs.fahrt.schlitten`, nach der Festfahrt)?
 * Erst dann kann Tok kommen
 */
export const sledHome = (packs: Readonly<Record<string, unknown>>): boolean => stageOf(packs, 'schlitten') === 'fest';

/**
 * Ein neuer echter Spieltag (`WorldPack.dawn`, mehr als `BREAK` Pause): Tok, der am Abend schlafend kam, wacht auf
 * (`schlaeft` fällt weg). Ohne Änderung derselbe Zustand
 */
export function wakeTok(packs: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const tok = tokOf(packs);
  return tok?.schlaeft ? withTok(packs, { ...tok, schlaeft: undefined }) : { ...packs };
}
