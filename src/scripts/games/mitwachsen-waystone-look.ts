// Bild eines Wegsteins (mitwachsen-waystone.ts) für 2D und 3D: eine flache graue Platte mit einer kleinen Einlage.
// Schlafend ist die Einlage matt und dunkel, wach hat sie die Farbe ihrer Welt (`THEME_COLORS.portal`, wie der Rand der
// Torplatte); so unterscheiden sich beide Zustände auch in der Helligkeit, nicht nur im Farbton.

import { THEME_COLORS, type GateId } from '../../data/games/mitwachsen';

/** Quader [x, y, z, Breite, Tiefe, Höhe, Seite, Oberseite] wie in der 2D-Ansicht (z = Unterkante) */
type StoneBox = readonly [number, number, number, number, number, number, string, string];

export const WAYSTONE_COLORS = { side: '#74777b', top: '#9a9da1', asleep: '#6b6e73' } as const;

/** Die Quader des Wegsteins der Welt `id` auf dem Feld (x, y) mit Boden auf Höhe `h`; `lit`: Das Tor ist offen */
export function waystoneBoxes(x: number, y: number, h: number, id: GateId, lit: boolean): StoneBox[] {
  const inlay = lit ? THEME_COLORS[id].portal : WAYSTONE_COLORS.asleep;
  return [
    [x + 0.2, y + 0.24, h, 0.6, 0.5, 0.07, WAYSTONE_COLORS.side, WAYSTONE_COLORS.top],
    [x + 0.34, y + 0.36, h + 0.07, 0.32, 0.26, 0.03, inlay, inlay],
  ];
}

/** Farben des Glitzerns, das beim Öffnen des Tors über die Steine läuft: die Farbe der Welt und Weiß */
export const waystoneSparks = (id: GateId): string[] => [THEME_COLORS[id].portal, '#ffffff'];
