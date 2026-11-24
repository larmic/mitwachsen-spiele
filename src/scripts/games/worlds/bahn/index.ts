// Paket der Bahn: einziger Einstieg (`import('./worlds/bahn')`). Die Höhlenbahn hat keine eigene Welt hinter einem Tor;
// sie legt ihr Gleis in die gebauten Welten (`lay`, erst ab Ausbau 1, mitwachsen-built.ts): auf der Lichtung von
// Bahnhof Bär durch Tunnelportal und Einschnitt bis an den Prellbock vor dem Höhlentor, mit der Grotte durch Tür und
// Gang weiter bis zum Bahnhof Fledermaus (mitwachsen-line.ts, Trassen-Suche in mitwachsen-trace.ts), und zeichnet es
// je nach Ausbau in 2D und 3D (mitwachsen-rail-look.ts). Dazu Tok, der Bote der Höhlenwelt: Er erscheint am Bett der
// Lichtung und wartet am künftigen Bahnhof Bär (`rules.herald`, mitwachsen-tok.ts; Modell `TOK_MODEL`, Bild und Ton in
// mitwachsen-tok-look.ts, Spielstand in mitwachsen-tok-save.ts, `dawn`: am nächsten echten Spieltag wacht er auf). Zug,
// Bahnhöfe und das Hau-ruck am Höhlentor kommen in den nächsten Schritten.
// Bis zum Freischalten (`BAHN_LIVE`) holt das Spiel es nie von selbst, nur der Entwickler-Schalter
// (`/spielen/?entwickler=bahn`, mitwachsen-dev.ts). Nichts außerhalb dieses Ordners importiert statisch von hier
// (geprüft durch `npm run arch`): im Build `_astro/welt-bahn.<hash>.js`, sein 3D-Teil `_astro/welt-bahn-3d.<hash>.js`,
// beide mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Tok und die Bahn“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { HeraldRules } from '../../mitwachsen-herald';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideRules } from '../../mitwachsen-rider';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { TOK_MODEL } from '../../../../data/games/worlds/bahn/mitwachsen-tok-model';
import { layLine } from './mitwachsen-line';
import { TOK_RULES } from './mitwachsen-tok';
import { wakeTok } from './mitwachsen-tok-save';
import { view } from './view-2d';

export const pack: WorldPack<GuideRules, View2D, View3D, RideRules, HeraldRules> = {
  id: 'bahn',
  lay: (laid) => void layLine(laid),
  rules: { bump: () => false, herald: TOK_RULES },
  dawn: wakeTok,
  models: { tok: TOK_MODEL },
  view,
  view3d: () => import('./view-3d').then((m) => m.view3d),
};
