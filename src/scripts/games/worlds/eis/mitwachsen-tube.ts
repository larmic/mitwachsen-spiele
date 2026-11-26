// Der Rodelreifen am Rodelberg (Issue 50) – rein, ohne DOM: was die Fahr-Engine (Paket der Fahrzeuge, worlds/fahrt/) über
// ihn wissen muss (`tube`, `WorldRules.more` aus dem Welt-Paket der Eis-Welt). Er fährt nur bergab (`RideSpec.slide`):
// Er steht immer oben auf dem Gipfel, vom ersten Besuch an und ohne Eintrag im Spielstand; wer hineinläuft oder ihn
// antippt, steigt ein, 2 s später geht es die Bahn hinab bis ans Ende des Auslaufs, dort steigt die Figur aus, und der
// Reifen steht wieder oben (im Bild wird er hochgezogen, mitwachsen-tube-look.ts). Gelenkt wird nie. Folgende Tiere
// fahren nie mit: Sie warten unten am Ziel. Nach der ersten Abfahrt merkt der Spielstand sie (`offen`: Dann lockt der
// Berg nicht mehr).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Rodelberg“)

import { RIDES } from '../../../../data/games/mitwachsen-rides';
import { stageOf, withRide } from '../../mitwachsen-ride-save';
import type { RideRoute, Vehicle } from '../../mitwachsen-rider';
import type { World } from '../../mitwachsen-world';
import { key } from './mitwachsen-flood';
import { TUBE, hillOf } from './mitwachsen-hill';

/** Der Rodelreifen in `RIDES` */
export const TUBE_SPEC = RIDES.find((r) => r.id === TUBE)!;

const routes = new WeakMap<World, RideRoute | null>();
/** Strecke des Rodelreifens: die Bahn vom Gipfel bis ans Ende des Auslaufs; undefined ohne Rodelberg. Je Welt einmal */
export function tubeRoute(world: World): RideRoute | undefined {
  if (!routes.has(world)) {
    const h = hillOf(world);
    routes.set(
      world,
      h
        ? {
            path: h.run,
            stops: { home: h.run[0]!, out: h.run.at(-1)! },
            shed: [],
            seats: { home: h.foot, out: h.foot }, // die Tiere warten unten
            on: new Set(h.run.map((p) => key(...p))),
            solo: true,
          }
        : null,
    );
  }
  return routes.get(world) ?? undefined;
}

/** Der Rodelreifen für die Fahr-Engine: Eintrag, Strecke; nach der ersten Abfahrt gemerkt (gespeichert) */
export const tube: Vehicle = {
  spec: TUBE_SPEC,
  route: tubeRoute,
  landed(s) {
    if (!stageOf(s.packs, TUBE)) s.packs = withRide(s.packs, TUBE, 'offen');
  },
};
