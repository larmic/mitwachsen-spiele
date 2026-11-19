// Portal-Plattformen in der 2D-Ansicht (Ersatz ohne WebGL): je Feld die Voxel, die darauf liegen, als kleine Quader.
// Dieselben Zustände wie in 3D (schlafend, bereit mit Gold-Rahmen, nach der Ankunft goldene Pfeile), ohne Bewegung.
// Von jeder Säule nur der oberste Voxel, darunter sieht man von schräg oben ohnehin nichts.

import { box, type Projection } from '../../lib/games/front';
import { GOLD, SUB, platformLook, voxelSpan } from '../../data/games/mitwachsen-portals';
import { PLATFORM_HALF, type PlatformSpot } from './mitwachsen-portal';
import type { State } from './mitwachsen-state';
import type { World } from './mitwachsen-world';

/** Ein Feld (x, y) einer Plattform auf Höhe h zeichnen */
export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  world: World,
  state: State,
  x: number,
  y: number,
  h: number,
  { id, side }: PlatformSpot,
) {
  const pair = world.portals.get(id);
  if (!pair) return;
  const [cx, cy] = side === 'gate' ? pair.gate : pair.home;
  const arrived = !!state.arrived && state.arrived[0] === cx && state.arrived[1] === cy;
  const look = !state.portals.includes(id) ? 'asleep' : arrived ? 'arrived' : 'ready';
  const fx = (x - cx + PLATFORM_HALF) * SUB,
    fz = (y - cy + PLATFORM_HALF) * SUB;
  const s = 1 / SUB;
  const all = platformLook(id, side, look);
  const taken = new Set(all.map((v) => `${v.x},${v.z},${v.layer}`));
  const mine = all
    .filter((v) => v.x >= fx && v.x < fx + SUB && v.z >= fz && v.z < fz + SUB)
    .filter((v) => !taken.has(`${v.x},${v.z},${v.layer + 1}`))
    .sort((a, b) => a.z - b.z || a.layer - b.layer); // von hinten nach vorn, von unten nach oben
  for (const v of mine) {
    const y1 = voxelSpan(v)[1];
    const side = v.gold ? GOLD.side : v.color;
    box(ctx, P, x + (v.x - fx) * s, y + (v.z - fz) * s, h, s, s, y1, side, v.color); // die ganze Säule als ein Quader
  }
}
