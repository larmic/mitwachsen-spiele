// Farben der Eis-Welt, die nur ihr Welt-Paket und dessen 3D-Teil brauchen (Iglu, Eisschale, Fischkiste, Rutschspur,
// Schneebett in 3D, Eiskristalle, Eisscholle vor dem Eistor). Der Kern kennt nur die Farben des Netzes mit Fischen (`FISH_COLORS` in
// mitwachsen-eis.ts) und zeichnet Eisklippen und Schneebett in 2D mit eigenen Kopien von `snow` und `ice`
// (src/scripts/games/mitwachsen-ground-2d.ts, gleich gehalten durch dessen Test); so bleibt dieses Objekt aus der
// Spielseite.
// Spec: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { FISH_COLORS } from '../../mitwachsen-eis';

/** Farben im Kessel (Spielgrafik): Seite und Oberseite */
export const ICE_COLORS = {
  snow: ['#d5e4f0', '#f6f9fc'],
  block: ['#e8f0f7', '#ffffff'], // hellere Schneeblöcke des Iglus (im Wechsel mit `snow`)
  ice: ['#9fd6ef', '#d4f1ff'],
  bowl: ['#8fc6e9', '#cdeaf8'], // Futterschale aus Eis
  bowlIn: '#6fb3df',
  slide: ['#bfe6f5', '#e8f8ff'], // glänzende Rutschspur
  crate: ['#7d6a55', '#9a8670'], // Fischkiste aus Treibholz
  // silberblaue Fische und Schwanzflossen: liegen im Kern (mitwachsen-eis.ts, Netz der Figur), hier nur eingemischt
  ...FISH_COLORS,
  moss: ['#5f8f3a', '#7aa84a'], // Moosbüschel am Rand der Eisschale (nur Bild)
} as const;

/**
 * Torplatte vor dem Eistor als Eisscholle (Seite, Oberseite) mit eingelegter Schneeflocke (Zeilen quer zur Platte, in
 * Schneeweiß `s` aus `PALETTE` in mitwachsen-portals.ts; leuchtet nicht, anders als die Zeichen der anderen Platten)
 */
export const ICE_FLOE = {
  face: ICE_COLORS.ice,
  mark: ['.s.s.s.', '..sss..', 'sss.sss', '..sss..', '.s.s.s.'],
} as const;

/**
 * Eiskristalle im Gletscherkessel: Hellblau, Türkis und Kornblau, alle kräftig genug für Schnee und Karte (nicht die
 * Farben der Kristalle in der Höhlenwelt, damit man die Welten unterscheidet). Der Generator im Paket setzt sie als
 * `cell.color`; Kern und Karte zeichnen sie damit, das Leuchten beim Polarlicht kommt mit dem Welt-Paket.
 */
export const ICE_CRYSTALS = ['#8ec5ff', '#3fd6b8', '#5b8def'] as const;

/**
 * Fülle im Schnee (worlds/eis/mitwachsen-snow-fill-look.ts): Eisblumen in zwei Farben der Eiskristalle mit weißer
 * Mitte, blanker Eisfleck mit Funke, graue Kiesel (Seite, Oberseite), Tundra-Büschel in Moosgrün mit blauen Beeren,
 * Schneewehe (Körper, Schattenrand). Kein Gold: Das ist die Aktionsfarbe.
 */
export const SNOW_FILL_COLORS = {
  flowers: [ICE_CRYSTALS[0], ICE_CRYSTALS[1]],
  heart: '#ffffff',
  glint: ICE_COLORS.ice,
  spark: '#ffffff',
  pebble: ['#7d8896', '#9da8b5'],
  tuft: ['#8a9a3c', '#a9b84e'],
  berry: ICE_CRYSTALS[2],
  drift: ['#e6eef7', '#ffffff'],
  shadow: ['#a9c6dd', '#c3d9ea'],
} as const;
