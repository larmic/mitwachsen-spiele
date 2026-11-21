// Handgriffe von Mitwachsen – rein und ohne DOM: Beeren pflücken, Fische fangen, Wasser schöpfen und alles in die Tröge
// der Wiese bringen. Immer gleich: hineinlaufen, tragen, hineinlaufen. Korb (Rücken), Netz (linke Hand) und Eimer
// (rechte Hand) trägt die Figur gleichzeitig, jeder Trog nimmt nur das Seine.
// Spezifikation: docs/specs/mitwachsen.md (Regeln 3a und 3b)

import { fromKey } from '../../lib/games/chunks';
import type { RegionId } from '../../data/games/mitwachsen';
import type { PackEvent } from './mitwachsen-pack-types';
import type { World } from './mitwachsen-world';

export const REGROW = 300; // Takte, bis an einem Busch neue Beeren hängen und in einer Fischkiste neue Fische liegen (30 s)

/** Was die Figur trägt und was gerade leer ist (Teil des Zustands der Regeln) */
export type Hands = {
  tick: number;
  picked: Record<string, number>; // leere Büsche und Fischkisten: "x,y" → Takt des Leerens
  basket: boolean; // Korb mit Beeren auf dem Rücken
  fish: boolean; // Netz mit Fischen in der linken Hand
  bucket: boolean; // Eimer mit Wasser in der rechten Hand
  animals: readonly { id: string; mode: string; realm: RegionId }[];
};

export type ChoreEvent =
  | { type: 'pick'; x: number; y: number } // Beeren gepflückt
  | { type: 'catch'; x: number; y: number } // Fische ins Netz gefangen
  | { type: 'regrow'; x: number; y: number } // neue Beeren am Busch, neue Fische in der Kiste
  | { type: 'feed'; food: 'berries' | 'fish'; ids: string[] } // Futter in Trog oder Eisschale: diese Tiere freuen sich
  | { type: 'fill'; x: number; y: number } // Eimer am Wasser gefüllt
  | { type: 'pour'; ids: string[] }; // Wasser in den Wassertrog: diese Tiere der Wiese freuen sich

/**
 * Nach diesen Ereignissen sieht ein Feld anders aus (Busch oder Fischkiste leer bzw. wieder voll, Schneehaufen um eine
 * Kugel gewachsen): Die 3D-Ansicht baut sein Stück neu. Ausdrücklich aufgezählt, damit ein neues Ereignis mit Feld nicht
 * unbemerkt Stücke neu bauen lässt.
 */
export const reshapes = (e: {
  type: string;
}): e is Extract<ChoreEvent, { type: 'pick' | 'catch' | 'regrow' }> | PackEvent =>
  e.type === 'pick' || e.type === 'catch' || e.type === 'regrow' || e.type === 'snowman';

/** Wohin die Ereignisse gehen (die Liste der Regeln, die auch andere Ereignisse enthält) */
type Events = { push(e: ChoreEvent): unknown };

/** Tiere der Wiese, auf der der Trog (x, y) steht: Nur sie freuen sich über Futter und Wasser */
const meadowAnimals = (s: Hands, world: World, x: number, y: number) =>
  s.animals.filter((a) => a.mode === 'home' && a.realm === world.realm(x, y)).map((a) => a.id);

/**
 * Die Figur läuft in das Feld (x, y): An einem vollen Busch pflückt sie Beeren in den Korb, an einer vollen Fischkiste
 * fängt sie Fische ins Netz (beides ist danach eine Weile leer). Mit Korb in den Futtertrog, mit Netz in die Eisschale,
 * mit vollem Eimer in den Wassertrog: Es kommt hinein, alle Tiere dieser Wiese freuen sich. Mit leerer Hand ans Wasser:
 * Sie schöpft einen Eimer voll. Liefert true, wenn der Zug damit erledigt ist (die Figur bleibt stehen); sonst ist das
 * Feld, was es ist (leere Quellen und Tröge versperren wie ein Busch).
 */
export function chore(s: Hands, world: World, x: number, y: number, events: Events): boolean {
  const c = world.cell(x, y);
  if ((c.deco === 'bush' || c.deco === 'fishcrate') && !(`${x},${y}` in s.picked)) {
    s.picked[`${x},${y}`] = s.tick;
    if (c.deco === 'bush') s.basket = true;
    else s.fish = true;
    events.push({ type: c.deco === 'bush' ? 'pick' : 'catch', x, y });
    return true;
  }
  if (s.basket && c.deco === 'trough') {
    s.basket = false;
    events.push({ type: 'feed', food: 'berries', ids: meadowAnimals(s, world, x, y) });
    return true;
  }
  if (s.fish && c.deco === 'icebowl') {
    s.fish = false; // die Fische rutschen in die Schale, das Netz ist leer
    events.push({ type: 'feed', food: 'fish', ids: meadowAnimals(s, world, x, y) });
    return true;
  }
  if (!s.bucket && c.ground === 'water') {
    s.bucket = true;
    events.push({ type: 'fill', x, y });
    return true;
  }
  if (!s.bucket || c.deco !== 'watertrough') return false;
  s.bucket = false;
  events.push({ type: 'pour', ids: meadowAnimals(s, world, x, y) });
  return true;
}

/** Nach `REGROW` Takten hängen am Busch neue Beeren und liegen in der Kiste neue Fische, auch nachts */
export function regrow(s: Hands, events: Events) {
  for (const [k, at] of Object.entries(s.picked))
    if (s.tick - at >= REGROW) {
      delete s.picked[k];
      const [x, y] = fromKey(k);
      events.push({ type: 'regrow', x, y });
    }
}
