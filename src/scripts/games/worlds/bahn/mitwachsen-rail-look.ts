// Aussehen des Gleises – rein, ohne DOM, gleich für 2D und 3D: Quader je Feld mit Gleis (`Cell.rail`): Holzschwellen und
// graue Schienen, gerade oder in einer rechtwinkligen Kurve, roter Prellbock an den Enden der Linie und, solange der
// Ausbau 1 ist, vor der Tür des Höhlentors; das Tunnelportal aus Stein mit Grasdach und die niedrigen Wände des oben
// offenen Einschnitts. Was liegt, sagt der Ausbau im Spielstand (`packs.bahn.built`): 0 nichts, 1 die Lichtung bis zum
// Prellbock, 2 die ganze Linie. Liegt nichts, zeigt sich das Feld wie sonst (Gras, Büschel, Blumen). Teil des Pakets der
// Bahn (view-2d.ts, view-3d.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden)

import { RAIL_COLORS } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { Cell } from '../../mitwachsen-cell';
import type { Box, DrawRails } from '../../mitwachsen-view';
import { builtOf } from './mitwachsen-built';

/** Quader in einem Feld, ohne Lage: x, y (nach vorn), z über dem Boden, Breite, Tiefe, Höhe, Seite, oben */
type Local = readonly [number, number, number, number, number, number, string, string];

const [P1, P2, W] = [0.2, 0.71, 0.09]; // Schienen: Abstand vom Rand links und rechts, Breite
const RAIL_Z = 0.06; // Schienen liegen auf den Schwellen
const sleeper = (y: number): Local => [0.06, y, 0, 0.88, 0.22, RAIL_Z, ...RAIL_COLORS.sleeper];
const rail = (x: number, y: number, d: number): Local => [x, y, RAIL_Z, W, d, 0.07, ...RAIL_COLORS.rail];

/** Gerade von oben nach unten */
const STRAIGHT: readonly Local[] = [sleeper(0.1), sleeper(0.6), rail(P1, 0, 1), rail(P2, 0, 1)];
/** Kurve von oben nach rechts: die Schienen treffen sich innen bei (P2, P1), außen bei (P1, P2) */
const CURVE: readonly Local[] = [
  sleeper(0.06),
  [0.72, 0.06, 0, 0.22, 0.88, RAIL_Z, ...RAIL_COLORS.sleeper],
  rail(P2, 0, P1 + W),
  rail(P1, 0, P2 + W),
  [P2, P1, RAIL_Z, 1 - P2, W, 0.07, ...RAIL_COLORS.rail],
  [P1, P2, RAIL_Z, 1 - P1, W, 0.07, ...RAIL_COLORS.rail],
];
/** Prellbock quer über dem Gleis, `y` seine Vorderkante (nach unten), mit zwei dunklen Puffern zur Strecke hin (oben) */
const buffer = (y: number): Local[] => [
  [0.08, y, 0, 0.84, 0.3, 0.45, ...RAIL_COLORS.buffer],
  [0.16, y - 0.05, 0.22, 0.2, 0.05, 0.14, RAIL_COLORS.pads, RAIL_COLORS.pads],
  [0.64, y - 0.05, 0.22, 0.2, 0.05, 0.14, RAIL_COLORS.pads, RAIL_COLORS.pads],
];
/** Ende der Linie, die Strecke kommt von oben: halbe Gerade, dann der Prellbock */
const END: readonly Local[] = [sleeper(0.1), rail(P1, 0, 0.7), rail(P2, 0, 0.7), ...buffer(0.62)];
/** Tunnelportal über der Geraden: zwei Pfeiler, Sturz, Grasdach */
const PORTAL: readonly Local[] = [
  ...STRAIGHT,
  [0, 0.3, 0, 0.14, 0.4, 1.5, ...RAIL_COLORS.stone],
  [0.86, 0.3, 0, 0.14, 0.4, 1.5, ...RAIL_COLORS.stone],
  [-0.04, 0.26, 1.5, 1.08, 0.48, 0.28, ...RAIL_COLORS.stone],
  [0, 0.28, 1.78, 1, 0.44, 0.1, ...RAIL_COLORS.grass],
];
/** Einschnitt: niedrige Steinwände links und rechts der Geraden, oben Gras */
const CUT: readonly Local[] = [
  ...STRAIGHT,
  [0, 0, 0, 0.12, 1, 0.4, RAIL_COLORS.stone[0], RAIL_COLORS.grass[1]],
  [0.88, 0, 0, 0.12, 1, 0.4, RAIL_COLORS.stone[0], RAIL_COLORS.grass[1]],
];

/** Vierteldrehungen im Uhrzeigersinn (oben → rechts) um die Mitte des Felds */
function turn(b: Local, k: number): Local {
  const [, , z, , , h, side, top] = b;
  let [x, y, w, d] = [b[0], b[1], b[3], b[4]];
  for (let i = 0; i < k; i++) [x, y, w, d] = [1 - (y + d), x, d, w];
  return [x, y, z, w, d, h, side, top];
}
/** Vierteldrehungen, die die Richtung oben (`n`) in die Richtung `l` bringen */
const QUARTER: Readonly<Record<string, number>> = { n: 0, e: 1, s: 2, w: 3 };

/** Form und Drehung eines Stücks aus seinen Richtungen (in beliebiger Reihe) */
function shape(to: string): [readonly Local[], number] {
  const set = [...to].sort().join('');
  if (to.length < 2) return [END, QUARTER[to] ?? 0];
  if (set === 'ns') return [STRAIGHT, 0];
  if (set === 'ew') return [STRAIGHT, 1];
  // Kurven: oben–rechts gedreht
  return [CURVE, { en: 0, es: 1, sw: 2, nw: 3 }[set] ?? 0];
}

/**
 * Quader des Gleises auf dem Feld (x, y) nach dem Ausbau in `at.packs` (`DrawRails`); null, wenn dort (noch) keins
 * liegt
 */
export const railBoxes: DrawRails = (c: Cell, x: number, y: number, at) => {
  const r = c.rail;
  if (!r || r.stage > builtOf(at.packs)) return null;
  // Prellbock vor der Tür nur, solange der Ausbau 1 ist (danach geht es weiter durch die Tür): Ende zur Strecke hin
  const end = r.part === 'end' || (r.part === 'buffer' && builtOf(at.packs) < 2);
  const to = end ? r.to.slice(0, 1) : r.to;
  const [form, k] = shape(to);
  const own = r.part === 'portal' ? PORTAL : r.part === 'cut' ? CUT : form;
  const q = r.part === 'portal' || r.part === 'cut' ? shape(r.to)[1] : k;
  return own.map((b): Box => {
    const [bx, by, bz, w, d, h, side, top] = turn(b, q);
    return [x + bx, y + by, c.h + bz, w, d, h, side, top];
  });
};
