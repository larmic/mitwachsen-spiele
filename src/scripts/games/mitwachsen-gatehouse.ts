// Torhaus und Portal-Plattformen der 3D-Ansicht: die zwei Flügel einer Doppeltür als schlichte Bretter (geschmückt
// mit Beschlägen, Zeichen und Umriss des verlaufenen Pinguins wird sie im Welt-Paket hinter ihrem Tor, Eis-Welt:
// worlds/eis/view-3d-gate.ts) und flache Plattformen aus Voxeln. Die Zugänge selbst bauen mitwachsen-gate-<welt>.ts.
// Liefert nur Geometrie in eigenen Koordinaten; die 3D-Ansicht stellt sie an ihren Platz. Gehört zur 3D-Ansicht und
// wird nur mit ihr nachgeladen (Three.js).
//
// Koordinaten: x entlang des Tors (Mitte 0), y nach oben, z nach vorn (+z schaut zur Lichtung bzw. zum Bett).
// Die Tür ist 5 Felder breit; ihre zwei Flügel sind eigene Teile, die sich nach innen drehen. Eine Portal-Plattform
// ist 3 × 3 Felder groß und flach.

import type { GateTheme } from '../../data/games/mitwachsen';
import { GOLD, SUB, platformLook, voxelSpan, type PlatformVoxel } from '../../data/games/mitwachsen-portals';
import { Geo, col, type Tile, type V3 } from './mitwachsen-geo';
import { parts, type Parts, type Wing } from './mitwachsen-gate-kit';

export { parts, type Parts, type Wing } from './mitwachsen-gate-kit';

export const W = 2.5; // halbe Torbreite
export const ARCH_Y = 4.7; // Unterkante des Torbogens
const HINGE_Z = -0.75; // die Türflügel drehen sich um ihre hintere Kante nach innen (weg von der Lichtung)
const GAP = 0.2; // geöffnet: Spalt zwischen Flügel und Rahmen, damit sie beim Drehen nirgends anstoßen
const [WOOD, WOOD_TOP] = ['#6b4423', '#7d5232']; // Holz der Türflügel

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

/** Ein Türflügel samt Seite: links (−1) bzw. rechts (1) */
export type Leaf = Wing & { side: -1 | 1 };
type Corners = [x0: number, y0: number, z0: number, x1: number, y1: number, z1: number];

/** Quader (Ecke und Gegenecke in Torhaus-Koordinaten) an einen Flügel heften: um seine Angel verschoben */
export function onLeaf(
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
 * Die zwei Flügel einer Doppeltür aus Holz um ihre äußere Angel, je mit ihrem Brett (ohne Beschläge, ohne Zeichen):
 * geschlossen ganz zu, offen mit Spalt zum Rahmen und nach innen gedreht (`open` 0 … 1). Das Welt-Paket hinter dem Tor
 * schmückt sie (Eis-Welt: Eisenbänder, Zeichen, Umriss des Pinguins); bis es da ist, steht die Tür so schlicht.
 */
export function leaves(open: number): [Leaf, Leaf] {
  const outer = W - 0.05 - (open > 0 ? GAP : 0);
  const [left, right] = ([-1, 1] as const).map((side): Leaf => ({
    parts: parts(),
    hinge: [side * outer, HINGE_Z],
    angle: (-side * open * Math.PI) / 2,
    side,
  })) as [Leaf, Leaf];
  for (const l of [left, right]) {
    const [x0, x1] = l.side < 0 ? [-outer, -0.04] : [0.04, outer];
    onLeaf(l, 'solid', [x0, 0, -0.75, x1, ARCH_Y, -0.35], WOOD, WOOD_TOP, 'planks');
  }
  return [left, right];
}

/** Türflügel ohne Seite, wie die 3D-Ansicht sie aufstellt */
export const wings = (ls: readonly Leaf[]): Wing[] => ls.map(({ parts, hinge, angle }) => ({ parts, hinge, angle }));

/** Schlichte Doppeltür, solange das Welt-Paket hinter dem Tor lädt: nur die zwei Bretter */
export const plainDoor = (open: number): Wing[] => wings(leaves(open));

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
