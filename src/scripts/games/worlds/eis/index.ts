// Welt-Paket der Eis-Welt: einziger Einstieg (`import('./worlds/eis')`). Alles, was nur die Eis-Welt braucht, kommt
// von hier: der Gletscherkessel hinter dem Eistor (Gelände, Zuhause, Wohnorte der Eis-Tiere, Eis-Portal), die Regeln
// des verlaufenen Pinguins, der zum Eistor führt und es öffnet, und die Zeichenteile der 2D-Ansicht (Iglu, Fischkisten,
// Rutschspur, Wetter, Bild der Weltgrenze) samt den Modellen der zehn Eis-Tiere. Geladen wird es erst, wenn sein Tor
// eine Rolle spielt (`needsPack`). Nichts außerhalb dieses Ordners importiert statisch von hier (geprüft durch
// `npm run arch`), so bleibt es ein eigenes Paket, das der Browser nachlädt: im Build `_astro/welt-eis.<hash>.js` (Name
// aus astro.config.mjs), gemessen mit eigener Grenze (scripts/verify-bundles.ts). Sein 3D-Teil (view-3d.ts: Iglu,
// Fischkisten, Kessel, Tür und Eiszapfen des Eistors) braucht Three.js und kommt erst, wenn die 3D-Ansicht ihn will
// (`view3d`): `_astro/welt-eis-3d.<hash>.js`, ebenfalls mit eigener Grenze.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { buildKessel, placeKessel } from './mitwachsen-kessel';
import { view } from './view-2d';
import { ICE_MODELS } from '../../../../data/games/worlds/eis/mitwachsen-ice-models';
import * as lead from './mitwachsen-lead';

export const pack: WorldPack<GuideRules, View2D, View3D> = {
  id: 'eis',
  gate: 'eis',
  build: buildKessel,
  place: placeKessel,
  lead,
  view,
  view3d: () => import('./view-3d').then((m) => m.view3d),
  models: ICE_MODELS,
};
