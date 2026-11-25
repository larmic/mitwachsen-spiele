// Ein Funke über den Sammelstellen der Kristallgrotte (Konzept „Höhle nach dem ersten Spielen“, Punkt 8, Schritt 9),
// gleich für 2D und die Ebene über 3D: Auf dem ganzen Bild steht höchstens ein kleiner Funke zur selben Zeit, alle
// `GROTTE.spark.every` ms für `show` ms, abwechselnd über den nächsten vollen Pilzbeeten in der Nähe der Figur (nur an
// Erkundetem, nur zu Fuß und wach). Kein Puls an jedem Beet: Ein volles Beet leuchtet ruhig (sein Loch in der Maske,
// mitwachsen-mask.ts), der Funke sagt nur „hier gibt es etwas“. Bei reduzierter Bewegung kein Funke. Kein Gold und kein
// Ton. Rein bis auf das Zeitfenster, das `Spark` sich merkt. Teil des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Sammeln in der Grotte“)

import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Projection } from '../../../../lib/games/front';
import type { Box } from '../../mitwachsen-view';
import { drawBox } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';

const S = GROTTE.spark;

/** Zustand, wie der Funke ihn liest */
export type SparkState = {
  player: { x: number; y: number };
  picked: Readonly<Record<string, number>>;
  sleeping?: boolean;
  ride?: unknown;
};

/** Der Funke: über dem Beet (x, y), Höhe `z`, wie weit er in seinem Fenster ist (0 … 1) */
export type Lit = { x: number; y: number; z: number; p: number };

/**
 * Volle Pilzbeete bis `GROTTE.spark.near` Felder um das Feld der Figur, die nächsten zuerst (bei gleichem Abstand nach
 * Lage), höchstens `of`; nur in der Grotte und an Erkundetem
 */
export function sparkSources(
  world: Pick<World, 'cell' | 'realm'>,
  s: SparkState,
  explored: (x: number, y: number) => boolean = () => true,
): [number, number][] {
  const [px, py] = [Math.round(s.player.x), Math.round(s.player.y)];
  const found: [number, number, number][] = [];
  for (let dy = -S.near; dy <= S.near; dy++)
    for (let dx = -S.near; dx <= S.near; dx++) {
      const d = dx * dx + dy * dy;
      if (d > S.near * S.near) continue;
      const [x, y] = [px + dx, py + dy];
      if (world.cell(x, y).deco !== 'shroombed' || `${x},${y}` in s.picked) continue;
      if (world.realm(x, y) === 'hoehle' && explored(x, y)) found.push([x, y, d]);
    }
  found.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  return found.slice(0, S.of).map(([x, y]) => [x, y]);
}

/** Was der Funke sich merkt: das laufende Zeitfenster und sein Beet */
export class Spark {
  private slot = -1;
  private at: [number, number] | null = null;

  /**
   * Der Funke in diesem Bild (null: keiner): Beginnt ein neues Fenster, wählt er reihum eines der nächsten vollen Beete;
   * er steht `show` ms, danach ist bis zum nächsten Fenster keiner. Ist das Beet inzwischen leer, verlischt er
   */
  now(
    world: Pick<World, 'cell' | 'realm'>,
    s: SparkState | undefined,
    now: number,
    reduced: boolean,
    explored?: (x: number, y: number) => boolean,
  ): Lit | null {
    if (reduced || !s || s.sleeping || s.ride || world.realm(s.player.x, s.player.y) !== 'hoehle') return null;
    const slot = Math.floor(now / S.every);
    if (slot !== this.slot) {
      this.slot = slot;
      const near = sparkSources(world, s, explored);
      this.at = near[slot % Math.max(1, near.length)] ?? null;
    }
    const p = (now - slot * S.every) / S.show;
    if (!this.at || p >= 1 || `${this.at[0]},${this.at[1]}` in s.picked) return null;
    const [x, y] = this.at;
    return { x, y, z: world.cell(x, y).h + 0.85, p };
  }
}

/**
 * Höchstens ein Glitzern auf dem ganzen Bild: Steht gerade der Funke, glitzert der Tropfen der fernen Tropfquelle
 * (mitwachsen-drips.ts) in diesem Bild nicht; sonst darf er
 */
export function oneGlitter<T>(spark: Lit | null, far: T | null): { spark: Lit | null; far: T | null } {
  return { spark, far: spark ? null : far };
}

/** Der Funke als zwei schmale Quader über Kreuz (weiß, steigt ein wenig, blendet ein und aus) */
export function sparkBoxes({ x, y, z, p }: Lit): Box[] {
  const k = 0.18 * Math.sin(Math.PI * p); // wächst und schrumpft
  const zz = z + 0.15 * p;
  return [
    [x + 0.5 - k, y + 0.48, zz + k * 0.6, 2 * k, 0.04, 0.04, '#ffffff', '#ffffff'],
    [x + 0.48, y + 0.48, zz, 0.04, 0.04, 2 * k * 0.8, '#ffffff', '#ffffff'],
  ];
}

/** Den Funken zeichnen (über der Maske: er ist Licht) */
export function drawSpark(ctx: CanvasRenderingContext2D, P: Projection, lit: Lit | null) {
  if (!lit) return;
  ctx.globalAlpha = 0.9 * Math.sin(Math.PI * lit.p);
  for (const b of sparkBoxes(lit)) drawBox(ctx, P, b);
  ctx.globalAlpha = 1;
}
