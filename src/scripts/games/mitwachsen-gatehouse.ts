// Torhäuser und Portal-Plattformen der 3D-Ansicht: mächtige Tore im Felsring, je Welt anders geschmückt, und flache
// Plattformen aus Voxeln. Liefert nur Geometrie in eigenen Koordinaten; die 3D-Ansicht stellt sie an ihren Platz.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
//
// Koordinaten: x entlang des Tors (Mitte 0), y nach oben, z nach vorn (+z schaut zur Lichtung bzw. zum Bett).
// Ein Torhaus ist 9 Felder breit (Tor 5, Türme je 2) und reicht 3 Felder tief in den Fels; seine zwei Türflügel sind
// eigene Teile, die sich nach innen drehen. Eine Portal-Plattform ist 3 × 3 Felder groß und flach.

import { THEME_COLORS, type GateTheme } from '../../data/games/mitwachsen';
import { GOLD, SUB, platformLook, voxelSpan, type PlatformVoxel } from '../../data/games/mitwachsen-portals';
import { GUEST_COLORS, GUEST_OUTLINE, GUEST_PX, GUEST_Y } from './mitwachsen-guest-look';
import { Geo, col, type Tile, type V3 } from './mitwachsen-geo';

/** Teile, die mit verschiedenen Materialien gezeichnet werden */
export type Parts = {
  solid: Geo; // Stein, Holz, Eis … (wird vor der Figur durchsichtig, damit man sie hinter dem Tor sieht)
  lava: Geo; // glühende Lava
  bright: Geo; // leuchtet aus sich selbst: Kristalle, Zeichen, Wasserfall
  leaves: Geo; // Laub
};
export const parts = (): Parts => ({ solid: new Geo(), lava: new Geo(), bright: new Geo(), leaves: new Geo() });

/** Mauerwerk je Welt: Kachel und Tönung */
const WALL: Record<GateTheme, { tile: Tile; tint: string; top?: Tile }> = {
  eis: { tile: 'ice', tint: '#ffffff' },
  sand: { tile: 'sandstone', tint: '#ffffff' },
  wasser: { tile: 'stone', tint: '#a9c9ea' },
  lava: { tile: 'basalt', tint: '#ffffff' },
  hoehle: { tile: 'cave', tint: '#ffffff' },
  wald: { tile: 'log', tint: '#ffffff', top: 'logTop' },
  wolken: { tile: 'cloud', tint: '#ffffff' },
  pilze: { tile: 'cloud', tint: '#efe4d2' },
};

const W = 2.5; // halbe Torbreite
const TOWER_W = 2; // Turmbreite
const TOWER_H = 6.6;
const ARCH_Y = 4.7; // Unterkante des Torbogens
const DEPTH = 2.5; // so weit reicht das Torhaus nach hinten
const HINGE_Z = -0.75; // die Türflügel drehen sich um ihre hintere Kante nach innen (weg von der Lichtung)
const GAP = 0.2; // geöffnet: Spalt zwischen Flügel und Rahmen, damit sie beim Drehen nirgends anstoßen
const SEAM = 0.06; // Umriss: so weit bleibt er von der Mitte der Tür weg (dort treffen sich die Flügel)

/** Ein Türflügel: eigene Teile, die um ihre Angel (x, z) um `angle` gedreht stehen (um die senkrechte Achse, Bogenmaß) */
export type Wing = { parts: Parts; hinge: readonly [number, number]; angle: number };

/** Quader mit Ecke (x0, y0, z0) und Gegenecke (x1, y1, z1) – im Torhaus leichter zu lesen als Ecke und Größe */
function block(
  g: Geo,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  side: string,
  top?: string | null,
  tile?: Tile,
  topTile?: Tile,
) {
  g.box(x0, y0, z0, x1 - x0, y1 - y0, z1 - z0, side, top ?? side, tile, topTile);
}

/**
 * Ein mächtiges Torhaus: zwei Türme, Torbogen, Doppeltür mit leuchtendem Zeichen, Schmuck der Welt. `open` sagt, wie
 * weit die Tür offen ist (0 zu … 1 ganz offen, die Flügel stehen dann quer im Gang); `outline` zeigt statt des Zeichens
 * den Umriss des verlaufenen Pinguins mit Goldrahmen (solange er die Figur zum Tor führt). Liefert die zwei Türflügel,
 * die die 3D-Ansicht an ihre Angel stellt und dreht; bei `open` 0 sieht alles aus wie die geschlossene Tür.
 */
export function gatehouse(p: Parts, theme: GateTheme, open = 0, outline = false): Wing[] {
  const wall = WALL[theme];
  const glow = THEME_COLORS[theme].portal;
  const wallBlock = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    block(p.solid, x0, y0, z0, x1, y1, z1, wall.tint, wall.tint, wall.tile, wall.top);

  const towerX = [-W - TOWER_W, W]; // linke Kante der Türme
  for (const x0 of towerX) {
    if (theme === 'pilze') {
      // Pilztürme: dicke Stiele, oben ein riesiger Hut mit weißen Tupfen
      wallBlock(x0 + 0.3, 0, -DEPTH + 0.3, x0 + TOWER_W - 0.3, TOWER_H - 0.4, 0.3);
      block(
        p.solid,
        x0 - 0.5,
        TOWER_H - 0.6,
        -DEPTH - 0.2,
        x0 + TOWER_W + 0.5,
        TOWER_H + 0.5,
        0.9,
        '#c8323a',
        '#d9473a',
      );
      block(
        p.solid,
        x0 + 0.1,
        TOWER_H + 0.5,
        -DEPTH + 0.3,
        x0 + TOWER_W - 0.1,
        TOWER_H + 0.9,
        0.4,
        '#c8323a',
        '#d9473a',
      );
      for (const [dx, dz] of [
        [0.15, 0.6], // nicht bündig mit dem Rand des Hutes darunter
        [1.3, 0.2],
        [0.7, -0.9],
        [1.8, -1.6],
        [-0.2, -1.9],
      ] as const)
        block(p.solid, x0 + dx, TOWER_H + 0.5, dz - 0.25, x0 + dx + 0.35, TOWER_H + 0.56, dz + 0.1, '#ffffff');
      for (const dx of [0.2, 1.4])
        block(p.solid, x0 + dx, TOWER_H - 0.1, 0.9, x0 + dx + 0.35, TOWER_H + 0.25, 0.92, '#ffffff');
      continue;
    }
    // Sockel und Turm
    wallBlock(x0 - 0.15, 0, -DEPTH - 0.1, x0 + TOWER_W + 0.15, 0.7, 0.8);
    wallBlock(x0, 0.7, -DEPTH, x0 + TOWER_W, TOWER_H, 0.65);
    // Zinnen (außer bei Welten mit eigener Krone)
    if (theme !== 'sand' && theme !== 'wolken' && theme !== 'wald')
      for (const [dx, dz] of [
        [0, 0.05],
        [TOWER_W - 0.6, 0.05],
        [0, -DEPTH],
        [TOWER_W - 0.6, -DEPTH],
      ] as const)
        wallBlock(x0 + dx, TOWER_H, dz, x0 + dx + 0.6, TOWER_H + 0.6, dz + 0.6);
  }

  // Torbogen über der Tür
  if (theme === 'pilze')
    block(p.solid, -W - 0.2, ARCH_Y, -DEPTH + 0.4, W + 0.2, ARCH_Y + 0.9, 0.35, '#efe4d2', '#f7efe2', 'cloud');
  else wallBlock(-W, ARCH_Y, -DEPTH + 0.2, W, ARCH_Y + 1.2, 0.55);

  const wings = door(glow, open, outline);
  decorate(p, theme);
  return wings;
}

type Leaf = Wing & { side: -1 | 1 }; // links bzw. rechts
type Corners = [x0: number, y0: number, z0: number, x1: number, y1: number, z1: number];

/** Quader (Ecke und Gegenecke in Torhaus-Koordinaten) an einen Flügel heften: um seine Angel verschoben */
function onLeaf(
  l: Leaf,
  part: keyof Parts,
  [x0, y0, z0, x1, y1, z1]: Corners,
  side: string,
  top?: string,
  tile?: Tile,
) {
  const [hx, hz] = l.hinge;
  block(l.parts[part], x0 - hx, y0, z0 - hz, x1 - hx, y1, z1 - hz, side, top, tile);
}

/**
 * Doppeltür aus Holz mit Eisenbändern, vorn und hinten gleich, als zwei Flügel um ihre äußere Angel. Geschlossen laufen
 * Bänder und Zeichen über beide Flügel (sie gehören zum linken, so bleibt die Tür, wie sie war); offen hat jeder Flügel
 * seine eigenen Bänder und Abstand zum Rahmen, ein Zeichen gibt es dann nicht mehr. Der Umriss sitzt vorn auf beiden.
 */
function door(glow: string, open: number, outline: boolean): Wing[] {
  const wood = '#6b4423',
    woodTop = '#7d5232',
    iron = '#3a3a44';
  const outer = W - 0.05 - (open > 0 ? GAP : 0);
  const leaves = ([-1, 1] as const).map((side): Leaf => ({
    parts: parts(),
    hinge: [side * outer, HINGE_Z],
    angle: (-side * open * Math.PI) / 2,
    side,
  }));
  const bands = (l: Leaf, x0: number, x1: number) => {
    for (const y of [0.7, 2.3, 3.9]) {
      onLeaf(l, 'solid', [x0, y, -0.33, x1, y + 0.2, -0.28], iron);
      onLeaf(l, 'solid', [x0, y, -0.82, x1, y + 0.2, -0.77], iron);
    }
  };
  for (const l of leaves) {
    const [x0, x1] = l.side < 0 ? [-outer, -0.04] : [0.04, outer];
    onLeaf(l, 'solid', [x0, 0, -0.75, x1, ARCH_Y, -0.35], wood, woodTop, 'planks');
    if (open > 0) bands(l, x0, x1);
  }
  const [left, right] = leaves as [Leaf, Leaf];
  if (open === 0) bands(left, -W + 0.05, W - 0.05);
  // Leuchtendes Zeichen der Welt in der Mitte der geschlossenen Tür (vorn und hinten)
  if (open === 0 && !outline)
    for (const z of [-0.3, -0.86]) {
      onLeaf(left, 'bright', [-0.55, 2.0, z, 0.55, 3.1, z + 0.06], glow);
      const [z0, z1] = z > -0.5 ? [z + 0.05, z + 0.09] : [z - 0.04, z];
      onLeaf(left, 'bright', [-0.3, 2.25, z0, 0.3, 2.85, z1], '#ffffff');
    }
  if (outline) penguinOutline(left, right);
  return leaves.map(({ parts, hinge, angle }) => ({ parts, hinge, angle }));
}

/**
 * Umriss des verlaufenen Pinguins mit Goldrahmen auf der Tür, vorn und hinten wie das Zeichen (Pixel aus
 * `GUEST_OUTLINE`, je eine Lage auf dem Holz): Jedes Pixel gehört zum Flügel, auf dessen Seite es liegt, und hält
 * Abstand zur Mitte (`SEAM`). Gold ersetzt die Pixel darunter, es liegt nichts übereinander.
 */
function penguinOutline(left: Leaf, right: Leaf) {
  const rows = GUEST_OUTLINE.length;
  GUEST_OUTLINE.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const color = GUEST_COLORS[ch as keyof typeof GUEST_COLORS];
      if (!color) return;
      const [x0, x1] = [(c - row.length / 2) * GUEST_PX, (c + 1 - row.length / 2) * GUEST_PX];
      const y = GUEST_Y + (rows - 1 - r) * GUEST_PX;
      const [l, a, b] = x0 + x1 < 0 ? [left, x0, Math.min(x1, -SEAM)] : [right, Math.max(x0, SEAM), x1];
      for (const [z0, z1] of [
        [-0.35, -0.26],
        [-0.84, -0.75],
      ] as const)
        onLeaf(l, 'bright', [a, y, z0, b, y + GUEST_PX, z1], color.side, color.top);
    });
  });
}

/**
 * Goldene Bucht vor dem Tor, solange der verlaufene Pinguin die Figur dorthin führt: ein schmaler Goldrand um die drei
 * Reihen vor der Tür, so breit wie das Tor, vorn vor dem Sockel der Türme. Er liegt je Feld knapp über dessen Boden:
 * `rise(u, t)` ist die Höhe des Felds u (−2 … 2 entlang des Tors) in Reihe t (1 … 3) gegenüber der Tormitte. Felder
 * gleicher Höhe teilen sich ein Stück Rand, an einer Stufe setzt er ab.
 */
export function goldenBay(p: Parts, rise: (u: number, t: number) => number = () => 0) {
  const [w, depth] = [0.12, 3];
  const strip = (x0: number, x1: number, z0: number, z1: number, y: number) =>
    block(p.bright, x0, y + 0.02, z0, x1, y + 0.07, z1, GOLD.side, GOLD.top);
  /** Felder `from` … `to` als Stücke gleicher Höhe: [erstes, letztes, Höhe] */
  const runs = (from: number, to: number, h: (i: number) => number) => {
    const out: [number, number, number][] = [];
    for (let i = from; i <= to; i++) {
      const last = out[out.length - 1];
      if (last && last[2] === h(i)) last[1] = i;
      else out.push([i, i, h(i)]);
    }
    return out;
  };
  const front = (t: number) => (t === 1 ? 0.85 : t - 0.5); // vordere Kante der Reihe t
  for (const [a, b, y] of runs(-2, 2, (u) => rise(u, 1))) strip(a - 0.5, b + 0.5, 0.85, 0.85 + w, y);
  for (const [a, b, y] of runs(-2, 2, (u) => rise(u, depth))) strip(a - 0.5, b + 0.5, depth + 0.5 - w, depth + 0.5, y);
  for (const [u, x0] of [
    [-2, -W],
    [2, W - w],
  ] as const)
    for (const [a, b, y] of runs(1, depth, (t) => rise(u, t)))
      strip(x0, x0 + w, a === 1 ? front(1) + w : front(a), b === depth ? depth + 0.5 - w : b + 0.5, y);
}

/** Schmuck je Welt: Krone der Türme, Dinge am Torbogen */
function decorate(p: Parts, theme: GateTheme) {
  const towerMid = [-W - TOWER_W / 2, W + TOWER_W / 2];
  switch (theme) {
    case 'eis':
      for (const cx of towerMid) {
        block(p.solid, cx - 1.05, TOWER_H + 0.6, -DEPTH - 0.05, cx + 1.05, TOWER_H + 0.85, 0.7, '#ffffff'); // Schneehaube
        for (const [dx, h] of [
          [-0.6, 1.4],
          [0, 2.1],
          [0.55, 1.2],
        ] as const)
          block(
            p.bright,
            cx + dx - 0.18,
            TOWER_H + 0.85,
            -0.9,
            cx + dx + 0.18,
            TOWER_H + 0.85 + h,
            -0.55,
            '#bfeaff',
            '#e8f8ff',
          );
      }
      for (let x = -W + 0.3; x < W; x += 0.55)
        // Eiszapfen am Bogen
        block(p.bright, x, ARCH_Y - 0.25 - (((x * 7) % 3) + 3) * 0.08, 0.35, x + 0.14, ARCH_Y, 0.5, '#d4f1ff');
      break;
    case 'sand':
      for (const cx of towerMid) {
        // Stufenkrone wie bei einer kleinen Pyramide
        block(p.solid, cx - 1.1, TOWER_H, -DEPTH, cx + 1.1, TOWER_H + 0.5, 0.75, '#ffffff', null, 'sandstone');
        block(
          p.solid,
          cx - 0.75,
          TOWER_H + 0.5,
          -DEPTH + 0.35,
          cx + 0.75,
          TOWER_H + 1.0,
          0.4,
          '#ffffff',
          null,
          'sandstone',
        );
        block(
          p.solid,
          cx - 0.4,
          TOWER_H + 1.0,
          -DEPTH + 0.7,
          cx + 0.4,
          TOWER_H + 1.5,
          0.05,
          '#ffffff',
          null,
          'sandstone',
        );
        block(p.bright, cx - 0.2, TOWER_H + 1.5, -DEPTH + 0.9, cx + 0.2, TOWER_H + 1.8, -0.15, '#ffd98a');
      }
      block(p.solid, -W, ARCH_Y + 0.25, 0.56, W, ARCH_Y + 0.4, 0.6, '#2f6fb8'); // Bänder am Bogen
      block(p.solid, -W, ARCH_Y + 0.75, 0.56, W, ARCH_Y + 0.9, 0.6, '#e0a03a');
      break;
    case 'wasser':
      for (const cx of towerMid) {
        block(p.bright, cx - 0.45, 0.7, 0.66, cx + 0.45, TOWER_H, 0.72, '#7fc8ff', '#b8e2ff'); // Wasserfall
        block(p.bright, cx - 0.7, 0.7, 0.68, cx + 0.7, 0.9, 1.1, '#b8e2ff'); // Gischt unten (vor dem Wasserfall, nicht in seiner Ebene)
        for (const [dx, c] of [
          [-0.6, '#f4a7b9'],
          [0.1, '#ffd7a8'],
          [0.6, '#f4a7b9'],
        ] as const)
          block(p.solid, cx + dx - 0.2, TOWER_H + 0.6, -0.4, cx + dx + 0.2, TOWER_H + 0.95, -0.1, c); // Muscheln
      }
      for (let x = -W; x < W; x += 1)
        block(p.bright, x + 0.1, ARCH_Y + 0.5, 0.56, x + 0.8, ARCH_Y + 0.65, 0.6, '#7fc8ff'); // Wellen
      break;
    case 'lava':
      for (const cx of towerMid) {
        block(p.lava, cx - 0.5, 1.2, 0.66, cx - 0.25, TOWER_H - 0.4, 0.7, '#ffffff', null, 'lava'); // Lava-Adern
        block(p.lava, cx + 0.3, 0.7, 0.66, cx + 0.55, TOWER_H - 1.6, 0.7, '#ffffff', null, 'lava');
        block(p.lava, cx - 0.9, TOWER_H + 0.6, -DEPTH + 0.6, cx + 0.9, TOWER_H + 1.0, 0.1, '#ffffff', null, 'lava'); // glühende Krone
      }
      for (const x of [-1.8, -0.6, 0.7, 1.7])
        block(p.lava, x, ARCH_Y - 0.35, 0.36, x + 0.2, ARCH_Y, 0.52, '#ffffff', null, 'lava'); // Tropfen
      break;
    case 'hoehle':
      for (const cx of towerMid) {
        for (const [dx, dz, h, c] of [
          [-0.55, -0.5, 1.6, '#b48cf0'],
          [0.1, -1.2, 2.2, '#6fd6f0'],
          [0.6, -0.3, 1.2, '#f08cc8'],
          [-0.2, -1.8, 1.0, '#b48cf0'],
        ] as const)
          block(p.bright, cx + dx - 0.2, TOWER_H + 0.6, dz - 0.2, cx + dx + 0.2, TOWER_H + 0.6 + h, dz + 0.2, c);
        block(p.bright, cx - 1.3, 0, 0.7, cx - 0.9, 1.2, 1.1, '#b48cf0'); // Kristalle am Fuß
        block(p.bright, cx + 0.95, 0, 0.75, cx + 1.25, 0.8, 1.05, '#6fd6f0');
      }
      break;
    case 'wald':
      for (const cx of towerMid) {
        block(
          p.leaves,
          cx - 1.5,
          TOWER_H - 0.4,
          -DEPTH - 0.4,
          cx + 1.5,
          TOWER_H + 1.0,
          1.0,
          '#3f9a3c',
          '#5ab651',
          'leaves',
        );
        block(
          p.leaves,
          cx - 0.9,
          TOWER_H + 1.0,
          -DEPTH + 0.2,
          cx + 0.9,
          TOWER_H + 1.7,
          0.4,
          '#3f9a3c',
          '#5ab651',
          'leaves',
        );
      }
      block(
        p.leaves,
        -W - 0.2,
        ARCH_Y + 1.1,
        -DEPTH + 0.1,
        W + 0.2,
        ARCH_Y + 1.7,
        0.75,
        '#4fa84a',
        '#5ab651',
        'leaves',
      );
      for (let x = -W + 0.4; x < W; x += 0.7)
        // Ranken
        block(p.solid, x, ARCH_Y - 0.4 - (((x * 5) % 2) + 2) * 0.15, 0.57, x + 0.1, ARCH_Y, 0.62, '#3c8a34');
      break;
    case 'wolken': {
      for (const cx of towerMid) {
        block(p.solid, cx - 1.3, TOWER_H - 0.2, -DEPTH - 0.2, cx + 1.3, TOWER_H + 0.6, 0.95, '#ffffff', null, 'cloud');
        block(p.solid, cx - 0.8, TOWER_H + 0.6, -DEPTH + 0.3, cx + 0.8, TOWER_H + 1.2, 0.5, '#ffffff', null, 'cloud');
        block(p.bright, cx - 0.15, TOWER_H + 1.2, -1.1, cx + 0.15, TOWER_H + 1.6, -0.8, '#ffe27a'); // goldener Knauf
      }
      // Regenbogen über dem Tor: sechs Bänder in Stufen. Sie überlappen sich in der Höhe; jedes innere Band liegt
      // ein Stück weiter vorn, sonst lägen ihre Flächen in einer Ebene und flackerten (Z-Fighting)
      const bands = ['#e8504a', '#f39a3d', '#f2d14b', '#6dbd47', '#5aa6e8', '#8a6bd6'];
      bands.forEach((c, i) => {
        const r = 4.4 - i * 0.28;
        for (let k = 0; k < 9; k++) {
          const a0 = (k / 9) * Math.PI,
            a1 = ((k + 1) / 9) * Math.PI;
          const x0 = -Math.cos(a0) * r,
            x1 = -Math.cos(a1) * r;
          const y = ARCH_Y + 1.2 + Math.sin((a0 + a1) / 2) * r * 0.55;
          block(p.bright, Math.min(x0, x1), y, -0.4 + i * 0.03, Math.max(x0, x1), y + 0.28, -0.1 + i * 0.03, c);
        }
      });
      break;
    }
    case 'pilze':
      for (const [x, s, c] of [
        [-4.9, 0.5, '#d9473a'],
        [4.3, 0.4, '#4f7fd9'],
        [-2.9, 0.3, '#e0a03a'],
        [2.8, 0.35, '#d9473a'],
      ] as const) {
        block(p.solid, x + s * 0.4, 0, 0.9, x + s * 0.8, s * 1.4, 1.2, '#efe4d2');
        block(p.solid, x, s * 1.4, 0.75, x + s * 1.2, s * 1.9, 1.35, c);
      }
      break;
  }
}

/** Voxel einer Plattform, Gold-Voxel mit `gold: true` */
export type GoldVoxel = PlatformVoxel & { gold?: true };
const at = (v: Pick<PlatformVoxel, 'x' | 'z' | 'layer'>) => `${v.x},${v.z},${v.layer}`;

/**
 * Portal-Plattform: Voxel aus dem Raster (src/data/games/mitwachsen-portals.ts) als Würfel, Mitte der Plattform im
 * Ursprung, ein Voxel ist 1/8 Feld. Nur Flächen, an denen kein Voxel von `around` anliegt, kommen ins Mesh (alles,
 * was zugleich zu sehen ist; sonst lägen Hunderte verdeckte Flächen darin). Leuchtende und goldene Voxel kommen in
 * `bright`, die anderen in `solid`; Gold hat eine dunkle Seite.
 */
export function platformParts(p: Parts, voxels: readonly GoldVoxel[], around: readonly PlatformVoxel[] = voxels) {
  const taken = new Set(around.map(at));
  const free = (x: number, z: number, layer: number) => !taken.has(`${x},${z},${layer}`);
  const s = 1 / SUB;
  for (const v of voxels) {
    const [y0, y1] = voxelSpan(v);
    const [x0, z0] = [v.x * s - 1.5, v.z * s - 1.5];
    const [x1, z1] = [x0 + s, z0 + s];
    const g = v.gold || v.glow ? p.bright : p.solid;
    const top = col(v.gold ? GOLD.top : v.color),
      side = col(v.gold ? GOLD.side : v.color);
    const face = (a: V3, b: V3, c: V3, d: V3, n: V3, color = side) => g.quad(a, b, c, d, n, 'white', color);
    if (free(v.x, v.z, v.layer + 1)) face([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], top);
    if (free(v.x, v.z + 1, v.layer)) face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    if (free(v.x, v.z - 1, v.layer)) face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    if (free(v.x + 1, v.z, v.layer)) face([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    if (free(v.x - 1, v.z, v.layer)) face([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
  }
}

/**
 * Die Teile einer Plattform, die die 3D-Ansicht je nach Zustand zeigt: `asleep` (am Tor matt, am Bett der leere graue
 * Sockel) allein; wach `body` und `picture` (das leuchtende Bild), dazu der Rahmen um die Mitte und die Pfeile in den
 * Seitenfeldern, jeweils golden oder in ihrer eigenen Farbe. `awake` sind alle Plätze der wachen Plattform (für das
 * Weglassen verdeckter Flächen). Keine zwei Teile haben einen Voxel gemeinsam, so flackert nichts.
 */
export function platformSets(theme: GateTheme, side: 'gate' | 'home') {
  const lit = platformLook(theme, side, 'ready');
  const arrived = platformLook(theme, side, 'arrived');
  const isFrame = (v: PlatformVoxel) => v.role === 'frame';
  const isAccess = (v: PlatformVoxel) => v.role === 'access' || v.role === 'accessEdge';
  return {
    asleep: platformLook(theme, side, 'asleep'),
    awake: lit,
    body: lit.filter((v) => !isFrame(v) && !isAccess(v) && !(v.role === 'picture' && v.glow)),
    picture: lit.filter((v) => v.role === 'picture' && v.glow),
    frameGold: lit.filter(isFrame),
    frameOff: arrived.filter(isFrame),
    accessGold: arrived.filter(isAccess),
    accessOff: lit.filter(isAccess),
  };
}
