import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../data/games/mitwachsen';
import { LANTERN_PARTS } from '../../../../data/games/mitwachsen-hoehle';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { DIRS, TILE_W, projection, type Dir, type Projection } from '../../../../lib/games/front';
import { stops } from '../../input-pace';
import { carried, carryKey } from '../../mitwachsen-carry';
import type { Cell } from '../../mitwachsen-cell';
import { reshapes } from '../../mitwachsen-chores';
import { initialState, progressOf, step, type GameEvent, type State } from '../../mitwachsen-state';
import type { SkyScene } from '../../mitwachsen-sky';
import { packScore } from '../../mitwachsen-view';
import { kesselPlace, type World } from '../../mitwachsen-world';
import { EIS_PACK, HOEHLE_PACK, PACKS, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { caveBoxes, glowOver } from './mitwachsen-cave-look';
import { caveWeather, circleNow, type CaveFx } from './mitwachsen-cave-sky';
import { Chime } from './mitwachsen-chime-look';
import { Drips } from './mitwachsen-drips';
import { fromMouth } from './mitwachsen-grotte';
import { circleOf, circleOnScreen, darken, drawCircle, edgeDim, isWall, shadowOver } from './mitwachsen-glow';
import { LANTERN_READY, POST_H, lanternBodies, lanternScore, lanternSpot, takeLantern } from './mitwachsen-lantern';
import { Olm } from './mitwachsen-olm-look';
import type { Site } from './mitwachsen-site';
import { fx, ground, view } from './view-2d';
import { view3d } from './view-3d';

/** Seeds, deren Grotte um eine Ecke liegt */
const TURNED = [26, 30];
/** Eigenschafts-Tests, die ganze Welten bauen: wenige Seeds, im tiefen Lauf 20 */
const SEEDS = seedsFor(seedRange(1, 20), [...SAMPLE_SEEDS, ...TURNED]);
const PENTA = new Set([0, 2, 4, 7, 9]); // C-Dur-Pentatonik in Halbtönen über C
const semis = (f: number) => ((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12;
const GOLDS: unknown[] = Object.values(GOLD);
const key = ([x, y]: readonly [number, number]) => `${x},${y}`;

type Placed = { bed: Point; cells: readonly Point[]; site: Site };
const placeOf = (seed: number) => kesselPlace(seed, HOEHLE_PACK) as Placed;

/** Wach, allein, die Figur steht auf (x, y) mit Blick `dir` */
const at = (w: World, [x, y]: Point, dir: Dir, extra: Partial<State> = {}): State => ({
  ...initialState(w),
  sleeping: false,
  wokeAt: -1e9,
  animals: [],
  ...extra,
  player: { x, y, dir },
});
const walk = (w: World, s: State, dir: Dir, packs: Parameters<typeof step>[5] = PACKS) =>
  step(s, w, { type: 'move', dir }, undefined, undefined, packs);
const of = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Ein begehbares Nachbarfeld des Sockels (gleiche Höhe) und die Richtung von dort hinein */
function besidePost(w: World): { from: Point; dir: Dir } {
  const p = lanternSpot(w);
  for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
    const from: Point = [p[0] - dx, p[1] - dy];
    const c = w.cell(...from);
    if (c.region === 'hoehle' && !c.solid && c.ground !== 'water' && c.h === w.cell(...p).h) return { from, dir };
  }
  throw new Error('kein Nachbarfeld am Sockel');
}

/** Ein Weg der Grotte (u, v von ihrer Mitte): Mündung und Lampengang, Weg durch die Mitte, Bett samt Wiese */
const onPath = (u: number, v: number, [bu, bv]: Point) =>
  Math.abs(u) <= 3 ||
  Math.hypot(u - bu, v - bv) <= GROTTE.flat + 3 ||
  (v + GROTTE.shape.ry < GROTTE.lamps.to + 4 && Math.abs(u) <= 6);

/** Was am Schatten eines Bodens nicht stimmt (leer: alles gut) */
function floorProblem(c: Cell, path: boolean): string | null {
  const dim = c.dim ?? 0;
  if (dim < 0 || dim > GROTTE.edge.floor) return `${dim}`;
  if (dim > 0 && (path || (c.light ?? 0) > 0 || c.garden || c.ground === 'water'))
    return 'Schatten auf Weg, Bett, Wasser oder Licht';
  return null;
}

/** Schatten der Ränder eines Seeds: Fehler, Zahl der Wände, Böden, Böden im Schatten und direkt an der Wand */
function shadeOf(seed: number) {
  const w = worldOf(seed, [HOEHLE_PACK]);
  const { cells, site, bed } = placeOf(seed);
  const home = site.uv(...bed);
  const bad: string[] = [];
  let [walls, darkFloor, floor, edge] = [0, 0, 0, 0];
  for (const p of cells) {
    const c = w.cell(...p);
    const dim = c.dim ?? 0;
    if (isWall(c)) {
      walls++;
      if (dim !== GROTTE.edge.wall) bad.push(`${key(p)}: Wand ${dim}`);
      continue;
    }
    if (c.solid || c.region !== 'hoehle') continue;
    floor++;
    if (dim > 0) darkFloor++;
    if (dim === GROTTE.edge.floor) edge++;
    const problem = floorProblem(c, onPath(...site.uv(...p), home));
    if (problem) bad.push(`${key(p)}: ${problem}`);
  }
  return { bad, walls, darkFloor, floor, edge };
}

describe('Licht der Grotte: Ränder im Dunkel', () => {
  it('an der Wand am dunkelsten, nach innen weniger, ab `reach` Feldern nichts; nie wirklich dunkel', () => {
    const { floor, reach, wall } = GROTTE.edge;
    expect(edgeDim(1)).toBe(floor);
    const ds = Array.from({ length: reach }, (_, i) => edgeDim(i + 1));
    expect(ds.every((d, i) => i === 0 || d < ds[i - 1]!)).toBe(true);
    expect(ds.every((d) => d > 0)).toBe(true);
    expect([edgeDim(0), edgeDim(reach + 1), edgeDim(40)]).toEqual([0, 0, 0]);
    expect(floor).toBeLessThan(wall);
    expect(wall).toBeLessThanOrEqual(0.3); // höchstens 30 % dunkler: nie wirklich dunkel
  });

  for (const seed of SEEDS)
    it(`Seed ${seed}: Wände und Boden an ihnen dunkler; Wege, Bett, Wasser und Licht nie (nie dunkler als die Dämmerung)`, () => {
      const { bad, walls, darkFloor, floor, edge } = shadeOf(seed);
      expect(bad.slice(0, 10), `Seed ${seed}`).toEqual([]);
      expect(walls, `Seed ${seed}`).toBeGreaterThan(500);
      expect(edge, `Seed ${seed}: Boden direkt an der Wand`).toBeGreaterThan(50);
      // Ränder, nicht die ganze Grotte: ein spürbarer Teil des Bodens, aber weit weniger als die Hälfte
      expect(darkFloor / floor, `Seed ${seed}`).toBeGreaterThan(0.05);
      expect(darkFloor / floor, `Seed ${seed}`).toBeLessThan(0.4);
    });

  it('2D: Schatten halb durchsichtig obenauf, an der Wand über ihren obersten Block; Lichtfleck wie bisher', () => {
    const floor: Cell = { h: 1, ground: 'grotto', deco: null, region: 'hoehle', solid: false, biome: 'hoehle' };
    expect(ground({ ...floor, dim: 0.2 }, 3, 4, false)).toEqual([
      3,
      4,
      1,
      1,
      1,
      0.01,
      shadowOver(0.2),
      shadowOver(0.2),
    ]);
    const wall: Cell = { ...floor, h: 4, deco: 'rock', region: 'border', solid: true, dim: 0.3 };
    expect(ground(wall, 3, 4, false)).toEqual([3, 4, 3, 1, 1, 1, shadowOver(0.3), shadowOver(0.3)]);
    // Stalagmit oder Findling ist fest, aber keine Wand: nur die dünne Schicht obenauf, kein dunkler Block darunter
    for (const deco of ['stalagmite', 'boulder'] as const)
      expect(ground({ ...floor, deco, solid: true, dim: 0.2 }, 3, 4, false)).toEqual([
        3,
        4,
        1,
        1,
        1,
        0.01,
        shadowOver(0.2),
        shadowOver(0.2),
      ]);
    expect(ground({ ...floor, light: 0.3 }, 3, 4, false)).toEqual([3, 4, 1, 1, 1, 0.01, glowOver(0.3), glowOver(0.3)]);
    expect(ground(floor, 3, 4, false)).toBeNull();
    expect(view.ground({ ...floor, dim: 0.1 }, 0, 0, false)).toEqual(ground({ ...floor, dim: 0.1 }, 0, 0, false));
    expect(shadowOver(0.25)).toMatch(/^rgba\(46, 40, 72, 0\.25\)$/); // Farbe der Schatten, nie stärker als die Wand
    expect(shadowOver(0.9)).toMatch(/, 0\.30\)$/);
  });

  it('3D: Oberseite dunkler (`Ground.light` negativ), die Wand auch an ihren Seiten; Lichtfleck wie bisher', () => {
    const floor: Cell = { h: 1, ground: 'grotto', deco: null, region: 'hoehle', solid: false, biome: 'hoehle' };
    expect(view3d.ground({ ...floor, dim: 0.2 }, [])?.light).toBe(-0.2);
    expect(view3d.ground({ ...floor, light: 0.3 }, [])?.light).toBe(0.3);
    expect(view3d.ground(floor, [])?.light).toBeUndefined();
    const wall: Cell = { ...floor, h: 4, deco: 'rock', region: 'border', solid: true };
    const lit = view3d.ground(wall, [])!;
    const shaded = view3d.ground({ ...wall, dim: 0.3 }, [])!;
    expect(shaded.side).toBe(darken(lit.side!, 0.3));
    expect(shaded.light).toBe(-0.3);
    // Stalagmit im Schatten: fest, aber keine Wand, die Seiten des Bodenblocks bleiben wie bisher
    const stone: Cell = { ...floor, deco: 'stalagmite', solid: true };
    expect(view3d.ground({ ...stone, dim: 0.2 }, [])?.side).toBe(view3d.ground(stone, [])?.side);
    expect(view3d.ground({ ...stone, dim: 0.2 }, [])?.side).toBe(view3d.ground(floor, [])?.side);
    // Moos im Schatten: auch in 3D dunkler
    expect(view3d.ground({ ...floor, ground: 'grass', dim: 0.1 }, [])?.light).toBe(-0.1);
    expect(darken('#ffffff', 0.5)).toBe('#808080');
    expect(darken('#204060', 0)).toBe('#204060');
  });
});

describe('Licht der Grotte: Kristall-Laterne', () => {
  for (const seed of SEEDS)
    it(`Seed ${seed}: der Sockel steht rechts vorn am Höhlenbett, fest, auf der Wiese, frei zu erreichen, nicht im Weg beim Aufwachen`, () => {
      const w = worldOf(seed, [HOEHLE_PACK]);
      const posts = placeOf(seed).cells.filter((p) => w.cell(...p).deco === 'lantern');
      const spot = lanternSpot(w);
      expect(posts.map(key), `Seed ${seed}`).toEqual([key(spot)]);
      const c = w.cell(...spot);
      expect({ solid: c.solid, region: c.region, garden: c.garden }).toEqual({
        solid: true,
        region: 'hoehle',
        garden: true,
      });
      const home = w.homes.hoehle;
      expect(home.wake.map(key)).not.toContain(key(spot));
      const [bx, by] = home.bed;
      expect(Math.max(Math.abs(spot[0] - bx), Math.abs(spot[1] - by)), `Seed ${seed}`).toBeLessThanOrEqual(3);
      expect(besidePost(w).from).toBeDefined(); // von einem Nachbarfeld aus zu betreten
    });

  const w = worldOf(1, [HOEHLE_PACK]);
  const { from, dir } = besidePost(w);
  const post = lanternSpot(w);

  it('Hineinlaufen nimmt die Laterne: sie trägt sie, bleibt stehen und hält kurz an; der Sockel ist dann leer und nur fest', () => {
    const s = at(w, from, dir);
    expect(s.lamp).toBeUndefined();
    const r = walk(w, s, dir);
    expect(r.state.lamp).toBe('hoehle');
    expect(of(r.events, 'lantern')).toEqual([{ type: 'lantern', x: post[0], y: post[1] }]);
    expect([r.state.player.x, r.state.player.y]).toEqual(from);
    expect(stops(r.events)).toBe('pause');
    expect(reshapes({ type: 'lantern' })).toBe(false); // die Laterne ist ein Körper: kein Neubau in 3D
    const again = walk(w, r.state, dir);
    expect(again.events.map((e) => e.type)).toEqual(['bump']);
    expect(again.state.lamp).toBe('hoehle');
    // ohne die Regeln des Pakets ist der Sockel nur fest
    expect(walk(w, s, dir, []).events.map((e) => e.type)).toEqual(['bump']);
    // nur in der Grotte
    expect(takeLantern({ ...s }, { ...w.cell(...post), region: 'lichtung' }, ...post, [])).toBe(false);
  });

  it('nicht gespeichert; über Nacht zurück auf dem Sockel; wer die Grotte verlässt, lässt sie dort', () => {
    const carrying = walk(w, at(w, from, dir), dir).state;
    expect(progressOf(carrying)).not.toHaveProperty('lamp');
    expect(initialState(w, progressOf(carrying)).lamp).toBeUndefined();
    // ins Bett: die Laterne steht wieder auf dem Sockel
    const [bx, by] = w.homes.hoehle.bed;
    const nearBed = { ...carrying, player: { x: bx, y: by + 1, dir: 'n' as Dir } };
    const slept = walk(w, nearBed, 'n');
    expect(slept.state.sleeping).toBe(true);
    expect(slept.state.lamp).toBeUndefined();
    // draußen (zu Fuß, mit Portal oder Fahrzeug): nach dem Schritt hat sie sie nicht mehr
    const [lx, ly] = w.homes.lichtung.wake[0]!;
    const out = step(
      { ...carrying, player: { x: lx, y: ly, dir: 's' } },
      w,
      { type: 'tick' },
      undefined,
      undefined,
      PACKS,
    );
    expect(out.state.lamp).toBeUndefined();
    // in der Grotte bleibt sie in der Hand, auch über viele Takte
    let s = carrying;
    for (let i = 0; i < 50; i++) s = step(s, w, { type: 'tick' }, undefined, undefined, PACKS).state;
    expect(s.lamp).toBe('hoehle');
  });

  it('auf dem Sockel ein Körper mit goldenem Rahmen, in der Hand ohne Gold; jede Form mit eigenem Schlüssel in 3D', () => {
    const s = at(w, from, dir);
    const [body] = lanternBodies(s, w);
    expect(body).toMatchObject({ id: 'lantern', x: post[0], y: post[1], z: w.cell(...post).h + POST_H });
    expect(body!.id.startsWith('ride:')).toBe(false); // kein Fahrzeug: Antippen meint sie nicht
    expect(body!.parts.some((p) => GOLDS.includes(p[6]))).toBe(true);
    expect(lanternBodies({ ...s, lamp: 'hoehle' }, w)).toEqual([]);
    expect(lanternBodies(s, worldOf(1, [EIS_PACK]))).toEqual([]); // ohne Paket kein Sockel, keine Laterne
    expect(view.bodies!(s, w, { now: 0, frac: 0, reduced: false, lit: false })).toEqual([body]);
    // in der Hand: kein Gold, eigener Schlüssel, zusammen mit Kanne und Netz
    expect(LANTERN_PARTS.flatMap((p) => [p[6], p[7]]).filter((c) => GOLDS.includes(c))).toEqual([]);
    const none = { basket: false, shrooms: false, bucket: false, fish: false };
    expect(carried({ ...none, lamp: 'hoehle' }, true)).toEqual(LANTERN_PARTS);
    expect(carried({ ...none, bucket: true, fish: true, lamp: 'hoehle' }, true).length).toBeGreaterThan(
      LANTERN_PARTS.length,
    );
    expect(carryKey({ ...none, lamp: 'hoehle' }, true)).not.toBe(carryKey(none, true));
    expect(carryKey({ ...none, bucket: true, lamp: 'hoehle' }, true)).not.toBe(
      carryKey({ ...none, bucket: true }, true),
    );
    // der Sockel: Stein, kein Gold, so hoch wie die Laterne darauf steht
    const boxes = caveBoxes(w, w.cell(...post), ...post)!;
    expect(boxes.flatMap((b) => [b[6], b[7]]).filter((c) => GOLDS.includes(c))).toEqual([]);
    expect(Math.max(...boxes.map((b) => b[2] + b[5]))).toBeCloseTo(w.cell(...post).h + POST_H);
    expect(LANTERN_READY.length).toBeGreaterThan(LANTERN_PARTS.length); // auf dem Sockel gut zu sehen
  });

  it('Ton beim Nehmen: drei helle Töne in der Pentatonik, leise; nur das Paket der Grotte antwortet, der Lichtkreis wächst ab jetzt', () => {
    const score = lanternScore();
    expect(score.length).toBe(3);
    expect(score.every(([f]) => PENTA.has(semis(f)))).toBe(true);
    expect(score.every(([, , wave, gain]) => wave === 'sine' && gain <= 0.08)).toBe(true);
    fx.light.since = undefined;
    const before = performance.now();
    const views = [EIS_PACK.view, HOEHLE_PACK.view].filter((v) => !!v);
    expect(packScore(views, { type: 'lantern', x: 0, y: 0 })).toEqual(score);
    expect(fx.light.since).toBeGreaterThanOrEqual(before);
  });
});

describe('Licht der Grotte: Lichtkreis um die Figur', () => {
  const { r, lantern, alpha, lanternAlpha, grow } = GROTTE.circle;

  it('immer da, mit der Laterne größer und heller; wächst sanft, bei reduzierter Bewegung sofort; zurückgelegt sofort klein', () => {
    expect(circleOf(false, undefined, 0, false)).toEqual({ r, alpha });
    expect(circleOf(false, 0, 100, false)).toEqual({ r, alpha }); // ohne Laterne wächst nichts
    expect(circleOf(true, undefined, 0, false)).toEqual({ r: lantern, alpha: lanternAlpha });
    expect(circleOf(true, 1000, 1000, true)).toEqual({ r: lantern, alpha: lanternAlpha }); // reduziert: sofort
    const rs = [0, grow / 4, grow / 2, grow, grow * 2].map((ms) => circleOf(true, 1000, 1000 + ms, false).r);
    expect(rs[0]).toBe(r);
    expect(rs.every((x, i) => i === 0 || x > rs[i - 1]! || x === lantern)).toBe(true);
    expect(rs[3]).toBe(lantern);
    expect(rs[4]).toBe(lantern);
    expect(lantern).toBeGreaterThan(r * 1.5); // deutlich größer
    expect(lanternAlpha).toBeGreaterThan(alpha);
    expect(lanternAlpha).toBeLessThanOrEqual(0.25); // ein Schein, kein Scheinwerfer
  });

  it('Radius in Pixeln: so viele Felder wie der Kreis groß ist, in der Projektion der Ansicht (2D mit Zoom)', () => {
    for (const zoom of [1, 1.5]) {
      const P = projection(10, 10, 200, 150, zoom);
      const c = circleOnScreen(P, { x: 10, y: 10, z: 1 }, { r: 3, alpha: 0.2 });
      expect(c.r).toBeCloseTo(3 * TILE_W * zoom);
      expect(c.cx).toBeCloseTo(200 + 0.5 * TILE_W * zoom);
    }
  });

  /** Zeichenfläche, die Verläufe und Flächen mitschreibt */
  const canvas = () => {
    const grads: number[][] = [];
    const rects: number[][] = [];
    const ctx = {
      globalAlpha: 1,
      fillStyle: '' as unknown,
      createRadialGradient: (...a: number[]) => (grads.push(a), { addColorStop: () => {} }),
      fillRect: (...a: number[]) => void rects.push(a),
    } as unknown as CanvasRenderingContext2D;
    return { ctx, grads, rects };
  };
  const P: Projection = (x, y, z) => [x * 10, (y - z) * 10];

  it('gezeichnet als ein Verlauf im Quadrat um die Figur (billig), nichts bei Radius 0', () => {
    const c = canvas();
    drawCircle(c.ctx, P, { x: 5, y: 5, z: 1 }, { r: 2, alpha: 0.2 });
    expect(c.grads).toEqual([[55, 40, 0, 55, 40, 20]]);
    expect(c.rects).toEqual([[35, 20, 40, 40]]);
    const none = canvas();
    drawCircle(none.ctx, P, { x: 5, y: 5, z: 1 }, { r: 0, alpha: 0.2 });
    drawCircle(none.ctx, P, { x: 5, y: 5, z: 1 }, { r: 2, alpha: 0 });
    expect(none.rects).toEqual([]);
  });

  const w = worldOf(1, [HOEHLE_PACK]);
  const [wx, wy] = w.homes.hoehle.wake[0]!;
  const awake = { sleeping: false, player: { x: wx, y: wy } };

  it('nur wach und zu Fuß in der Grotte; im Bett, im Fahrzeug und draußen keiner', () => {
    const f: CaveFx = { chime: new Chime(), drips: new Drips(), olm: new Olm(), light: {} };
    expect(circleNow(w, awake, f, 0, false)).toEqual({ r, alpha });
    expect(circleNow(w, { ...awake, lamp: 'hoehle' }, f, 0, false)?.r).toBe(lantern);
    expect(circleNow(w, { ...awake, sleeping: true }, f, 0, false)).toBeNull();
    expect(circleNow(w, { ...awake, ride: {} }, f, 0, false)).toBeNull();
    const [lx, ly] = w.homes.lichtung.wake[0]!;
    expect(circleNow(w, { ...awake, player: { x: lx, y: ly } }, f, 0, false)).toBeNull();
    expect(circleNow(w, undefined, f, 0, false)).toBeNull();
  });

  it('die Luft der Grotte zeichnet ihn um den Körper der Figur, mit der Laterne größer (2D und Ebene über 3D gleich)', () => {
    const f: CaveFx = { chime: new Chime(), drips: new Drips(), olm: new Olm(), light: {} };
    const bodies = new Map([['player', { x: wx, y: wy, z: 1, hop: 0 }]]);
    const scene = { now: 0, reduced: false, explored: () => true, zoom: 1, bodies } as unknown as SkyScene;
    const plain = canvas();
    caveWeather(f)(plain.ctx, w, scene, P, { ...initialState(w), ...awake, player: { ...awake.player, dir: 's' } });
    expect(plain.grads.length).toBe(1);
    expect(plain.grads[0]![5]).toBeCloseTo(r * 10);
    expect(f.light.drawn).toEqual({ r, alpha });
    const lit = canvas();
    const s = { ...initialState(w), ...awake, lamp: 'hoehle' as const, player: { ...awake.player, dir: 's' as Dir } };
    caveWeather(f)(lit.ctx, w, scene, P, s);
    expect(lit.grads[0]![5]).toBeCloseTo(lantern * 10);
    // ohne Zustand (alte Aufrufe) oder ohne Körper: kein Kreis
    const bare = canvas();
    caveWeather(f)(bare.ctx, w, scene, P);
    caveWeather(f)(bare.ctx, w, { ...scene, bodies: new Map() } as unknown as SkyScene, P, s);
    expect(bare.grads).toEqual([]);
    expect(f.light.drawn).toBeNull();
  });

  it('Farbe: kühles, helles Licht, kein Gold, kein Feuer', () => {
    expect(GROTTE_COLORS.circle.every((v) => v >= 230)).toBe(true);
    expect(fromMouth([0, 0])[1]).toBe(-GROTTE.shape.ry); // Lagen wie im Generator
  });
});
