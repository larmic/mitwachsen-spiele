// Welt-Paket der Höhlenwelt: einziger Einstieg (`import('./worlds/hoehle')`). Alles, was nur die Höhlenwelt braucht,
// kommt von hier: die Kristallgrotte hinter dem Höhlentor (Lage, Gelände mit allen Zonen, Zuhause mit Unterstand an der Kristallwand,
// Licht, Portal am stillen See, Fundorte der acht Höhlen-Tiere) und die Zeichenteile der 2D-Ansicht samt den Modellen
// der Höhlen-Tiere (die Fledermaus auch kopfüber). Sammeln, Tok und der Zug kommen später.
// Das Spiel braucht es vorerst nie (das Höhlentor geht nie auf); nur der Entwickler-Schalter holt es
// (`/spielen/?entwickler=hoehle`, mitwachsen-dev.ts). Nichts außerhalb dieses Ordners importiert statisch von hier
// (geprüft durch `npm run arch`): im Build `_astro/welt-hoehle.<hash>.js` (Name aus astro.config.mjs), gemessen mit
// eigener Grenze (scripts/verify-bundles.ts). Sein 3D-Teil (view-3d.ts) kommt erst, wenn die 3D-Ansicht ihn will
// (`view3d`): `_astro/welt-hoehle-3d.<hash>.js`, ebenfalls mit eigener Grenze.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Die Kristallgrotte“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideRules } from '../../mitwachsen-rider';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { buildGrotte, placeGrotte } from './mitwachsen-grotte';
import { view } from './view-2d';
import { BAT_ROOST, CAVE_MODELS } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';

export const pack: WorldPack<GuideRules, View2D, View3D, RideRules> = {
  id: 'hoehle',
  gate: 'hoehle',
  build: buildGrotte,
  place: placeGrotte,
  view,
  view3d: () => import('./view-3d').then((m) => m.view3d),
  models: CAVE_MODELS,
  roosts: { fledermaus: BAT_ROOST }, // kopfüber im Kristallbogen
};
