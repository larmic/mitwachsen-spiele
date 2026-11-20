// Der verlaufene Pinguin am Tor, solange er die Figur dorthin führt (mitwachsen-guide.ts): sein Umriss mit Goldrahmen
// auf der Tür und die golden markierte Bucht davor. Geht das Eistor mit ihm auf, füllt sich der Umriss mit seinen Farben,
// die Eiszapfen leuchten (`ritualGlow`), und es erklingen Eiszapfen-Lied, Rumms und Akkord (`gateScore`). Den Umriss
// bauen 2D (hier) und 3D (mitwachsen-gatehouse.ts) aus denselben Pixeln. Die 2D-Ansicht lädt dieses Bild mit dem Wetter
// der Eis-Welt erst nach, wenn er da ist (mitwachsen-ice-sky.ts), nie mit der Spielseite.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“, Regel 8a, „Was angezeigt wird“: Große Tore)

import { box, type Projection } from '../../lib/games/front';
import type { GateId } from '../../data/games/mitwachsen';
import { GOLD } from '../../data/games/mitwachsen-portals';
import { STORIES } from '../../data/games/mitwachsen-stories';
import { RITUAL, bay, guideGate, opening } from './mitwachsen-guide';
import type { Scored } from './sfx';
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
/** Geht das Eistor auf, füllt sich der Umriss mit den Farben des Pinguins: k schwarz, w weiß, y orange */
export const GUEST_FILLED = [
  'gggggggggggg',
  'g...kkkk...g',
  'g..kkkkkk..g',
  'g..kwkkwk..g',
  'g..kkyykk..g',
  'g.kkwwwwkk.g',
  'gkkwwwwwwkkg',
  'gkkwwwwwwkkg',
  'g.kwwwwwwk.g',
  'g.kwwwwwwk.g',
  'g..kwwwwk..g',
  'g...kkkk...g',
  'g..yy..yy..g',
  'gggggggggggg',
];
export const GUEST_COLORS = {
  g: { side: GOLD.side, top: GOLD.top },
  o: { side: '#d4f1ff', top: '#e8f8ff' },
  k: { side: '#262b36', top: '#343a48' },
  w: { side: '#f4f6f8', top: '#ffffff' },
  y: { side: '#f08a3c', top: '#f6a05a' },
} as const;
const FILL_FROM = 3; // so viele Takte nach dem Öffnen beginnt das Eistor zu leuchten (0,3 s) …
const FILL_TAKES = 9; // … und braucht so lange, bis es ganz leuchtet (bei 1,2 s schwingen die Flügel auf)

/**
 * Wie weit das Eistor gerade leuchtet (0 … 1), solange es mit dem Pinguin aufgeht: Ab 0,3 s leuchten die Eiszapfen
 * nacheinander eisblau, und der Umriss füllt sich von unten mit seinen Farben, bis 1,2 s ganz. Sonst 0.
 */
export const ritualGlow = (s: { tick: number; ritual: number }) =>
  opening(s, RITUAL) ? Math.max(0, Math.min(1, (s.tick - s.ritual - FILL_FROM) / FILL_TAKES)) : 0;

/** Farbe eines Pixels des Umrisses (Zeile `r`, Spalte `c`): Bis `lit` (0 … 1) sind die Zeilen von unten gefüllt */
export function guestPixel(r: number, c: number, lit: number) {
  const filled = lit > 0 && GUEST_OUTLINE.length - r <= lit * GUEST_OUTLINE.length;
  const ch = (filled ? GUEST_FILLED : GUEST_OUTLINE)[r]?.[c];
  return GUEST_COLORS[ch as keyof typeof GUEST_COLORS] as (typeof GUEST_COLORS)['g'] | undefined;
}
export const GUEST_PX = 0.2; // ein Pixel des Umrisses (Felder)
export const GUEST_Y = 1.0; // Unterkante über dem Boden (in 3D zwischen den Eisenbändern, nirgends bündig mit ihnen)

/** Was die 2D-Ansicht am Tor zeichnet, solange der Pinguin führt: Umriss auf seiner Tür, goldener Rand der Bucht */
export type Guest = {
  gate: GateId;
  outline: (ctx: CanvasRenderingContext2D, P: Projection, cx: number, front: number, h: number) => void;
  mark(ctx: CanvasRenderingContext2D, P: Projection, x: number, y: number, h: number): void; // auf jedem Feld der Bucht
};

const guests = new WeakMap<object, Guest | null>();
/** Der Pinguin am Tor, wenn er gerade führt (je Zustand einmal berechnet), sonst null */
export function guestAt(world: World, state: Parameters<typeof guideGate>[0]): Guest | null {
  if (guests.has(state)) return guests.get(state)!;
  const gate = guideGate(state);
  const g = gate && world.gates.get(gate);
  const set = g ? new Set(bay(g).map(([x, y]) => `${x},${y}`)) : null;
  const guest: Guest | null =
    gate && set
      ? {
          gate,
          outline: (ctx, P, cx, front, h) => doorOutline(ctx, P, cx, front, h, ritualGlow(state)),
          mark: (ctx, P, x, y, h) => set.has(`${x},${y}`) && bayMark(ctx, P, set, x, y, h),
        }
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

/**
 * Umriss des Pinguins mit Goldrahmen vor der Tür (2D), mittig bei `cx`, vorn bei `front`; geht das Tor auf, füllt er
 * sich bis `lit` mit seinen Farben
 */
export function doorOutline(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  cx: number,
  front: number,
  h: number,
  lit = 0,
) {
  GUEST_OUTLINE.forEach((row, r) => {
    [...row].forEach((_, c) => {
      const color = guestPixel(r, c, lit);
      if (!color) return;
      const z = h + GUEST_Y + (GUEST_OUTLINE.length - 1 - r) * GUEST_PX;
      box(ctx, P, cx + (c - row.length / 2) * GUEST_PX, front, z, GUEST_PX, 0.04, GUEST_PX, color.side, color.top);
    });
  });
}

/**
 * Töne, wenn das Eistor mit dem Pinguin aufgeht: Ab 0,3 s spielen die Eiszapfen die Eis-Melodie des Klangsteins, ab
 * 1,2 s (die Flügel schwingen auf) ein tiefes, weiches Rumms (C2) und ein heller Akkord C5–E5–G5–C6; zusammen höchstens
 * 6 Stimmen und unter 5 s
 */
export function gateScore(): Scored[] {
  const m = STORIES.eis.melody;
  let at = 0.3;
  const out: Scored[] = m.notes.map(([freq, len, gain]) => {
    const note: Scored = [freq, len, m.wave, gain ?? 0.1, 1, at];
    at += len + m.gap;
    return note;
  });
  out.push([65.41, 0.9, 'sine', 0.22, 0.7, 1.2]);
  for (const f of [523.25, 659.25, 783.99, 1046.5]) out.push([f, 1.4, 'triangle', 0.05, 1, 1.2]);
  return out;
}
