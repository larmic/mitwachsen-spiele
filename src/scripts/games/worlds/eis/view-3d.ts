// 3D-Teil des Welt-Pakets der Eis-Welt: Was die 3D-Ansicht nur für die Eis-Welt baut. Iglu, Eisschale, Eistrog und
// Fischkiste (Quader aus mitwachsen-ice-look.ts, wie in 2D; die Schwanzflossen wiegen sich im Wind statt zu zucken),
// Schnee und Eis als Boden und Klippen des Kessels, die glänzende Rutschspur bei offenem Eistor, das Bett aus Schnee
// und am Eistor Tür, Eiszapfen und goldene Bucht (view-3d-gate.ts). Braucht Three.js (wie die 3D-Ansicht, beide teilen
// es) und wird darum nicht mit dem Paket geladen, sondern erst, wenn die 3D-Ansicht es will (`pack.view3d`, index.ts):
// im Build `_astro/welt-eis-3d.<hash>.js` mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { ICE_COLORS } from '../../../../data/games/mitwachsen-eis';
import { iceBoxes } from './mitwachsen-ice-look';
import type { Frame, Ground, View3D } from '../../mitwachsen-view-3d';
import type { DrawDeco } from '../../mitwachsen-view';
import { gateLook } from './view-3d-gate';

/** Im Gletscherkessel (Boden und Klippen): Schnee obenauf, darunter Eis */
const KESSEL: Ground = { tiles: ['snowTop', 'ice', 'ice'] };
/** Die Rutschspur glänzt bei offenem Eistor aus Eis */
const SLIDE: Ground = { tiles: ['ice', 'ice', 'ice'], top: ICE_COLORS.slide[1] };
/** Rahmen des Betts aus Schnee */
const SNOW_FRAME: Frame = [...ICE_COLORS.snow, 'white'];

/** Iglu, Eisschale, Eistrog: Quader wie in 2D */
const look: DrawDeco = (world, c, x, y) => iceBoxes(world, c, x, y);
/** Fischkiste: voll, bis die Figur Fische fängt; die Flossen zucken in 3D nicht (sie wiegen sich im Wind) */
const crate: DrawDeco = (world, c, x, y, { picked }) =>
  iceBoxes(world, c, x, y, { full: !(`${x},${y}` in picked), twitch: 0 });

export const view3d: View3D = {
  gate: 'eis',
  look: gateLook,
  decos: { igloo: look, icebowl: look, watertrough: look, fishcrate: crate },
  ground(c, open) {
    if (c.biome !== 'eis' || c.region === 'wild') return null;
    if (c.slide && open.includes('eis')) return SLIDE;
    return c.region === 'border' || c.ground === 'snow' ? KESSEL : null;
  },
  bedFrame: (c) => (c.biome === 'eis' ? SNOW_FRAME : null),
};
