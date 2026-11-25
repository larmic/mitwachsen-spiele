// Paket der Grubenbahn: einziger Einstieg (`import('./worlds/grube')`). Das Grubenbähnchen Funkel ist das zweite
// Fahrzeug der Höhlenwelt (Ausnahme „ein zweites Fahrzeug nur innerhalb einer Welt“): Es fährt eine Schleife in der
// Kristallgrotte und verlässt sie nie. Das Paket hat keine eigene Welt; es legt sein schmales Gleis in die Schleife, die
// die Grotte freihält (`lay`, mitwachsen-funkel.ts; erst, wenn der Gang gegraben ist, `packs.fahrt.grube`; vorher baut
// sein Ankommen die Welt nicht neu, `lays`), und bringt
// das Bähnchen für die Fahr-Engine (`rules.vehicle`; die Fahrregeln bringt das Paket der Fahrzeuge, worlds/fahrt/), dazu
// sein Bild und seine Töne für 2D und 3D (mitwachsen-funkel-look.ts; Modell in
// src/data/games/worlds/grube/mitwachsen-funkel-model.ts). Ein 3D-Teil mit Three.js ist nicht nötig: Gleis und Körper
// sind Quader wie in 2D, darum kommt `view3d` aus derselben Datei. Geladen wird es mit der Grotte (`ALONG` in
// mitwachsen-packs.ts); der Entwickler-Schalter spielt den gegrabenen Gang vor (`/spielen/?entwickler=grube`,
// mitwachsen-dev.ts). Nichts außerhalb dieses Ordners importiert statisch von hier (geprüft durch `npm run arch`): im
// Build `_astro/welt-grube.<hash>.js` mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Die Grubenbahn Funkel“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { HeraldRules } from '../../mitwachsen-herald';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideEngine, Vehicle } from '../../mitwachsen-rider';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { dug, funkel, layGrube } from './mitwachsen-funkel';
import { funkelBodies, funkelFx, grubeRails } from './mitwachsen-funkel-look';

const view: View2D = { decos: {}, ground: () => null, rails: grubeRails, bodies: funkelBodies, rideFx: funkelFx };
const view3d: View3D = { decos: {}, ground: () => null, rails: grubeRails };

export const pack: WorldPack<GuideRules, View2D, View3D, RideEngine, HeraldRules, Vehicle> = {
  id: 'grube',
  lay: layGrube,
  lays: dug, // vor dem Graben kein Neubau, wenn das Paket mit der Grotte ankommt
  rules: { bump: () => false, vehicle: funkel },
  view,
  view3d: () => Promise.resolve(view3d),
};
