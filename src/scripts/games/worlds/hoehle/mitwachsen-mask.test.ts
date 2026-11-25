import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../data/games/mitwachsen';
import { CAVE_PORTAL } from '../../../../data/games/mitwachsen-portals';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Projection } from '../../../../lib/games/front';
import { initialState, type State } from '../../mitwachsen-state';
import type { SkyScene } from '../../mitwachsen-sky';
import { HOEHLE_PACK, worldOf } from '../../test-worlds';
import { caveWeather, type CaveFx } from './mitwachsen-cave-sky';
import { Chime } from './mitwachsen-chime-look';
import { Drips } from './mitwachsen-drips';
import {
  DUSK_MASK,
  FLOOR,
  MASK,
  MASK_SCALE,
  CAVE_STORE,
  brightOf,
  levelOf,
  brightness,
  caveFrame,
  caveMask,
  coverOf,
  drawMask,
  duskOpen,
  fadeOf,
  fixedHoles,
  gangFade,
  holeRadius,
  maskHoles,
  maskNow,
  masked,
  nearOpen,
  pathBands,
  rgbOf,
  strengthOf,
  type Fade,
  type Lit,
  type MaskCanvas,
  type MaskFx,
} from './mitwachsen-mask';
import { webs } from './mitwachsen-spider';
import { Olm } from './mitwachsen-olm-look';
import { flatColors } from '../../mitwachsen-ground-2d';
import { CAVE_KEY, caveBright, toggleCave } from '../../mitwachsen-menu';
import type { Cell } from '../../mitwachsen-cell';

const D = GROTTE.dark;
/** Kontrast nach WCAG zwischen zwei Helligkeiten */
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Alle Farben der Grotte (`GROTTE_COLORS`, dazu Boden und Wand, wie 2D sie zeichnet), ohne die Maske selbst */
const PALETTE = [
  ...Object.entries(GROTTE_COLORS)
    .filter(([k]) => k !== 'dark')
    .flatMap(([, v]): unknown[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? [...v] : Object.values(v))),
  ...flatColors({ ground: 'grotto' } as Cell)!,
]
  .filter((c): c is string => typeof c === 'string')
  .map(rgbOf);
const SHADOW = rgbOf(GROTTE_COLORS.shadow);
const blend = (a: readonly number[], b: readonly number[], t: number) =>
  [0, 1, 2].map((i) => a[i]! * (1 - t) + b[i]! * t) as unknown as ReturnType<typeof rgbOf>;
/** Jede Farbe, wie sie im Bild vorkommen kann: so, als Vorderseite (18 % Schwarz), im Randschatten an Boden und Wand */
const DRAWN = PALETTE.flatMap((c) =>
  [c, blend(c, [0, 0, 0], 0.18)].flatMap((f) => [
    f,
    blend(f, SHADOW, GROTTE.edge.floor),
    blend(f, SHADOW, GROTTE.edge.wall),
  ]),
);

describe('Dunkelmaske: wie dunkel (Grenzen als Helligkeit mit den echten Farben)', () => {
  it('Stärke 0,87, „Höhle hell“ 0,3; die Farbe der Maske hat die Untergrenze 0,08 (Nachtlila, nie Schwarz)', () => {
    expect(strengthOf(false)).toBe(D.mask);
    expect(strengthOf(true)).toBe(D.bright);
    expect(brightness(MASK)).toBeGreaterThanOrEqual(D.floor);
    expect(brightness(MASK)).toBeLessThan(D.floor + 0.01);
    expect(FLOOR).toEqual(rgbOf(flatColors({ ground: 'grotto' } as Cell)![1]));
  });

  it('nichts wird schwarz: jede Farbe der Grotte (Boden, Fels, Vorderseiten, Randschatten, Wasser, Nebel, Himmel) unter der Maske nie unter 0,08', () => {
    const bad: string[] = [];
    for (const s of [D.mask, D.mask / 2, D.bright, DUSK_MASK])
      for (const c of DRAWN) {
        const b = brightness(masked(c, s));
        // was schon dunkler ist als die Untergrenze (der Schatten selbst), wird unter der Maske nur heller
        if (b < Math.min(D.floor, brightness(c)) - 1e-9)
          bad.push(`${c.map(Math.round).join(',')} bei ${s}: ${b.toFixed(3)}`);
      }
    expect(bad, bad.join('; ')).toEqual([]);
    expect(DRAWN.length).toBeGreaterThan(100);
  });

  it('Nebel und Höhlenhimmel unter der Maske: nie heller als der Boden unter ihr, nie unter 0,08', () => {
    const floor = brightness(masked(FLOOR, D.mask));
    for (const c of [GROTTE_COLORS.mist, ...GROTTE_COLORS.heaven].map(rgbOf)) {
      expect(brightness(c)).toBeGreaterThan(floor); // ohne Maske wäre der Nebel heller als der Boden unter ihr
      expect(brightness(masked(c, D.mask))).toBeLessThanOrEqual(floor);
      expect(brightness(masked(c, D.mask))).toBeGreaterThanOrEqual(D.floor);
    }
  });

  it('abseits der Figur deutlich dunkler als die Dämmerung; im Loch hell (mindestens 3 : 1), bei 0,6 des Radius noch Dämmerung', () => {
    const dark = brightness(masked(FLOOR, strengthOf(false)));
    expect(dark).toBeLessThan(D.dusk * 0.8);
    expect(dark).toBeGreaterThan(0.1);
    expect(contrast(brightness(FLOOR), dark)).toBeGreaterThanOrEqual(3);
    // bei 0,6 des Radius bleiben 40 % der Maske: dort ist es nie dunkler als die Dämmerung
    expect(brightness(masked(FLOOR, 0.4 * strengthOf(false)))).toBeGreaterThanOrEqual(D.dusk);
  });

  it('Wege: das Band lässt so viel Maske, dass der Boden die Dämmerung hat; bei „Höhle hell“ ist es dort ohnehin heller', () => {
    expect(brightness(masked(FLOOR, DUSK_MASK))).toBeCloseTo(D.dusk, 3);
    const s = strengthOf(false);
    expect(brightness(masked(FLOOR, s * (1 - duskOpen(s))))).toBeGreaterThanOrEqual(D.dusk - 1e-4);
    expect(duskOpen(s)).toBeGreaterThan(0);
    expect(duskOpen(strengthOf(true))).toBe(0);
    expect(brightness(masked(FLOOR, strengthOf(true)))).toBeGreaterThan(D.dusk);
  });

  it('Farbe der Maske: Nachtlila, kein Gold', () => {
    const [r, g, b] = rgbOf(GROTTE_COLORS.dark);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });
});

describe('Dunkelmaske: Stärke im Bild, Ein- und Ausblenden, Schlaf', () => {
  it('die Nacht nimmt sie weg: Maske × (1 − Nacht / 0,496), so stapeln sich Maske und Nacht nie', () => {
    expect(maskNow(D.mask, 1, 0)).toBeCloseTo(D.mask);
    expect(maskNow(D.mask, 1, D.night / 2)).toBeCloseTo(D.mask / 2);
    expect(maskNow(D.mask, 1, D.night)).toBe(0);
    expect(maskNow(D.mask, 1, 0.8)).toBe(0); // die höchste Nacht der Grotte
    expect(maskNow(D.mask, 0.5, 0)).toBeCloseTo(D.mask / 2);
    expect(maskNow(D.mask, 0, 0)).toBe(0);
  });

  it('im Gang mit dem Weg: in der Grotte ganz, an der Mündung ganz, 12 Felder davor weg; der Zug mit 8 Feldern/s: je Bild höchstens 2 %', () => {
    const w = worldOf(1, [HOEHLE_PACK]);
    const f = caveFrame(w)!;
    const [mx, my] = f.at(0, 0);
    const [ox, oy] = f.at(0, -1).map((v, i) => v - f.at(0, 0)[i]!); // ein Feld aus der Grotte hinaus
    expect(gangFade(f, ...w.homes.hoehle.bed)).toBe(1);
    expect(gangFade(f, mx, my)).toBe(1);
    expect(gangFade(f, mx + 2 * ox!, my + 2 * oy!)).toBe(1);
    expect(gangFade(f, mx + 7 * ox!, my + 7 * oy!)).toBeCloseTo(0.5);
    expect(gangFade(f, mx + D.gang * ox!, my + D.gang * oy!)).toBe(0);
    expect(D.gang).toBe(12);
    let [last, worst, gone] = [1, 0, Infinity];
    for (let t = 0; t <= 20; t += 8 / 60) {
      const v = gangFade(f, mx + t * ox!, my + t * oy!);
      worst = Math.max(worst, Math.abs(v - last));
      if (v === 0) gone = Math.min(gone, t);
      last = v;
    }
    expect(worst).toBeLessThanOrEqual(0.02);
    expect(gone).toBeLessThanOrEqual(D.gang + 1e-9); // die Grenze der Höhlenwelt liegt weiter weg (Test in mitwachsen-glow.test.ts)
  });

  it('bei einem Sprung (Zeit): in etwa 1 s ein und aus, immer vom Wert aus, den sie gerade hat; beim ersten Bild gleich', () => {
    const f: Partial<Fade> = {};
    expect(fadeOf(f, true, 0)).toBe(1); // erstes Bild in der Grotte: gleich da (Aufwachen im Höhlenbett)
    expect(fadeOf(f, true, 5000)).toBe(1);
    expect(fadeOf(f, false, 6000)).toBe(1); // hinaus in den Gang: blendet aus
    expect(fadeOf(f, false, 6000 + D.fade / 2)).toBeCloseTo(0.5);
    expect(fadeOf(f, true, 6000 + D.fade / 2)).toBeCloseTo(0.5); // umgekehrt: kein Sprung
    expect(fadeOf(f, true, 6000 + D.fade)).toBe(1); // in derselben Zeit zurück, wie es hinaus ging
    expect(fadeOf(f, false, 9000)).toBe(1);
    expect(fadeOf(f, false, 9000 + D.fade)).toBe(0);
    // Schritte von 1/60 s ändern nie mehr als 2 %
    const g: Partial<Fade> = {};
    fadeOf(g, false, 0);
    let [last, worst] = [0, 0];
    for (let t = 0; t <= 1500; t += 1000 / 60) {
      const v = fadeOf(g, true, t);
      worst = Math.max(worst, Math.abs(v - last));
      last = v;
    }
    expect(worst).toBeLessThanOrEqual(0.02);
    expect(D.fade).toBeGreaterThanOrEqual(800);
  });

  it('Loch um die Figur: 3 Felder, mit Laterne 6,5, wächst in 600 ms sanft, bei reduzierter Bewegung sofort', () => {
    expect(holeRadius(false, undefined, 0, false)).toBe(3);
    expect(holeRadius(true, undefined, 0, false)).toBe(6.5);
    expect(holeRadius(true, 1000, 1000, true)).toBe(6.5);
    const rs = [0, 150, 300, 600, 1200].map((ms) => holeRadius(true, 1000, 1000 + ms, false));
    expect(rs[0]).toBe(3);
    expect(rs.every((r, i) => i === 0 || r > rs[i - 1]! || r === 6.5)).toBe(true);
    expect(rs[3]).toBe(6.5);
    expect(GROTTE.circle.grow).toBe(600);
  });
});

/** Wach, allein, die Figur steht auf `p` */
const lit = (p: Point, extra: Partial<Lit> = {}): Lit => ({
  player: { x: p[0], y: p[1] },
  picked: {},
  animals: [],
  ...extra,
});

describe('Dunkelmaske: Löcher', () => {
  const w = worldOf(1, [HOEHLE_PACK]);
  const bed = w.homes.hoehle.bed;
  const frame = caveFrame(w)!;
  const at = { now: 0, reduced: false };

  it('ohne Grotte kein Raster, keine Löcher, keine Bänder', () => {
    const bare = worldOf(1, []);
    expect(caveFrame(bare)).toBeNull();
    expect(fixedHoles(bare)).toEqual([]);
    expect(pathBands(bare)).toEqual([]);
  });

  it('zuerst das Loch um die Figur (mit Laterne größer), dann die nächsten; feste Löcher an Schächten, Wiese, Bahnhof, Mündung und Netzen', () => {
    const holes = maskHoles(w, lit(bed), at);
    expect(holes[0]).toMatchObject({ x: bed[0] + 0.5, y: bed[1] + 0.5, r: D.hole, open: 1 });
    expect(maskHoles(w, lit(bed, { lamp: 'hoehle' }), at)[0]!.r).toBe(D.lantern);
    const fixed = fixedHoles(w);
    expect(fixed.map((h) => h.r)).toEqual([
      D.fixed.shaft,
      D.fixed.shaft,
      D.fixed.shaft,
      D.fixed.meadow,
      D.fixed.station,
      D.fixed.mouth,
      ...webs(w).map(() => D.fixed.web), // je Netz der Tupfspinnen eins: die Spinne lebt nur im Licht
    ]);
    expect(webs(w).length).toBeGreaterThanOrEqual(GROTTE.web.least);
    expect(fixed.slice(6).map((h) => [h.x - 0.5, h.y - 0.5])).toEqual(webs(w));
    expect(fixed[3]).toMatchObject({ x: bed[0] + 0.5, y: bed[1] + 0.5 });
    expect(fixed.every((h) => holes.some((g) => g.x === h.x && g.y === h.y && g.r === h.r))).toBe(true);
    // nach dem ersten nach Abstand (bis zum Rand des Lochs)
    const d = holes.slice(1).map((h) => Math.hypot(h.x - holes[0]!.x, h.y - holes[0]!.y) - h.r);
    expect(d.every((v, i) => i === 0 || v >= d[i - 1]!)).toBe(true);
  });

  it('kleine Löcher an Kristallen, Säulen, Lampen, vollen Pilzbeeten, der Tropfquelle, Leuchtmoos, Kristallfeldern (nur ihrer Mitte), dem Wasserfall und an Tieren, nur nah an der Figur', () => {
    const kinds = ['shroombed', 'column', 'dripspring', 'cavelamp', 'glowmoss', 'crystalfield', 'waterfall'] as const;
    const found = new Map<string, Point>();
    let edge: Point | undefined; // ein Splitter am Rand eines Kristallfelds
    for (let o = 0; o <= GROTTE.portal[1]; o++)
      for (let u = -GROTTE.shape.rx; u <= GROTTE.shape.rx; u++) {
        const p = frame.at(u, o);
        const c = w.cell(...p);
        if (c.deco === 'crystalfield' && c.note === 0) edge ??= p;
        if (c.deco === 'crystalfield' && c.note !== 1) continue;
        if (c.deco && (kinds as readonly string[]).includes(c.deco) && !found.has(c.deco)) found.set(c.deco, p);
      }
    expect([...found.keys()].sort()).toEqual([...kinds].sort());
    const [ex, ey] = edge!;
    const near = maskHoles(w, lit([ex + 2, ey]), at);
    expect(near.some((h) => h.x === ex + 0.5 && h.y === ey + 0.5)).toBe(false);
    const R = {
      shroombed: D.small.bed,
      column: D.small.column,
      dripspring: D.small.spring,
      cavelamp: D.small.lamp,
      glowmoss: D.small.moss,
      crystalfield: D.small.field,
      waterfall: D.small.fall,
    };
    for (const [deco, [tx, ty]] of found) {
      // die Figur zwei Felder daneben: das kleine Loch liegt auf dem Ding
      const holes = maskHoles(w, lit([tx + 2, ty]), at);
      const hole = holes.find((h) => h.x === tx + 0.5 && h.y === ty + 0.5);
      expect(hole?.r, deco).toBe(R[deco as keyof typeof R]);
      if (deco === 'shroombed') {
        // abgeerntet: kein Licht
        const empty = maskHoles(w, lit([tx + 2, ty], { picked: { [`${tx},${ty}`]: 1 } }), at);
        expect(empty.some((h) => h.x === tx + 0.5 && h.y === ty + 0.5)).toBe(false);
      }
    }
    // ein Tier nah an der Figur hat ein Loch, eines weit weg nicht, eines am Rand ein halb offenes
    const [x, y] = w.homes.hoehle.wake[0]!;
    const animals = [
      { id: 'a', x: x + 2, y },
      { id: 'b', x: x + D.near + 3, y },
      { id: 'c', x, y: y + D.near - 1 },
    ];
    const holes = maskHoles(w, lit([x, y], { animals }), at);
    expect(holes.find((h) => h.x === x + 2.5 && h.r === D.small.animal)?.open).toBe(1);
    expect(holes.some((h) => h.x === x + D.near + 3.5 && h.r === D.small.animal)).toBe(false);
    expect(holes.find((h) => h.y === y + D.near - 0.5 && h.r === D.small.animal)?.open).toBe(0.5);
  });

  it('kleine Löcher am Rand von 9 Feldern: weich, je Feld Weg höchstens um die Hälfte, nie ein Sprung; ganz zu zählt nicht mit', () => {
    expect([0, 6, 7, 8, 9, 10].map(nearOpen)).toEqual([1, 1, 1, 0.5, 0, 0]);
    // die Figur geht gleitend von einer Säule weg (in Viertelfeldern): ihr Loch schließt sich weich
    let column: Point | undefined;
    for (let o = 0; o <= GROTTE.portal[1] && !column; o++)
      for (let u = -GROTTE.shape.rx; u <= GROTTE.shape.rx && !column; u++)
        if (w.cell(...frame.at(u, o)).deco === 'column') column = frame.at(u, o);
    const [tx, ty] = column!;
    const opens: number[] = [];
    for (let d = 5; d <= 11; d += 0.25) {
      const bodies = new Map([['player', { x: tx + d, y: ty, z: 1 }]]);
      const hole = maskHoles(w, lit([Math.round(tx + d), ty]), { ...at, bodies }).find(
        (h) => h.x === tx + 0.5 && h.y === ty + 0.5,
      );
      opens.push(hole?.open ?? 0);
      if (hole) expect(hole.open).toBeGreaterThan(0);
    }
    expect(opens[0]).toBe(1);
    expect(opens.at(-1)).toBe(0);
    // vier Viertelfelder sind ein Feld: nie mehr als die Hälfte
    expect(opens.every((v, i) => i < 4 || Math.abs(v - opens[i - 4]!) <= 0.5 + 1e-9)).toBe(true);
    expect(opens.every((v, i) => i === 0 || v <= opens[i - 1]!)).toBe(true);
  });

  it('höchstens 48 Löcher je Bild, das Loch um die Figur immer dabei', () => {
    const [x, y] = bed;
    const animals = Array.from({ length: 120 }, (_, i) => ({
      id: `t${i}`,
      x: x + (i % 9) - 4,
      y: y + Math.floor(i / 9) - 6,
    }));
    const holes = maskHoles(w, lit(bed, { animals }), at);
    expect(holes.length).toBe(D.most);
    expect(D.most).toBe(48);
    expect(holes[0]).toMatchObject({ r: D.hole, x: x + 0.5, y: y + 0.5 });
  });

  it('im Fahrzeug kein Loch um die Figur, sondern um den Sitz (3,5 Felder) und an den Lampen vorn, in Fahrtrichtung', () => {
    const rides = [
      { id: 'ride:hoehle:rear', x: 10, y: 5, z: 1, dir: 'e' as const },
      { id: 'ride:hoehle:mid', x: 12, y: 5, z: 1, dir: 'e' as const, seat: true as const },
      { id: 'ride:hoehle:loco', x: 14, y: 5, z: 1, dir: 'e' as const },
      { id: 'lantern', x: 30, y: 5, z: 1, dir: 'e' as const },
    ];
    const holes = maskHoles(w, lit(bed, { ride: {} }), { ...at, rides });
    expect(holes[0]).toMatchObject({ x: 12.5, y: 5.5, r: D.seat });
    expect(holes[1]).toMatchObject({ y: 5.5, r: D.lamp });
    expect(holes[1]!.x).toBeCloseTo(15.4);
    expect(holes.some((h) => h.x === bed[0] + 0.5 && h.y === bed[1] + 0.5 && h.r === D.hole)).toBe(false);
    // andersherum unterwegs: die Lampen am anderen Ende
    const back = rides.map((r) => ({ ...r, dir: 'w' as const }));
    expect(maskHoles(w, lit(bed, { ride: {} }), { ...at, rides: back })[1]!.x).toBeCloseTo(9.6);
  });

  it('Wege als Bänder: von der Mündung zum Bett und vom Bett zum Portal am See', () => {
    const [toBed, toLake] = pathBands(w);
    expect([toBed![0].x, toBed![0].y]).toEqual(frame.at(0, 0).map((v) => v + 0.5));
    expect([toBed![1].x, toBed![1].y]).toEqual(bed.map((v) => v + 0.5));
    expect([toLake![1].x, toLake![1].y]).toEqual(w.portals.get(CAVE_PORTAL)!.gate.map((v) => v + 0.5));
  });

  it('nur auf Feldern der Grotte (hinter der Mündung), erkundet oder im Nebel: nicht im Gang, nicht draußen', () => {
    const [mx, my] = frame.at(0, 0);
    const win = { cx: mx, cy: my, side: 12, up: 12, down: 12 };
    const runs = coverOf(w, frame, win);
    const covered = new Set<string>();
    for (const r of runs) for (let x = r.x0; x <= r.x1; x++) covered.add(`${x},${r.y}`);
    const bad: string[] = [];
    let gang = 0;
    for (let y = my - 12; y <= my + 12; y++)
      for (let x = mx - 12; x <= mx + 12; x++) {
        const grotto = w.realm(x, y) === 'hoehle' && frame.out(x, y) >= 0;
        if (grotto !== covered.has(`${x},${y}`)) bad.push(`${x},${y}`);
        if (w.realm(x, y) === 'hoehle' && frame.out(x, y) < 0) gang++;
      }
    expect(bad).toEqual([]);
    expect(covered.size).toBeGreaterThan(100);
    expect(gang).toBeGreaterThan(0); // auch Felder der Höhlenwelt im Gang liegen im Ausschnitt, ohne Maske
    // auf der Lichtung keine Maske
    const [lx, ly] = w.homes.lichtung.bed;
    expect(coverOf(w, frame, { cx: lx, cy: ly, side: 10, up: 10, down: 10 })).toEqual([]);
  });
});

/** Zeichenfläche, die mitschreibt, was gezeichnet wird */
function recorder() {
  const calls: string[] = [];
  const stops: [number, string][][] = [];
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
    fillStyle: '' as unknown,
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    setTransform: () => {},
    clearRect: () => calls.push('clear'),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => calls.push(`fill:${ctx.globalCompositeOperation}`),
    stroke: () => calls.push(`stroke:${ctx.strokeStyle}`),
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    fillRect: () => calls.push(`rect:${ctx.globalCompositeOperation}`),
    createRadialGradient: () => {
      const s: [number, string][] = [];
      stops.push(s);
      calls.push('gradient');
      return { addColorStop: (o: number, c: string) => s.push([o, c]) };
    },
    drawImage: (...a: unknown[]) =>
      calls.push(`image:${ctx.globalAlpha}:${a.slice(1).join(',')}:${ctx.imageSmoothingEnabled}`),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, stops };
}

const fakeCanvas = () => {
  const inner = recorder();
  const canvas = { width: 0, height: 0, getContext: () => inner.ctx } as unknown as MaskCanvas;
  return { canvas, inner };
};
const P: Projection = (x, y, z) => [x * 10, (y - z) * 10];

describe('Dunkelmaske: zeichnen', () => {
  it('ein Viertel der Auflösung, ein Pfad für die Felder der Grotte, weiche Löcher, Bänder, ein drawImage mit der Stärke', () => {
    const { canvas, inner } = fakeCanvas();
    const main = recorder();
    const holes = [
      { x: 5, y: 5, z: 1, r: 3, open: 1 },
      { x: 9, y: 5, z: 1, r: 1, open: 1 },
    ];
    const bands: Parameters<typeof drawMask>[6] = [
      [
        { x: 0, y: 0, z: 1 },
        { x: 5, y: 5, z: 1 },
      ],
    ];
    const runs = [
      { y: 1, x0: 0, x1: 9, h: 1 },
      { y: 2, x0: 0, x1: 9, h: 3 },
    ];
    const spots = drawMask(main.ctx, P, canvas, { width: 401, height: 300, ppc: 10 }, runs, holes, bands, D.mask);
    expect([canvas.width, canvas.height]).toEqual([Math.ceil(401 / MASK_SCALE), 300 / MASK_SCALE]);
    expect(MASK_SCALE).toBe(4);
    expect(inner.calls.filter((c) => c === 'fill:source-over')).toHaveLength(1); // alle Reihen ein Pfad
    expect(inner.calls.filter((c) => c.startsWith('stroke'))).toHaveLength(2); // ein Band, weich: außen und innen
    expect(inner.calls.filter((c) => c === 'gradient')).toHaveLength(2);
    expect(inner.calls.filter((c) => c === 'rect:destination-out')).toHaveLength(2);
    expect(inner.stops[0]).toEqual([
      [0, 'rgba(0, 0, 0, 1)'],
      [0.6, 'rgba(0, 0, 0, 0.6)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]);
    // auf das Bild: genau ein drawImage, mit der Stärke und weich vergrößert
    expect(main.calls.filter((c) => c.startsWith('image'))).toEqual([`image:${D.mask}:0,0,101,75,0,0,404,300:true`]);
    expect(spots[0]).toEqual({ cx: 50, cy: 40, r: 30 });
    // bei „Höhle hell“ (0,3) keine Bänder: dort ist es ohnehin heller als die Dämmerung
    const pale = fakeCanvas();
    drawMask(recorder().ctx, P, pale.canvas, { width: 400, height: 300, ppc: 10 }, runs, holes, bands, 0.3);
    expect(pale.inner.calls.filter((c) => c.startsWith('stroke'))).toEqual([]);
  });

  const w = worldOf(1, [HOEHLE_PACK]);
  const bed = w.homes.hoehle.bed;
  const scene = (extra: object = {}) => ({
    width: 400,
    height: 300,
    now: 0,
    reduced: false,
    cam: { x: bed[0], y: bed[1] },
    explored: () => true,
    ...extra,
  });

  it('in der Grotte gezeichnet, im Gang ausgeblendet, im Schlaf mit der Nacht weg; ohne Zeichenfläche (ohne DOM) nichts', () => {
    const { canvas } = fakeCanvas();
    const m: MaskFx = { fade: {}, make: () => canvas };
    caveMask(recorder().ctx, w, scene(), P, lit(bed), m);
    expect(m.drawn?.strength).toBeCloseTo(D.mask);
    expect(m.drawn?.spots.length).toBeLessThanOrEqual(D.most);
    expect(m.cost?.n).toBe(1);
    // halbe Nacht beim Einschlafen: halb so stark
    caveMask(recorder().ctx, w, scene({ night: D.night / 2 }), P, lit(bed), m);
    expect(m.drawn?.strength).toBeCloseTo(D.mask / 2);
    caveMask(recorder().ctx, w, scene({ night: 0.8 }), P, lit(bed), m);
    expect(m.drawn).toBeNull();
    // in den Gang: mit dem Weg schwächer, 12 Felder vor der Mündung weg
    const f = caveFrame(w)!;
    caveMask(recorder().ctx, w, scene({ now: 10_000 }), P, lit(f.at(0, -2)), m);
    expect(m.drawn?.strength).toBeCloseTo(D.mask);
    caveMask(recorder().ctx, w, scene({ now: 10_100 }), P, lit(f.at(0, -7)), m);
    expect(m.drawn?.strength).toBeCloseTo(D.mask / 2);
    caveMask(recorder().ctx, w, scene({ now: 10_200 }), P, lit(f.at(0, -D.gang)), m);
    expect(m.drawn).toBeNull();
    // ein Sprung vom Gang ins Bett (Entwickler-Schalter): blendet in 1 s ein, kein Sprung
    caveMask(recorder().ctx, w, scene({ now: 20_000 }), P, lit(bed), m);
    expect(m.drawn).toBeNull();
    caveMask(recorder().ctx, w, scene({ now: 20_000 + D.fade / 2 }), P, lit(bed), m);
    expect(m.drawn?.strength).toBeCloseTo(D.mask / 2);
    caveMask(recorder().ctx, w, scene({ now: 20_000 + D.fade }), P, lit(bed), m);
    expect(m.drawn?.strength).toBeCloseTo(D.mask);
    // „Höhle hell“ (Schalter im Speicher aus, beim ersten Bild gelesen)
    const pale: MaskFx = { fade: {}, make: () => fakeCanvas().canvas, brightAt: true };
    caveMask(recorder().ctx, w, scene(), P, lit(bed), pale);
    expect(pale.drawn?.strength).toBe(D.bright);
    expect(pale.bright).toBe(true);
    // die Spielfläche um das Canvas sagt es, sobald das Menü sie gesetzt hat (hier: wieder dunkel); die Stärke gleitet
    // in `fade` ms hinüber, nie ein Sprung
    const host = { dataset: { cave: '0' } };
    const onHost = recorder().ctx as unknown as { canvas: { closest: (s: string) => unknown } };
    onHost.canvas = { closest: (sel) => (sel === '.mw' ? host : null) };
    const onHostCtx = onHost as unknown as CanvasRenderingContext2D;
    caveMask(onHostCtx, w, scene({ now: 1 }), P, lit(bed), pale);
    expect(pale.bright).toBe(false);
    expect(pale.drawn?.strength).toBeCloseTo(D.bright);
    caveMask(onHostCtx, w, scene({ now: 1 + D.fade / 2 }), P, lit(bed), pale);
    expect(pale.drawn!.strength).toBeGreaterThan(D.bright);
    expect(pale.drawn!.strength).toBeLessThan(D.mask);
    expect(pale.drawn?.strength).toBeCloseTo((D.bright + D.mask) / 2);
    // halb hinüber wieder umgelegt: zurück von dort, wo sie ist, in der halben Zeit
    host.dataset.cave = '1';
    caveMask(onHostCtx, w, scene({ now: 1 + D.fade / 2 }), P, lit(bed), pale);
    expect(pale.drawn?.strength).toBeCloseTo((D.bright + D.mask) / 2);
    caveMask(onHostCtx, w, scene({ now: 1 + D.fade / 2 + D.fade / 4 }), P, lit(bed), pale);
    expect(pale.drawn?.strength).toBeCloseTo(D.bright + (D.mask - D.bright) / 4);
    caveMask(onHostCtx, w, scene({ now: 1 + D.fade }), P, lit(bed), pale);
    expect(pale.drawn?.strength).toBeCloseTo(D.bright);
    host.dataset.cave = '0';
    caveMask(onHostCtx, w, scene({ now: 2 + D.fade }), P, lit(bed), pale);
    caveMask(onHostCtx, w, scene({ now: 2 + 2 * D.fade }), P, lit(bed), pale);
    expect(pale.drawn?.strength).toBeCloseTo(D.mask);
    // bei reduzierter Bewegung sofort
    host.dataset.cave = '1';
    caveMask(onHostCtx, w, scene({ now: 3 + 2 * D.fade, reduced: true }), P, lit(bed), pale);
    expect(pale.drawn?.strength).toBeCloseTo(D.bright);
    // ohne Zeichenfläche, ohne Zustand, ohne Grotte: nichts
    const none: MaskFx = { fade: {}, make: () => null };
    caveMask(recorder().ctx, w, scene(), P, lit(bed), none);
    expect(none.drawn).toBeNull();
    caveMask(recorder().ctx, w, scene(), P, undefined, m);
    expect(m.drawn).toBeNull();
    caveMask(recorder().ctx, worldOf(1, []), scene(), P, lit(bed), m);
    expect(m.drawn).toBeNull();
  });

  it('Reihenfolge: was zur Welt gehört, dann die Maske, dann das Leuchten (Lichtkreis) obendrauf', () => {
    const main = recorder();
    const fx: CaveFx = {
      chime: new Chime(),
      drips: new Drips(),
      olm: new Olm(),
      light: {},
      mask: { fade: {}, make: () => fakeCanvas().canvas },
    };
    const bodies = new Map([['player', { x: bed[0], y: bed[1], z: 1, hop: 0 }]]);
    const s: State = {
      ...initialState(w),
      sleeping: false,
      wokeAt: -1e9,
      animals: [],
      player: { x: bed[0], y: bed[1], dir: 's' },
    };
    caveWeather(fx)(main.ctx, w, scene({ bodies }) as unknown as SkyScene, P, s);
    const image = main.calls.findIndex((c) => c.startsWith('image'));
    const circle = main.calls.lastIndexOf('gradient');
    expect(image).toBeGreaterThanOrEqual(0);
    expect(circle).toBeGreaterThan(image);
    expect(fx.light.drawn).not.toBeNull();
  });
});

describe('Elternschalter „Höhle dunkel“ (Schritt 6)', () => {
  /** Speicher wie localStorage, in einer Map */
  const memory = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init));
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };

  it('ohne Eintrag dunkel; „1“ heißt hell (Maske 0,3); die Spielfläche (`data-cave`) gilt vor dem Speicher', () => {
    expect(D.bright).toBe(0.3);
    expect(strengthOf(true)).toBe(0.3);
    expect(brightOf({ fade: {} }, null, () => null)).toBe(false);
    expect(brightOf({ fade: {} }, null, () => '0')).toBe(false);
    expect(brightOf({ fade: {} }, null, () => '1')).toBe(true);
    expect(brightOf({ fade: {} }, { dataset: { cave: '1' } }, () => '0')).toBe(true);
    expect(brightOf({ fade: {} }, { dataset: { cave: '0' } }, () => '1')).toBe(false);
    expect(brightOf({ fade: {} }, { dataset: {} }, () => '1')).toBe(true); // Menü noch nie gefüllt
  });

  it('Umlegen: die Grundstärke gleitet in `fade` ms, beim ersten Bild und bei reduzierter Bewegung gleich (`levelOf`)', () => {
    const l = {};
    expect(levelOf(l, D.bright, 0, false)).toBe(D.bright);
    expect(levelOf(l, D.mask, 100, false)).toBe(D.bright);
    expect(levelOf(l, D.mask, 100 + D.fade / 2, false)).toBeCloseTo((D.bright + D.mask) / 2);
    expect(levelOf(l, D.mask, 100 + D.fade, false)).toBe(D.mask);
    expect(levelOf(l, D.mask, 100 + 9 * D.fade, false)).toBe(D.mask);
    expect(levelOf(l, D.bright, 5000, true)).toBe(D.bright);
    expect(levelOf(l, D.mask, 5001, true)).toBe(D.mask);
  });

  it('liest den Speicher einmal (beim ersten Bild) und merkt ihn; gesperrt heißt dunkel', () => {
    let reads = 0;
    const m: MaskFx = { fade: {} };
    const stored = () => (reads++, '1');
    expect(brightOf(m, null, stored)).toBe(true);
    expect(brightOf(m, null, stored)).toBe(true);
    expect(reads).toBe(1);
    expect(m.brightAt).toBe(true);
    const locked: MaskFx = { fade: {} };
    expect(
      brightOf(locked, null, () => {
        throw new Error('gesperrt');
      }),
    ).toBe(false);
    expect(locked.brightAt).toBe(false);
  });

  it('Schlüssel wie im Menü, das das Paket nicht mitlädt; Umlegen merkt ihn für alle Welten, nicht im Spielstand', () => {
    expect(CAVE_STORE).toBe(CAVE_KEY);
    const store = memory();
    expect(caveBright(store)).toBe(false);
    toggleCave(store);
    expect(store.getItem(CAVE_KEY)).toBe('1');
    expect(caveBright(store)).toBe(true);
    expect(brightOf({ fade: {} }, null, () => store.getItem(CAVE_STORE))).toBe(true);
    toggleCave(store);
    expect(store.getItem(CAVE_KEY)).toBe('0');
    expect(caveBright(store)).toBe(false);
    // geht das Speichern nicht, bleibt er, wie er war
    const full = {
      ...memory({ [CAVE_KEY]: '1' }),
      setItem: () => {
        throw new Error('voll');
      },
    };
    toggleCave(full);
    expect(caveBright(full)).toBe(true);
  });
});
