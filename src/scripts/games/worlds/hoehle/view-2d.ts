// Zeichenteile der Kristallgrotte für die 2D-Ansicht und die Ebene über 3D, im Welt-Paket der Höhlenwelt: Pilzschale,
// Steintrog, Unterstand mit Kristallwand, Kristall-Lampen, Kristallsäulen, Kristallbogen, Leuchtpilze, Pilzbeete (voll
// oder abgeerntet), Tropfquelle, Tropfmoos und Stalagmiten
// (Quader aus mitwachsen-cave-look.ts, je Deko-Art an den Haken `drawDeco` des Kerns gehängt), Lichtflecken auf dem
// Grottenboden, der lila Höhlenhimmel und das Zeichen der Gegend in der Leiste (ein Kristall). Wetter gibt es in der
// Grotte keins, Polarlicht auch nicht, und das Höhlentor geht vorerst nie auf.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { RegionId } from '../../../../data/games/mitwachsen';
import type { DrawDeco, Turn, View2D } from '../../mitwachsen-view';
import { sprite } from '../../mitwachsen-glyphs';
import { caveBoxes, glowOver } from './mitwachsen-cave-look';

/** Dinge der Grotte: Quader wie in 3D */
const look: DrawDeco = (world, c, x, y) => caveBoxes(world, c, x, y);
/** Pilzbeet: voll, bis die Figur es abgeerntet hat (`picked`), dann leer, bis es nachwächst */
export const bed: DrawDeco = (world, c, x, y, { picked }) => caveBoxes(world, c, x, y, !(`${x},${y}` in picked));

/** So lange klappt die Leiste beim Wechsel der Gegend um (wie in der Eis-Welt) */
export const TURN_MS = 400;

/** Zeichen der Gegenden links in der Leiste: grünes Blatt der Lichtung, Kristall der Grotte */
const SIGN: Partial<Record<RegionId, readonly [string[], string]>> = {
  lichtung: [
    ['.....ggg', '...ggggg', '..gggggg', '.gggg.gg', '.ggg.ggg', '.gg.ggg.', '..gggg..', '.g......'],
    '#3f9a3c',
  ],
  hoehle: [['...k...', '..kkk..', '.kkkkk.', '.kkkkk.', '.kkkkk.', '..kkk..', '...k...'], GROTTE_COLORS.crystals[0]],
};

/**
 * Umklappen der Leiste: Wechselt die Gegend, wird die Leiste erst flach und klappt mit der neuen wieder auf (bei
 * reduzierter Bewegung sofort)
 */
export function turnAlbum(t: Turn, realm: RegionId, now: number, reduced: boolean): [RegionId, number] {
  if (t.shown && t.shown !== realm) [t.from, t.at] = [t.shown, now];
  t.shown = realm;
  const p = reduced || t.at === undefined ? 1 : Math.min(1, (now - t.at) / TURN_MS);
  return p < 0.5 ? [t.from ?? realm, 1 - 2 * p] : [realm, 2 * p - 1];
}

const none = () => {};

export const view: View2D = {
  decos: {
    shroombowl: look,
    stonetrough: look,
    shed: look,
    cavelamp: look,
    column: look,
    crystalarch: look,
    glowshroom: look,
    shroombed: bed,
    dripspring: look,
    dripmoss: look,
    stalagmite: look,
  },
  // Lichtfleck unter einem Lichtschacht und neben Kristallen: helles Licht obenauf (der Kern ruft das nur auf Grottenboden)
  ground: (c, x, y) => (c.light ? [x, y, c.h, 1, 1, 0.01, glowOver(c.light), glowOver(c.light)] : null),
  sky: {
    weather: none,
    aurora: none,
    waitArrow: none,
    realmSign: (ctx, realm, cx, bottom, size) => {
      const sign = SIGN[realm];
      if (sign) sprite(ctx, sign[0], sign[1], cx, bottom, size / 8);
    },
    turnAlbum,
    guestAt: () => null,
    gateScore: () => [],
  },
  heaven: GROTTE_COLORS.heaven,
};
