// Eigene Antwort am Rand einer Welt (Issue 41) – rein: Läuft die Figur gegen den Rand (die Hecke am Felsring der
// Lichtung, die Eisklippen des Gletschertals, die Felswand der Grotte), antwortet er anders als ein Baum oder ein Stein:
// ein weicher, tiefer Ton und je Welt etwas Kleines (Ereignis `edge`; Bild und Ton in larmic-mitwachsen.ts und sfx.ts).
// Höchstens alle `EDGE_EVERY` Takte; dazwischen bleibt es still, die Figur bleibt einfach stehen. Nie ein Fehlerton, kein
// Wackeln: Der Rand sagt freundlich „hier geht es nicht weiter“.
// Spezifikation: docs/specs/mitwachsen.md („Weltrand: eigene Antwort“)

import type { Cell } from './mitwachsen-cell';
import { isRing } from './mitwachsen-rim';

/** So viele Takte liegen mindestens zwischen zwei Antworten des Rands (1,5 s) */
export const EDGE_EVERY = 15;
/** Art des Rands: Hecke der Lichtung, Eisklippe der Eis-Welt, Felswand der Grotte */
export type EdgeKind = 'hedge' | 'ice' | 'cave';
export type EdgeEvent = { type: 'edge'; kind: EdgeKind; x: number; y: number };

/** Welcher Rand das Feld ist; null: keiner (Baum, Stein, Wasser, Zaun antworten wie immer) */
export function edgeOf(c: Cell): EdgeKind | null {
  if (isRing(c)) return 'hedge';
  if (c.solid && c.region === 'border' && c.biome === 'eis') return 'ice';
  if (c.solid && c.ground === 'grotto' && c.deco === 'rock') return 'cave';
  return null;
}

/**
 * Die Figur läuft gegen das feste Feld `c` bei (x, y): Ist es ein Rand, antwortet er (`edge`), wenn die letzte Antwort
 * `EDGE_EVERY` Takte her ist (`edgeAt`, nicht gespeichert); true: Der Rand hat den Schritt genommen (auch still), es
 * gibt kein gewöhnliches Anstoßen
 */
export function bumpEdge(
  s: { tick: number; edgeAt?: number },
  c: Cell,
  x: number,
  y: number,
  events: { push(e: EdgeEvent): unknown },
): boolean {
  const kind = edgeOf(c);
  if (!kind) return false;
  if (s.tick - (s.edgeAt ?? -EDGE_EVERY) >= EDGE_EVERY) {
    s.edgeAt = s.tick;
    events.push({ type: 'edge', kind, x, y });
  }
  return true;
}
