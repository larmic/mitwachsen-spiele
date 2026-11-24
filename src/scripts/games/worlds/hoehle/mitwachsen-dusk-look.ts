// Abend in der Kristallgrotte (Konzept „Gleisbauer und Höhlen-Welt“, Licht und Schritt 13 „Schmuck mit Zug“), im Paket
// der Höhlenwelt: Ab 20 min Spielzeit (`Scene.evening` > 0) werden die Lichtflecken unter den drei Lichtschächten
// golden-orange (`Cell.shaft`; in 2D färbt sich der Lichtfleck am Boden selbst, `duskGround`, unter Figur und Tieren;
// in 3D liegt es halb durchsichtig auf der Ebene darüber), und die Fledermäuse, die im Kristallbogen hängen (höchstens
// zwei), wachen auf und fliegen Runden um den Lichtschacht über dem Höhlenbett (Schacht 0), zu sehen vom Bett und vom
// Bahnhof Fledermaus; solange hängen sie nicht an ihrem Platz (`away`). Sie fliegen auch, solange die Figur im
// Höhlenbett schläft („Gute Nacht, Fledermaus“). Bei reduzierter Bewegung fliegt keine (sie hängen weiter), das
// Abendlicht bleibt. Nur Bild, kein Spielstand; erreichbar erst mit offenem Höhlentor (nach dem Hau-ruck).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Schmuck mit Zug)

import type { Dir, Projection } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { roostAt } from '../../mitwachsen-roost';
import { drawBox } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';
import { glowOver } from './mitwachsen-cave-look';

/** Runden der Fledermäuse am Abend: um diesen Schacht (über dem Bett), so weit (Felder), so hoch, so lange je Runde (ms) */
export const DUSK_ROUND = { shaft: 0, r: 2.5, lift: 2.2, ms: 6000, most: 2 } as const;
/** In 3D: so weit (Felder, Schachbrett) um die Figur zeigt sich das Abendlicht der Schächte auf der Ebene darüber */
export const DUSK_NEAR = 16;
/** Abendlicht höchstens so deckend (über der Mitte des Lichtflecks, bei vollem Abend) */
export const DUSK_ALPHA = 0.45;

/** Was der Abend sich fürs Bild merkt: die Sitzplätze, deren Fledermaus gerade fliegt, und wann (ms) */
export type Dusk = { away: ReadonlySet<string>; at: number };

type Animal = { species: Parameters<typeof roostAt>[0]['species']; mode: string; x: number; y: number };
type Lit = { sleeping?: boolean; player: { x: number; y: number }; animals: readonly Animal[] };
type Cave = Pick<World, 'cell' | 'realm' | 'homes'>;
type Centre = { x: number; y: number; z: number };

const near = new WeakMap<object, { at: string; found: Map<number, Point[]> }>();
const centres = new WeakMap<object, Centre | null>();

/** Felder der Lichtflecken bis `DUSK_NEAR` um (x, y), je Schacht (`Cell.shaft`); je Welt und Feld der Figur einmal */
export function shaftsNear(world: Pick<World, 'cell'>, x: number, y: number): Map<number, Point[]> {
  const last = near.get(world);
  if (last?.at === `${x},${y}`) return last.found;
  const out = new Map<number, Point[]>();
  for (let dy = -DUSK_NEAR; dy <= DUSK_NEAR; dy++)
    for (let dx = -DUSK_NEAR; dx <= DUSK_NEAR; dx++) {
      const i = world.cell(x + dx, y + dy).shaft;
      if (i !== undefined) out.set(i, [...(out.get(i) ?? []), [x + dx, y + dy]]);
    }
  near.set(world, { at: `${x},${y}`, found: out });
  return out;
}

/**
 * Mitte der Runde: die Mitte des Lichtflecks über dem Höhlenbett (alle Felder mit `Cell.shaft` 0 um das Bett, fest,
 * egal wo die Figur steht), in der Höhe seines Bodens; je Welt einmal. Ohne Grotte (kein solcher Fleck) null
 */
export function roundCentre(world: Cave): Centre | null {
  const known = centres.get(world);
  if (known !== undefined) return known;
  const [bx, by] = world.homes.hoehle.bed;
  const r = Math.ceil(GROTTE.shaft.r) + 2;
  const patch: Point[] = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (world.cell(bx + dx, by + dy).shaft === DUSK_ROUND.shaft && world.realm(bx + dx, by + dy) === 'hoehle')
        patch.push([bx + dx, by + dy]);
  const floor = patch.filter(([x, y]) => !world.cell(x, y).solid);
  const found = floor.length
    ? {
        x: patch.reduce((s, p) => s + p[0], 0) / patch.length + 0.5,
        y: patch.reduce((s, p) => s + p[1], 0) / patch.length + 0.5,
        z: Math.max(...floor.map(([x, y]) => world.cell(x, y).h)),
      }
    : null;
  centres.set(world, found);
  return found;
}

/** Wie deckend das Abendlicht auf einem Feld mit Licht `light` liegt (0 am Rand des Flecks, `DUSK_ALPHA` in der Mitte) */
export const duskAlpha = (light: number, evening: number) =>
  Math.max(0, Math.min(1, evening)) * DUSK_ALPHA * Math.min(1, light / 0.35);

const GLOW = [255, 246, 220]; // Farbe von `glowOver`
const DUSK_RGB = (GROTTE_COLORS.dusk.slice(1).match(/../g) ?? []).map((h) => parseInt(h, 16));

/**
 * In 2D der Lichtfleck eines Felds mit Licht `light` am Abend: unter einem Schacht (`shaft` gesetzt) vom hellen Licht
 * (`glowOver`) zum golden-orangen Abendlicht hin, je abendlicher und je näher der Mitte, desto mehr; sonst wie am Tag
 */
export function duskGround(light: number, shaft: number | undefined, evening = 0): string {
  const a = shaft === undefined ? 0 : duskAlpha(light, evening);
  if (a <= 0) return glowOver(light);
  const k = a / DUSK_ALPHA;
  const rgb = GLOW.map((v, i) => Math.round(v + ((DUSK_RGB[i] ?? v) - v) * k));
  return `rgba(${rgb.join(', ')}, ${Math.max(Math.min(0.45, light), a).toFixed(2)})`;
}

/**
 * Wo die Fledermaus `i` von `n` gerade ist (`ms`: Zeit des Bilds): ein Kreis um `centre`, die Fledermäuse um eine Runde
 * gleichmäßig versetzt, Blick in Flugrichtung
 */
export function duskBat(ms: number, i: number, n: number, centre: Centre) {
  const a = (ms / DUSK_ROUND.ms + i / Math.max(1, n)) * 2 * Math.PI;
  const [vx, vy] = [Math.cos(a), -Math.sin(a)];
  const dir: Dir = Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'e' : 'w') : vy > 0 ? 's' : 'n';
  return {
    x: centre.x + DUSK_ROUND.r * Math.sin(a),
    y: centre.y + DUSK_ROUND.r * Math.cos(a),
    z: centre.z + DUSK_ROUND.lift + 0.2 * Math.sin(a * 3),
    dir,
  };
}

/** Sitzplätze, an denen gerade eine Fledermaus hängt (höchstens `DUSK_ROUND.most`, die nächsten zur Figur zuerst) */
export function hanging(world: Pick<World, 'cell'>, state: Lit): Point[] {
  const { x, y } = state.player;
  return state.animals
    .filter((a) => a.species === 'fledermaus' && roostAt(a, world.cell(a.x, a.y)) !== undefined)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
    .slice(0, DUSK_ROUND.most)
    .map((a): Point => [a.x, a.y]);
}

/** Schläft die Figur in der Grotte (im Höhlenbett)? Dann fliegen die Fledermäuse ihre Runden auch ohne Abend */
export const asleepInCave = (world: Pick<World, 'realm'>, state: Lit) =>
  !!state.sleeping && world.realm(Math.round(state.player.x), Math.round(state.player.y)) === 'hoehle';

/**
 * Abend in der Luft der Grotte zeichnen: in 3D (`lit3d`) das Abendlicht über den Lichtflecken in der Nähe (in 2D färbt
 * der Boden selbst, `duskGround`), Fledermaus-Runden um den Schacht über dem Bett (`bat` zeichnet eine Fledermaus);
 * liefert, welche Sitzplätze gerade leer sind. Vor dem Abend (`evening` 0), solange die Figur nicht im Höhlenbett
 * schläft, nichts
 */
export function drawDusk(
  ctx: CanvasRenderingContext2D,
  world: Cave,
  P: Projection,
  sc: { now: number; reduced: boolean; lit3d?: boolean; evening?: number; explored: (x: number, y: number) => boolean },
  state: Lit | undefined,
  bat: (x: number, y: number, z: number, dir: Dir) => void,
): Dusk | undefined {
  const evening = sc.evening ?? 0;
  if (!state || (evening <= 0 && !asleepInCave(world, state))) return undefined;
  if (sc.lit3d && evening > 0) {
    const shafts = shaftsNear(world, Math.round(state.player.x), Math.round(state.player.y));
    for (const cells of shafts.values())
      for (const [x, y] of cells) {
        const c = world.cell(x, y);
        if (c.solid || !sc.explored(x, y)) continue;
        ctx.globalAlpha = duskAlpha(c.light ?? 0, evening);
        drawBox(ctx, P, [x, y, c.h, 1, 1, 0.012, GROTTE_COLORS.dusk, GROTTE_COLORS.dusk]);
      }
    ctx.globalAlpha = 1;
  }
  const centre = roundCentre(world);
  const from = sc.reduced || !centre ? [] : hanging(world, state);
  if (!centre || !from.length) return { away: new Set(), at: sc.now };
  from.forEach((_, i) => {
    const b = duskBat(sc.now, i, from.length, centre);
    if (sc.explored(Math.round(b.x), Math.round(b.y))) bat(b.x, b.y, b.z, b.dir);
  });
  return { away: new Set(from.map(([x, y]) => `${x},${y}`)), at: sc.now };
}

/** Hängt die Fledermaus vom Sitzplatz (x, y) gerade nicht dort, weil sie am Abend fliegt (zuletzt gezeichnet vor < 0,5 s)? */
export const duskAway = (dusk: Dusk | undefined, x: number, y: number, now: number) =>
  !!dusk && now - dusk.at < 500 && dusk.away.has(`${x},${y}`);
