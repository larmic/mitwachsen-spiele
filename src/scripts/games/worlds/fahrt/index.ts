// Paket der Fahrzeuge: einziger Einstieg (`import('./worlds/fahrt')`). Es hat keine eigene Welt und legt nichts in die
// Karte; es bringt nur die Fahr-Engine aller Fahrzeuge mit (`rules.ride`, mitwachsen-ride.ts): einsteigen, anstoßen, in
// 2 s wieder aussteigen, fahren, vor Tieren halten, Tunnel ankündigen, ankommen, aussteigen, Folgende warten am Halt.
// Welche Fahrzeuge es gibt, sagen die Pakete ihrer Welten (`rules.vehicle`: der Schlitten im Paket der Eis-Welt, der Zug
// im Paket der Bahn); was beide brauchen, um ihr Fahrzeug zu zeichnen (Halte, wo es steht, Spielstand), steht für die
// Pakete in mitwachsen-ride-kit.ts und mitwachsen-ride-save.ts. Geladen wird es, sobald es ein Fahrzeug geben kann
// (`fahrtWanted` in mitwachsen-pack.ts: Eistor offen, oder die Bahn ist da); fehlt es, fährt nichts, zu Fuß geht alles.
// Am nächsten echten Spieltag fällt `schlaeft` bei jedem Fahrzeug weg (`dawn`, `wakeRides` in mitwachsen-ride-save.ts).
// Nichts außerhalb dieses Ordners importiert statisch von hier (geprüft durch `npm run arch`): im Build
// `_astro/welt-fahrt.<hash>.js` mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“, „Der Schlitten“ und „Tok und die Bahn“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { HeraldRules } from '../../mitwachsen-herald';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideEngine, Vehicle } from '../../mitwachsen-rider';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { wakeRides } from '../../mitwachsen-ride-save';
import { rides } from './mitwachsen-ride';

export const pack: WorldPack<GuideRules, View2D, View3D, RideEngine, HeraldRules, Vehicle> = {
  id: 'fahrt',
  rules: { bump: () => false, ride: rides },
  dawn: wakeRides, // ein neuer echter Spieltag: Wer am Abend schlafend kam, wacht auf (`schlaeft` bei jedem Fahrzeug)
};
