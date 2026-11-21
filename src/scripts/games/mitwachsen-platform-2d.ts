// Portal-Plattformen in der 2D-Ansicht (Ersatz ohne WebGL): je Feld die Voxel, die darauf liegen, als kleine Quader.
// Dieselben Zustände wie in 3D (schlafend, bereit mit Gold-Rahmen, nach der Ankunft goldene Pfeile), ohne Bewegung.
// Von jeder Säule nur der oberste Voxel, darunter sieht man von schräg oben ohnehin nichts. Dazu die Torplatten vor den
// großen Toren (mitwachsen-plate.ts).

import { box, type Projection } from '../../lib/games/front';
import { GOLD, PORTALS, SUB, platformLook, voxelSpan } from '../../data/games/mitwachsen-portals';
import { PLATFORM_HALF, type PlatformSpot } from './mitwachsen-portal';
import type { State } from './mitwachsen-state';
import { mix, type World } from './mitwachsen-world';
import { THEME_COLORS, type GateId } from '../../data/games/mitwachsen';
import {
  PLATE_HALF,
  PLATE_STONE,
  PLATE_VOX,
  plateMid,
  plateSink,
  plateVoxel,
  type PlateFx,
  type PlateLook,
} from './mitwachsen-plate';

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
  const all = platformLook(PORTALS[id].theme, side, look);
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

/**
 * Ein Feld (x, y) der Torplatte vor dem Tor `id` auf Höhe h: Teil eines flachen, ovalen Steins aus Voxeln (einer dick),
 * Rand in der Farbe der Welt; `look`: Schmuck aus dem Welt-Paket (Eis: Scholle mit Schneeflocke). Steht die Figur
 * darauf (`fx`), ist er eingesunken (`plateSink`) und der Rand leuchtet heller; `gold` (0 … 1): so golden ist der
 * Rand, solange der Pinguin zu diesem Tor führt (pulsierend, `plateGold`).
 */
export function drawPlate(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  world: World,
  id: GateId,
  x: number,
  y: number,
  h: number,
  fx: PlateFx | null,
  now: number,
  reduced: boolean,
  look?: PlateLook,
  gold = 0,
) {
  const g = world.gates.get(id)!; // die Platte liegt vor ihrem Tor
  const [mx, my] = plateMid(g);
  const along = g.out[1] !== 0; // Tor im Norden oder Süden: Die Platte liegt entlang x, sonst entlang y
  const i = ((along ? x - mx : y - my) + PLATE_HALF) * PLATE_VOX; // erstes Voxel dieses Felds entlang der Platte
  const z = h - plateSink(fx, id, now, reduced);
  const rim = mix(mix(THEME_COLORS[id].portal, GOLD.top, gold), '#ffffff', fx?.id === id && fx.on ? 0.5 : 0);
  const [side, top] = look?.face ?? PLATE_STONE;
  const s = 1 / PLATE_VOX;
  // von hinten nach vorn, je Voxel ein Quader
  for (let b = 0; b < PLATE_VOX; b++)
    for (let a = 0; a < PLATE_VOX; a++) {
      const k = plateVoxel(i + (along ? a : b), along ? b : a, look?.mark);
      if (k) box(ctx, P, x + a * s, y + b * s, z, s, s, s, side, k === 'rim' ? rim : k === 'mark' ? '#ffffff' : top);
    }
}
