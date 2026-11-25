// Aussehen der Dinge in der Kristallgrotte, gleich für 2D und 3D: Pilzschale und Steintrog (leer oder voll, Tropfmoos am Rand),
// Unterstand mit der Kristallwand, Kristall-Lampen, Kristallsäulen (leuchten kurz heller, wenn sie klingen), Kristallbogen,
// weiß-blaue Deko-Pilze, Pilzbeete (Büschel aus fünf Pilzen mit dunklem Felsrand, leer Stümpfe), Tropfquelle (heller Fels
// mit Wasserstreifen), Tropfmoos, helle Steine am Seeufer, Stalagmiten in drei Höhen (dunkler Fuß, Spitze in der
// Farbe ihrer Zone), der Holzsteg, der Sockel der Kristall-Laterne und die Füllung (Kristallbüsche, Felsbrocken, Moos auf
// Felsinseln, Lehm, Pfützen, Farn) samt der Fülle (Kristallfelder, Adern im Boden, Leuchtmoos, der Wasserfall am See,
// `adornBoxes`, `waterfallBoxes`) und das Netz der Tupfspinne (`webBoxes`, mitwachsen-spider-look.ts); dazu Boden und Klippen in den Schichten des Höhlentors, Flecken im Boden in 2D
// (`patchOf`) und die Lichtflecken. Eigene Voxel-Grafik: keine Drusen, keine Loren, kein Tropfstein mit Kessel. Rein (ohne
// DOM und Three.js): liefert Quader in Feldern, die beide Ansichten zeichnen. Teil des Welt-Pakets der Höhlenwelt: 2D über
// view-2d.ts, 3D über den 3D-Teil view-3d.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { GROTTE, GROTTE_COLORS, JETTY_EAST } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { ARCH_PERCH } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import { hash } from '../../../../lib/games/rng';
import type { Cell } from '../../mitwachsen-cell';
import type { Realms } from '../../mitwachsen-home';
import type { Box } from '../../mitwachsen-view';
import { POST_H } from './mitwachsen-lantern';
import { webBoxes } from './mitwachsen-spider-look';

const C = GROTTE_COLORS;
const [KR, KT] = C.crystals;
/** Höhe der Kristallwand und des Dachs des Unterstands am Bett */
export const SHED_H = 2.2;

/** Stiel der Leuchtpilze */
const STEM: readonly [string, string] = ['#efe4d2', '#f7efe2'];
/** Fuß und Mitte von Stalagmiten und Felsbrocken: dunkel, gegen den hellen Boden mindestens 3 : 1 */
const [FOOT, MID] = C.stal;
/** Tropfwasser: türkise Tropfen */
const DROP = C.water[1];

/**
 * Ein Ding der Grotte als Quader (null: kein Ding der Grotte, die Ansicht zeichnet wie sonst). `full`: Das Pilzbeet auf
 * diesem Feld trägt Leuchtpilze (sonst ist es abgeerntet), in Pilzschale und Steintrog liegen Pilze bzw. steht Wasser
 * (sonst sind sie leer). Kein Gold: Beet, Quelle und Trog sind keine Aktion.
 */
export function caveBoxes(world: Realms, c: Cell, x: number, y: number, full = true): readonly Box[] | null {
  if (c.deco === 'shroombowl' || c.deco === 'stonetrough') return bowlBoxes(c, x, y, full);
  const own = OWN.get(c.deco); // Wasser, Füllung
  if (own) return own(c, x, y);
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
    case 'column':
      return columnBoxes(c, x, y);
    case 'jetty': // Planke des Holzstegs: zwei Bretter quer zur Laufrichtung, dazwischen eine schmale Fuge
      if ((c.note ?? 0) >= JETTY_EAST)
        return [
          [x + 0.04, y + 0.02, h, 0.44, 0.96, 0.06, ...C.jetty],
          [x + 0.52, y + 0.02, h, 0.44, 0.96, 0.06, ...C.jetty],
        ];
      return [
        [x + 0.02, y + 0.04, h, 0.96, 0.44, 0.06, ...C.jetty],
        [x + 0.02, y + 0.52, h, 0.96, 0.44, 0.06, ...C.jetty],
      ];
    case 'crystalarch': {
      // Kristallbogen: Pfeiler an den Enden (note 0 und 4), darüber durchgehend ein Bogen in drei Farben
      // Unterkante des Bogens auf der Höhe, an der die Fledermäuse hängen (`ARCH_PERCH`, `Cell.perch`)
      const beam: Box = [x, y + 0.3, h + ARCH_PERCH, 1, 0.4, 0.45, C.bands[1], C.bands[2]];
      const color = C.crystals[(c.note ?? 0) % 3]!;
      const gem: Box = [x + 0.38, y + 0.28, h + ARCH_PERCH + 0.45, 0.24, 0.3, 0.24, color, color];
      if (c.note === 0 || c.note === 4) return [[x + 0.2, y + 0.25, h, 0.6, 0.5, ARCH_PERCH, ...C.rock], beam, gem];
      return [beam, gem];
    }
    case 'glowshroom': {
      // kleiner Deko-Pilz: Stiel und Hut in Weiß-Blau (nie in den Farben der Sammelpilze), kleiner als ein Pilz im Beet
      const k = c.color ?? C.decoShroom;
      return [
        [x + 0.47, y + 0.5, h, 0.06, 0.06, 0.1, ...STEM],
        [x + 0.4, y + 0.44, h + 0.1, 0.2, 0.18, 0.07, k, k],
      ];
    }
    default:
      return null;
  }
}

/** Farbe `hex` um `k` (0 … 1) zum Weiß hin aufhellen */
export function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * Math.max(0, Math.min(1, k)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Geschliffene, freistehende Kristallsäule des Säulen-Glockenspiels auf ihrem Sockel, so hoch wie ihr Ton es sagt
 * (`GROTTE.hall.columns`, der tiefste Ton die höchste). `glow` (0 … 1): so viel heller leuchtet sie gerade, nachdem sie
 * geklungen hat (mitwachsen-chime-look.ts); der Sockel bleibt Stein
 */
export function columnBoxes(c: Cell, x: number, y: number, glow = 0): Box[] {
  const color = lighten(C.crystals[hash(3, x, y) % 3]!, glow * 0.6);
  const top = C_HEIGHTS[c.note ?? 0] ?? C_HEIGHTS[0];
  const h = c.h;
  return [
    [x + 0.2, y + 0.25, h, 0.6, 0.5, 0.25, ...C.rock],
    [x + 0.3, y + 0.33, h + 0.25, 0.4, 0.34, top - 0.25, color, lighten(color, 0.15)],
  ];
}
const C_HEIGHTS = GROTTE.hall.columns;

/** Wasser: Tropfquelle über dem Becken, Tropfmoos (Pilzschale und Steintrog: `bowlBoxes`) */
const SUPPLIES: readonly Cell['deco'][] = ['dripspring', 'dripmoss'];
/** Füllung der Grotte (mitwachsen-fill.ts); Farn und Felsbrocken gibt es auch in der Landschaft */
const FILL: readonly Cell['deco'][] = ['crystalbush', 'boulder', 'mosstop', 'clay', 'puddle', 'fern'];
/** Fülle der Grotte (mitwachsen-fill.ts, `adornGrotte`): flach und begehbar */
const ADORN: readonly Cell['deco'][] = ['crystalfield', 'vein', 'glowmoss', 'shore'];
/** Wer die Quader dieser Dinge baut */
const OWN = new Map<Cell['deco'], (c: Cell, x: number, y: number) => Box[] | null>([
  ...SUPPLIES.map((d) => [d, supplyBoxes] as const),
  ...FILL.map((d) => [d, fillBoxes] as const),
  ['lantern', post],
  ['stalagmite', stalagmite],
  ...ADORN.map((d) => [d, adornBoxes] as const),
  ['waterfall', (c: Cell, x: number, y: number) => (c.region === 'hoehle' ? waterfallBoxes(c, x, y) : null)],
  ['web', webBoxes], // Netz der Tupfspinne (mitwachsen-spider-look.ts)
]);

/**
 * Stalagmit in drei Höhen (`note` 0 … 2): dunkler Fuß, darüber die Mitte, die Spitze in der Farbe seiner Zone
 * (`Cell.color`, mitwachsen-fill.ts) mit einem hellen Tupfen obenauf; draußen in der Landschaft wie immer
 */
function stalagmite(c: Cell, x: number, y: number): Box[] | null {
  if (c.region !== 'hoehle') return null;
  const [h, k] = [c.h, 1 + (c.note ?? 0) * 0.5];
  const tip = c.color ?? C.tips.hall;
  return [
    [x + 0.22, y + 0.3, h, 0.56, 0.5, 0.4 * k, FOOT, MID],
    [x + 0.32, y + 0.38, h + 0.4 * k, 0.36, 0.32, 0.4 * k, MID, tip],
    [x + 0.41, y + 0.45, h + 0.8 * k, 0.18, 0.16, 0.35 * k, tip, lighten(tip, 0.3)],
  ];
}

/** Sockel der Kristall-Laterne: niedriger Steinblock mit Platte, kein Gold (die Laterne darauf ist ein Körper) */
function post(c: Cell, x: number, y: number): Box[] {
  return [
    [x + 0.28, y + 0.3, c.h, 0.44, 0.4, POST_H - 0.06, ...C.rock],
    [x + 0.22, y + 0.24, c.h + POST_H - 0.06, 0.56, 0.52, 0.06, C.rock[1], C.rock[1]],
  ];
}

/**
 * Pilzschale und Steintrog am Bett, leer oder voll (`full`: gerade gefüllt, die Tiere fressen und trinken, bis sie nach
 * `REGROW` Takten wieder leer sind, mitwachsen-chores.ts): die Schale aus Stein, voll mit einem Häufchen Leuchtpilze in
 * den drei Farben, leer ihr dunkler Boden; der Trog aus Stein, voll mit türkisem Wasser, leer trocken; am Rand des Trogs
 * immer ein Büschel Tropfmoos (für die Moosfresser)
 */
function bowlBoxes(c: Cell, x: number, y: number, full: boolean): Box[] {
  const h = c.h;
  if (c.deco === 'shroombowl') {
    const bowl: Box[] = [
      [x + 0.12, y + 0.2, h, 0.76, 0.6, 0.3, ...C.rock],
      [x + 0.2, y + 0.28, h + 0.3, 0.6, 0.44, 0.01, ...C.bedRim],
    ];
    if (!full) return bowl;
    return [
      ...bowl,
      [x + 0.2, y + 0.3, h + 0.3, 0.18, 0.16, 0.12, C.shrooms[0], C.shrooms[0]],
      [x + 0.42, y + 0.36, h + 0.3, 0.18, 0.16, 0.18, C.shrooms[1], C.shrooms[1]],
      [x + 0.62, y + 0.3, h + 0.3, 0.18, 0.16, 0.12, C.shrooms[2], C.shrooms[2]],
      [x + 0.34, y + 0.5, h + 0.3, 0.16, 0.14, 0.1, C.shrooms[2], C.shrooms[2]],
    ];
  }
  return [
    [x + 0.1, y + 0.22, h, 0.8, 0.56, 0.34, ...C.rock],
    full
      ? [x + 0.18, y + 0.3, h + 0.34, 0.64, 0.4, 0.02, ...C.water]
      : [x + 0.18, y + 0.3, h + 0.34, 0.64, 0.4, 0.01, ...C.bedRim],
    [x - 0.04, y + 0.62, h, 0.26, 0.28, 0.16, ...C.moss],
    [x + 0.04, y + 0.7, h + 0.16, 0.06, 0.06, 0.04, DROP, DROP],
  ];
}

function supplyBoxes(c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  switch (c.deco) {
    case 'dripspring': // Tropfquelle: heller Fels, vorn ein Wasserstreifen von der Lippe hinab, oben Moos; Tropfen fallen ins Becken
      return [
        [x + 0.12, y + 0.35, h, 0.76, 0.6, 0.9, ...C.bright],
        [x + 0.2, y + 0.1, h + 0.7, 0.6, 0.35, 0.2, C.bright[0], C.moss[1]],
        [x + 0.12, y + 0.35, h + 0.9, 0.76, 0.6, 0.06, ...C.moss],
        [x + 0.42, y + 0.09, h + 0.12, 0.16, 0.02, 0.58, ...C.water],
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

/**
 * Füllung der Grotte (mitwachsen-fill.ts): Kristallbusch (vier kurze Kristalle in seiner Farbe auf einem flachen Stein, kein Moos fern der Lichtschächte, niedriger als die Figur),
 * Felsbrocken (dunkler Fuß, Kappe in der Farbe der Zone), Moos auf einer Felsinsel, Lehm am Hang des Dachses (mit einem
 * Erdhügelchen), Pfütze (flach, türkis, mit Glanz), Farn (Wedel in Moosgrün)
 */
function fillBoxes(c: Cell, x: number, y: number): Box[] | null {
  if (c.region !== 'hoehle') return null; // Farn und Felsbrocken draußen in der Landschaft: wie immer
  const h = c.h;
  switch (c.deco) {
    case 'crystalbush': {
      const k = c.color ?? KT;
      const l = lighten(k, 0.3);
      return [
        [x + 0.16, y + 0.24, h, 0.68, 0.56, 0.08, C.bands[3], C.bands[1]],
        [x + 0.24, y + 0.32, h + 0.08, 0.16, 0.14, 0.42, k, l],
        [x + 0.44, y + 0.28, h + 0.08, 0.14, 0.14, 0.6, l, k],
        [x + 0.6, y + 0.4, h + 0.08, 0.16, 0.14, 0.36, k, l],
        [x + 0.38, y + 0.56, h + 0.08, 0.16, 0.14, 0.3, l, k],
      ];
    }
    case 'boulder': {
      // Felsbrocken: dunkler Fuß, obenauf eine Kappe in der Farbe seiner Zone (`Cell.color`)
      const tip = c.color ?? C.tips.hall;
      return [
        [x + 0.12, y + 0.2, h, 0.76, 0.62, 0.42, FOOT, MID],
        [x + 0.24, y + 0.3, h + 0.42, 0.5, 0.4, 0.18, tip, lighten(tip, 0.3)],
      ];
    }
    case 'mosstop':
      return [
        [x + 0.04, y + 0.04, h, 0.92, 0.92, 0.04, ...C.moss],
        [x + 0.3 + (hash(7, x, y) % 3) * 0.12, y + 0.4, h + 0.04, 0.16, 0.14, 0.06, C.moss[1], C.moss[1]],
      ];
    case 'clay':
      return [
        [x, y, h, 1, 1, 0.03, ...C.clay],
        ...(hash(8, x, y) % 3 === 0 ? [[x + 0.3, y + 0.35, h + 0.03, 0.34, 0.26, 0.1, ...C.clay] as Box] : []),
      ];
    case 'puddle':
      return [
        [x + 0.12, y + 0.18, h, 0.76, 0.6, 0.02, ...C.water],
        [x + 0.3, y + 0.3, h + 0.02, 0.18, 0.06, 0.01, C.water[1], '#ffffff'],
      ];
    default: // Farn: vier Wedel und ein Blatt quer darüber, in Moosgrün
      return [
        ...[
          [0.3, 0.45, 0.32],
          [0.48, 0.38, 0.4],
          [0.62, 0.5, 0.3],
          [0.42, 0.58, 0.26],
        ].map(([fx, fy, fh]): Box => [x + fx! - 0.05, y + fy!, h, 0.1, 0.06, fh!, ...C.moss]),
        [x + 0.28, y + 0.42, h + 0.2, 0.44, 0.14, 0.04, C.moss[1], C.moss[1]],
      ];
  }
}

/** Lage der fünf Leuchtpilze im Büschel: Mitte, Höhe des Stiels, Breite des Huts (der mittlere hinten am höchsten) */
const BED_SHROOMS = [
  [0.48, 0.42, 0.42, 0.3],
  [0.26, 0.36, 0.3, 0.26],
  [0.7, 0.34, 0.32, 0.26],
  [0.32, 0.64, 0.22, 0.24],
  [0.64, 0.66, 0.2, 0.22],
] as const;
/** Höhe des Felsrands um das Beet */
const RIM_H = 0.16;

/**
 * Pilzbeet: dunkler Felsrand, darin Moos; voll steht darauf ein Büschel aus fünf Leuchtpilzen in einer Farbe (je Beet
 * Rosa, Türkis oder Gelb), etwa 0,7 hoch wie ein Beerenbusch; abgeerntet nur Stümpfe im Moos
 */
function shroomBed(c: Cell, x: number, y: number, full: boolean): Box[] {
  const h = c.h;
  const out: Box[] = [
    [x + 0.04, y + 0.1, h, 0.92, 0.8, RIM_H, ...C.bedRim],
    [x + 0.12, y + 0.18, h + RIM_H, 0.76, 0.64, 0.02, ...C.moss],
  ];
  const color = bedColor(x, y);
  const top = h + RIM_H + 0.02;
  for (const [dx, dy, stem, w] of BED_SHROOMS) {
    if (!full) {
      out.push([x + dx - 0.04, y + dy - 0.04, top, 0.08, 0.08, 0.06, ...STEM]);
      continue;
    }
    out.push(
      [x + dx - 0.04, y + dy - 0.04, top, 0.08, 0.08, stem, ...STEM],
      [x + dx - w / 2, y + dy - w * 0.4, top + stem, w, w * 0.8, 0.1, color, lighten(color, 0.25)],
    );
  }
  return out;
}

/** Farbe der Pilze eines Beets: je Beet eine der drei Farben der Sammelpilze, fest aus seiner Lage */
export const bedColor = (x: number, y: number): string => C.shrooms[hash(6, x, y) % 3]!;

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

/**
 * Fleck im Grottenboden (nur 2D; 3D hat den etwas dunkleren Boden): auf freiem Grottenboden der Grotte, wo das weiche Rauschen des Bodens
 * (`Cell.shade`) über die Schwellen in `GROTTE.patch` geht, kühl lila oder zart rosé; nie auf Licht oder Randschatten
 * (die haben Vorrang), nie auf Moos, Steg oder Fels. Sonst undefined
 */
export function patchOf(c: Cell): string | undefined {
  if (c.region !== 'hoehle' || c.ground !== 'grotto' || c.light || c.dim || c.shade === undefined) return undefined;
  const { cool, warm } = GROTTE.patch;
  return c.shade < cool ? C.patches[0] : c.shade > warm ? C.patches[1] : undefined;
}

/** Farbe der Schicht auf Höhe `h` (Seiten der Klippen und des Bodens wie am Höhlentor) */
export const band = (h: number) => C.bands[h % C.bands.length]!;

/** Farbe heller machen um `l` (0,35: um 35 %), für den Lichtfleck in 2D als halb durchsichtiges Licht obenauf */
export const glowOver = (l: number) => `rgba(255, 246, 220, ${Math.min(0.45, l).toFixed(2)})`;

/** Splitter eines Kristallfelds: Lage, Breite, Höhe; in der Mitte (`note` 1) einer mehr und höher */
const SHARDS = [
  [0.22, 0.3, 0.12, 0.22],
  [0.58, 0.24, 0.1, 0.16],
  [0.4, 0.58, 0.12, 0.26],
  [0.7, 0.62, 0.1, 0.14],
] as const;
/** Streifen einer Ader je Richtung (`note`): Stücke [dx, dy, Breite, Tiefe]; schräg als Treppe aus drei Stücken */
const VEIN: readonly (readonly (readonly [number, number, number, number])[])[] = [
  [[0, 0.44, 1, 0.12]],
  [[0.44, 0, 0.12, 1]],
  [
    [0, 0.06, 0.36, 0.14],
    [0.32, 0.43, 0.36, 0.14],
    [0.64, 0.8, 0.36, 0.14],
  ],
  [
    [0, 0.8, 0.36, 0.14],
    [0.32, 0.43, 0.36, 0.14],
    [0.64, 0.06, 0.36, 0.14],
  ],
];
/** Kiesel am Seeufer: [dx, dy, Breite, Tiefe, Höhe] */
const SHORE: readonly (readonly [number, number, number, number, number])[] = [
  [0.18, 0.22, 0.28, 0.22, 0.1],
  [0.56, 0.5, 0.24, 0.2, 0.08],
  [0.3, 0.62, 0.18, 0.16, 0.07],
];
/** Leuchtmoos an der Wand je Seite (`note`, wie `SIDES` in mitwachsen-fill.ts): [dx, dy, Breite, Tiefe] des Polsters, das hochwächst */
const CLIMB: readonly (readonly [number, number, number, number])[] = [
  [0.14, 0, 0.72, 0.1],
  [0.9, 0.14, 0.1, 0.72],
  [0.14, 0.9, 0.72, 0.1],
  [0, 0.14, 0.1, 0.72],
];

/**
 * Fülle der Grotte, flach und begehbar: helle Steine am Seeufer, Kristallfeld (niedrige Splitter in der Farbe der Zone, `Cell.color`, niedriger
 * als ein Leuchtpilz), Ader (flacher Streifen in Rosa oder Lila, leuchtet nicht), Leuchtmoos (flaches Polster mit hellen
 * Tupfen, am Fuß einer Felswand wächst es an ihr hoch: `note` die Seite)
 */
export function adornBoxes(c: Cell, x: number, y: number): Box[] | null {
  if (c.region !== 'hoehle') return null;
  const h = c.h;
  if (c.deco === 'crystalfield') {
    const k = c.color ?? KR;
    const l = lighten(k, 0.35);
    const shards = c.note === 1 ? SHARDS : SHARDS.slice(0, 3);
    const turn = hash(9, x, y) % 2 ? -1 : 1; // gespiegelt je Feld
    return shards.map(([dx, dy, w, hh]): Box => {
      const sx = turn > 0 ? dx : 1 - dx - w;
      return [x + sx, y + dy, h, w, w, hh * (c.note === 1 ? 1.25 : 1), k, l];
    });
  }
  if (c.deco === 'shore') {
    // helle Steine am Seeufer: zwei oder drei flache Kiesel, je Feld anders gelegt
    const n = 2 + (hash(10, x, y) % 2);
    return SHORE.slice(0, n).map(([dx, dy, w, d, hh]): Box => [x + dx, y + dy, h, w, d, hh, ...C.bright]);
  }
  if (c.deco === 'vein') {
    const k = c.color ?? C.veins[0];
    return (VEIN[c.note ?? 0] ?? VEIN[0]!).map(([dx, dy, w, d]): Box => [x + dx, y + dy, h, w, d, 0.015, k, k]);
  }
  // Leuchtmoos
  const [foot, glow] = C.glowmoss;
  const out: Box[] = [
    [x + 0.14, y + 0.2, h, 0.72, 0.62, 0.05, foot, glow],
    [x + 0.3, y + 0.34, h + 0.05, 0.1, 0.1, 0.04, glow, glow],
    [x + 0.58, y + 0.5, h + 0.05, 0.1, 0.1, 0.04, glow, glow],
  ];
  const climb = c.note === undefined ? undefined : CLIMB[c.note];
  if (climb) out.push([x + climb[0], y + climb[1], h, climb[2], climb[3], 0.9, glow, glow]);
  return out;
}

/** So oft fällt ein heller Streifen den Wasserfall hinunter (ms) */
export const FALL_MS = 900;

/**
 * Kleiner Wasserfall am stillen See (mitwachsen-fill.ts): ein bemooster Fels, an seiner Südseite fällt türkises Wasser
 * bis auf den See (Höhe 0,8 wie das Wasser in 2D), unten Schaum. `now`: zwei helle Streifen gleiten hinunter (2D); ohne
 * (3D, reduzierte Bewegung) stehen sie still
 */
export function waterfallBoxes(c: Cell, x: number, y: number, now?: number): Box[] {
  const h = c.h;
  const top = h + GROTTE.waterfall.h;
  const [deep, light] = C.water;
  const fall = top - 0.8;
  const glints = [0, 0.5].map((i): Box => {
    const p = now === undefined ? i + 0.25 : (now / FALL_MS + i) % 1;
    return [x + 0.34, y + 0.99, top - 0.25 - p * (fall - 0.3), 0.32, 0.02, 0.18, '#ffffff', light];
  });
  return [
    [x + 0.06, y + 0.1, h, 0.88, 0.76, GROTTE.waterfall.h, ...C.rock],
    [x + 0.06, y + 0.1, top, 0.88, 0.76, 0.08, ...C.glowmoss],
    [x + 0.3, y + 0.86, 0.8, 0.4, 0.12, fall + 0.04, deep, light],
    ...glints,
    [x + 0.18, y + 0.84, 0.8, 0.64, 0.16, 0.08, light, '#ffffff'],
  ];
}
