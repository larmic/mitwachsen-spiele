// Der Grottenolm taucht am Steg auf, in Bild und Ton, gleich für 2D und 3D: Betritt die Figur das Ende des Holzstegs
// (Regel in mitwachsen-cave-rules.ts), hebt sich der elfenbeinfarbene Grottenolm (sein Modell aus dem Welt-Paket)
// im Wasser neben dem Steg kurz heraus, lächelt zur Kamera und macht „blubb“, dann taucht er wieder ab. Bei
// reduzierter Bewegung zeigt er sich still an der Oberfläche, ohne Auf und Ab und ohne Ringe; „blubb“ bleibt. Ein
// eigenes Wesen nur fürs Bild, kein Tier der Welt (die Grottenolme der Leiste wohnen am Steg und am Höhlenbett).
// Teil des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Schmuck der Grotte“)

import type { Point } from '../../../../data/games/mitwachsen';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';

/** So lange (ms) ist der Grottenolm über Wasser */
export const OLM_MS = 1800;
/** So viele Sekunden nach dem Betreten des Stegs macht er „blubb“ (wenn er oben ist) */
const BLUBB_AT = 0.35;
/** So weit (Felder) neben der Planke sucht er sich Wasser */
const REACH = 2;

/**
 * Wasser neben der Planke (x, y), in dem er auftaucht: das nächste Feld Wasser bis `REACH` Felder entfernt (bei
 * gleichem Abstand das obere, dann das linke); keins: null
 */
export function olmWater(world: Pick<World, 'cell'>, x: number, y: number): Point | null {
  let best: Point | null = null,
    bestD = Infinity;
  for (let dy = -REACH; dy <= REACH; dy++)
    for (let dx = -REACH; dx <= REACH; dx++) {
      const d = dx * dx + dy * dy;
      if (d >= bestD || world.cell(x + dx, y + dy).ground !== 'water') continue;
      [best, bestD] = [[x + dx, y + dy], d];
    }
  return best;
}

/**
 * Wie hoch über dem Wasser er `ms` nach dem Auftauchen ist (der Bauch unter der Oberfläche, darum negativ): hebt sich
 * und sinkt wieder; bei reduzierter Bewegung still an der Oberfläche. Vorbei (oder vor dem Beginn): null
 */
export function olmRise(ms: number, reduced: boolean): number | null {
  if (ms < 0 || ms >= OLM_MS) return null;
  return reduced ? -0.08 : -0.3 + 0.28 * Math.sin((ms / OLM_MS) * Math.PI);
}

/** „blubb“: sein Ton (C4, gleitet nach unten, aus `CAVE_SPECIES`), dazu ein kleines Bläschen hinterher */
export function blubbScore(): Scored[] {
  const { notes, len, gain, wave, slide = 1 } = CAVE_SPECIES.grottenolm.tone;
  return [
    ...notes.map((f) => [f, len, wave, gain, slide, BLUBB_AT] as Scored),
    [1046.5, 0.05, 'sine', 0.03, 1.2, BLUBB_AT + len],
  ];
}

/** Was der Steg sich fürs Bild merkt: an welcher Planke und seit wann der Grottenolm auftaucht */
export class Olm {
  private at = -Infinity;
  private plank: Point | null = null;
  private water: Point | null | undefined;

  /** Die Figur betritt das Ende des Stegs bei (x, y), um `now`: er taucht auf, „blubb“ */
  surface(x: number, y: number, now: number): Scored[] {
    [this.at, this.plank, this.water] = [now, [x, y], undefined];
    return blubbScore();
  }

  /** Wo und wie hoch er gerade ist (null: nicht zu sehen) */
  now(world: Pick<World, 'cell'>, now: number, reduced: boolean) {
    const z = olmRise(now - this.at, reduced);
    if (z === null || !this.plank) return null;
    if (this.water === undefined) this.water = olmWater(world, ...this.plank);
    return this.water ? { x: this.water[0], y: this.water[1], z, ms: now - this.at } : null;
  }
}
