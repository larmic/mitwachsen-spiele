// Eiszapfen-Glockenspiel im Gletschertal – rein und deterministisch, im Welt-Paket der Eis-Welt: Am Fuß einer
// Eisklippe hängen fünf bis sieben Eiszapfen nebeneinander (`'icicle'`, begehbar), links der längste, rechts der
// kürzeste. Läuft die Figur auf einen Zapfen zu, klingt sein heller Glockenton (Ereignis `icicle` mit der Tonhöhe
// `note`, große tief, kleine hoch, alle in der Pentatonik: kein falscher Ton), und sie läuft ohne Halt weiter. Wer die
// Reihe entlangläuft, spielt eine kleine Melodie. Kein Spielstand, nichts geht kaputt. Gesetzt nach Kristallen, Wehen
// und Schneehaufen (mitwachsen-kessel.ts), nur auf blankem Schnee: alles andere im Tal bleibt, wo es war. Die Regel
// bekommt `step` als Teil von `pack.rules` (index.ts); Aussehen und Töne in mitwachsen-chime-look.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Ereignisse“, Regel 3d und „Gletscherkessel“)

import { hash } from '../../../../lib/games/rng';
import type { Cell } from '../../mitwachsen-cell';
import type { WorldRules } from '../../mitwachsen-pack-types';
import type { Wild } from './mitwachsen-frost';
import { key } from './mitwachsen-flood';

/** So viele Eiszapfen hängen höchstens bzw. mindestens in der Reihe (die Tonleiter hat sieben Töne) */
export const CHIME = { most: 7, least: 5 } as const;

/** Höchstens so hoch über dem Boden hängt die Eiskante mit den Zapfen (an einer höheren Klippe an der Wand) */
export const LIP = 1.6;
/** Höhe der Eiskante über dem Feld vor der Klippe `back` */
export const lipOf = (back: Cell, c: Cell) => Math.min(back.h - c.h, LIP);

/** Blanker Schnee im Tal: kein Ding darauf, keine Spur, keine Plattform, keine Wiese */
const bare = (c: Cell | undefined): c is Cell =>
  !!c && c.region === 'eis' && !c.solid && !c.deco && c.ground === 'snow' && !c.slide && !c.garden && !c.portal;

/**
 * Ein Feld am Fuß einer Klippe: blanker Schnee auf `wild` (nicht dort, wo das Tal frei bleibt), dahinter (im Norden,
 * so sieht man die Zapfen in beiden Ansichten vor der Wand) höher, aber kein Ding (fest nur die Eisklippe am Rand),
 * davor (im Süden) begehbarer Boden gleich hoch, von dem aus man herankommt
 */
function foot(map: ReadonlyMap<string, Cell>, inWild: ReadonlySet<string>, x: number, y: number): Cell | null {
  const c = map.get(key(x, y));
  if (!inWild.has(key(x, y)) || !bare(c)) return null;
  const back = map.get(key(x, y - 1));
  const front = map.get(key(x, y + 1));
  if (!back || back.h <= c.h || back.ground === 'water') return null;
  if (back.solid && back.region !== 'border') return null; // Festes nur als Eisklippe: kein Zapfen unter einer Tanne
  if (!front || front.region !== 'eis' || front.solid || front.ground === 'water' || front.h !== c.h) return null;
  return c;
}

/**
 * Wie gut eine Wand hinter einem Lauf ist, kleiner ist besser: 0 der Rand des Tals (die Eisklippe), 1 eine Hügelstufe,
 * die niemand hinaufsteigt (mindestens zwei höher), 2 eine niedrige Hügelstufe (eine höher; hinauf und herunter
 * lässt die Regel `bump` dort niemanden durch die Zapfen)
 */
export function wallOf(map: ReadonlyMap<string, Cell>, run: readonly (readonly [number, number])[]): number {
  const walls = run.map(([x, y]) => {
    const back = map.get(key(x, y - 1));
    const c = map.get(key(x, y));
    if (back?.region === 'border') return 0;
    return back && c && back.h - c.h >= 2 ? 1 : 2;
  });
  return Math.max(...walls);
}

/**
 * Die Reihe setzen: Unter allen Läufen von mindestens `CHIME.least` Klippenfüßen nebeneinander (gleiche Höhe, gleich
 * hohe Eiskante, von West nach Ost; so wird jeder Zapfen kürzer als der links daneben) einen auswählen, lieber am Rand
 * des Tals (dahinter die Eisklippe), dann an einer hohen, zuletzt an einer niedrigen Hügelstufe (`wallOf`; nur am Rand
 * oder an hohen Stufen fände gut ein Drittel der Täler keinen Lauf); ist er länger als `CHIME.most`, die Mitte. Jeder Zapfen
 * bekommt seine Tonhöhe `note`, von West (0, tief, lang) nach Ost. Findet sich kein Lauf, hängt im Tal kein
 * Glockenspiel. Liefert die Felder der Reihe.
 */
export function chimes(seed: number, wild: readonly Wild[], map: Map<string, Cell>): [number, number][] {
  const inWild = new Set(wild.map(({ x, y }) => key(x, y)));
  const runs: [number, number][][] = [];
  const lip = (x: number, y: number) => {
    const c = foot(map, inWild, x, y);
    return c ? `${c.h}:${lipOf(map.get(key(x, y - 1))!, c)}` : null; // `foot` hat die Klippe dahinter geprüft
  };
  for (const { x, y } of wild) {
    const at = lip(x, y);
    if (!at || lip(x - 1, y) === at) continue; // nur am Anfang eines Laufs beginnen
    const run: [number, number][] = [[x, y]];
    while (lip(x + run.length, y) === at) run.push([x + run.length, y]);
    if (run.length >= CHIME.least) runs.push(run);
  }
  if (!runs.length) return [];
  const tier = Math.min(...runs.map((run) => wallOf(map, run)));
  const pool = runs.filter((run) => wallOf(map, run) === tier);
  const roll = (run: readonly [number, number][]) => hash(seed, ...run[0]!, 77);
  const best = [...pool].sort((a, b) => roll(a) - roll(b))[0]!; // `pool` ist nicht leer
  const skip = Math.floor((best.length - Math.min(best.length, CHIME.most)) / 2);
  const row = best.slice(skip, skip + CHIME.most);
  row.forEach(([x, y], note) => map.set(key(x, y), { ...map.get(key(x, y))!, deco: 'icicle', note }));
  return row;
}

/**
 * Die Figur läuft auf einen Eiszapfen zu: Sein Ton klingt (`icicle`), und sie läuft weiter wie auf Schnee (false: der
 * Zug geht weiter, keine Begegnung, kein Halt). Geht der Schritt nicht (`walks`), klingt nichts, sie stößt sanft an wie
 * überall. Steht sie auf dem Feld eines Zapfens und drückt gegen die Wand dahinter, klingt er noch einmal statt des
 * Anstoßens, und sie bleibt stehen; ebenso kommt sie von oben nicht durch die Zapfen herunter (der Zapfen klingt, sie
 * bleibt oben): nie läuft jemand durch die Zapfen, auch an einer niedrigen Hügelstufe nicht. Wo sonst, geschieht nichts.
 */
const bump: WorldRules['bump'] = (s, c, x, y, events, { here, walks }) => {
  const { x: px, y: py } = s.player;
  if (here.deco === 'icicle' && here.note !== undefined && x === px && y === py - 1) {
    events.push({ type: 'icicle', x: px, y: py, note: here.note });
    return true;
  }
  if (c.deco !== 'icicle' || c.note === undefined || !walks) return false;
  events.push({ type: 'icicle', x, y, note: c.note });
  return x === px && y === py + 1; // von oben: sie bleibt, wo sie ist
};

export const rules: WorldRules = { bump };
