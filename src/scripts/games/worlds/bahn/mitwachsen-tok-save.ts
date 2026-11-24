// Spielstand von Tok und der Höhlenbahn im Eintrag der Fahrzeuge – rein, im Paket der Bahn: `packs.fahrt.hoehle =
// { stage, schlaeft? }` wie bei allen Fahrzeugen (Konzept „Reisewege“), neben dem Schlitten (`packs.fahrt.schlitten`, den
// das Paket der Eis-Welt schreibt). Heute gibt es nur die Stufe `faellig` (Tok ist gekommen), `schlaeft`, wenn er am Abend
// kam und noch nicht am nächsten echten Spieltag aufgewacht ist. Wo Tok steht, wird nie gespeichert. Die anderen Stufen
// (`bereit`, `offen`, `fest`) kommen mit Bau 1, der ersten Fahrt und dem Kristall-Wimpel; sie werden schon gelesen, damit
// ein späterer Spielstand hier nichts verliert. Lesen und Schreiben ändern nie andere Fahrzeuge oder Pakete. Sobald die
// Bahn fährt, zieht das mit dem Spielstand des Schlittens in das Paket `worlds/fahrt/` (docs/todo.md).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint; „Speichern“)

/** Stufe der Höhlenbahn im Spielstand (`faellig`: Tok ist gekommen; die übrigen kommen mit den nächsten Schritten) */
export type TokStage = 'faellig' | 'bereit' | 'offen' | 'fest';
/** Gespeicherter Zustand von Tok und Bahn (`packs.fahrt.hoehle`) */
export type TokSave = { stage: TokStage; schlaeft?: true };

const STAGES: readonly string[] = ['faellig', 'bereit', 'offen', 'fest'] satisfies TokStage[];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Der Eintrag der Fahrzeuge (`packs.fahrt`), leer, wenn es keinen gibt oder er kaputt ist */
const ridesOf = (packs: Readonly<Record<string, unknown>>) => (isRecord(packs.fahrt) ? packs.fahrt : {});

/**
 * Zustand von Tok und Bahn (undefined: Tok ist noch nicht gekommen). Ein kaputter Eintrag oder eine unbekannte Stufe gilt
 * als nicht gekommen; `schlaeft` zählt nur, wenn es genau true ist
 */
export function tokOf(packs: Readonly<Record<string, unknown>>): TokSave | undefined {
  const raw = ridesOf(packs).hoehle;
  if (!isRecord(raw) || typeof raw.stage !== 'string' || !STAGES.includes(raw.stage)) return undefined;
  return raw.schlaeft === true ? { stage: raw.stage as TokStage, schlaeft: true } : { stage: raw.stage as TokStage };
}

/** Neuer Zustand der Pakete mit diesem Eintrag für Tok und Bahn; alles andere (andere Fahrzeuge, Pakete) bleibt */
export const withTok = (packs: Readonly<Record<string, unknown>>, save: TokSave): Record<string, unknown> => ({
  ...packs,
  fahrt: { ...ridesOf(packs), hoehle: { ...save } },
});

/**
 * Hat der Schlitten das Kind schon einmal heimgebracht (Stufe `fest` in `packs.fahrt.schlitten`, geschrieben vom Paket
 * der Eis-Welt nach der Festfahrt)? Erst dann kann Tok kommen
 */
export function sledHome(packs: Readonly<Record<string, unknown>>): boolean {
  const sled = ridesOf(packs).schlitten;
  return isRecord(sled) && sled.stage === 'fest';
}

/**
 * Ein neuer echter Spieltag (`WorldPack.dawn`, mehr als `BREAK` Pause): Tok, der am Abend schlafend kam, wacht auf
 * (`schlaeft` fällt weg). Ohne Änderung derselbe Zustand
 */
export function wakeTok(packs: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const tok = tokOf(packs);
  return tok?.schlaeft ? withTok(packs, { stage: tok.stage }) : { ...packs };
}
