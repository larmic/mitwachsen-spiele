// Postkarte der Torfront in der 2D-Ansicht (ohne WebGL): Steht die Figur eine Sekunde auf einer Torplatte
// (`postcard` in mitwachsen-plate.ts), blendet oben ein kleines Bild der Front ihres Tors ein. Die 2D-Ansicht sieht
// Tore im Osten, Westen und Süden nur von der Seite oder von hinten; die Postkarte zeichnet jedes Tor wie eines im
// Norden, also von vorn, mit `bigGate` aus mitwachsen-gate-look.ts: Türme, Tür, Torbogen, Zeichen, und den Umriss des
// Pinguins, solange er zu diesem Tor führt. Nachgeladen erst, wenn die erste Postkarte in 2D kommt; in 3D rendert
// die 3D-Ansicht die Front einmal als Standbild (`World3D.postcard`).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Postkarte der Torfront)

import { GAME_COLORS, type GateId } from '../../data/games/mitwachsen';
import { TILE_W, box, projection } from '../../lib/games/front';
import { PAL_GRASS, PAL_STONE, type Palette } from '../../lib/voxel/textures';
import { bigGate, type GateRow } from './mitwachsen-gate-look';
import { PLATE_ROW, PLATE_STONE } from './mitwachsen-plate';
import type { Guest } from './mitwachsen-guest-look';

/** Tür und Türme reichen von −4 bis 4 (fünf Felder Tür, je zwei Turm) */
const SPAN = 4;
/** So viele Felder breit ist die Postkarte: das Torhaus und je ein Feld Rand */
export const CARD_CELLS = 2 * SPAN + 3;
/** Die Unterkante des Torhauses liegt so weit unten (Anteil der Höhe): darüber Türme und Himmel, darunter die Bucht */
export const CARD_BASE = 0.68;
/** Höhe des Torbogens über dem Boden: so hoch ist der dunkle Gang hinter der offenen Tür */
const ARCH = 4.7;

const tone = (pal: Palette, k: string) => pal[k]?.[0]?.[0] ?? GAME_COLORS.ink;

/**
 * Front des Tors `id` auf `ctx` (Breite `w`, Höhe `h` in Bildpunkten): hinten der Fels mit dem dunklen Gang, davor
 * die Bucht mit der Torplatte, darauf das Torhaus von vorn, so weit offen wie `open` (0 … 1). Führt der Pinguin zu diesem Tor
 * (`guest`), steht sein Umriss auf der geschlossenen Tür. Gleich für jede Lage des Tors in der Welt.
 */
export function drawFront(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  id: GateId,
  open: number,
  guest: Guest | null,
) {
  ctx.clearRect(0, 0, w, h);
  const P = projection(0.5, 0, w / 2, h * CARD_BASE, w / (CARD_CELLS * TILE_W));
  box(ctx, P, -SPAN - 2, -1, -1, CARD_CELLS + 2, 7, 1, tone(PAL_GRASS, 'd'), tone(PAL_GRASS, 'G')); // Boden
  box(ctx, P, -SPAN - 2, -1, 0, CARD_CELLS + 2, 1, 1.1, tone(PAL_STONE, 's'), tone(PAL_STONE, 'S')); // Fels dahinter
  box(ctx, P, -2, -1, 0, 5, 1, ARCH, GAME_COLORS.ink); // Gang hinter der Tür
  box(ctx, P, -SPAN, 1, -0.02, 2 * SPAN + 1, 3, 0.02, tone(PAL_STONE, 'S'), tone(PAL_STONE, 'r')); // Bucht
  box(ctx, P, -1, PLATE_ROW + 0.15, 0, 3, 0.7, 0.12, ...PLATE_STONE); // die Torplatte, auf der die Figur steht
  // ein gedachtes Tor im Norden, die Tür mitten im Bild: so sieht man es von vorn
  const cells = [-2, -1, 0, 1, 2].map((x) => [x, 0] as const);
  const row: GateRow = { gates: new Map([[id, { id, mid: [0, 0], out: [0, -1], cells }]]) };
  const gates = new Map([[id, open]]);
  const door = { deco: 'biggate', gate: id } as const;
  const tower = { deco: 'gatetower', part: { id } } as const;
  for (let x = -SPAN; x <= SPAN; x++) bigGate(ctx, P, row, Math.abs(x) > 2 ? tower : door, x, 0, 0, gates, guest);
}

/** Postkarte auf ihr Canvas zeichnen, scharf in Gerätepixeln (die Größe gibt das CSS der Spielfläche vor) */
export function drawPostcard(canvas: HTMLCanvasElement, id: GateId, open: number, guest: Guest | null) {
  const dpr = Math.min(devicePixelRatio, 2);
  const [w, h] = [canvas.clientWidth, canvas.clientHeight];
  const [pw, ph] = [Math.round(w * dpr), Math.round(h * dpr)];
  if (canvas.width !== pw || canvas.height !== ph) [canvas.width, canvas.height] = [pw, ph];
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawFront(ctx, w, h, id, open, guest);
}
