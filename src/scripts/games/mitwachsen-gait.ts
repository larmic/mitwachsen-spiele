// Gangart beim Gleiten – nur Zierde: wie hoch ein Wesen beim Schritt von Feld zu Feld hüpft. Rein und ohne DOM.
// Bei reduzierter Bewegung hüpft niemand (das entscheidet die Web Component, larmic-mitwachsen.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Was angezeigt wird“, Zeile „Wesen“)

import { SPECIES, speciesOf, type Gait } from '../../data/games/mitwachsen';
import { FISH_EATERS } from '../../data/games/mitwachsen-eis';

const SING_MS = 320; // so lange dauert der Hüpfer beim Singen
const SNAP_MS = 180; // so lange dauert der Schnapp-Hüpfer eines Fischfressers
export const SNAP_DELAY = 300; // ms nach dem Hüpfer beim Füttern mit Fisch: Dann schnappen die Fischfresser zu

/** Schnappt dieses Wesen nach Fisch (ein Fischfresser der Eis-Welt)? */
export const snaps = (id: string) => FISH_EATERS.has(speciesOf(id) ?? '');

/** Hüpfer je Gangart über einen Schritt (`moving` von 1 am Anfang bis 0 am Ziel) */
const STRIDE: Record<Gait | 'schritt', (m: number) => number> = {
  schritt: (m) => Math.sin(m * Math.PI) * 0.14, // ein kleiner Hüpfer (Figur und Tiere ohne Gangart)
  watscheln: (m) => Math.abs(Math.sin(m * Math.PI * 2)) * 0.07, // zwei kleine Wackler je Feld
  robben: (m) => Math.abs(Math.sin(m * Math.PI * 2)) * 0.05, // flach, in zwei Schüben
  huepfen: (m) => Math.sin(m * Math.PI) * 0.26, // ein hoher Sprung
  huschen: (m) => Math.abs(Math.sin(m * Math.PI * 3)) * 0.035, // schnelle, flache Trippelschritte
  flattern: (m) => Math.sin(m * Math.PI) * 0.22 + Math.abs(Math.sin(m * Math.PI * 4)) * 0.04, // kurz aufgeflattert
};

/**
 * Höhe des Hüpfers eines Wesens (Kennung `id`, die Figur heißt 'player'): Gangart seiner Art über den Schritt
 * (`moving`, 0 … 1), dazu der Hüpfer beim Singen (`sung` ms her) und der kurze Schnapp-Hüpfer nach Fisch (`snapped` ms
 * her; vor dem Zeitpunkt nichts).
 */
export function hopOf(id: string, moving: number, sung: number, snapped = Infinity): number {
  const species = speciesOf(id);
  const stride = STRIDE[(species && SPECIES[species].gait) || 'schritt'];
  const snap = snapped >= 0 && snapped < SNAP_MS ? Math.sin((snapped / SNAP_MS) * Math.PI) * 0.16 : 0;
  return stride(moving) + (sung < SING_MS ? Math.sin((sung / SING_MS) * Math.PI) * 0.3 : 0) + snap;
}
