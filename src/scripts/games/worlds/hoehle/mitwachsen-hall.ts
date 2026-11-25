// Bühne der Kristallhalle – rein, im Welt-Paket der Höhlenwelt: wo Säulen-Glockenspiel, Kristallbogen und Klangstein in
// der Welt stehen. Regel „Schauseite“: Was eine Vorderseite oder eine Leserichtung hat, steht in Weltrichtung, nicht im
// gedrehten Raster der Grotte. Die Kamera in Ruhe schaut aus Süden, also sieht man in jeder Welt die Säulen vorn in
// einer Reihe (tiefster Ton links) und den Bogen dahinter. Gesetzt von `hallOf` (mitwachsen-grotte.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“, Säulen-Glockenspiel)

import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Site } from './mitwachsen-site';

/**
 * Feld der Welt für eine Lage [nach rechts, nach vorn] von der Mitte der Halle aus, immer in Weltrichtung, wie auch die
 * Grotte gedreht liegt. Rechts ist Osten (+x), vorn ist Süden (+y), zur Kamera in Ruhe; hinten ist Norden
 */
export function hallStage(site: Pick<Site, 'at'>): (right: number, front: number) => Point {
  const [cx, cy] = site.at(GROTTE.hall.across, GROTTE.hall.out - GROTTE.shape.ry);
  return (right, front) => [cx + right, cy + front];
}

/** Lagen auf der Bühne: Reihe der Säulen vorn, Bogen `hall.arch` Felder dahinter, Klangstein links vor den Säulen */
export const HALL_STAGE = {
  columns: 3,
  arch: 3 - GROTTE.hall.arch,
  stone: [GROTTE.ghost.stone[0] - GROTTE.hall.across, GROTTE.hall.out - GROTTE.ghost.stone[1]],
} as const;
