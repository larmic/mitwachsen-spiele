// Paket der Bahn: einziger Einstieg (`import('./worlds/bahn')`). Die Höhlenbahn hat keine eigene Welt hinter einem Tor;
// sie legt ihr Gleis in die gebauten Welten (`lay`, erst ab Ausbau 1, mitwachsen-built.ts): auf der Lichtung von
// Bahnhof Bär durch Tunnelportal und Einschnitt bis an den Prellbock vor dem Höhlentor, mit der Grotte durch Tür und
// Gang weiter bis zum Bahnhof Fledermaus (mitwachsen-line.ts, Trassen-Suche in mitwachsen-trace.ts), und zeichnet es
// je nach Ausbau in 2D und 3D (mitwachsen-rail-look.ts). Dazu Tok, der Bote der Höhlenwelt: Er erscheint am Bett der
// Lichtung und wartet am künftigen Bahnhof Bär (`rules.herald`, mitwachsen-tok.ts; Modell `TOK_MODEL`, Bild und Ton in
// mitwachsen-tok-look.ts, Spielstand in mitwachsen-ride-save.ts, `dawn`: am nächsten echten Spieltag wacht er auf). Läuft
// die Figur in ihn hinein, baut er Bahnhof Bär, das Gleis bis vor das Höhlentor und den Zug (Bau 1, mitwachsen-build.ts;
// Bahnhof und Zug als Körper in mitwachsen-station-look.ts, Modelle in mitwachsen-train-model.ts). Danach fährt der Zug
// (`rules.vehicle`, mitwachsen-train.ts; die Fahrregeln bringt das Paket der Fahrzeuge, worlds/fahrt/; Ton und Licht im
// Tunnel in mitwachsen-train-look.ts): die erste Fahrt bis zum Prellbock in der Bucht, dort hüpft Tok an seinen Platz
// neben der Torplatte. Bau 2 und das Hau-ruck am Höhlentor kommen in den nächsten Schritten.
// Bis zum Freischalten (`BAHN_LIVE`) holt das Spiel es nie von selbst, nur der Entwickler-Schalter
// (`/spielen/?entwickler=bahn`, mitwachsen-dev.ts). Nichts außerhalb dieses Ordners importiert statisch von hier
// (geprüft durch `npm run arch`): im Build `_astro/welt-bahn.<hash>.js`, sein 3D-Teil `_astro/welt-bahn-3d.<hash>.js`,
// beide mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Tok und die Bahn“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { HeraldRules } from '../../mitwachsen-herald';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideEngine, Vehicle } from '../../mitwachsen-rider';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { TOK_MODEL } from '../../../../data/games/worlds/bahn/mitwachsen-tok-model';
import { layLine } from './mitwachsen-line';
import { TOK_RULES } from './mitwachsen-tok';
import { wakeTok } from '../../mitwachsen-ride-save';
import { train } from './mitwachsen-train';
import { view } from './view-2d';

export const pack: WorldPack<GuideRules, View2D, View3D, RideEngine, HeraldRules, Vehicle> = {
  id: 'bahn',
  lay: (laid) => void layLine(laid),
  rules: { bump: () => false, herald: TOK_RULES, vehicle: train },
  dawn: wakeTok,
  models: { tok: TOK_MODEL },
  view,
  view3d: () => import('./view-3d').then((m) => m.view3d),
};
