// 3D-Teil des Welt-Pakets der Eis-Welt: Was die 3D-Ansicht nur für die Eis-Welt baut. Iglu, Eisschale, Eistrog und
// Fischkiste (Quader aus mitwachsen-ice-look.ts, wie in 2D; die Schwanzflossen wiegen sich im Wind statt zu zucken),
// Schnee und Eis als Boden und Klippen des Kessels, die glänzende Rutschspur bei offenem Eistor, das Bett aus Schnee,
// Eiskristalle, die beim Polarlicht heller und grüntürkis leuchten (bei reduzierter Bewegung ruhig), Eisschollen auf den
// Eislöchern, der Eisfall am Talende (Klippen aus gefrorenem Wasser), die Stufen des Eisbergs, die Fußspuren im Schnee
// (view-3d-prints.ts) und am Eistor Tür, Eiszapfen und goldene Bucht (view-3d-gate.ts). Braucht Three.js (wie die
// 3D-Ansicht, beide teilen es) und wird darum nicht mit dem Paket geladen, sondern erst, wenn die 3D-Ansicht es will (`pack.view3d`, index.ts):
// im Build `_astro/welt-eis-3d.<hash>.js` mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { ICE_COLORS } from '../../../../data/games/mitwachsen-eis';
import { crystalBoxes, crystalGlow, floeBoxes, glowTint, iceBoxes } from './mitwachsen-ice-look';
import type { Frame, Ground, View3D } from '../../mitwachsen-view-3d';
import type { DrawDeco } from '../../mitwachsen-view';
import { gateLook } from './view-3d-gate';
import { layer } from './view-3d-prints';

/** Im Gletscherkessel (Boden und Klippen): Schnee obenauf, darunter Eis */
const KESSEL: Ground = { tiles: ['snowTop', 'ice', 'ice'] };
/**
 * Eisfall am Talende und Stufen des Eisbergs: Seiten in der Farbe des Felds (`color`, wie in 2D), glattes Eis obenauf.
 * Die Kacheln sind fast weißer Schnee, so bleibt die Tönung so hell wie in 2D (auf der blauen Eis-Kachel würde sie
 * doppelt dunkel)
 */
const fall = (color: string): Ground => ({
  tiles: ['snowTop', 'snowTop', 'snowTop'],
  top: ICE_COLORS.ice[1],
  side: color,
});
/** Die Rutschspur glänzt bei offenem Eistor aus Eis */
const SLIDE: Ground = { tiles: ['ice', 'ice', 'ice'], top: ICE_COLORS.slide[1] };
/** Rahmen des Betts aus Schnee */
const SNOW_FRAME: Frame = [...ICE_COLORS.snow, 'white'];

/** Iglu, Eisschale, Eistrog: Quader wie in 2D */
const look: DrawDeco = (world, c, x, y) => iceBoxes(world, c, x, y);
/** Fischkiste: voll, bis die Figur Fische fängt; die Flossen zucken in 3D nicht (sie wiegen sich im Wind) */
const crate: DrawDeco = (world, c, x, y, { picked }) =>
  iceBoxes(world, c, x, y, { full: !(`${x},${y}` in picked), twitch: 0 });

/** Eiskristall der Eis-Welt: leuchtet aus sich selbst (`'glow'`); Kristalle anderer Welten baut die 3D-Ansicht wie immer */
const crystal: DrawDeco = (_world, c, x, y) => (c.biome === 'eis' ? crystalBoxes(c, x, y, 0, true) : null);

/** Eisscholle auf einem Eisloch, liegt still */
const floe: DrawDeco = (_world, _c, x, y) => floeBoxes(x, y);

export const view3d: View3D = {
  gate: 'eis',
  look: gateLook,
  decos: { igloo: look, icebowl: look, watertrough: look, fishcrate: crate, crystal, floe },
  ground(c, open) {
    if (c.biome !== 'eis' || c.region === 'wild') return null;
    if (c.slide && open.includes('eis')) return SLIDE;
    if (c.color && (c.region === 'border' || c.ground === 'ice')) return fall(c.color); // Eisfall, Stufen des Eisbergs
    return c.region === 'border' || c.ground === 'snow' ? KESSEL : null;
  },
  bedFrame: (c) => (c.biome === 'eis' ? SNOW_FRAME : null),
  // alle zugleich (ein Material): pulsieren sanft mit dem Polarlicht, bei reduzierter Bewegung ruhig
  glow: (aurora, reduced, now) => glowTint(crystalGlow(aurora, reduced, now)),
  // Fußspuren im Schnee, je Bild nachgeführt (view-3d-prints.ts)
  layer,
};
