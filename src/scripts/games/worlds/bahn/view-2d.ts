// Zeichenteile des Pakets der Bahn für die 2D-Ansicht (`View2D`): das Gleis auf Lichtung und Grotte (mitwachsen-rail-look.ts,
// je nach Ausbau), Bild und Ton von Tok (`heraldFx`, gleich für 3D) und Tok als fehlender Schritt am Höhlentor (`lacks`,
// mitwachsen-tok-look.ts). Eine eigene Welt, einen Himmel oder Dinge hat die Bahn nicht.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“)

import type { View2D } from '../../mitwachsen-view';
import { railBoxes } from './mitwachsen-rail-look';
import { heraldFx, lacks } from './mitwachsen-tok-look';

export const view: View2D = { decos: {}, ground: () => null, rails: railBoxes, heraldFx, lacks };
