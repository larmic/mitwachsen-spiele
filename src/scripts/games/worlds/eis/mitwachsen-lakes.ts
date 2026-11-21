// Zugefrorene Seen mit Eislöchern und der Eisberg zum Erklettern im Gletschertal der Eis-Welt – rein und
// deterministisch. Teil des Welt-Pakets der Eis-Welt (mitwachsen-kessel.ts baut sie ein, mitwachsen-ice-sky.ts setzt
// die Fahne auf den Gipfel des Eisbergs), nachgeladen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Gletscherkessel“)

import { hash, rand01, valueNoise } from '../../../../lib/games/rng';
import type { Point } from '../../../../data/games/mitwachsen';
import { KESSEL, KESSEL_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell } from '../../mitwachsen-cell';

/** Glattes Eis im Tal auf Höhe `h` */
const ice = (h: number): Cell => ({ h, ground: 'ice', deco: null, region: 'eis', solid: false, biome: 'eis' });

/**
 * Zugefrorene Seen (`KESSEL.lakes`): glattes Eis auf Höhe 1, begehbar. Ihre Mitte rechnet vom Schneebett aus, die
 * großen hinten verschiebt der Seed bis `lakeJitter` Felder weit; den Rand wellt ein Rauschen (drei Viertel bis ganz
 * des Radius, mindestens bis zum Ufer des Eislochs). In der Mitte jedes Sees das Eisloch: dunkles Wasser (Höhe 0) mit
 * weißen Schollen (`'floe'`, `color` für die Karte; jedes Loch hat eine fest neben der Mitte, sonst trägt etwa jedes
 * fünfte Wasserfeld eine), ringsum `KESSEL.hole.shore` Felder ebenes Ufer aus Eis. Liefert das Feld eines Sees bei
 * (u, v), sonst null, und die Mitten der Eislöcher (in (u, v); `fromBed` rechnet Lagen vom Schneebett dorthin).
 */
export function lakes(seed: number, fromBed: (p: readonly [number, number]) => Point) {
  const { r: hr, shore } = KESSEL.hole;
  const j = KESSEL.lakeJitter;
  const shift = (i: number, k: number) => (i ? (hash(seed, i, k, 75) % (2 * j + 1)) - j : 0);
  const all = KESSEL.lakes.map(([a, o, r], i) => ({ hole: fromBed([a + shift(i, 0), o + shift(i, 1)]), r }));
  const at = (u: number, v: number): Cell | null => {
    for (const {
      hole: [a, b],
      r,
    } of all) {
      const d = Math.hypot(u - a, v - b);
      if (d <= hr) {
        const floe = rand01(seed, u, v, 77) < 0.2 || (u === a + 1 && v === b);
        return { ...ice(0), ground: 'water', ...(floe && { deco: 'floe', color: KESSEL_COLORS.floe[1] }) };
      }
      if (d <= hr + shore + 0.5 || d < r * (0.75 + 0.25 * valueNoise(seed + 76, u, v, 4))) return ice(1);
    }
    return null;
  };
  return { at, holes: all.map(({ hole }) => hole) };
}

/**
 * Eisberg (`KESSEL.berg`) am ersten großen See, hinter seinem Eisloch (`holes`, in (u, v) von der Mitte des Tals; er
 * wandert mit dem See): runde Stufen aus glattem Eis, von außen Höhe 2 bis oben `top` (je `step` Felder breit, Seiten in
 * `KESSEL_COLORS.berg`), oben ein ebener Gipfel. Benachbarte Felder liegen nie mehr als eine Stufe auseinander (eine
 * Stufe ist breiter als ein Feld), so klettert man ihn von jeder Seite Stufe für Stufe hinauf. Ringsum glattes Eis auf
 * Höhe 1 wie der See, von dort ein Steg aus Eis (drei Felder breit, Höhe 1) quer zur Mitte des Tals, bis `steg` Felder
 * neben die Achse. `at` liefert das Feld bei (u, v) (sonst null), `near` sagt, ob (u, v) höchstens `r` Felder von
 * Eisberg, Eis ringsum oder Steg liegt (dort bleibt das Tal frei), `peak` ist die Mitte des Gipfels in (u, v).
 */
export function iceberg(holes: readonly Point[]) {
  const { lake, out, top, plateau, step, girdle, steg } = KESSEL.berg;
  const [hu, hv] = holes[lake] ?? [0, 0]; // KESSEL.lakes hat diesen See
  const [bu, bv] = [hu, hv + out];
  const base = plateau + (top - 2) * step; // Rand der untersten Stufe (Höhe 2)
  const side = Math.sign(hu) || 1; // Seite des Tals, auf der er steht; der Steg führt von dort zur Mitte
  /** Auf dem Steg (bis `r` Felder daneben)? */
  const onSteg = (u: number, v: number, r: number) =>
    Math.abs(v - bv) <= 1 + r && u * side >= steg - r && u * side <= bu * side;
  const at = (u: number, v: number): Cell | null => {
    const d = Math.hypot(u - bu, v - bv);
    if (d <= base) return { ...ice(top - Math.max(0, Math.ceil((d - plateau) / step))), color: KESSEL_COLORS.berg };
    return d <= base + girdle || onSteg(u, v, 0) ? ice(1) : null;
  };
  const near = (u: number, v: number, r: number) => Math.hypot(u - bu, v - bv) <= base + girdle + r || onSteg(u, v, r);
  return { at, near, peak: [bu, bv] as Point };
}
export type Iceberg = ReturnType<typeof iceberg>;

/**
 * Mitte des Gipfels je Seed (Lage in der Welt), eingetragen, sobald `buildKessel` das Tal baut; daraus liest das Bild
 * die Fahne (`bergPeak` in mitwachsen-ice-sky.ts), ohne den Kessel abzusuchen
 */
export const peaks = new Map<number, Point>();
