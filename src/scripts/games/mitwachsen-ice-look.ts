// Aussehen der Dinge im Gletscherkessel, gleich für 2D und 3D: Iglu, Eisschale, Wassertrog aus Eisblöcken.
// Rein (ohne DOM und Three.js): liefert Quader in Feldern, die beide Ansichten zeichnen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt“, Kessel)

import { ICE_COLORS } from '../../data/games/mitwachsen-eis';
import type { Cell } from './mitwachsen-cell';
import { homeAt, type Realms } from './mitwachsen-home';

/**
 * Quader: x (rechts), y (nach vorn), z (Höhe), Breite, Tiefe, Höhe, Farbe der Seiten und oben; `see`: wird in 3D vor
 * der Figur durchsichtig (wie Laub und der Hut des Riesenpilzes)
 */
export type IceBox = readonly [number, number, number, number, number, number, string, string, boolean?];

const IGLOO_H = 2.8; // Höhe der Kuppel
const LAYERS = 7; // Reihen aus Schneeblöcken
const ARCH = 1.7; // bis zu dieser Höhe ist das Iglu vorn offen (weiter Bogen): Man sieht die Tiere darin
const WALL = 0.45; // Dicke der Wand
const STRIP = 0.5; // Tiefe eines Schneeblocks: Jede Reihe besteht aus Streifen, so wird die Kuppel rund

/**
 * Iglu über dem Unterstand der Gegend: runde Kuppel aus Reihen von Schneeblöcken, von der Rückwand bis vor das Dach.
 * Unten nur die Wand ringsum, vorn offen (weiter Bogen bis `ARCH`), darüber geschlossene Reihen. Gezeichnet vom
 * Mittelfeld der Rückwand aus; in 3D wird es vor der Figur durchsichtig.
 */
function igloo(world: Realms, x: number, y: number, h: number): IceBox[] {
  const { x0, y0, x1, y1 } = homeAt(world, x, y).shelter;
  const [cx, cy] = [(x0 + x1 + 1) / 2, (y0 - 1 + y1 + 1) / 2]; // von der Rückwand bis zur Vorderkante des Dachs
  const [a, b] = [(x1 - x0 + 1) / 2 + 0.3, (y1 - y0 + 2) / 2 + 0.2];
  const out: IceBox[] = [];
  const lh = IGLOO_H / LAYERS;
  /** halbe Breite einer Ellipse mit Halbachsen (ea, eb) im Abstand dy von der Mitte */
  const half = (ea: number, eb: number, dy: number) => (Math.abs(dy) < eb ? ea * Math.sqrt(1 - (dy / eb) ** 2) : 0);
  for (let k = 0; k < LAYERS; k++) {
    const z = h + k * lh;
    const f = Math.sqrt(1 - ((k + 0.5) / LAYERS) ** 2); // Rundung der Kuppel nach oben
    const closed = k * lh >= ARCH;
    for (let i = 0, sy = cy - b * f; sy < cy + b * f - 0.01; i++, sy += STRIP) {
      const d = Math.min(STRIP, cy + b * f - sy);
      const dy = sy + d / 2 - cy;
      const wo = half(a * f, b * f, dy);
      const wi = closed ? 0 : half(a * f - WALL, b * f - WALL, dy);
      const [side, top] = (k + i) % 2 ? ICE_COLORS.snow : ICE_COLORS.block;
      if (closed || (wi === 0 && dy < 0)) out.push([cx - wo, sy, z, 2 * wo, d, lh, side, top, true]);
      else if (wi > 0) {
        out.push([cx - wo, sy, z, wo - wi, d, lh, side, top, true]); // Wand links und rechts, vorn offen
        out.push([cx + wi, sy, z, wo - wi, d, lh, side, top, true]);
      }
    }
  }
  return out;
}

/** Quader eines Dings im Kessel; null, wenn das Feld kein Eis-Ding trägt (dann zeichnet die Ansicht wie sonst) */
export function iceBoxes(world: Realms, c: Cell, x: number, y: number): IceBox[] | null {
  const h = c.h;
  switch (c.deco) {
    case 'igloo': {
      const [sx, sy] = homeAt(world, x, y).shelterStem; // die Mitte der Rückwand zeichnet das ganze Iglu
      return sx === x && sy === y ? igloo(world, x, y, h) : [];
    }
    case 'icebowl': // flache Futterschale aus Eis
      return [
        [x + 0.08, y + 0.15, h, 0.84, 0.7, 0.22, ...ICE_COLORS.bowl],
        [x + 0.2, y + 0.27, h + 0.2, 0.6, 0.46, 0.03, ICE_COLORS.bowlIn, ICE_COLORS.bowlIn],
      ];
    case 'watertrough': // Wassertrog aus Eisblöcken
      return c.biome !== 'eis'
        ? null
        : [
            [x + 0.05, y + 0.15, h, 0.44, 0.72, 0.4, ...ICE_COLORS.ice],
            [x + 0.51, y + 0.15, h, 0.44, 0.72, 0.4, ...ICE_COLORS.ice],
            [x + 0.13, y + 0.23, h + 0.4, 0.74, 0.56, 0.04, '#3f8fd8', '#7fc0f0'],
          ];
    default:
      return null;
  }
}
