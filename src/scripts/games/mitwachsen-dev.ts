// Entwickler-Schalter – rein, ohne DOM: Eine Welt, die das Kind noch nicht erreichen kann, schon einmal ansehen
// („Blick hinein“). Er hängt nur an der Adresse der Spielseite (`/spielen/?entwickler=hoehle`), nie am Spielstand und
// nie am Menü: Das Kind findet ihn nicht. Mit ihm holt die Seite das Paket dieser Welt, die Figur wacht in ihrem Bett auf,
// und es wird nichts gespeichert, auch nicht über das Menü (`sandbox`; der Spielstand des Kindes bleibt, wie er war; nach dem Neuladen ohne Schalter wacht
// die Figur wieder dort auf, wo sie war). Das Tor bleibt zu: Hinaus geht es nur durch Neuladen ohne Schalter.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“, Entwickler-Schalter)

import type { PackId } from './mitwachsen-pack-types';
import type { Store } from './mitwachsen-save';

/** Name des Schalters in der Adresse */
export const DEV_PARAM = 'entwickler';

/**
 * Welt, in die der Entwickler-Schalter blicken lässt (`?entwickler=<welt>` in `search`, der Adresse ab „?“), wenn es
 * für sie ein Paket gibt (`ids`); sonst null (kein Schalter, unbekannte Welt)
 */
export function glimpse(search: string, ids: readonly PackId[]): PackId | null {
  const want = new URLSearchParams(search).get(DEV_PARAM);
  return ids.find((id) => id === want) ?? null;
}

/**
 * Speicher für den Entwickler-Schalter: liest den Spielstand des Kindes, schreibt aber nur in den Arbeitsspeicher. So
 * ändert nichts, was im Blick hinein geschieht (Speichern, Menü: neue Welt, Welt löschen, Ton, „Kamera bewegen“), den
 * Spielstand im `localStorage`; nach dem Neuladen ist alles vergessen
 */
export function sandbox(store: Store): Store {
  const own = new Map<string, string | null>(); // null: hier gelöscht
  return {
    getItem: (k) => (own.has(k) ? own.get(k)! : store.getItem(k)),
    setItem: (k, v) => void own.set(k, String(v)),
    removeItem: (k) => void own.set(k, null),
  };
}
