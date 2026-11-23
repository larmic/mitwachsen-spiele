// Zeichenteile des Pakets der Bahn für die 2D-Ansicht (`View2D`): bisher nur das Gleis auf Lichtung und Grotte
// (mitwachsen-rail-look.ts, je nach Ausbau). Eine eigene Welt, einen Himmel oder Dinge hat die Bahn nicht.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“)

import type { View2D } from '../../mitwachsen-view';
import { railBoxes } from './mitwachsen-rail-look';

export const view: View2D = { decos: {}, ground: () => null, rails: railBoxes };
