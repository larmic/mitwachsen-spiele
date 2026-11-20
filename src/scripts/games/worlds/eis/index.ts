// Welt-Paket der Eis-Welt: einziger Einstieg (`import('./worlds/eis')`). Alles, was nur die Eis-Welt braucht, kommt
// von hier: der Gletscherkessel hinter dem Eistor (Gelände, Zuhause, Wohnorte der Eis-Tiere, Eis-Portal) und die Regeln
// des verlaufenen Pinguins, der zum Eistor führt und es öffnet. Nichts außerhalb dieses Ordners importiert statisch
// von hier (geprüft durch `npm run arch`), so bleibt es ein eigenes Paket, das der Browser nachlädt: im Build
// `_astro/welt-eis.<hash>.js` (Name aus astro.config.mjs), gemessen mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { WorldPack } from '../../mitwachsen-pack';
import { buildKessel, placeKessel } from './mitwachsen-kessel';
import * as lead from './mitwachsen-lead';

export const pack: WorldPack<GuideRules> = { id: 'eis', gate: 'eis', build: buildKessel, place: placeKessel, lead };
