// Böden der Welten hinter den Toren in der 2D-Ansicht (Schnee, Eis, Basalt, Höhle, Grotte, Wolken, Moos) als einfache Blöcke in
// ihren Farben, dazu die Eisklippen der Eis-Welt und ihr Schneebett. Die Eis-Welt bringt ihre übrigen Farben mit ihrem
// Welt-Paket (`ICE_COLORS` in src/data/games/worlds/eis/mitwachsen-ice-colors.ts); Klippen und Schneebett braucht der
// Kern auch, solange das Paket lädt (dann steht hinter dem Gang des Eistors eine Eisklippe), darum stehen sie hier.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt Gletscherkessel, „Bild“)

import type { Cell } from './mitwachsen-world';

type Colors = readonly [string, string]; // Seite, Oberseite

/** Rahmen des Schneebetts der Eis-Welt (wie `ICE_COLORS.snow` im Welt-Paket, gleich gehalten durch den Test) */
export const BED_SNOW: Colors = ['#d5e4f0', '#f6f9fc'];
/** Eis (wie `ICE_COLORS.ice` im Welt-Paket, gleich gehalten durch den Test) und Schnee obenauf */
const ICE: Colors = ['#9fd6ef', '#d4f1ff'];
const SNOW_TOP = '#f4f8fb';
const FLAT: Partial<Record<Cell['ground'], Colors>> = {
  snow: ['#cfd8de', SNOW_TOP],
  ice: ICE,
  basalt: ['#2a2b30', '#3a3b42'],
  cave: ['#2a2c33', '#3c3f47'],
  cloud: ['#e6eef7', '#ffffff'],
  moss: ['#6a4a3a', '#8a76cc'],
  grotto: ['#b4aecb', '#cfc9e0'], // Kristallgrotte: zart lila getöntes Grau wie die Schichten am Höhlentor
};
/** Gefärbtes Eis der Eis-Welt: Klippen und Eisfall, auf dem Boden die Stufen des Eisbergs (`color`) */
const iceWall = (c: Cell) => c.biome === 'eis' && (c.region === 'border' || (c.ground === 'ice' && !!c.color));

/**
 * Farben eines Bodens hinter den Toren, sonst undefined (Gras, Sand, Weg, Stein zeichnet die Ansicht mit Texturen). Eine
 * Eisklippe hat Eis an der Seite und Schnee obenauf; eine gefärbte (`color`: der Eisfall am Talende, die Stufen des
 * Eisbergs) Seiten in ihrer Farbe und glattes Eis obenauf.
 */
export const flatColors = (c: Cell): Colors | undefined =>
  iceWall(c) ? (c.color ? [c.color, ICE[1]] : [ICE[0], SNOW_TOP]) : FLAT[c.ground];
