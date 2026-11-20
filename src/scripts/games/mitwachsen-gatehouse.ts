// Doppeltür des Eistors und Portal-Plattformen der 3D-Ansicht: die zwei Türflügel mit Umriss des verlaufenen Pinguins
// und leuchtenden Eiszapfen, und flache Plattformen aus Voxeln. Die Zugänge selbst bauen mitwachsen-gate-<welt>.ts.
// Liefert nur Geometrie in eigenen Koordinaten; die 3D-Ansicht stellt sie an ihren Platz. Gehört zur 3D-Ansicht und
// wird nur mit ihr nachgeladen (Three.js).
//
// Koordinaten: x entlang des Tors (Mitte 0), y nach oben, z nach vorn (+z schaut zur Lichtung bzw. zum Bett).
// Die Tür ist 5 Felder breit; ihre zwei Flügel sind eigene Teile, die sich nach innen drehen. Eine Portal-Plattform
// ist 3 × 3 Felder groß und flach.

import type { GateTheme } from '../../data/games/mitwachsen';
import { GOLD, SUB, platformLook, voxelSpan, type PlatformVoxel } from '../../data/games/mitwachsen-portals';
import { GUEST_OUTLINE, GUEST_PX, GUEST_Y, guestPixel } from './mitwachsen-guest-look';
import { Geo, col, type Tile, type V3 } from './mitwachsen-geo';
import { parts, type Parts, type Wing } from './mitwachsen-gate-kit';

export { parts, type Parts, type Wing } from './mitwachsen-gate-kit';

export const W = 2.5; // halbe Torbreite
export const ARCH_Y = 4.7; // Unterkante des Torbogens
const HINGE_Z = -0.75; // die Türflügel drehen sich um ihre hintere Kante nach innen (weg von der Lichtung)
const GAP = 0.2; // geöffnet: Spalt zwischen Flügel und Rahmen, damit sie beim Drehen nirgends anstoßen
const ICE_GLOW = '#7fd6ff'; // eisblau leuchtende Eiszapfen, wenn das Eistor aufgeht
const SEAM = 0.06; // Umriss: so weit bleibt er von der Mitte der Tür weg (dort treffen sich die Flügel)

/** Quader mit Ecke (x0, y0, z0) und Gegenecke (x1, y1, z1) – im Torhaus leichter zu lesen als Ecke und Größe */
export function block(
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
export function door(glow: string, open: number, outline: boolean, lit: number): Wing[] {
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
  if (outline) penguinOutline(left, right, lit);
  return leaves.map(({ parts, hinge, angle }) => ({ parts, hinge, angle }));
}

/**
 * Umriss des verlaufenen Pinguins mit Goldrahmen auf der Tür, vorn und hinten wie das Zeichen (Pixel aus
 * `GUEST_OUTLINE`, je eine Lage auf dem Holz): Jedes Pixel gehört zum Flügel, auf dessen Seite es liegt, und hält
 * Abstand zur Mitte (`SEAM`). Gold ersetzt die Pixel darunter, es liegt nichts übereinander. Bis `lit` füllt er sich
 * von unten mit den Farben des Pinguins (`guestPixel`).
 */
function penguinOutline(left: Leaf, right: Leaf, lit: number) {
  const rows = GUEST_OUTLINE.length;
  GUEST_OUTLINE.forEach((row, r) => {
    [...row].forEach((_, c) => {
      const color = guestPixel(r, c, lit);
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

/** Farbe eines Eiszapfens am Bogen bei `x`: Geht das Eistor auf, leuchten sie bis `lit` von links nach rechts eisblau */
export const icicle = (x: number, lit: number) => ((x + W) / (2 * W) < lit ? ICE_GLOW : '#d4f1ff');

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
