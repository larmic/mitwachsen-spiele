// Wiese und Unterstand je Gegend – rein, ohne DOM: wo ein Tier zu Hause ist, welche Plätze die Wiese hat und wohin die
// Tiere der Wiese bei Regen (Riesenpilz der Lichtung) bzw. Pustewind (Iglu der Eis-Welt) gehen. Teil der Regeln
// (mitwachsen-state.ts); jede Gegend rechnet mit ihrem eigenen Zuhause.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Wetter und Unterstand“)

import { chunkOf } from '../../lib/games/chunks';
import { DIRS, type Dir } from '../../lib/games/front';
import { cycle, hash } from '../../lib/games/rng';
import { REGIONS, animalId, type GateId, type RegionId, type SpeciesId } from '../../data/games/mitwachsen';
import { perRealm } from './mitwachsen-home';
import { platformArea, withNeighbours } from './mitwachsen-portal';
import { canStep, standHeight, type World } from './mitwachsen-world';

/** Zuhause eines Tiers: seine Gegend, ein Stück der Landschaft (Tiere der Landschaft) oder die Wiese am Bett */
export type Home = { kind: 'region'; region: RegionId } | { kind: 'wild'; cx: number; cy: number } | { kind: 'garden' };

export const PENGUIN = animalId('eis', 'pinguin');
/**
 * Pustewind gibt es erst, wenn der Pinguin auf der Schneewiese wohnt, und nicht mehr an dem Tag, an dem er einzieht
 * (`calm`): So stört nichts seine Ankunft, und der Wind kommt nie mitten im Abschnitt, erst nach dem nächsten Schlafen.
 */
export const windOk = (s: { garden: readonly { id: string }[]; day: number; calm: number }) =>
  s.calm !== s.day && s.garden.some((p) => p.id === PENGUIN);

/** Felder an Durchgängen (Tore, Rosenbogen): Dort bleibt kein Tier stehen, sonst versperrt es den Weg */
const passageCache = new WeakMap<World, Set<string>>();
export function passages(world: World): Set<string> {
  let set = passageCache.get(world);
  if (!set) {
    set = new Set([
      ...platformArea(world.portals),
      ...withNeighbours([...world.gates.values()].flatMap((g) => g.cells)),
    ]);
    passageCache.set(world, set);
  }
  return set;
}

/** Gehört ein Feld zum Zuhause eines Tiers? (Durchgänge nie) */
export function atHome(world: World, home: Home, x: number, y: number): boolean {
  const c = world.cell(x, y);
  if (home.kind === 'garden') return c.garden === true && !passages(world).has(`${x},${y}`);
  if (c.garden || passages(world).has(`${x},${y}`)) return false;
  if (home.kind === 'region') return c.region === home.region;
  const [cx, cy] = chunkOf(x, y);
  return c.region === 'wild' && cx === home.cx && cy === home.cy;
}

/** Freie Plätze auf der Wiese ums Bett einer Gegend, gut verteilt (benachbarte Plätze stehen in der Liste weit auseinander) */
export const meadowSpots = perRealm((world: World, realm): [number, number][] => {
  const { bed, meadow } = world.homes[realm];
  const out: [number, number][] = [];
  const r = meadow + 1;
  for (let y = bed[1] - r; y <= bed[1] + r; y++)
    for (let x = bed[0] - r; x <= bed[0] + r; x++)
      if (
        world.realm(x, y) === realm &&
        atHome(world, { kind: 'garden' }, x, y) &&
        standHeight(world, [], x, y) !== null
      )
        out.push([x, y]);
  return out.sort((a, b) => hash(7, a[0], a[1]) - hash(7, b[0], b[1]));
});

/**
 * Plätze bei Regen bzw. Pustewind: erst die Felder unter dem Unterstand der Gegend, vorn zuerst (dort sieht man die
 * Tiere unter dem Dach), dann die nächsten Felder ihrer Wiese; in der Eis-Welt dicht an der windgeschützten Seite des
 * Iglus (`lee`).
 */
export const shelterSpots = perRealm((world: World, realm): [number, number][] => {
  const { shelter, lee } = world.homes[realm];
  const { x0, y0, x1, y1 } = shelter;
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const [lx, ly] = lee ?? [cx, cy];
  // Im Windschatten zählt die Seite: Bei gleichem Abstand zum `lee` geht ein Platz rechts neben dem Iglu vor einem
  // Platz vor seiner Front (sonst entschiede der Zufall der Wiese, und ein Tier stünde vorn im Wind)
  const exposed = (p: [number, number]) => (lee && p[0] < x1 ? 0.5 : 0);
  const near = (p: [number, number]) =>
    world.cell(p[0], p[1]).roof
      ? (y1 - p[1]) * 10 + Math.abs(p[0] - cx)
      : 1000 + Math.hypot(p[0] - lx, p[1] - ly) + exposed(p);
  return [...meadowSpots(world, realm)].sort((a, b) => near(a) - near(b));
});

type Sheltering = { id: string; species: SpeciesId; mode: string; realm: RegionId };

/**
 * Wohin die Tiere der Wiesen gerade Schutz suchen (Kennung → Platz), je Gegend nach ihrem eigenen Wetter (`storm`):
 * jedes an einen eigenen Platz unter dem Unterstand oder dicht daneben, in der Reihenfolge der Tiere. Im Iglu
 * (`huddle`) stehen die Tiere einer Art beieinander: Die Pinguine kuscheln, die Moschusochsen stehen dicht.
 */
export function shelterPlaces(
  world: World,
  animals: readonly Sheltering[],
  storm: (realm: RegionId) => boolean,
): Map<string, [number, number]> {
  const byRealm = new Map<RegionId, Sheltering[]>();
  const stormy = new Map<RegionId, boolean>();
  for (const a of animals) {
    if (a.mode !== 'home') continue;
    if (!stormy.has(a.realm)) stormy.set(a.realm, storm(a.realm));
    if (stormy.get(a.realm)) byRealm.set(a.realm, [...(byRealm.get(a.realm) ?? []), a]);
  }
  const out = new Map<string, [number, number]>();
  for (const [realm, list] of byRealm) {
    const kinds = REGIONS.find((r) => r.id === realm)?.animals.map((a) => a.species) ?? [];
    const order = world.homes[realm].huddle
      ? [...list].sort((a, b) => kinds.indexOf(a.species) - kinds.indexOf(b.species))
      : list;
    order.forEach((a, i) => out.set(a.id, cycle(shelterSpots(world, realm), i)));
  }
  return out;
}

type Walker = { id: string; x: number; y: number; dir: Dir; realm: RegionId };

/**
 * Pustewind (Unterstand mit `huddle`, das Iglu): Sitzt auf dem nächsten Feld zum eigenen Platz schon ein Tier auf
 * seinem Platz, tauschen beide; das andere rückt gleich wieder an seinen Platz. Liefert true, wenn getauscht wurde
 * (ohne Richtung `d` nie).
 */
export function slipPast(
  s: { openGates: readonly GateId[]; animals: Walker[] },
  world: World,
  a: Walker,
  d: Dir | undefined,
  places: Map<string, [number, number]>,
): boolean {
  if (!d || !world.homes[a.realm].huddle) return false;
  const [tx, ty] = [a.x + DIRS[d][0], a.y + DIRS[d][1]];
  const other = s.animals.find((o) => o.x === tx && o.y === ty);
  const its = other && places.get(other.id);
  if (!other || its?.[0] !== tx || its[1] !== ty) return false;
  if (!canStep(world, s.openGates, a.x, a.y, tx, ty) || !canStep(world, s.openGates, tx, ty, a.x, a.y)) return false;
  [other.x, other.y, a.x, a.y] = [a.x, a.y, tx, ty];
  a.dir = d;
  return true;
}
