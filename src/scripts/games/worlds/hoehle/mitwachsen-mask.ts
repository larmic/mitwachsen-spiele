// Dunkelmaske der Kristallgrotte (Konzept „Höhle nach dem ersten Spielen“, Punkt 5, Entscheidung des Vaters vom
// 24.11.2026), im Welt-Paket der Höhlenwelt: Abseits der Figur liegt ein Nachtlila über dem Bild (Stärke
// `GROTTE.dark.mask`), gleich in 2D und auf der Ebene über 3D, ohne Punktlicht und ohne Neubau. Die Grenzen stehen als
// Helligkeit fest (relative Luminanz): Die Farbe der Maske hat selbst die Untergrenze `GROTTE.dark.floor`, und weil die
// Maske sie nur darüberlegt, wird nichts darunter dunkler als sie (Boden, Fels mit Randschatten, Nebel, der beleuchtete
// Boden in 3D; nichts wird schwarz). Der Grottenboden (2D, die dunklere Ansicht) liegt abseits der Figur deutlich unter
// der Dämmerung von heute, um die Figur, auf dem Weg zum Bett und an allem, was leuchtet, nie darunter (`GROTTE.dark.dusk`).
// Weiche Löcher (`maskHoles`): um die Figur `hole` Felder, mit der Kristall-Laterne `lantern` (wächst wie der Lichtkreis,
// bei reduzierter Bewegung sofort), im Fahrzeug um den Sitz und an den Lampen vorn; feste Löcher an den drei
// Lichtschächten, der Wiese am Bett, dem Bahnhof Fledermaus, der Mündung des Gangs und jedem Netz der Tupfspinnen;
// kleine Löcher an Kristallen, Säulen, Lampen (auch an der leuchtenden Lampe eines stehenden Fahrzeugs, `glow`), vollen
// Pilzbeeten, der Tropfquelle, Leuchtmoos, der Mitte eines Kristallfelds, dem Wasserfall und an Tieren, nur nah an der
// Figur (je Feld der Figur gesucht, zum Rand von `near` hin weich auslaufend, nie ein Sprung). Höchstens `most` Löcher je Bild, die nächsten zuerst. Die
// Wege (Mündung zum Bett, Bett zum See) sind schwache weiche Bänder, je eine Linie. Die Maske liegt auf den Feldern der
// Grotte (hinter der Mündung), erkundet oder im Nebel (der Nebel ist heller als der Boden unter der Maske); im Gang
// blendet sie mit dem Weg aus (`gang` Felder hinter der Mündung ist sie weg, vor der Grenze der Höhlenwelt) und dazu
// höchstens so schnell wie in `fade` ms, beim Einschlafen mit der Nacht (Maske × (1 − Nacht / `night`)). Gezeichnet in einem Viertel der Auflösung
// und mit einem einzigen drawImage über das Bild, nach dem, was zur Welt gehört (Fledermäuse, Grottenolm, Tropfen), vor
// dem Leuchten und vor Zeichen, Herzen, Sprechblasen und Leiste (mitwachsen-cave-sky.ts). Elternschalter „Höhle dunkel“
// aus („Höhle hell“, Schritt 6): Stärke `bright` statt `mask` (`brightOf`, gelesen wie „Kamera bewegen“ in 3D); nach
// dem Umlegen gleitet die Stärke in `fade` ms hinüber (`levelOf`, bei reduzierter Bewegung sofort).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Höhle nach dem ersten Spielen“, Dunkelmaske)

import { DIRS, type Dir, type Projection } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { CAVE_PORTAL } from '../../../../data/games/mitwachsen-portals';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import { flatColors } from '../../mitwachsen-ground-2d';
import type { World } from '../../mitwachsen-world';
import { caveFrame, type Cave, type Frame } from './mitwachsen-frame';
import { webs } from './mitwachsen-spider';

const D = GROTTE.dark;

/** Farbe als drei Anteile 0 … 255 */
export type Rgb = readonly [number, number, number];

/** Farbe aus `#rrggbb` */
export const rgbOf = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
/** Helligkeit einer Farbe: relative Luminanz (sRGB, 0 schwarz … 1 weiß) */
export const brightness = ([r, g, b]: Rgb) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! * (1 - t) + b[i]! * t) as unknown as Rgb;
/** Farbe der Maske: so hell wie die Untergrenze; was unter ihr liegt, wird nie dunkler (je Anteil zwischen beiden) */
export const MASK = rgbOf(GROTTE_COLORS.dark);
/** Farbe `base` unter der Maske mit Stärke `a` */
export const masked = (base: Rgb, a: number) => mix(base, MASK, a);

/** Stärke der Maske, bei der `base` gerade die Helligkeit `level` hat (ist `base` schon so dunkel: 0; nie über 1) */
export function maskFor(base: Rgb, level: number): number {
  if (brightness(base) <= level) return 0;
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (brightness(masked(base, m)) >= level) lo = m;
    else hi = m;
  }
  return lo;
}

/** Grottenboden, wie 2D ihn zeichnet (Oberseite; dunkler als die Grundfarbe des Bodens in 3D) */
export const FLOOR = rgbOf(flatColors({ ground: 'grotto' } as Cell)?.[1] ?? GROTTE_COLORS.floor);

/** Stärke abseits der Figur („Höhle hell“: `bright`) */
export const strengthOf = (bright: boolean) => (bright ? D.bright : D.mask);
/**
 * Elternschalter „Höhle dunkel“ im Speicher: wie `CAVE_KEY` im Menü, das das Paket nicht mitladen soll (Test in
 * mitwachsen-mask.test.ts); '1' heißt aus („Höhle hell“)
 */
export const CAVE_STORE = 'larmic.games.cave';

/** Spielfläche, wie der Schalter sie liest: `data-cave` setzt das Menü bei jedem Füllen */
type Host = { dataset: { cave?: string } };

/**
 * „Höhle hell“ in diesem Bild? An der Spielfläche (`data-cave`, vom Menü gesetzt, auch wenn der Speicher gesperrt ist),
 * sonst aus dem Speicher, einmal gelesen und gemerkt (`m.brightAt`); geht das nicht: dunkel, wie ohne Eintrag
 */
export function brightOf(m: MaskFx, host: Host | null | undefined, stored: () => string | null): boolean {
  const cave = host?.dataset.cave;
  if (cave !== undefined) return cave === '1';
  if (m.brightAt === undefined)
    try {
      m.brightAt = stored() === '1';
    } catch {
      m.brightAt = false; // gesperrt: dunkel
    }
  return m.brightAt;
}

/** Spielfläche zur Zeichenfläche der Ansicht (im Browser die `.mw` um das Canvas; in Tests ohne DOM keine) */
const hostOf = (ctx: CanvasRenderingContext2D): Host | null =>
  (ctx.canvas as Partial<HTMLCanvasElement> | undefined)?.closest?.<HTMLElement>('.mw') ?? null;
/** Der Schalter im Speicher (ohne DOM, in Tests: keiner, also dunkel) */
const storedCave = () => (typeof document === 'undefined' ? null : localStorage.getItem(CAVE_STORE));

/** Stärke, bei der der Grottenboden gerade die Dämmerung von heute hat (`dusk`) */
export const DUSK_MASK = maskFor(FLOOR, D.dusk);
/** So viel nimmt ein Weg-Band der Maske `strength` weg: dort bleibt die Dämmerung (ist die Maske schwächer: nichts) */
export const duskOpen = (strength: number) => (strength <= DUSK_MASK ? 0 : 1 - DUSK_MASK / strength);

/** Stärke im Bild: Grundstärke, Ein- und Ausblenden im Gang (`fade` 0 … 1), weg mit der Nacht (bei `night` ganz) */
export const maskNow = (base: number, fade: number, night: number) =>
  Math.max(0, base * Math.max(0, Math.min(1, fade)) * (1 - Math.min(1, Math.max(0, night) / D.night)));

/** Ein- und Ausblenden: von `from` nach `to` (0 oder 1) seit `at` (ms) */
export type Fade = { from: number; to: number; at: number };

/**
 * Wie weit die Maske mit der Zeit da ist (0 … 1): Ist die Figur nah genug an der Grotte (`inside`), blendet sie ein,
 * sonst aus, ganz in `GROTTE.dark.fade` ms, immer vom Wert aus, den sie gerade hat (nie ein Sprung). Beim ersten Bild
 * gleich, wie es ist
 */
export function fadeOf(f: Partial<Fade>, inside: boolean, now: number): number {
  const to = inside ? 1 : 0;
  const value = () => {
    if (f.to === undefined || f.from === undefined || f.at === undefined) return to;
    const step = (now - f.at) / D.fade;
    return f.to > f.from ? Math.min(f.to, f.from + step) : Math.max(f.to, f.from - step);
  };
  if (f.to !== to) Object.assign(f, { from: value(), to, at: now });
  return value();
}

/**
 * Grundstärke mit der Zeit (`m.level`): Legen Eltern den Schalter um, gleitet sie von der Stärke, die sie gerade hat,
 * zur neuen (`target`), über die ganze Spanne in `GROTTE.dark.fade` ms, nie ein Sprung; bei reduzierter Bewegung und
 * beim ersten Bild gleich, wie es ist
 */
export function levelOf(l: Partial<Fade>, target: number, now: number, reduced: boolean): number {
  const value = () => {
    if (reduced || l.to === undefined || l.from === undefined || l.at === undefined) return target;
    const span = Math.abs(l.to - l.from);
    const p = span > 0 ? Math.max(0, Math.min(1, (now - l.at) / (D.fade * (span / (D.mask - D.bright))))) : 1;
    return p >= 1 ? l.to : l.from + (l.to - l.from) * p;
  };
  if (l.to !== target || reduced) Object.assign(l, { from: value(), to: target, at: now });
  return value();
}

/**
 * Wie weit die Maske am Ort (x, y) der Figur da ist (0 … 1): in der Grotte (hinter der Mündung) ganz, im Gang bis
 * 2 Felder um die Mündung ganz, dann weniger, `GROTTE.dark.gang` Felder von ihr weg gar nicht mehr (die Grenze der
 * Höhlenwelt liegt weiter weg, Test). So ist sie weg, bevor die Grotte aufhört zu zeichnen, wie schnell auch der Zug fährt
 */
export function gangFade(frame: Frame, x: number, y: number): number {
  if (frame.out(x, y) >= 0) return 1;
  const [mx, my] = frame.at(0, 0);
  return Math.max(0, Math.min(1, (D.gang - Math.hypot(x - mx, y - my)) / (D.gang - 2)));
}

export { caveFrame, type Frame }; // Raster der Grotte (mitwachsen-frame.ts), hier wie bisher zu holen

/** Ein Loch der Maske: Mitte (Felder, Mitte eines Felds bei +0,5) und Höhe, Radius in Feldern, wie weit es in der Mitte öffnet (0 … 1) */
export type Hole = { x: number; y: number; z: number; r: number; open: number };

const centre = (world: Pick<World, 'cell'>, [x, y]: Point, r: number): Hole => ({
  x: x + 0.5,
  y: y + 0.5,
  z: world.cell(x, y).h,
  r,
  open: 1,
});

const fixedOf = new WeakMap<object, Hole[]>();
/**
 * Feste Löcher: die drei Lichtschächte, die Wiese am Bett, Bahnhof Fledermaus, die Mündung des Gangs und jedes Netz der
 * Tupfspinnen (die Spinne lebt nur im Licht); je Welt einmal
 */
export function fixedHoles(world: Cave): Hole[] {
  const known = fixedOf.get(world);
  if (known) return known;
  const frame = caveFrame(world);
  const { shaft, meadow, station, mouth, web } = D.fixed;
  const S = GROTTE.station;
  const holes = frame
    ? [
        ...GROTTE.shafts.map(([u, o]) => centre(world, frame.at(u, o), shaft)),
        centre(world, world.homes.hoehle.bed, meadow),
        centre(world, frame.at(S.side + S.wide / 2, S.out + S.long / 2), station),
        centre(world, frame.at(0, 1), mouth),
        ...webs(world).map((p) => centre(world, p, web)),
      ]
    : [];
  fixedOf.set(world, holes);
  return holes;
}

/**
 * Was in der Grotte als kleines Licht leuchtet, und wie groß sein Loch ist (Pilzbeete nur voll, ein Kristallfeld nur in
 * seiner Mitte, `note` 1: ein Loch je Feld, nicht je Splitter)
 */
const SMALL: Partial<Record<NonNullable<Cell['deco']>, number>> = {
  crystal: D.small.crystal,
  crystalbush: D.small.crystal,
  glowshroom: D.small.crystal,
  crystalarch: D.small.crystal,
  column: D.small.column,
  cavelamp: D.small.lamp,
  shroombed: D.small.bed,
  dripspring: D.small.spring,
  glowmoss: D.small.moss,
  crystalfield: D.small.field,
  waterfall: D.small.fall,
};

type Near = { at: string; found: (Hole & { bed?: string })[] };
const nearOf = new WeakMap<object, Near>();

/** So weit um das Feld der Figur sucht `smallNear`: ein Feld mehr als `near`, die Figur steht ja bis ½ Feld daneben */
const REACH = D.near + 1;

/** Kleine Lichter bis `REACH` Felder um das Feld (x, y) der Figur; je Welt und Feld der Figur einmal */
export function smallNear(world: Pick<World, 'cell' | 'realm'>, x: number, y: number): Near['found'] {
  const last = nearOf.get(world);
  if (last?.at === `${x},${y}`) return last.found;
  const found: Near['found'] = [];
  for (let dy = -REACH; dy <= REACH; dy++)
    for (let dx = -REACH; dx <= REACH; dx++) {
      if (dx * dx + dy * dy > REACH * REACH) continue;
      const c = world.cell(x + dx, y + dy);
      const r = c.deco && (c.deco !== 'crystalfield' || c.note === 1) ? SMALL[c.deco] : undefined;
      if (r === undefined || world.realm(x + dx, y + dy) !== 'hoehle') continue;
      const hole = centre(world, [x + dx, y + dy], r);
      found.push(c.deco === 'shroombed' ? { ...hole, bed: `${x + dx},${y + dy}` } : hole);
    }
  nearOf.set(world, { at: `${x},${y}`, found });
  return found;
}

/** Körper, wie die Löcher sie lesen: Figur und Tiere (`bodies`), Fahrzeuge (`rides`, der Wagen mit der Figur hat `seat`) */
type Spot = { x: number; y: number; z: number; hop?: number };
type RideSpot = Spot & { id: string; dir: Dir; seat?: true; glow?: true };
/** Zustand, wie die Löcher ihn lesen */
export type Lit = {
  player: { x: number; y: number };
  ride?: unknown;
  lamp?: unknown;
  picked: Readonly<Record<string, number>>;
  animals: readonly { id: string; x: number; y: number }[];
};
export type HoleAt = {
  now: number;
  reduced: boolean;
  since?: number;
  bodies?: ReadonlyMap<string, Spot>;
  rides?: readonly RideSpot[];
};

/** Radius des Lochs um die Figur: `hole`, mit Laterne (seit `since`) wachsend auf `lantern` wie der Lichtkreis */
export function holeRadius(lamp: boolean, since: number | undefined, now: number, reduced: boolean): number {
  if (!lamp) return D.hole;
  const p = reduced || since === undefined ? 1 : Math.max(0, Math.min(1, (now - since) / GROTTE.circle.grow));
  return D.hole + (D.lantern - D.hole) * (1 - (1 - p) ** 2);
}

/** Im Fahrzeug: Loch um den Sitz und an den Lampen vorn (am vordersten Körper desselben Fahrzeugs, in seiner Blickrichtung) */
function rideHoles(rides: readonly RideSpot[]): Hole[] {
  const seat = rides.find((r) => r.seat);
  if (!seat) return [];
  const owner = (id: string) => id.split(':').slice(0, 2).join(':'); // `ride:<Fahrzeug>`: nicht ein anderes Fahrzeug
  const own = owner(seat.id);
  const [dx, dy] = DIRS[seat.dir];
  const front = rides
    .filter((r) => owner(r.id) === own)
    .reduce((a, b) => (b.x * dx + b.y * dy > a.x * dx + a.y * dy ? b : a), seat);
  return [
    { x: seat.x + 0.5, y: seat.y + 0.5, z: seat.z, r: D.seat, open: 1 },
    { x: front.x + 0.5 + dx * 0.9, y: front.y + 0.5 + dy * 0.9, z: front.z + 0.5, r: D.lamp, open: 1 },
  ];
}

/**
 * Wie weit ein kleines Loch `d` Felder von der Figur öffnet: ganz bis 2 Felder vor `GROTTE.dark.near`, dann weich
 * weniger, ab `near` gar nicht (je Feld Weg höchstens um die Hälfte; die Figur bewegt sich gleitend, also nie ein Sprung)
 */
export const nearOpen = (d: number) => Math.max(0, Math.min(1, (D.near - d) / 2));

/**
 * Löcher der Maske in diesem Bild: zuerst um die Figur (im Fahrzeug um Sitz und Lampen), dann die festen und kleinen,
 * die nächsten zuerst, höchstens `GROTTE.dark.most`. Pilzbeete nur, solange sie voll sind; kleine Lichter und Tiere nur
 * nah an der Figur, zum Rand hin weich (`nearOpen`, gemessen von ihrem gleitenden Ort); ganz zu zählen nicht mit
 */
export function maskHoles(world: Cave & Pick<World, 'realm'>, s: Lit, at: HoleAt): Hole[] {
  const me = at.bodies?.get('player');
  const [mx, my] = me ? [me.x, me.y] : [s.player.x, s.player.y];
  const riding = s.ride ? rideHoles(at.rides ?? []) : [];
  const first = riding.length
    ? riding
    : [
        {
          x: mx + 0.5,
          y: my + 0.5,
          z: (me?.z ?? world.cell(Math.round(mx), Math.round(my)).h) + (me?.hop ?? 0),
          r: holeRadius(!!s.lamp, at.since, at.now, at.reduced),
          open: 1,
        },
      ];
  const lights = smallNear(world, Math.round(s.player.x), Math.round(s.player.y)).flatMap((h): Hole[] => {
    const open = nearOpen(Math.hypot(h.x - mx - 0.5, h.y - my - 0.5));
    return open > 0 && !(h.bed && h.bed in s.picked) ? [{ x: h.x, y: h.y, z: h.z, r: h.r, open }] : [];
  });
  const animals = s.animals.flatMap((a): Hole[] => {
    const b = at.bodies?.get(a.id) ?? { ...a, z: world.cell(a.x, a.y).h };
    const open = nearOpen(Math.hypot(b.x - mx, b.y - my));
    return open > 0 ? [{ x: b.x + 0.5, y: b.y + 0.5, z: b.z, r: D.small.animal, open }] : [];
  });
  // leuchtende Lampen stehender Fahrzeuge (Funkel am Halt, am Abend): kleines Loch vor dem Körper, nur nah an der Figur
  const lamps = (at.rides ?? []).flatMap((r): Hole[] => {
    if (!r.glow || r.seat) return [];
    const [dx, dy] = DIRS[r.dir];
    const [x, y] = [r.x + 0.5 + dx * 0.5, r.y + 0.5 + dy * 0.5];
    const open = nearOpen(Math.hypot(x - mx - 0.5, y - my - 0.5));
    return open > 0 ? [{ x, y, z: r.z + 0.5, r: D.small.lamp, open }] : [];
  });
  const [cx, cy] = [first[0]!.x, first[0]!.y];
  const rest = [...fixedHoles(world), ...lights, ...lamps, ...animals]
    .map((h) => ({ h, d: Math.hypot(h.x - cx, h.y - cy) - h.r }))
    .sort((a, b) => a.d - b.d)
    .map(({ h }) => ({ x: h.x, y: h.y, z: h.z, r: h.r, open: h.open }));
  return [...first, ...rest].slice(0, D.most);
}

const bandsOf = new WeakMap<object, [Spot, Spot][]>();
/** Wege als Bänder: von der Mündung zum Bett und vom Bett durch die Mitte zum Portal am See; je Welt einmal */
export function pathBands(world: Cave): [Spot, Spot][] {
  const known = bandsOf.get(world);
  if (known) return known;
  const frame = caveFrame(world);
  const gate = world.portals.get(CAVE_PORTAL)?.gate;
  const spot = (p: Point): Spot => ({ x: p[0] + 0.5, y: p[1] + 0.5, z: world.cell(...p).h });
  const bed = world.homes.hoehle?.bed;
  const bands: [Spot, Spot][] =
    frame && gate && bed
      ? [
          [spot(frame.at(0, 0)), spot(bed)],
          [spot(bed), spot(gate)],
        ]
      : [];
  bandsOf.set(world, bands);
  return bands;
}

/** Eine Reihe von Feldern der Grotte: von `x0` bis `x1` in Reihe `y`, höchste Oberkante `h` */
export type Run = { y: number; x0: number; x1: number; h: number };

/** Ausschnitt um ein Feld: so weit zur Seite, nach oben (hinten) und nach unten (vorn) */
export type Window = { cx: number; cy: number; side: number; up: number; down: number };

/**
 * Felder der Grotte im Ausschnitt als Reihen: Höhlenwelt hinter der Mündung, erkundet oder im Nebel (dort liegt die
 * Maske; im Gang und außerhalb der Grotte nicht)
 */
export function coverOf(world: Pick<World, 'cell' | 'realm'>, frame: Frame, w: Window): Run[] {
  const runs: Run[] = [];
  for (let y = w.cy - w.up; y <= w.cy + w.down; y++) {
    let run: Run | null = null;
    for (let x = w.cx - w.side; x <= w.cx + w.side; x++) {
      const on = frame.out(x, y) >= 0 && world.realm(x, y) === 'hoehle';
      if (!on) {
        run = null;
        continue;
      }
      const h = world.cell(x, y).h;
      if (run) [run.x1, run.h] = [x, Math.max(run.h, h)];
      else runs.push((run = { y, x0: x, x1: x, h }));
    }
  }
  return runs;
}

/** Zeichenfläche der Maske (im Browser ein Canvas; in Tests eine eigene) */
export type MaskCanvas = HTMLCanvasElement;

/**
 * Was die Maske sich fürs Bild merkt: Zeichenfläche (`canvas`, gebaut von `make`), Ein- und Ausblenden (`fade`), die
 * Reihen der Grotte im Ausschnitt (`cover`, je Ausschnitt), „Höhle hell“ (`bright`: im letzten Bild, aus dem Schalter
 * für Eltern, `brightOf`; `brightAt`: der Schalter im Speicher, beim ersten Bild gelesen; `level`: Gleiten der
 * Grundstärke nach dem Umlegen, `levelOf`), was zuletzt gezeichnet wurde
 * (`drawn`: Stärke und Löcher in Pixeln, für Tests und Messung) und was es kostet (`cost`: Bilder und ms)
 */
export type MaskFx = {
  canvas?: MaskCanvas | null;
  make?: () => MaskCanvas | null;
  fade: Partial<Fade>;
  cover?: { key: string; world: object; runs: Run[] };
  bright?: boolean;
  brightAt?: boolean;
  level?: Partial<Fade>;
  drawn?: { strength: number; spots: { cx: number; cy: number; r: number }[] } | null;
  cost?: { n: number; ms: number };
};

const browserCanvas = (): MaskCanvas | null =>
  typeof document === 'undefined' ? null : document.createElement('canvas');

/** Szene, wie die Maske sie liest */
export type MaskScene = {
  width: number;
  height: number;
  now: number;
  reduced: boolean;
  cam: { x: number; y: number };
  night?: number;
  bodies?: ReadonlyMap<string, Spot>;
  rides?: readonly RideSpot[];
};

/** Auflösung der Maske: ein Viertel */
export const MASK_SCALE = 4;
const px = (P: Projection, h: { x: number; y: number; z: number }, r: number) => {
  const [cx, cy] = P(h.x, h.y, h.z);
  const [ex, ey] = P(h.x + r, h.y, h.z);
  return { cx, cy, r: Math.hypot(ex - cx, ey - cy) };
};

/**
 * Die Maske zeichnen (in `ctx`, in Pixeln der Ansicht): in einem Viertel der Auflösung die Felder der Grotte deckend in
 * Nachtlila (`runs`, ein Pfad), Bänder und Löcher weich herausgenommen, dann ein drawImage mit
 * der Stärke `strength`. Liefert die Löcher in Pixeln
 */
export function drawMask(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  canvas: MaskCanvas,
  size: { width: number; height: number; ppc: number },
  runs: readonly Run[],
  holes: readonly Hole[],
  bands: readonly [Spot, Spot][],
  strength: number,
): { cx: number; cy: number; r: number }[] {
  const [w, h] = [Math.ceil(size.width / MASK_SCALE), Math.ceil(size.height / MASK_SCALE)];
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const m = canvas.getContext('2d');
  if (!m) return [];
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, w, h);
  m.setTransform(1 / MASK_SCALE, 0, 0, 1 / MASK_SCALE, 0, 0);
  m.fillStyle = GROTTE_COLORS.dark;
  m.beginPath();
  for (const r of runs) {
    const pts = [P(r.x0, r.y, r.h), P(r.x1 + 1, r.y, r.h), P(r.x1 + 1, r.y + 1, 0), P(r.x0, r.y + 1, 0)];
    m.moveTo(...pts[0]!);
    for (const p of pts.slice(1)) m.lineTo(...p);
    m.closePath();
  }
  m.fill();
  m.globalCompositeOperation = 'destination-out';
  // Wege: ein schwaches, weiches Band je Wegstück (außen breiter und halb so stark)
  const open = duskOpen(strength);
  if (open > 0) {
    m.lineCap = 'round';
    for (const [k, width] of [
      [open / 2, size.ppc * D.band * 1.6],
      [open / 2 / (1 - open / 2), size.ppc * D.band],
    ] as const) {
      m.strokeStyle = `rgba(0, 0, 0, ${k.toFixed(3)})`;
      m.lineWidth = width;
      m.beginPath();
      for (const [a, b] of bands) {
        m.moveTo(...P(a.x, a.y, a.z));
        m.lineTo(...P(b.x, b.y, b.z));
      }
      m.stroke();
    }
  }
  const spots = holes.map((hole) => ({ ...px(P, hole, hole.r), open: hole.open }));
  for (const { cx, cy, r, open: o } of spots) {
    if (!(r > 1) || o <= 0) continue;
    const g = m.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(0, 0, 0, ${o})`);
    g.addColorStop(0.6, `rgba(0, 0, 0, ${0.6 * o})`); // bei 0,6 des Radius bleiben 40 % der Maske
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    m.fillStyle = g;
    m.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, 0, 0, w, h, 0, 0, w * MASK_SCALE, h * MASK_SCALE);
  ctx.restore();
  return spots.map(({ cx, cy, r }) => ({ cx, cy, r }));
}

/**
 * Die Maske dieses Bilds: blendet im Gang mit dem Weg aus und ein (`gangFade`), dabei nie schneller als `fadeOf` (für
 * Sprünge, etwa per Entwickler-Schalter), nimmt mit der Nacht ab, sucht die Löcher und die Reihen der Grotte im
 * Ausschnitt (gemerkt je Ausschnitt) und zeichnet. Ohne Grotte, ohne Zustand, ohne Größe oder Zeichenfläche (Tests ohne
 * DOM) nichts
 */
export function caveMask(
  ctx: CanvasRenderingContext2D,
  world: Cave & Pick<World, 'realm'>,
  sc: MaskScene,
  P: Projection,
  state: Lit | undefined,
  m: MaskFx,
  since?: number,
) {
  m.drawn = null;
  const frame = caveFrame(world);
  if (!state || !frame || !(sc.width > 0) || !(sc.height > 0)) return;
  const t0 = performance.now();
  const me = sc.bodies?.get('player') ?? state.player;
  const near = gangFade(frame, me.x, me.y);
  const fade = Math.min(near, fadeOf(m.fade, near > 0, sc.now));
  m.bright = brightOf(m, hostOf(ctx), storedCave);
  const base = levelOf((m.level ??= {}), strengthOf(m.bright), sc.now, sc.reduced);
  const strength = maskNow(base, fade, sc.night ?? 0);
  if (strength < 0.005) return;
  if (m.canvas === undefined) m.canvas = (m.make ?? browserCanvas)();
  if (!m.canvas) return;
  const [camX, camY] = [Math.round(sc.cam.x), Math.round(sc.cam.y)];
  const ppc = Math.max(1, Math.abs(P(camX + 1, camY, 1)[0] - P(camX, camY, 1)[0]));
  const row = Math.max(1, Math.abs(P(camX, camY + 1, 1)[1] - P(camX, camY, 1)[1]));
  const win: Window = {
    cx: camX,
    cy: camY,
    side: Math.min(40, Math.ceil(sc.width / 2 / ppc) + 3),
    up: Math.min(40, Math.ceil(sc.height / row) + 8),
    down: Math.min(40, Math.ceil(sc.height / 2 / row) + 4),
  };
  const key = Object.values(win).join(',');
  if (m.cover?.key !== key || m.cover.world !== world) m.cover = { key, world, runs: coverOf(world, frame, win) };
  const holes = maskHoles(world, state, { ...sc, since });
  const spots = drawMask(ctx, P, m.canvas, { ...sc, ppc }, m.cover.runs, holes, pathBands(world), strength);
  m.drawn = { strength, spots };
  const cost = (m.cost ??= { n: 0, ms: 0 });
  cost.n++;
  cost.ms += performance.now() - t0;
}
