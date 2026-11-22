// Der verlaufene Pinguin am Tor, solange er die Figur dorthin führt (mitwachsen-guide.ts): sein Umriss mit Goldrahmen
// auf der Tür und der golden pulsierende Rand der Torplatte davor (`plateGold`, in 2D und 3D). Geht das Eistor mit ihm
// auf, füllt sich der Umriss mit seinen Farben (`ritualGlow`, langsam schon im Vorspiel), die Eiszapfen leuchten
// (`iceGlow`, worlds/eis/view-3d-gate.ts), und es erklingen Eiszapfen-Lied, Rumms und Akkord (`gateScore`). Den Umriss bauen 2D (hier) und 3D
// (mitwachsen-gatehouse.ts) aus denselben Pixeln. Die 2D-Ansicht lädt dieses Bild mit dem Wetter
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
const FILL_FROM = 3; // so viele Takte nach Beginn des Rituals beginnen die Eiszapfen zu leuchten (0,3 s) …
const FILL_TAKES = 9; // … und brauchen so lange, bis sie ganz leuchten (bei 1,2 s schwingen die Flügel auf)
export const PRE_FILL = 0.25; // so weit füllt sich der Umriss schon im Vorspiel (die Füße und etwas mehr) …
export const PRE_SPAN = 35; // … langsam über so viele Takte (das längste Vorspiel, Süd; kürzere beginnen weiter oben)

/**
 * Wie weit das Eistor gerade leuchtet (0 … 1), solange es mit dem Pinguin aufgeht, sonst 0: So weit ist der Umriss von
 * unten gefüllt, so hell die Krone. Im Vorspiel langsam bis `PRE_FILL` (in Zwanzigsteln, damit die 3D-Ansicht die Tür
 * nur selten neu baut); im Ritual ab 0,3 s weiter bis ganz bei 1,2 s, wenn die Flügel aufschwingen. Die Eiszapfen
 * leuchten erst über `PRE_FILL` (`iceGlow` in worlds/eis/view-3d-gate.ts), also erst im Ritual, wenn die Kamera vorn ist
 */
export const ritualGlow = (s: { tick: number; ritual: number }) => {
  const t = s.tick - s.ritual;
  if (!opening(s, RITUAL)) return 0;
  if (t < 0) return Math.max(0, Math.round((1 + t / PRE_SPAN) * PRE_FILL * 20)) / 20;
  return PRE_FILL + (1 - PRE_FILL) * Math.max(0, Math.min(1, (t - FILL_FROM) / FILL_TAKES));
};

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
 * Töne, wenn das Eistor mit dem Pinguin aufgeht: Wenn die Eiszapfen zu leuchten beginnen (0,9 s vor den Flügeln, nach dem
 * Vorspiel), spielen sie die Eis-Melodie des Klangsteins, wenn die Flügel aufschwingen (nach `wingTicks` Takten zu 0,1 s, ohne Vorspiel 1,2 s)
 * ein tiefes, weiches Rumms (C2) und ein heller Akkord C5–E5–G5–C6; zusammen höchstens 6 Stimmen und unter 5 s nach den
 * Flügeln. Im Vorspiel klingt nur der Pinguin (`peep`, sofort)
 */
export function gateScore(wingTicks = 12): Scored[] {
  const m = STORIES.eis.melody;
  const wings = wingTicks / 10;
  let at = wings - 0.9;
  const out: Scored[] = m.notes.map(([freq, len, gain]) => {
    const note: Scored = [freq, len, m.wave, gain ?? 0.1, 1, at];
    at += len + m.gap;
    return note;
  });
  out.push([65.41, 0.9, 'sine', 0.22, 0.7, wings]);
  for (const f of [523.25, 659.25, 783.99, 1046.5]) out.push([f, 1.4, 'triangle', 0.05, 1, wings]);
  return out;
}
