// Gangart beim Gleiten – nur Zierde: wie hoch ein Wesen beim Schritt von Feld zu Feld hüpft. Rein und ohne DOM.
// Bei reduzierter Bewegung hüpft niemand (das entscheidet die Web Component, larmic-mitwachsen.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Was angezeigt wird“, Zeile „Wesen“)

import { SPECIES, speciesOf, type Gait } from '../../data/games/mitwachsen';
import { FISH_EATERS } from '../../data/games/mitwachsen-eis';
import { MOSS_EATERS, SHROOM_EATERS } from '../../data/games/mitwachsen-hoehle';

const SING_MS = 320; // so lange dauert der Hüpfer beim Singen
const SNAP_MS = 180; // so lange dauert der Schnapp-Hüpfer
export const HOME_STAGGER = 250; // ziehen mehrere Tiere zugleich ein, ruft und hüpft jedes so viele ms nach dem vorigen
export const SNAP_DELAY = 300; // ms nach dem Hüpfer beim Füttern: Dann schnappen die Fischfresser zu, naschen Pilz- und Moosfresser

/** Wer schnappt oder nascht nach welchem Futter: Fisch, Pilze, Wasser im Trog (frisches Tropfmoos an seinem Rand) */
const EATERS: Record<'fish' | 'pilze' | 'water', ReadonlySet<string>> = {
  fish: FISH_EATERS,
  pilze: SHROOM_EATERS,
  water: MOSS_EATERS,
};

/**
 * Schnappt dieses Wesen nach dem Futter (`food`): Fischfresser der Eis-Welt nach Fisch, Pilzfresser der Grotte nach
 * Pilzen, Moosfresser der Grotte nach dem Tropfmoos am Trog, wenn Wasser hineinkommt? Beeren: niemand extra
 */
export const snaps = (id: string, food: 'berries' | 'fish' | 'pilze' | 'water') =>
  food !== 'berries' && EATERS[food].has(speciesOf(id) ?? '');

export const NIBBLE_EVERY = 50; // Takte zwischen zwei Naschern eines Moosfressers (5 s), je Tier versetzt

/** Versatz je Kennung, damit nicht alle Moosfresser im selben Takt naschen */
const offsetOf = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % NIBBLE_EVERY, 7);

const NEAR = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy] as const));

/**
 * Moosfresser naschen selbst, ohne dass das Kind etwas tut: Zu Hause (auf der Mooswiese mit dem Tropfmoos am Steintrog)
 * und unterwegs neben Tropfmoos oder Tropfquelle macht jeder alle `NIBBLE_EVERY` Takte einen Schnapp-Hüpfer, je Tier
 * versetzt; nachts nicht, und nicht, wer kopfüber an einem Sitzplatz hängt. Liefert die Kennungen, die in diesem Takt
 * naschen (nur Bild: bei reduzierter Bewegung hüpft niemand).
 */
export function nibblers(
  s: { tick: number; sleeping: boolean; animals: readonly { id: string; x: number; y: number; mode: string }[] },
  cell: (x: number, y: number) => { deco: string | null; perch?: number | undefined },
): string[] {
  if (s.sleeping) return [];
  const mossy = (x: number, y: number) =>
    NEAR.some(([dx, dy]) => /^(dripmoss|dripspring|stonetrough)$/.test(cell(x + dx, y + dy).deco ?? ''));
  return s.animals
    .filter((a) => EATERS.water.has(speciesOf(a.id) ?? '') && (s.tick + offsetOf(a.id)) % NIBBLE_EVERY === 0)
    .filter((a) => a.mode === 'home' || (a.mode === 'wander' && cell(a.x, a.y).perch === undefined && mossy(a.x, a.y)))
    .map((a) => a.id);
}

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
 * (`moving`, 0 … 1), dazu der Hüpfer beim Singen (`sung` ms her; vor dem Zeitpunkt nichts) und der kurze Schnapp-Hüpfer
 * nach Futter oder beim Naschen (`snapped` ms her; vor dem Zeitpunkt nichts).
 */
export function hopOf(id: string, moving: number, sung: number, snapped = Infinity): number {
  const species = speciesOf(id);
  const stride = STRIDE[(species && SPECIES[species].gait) || 'schritt'];
  const snap = snapped >= 0 && snapped < SNAP_MS ? Math.sin((snapped / SNAP_MS) * Math.PI) * 0.16 : 0;
  return stride(moving) + (sung >= 0 && sung < SING_MS ? Math.sin((sung / SING_MS) * Math.PI) * 0.3 : 0) + snap;
}
