// Handgriffe von Mitwachsen – rein und ohne DOM: Beeren pflücken, Fische fangen, Leuchtpilze sammeln, Wasser schöpfen
// und alles in die Tröge der Wiese bringen. Immer gleich: hineinlaufen, tragen, hineinlaufen. Korb (Rücken), Netz (linke
// Hand) und Eimer (rechte Hand, in der Grotte eine Kanne) trägt die Figur gleichzeitig, jeder Trog nimmt nur das Seine;
// der Korb trägt immer nur eine Sorte, Beeren oder Leuchtpilze.
// Spezifikation: docs/specs/mitwachsen.md (Regeln 3a und 3b, Abschnitt „Sammeln in der Grotte“)

import { fromKey } from '../../lib/games/chunks';
import type { RegionId } from '../../data/games/mitwachsen';
import type { PackEvent } from './mitwachsen-pack-types';
import type { Cell } from './mitwachsen-cell';
import type { World } from './mitwachsen-world';

export const REGROW = 300; // Takte, bis an einem Busch neue Beeren hängen, in einer Fischkiste neue Fische liegen und in einem Pilzbeet neue Leuchtpilze stehen (30 s)

/** Was die Figur trägt und was gerade leer ist (Teil des Zustands der Regeln) */
export type Hands = {
  tick: number;
  picked: Record<string, number>; // leere Büsche, Fischkisten und Pilzbeete: "x,y" → Takt des Leerens; volle Pilzschale und volle Steintröge der Grotte: Takt des Füllens
  basket: boolean; // Korb mit Beeren auf dem Rücken
  shrooms: boolean; // Korb mit Leuchtpilzen auf dem Rücken (nie zugleich mit Beeren)
  fish: boolean; // Netz mit Fischen in der linken Hand
  bucket: boolean; // Eimer mit Wasser in der rechten Hand
  animals: readonly { id: string; mode: string; realm: RegionId }[];
};

export type ChoreEvent =
  | { type: 'pick'; x: number; y: number } // Beeren gepflückt
  | { type: 'catch'; x: number; y: number } // Fische ins Netz gefangen
  | { type: 'gather'; x: number; y: number } // Leuchtpilze aus dem Beet in den Korb gesammelt
  | { type: 'regrow'; x: number; y: number } // neue Beeren am Busch, neue Fische in der Kiste, neue Pilze im Beet; Pilzschale oder Steintrog wieder leer
  | { type: 'feed'; food: 'berries' | 'fish' | 'pilze'; ids: string[]; x: number; y: number } // Futter in Trog (x, y), Eisschale oder Pilzschale: diese Tiere freuen sich
  | { type: 'fill'; x: number; y: number } // Eimer am Wasser (oder Kanne an der Tropfquelle) gefüllt
  | { type: 'pour'; ids: string[]; x: number; y: number }; // Wasser in den Wassertrog oder Steintrog (x, y): diese Tiere der Wiese freuen sich

/**
 * Nach diesen Ereignissen sieht ein Feld anders aus (Busch, Fischkiste oder Pilzbeet leer bzw. wieder voll, Pilzschale
 * oder Steintrog voll bzw. wieder leer, Schneehaufen um eine Kugel gewachsen): Die 3D-Ansicht baut sein Stück neu.
 * Ausdrücklich aufgezählt, damit ein neues Ereignis mit Feld nicht unbemerkt Stücke neu bauen lässt.
 */
const RESHAPES = new Set(['pick', 'catch', 'gather', 'regrow', 'snowman', 'feed', 'pour']);
export const reshapes = (e: {
  type: string;
}): e is Extract<
  ChoreEvent | PackEvent,
  { type: 'pick' | 'catch' | 'gather' | 'regrow' | 'snowman' | 'feed' | 'pour' }
> => RESHAPES.has(e.type);

/** Wohin die Ereignisse gehen (die Liste der Regeln, die auch andere Ereignisse enthält) */
type Events = { push(e: ChoreEvent): unknown };

/** Tiere der Wiese, auf der der Trog (x, y) steht: Nur sie freuen sich über Futter und Wasser */
const meadowAnimals = (s: Hands, world: World, x: number, y: number) =>
  s.animals.filter((a) => a.mode === 'home' && a.realm === world.realm(x, y)).map((a) => a.id);

/** Was ein volles Feld beim Hineinlaufen gibt: Busch Beeren, Fischkiste Fische, Pilzbeet Leuchtpilze */
const SOURCES = { bush: 'pick', fishcrate: 'catch', shroombed: 'gather' } as const;
/** Trog, der Futter nimmt, und welches */
const BOWLS = { trough: 'berries', icebowl: 'fish', shroombowl: 'pilze' } as const;
/**
 * Pilzschale und Steintrog der Grotte zeigen, ob sie voll sind: Gefüllt merkt `picked` den Takt, nach `REGROW` Takten
 * haben die Tiere sie geleert (Ereignis `regrow`), dann kann das Kind sie wieder füllen
 */
const SHOWS_FULL: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>(['shroombowl', 'stonetrough']);

/** Trägt die Figur dieses Futter (Korb mit Beeren, Netz mit Fisch, Korb mit Leuchtpilzen)? */
const carries = (s: Hands, food: (typeof BOWLS)[keyof typeof BOWLS]) =>
  food === 'berries' ? s.basket : food === 'fish' ? s.fish : s.shrooms;

/** An einem vollen Busch, einer vollen Fischkiste oder einem vollen Pilzbeet: hinein in Korb oder Netz */
function harvest(s: Hands, c: Cell, x: number, y: number, events: Events): boolean {
  const source = c.deco && c.deco in SOURCES ? SOURCES[c.deco as keyof typeof SOURCES] : null;
  if (!source || `${x},${y}` in s.picked) return false;
  s.picked[`${x},${y}`] = s.tick;
  // Der Korb trägt eine Sorte: Was schon darin liegt, macht der neuen Platz (nie ein Hindernis, nichts ist versperrt)
  if (source === 'pick') [s.basket, s.shrooms] = [true, false];
  else if (source === 'catch') s.fish = true;
  else [s.basket, s.shrooms] = [false, true];
  events.push({ type: source, x, y });
  return true;
}

/** Mit dem passenden Futter in Futtertrog, Eisschale oder Pilzschale: Es kommt hinein, die Tiere der Wiese freuen sich */
function feed(s: Hands, world: World, c: Cell, x: number, y: number, events: Events): boolean {
  const food = c.deco && c.deco in BOWLS ? BOWLS[c.deco as keyof typeof BOWLS] : null;
  if (!food || !carries(s, food)) return false;
  // Beeren und Pilze kommen samt Korb weg, die Fische rutschen in die Schale (das Netz ist leer)
  if (food === 'berries') s.basket = false;
  else if (food === 'fish') s.fish = false;
  else s.shrooms = false;
  if (SHOWS_FULL.has(c.deco)) s.picked[`${x},${y}`] = s.tick;
  events.push({ type: 'feed', food, ids: meadowAnimals(s, world, x, y), x, y });
  return true;
}

/**
 * Die Figur läuft in das Feld (x, y): An einem vollen Busch pflückt sie Beeren in den Korb, an einer vollen Fischkiste
 * fängt sie Fische ins Netz, an einem vollen Pilzbeet hüpfen die Leuchtpilze in den Korb (alle sind danach eine Weile
 * leer). Der Korb trägt nur eine Sorte: Mit Beeren darin tauscht ein volles Pilzbeet sie gegen Pilze, mit Pilzen ein
 * voller Busch sie gegen Beeren. Mit Korb voll Beeren in den Futtertrog, mit Netz in die Eisschale, mit Korb voll Pilzen in die Pilzschale, mit
 * vollem Eimer (in der Grotte der Kanne) in den Wassertrog oder Steintrog: Es kommt hinein, alle Tiere dieser Wiese
 * freuen sich. Mit leerer Hand ans Wasser oder an die Tropfquelle: Sie schöpft einen Eimer voll. Liefert true, wenn der
 * Zug damit erledigt ist (die Figur bleibt stehen); sonst ist das Feld, was es ist (leere Quellen und Tröge versperren
 * wie ein Busch).
 */
export function chore(s: Hands, world: World, x: number, y: number, events: Events): boolean {
  const c = world.cell(x, y);
  if (harvest(s, c, x, y, events) || feed(s, world, c, x, y, events)) return true;
  if (!s.bucket && (c.ground === 'water' || c.deco === 'dripspring')) {
    s.bucket = true;
    events.push({ type: 'fill', x, y });
    return true;
  }
  if (!s.bucket || (c.deco !== 'watertrough' && c.deco !== 'stonetrough')) return false;
  s.bucket = false;
  if (SHOWS_FULL.has(c.deco)) s.picked[`${x},${y}`] = s.tick;
  events.push({ type: 'pour', ids: meadowAnimals(s, world, x, y), x, y });
  return true;
}

/**
 * Nach `REGROW` Takten hängen am Busch neue Beeren, liegen in der Kiste neue Fische und stehen im Beet neue Pilze, auch
 * nachts; Pilzschale und Steintrog der Grotte sind dann leer gefressen und getrunken
 */
export function regrow(s: Hands, events: Events) {
  for (const [k, at] of Object.entries(s.picked))
    if (s.tick - at >= REGROW) {
      delete s.picked[k];
      const [x, y] = fromKey(k);
      events.push({ type: 'regrow', x, y });
    }
}
