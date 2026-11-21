// Der verlaufene Pinguin am Tor, solange er die Figur dorthin führt (mitwachsen-guide.ts): sein Umriss mit Goldrahmen
// auf der Tür und der golden pulsierende Rand der Torplatte davor (`plateGold`, in 2D und 3D). Geht das Eistor mit ihm auf, füllt sich der Umriss mit seinen Farben,
// die Eiszapfen leuchten (`ritualGlow`), und es erklingen Eiszapfen-Lied, Rumms und Akkord (`gateScore`). Den Umriss
// bauen 2D (hier) und 3D (mitwachsen-gatehouse.ts) aus denselben Pixeln. Die 2D-Ansicht lädt dieses Bild mit dem Wetter
// der Eis-Welt erst nach, wenn er da ist (mitwachsen-ice-sky.ts), nie mit der Spielseite.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“, Regel 8a, „Was angezeigt wird“: Große Tore)

import { box, type Projection } from '../../lib/games/front';
import type { GateId } from '../../data/games/mitwachsen';
import { GOLD } from '../../data/games/mitwachsen-portals';
import { STORIES } from '../../data/games/mitwachsen-stories';
import { RITUAL, guideGate, opening } from './mitwachsen-guide';
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
/**
 * Geht das Eistor auf, füllt sich der Umriss mit den Farben des Pinguins: k schwarz, w weiß, y orange (innen, ohne den
 * Goldrahmen: der bleibt wie im Umriss)
 */
export const GUEST_FILLED = [
  '...kkkk...',
  '..kkkkkk..',
  '..kwkkwk..',
  '..kkyykk..',
  '.kkwwwwkk.',
  'kkwwwwwwkk',
  'kkwwwwwwkk',
  '.kwwwwwwk.',
  '.kwwwwwwk.',
  '..kwwwwk..',
  '...kkkk...',
  '..yy..yy..',
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
  const ch = filled ? (GUEST_FILLED[r - 1]?.[c - 1] ?? 'g') : GUEST_OUTLINE[r]?.[c]; // außen herum der Goldrahmen
  return GUEST_COLORS[ch as keyof typeof GUEST_COLORS] as (typeof GUEST_COLORS)['g'] | undefined;
}
export const GUEST_PX = 0.2; // ein Pixel des Umrisses (Felder)
export const GUEST_Y = 1.0; // Unterkante über dem Boden (in 3D zwischen den Eisenbändern, nirgends bündig mit ihnen)

/** So lange dauert ein Puls des goldenen Rands der Torplatte (ms) */
export const PULSE_MS = 1200;
/** Wie golden der Rand der Torplatte gerade ist (0 … 1): pulsiert weich, bei reduzierter Bewegung ganz golden */
export const plateGold = (now: number, reduced: boolean) =>
  reduced ? 1 : 0.5 - 0.5 * Math.cos((2 * Math.PI * now) / PULSE_MS);

/**
 * Was die 2D-Ansicht am Tor zeichnet, solange der Pinguin führt: Umriss auf seiner Tür; `rim`: wie golden der Rand der
 * Torplatte vor dem Tor `id` ist (pulsierend, solange das Tor zu ist; sonst 0)
 */
export type Guest = {
  gate: GateId;
  outline: (ctx: CanvasRenderingContext2D, P: Projection, cx: number, front: number, h: number) => void;
  rim(id: GateId, now: number, reduced: boolean): number;
};

const guests = new WeakMap<object, Guest | null>();
/** Der Pinguin am Tor, wenn er gerade führt (je Zustand einmal berechnet), sonst null */
export function guestAt(world: World, state: Parameters<typeof guideGate>[0]): Guest | null {
  if (guests.has(state)) return guests.get(state)!;
  const gate = guideGate(state);
  const guest: Guest | null =
    gate && world.gates.has(gate)
      ? {
          gate,
          outline: (ctx, P, cx, front, h) => doorOutline(ctx, P, cx, front, h, ritualGlow(state)),
          rim: (id, now, reduced) => (id === gate && !state.openGates.includes(gate) ? plateGold(now, reduced) : 0),
        }
      : null;
  guests.set(state, guest);
  return guest;
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
