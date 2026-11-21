// Schneemänner bauen in der Eis-Welt – rein, ohne DOM, im Welt-Paket der Eis-Welt: Im Gletschertal liegen hier und da
// Schneehaufen (`'snowheap'`, fest wie ein Busch, gesetzt in mitwachsen-frost.ts). Jedes Hineinlaufen lässt eine Kugel
// wachsen, beim dritten Mal steht ein Schneemann mit Kopf, Möhrennase und Mütze da und bleibt stehen. Kein Fehler, kein
// Ende: Ein fertiger Schneemann ist einfach da, man läuft um ihn herum. `step` bekommt die Regel als `pack.rules`
// hereingereicht (index.ts). Wie weit jeder Haufen gewachsen ist, steht im gespeicherten Zustand des Pakets
// (`State.packs.eis`, Format `EisSave`); seine Migration steckt hier (`snowOf`), der Kern trägt ihn nur.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Ereignisse“, Regel 3c, „Gletscherkessel“ und „Speichern“)

import type { Cell } from '../../mitwachsen-cell';
import { lookUp } from '../../mitwachsen-listen';
import type { WorldRules } from '../../mitwachsen-pack-types';

/** So oft hineinlaufen, dann steht der Schneemann (Stufe 0 Haufen, 1 eine Kugel, 2 zwei, 3 Schneemann) */
export const SNOWMAN = 3;
/** So lange schauen die Tiere ringsum zu (Takte), wenn eine Kugel wächst */
const WATCH = 20;

/** Gespeicherter Zustand der Eis-Welt (`packs.eis`): Stufe je Schneehaufen ("x,y" → 1 … 3; ohne Eintrag 0) */
export type EisSave = { v: 1; snow: Record<string, number> };

const EMPTY: Readonly<Record<string, number>> = Object.freeze({});
const STAGED = /^-?\d+,-?\d+$/;
// je gelesenem Eintrag einmal aufräumen: Die Ansicht fragt jeden Schneehaufen in jedem Bild
const clean = new WeakMap<object, Readonly<Record<string, number>>>();

/**
 * Migration im Paket: Stufen der Schneehaufen aus dem gespeicherten Zustand der Welt-Pakete (`packs`). Ältere Stände
 * ohne Eintrag (vor den Schneemännern) und kaputte Einträge ergeben lauter Haufen; unbekannte Felder und Stufen außerhalb
 * 1 … `SNOWMAN` fallen weg. Format 1 ist das erste; ein späteres zieht hier um.
 */
export function snowOf(packs: Readonly<Record<string, unknown>>): Readonly<Record<string, number>> {
  const raw = packs.eis;
  if (typeof raw !== 'object' || raw === null) return EMPTY;
  let snow = clean.get(raw);
  if (!snow) clean.set(raw, (snow = migrate(raw)));
  return snow;
}

function migrate(raw: object): Record<string, number> {
  const snow = (raw as { snow?: unknown }).snow;
  if (typeof snow !== 'object' || snow === null || Array.isArray(snow)) return {};
  return Object.fromEntries(
    Object.entries(snow).filter(
      ([k, v]) => STAGED.test(k) && typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= SNOWMAN,
    ) as [string, number][],
  );
}

/** Wie weit der Schneehaufen auf (x, y) gewachsen ist: 0 Haufen … `SNOWMAN` fertiger Schneemann */
export const stageAt = (packs: Readonly<Record<string, unknown>>, x: number, y: number) =>
  snowOf(packs)[`${x},${y}`] ?? 0;

/**
 * Die Figur läuft in einen Schneehaufen: Er wächst um eine Kugel (`snowman` mit der neuen Stufe), die Figur bleibt kurz
 * stehen, und die Tiere ringsum drehen sich um und schauen zu. Am fertigen Schneemann geschieht nichts (er ist fest wie
 * ein Busch, die Figur stößt sanft an).
 */
const bump: WorldRules['bump'] = (s, c: Cell, x, y, events) => {
  if (c.deco !== 'snowheap') return false;
  const snow = snowOf(s.packs);
  const stage = (snow[`${x},${y}`] ?? 0) + 1;
  if (stage > SNOWMAN) return false;
  const next: EisSave = { v: 1, snow: { ...snow, [`${x},${y}`]: stage } };
  s.packs = { ...s.packs, eis: next };
  lookUp(s, WATCH);
  events.push({ type: 'snowman', x, y, stage });
  return true;
};

export const rules: WorldRules = { bump };
