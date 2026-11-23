// Leben in der Luft der Kristallgrotte, gleich für 2D und die Ebene über 3D (der Kern ruft es als `Sky.weather`, solange
// die Figur in der Grotte ist; die 3D-Ansicht reicht ihre eigene Projektion herein): der fallende Tropfen
// (mitwachsen-drips.ts), der Grottenolm am Steg (mitwachsen-olm-look.ts), die Fledermaus auf ihrer Runde und in 3D der
// helle Schein einer Säule, die gerade klingt (mitwachsen-chime-look.ts; in 2D leuchtet die Säule selbst), dazu der
// Lichtkreis um die Figur (mitwachsen-glow.ts; auch im Nebel, er gehört zur Figur). Im Nebel zeigt sich sonst nichts. Bei reduzierter Bewegung kein Tropfen und keine Flugrunde. Wetter gibt es in der Grotte keins.
// Teil des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Schmuck der Grotte“)

import { drawModel, type Projection } from '../../../../lib/games/front';
import { CAVE_MODELS } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Sky } from '../../mitwachsen-view';
import { drawBox } from '../../mitwachsen-view';
import type { SkyScene } from '../../mitwachsen-sky';
import type { World } from '../../mitwachsen-world';
import { columnBoxes } from './mitwachsen-cave-look';
import type { Chime } from './mitwachsen-chime-look';
import type { Drips } from './mitwachsen-drips';
import { OLM_MS, type Olm } from './mitwachsen-olm-look';
import { circleOf, drawCircle, type Circle } from './mitwachsen-glow';

/**
 * Was die Grotte sich fürs Bild merkt: Glockenspiel, Tropfen, Grottenolm; Licht: seit wann die Figur die Laterne trägt
 * (`since`, ms; für das Wachsen des Lichtkreises) und der zuletzt gezeichnete Lichtkreis (`drawn`, für die Tests)
 */
export type CaveFx = { chime: Chime; drips: Drips; olm: Olm; light: { since?: number; drawn?: Circle | null } };

const [WATER, WATER_TOP] = GROTTE_COLORS.water;

/**
 * Szene, wie die Grotte sie liest: dazu, ob die 3D-Ansicht darunter liegt (dann leuchtet die Säule hier), und die Körper
 * (die Figur unter 'player': dort liegt der Lichtkreis)
 */
type CaveScene = SkyScene & {
  lit3d?: boolean;
  bodies?: ReadonlyMap<string, { x: number; y: number; z: number; hop: number }>;
};

/** Zustand, wie der Lichtkreis ihn liest */
type Lit = { sleeping: boolean; ride?: unknown; lamp?: unknown; player: { x: number; y: number } };

/**
 * Lichtkreis um die Figur, solange sie wach und zu Fuß in der Grotte ist (sonst null): mit der Laterne größer
 * (mitwachsen-glow.ts)
 */
export function circleNow(
  world: Pick<World, 'realm'>,
  state: Lit | undefined,
  fx: CaveFx,
  now: number,
  reduced: boolean,
) {
  if (!state || state.sleeping || state.ride || world.realm(state.player.x, state.player.y) !== 'hoehle') return null;
  return circleOf(!!state.lamp, fx.light.since, now, reduced);
}

/** `Sky.weather` der Grotte: alles, was sich in ihrer Luft bewegt, und der Lichtkreis um die Figur */
export function caveWeather(fx: CaveFx): Sky['weather'] {
  return (ctx, world, sc: CaveScene, P, state) => {
    const me = sc.bodies?.get('player');
    const circle = me ? circleNow(world, state, fx, sc.now, sc.reduced) : null;
    fx.light.drawn = circle;
    if (me && circle) drawCircle(ctx, P, { x: me.x, y: me.y, z: me.z + me.hop }, circle);
    const seen = (x: number, y: number) => sc.explored(Math.round(x), Math.round(y));
    if (sc.lit3d) glows(ctx, world, fx, sc, P, seen);
    const drop = sc.reduced ? null : fx.drips.falling(sc.now);
    if (drop && seen(drop.x, drop.y))
      drawBox(ctx, P, [drop.x + 0.46, drop.y + 0.1, drop.z, 0.08, 0.08, 0.14, WATER, WATER_TOP]);
    const olm = fx.olm.now(world, sc.now, sc.reduced);
    if (olm && seen(olm.x, olm.y)) {
      const { x, y, z } = olm;
      drawModel(ctx, P, CAVE_MODELS.grottenolm, x + 0.5, y + 0.5, z, 's', CAVE_SPECIES.grottenolm.scale);
      // die Oberfläche des Wassers über seinem Bauch, dazu ein Ring, der sich weitet (nicht bei reduzierter Bewegung)
      ctx.globalAlpha = 0.6;
      drawBox(ctx, P, [x + 0.1, y + 0.55, -0.01, 0.8, 0.4, 0.02, WATER, WATER_TOP]);
      const r = sc.reduced ? 0 : 0.3 + 0.4 * (olm.ms / OLM_MS);
      ctx.globalAlpha = sc.reduced ? 0 : 0.5 * (1 - olm.ms / OLM_MS);
      if (r) drawBox(ctx, P, [x + 0.5 - r, y + 0.5 - r * 0.5, 0.005, 2 * r, r, 0.01, '#ffffff', '#ffffff']);
      ctx.globalAlpha = 1;
    }
    const bat = sc.reduced ? null : fx.chime.bat(world, sc.now);
    if (bat && seen(bat.x, bat.y))
      drawModel(ctx, P, CAVE_MODELS.fledermaus, bat.x, bat.y, bat.z, bat.dir, CAVE_SPECIES.fledermaus.scale);
  };
}

/** In 3D: Säulen, die gerade klingen, leuchten auf der Ebene darüber heller (halb durchsichtig, verblasst in 0,5 s) */
function glows(
  ctx: CanvasRenderingContext2D,
  world: World,
  fx: CaveFx,
  sc: CaveScene,
  P: Projection,
  seen: (x: number, y: number) => boolean,
) {
  for (const [x, y, g] of fx.chime.glowing(sc.now)) {
    const c = world.cell(x, y);
    if (c.deco !== 'column' || !seen(x, y)) continue;
    ctx.globalAlpha = 0.55 * g;
    drawBox(ctx, P, columnBoxes(c, x, y, 1)[1]);
    ctx.globalAlpha = 1;
  }
}
