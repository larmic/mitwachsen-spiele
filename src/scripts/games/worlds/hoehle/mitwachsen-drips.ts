// Tropfsteine der Kristallgrotte in Bild und Ton, gleich für 2D und 3D: Höchstens ein Tropfen je 2 s im Bild. Ist die
// Tropfquelle in der Nähe der Figur, fällt er alle 2 s von ihrer Lippe ins Felsbecken, mit einem leisen „plink“;
// sonst auf die Spitze eines Stalagmiten in der Nähe (noch leiser), gewählt je Zeitfenster und Seed-frei aus der Lage.
// Aus dem Nebel kommt nichts: weder Tropfen noch „plink“ an Feldern, die die Figur noch nicht kennt.
// Bei reduzierter Bewegung fällt kein Tropfen (keine Teilchen), das „plink“ bleibt. Nur in der Grotte und nur, wenn
// das Spiel läuft (der Kern ruft `View2D.ambient` je Bild, nicht im Menü und nicht im Schlaf). Rein bis auf das
// Zeitfenster, das `Drips` sich merkt. Teil des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Schmuck der Grotte“)

import { hash } from '../../../../lib/games/rng';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';

/** Ein Tropfen je so vielen ms, so lange (ms) fällt er, so weit (Felder, ringsum) von der Figur gilt „im Bild“ */
export const DRIP = { every: 2000, fall: 450, near: 7 } as const;

/** Ein Tropfen: Feld, Höhe, aus der er fällt, und Höhe, auf der er ankommt; `spring`: von der Tropfquelle */
export type Drop = { x: number; y: number; from: number; to: number; spring: boolean };

/** Spitze eines Stalagmiten über seinem Boden (wie `caveBoxes`: drei Stücke, `note` 0 … 2) */
const tip = (note: number) => 1.15 * (1 + note * 0.5);

/**
 * Der Tropfen im Zeitfenster `slot` für die Figur auf (px, py): an der Tropfquelle, wenn sie bis `DRIP.near` Felder
 * entfernt ist, sonst auf einen Stalagmiten der Grotte in diesem Umkreis (je Fenster ein anderer); nur an Erkundetem
 * (`explored`); nichts davon: null
 */
export function dropOf(
  world: Pick<World, 'cell'>,
  px: number,
  py: number,
  slot: number,
  explored: (x: number, y: number) => boolean = () => true,
): Drop | null {
  const tips: Drop[] = [];
  for (let dy = -DRIP.near; dy <= DRIP.near; dy++)
    for (let dx = -DRIP.near; dx <= DRIP.near; dx++) {
      const [x, y] = [px + dx, py + dy];
      const c = world.cell(x, y);
      if (c.region !== 'hoehle' || !explored(x, y)) continue;
      if (c.deco === 'dripspring') return { x, y, from: c.h + 0.7, to: c.h - 0.9, spring: true }; // ins Becken (Wasser 0)
      if (c.deco === 'stalagmite')
        tips.push({ x, y, from: c.h + tip(c.note ?? 0) + 2, to: c.h + tip(c.note ?? 0), spring: false });
    }
  return tips[hash(slot, px, py, 79) % Math.max(1, tips.length)] ?? null;
}

/** Leises „plink“, wenn der Tropfen ankommt (G6, gleitet ein wenig hinauf), an Stalagmiten noch leiser */
export function plinkScore(spring: boolean): Scored[] {
  return [[1567.98, 0.09, 'sine', spring ? 0.035 : 0.02, 1.12, DRIP.fall / 1000]];
}

/** Höhe des Tropfens `ms` nach dem Beginn seines Fensters (er fällt schneller werdend); angekommen: null */
export function dropZ(drop: Drop, ms: number): number | null {
  if (ms < 0 || ms >= DRIP.fall) return null;
  const p = ms / DRIP.fall;
  return drop.from - (drop.from - drop.to) * p * p;
}

/** Was die Tropfsteine sich merken: das laufende Zeitfenster und seinen Tropfen */
export class Drips {
  private slot = -1;
  private drop: Drop | null = null;

  /**
   * Je Bild: Beginnt ein neues Fenster, fällt (höchstens) ein neuer Tropfen in der Nähe der Figur, dazu sein „plink“;
   * außerhalb der Grotte und im Nebel keiner
   */
  tick(
    world: World,
    state: { player: { x: number; y: number } },
    now: number,
    explored: (x: number, y: number) => boolean,
  ): Scored[] {
    const slot = Math.floor(now / DRIP.every);
    if (slot === this.slot) return [];
    this.slot = slot;
    const { x, y } = state.player;
    this.drop = world.realm(x, y) === 'hoehle' ? dropOf(world, x, y, slot, explored) : null;
    return this.drop ? plinkScore(this.drop.spring) : [];
  }

  /** Der Tropfen, der gerade fällt, mit seiner Höhe (null: keiner) */
  falling(now: number) {
    const z = this.drop ? dropZ(this.drop, now - this.slot * DRIP.every) : null;
    return this.drop && z !== null ? { ...this.drop, z } : null;
  }
}
