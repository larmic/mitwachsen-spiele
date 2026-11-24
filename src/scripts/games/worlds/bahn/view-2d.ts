// Zeichenteile des Pakets der Bahn für die 2D-Ansicht (`View2D`): das Gleis auf Lichtung und Grotte (mitwachsen-rail-look.ts,
// je nach Ausbau und Gleiswelle), Bahnhof Bär und Zug als Körper (`bodies`, mitwachsen-station-look.ts, gleich für 3D),
// Ton und Freude zu den Ereignissen des Zugs und das Licht im Tunnel (`rideFx`, `dim`, mitwachsen-train-look.ts, gleich
// für 3D), Bild und Ton von Tok (`heraldFx`, gleich für 3D) und Tok als fehlender Schritt am Höhlentor (`lacks`,
// mitwachsen-tok-look.ts). Eine eigene Welt, einen Himmel oder Dinge hat die Bahn nicht.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“)

import type { View2D } from '../../mitwachsen-view';
import { railBoxes } from './mitwachsen-rail-look';
import { stationBodies } from './mitwachsen-station-look';
import { heraldFx, lacks } from './mitwachsen-tok-look';
import { dim, trainFx } from './mitwachsen-train-look';

export const view: View2D = {
  decos: {},
  ground: () => null,
  rails: railBoxes,
  bodies: stationBodies,
  rideFx: trainFx,
  dim,
  heraldFx,
  lacks,
};
