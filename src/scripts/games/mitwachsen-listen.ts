// Tiere schauen her – rein, ohne DOM: Erklingt ein Klangstein (Regel 13) oder wächst ein Schneemann (Eis-Welt, im
// Welt-Paket), drehen sich die Tiere in der Nähe zur Figur und bleiben eine Weile stehen, als hörten bzw. sähen sie zu.
// Teil der Regeln (mitwachsen-state.ts); die Regeln der Welt-Pakete nutzen `lookUp` mit.
// Spezifikation: docs/specs/mitwachsen.md (Regel 13, Gletscherkessel: Schneemänner)

import type { GateId } from '../../data/games/mitwachsen';
import { told, type StoryId } from '../../data/games/mitwachsen-stories';
import { dirTo } from './mitwachsen-free';
import type { Ruled } from './mitwachsen-pack-types';

/** Was das Herschauen vom Zustand braucht: Figur und Tiere (folgende Tiere schauen ohnehin her) */
export type Onlookers = Omit<Ruled, 'packs' | 'tick' | 'ritual'>;

/** Tiere bis `r` Felder um die Figur (auch schräg) drehen sich zu ihr und bleiben mindestens `rest` Takte stehen */
export function lookUp(s: Onlookers, rest: number, r = 3) {
  const { x, y } = s.player;
  for (const a of s.animals)
    if (a.mode !== 'follow' && Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) <= r) {
      a.dir = dirTo(x - a.x, y - a.y);
      a.rest = Math.max(a.rest, rest);
    }
}

/**
 * Klangstein angelaufen: Die Geschichte des Ortes erklingt (abspielen und anhalten macht die Ansicht). Tiere in der Nähe
 * drehen sich zur Figur und bleiben eine Weile stehen, als hörten sie mit.
 */
export function listen(
  s: Onlookers & { openGates: readonly GateId[]; heard: StoryId[] },
  stone: StoryId,
  events: { push(e: { type: 'story'; id: StoryId; first: boolean }): unknown },
) {
  const id = told(stone, s.openGates); // offenes Eistor: Sein Stein erzählt die zweite Fassung der Eis-Geschichte
  const first = !s.heard.includes(id);
  if (first) s.heard = [...s.heard, id].sort();
  lookUp(s, 40);
  events.push({ type: 'story', id, first });
}
