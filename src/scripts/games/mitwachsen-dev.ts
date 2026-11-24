// Entwickler-Schalter – rein, ohne DOM: Was das Kind noch nicht erreichen kann, schon einmal ansehen („Blick hinein“).
// Er hängt nur an der Adresse der Spielseite (`/spielen/?entwickler=hoehle`), nie am Spielstand und nie am Menü: Das Kind
// findet ihn nicht. Mit ihm holt die Seite die genannten Pakete (mehrere mit Komma: `?entwickler=hoehle,bahn`), die
// Figur wacht im Bett der ersten genannten Welt auf (die Bahn hat keine: dann im Bett der Lichtung), und es wird nichts
// gespeichert, auch nicht über das Menü (`sandbox`; der Spielstand des Kindes bleibt, wie er war; nach dem Neuladen ohne
// Schalter wacht die Figur wieder dort auf, wo sie war). Die Tore bleiben zu: Hinaus geht es nur durch Neuladen ohne
// Schalter. Die Bahn (`bahn`, hinter `BAHN_LIVE`) holt die Grotte mit, damit das Gleis bis zum Bahnhof Fledermaus liegt,
// und die Fahr-Engine mit und spielt einen Ausbau vor (`devProgress`: `&bau=1` bis zum Prellbock in der Bucht, sonst 2,
// die ganze Linie; der Zug steht dann am Bahnhof Bär, Stufe `bereit`, die Figur kann einsteigen und fahren). Mit
// `&bau=0` spielt sie den Stand vor, in dem Tok kommt: noch nichts gebaut, Eistor offen (dafür holt sie das Paket der
// Eis-Welt mit), Eis-Leiste voll, erste Heimfahrt mit dem Schlitten gemacht; `&abend=1` macht es Abend (Tok kommt
// schlafend, `devLate`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Die Kristallgrotte“, Entwickler-Schalter, und „Tok und die Bahn“)

import { REGIONS, animalId, type RegionId } from '../../data/games/mitwachsen';
import type { PackId } from './mitwachsen-pack-types';
import type { Store } from './mitwachsen-save';
import type { Progress } from './mitwachsen-state';

/** Name des Schalters in der Adresse */
export const DEV_PARAM = 'entwickler';
/** Ausbau des Gleises, den der Schalter für die Bahn vorspielt (`&bau=0` oder `&bau=1`, sonst 2) */
export const DEV_BUILT = 'bau';
/** Abend vorspielen (`&abend=1`): Die Regeln sehen die Uhr des Kinds bei `BED_AT` (Tok kommt schlafend) */
export const DEV_EVENING = 'abend';
/** Pakete, die ein Paket im Blick hinein mitbringt: die Bahn die Grotte (dort endet ihr Gleis) und die Fahr-Engine (der Zug fährt) */
const WITH: Partial<Record<PackId, readonly PackId[]>> = { bahn: ['hoehle', 'fahrt'] };

/** Was der Entwickler-Schalter will: welche Pakete er holt (leer: kein Schalter) und in welchem Bett die Figur aufwacht */
export type Glimpse = { packs: PackId[]; home: RegionId | null };

/** Ausbau, den der Schalter der Bahn vorspielt: 0 oder 1 aus `&bau=`, sonst 2 */
const builtIn = (search: string): 0 | 1 | 2 => {
  const b = new URLSearchParams(search).get(DEV_BUILT);
  return b === '0' ? 0 : b === '1' ? 1 : 2;
};

/**
 * Pakete, in die der Entwickler-Schalter blicken lässt (`?entwickler=<welt>[,<welt>…]` in `search`, der Adresse ab
 * „?“), soweit es sie gibt (`ids`), in der genannten Reihe, dazu was sie mitbringen (`WITH`; die Bahn mit `&bau=0`
 * auch die Eis-Welt, deren Tor dann offen ist); `home`: die erste genannte Welt mit Bett, mit der Bahn allein die
 * Lichtung (null: kein Schalter). Kein Schalter oder nichts Bekanntes: keine Pakete
 */
export function glimpse(search: string, ids: readonly PackId[]): Glimpse {
  const named = (new URLSearchParams(search).get(DEV_PARAM) ?? '').split(',');
  const own = ids.filter((id) => named.includes(id)).sort((a, b) => named.indexOf(a) - named.indexOf(b));
  const tok: PackId[] = own.includes('bahn') && builtIn(search) === 0 ? ['eis'] : [];
  const packs = [...new Set([...own, ...own.flatMap((id) => WITH[id] ?? []), ...tok])].filter((id) => ids.includes(id));
  const home =
    own.find((id): id is Exclude<PackId, 'bahn' | 'fahrt'> => id !== 'bahn' && id !== 'fahrt') ??
    (own.length ? 'lichtung' : null);
  return { packs, home };
}

/**
 * Was der Schalter dem Spielstand vorspielt (nur im Arbeitsspeicher, `sandbox`): mit der Bahn ihren Ausbau
 * (`packs.bahn.built`, aus `&bau=`: 0, 1 oder 2, sonst 2), ab 1 den Zug am Bahnhof (`packs.fahrt.hoehle`, Stufe
 * `bereit`, wenn dort noch nichts steht); bei 0 dazu den Stand, in dem Tok kommt: Eistor offen, von
 * jeder Eis-Art ein Tier auf der Schneewiese (die Eis-Leiste voll) und die erste Heimfahrt mit dem Schlitten gemacht
 * (`packs.fahrt.schlitten`, Stufe `fest`). Ohne Bahn bleibt der Spielstand, wie er ist
 */
export function devProgress(dev: readonly PackId[], search: string, p: Progress): Progress {
  if (!dev.includes('bahn')) return p;
  const built = builtIn(search);
  const packs = { ...p.packs, bahn: { built } };
  const fahrt = typeof p.packs.fahrt === 'object' && p.packs.fahrt !== null ? p.packs.fahrt : {};
  // gebaut: Der Zug steht da (Stufe `bereit`, wie nach Bau 1), wenn der Spielstand nicht schon weiter ist
  const was = (fahrt as { hoehle?: { stage?: unknown } }).hoehle;
  const train = was?.stage === 'offen' || was?.stage === 'fest' ? was : { stage: 'bereit' };
  if (built) return { ...p, packs: { ...packs, fahrt: { ...fahrt, hoehle: train } } };
  const eis = REGIONS.find((r) => r.id === 'eis')?.animals ?? [];
  const home = new Set(p.garden.map((a) => a.id));
  return {
    ...p,
    openGates: [...new Set([...p.openGates, 'eis' as const])],
    garden: [
      ...p.garden,
      ...eis.map(({ species }) => ({ id: animalId('eis', species), species })).filter((a) => !home.has(a.id)),
    ],
    packs: { ...packs, fahrt: { ...fahrt, schlitten: { stage: 'fest' } } },
  };
}

/** Spielt der Schalter Abend vor (`&abend=1`)? Nur zusammen mit einem Blick hinein (`dev`) */
export const devLate = (dev: readonly PackId[], search: string): boolean =>
  dev.length > 0 && new URLSearchParams(search).get(DEV_EVENING) === '1';

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
