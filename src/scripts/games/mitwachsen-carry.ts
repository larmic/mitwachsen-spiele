// Was die Figur trägt, als Teile ihres Modells, gleich für 2D und 3D: Korb mit Beeren oder mit Leuchtpilzen auf dem
// Rücken, Eimer (in der Grotte eine Kanne aus Stein) in der rechten Hand, Netz mit Fischen in der linken, davor die
// Kristall-Laterne der Grotte.
// Spezifikation: docs/specs/mitwachsen.md (Regeln 3a und 3b, Abschnitte „Sammeln in der Grotte“ und „Licht der Grotte“)

import type { Part } from '../../lib/games/front';
import { BASKET_PARTS, BUCKET_PARTS } from '../../data/games/mitwachsen';
import { FISH_PARTS } from '../../data/games/mitwachsen-eis';
import { JUG_PARTS, LANTERN_PARTS, SHROOM_BASKET_PARTS } from '../../data/games/mitwachsen-hoehle';
import type { Hands } from './mitwachsen-chores';

type Carry = Pick<Hands, 'basket' | 'shrooms' | 'bucket' | 'fish'> & { lamp?: unknown };

/**
 * Teile für das, was die Figur trägt; `cave`: Sie steht in der Grotte (dort trägt sie das Wasser in einer Kanne). Die
 * Kristall-Laterne (`lamp`) hält sie links vor dem Netz
 */
export const carried = (s: Carry, cave: boolean): Part[] => [
  ...(s.basket ? BASKET_PARTS : s.shrooms ? SHROOM_BASKET_PARTS : []),
  ...(s.bucket ? (cave ? JUG_PARTS : BUCKET_PARTS) : []),
  ...(s.fish ? FISH_PARTS : []),
  ...(s.lamp ? LANTERN_PARTS : []),
];

/** Schlüssel des Modells dazu (die 3D-Ansicht baut je Schlüssel ein Modell) */
export const carryKey = (s: Carry, cave: boolean) =>
  `${s.basket ? '-basket' : s.shrooms ? '-shrooms' : ''}${s.bucket ? (cave ? '-jug' : '-bucket') : ''}${s.fish ? '-fish' : ''}${s.lamp ? '-lamp' : ''}`;
