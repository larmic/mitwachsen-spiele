// Der Rodelberg im Gletschertal (Issue 50) – rein und deterministisch: ein Stufenberg aus Schnee nah am Schneebett, je
// Ring eine Stufe tiefer, von allen Seiten zu ersteigen (keine Stufe höher als eins, wie überall im Tal). Die Kamera
// schaut von Süden: Die Treppe liegt darum an der Westflanke auf dem Grat (zwei Felder breit), die Bahn an der Südseite
// (drei Kehren, dann der Auslauf nach Süden); so verdeckt der Berg die Figur nie. Sein Platz wird je Tal gesucht, nach
// allem Gewürfelten (mitwachsen-kessel.ts): Nur Tannen, Eisblöcke und Schneewehen weichen, nie ein Schneehaufen, ein
// Kristall, eine Fischkiste, ein Eiszapfen, die Strecke des Schlittens, die Rutschspur oder was das Tal frei hält. Findet
// sich kein Platz, gibt es keinen Berg (dann auch keinen Rodelreifen). Der Gipfel trägt `Cell.stop` `'rodel'` (daran
// findet das Fahrzeug ihn wieder, `hillOf`), die Bahn `Cell.ride` `'rodel'`, die Treppe die Deko-Art `'hillstep'`.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Rodelberg“)

import type { Point } from '../../../../data/games/mitwachsen';
import { HILL } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell } from '../../mitwachsen-cell';
import type { World } from '../../mitwachsen-world';
import { key } from './mitwachsen-flood';
import { blocked, cleared } from './mitwachsen-sled-ground';

/** Kennung des Rodelreifens (`RIDES`) */
export const TUBE = 'rodel';
const { top: TOP, rings: RINGS, runout: RUNOUT, keep: KEEP } = HILL;

/** Treppe an der Westflanke, vom Fuß zum Gipfel, je Stufe zwei Felder (vom Gipfel aus gemessen) */
const STAIRS: readonly Point[] = Array.from({ length: RINGS }, (_, i): Point[] => [
  [i - RINGS, 0],
  [i - RINGS, 1],
]).flat();
/**
 * Die Bahn vom Gipfel aus: zwei Felder hinab, Kehre nach Osten auf Ring 2, hinab, Kehre nach Westen auf Ring 4, hinab,
 * unten nach Osten auf Ring 6, dann der Auslauf nach Süden. Jedes Feld grenzt an das nächste
 */
const RUN: readonly Point[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [2, 3],
  [2, 4],
  ...[1, 0, -1, -2, -3].map((dx): Point => [dx, 4]),
  [-3, 5],
  [-3, 6],
  ...[-2, -1, 0, 1, 2, 3].map((dx): Point => [dx, 6]),
  ...Array.from({ length: RUNOUT }, (_, i): Point => [3, RINGS + 1 + i]),
];
/** Warteplätze der Tiere unten am Ziel, beiderseits des Auslaufs, die nächsten zum Ende zuerst */
const FOOT: readonly Point[] = [0, 1, 2, 3].flatMap((i): Point[] => [
  [4, RINGS + RUNOUT - i],
  [2, RINGS + RUNOUT - i],
]);

/** Der Rodelberg einer Welt: Gipfel, Treppe (vom Fuß hinauf), Bahn (vom Gipfel bis ans Ende des Auslaufs), Warteplätze */
export type Hill = { top: Point; stairs: readonly Point[]; run: readonly Point[]; foot: readonly Point[] };
const at = ([tx, ty]: Point, offsets: readonly Point[]) => offsets.map(([dx, dy]): Point => [tx + dx, ty + dy]);
const hill = (top: Point): Hill => ({ top, stairs: at(top, STAIRS), run: at(top, RUN), foot: at(top, FOOT) });

/** Höhe des Bergs über einem Feld `d` Ringe vom Gipfel (Schachbrett); 0: nicht mehr Berg */
const rise = (d: number) => (d > RINGS ? 0 : TOP - d);
/** Felder des Bergs und des Auslaufs samt `more` Feldern Rand, vom Gipfel aus */
function footprint(more: number): Point[] {
  const out: Point[] = [];
  const r = RINGS + more;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.push([dx, dy]);
  for (let dy = r + 1; dy <= RINGS + RUNOUT + more; dy++)
    for (let dx = 2 - more; dx <= 4 + more; dx++) out.push([dx, dy]);
  return out;
}
const BODY = footprint(1);
const AROUND = footprint(KEEP);

/** Was nie weicht und Abstand braucht */
const kept = (c: Cell | undefined) =>
  !!c && (c.deco === 'snowheap' || c.deco === 'crystal' || c.deco === 'fishcrate' || c.deco === 'icicle');
/** Darf hier Berg oder Auslauf liegen? Blanker Schnee des Tals, höchstens mit Tanne, Eisblock oder Schneewehe */
const free = (c: Cell | undefined) =>
  !!c &&
  c.region === 'eis' &&
  !c.slide &&
  !c.garden &&
  !c.portal &&
  !c.ride &&
  !c.stop &&
  (blocked(c) || (c.ground === 'snow' && !c.solid && (!c.deco || c.deco === 'snowdrift')));

/**
 * Den Rodelberg in die Karte bauen (`map`, das fertige Tal nach Strecke und Platz des Schlittens): Sein Gipfel liegt auf
 * einem der Felder `wild` (wo das Tal nichts frei hält), `HILL.near` Felder vom Schneebett `bed`; `shut` bleibt frei
 * (Strecke und Platz des Schlittens). Von allen Plätzen, an denen nichts Geschütztes weichen muss, der, an dem am
 * wenigsten Tannen und Eisblöcke weichen, dann der nächste zum Bett. Liefert die Felder, auf denen kein Tier wohnt
 * (Berg, Auslauf, Warteplätze); leer, wenn kein Platz da ist (dann bleibt alles, wie es war)
 */
export function buildHill(
  bed: Point,
  wild: readonly { x: number; y: number }[],
  map: Map<string, Cell>,
  shut: ReadonlySet<string>,
): ReadonlySet<string> {
  const open = new Set(wild.map(({ x, y }) => key(x, y)));
  const cost = (x: number, y: number): number | undefined => {
    const far = Math.hypot(x - bed[0], y - bed[1]);
    if (far < HILL.near[0] || far > HILL.near[1]) return undefined;
    let gone = 0;
    for (const [dx, dy] of BODY) {
      const k = key(x + dx, y + dy);
      const c = map.get(k);
      if (!open.has(k) || shut.has(k) || !free(c)) return undefined;
      if (blocked(c!)) gone++;
    }
    for (const [dx, dy] of AROUND) if (kept(map.get(key(x + dx, y + dy)))) return undefined;
    return gone * 4 + far;
  };
  let best: { top: Point; cost: number } | undefined;
  for (const { x, y } of wild) {
    const c = cost(x, y);
    if (c !== undefined && (!best || c < best.cost)) best = { top: [x, y], cost: c };
  }
  if (!best) return new Set();
  const [tx, ty] = best.top;
  // Berg und Auslauf: Tannen, Eisblöcke und Schneewehen weichen; der Berg hebt den Schnee, nie senkt er ihn
  for (const [dx, dy] of BODY) {
    const k = key(tx + dx, ty + dy);
    const was = map.get(k)!; // `cost` hat jedes Feld geprüft
    // weicht eine Tanne, weichen auch ihre Schneewehen im Lee (rechts daneben), auch knapp außerhalb des Bergs
    if (was.tree === 'snowpine')
      for (const lee of [1, 2]) {
        const [n, kn] = [map.get(key(tx + dx + lee, ty + dy)), key(tx + dx + lee, ty + dy)];
        if (n?.deco === 'snowdrift') map.set(kn, { ...n, deco: null });
      }
    const c = cleared(was);
    const h = Math.max(c.h, rise(Math.max(Math.abs(dx), Math.abs(dy))));
    map.set(k, { ...c, h, deco: null, solid: false, tree: undefined });
  }
  const put = (p: Point, more: Partial<Cell>) => map.set(key(...p), { ...map.get(key(...p))!, ...more });
  const built = hill(best.top);
  // die Bahn führt nie bergauf: Jedes Feld liegt höchstens so hoch wie das davor (der Auslauf schneidet durch Hügel)
  built.run.forEach((p, i) => {
    const before = built.run[i - 1];
    if (before) put(p, { h: Math.min(map.get(key(...p))!.h, map.get(key(...before))!.h) });
  });
  settle(at(best.top, AROUND), map);
  for (const p of built.run) put(p, { ride: TUBE });
  for (const p of built.stairs) put(p, { deco: 'hillstep' });
  put(best.top, { stop: TUBE });
  return new Set([...at(best.top, BODY), ...built.foot].map((p) => key(...p)));
}

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
/**
 * Keine Stufe höher als eins rings um den Einschnitt der Bahn (wie `level` in mitwachsen-kessel.ts, nur hier): Schnee
 * auf den Feldern `cells` sinkt auf Nachbar + 1, bis nichts mehr sinkt; gehoben wird nie, Festes und Wasser bleiben
 */
function settle(cells: readonly Point[], map: Map<string, Cell>) {
  const land = (c: Cell | undefined): c is Cell => !!c && !c.solid && c.ground !== 'water' && c.region === 'eis';
  for (let sunk = true; sunk;) {
    sunk = false;
    for (const [x, y] of cells) {
      const c = map.get(key(x, y));
      if (!land(c)) continue;
      const low = Math.min(
        ...SIDES.map(([dx, dy]) => map.get(key(x + dx, y + dy)))
          .filter(land)
          .map((n) => n.h + 1),
      );
      if (low < c.h) {
        map.set(key(x, y), { ...c, h: low });
        sunk = true;
      }
    }
  }
}

const hills = new WeakMap<World, Hill | null>();
/** Gipfel des Rodelbergs einer Welt: das Feld mit `Cell.stop` `'rodel'` rings um das Schneebett */
function topOf(world: World): Point | undefined {
  if (!world.spotsOf('eis').length) return undefined;
  const [bx, by] = world.homes.eis.bed;
  const r = HILL.near[1] + 1;
  for (let y = by - r; y <= by + r; y++)
    for (let x = bx - r; x <= bx + r; x++) if (world.cell(x, y).stop === TUBE) return [x, y];
  return undefined;
}
/** Der Rodelberg einer Welt (aus ihrem Gipfel, `Cell.stop`), je Welt einmal gesucht; undefined ohne Eis-Welt oder ohne Berg */
export function hillOf(world: World): Hill | undefined {
  let found = hills.get(world);
  if (found === undefined) {
    const top = topOf(world);
    hills.set(world, (found = top ? hill(top) : null));
  }
  return found ?? undefined;
}
