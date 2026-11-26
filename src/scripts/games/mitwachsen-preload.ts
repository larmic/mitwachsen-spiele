// Vorladen am Halt (`RIDE_PRELOAD`, Konzept „Reisewege“ und „Gleisbauer und Höhlen-Welt“, Schritt 5) – rein, ohne DOM:
// Steht die Figur höchstens `RIDE_PRELOAD` Felder vor einem Halt eines Fahrzeugs, holt die Spielseite die Pakete, die es
// zum Fahren braucht: die Fahr-Engine (worlds/fahrt/) und die Welten seiner Ziel-Gegenden (`Vehicle.needs`; der Zug: die
// Grotte, schon ab Ausbau 1, damit sie zu Bau 2 da ist). Das Paket des Fahrzeugs selbst ist dann schon da, sonst gäbe es
// weder Halt noch Fahrzeug. Fehlt noch eines, das es für die nächste Fahrt braucht (es lädt, oder das Laden scheiterte;
// `Vehicle.reaches`), schläft das Fahrzeug freundlich am Halt (`dozingOf`): keine goldene Tür, nichts
// grau oder zu, es schnarcht, und es fährt nicht los, bis alles da ist; eine begonnene Fahrt endet immer am Ziel.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Tok und die Bahn“, Vorladen am Halt)

import { RIDE_PRELOAD, type RideId } from '../../data/games/mitwachsen-rides';
import type { PackId } from './mitwachsen-pack-types';
import { workOf, type Work } from './mitwachsen-herald';
import { vehiclesOf, type Rider, type RideEngine, type RideRoute, type Vehicle } from './mitwachsen-rider';
import type { World } from './mitwachsen-world';

/** Was die Haken der Pakete dafür hergeben: das Fahrzeug eines Pakets und die Fahr-Engine (Paket der Fahrzeuge) */
type Hooked = { rules?: { vehicle?: Vehicle; more?: readonly Vehicle[]; ride?: RideEngine } };

/**
 * Fahrzeuge, die schlafen: Es fehlt die Fahr-Engine oder die Welt einer Gegend, die es braucht (`Vehicle.needs`; ohne
 * Paket hat sie keine Wohnplätze, wie bei `holds` in mitwachsen-pack.ts), aber nur, wenn es beim jetzigen Stand schon
 * dorthin fährt (`Vehicle.reaches`; der Zug erst ab Ausbau 2: Die erste Fahrt bis zum Prellbock wartet nie auf die
 * Grotte). Solange ein Bote baut (`work`, Tok: Bau 1), schläft nichts: Der Zug rollt mit Dampf und Licht heran
 */
export function dozingOf(
  packs: readonly Hooked[],
  world: Pick<World, 'spotsOf'>,
  s: Pick<Rider, 'packs'> & { tick: number; work?: Work },
): RideId[] {
  if (workOf(s) !== undefined) return [];
  const engine = packs.some((p) => p.rules?.ride);
  const missing = (v: Vehicle) =>
    (v.reaches?.(s) ?? true) && (v.needs ?? []).some((r) => r !== 'lichtung' && !world.spotsOf(r).length);
  return vehiclesOf(packs)
    .filter((v) => !engine || missing(v))
    .map((v) => v.spec.id);
}

/** Alle Felder, an denen ein Fahrzeug hält: beide Sitze und, mit Wagen, deren Felder an beiden Halten */
const haltCells = (r: RideRoute) => [r.stops.home, r.stops.out, ...(r.cars?.home ?? []), ...(r.cars?.out ?? [])];

/**
 * Pakete, die vorgeladen werden sollen: Steht ein Ort aus `at` (die Figur, solange ein Paket fehlt auch ihre gehaltene
 * Position) höchstens `RIDE_PRELOAD` Felder (Schachbrett) vor einem Halt eines Fahrzeugs der geladenen Pakete, die
 * Fahr-Engine und die Pakete der Gegenden, die es braucht (`Vehicle.needs`). Ohne Strecke (der Zug vor Bau 1) nichts
 */
export function preloadOf(
  packs: readonly Hooked[],
  world: World,
  s: Pick<Rider, 'packs' | 'openGates'>,
  at: readonly (readonly [number, number] | undefined)[],
): PackId[] {
  const out = new Set<PackId>();
  for (const v of vehiclesOf(packs)) {
    const r = v.route(world, s);
    if (!r) continue;
    const cells = haltCells(r);
    const near = (p: readonly [number, number] | undefined) =>
      !!p && cells.some(([x, y]) => Math.max(Math.abs(x - p[0]), Math.abs(y - p[1])) <= RIDE_PRELOAD);
    if (!at.some(near)) continue;
    out.add('fahrt');
    for (const region of v.needs ?? []) if (region !== 'lichtung') out.add(region);
  }
  return [...out];
}
