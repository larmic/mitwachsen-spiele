// Zeichenteile der Eis-Welt für die 2D-Ansicht und die Ebene über 3D, im Welt-Paket der Eis-Welt: Iglu, Eisschale,
// Eistrog, Fischkiste und Eiskristall (Quader aus mitwachsen-ice-look.ts, je Deko-Art an den Haken `drawDeco` des Kerns gehängt), die
// Rutschspur zum Schneebett, das Wetter der Eis-Welt mit Polarlicht und das Bild der Weltgrenze (mitwachsen-ice-sky.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { ICE_COLORS, ICE_CRYSTALS } from '../../../../data/games/mitwachsen-eis';
import { crystalBoxes, crystalGlint, finTwitch, iceBoxes } from './mitwachsen-ice-look';
import type { DrawDeco, View2D } from '../../mitwachsen-view';
import { gateScore, guestAt } from '../../mitwachsen-guest-look';
import { realmSign, turnAlbum, waitArrow } from './mitwachsen-border-view';
import { aurora, iceWeather, shine } from './mitwachsen-ice-sky';

/** Iglu, Eisschale, Eistrog: Quader wie in 3D */
const look: DrawDeco = (world, c, x, y) => iceBoxes(world, c, x, y);

/** Fischkiste: voll, bis die Figur Fische fängt; ab und zu zuckt eine Flosse (nicht bei reduzierter Bewegung) */
const crate: DrawDeco = (world, c, x, y, { now, reduced, picked }) =>
  iceBoxes(world, c, x, y, { full: !(`${x},${y}` in picked), twitch: reduced ? 0 : finTwitch(now, x, y) });

/**
 * Eiskristall: ab und zu blitzt oben ein Funke (nicht bei reduzierter Bewegung); beim Polarlicht bekommt er einen Hof
 * (dafür merkt sich mitwachsen-ice-sky.ts, dass er in diesem Bild zu sehen ist)
 */
const crystal: DrawDeco = (_world, c, x, y, { now, reduced }) => {
  shine(x, y, c.h, c.color ?? ICE_CRYSTALS[0], now);
  return crystalBoxes(c, x, y, reduced ? 0 : crystalGlint(now, x, y));
};

export const view: View2D = {
  decos: { igloo: look, icebowl: look, watertrough: look, fishcrate: crate, crystal },
  // Rutschspur zum Schneebett: glänzt, sobald das Eistor offen ist
  ground: (c, x, y, open) => (c.slide && open ? [x + 0.12, y, c.h, 0.76, 1, 0.02, ...ICE_COLORS.slide] : null),
  // Wetter und Bild der Weltgrenze der Eis-Welt in der Form, die der Kern kennt (`Sky` in mitwachsen-view.ts)
  sky: { weather: iceWeather, aurora, waitArrow, realmSign, turnAlbum, guestAt, gateScore },
};
