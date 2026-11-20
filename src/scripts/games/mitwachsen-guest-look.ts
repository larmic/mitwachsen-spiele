// Der verlaufene Pinguin am Tor, solange er die Figur dorthin führt (mitwachsen-guide.ts): sein Umriss mit Goldrahmen
// auf der Tür und die golden markierte Bucht davor. Den Umriss bauen 2D (hier) und 3D (mitwachsen-gatehouse.ts) aus
// denselben Pixeln. Die 2D-Ansicht lädt dieses Bild mit dem Wetter der Eis-Welt erst nach, wenn er da ist
// (mitwachsen-ice-sky.ts), nie mit der Spielseite.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“)

import { box, type Projection } from '../../lib/games/front';
import type { GateId } from '../../data/games/mitwachsen';
import { GOLD } from '../../data/games/mitwachsen-portals';
import type { Mode } from './mitwachsen-border';
import { bay, guideGate } from './mitwachsen-guide';
import type { World } from './mitwachsen-world';

/** Umriss des Pinguins auf der Tür, von vorn: g Goldrahmen, o Umriss (hell wie Eis), unten auf der Höhe `GUEST_Y` */
export const GUEST_OUTLINE = [
  'gggggggggggg',
  'g...oooo...g',
  'g..o....o..g',
  'g..o....o..g',
  'g..o....o..g',
  'g.oo....oo.g',
  'go........og',
  'go........og',
  'g.o......o.g',
  'g.o......o.g',
  'g..o....o..g',
  'g...oooo...g',
  'g..oo..oo..g',
  'gggggggggggg',
];
export const GUEST_COLORS = {
  g: { side: GOLD.side, top: GOLD.top },
  o: { side: '#d4f1ff', top: '#e8f8ff' },
} as const;
export const GUEST_PX = 0.2; // ein Pixel des Umrisses (Felder)
export const GUEST_Y = 1.0; // Unterkante über dem Boden (in 3D zwischen den Eisenbändern, nirgends bündig mit ihnen)

/** Was die 2D-Ansicht am Tor zeichnet, solange der Pinguin führt: Umriss auf seiner Tür, goldener Rand der Bucht */
export type Guest = {
  gate: GateId;
  outline: typeof doorOutline;
  mark(ctx: CanvasRenderingContext2D, P: Projection, x: number, y: number, h: number): void; // auf jedem Feld der Bucht
};

const guests = new WeakMap<object, Guest | null>();
/** Der Pinguin am Tor, wenn er gerade führt (je Zustand einmal berechnet), sonst null */
export function guestAt(world: World, state: { animals: readonly { mode: Mode }[] }): Guest | null {
  if (guests.has(state)) return guests.get(state)!;
  const gate = guideGate(state);
  const g = gate && world.gates.get(gate);
  const set = g ? new Set(bay(g).map(([x, y]) => `${x},${y}`)) : null;
  const guest: Guest | null =
    gate && set
      ? { gate, outline: doorOutline, mark: (ctx, P, x, y, h) => set.has(`${x},${y}`) && bayMark(ctx, P, set, x, y, h) }
      : null;
  guests.set(state, guest);
  return guest;
}

/** Goldener Rand der Bucht auf dem Feld (x, y): an jeder Seite, an der die Bucht endet, ein schmaler Streifen */
export function bayMark(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  set: ReadonlySet<string>,
  x: number,
  y: number,
  h: number,
) {
  const edge = (dx: number, dy: number) => !set.has(`${x + dx},${y + dy}`);
  if (edge(0, -1)) box(ctx, P, x, y, h, 1, 0.1, 0.04, GOLD.side, GOLD.top);
  if (edge(-1, 0)) box(ctx, P, x, y, h, 0.1, 1, 0.04, GOLD.side, GOLD.top);
  if (edge(1, 0)) box(ctx, P, x + 0.9, y, h, 0.1, 1, 0.04, GOLD.side, GOLD.top);
  if (edge(0, 1)) box(ctx, P, x, y + 0.9, h, 1, 0.1, 0.04, GOLD.side, GOLD.top);
}

/** Umriss des Pinguins mit Goldrahmen vor der Tür (2D), mittig bei `cx`, vorn bei `front` */
export function doorOutline(ctx: CanvasRenderingContext2D, P: Projection, cx: number, front: number, h: number) {
  GUEST_OUTLINE.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const color = GUEST_COLORS[ch as keyof typeof GUEST_COLORS];
      if (!color) return;
      const z = h + GUEST_Y + (GUEST_OUTLINE.length - 1 - r) * GUEST_PX;
      box(ctx, P, cx + (c - row.length / 2) * GUEST_PX, front, z, GUEST_PX, 0.04, GUEST_PX, color.side, color.top);
    });
  });
}
