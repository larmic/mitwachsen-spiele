// Tropfsteine der Kristallgrotte in Bild und Ton, gleich für 2D und 3D: Höchstens ein Tropfen je 2 s im Bild. Ist die
// Tropfquelle in der Nähe der Figur, fällt er alle 2 s von ihrer Lippe ins Felsbecken, mit einem leisen „plink“;
// sonst auf die Spitze eines Stalagmiten in der Nähe (noch leiser), gewählt je Zeitfenster und Seed-frei aus der Lage.
// Liegt die Tropfquelle weiter weg (bis `DRIP.far` Felder), glitzert ihr Tropfen in jedem zweiten Fenster (oder wenn kein
// Stalagmit in der Nähe ist) hell über der Maske, ohne Ton: das Fernsignal „hier gibt es Wasser“ (Schritt 9 der
// Rückmeldung).
// Aus dem Nebel kommt nichts: weder Tropfen noch „plink“ an Feldern, die die Figur noch nicht kennt.
// Bei reduzierter Bewegung fällt kein Tropfen (keine Teilchen), das „plink“ bleibt. Nur in der Grotte und nur, wenn
// das Spiel läuft (der Kern ruft `View2D.ambient` je Bild, nicht im Menü und nicht im Schlaf). Rein bis auf das
// Zeitfenster, das `Drips` sich merkt. Teil des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Schmuck der Grotte“)

import { hash } from '../../../../lib/games/rng';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';

/**
 * Ein Tropfen je so vielen ms, so lange (ms) fällt er, so weit (Felder, ringsum) von der Figur gilt „im Bild“ (`near`,
 * mit „plink“); bis `far` Felder glitzert der Tropfen der Quelle noch, ohne Ton
 */
export const DRIP = { every: 2000, fall: 450, near: 7, far: 16 } as const;

/**
 * Ein Tropfen: Feld, Höhe, aus der er fällt, und Höhe, auf der er ankommt; `spring`: von der Tropfquelle; `far`: die
 * Quelle liegt weiter als `DRIP.near` Felder, der Tropfen glitzert ohne Ton
 */
export type Drop = { x: number; y: number; from: number; to: number; spring: boolean; far?: true };

/** Spitze eines Stalagmiten über seinem Boden (wie `caveBoxes`: drei Stücke, `note` 0 … 2) */
const tip = (note: number) => 1.15 * (1 + note * 0.5);

/**
 * Der Tropfen im Zeitfenster `slot` für die Figur auf (px, py): an der Tropfquelle, wenn sie bis `DRIP.near` Felder
 * entfernt ist, sonst auf einen Stalagmiten der Grotte in diesem Umkreis (je Fenster ein anderer); liegt die Quelle bis
 * `DRIP.far` Felder weit, glitzert in jedem zweiten Fenster (ohne Stalagmit in jedem) ihr Tropfen (`far`); nur an
 * Erkundetem (`explored`); nichts davon: null
 */
export function dropOf(
  world: Pick<World, 'cell'>,
  px: number,
  py: number,
  slot: number,
  explored: (x: number, y: number) => boolean = () => true,
): Drop | null {
  const tips: Drop[] = [];
  let far: Drop | null = null;
  for (let dy = -DRIP.far; dy <= DRIP.far; dy++)
    for (let dx = -DRIP.far; dx <= DRIP.far; dx++) {
      const [x, y] = [px + dx, py + dy];
      const c = world.cell(x, y);
      if ((c.deco !== 'dripspring' && c.deco !== 'stalagmite') || c.region !== 'hoehle' || !explored(x, y)) continue;
      const near = Math.abs(dx) <= DRIP.near && Math.abs(dy) <= DRIP.near;
      const spring: Drop = { x, y, from: c.h + 0.7, to: c.h - 0.9, spring: true }; // ins Becken (Wasser 0)
      if (c.deco === 'dripspring' && near) return spring;
      if (c.deco === 'dripspring') far = { ...spring, far: true };
      else if (near) tips.push({ x, y, from: c.h + tip(c.note ?? 0) + 2, to: c.h + tip(c.note ?? 0), spring: false });
    }
  if (far && (slot % 2 === 1 || !tips.length)) return far;
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
    return this.drop && !this.drop.far ? plinkScore(this.drop.spring) : []; // das Fernsignal glitzert nur
  }

  /** Der Tropfen, der gerade fällt, mit seiner Höhe (null: keiner) */
  falling(now: number) {
    const z = this.drop ? dropZ(this.drop, now - this.slot * DRIP.every) : null;
    return this.drop && z !== null ? { ...this.drop, z } : null;
  }
}
