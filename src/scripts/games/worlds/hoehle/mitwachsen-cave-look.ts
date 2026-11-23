// Aussehen der Dinge in der Kristallgrotte, gleich für 2D und 3D: Pilzschale, Steintrog mit Tropfmoos am Rand,
// Unterstand mit der Kristallwand, Kristall-Lampen, Kristallsäulen, Kristallbogen, Leuchtpilze, Pilzbeete (voll und
// leer), Tropfquelle, Tropfmoos und Stalagmiten in drei Höhen; dazu Boden
// und Klippen in den Schichten des Höhlentors und die Lichtflecken. Eigene Voxel-Grafik: keine Drusen, keine Loren, kein
// Tropfstein mit Kessel. Rein (ohne DOM und Three.js): liefert Quader in Feldern, die beide Ansichten zeichnen. Teil des
// Welt-Pakets der Höhlenwelt: 2D über view-2d.ts, 3D über den 3D-Teil view-3d.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { ARCH_PERCH } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import { hash } from '../../../../lib/games/rng';
import type { Cell } from '../../mitwachsen-cell';
import type { Realms } from '../../mitwachsen-home';
import type { Box } from '../../mitwachsen-view';

const C = GROTTE_COLORS;
const [KR, KT, KP] = C.crystals;
/** Höhe der Kristallwand und des Dachs des Unterstands am Bett */
export const SHED_H = 2.2;

/** Stiel der Leuchtpilze */
const STEM: readonly [string, string] = ['#efe4d2', '#f7efe2'];
/** Tropfwasser: türkise Tropfen */
const DROP = C.water[1];

/**
 * Ein Ding der Grotte als Quader (null: kein Ding der Grotte, die Ansicht zeichnet wie sonst). `full`: Das Pilzbeet auf
 * diesem Feld trägt Leuchtpilze (sonst ist es abgeerntet). Kein Gold: Beet, Quelle und Trog sind keine Aktion.
 */
export function caveBoxes(world: Realms, c: Cell, x: number, y: number, full = true): readonly Box[] | null {
  if (SUPPLIES.has(c.deco)) return supplyBoxes(c, x, y);
  if (c.deco === 'shroombed') return shroomBed(c, x, y, full);
  const h = c.h;
  switch (c.deco) {
    case 'shed':
      return shed(world, c, x, y);
    case 'cavelamp': // Pfosten aus Stein, obenauf ein Kristall
      return [
        [x + 0.4, y + 0.42, h, 0.2, 0.16, 0.9, ...C.rock],
        [x + 0.33, y + 0.36, h + 0.9, 0.34, 0.28, 0.34, c.color ?? KR, c.color ?? KR],
      ];
    case 'column': {
      // geschliffene, freistehende Kristallsäule, Höhe aus `note`
      const color = C.crystals[hash(3, x, y) % 3]!;
      const top = c.note ?? 3;
      return [
        [x + 0.2, y + 0.25, h, 0.6, 0.5, 0.25, ...C.rock],
        [x + 0.3, y + 0.33, h + 0.25, 0.4, 0.34, top - 0.25, color, color],
      ];
    }
    case 'crystalarch': {
      // Kristallbogen: Pfeiler an den Enden (note 0 und 4), darüber durchgehend ein Bogen in drei Farben
      // Unterkante des Bogens auf der Höhe, an der die Fledermäuse hängen (`ARCH_PERCH`, `Cell.perch`)
      const beam: Box = [x, y + 0.3, h + ARCH_PERCH, 1, 0.4, 0.45, C.bands[1], C.bands[2]];
      const color = C.crystals[(c.note ?? 0) % 3]!;
      const gem: Box = [x + 0.38, y + 0.28, h + ARCH_PERCH + 0.45, 0.24, 0.3, 0.24, color, color];
      if (c.note === 0 || c.note === 4) return [[x + 0.2, y + 0.25, h, 0.6, 0.5, ARCH_PERCH, ...C.rock], beam, gem];
      return [beam, gem];
    }
    case 'glowshroom': // kleiner Leuchtpilz: Stiel und Hut in seiner Farbe
      return [
        [x + 0.46, y + 0.5, h, 0.08, 0.08, 0.16, '#efe4d2', '#f7efe2'],
        [x + 0.36, y + 0.42, h + 0.16, 0.28, 0.24, 0.1, c.color ?? KP, c.color ?? KP],
      ];
    case 'stalagmite': {
      // Stalagmit in drei Höhen (`note` 0 … 2), in den Schichten des Steins; draußen in der Landschaft wie immer
      if (c.region !== 'hoehle') return null;
      const k = 1 + (c.note ?? 0) * 0.5;
      const [a, b] = [C.bands[1], C.bands[3]];
      return [
        [x + 0.22, y + 0.3, h, 0.56, 0.5, 0.4 * k, b, a],
        [x + 0.32, y + 0.38, h + 0.4 * k, 0.36, 0.32, 0.4 * k, a, b],
        [x + 0.41, y + 0.45, h + 0.8 * k, 0.18, 0.16, 0.35 * k, b, a],
      ];
    }
    default:
      return null;
  }
}

/** Futter und Wasser: Pilzschale, Steintrog mit Tropfmoos am Rand, Tropfquelle über dem Becken, Tropfmoos */
const SUPPLIES: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>([
  'shroombowl',
  'stonetrough',
  'dripspring',
  'dripmoss',
]);

function supplyBoxes(c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  switch (c.deco) {
    case 'shroombowl': // Schale aus Stein, darin Leuchtpilze in drei Farben
      return [
        [x + 0.12, y + 0.2, h, 0.76, 0.6, 0.3, ...C.rock],
        [x + 0.22, y + 0.3, h + 0.3, 0.14, 0.14, 0.12, KP, KP],
        [x + 0.45, y + 0.38, h + 0.3, 0.14, 0.14, 0.16, KT, KT],
        [x + 0.64, y + 0.3, h + 0.3, 0.14, 0.14, 0.12, C.shrooms[2], C.shrooms[2]],
      ];
    case 'stonetrough': // Trog aus Stein mit türkisem Wasser, am Rand ein Büschel Tropfmoos (für die Moosfresser)
      return [
        [x + 0.1, y + 0.22, h, 0.8, 0.56, 0.34, ...C.rock],
        [x + 0.18, y + 0.3, h + 0.34, 0.64, 0.4, 0.02, ...C.water],
        [x - 0.04, y + 0.62, h, 0.26, 0.28, 0.16, ...C.moss],
        [x + 0.04, y + 0.7, h + 0.16, 0.06, 0.06, 0.04, DROP, DROP],
      ];
    case 'dripspring': // Tropfquelle: bemooster Fels mit vorstehender Lippe, von der Tropfen ins Becken fallen
      return [
        [x + 0.12, y + 0.35, h, 0.76, 0.6, 0.9, ...C.rock],
        [x + 0.2, y + 0.1, h + 0.7, 0.6, 0.35, 0.2, C.rock[0], C.moss[1]],
        [x + 0.12, y + 0.35, h + 0.9, 0.76, 0.6, 0.06, ...C.moss],
        [x + 0.46, y + 0.1, h + 0.4, 0.08, 0.08, 0.1, DROP, DROP],
        [x + 0.47, y + 0.02, h + 0.1, 0.06, 0.06, 0.08, DROP, DROP],
      ];
    case 'dripmoss': // Tropfmoos: flaches Moospolster, darauf türkise Tropfen (begehbar)
      return [
        [x + 0.15, y + 0.2, h, 0.32, 0.3, 0.08, ...C.moss],
        [x + 0.52, y + 0.5, h, 0.3, 0.28, 0.1, ...C.moss],
        [x + 0.26, y + 0.3, h + 0.08, 0.06, 0.06, 0.04, DROP, DROP],
        [x + 0.63, y + 0.58, h + 0.1, 0.06, 0.06, 0.04, DROP, DROP],
      ];
    default:
      return [];
  }
}

/** Lage der drei Leuchtpilze im Beet: Mitte, Höhe des Stiels */
const BED_SHROOMS = [
  [0.3, 0.38, 0.14],
  [0.62, 0.32, 0.1],
  [0.46, 0.64, 0.18],
] as const;

/**
 * Pilzbeet: niedriger Rand aus Stein, darin Moos; voll stehen drei Leuchtpilze darauf, je einer in Rosa, Türkis und
 * Gelb (die Reihe der Farben je Feld verschieden), abgeerntet nur Moos mit kleinen Stummeln
 */
function shroomBed(c: Cell, x: number, y: number, full: boolean): Box[] {
  const h = c.h;
  const out: Box[] = [
    [x + 0.06, y + 0.12, h, 0.88, 0.76, 0.14, ...C.rock],
    [x + 0.14, y + 0.2, h + 0.14, 0.72, 0.6, 0.02, ...C.moss],
  ];
  const turn = hash(6, x, y) % 3;
  BED_SHROOMS.forEach(([dx, dy, stem], i) => {
    const top = h + 0.16;
    if (!full) return void out.push([x + dx - 0.03, y + dy - 0.03, top, 0.06, 0.06, 0.03, ...STEM]);
    const color = C.shrooms[(i + turn) % 3]!;
    out.push(
      [x + dx - 0.04, y + dy - 0.04, top, 0.08, 0.08, stem, ...STEM],
      [x + dx - 0.12, y + dy - 0.1, top + stem, 0.24, 0.2, 0.09, color, color],
    );
  });
  return out;
}

/**
 * Unterstand am Höhlenbett (vorn offen): Jedes Feld der Rückwand ist ein Stück Kristallwand (Fels mit
 * Kristallen), die Mitte (`shelterStem`) trägt dazu das Dach über dem Unterstand und zwei Holzpfosten vorn
 */
function shed(world: Realms, c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  const color = C.crystals[hash(4, x, y) % 3]!;
  const out: Box[] = [
    [x, y + 0.5, h, 1, 0.5, SHED_H, ...C.rock],
    [x + 0.3, y + 0.42, h + 0.5 + (hash(5, x, y) % 3) * 0.3, 0.3, 0.1, 0.4, color, color],
  ];
  const home = world.homes.hoehle;
  if (x !== home.shelterStem[0] || y !== home.shelterStem[1]) return out;
  const { x0, x1, y1 } = home.shelter;
  const d = y1 + 1 - (y + 0.5);
  out.push(
    [x0 - 0.1, y + 0.5, h + SHED_H, x1 - x0 + 1.2, d, 0.25, ...C.roof, 'see'],
    [x0 + 0.05, y1 + 0.7, h, 0.2, 0.2, SHED_H, ...C.wood],
    [x1 + 0.75, y1 + 0.7, h, 0.2, 0.2, SHED_H, ...C.wood],
  );
  return out;
}

/** Farbe der Schicht auf Höhe `h` (Seiten der Klippen und des Bodens wie am Höhlentor) */
export const band = (h: number) => C.bands[h % C.bands.length]!;

/** Farbe heller machen um `l` (0,35: um 35 %), für den Lichtfleck in 2D als halb durchsichtiges Licht obenauf */
export const glowOver = (l: number) => `rgba(255, 246, 220, ${Math.min(0.45, l).toFixed(2)})`;
