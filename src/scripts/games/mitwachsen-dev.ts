// Entwickler-Schalter – rein, ohne DOM: Was das Kind noch nicht erreichen kann, schon einmal ansehen („Blick hinein“).
// Er hängt nur an der Adresse der Spielseite (`/spielen/?entwickler=hoehle`), nie am Spielstand und nie am Menü: Das Kind
// findet ihn nicht. Mit ihm holt die Seite die genannten Pakete (mehrere mit Komma: `?entwickler=hoehle,bahn`), die
// Figur wacht im Bett der ersten genannten Welt auf (die Bahn hat keine: dann im Bett der Lichtung), und es wird nichts
// gespeichert, auch nicht über das Menü (`sandbox`; der Spielstand des Kindes bleibt, wie er war; nach dem Neuladen ohne
// Schalter wacht die Figur wieder dort auf, wo sie war). Die Tore bleiben zu: Hinaus geht es nur durch Neuladen ohne
// Schalter. Die Bahn (`bahn`, hinter `BAHN_LIVE`) holt die Grotte mit, damit das Gleis bis zum Bahnhof Fledermaus liegt,
// und spielt einen Ausbau vor (`devPacks`: `&bau=1` bis zum Prellbock in der Bucht, sonst 2, die ganze Linie).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Die Kristallgrotte“, Entwickler-Schalter, und „Tok und die Bahn“)

import type { PackId } from './mitwachsen-pack-types';
import type { Store } from './mitwachsen-save';

/** Name des Schalters in der Adresse */
export const DEV_PARAM = 'entwickler';
/** Ausbau des Gleises, den der Schalter für die Bahn vorspielt (`&bau=1`, sonst 2) */
export const DEV_BUILT = 'bau';
/** Pakete, die ein Paket im Blick hinein mitbringt: die Bahn die Grotte (dort endet ihr Gleis) */
const WITH: Partial<Record<PackId, readonly PackId[]>> = { bahn: ['hoehle'] };

/** Was der Entwickler-Schalter will: welche Pakete er holt (leer: kein Schalter) und in welchem Bett die Figur aufwacht */
export type Glimpse = { packs: PackId[]; home: Exclude<PackId, 'bahn'> | null };

/**
 * Pakete, in die der Entwickler-Schalter blicken lässt (`?entwickler=<welt>[,<welt>…]` in `search`, der Adresse ab
 * „?“), soweit es sie gibt (`ids`), in der genannten Reihe, dazu was sie mitbringen (`WITH`); `home`: die erste genannte
 * Welt mit Bett (null: im Bett der Lichtung). Kein Schalter oder nichts Bekanntes: keine Pakete
 */
export function glimpse(search: string, ids: readonly PackId[]): Glimpse {
  const named = (new URLSearchParams(search).get(DEV_PARAM) ?? '').split(',');
  const own = ids.filter((id) => named.includes(id)).sort((a, b) => named.indexOf(a) - named.indexOf(b));
  const packs = [...new Set([...own, ...own.flatMap((id) => WITH[id] ?? [])])].filter((id) => ids.includes(id));
  const home = own.find((id): id is Exclude<PackId, 'bahn'> => id !== 'bahn') ?? null;
  return { packs, home };
}

/**
 * Was der Schalter dem Spielstand vorspielt (nur im Arbeitsspeicher, `sandbox`): mit der Bahn ihren Ausbau
 * (`packs.bahn.built`, aus `&bau=`: 1 oder 2, sonst 2); sonst nichts
 */
export function devPacks(dev: readonly PackId[], search: string): Record<string, unknown> {
  if (!dev.includes('bahn')) return {};
  return { bahn: { built: new URLSearchParams(search).get(DEV_BUILT) === '1' ? 1 : 2 } };
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
