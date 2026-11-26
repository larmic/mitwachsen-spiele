// Die Schneeraupe, die Rundfahrt der Eis-Welt (Issue 54) – rein, ohne DOM: was die Fahr-Engine (Paket der Fahrzeuge,
// worlds/fahrt/) über sie wissen muss (`cat`, `WorldRules.more` aus dem Welt-Paket der Eis-Welt). Sie fährt eine
// Schleife (`RideSpec.loop`, wie Funkel in der Grotte): vom Halt nah am Schneebett einmal um das Tal und wieder an den
// Halt, eine Runde ohne Wahl. Sie steht ab dem zweiten Besuch der Eis-Welt an ihrem Halt: Der erste Besuch und das
// Verlassen werden im Zustand der Eis-Welt gemerkt (`packs.eis.gast`), beim nächsten Betreten ist sie da (Stufe
// `bereit`, ohne Herbeitraben: Sie steht einfach dort). Ohne Runde im Tal (mitwachsen-loop.ts) gibt es sie nicht.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Schneeraupe“)

import type { Point } from '../../../../data/games/mitwachsen';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import type { WorldRules } from '../../mitwachsen-pack-types';
import { stageOf, withRidden, withRide } from '../../mitwachsen-ride-save';
import type { RideRoute, Vehicle } from '../../mitwachsen-rider';
import type { World } from '../../mitwachsen-world';
import { key } from './mitwachsen-flood';
import { CAT, loopOf } from './mitwachsen-loop';

/** Die Schneeraupe in `RIDES` */
export const CAT_SPEC = RIDES.find((r) => r.id === CAT)!;
/** So viele Warteplätze am Halt für folgende Tiere */
const WAIT = 8;

/** Felder neben dem Halt `seat`, auf denen man steht und die nicht Runde sind, die nächsten zuerst */
function beside(world: World, [sx, sy]: Point): Point[] {
  const out: { p: Point; d: number }[] = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const c = world.cell(sx + dx, sy + dy);
      if ((dx || dy) && !c.solid && !c.ride && !c.deco && c.ground === 'snow' && c.region === 'eis')
        out.push({ p: [sx + dx, sy + dy], d: Math.hypot(dx, dy) });
    }
  return out.sort((a, b) => a.d - b.d).map((o) => o.p);
}

const routes = new WeakMap<World, RideRoute | null>();
/**
 * Strecke der Schneeraupe: die Runde des Tals vom Halt einmal herum zurück zum Halt (`RideRoute.loop`), ohne Zugtier
 * (`solo`); undefined ohne Runde. Je Welt einmal
 */
export function catRoute(world: World): RideRoute | undefined {
  if (!routes.has(world)) {
    const loop = loopOf(world);
    const seat = loop[0];
    const seats = seat ? beside(world, seat).slice(0, WAIT) : [];
    routes.set(
      world,
      seat
        ? {
            path: [...loop, seat],
            stops: { home: seat, out: seat },
            shed: [],
            seats: { home: seats, out: seats },
            on: new Set(loop.map((p) => key(...p))),
            loop: true,
            solo: true,
          }
        : null,
    );
  }
  return routes.get(world) ?? undefined;
}

/** Wo die Figur neben dem Halt aussteigt: die Felder daneben, die nächsten zuerst */
const exit = (world: World): Point[] => {
  const r = catRoute(world);
  return r ? beside(world, r.stops.home) : [];
};

/** Die Schneeraupe für die Fahr-Engine: Eintrag, Runde, Aussteigen neben dem Halt, nach der ersten Fahrt gemerkt */
export const cat: Vehicle = {
  spec: CAT_SPEC,
  route: catRoute,
  exit: (_, world) => exit(world),
  landed(s) {
    s.packs = withRidden(s.packs, CAT);
  },
};

/** Besuche der Eis-Welt: 0 nie, 1 gerade zum ersten Mal drin, 2 danach wieder draußen gewesen (`packs.eis.gast`) */
export const visitsOf = (packs: Readonly<Record<string, unknown>>): number => {
  const n = (packs.eis as { gast?: unknown } | null | undefined)?.gast;
  return n === 1 || n === 2 ? n : 0;
};

/**
 * Besuche zählen (`WorldRules.bump`, bei jedem Schritt, nie ein Halt): Betritt die Figur den Schnee des Tals zum ersten
 * Mal, ist das der erste Besuch; verlässt sie ihn danach (ein Schritt in den Gang), zählt der nächste Schritt hinein
 * als zweiter: Dann steht die Schneeraupe an ihrem Halt (Stufe `bereit`). Gemerkt im Zustand der Pakete, gespeichert
 * mit dem nächsten Speichern
 */
export const visit: WorldRules['bump'] = (s, c, _x, _y, _events, { walks }) => {
  if (!walks) return false;
  const inside = c.region === 'eis';
  const n = visitsOf(s.packs);
  const eis = typeof s.packs.eis === 'object' && s.packs.eis !== null ? s.packs.eis : { v: 1, snow: {} };
  if (inside && n === 0) s.packs = { ...s.packs, eis: { ...eis, gast: 1 } };
  else if (!inside && n === 1) s.packs = { ...s.packs, eis: { ...eis, gast: 2 } };
  else if (inside && n === 2 && !stageOf(s.packs, CAT)) s.packs = withRide(s.packs, CAT, 'bereit');
  return false;
};
