// Reisen mit den Portal-Plattformen – rein, ohne DOM: Plattformen erwachen, die Figur reist von einer wachen Mitte zum
// Gegenstück, folgende Tiere reisen mit. Teil der Regeln (mitwachsen-state.ts); wo die Plattformen
// stehen und wann sie erwachen, sagt mitwachsen-portal.ts.
// Spezifikation: docs/specs/mitwachsen.md (Regel 9a „Portal-Plattformen“)

import type { Dir } from '../../lib/games/front';
import type { Point } from '../../data/games/mitwachsen';
import type { PortalId } from '../../data/games/mitwachsen-portals';
import type { Mode } from './mitwachsen-border';
import { freeNear, type Crowd } from './mitwachsen-free';
import { platformsToWake, stepOn } from './mitwachsen-portal';
import type { World } from './mitwachsen-world';

export type PortalEvent =
  | { type: 'portal'; id: PortalId } // Plattform am Tor (und ihr Gegenstück am Bett) erwacht
  | { type: 'teleport'; id: PortalId; to: 'gate' | 'home' }
  | { type: 'ready'; id: PortalId }; // nach der Ankunft von der Mitte gestiegen: Die Plattform ist wieder bereit

/** Was das Reisen vom Zustand braucht (Teil des Zustands der Regeln) */
export type Traveller = Omit<Crowd, 'player' | 'animals'> & {
  player: { x: number; y: number; dir: Dir };
  animals: { id: string; x: number; y: number; mode: Mode }[];
  followers: string[];
  portals: PortalId[]; // wache Portal-Plattformen (je Portal eine, mit Gegenstück am Bett)
  arrived: Point | null; // Mittelfeld, auf dem die Figur angekommen ist: erst runter, dann wieder rauf
};
type Events = { push(e: PortalEvent): unknown };

/**
 * Plattformen, an die die wache Figur herangekommen ist, erwachen (nur, wo der Nebel schon weg ist: `explored`). Ein
 * Portal am Bett (das Eis-Portal) erwacht erst, wenn der Pinguin nicht mehr unterwegs zum Schneebett ist (Modus `lead`):
 * Er zieht zuerst ein, erst dann erwacht es.
 */
export function wakePortals(s: Traveller, world: World, explored: (x: number, y: number) => boolean, events: Events) {
  if (s.sleeping) return;
  const guiding = s.animals.some((a) => a.mode === 'lead');
  for (const id of platformsToWake(world.portals, s.portals, s.player.x, s.player.y, explored)) {
    if (guiding && world.portals.get(id)?.bed) continue;
    s.portals.push(id);
    events.push({ type: 'portal', id });
  }
}

/**
 * Die Figur hat ein neues Feld betreten: nach einer Ankunft wieder bereit, auf der Mitte einer wachen Plattform reisen.
 * Folgende Tiere reisen alle mit und stellen sich um die Plattform, nie darauf, auch ein Gast (der Pinguin, der der
 * Figur auf der Lichtung folgt). Dass in der Kette nur Tiere sind, die in die Gegend dürfen, sorgt die Weltgrenze
 * (mitwachsen-border.ts); ein Portal verbindet nur Tor und Bett derselben Gegend.
 */
export function landed(s: Traveller, world: World, events: Events) {
  const { x, y } = s.player;
  const r = stepOn(world.portals, (fx, fy) => world.cell(fx, fy).portal, s.portals, s.arrived, x, y);
  s.arrived = r.arrived;
  if (r.ready) events.push({ type: 'ready', id: r.ready });
  if (!r.travel) return;
  const { id, to, at } = r.travel;
  Object.assign(s.player, { x: at[0], y: at[1], dir: 's' });
  for (const f of s.followers) {
    const a = s.animals.find((t) => t.id === f)!;
    const place = freeNear(s, world, at, (fx, fy) => !world.cell(fx, fy).portal, f);
    if (place) [a.x, a.y] = place;
  }
  events.push({ type: 'teleport', id, to });
}
