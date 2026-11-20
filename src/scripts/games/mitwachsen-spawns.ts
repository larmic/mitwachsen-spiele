// Wohnorte der Tiere einer Gegend – rein und deterministisch: Derselbe Seed ergibt dieselben Wohnorte.
// Die Welt reicht die erreichbaren Felder der Gegend (ohne Wiese) und ihr Bett herein; Wunschorte sind relativ zum Bett.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt“)

import { hash } from '../../lib/games/rng';
import { regionAnimalList, type Point, type Region, type RegionId } from '../../data/games/mitwachsen';

/**
 * Abstände der weiteren Tiere zueinander, von groß nach klein (ist kein Platz mehr frei, rücken sie enger), und wie weit
 * sie mindestens vom Bett wohnen (in Feldern, nach Chebyshev). Der Gletscherkessel ist viel kleiner als die Lichtung.
 */
const SPREAD: Record<RegionId, { gaps: readonly number[]; bed: number; salt: number }> = {
  lichtung: { gaps: [9, 5, 1], bed: 6, salt: 77 },
  eis: { gaps: [5, 3, 1], bed: 6, salt: 78 },
};

/**
 * Wohnorte der Tiere einer Gegend auf ihren erreichbaren Feldern (`land`). Das erste Tier jeder Art wohnt nah an seinem
 * Wunschort (relativ zum Bett), die weiteren verteilt der Seed über die ganze Gegend, mit Abstand zueinander und zum Bett.
 */
export function findSpawns(seed: number, region: Region, land: readonly Point[], bed: Point): Map<string, Point> {
  const { gaps, bed: fromBed, salt } = SPREAD[region.id];
  const spawns = new Map<string, Point>();
  const taken: Point[] = [];
  const free = (p: Point, gap: number) => taken.every(([x, y]) => (x - p[0]) ** 2 + (y - p[1]) ** 2 >= gap * gap);
  const all = regionAnimalList(region);
  for (const { id, species, n } of all) {
    if (n !== 1) continue;
    const want = region.animals.find((a) => a.species === species)?.at; // das Welt-Paket reicht die Wunschorte herein
    if (!want) continue;
    const at: Point = [bed[0] + want[0], bed[1] + want[1]];
    let best: Point | null = null,
      bestD = Infinity;
    for (const p of land) {
      const d = (p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2;
      if (d < bestD && free(p, 1)) [best, bestD] = [p, d];
    }
    if (!best) continue;
    taken.push(best);
    spawns.set(id, best);
  }
  // Die weiteren: Felder in einer Reihenfolge aus dem Seed, jedes mit Abstand zu allen anderen
  const shuffled = [...land].sort((a, b) => hash(seed, a[0], a[1], salt) - hash(seed, b[0], b[1], salt));
  const rest = all.filter((a) => a.n !== 1);
  for (const gap of gaps) {
    for (const p of shuffled) {
      if (!rest.length) break;
      const [dx, dy] = [p[0] - bed[0], p[1] - bed[1]]; // Abstand zum Bett
      if (Math.max(Math.abs(dx), Math.abs(dy)) < fromBed || !free(p, gap)) continue;
      const { id } = rest.shift()!;
      taken.push(p);
      spawns.set(id, p);
    }
  }
  return spawns;
}
