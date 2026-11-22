// Zugang zur Wasserwelt in 3D (Entwurf „Welten-Zugänge“, Muschelbogen mit Wasserwand): Zwischen zwei Felsklippen steht
// ein Bogen aus rosa Muschelstein mit Rippen, oben eine Jakobsmuschel als Schlussstein und darüber das Tropfen-Schild.
// Zu füllt eine leuchtende Wand aus Wasser den ganzen Bogen: Helle Schaumstreifen laufen an ihr herab (bewegte Teile,
// `motion`), unten schäumt sie in ein flaches Becken. Beim Öffnen sinkt die Wand als Ganzes ins Becken zurück; offen
// liegen Bretter über dem Becken und der Bogen ist frei. Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import { type GateBuild, type GateCtx, type GateMotion, Vox, VOX, ease, hash3, seg } from './mitwachsen-gate-kit';
import type { PlateLook } from './mitwachsen-plate';

const C = {
  rosa: '#f4a7b9',
  pfirsich: '#ffd7a8',
  creme: '#fbe3d0',
  rand: '#e58fa8',
  naht: '#d8738e',
  band: '#f6c0c8',
  fels: '#8f949b',
  felsHell: '#a8adb3',
  felsNass: '#6b6f78',
  alge: '#3f9a3c',
  alge2: '#5ab651',
  becken: '#5fb0ea',
  weiss: '#ffffff',
  schaum: '#e8f8ff',
  gischt: '#b8e2ff',
  glanz: '#a6dcfb',
  welle: '#86ccf8',
  planke: '#93683f',
  planke2: '#a0703f',
  kante: '#7a5232',
};
// Wasser der Wand von unten (tiefer) nach oben (heller), je ein Feld hoch
const BAND = ['#2f8fdc', '#3f9ae6', '#4fa8ee', '#5fb4f2', '#70bff5'];

// Schlussstein: Jakobsmuschel von vorn (Pixelbild 11 × 9), schaut immer zur Kamera
const MUSCHEL = [
  '..ppppppp..',
  '.pPpPpPpPp.',
  'pPpPpPpPpPp',
  'pPpPpPpPpPp',
  '.pPpPpPpPp.',
  '..pPpPpPp..',
  '...pPpPp...',
  '....ooo....',
  '...ooooo...',
];
const MUSCHEL_PAL = { p: C.rosa, P: C.pfirsich, o: C.rand };

// Weltzeichen: ein Tropfen, weiß umrandet (Pixelbild 15 × 18), schaut immer zur Kamera
const TROPFEN = [
  '......rrr......',
  '.....rrorr.....',
  '.....robor.....',
  '....rroborr....',
  '....robbbor....',
  '...rrohbborr...',
  '...rohbbbbor...',
  '..rrohbbbborr..',
  '..rohbbbbbbor..',
  '.rrohwbbbbborr.',
  '.rohhwbbbbbbor.',
  '.rohwbbbbbbbor.',
  '.rohwbbbbbbbor.',
  '.rohhbbbbbbbor.',
  '.rrohhbbbbborr.',
  '..rroobbboorr..',
  '...rrrooorrr...',
  '.....rrrrr.....',
];
const TROPFEN_PAL = { o: '#1f4f9a', b: '#3f8fd8', h: '#7fc0f2', w: '#ffffff', r: '#ffffff' };

// Maße in Voxeln (1/8 Feld)
const R_IN = 22; // Innenradius des Bogens: Der Durchgang |x| ≤ 2,4 bleibt bis über 3 Felder frei
const R_OUT = 28; // Außenradius
const SPRING = 16; // Kämpfer: hier beginnt die Rundung
const ARCH = [-4, 2] as const; // Tiefe des Bogens: k von … bis (ohne), z −0,5 … 0,25
const FRONT = 0; // Vorderseite der Wand (k)
const BACK = -3; // Rückseite der Wand; dazwischen ist sie hohl (man sieht nie hinein)
const POOL = [-8, 4] as const; // Becken unter der Wand, k von … bis (ohne)
const PERIOD = 16; // ein Schaumstreifen läuft in 16 Takten 16 Voxel (2 Felder) herab

/** Abstand zur Bogenmitte (Voxel); unter dem Kämpfer zählt nur der waagerechte */
const radius = (i: number, j: number) => {
  const [x, y] = [Math.abs(i + 0.5), j + 0.5 - SPRING];
  return y > 0 ? Math.hypot(x, y) : x;
};
/** Erste Zelle über der Wand in Spalte i, die schon zum Bogen gehört */
const archFoot = (i: number) => {
  const x = Math.abs(i + 0.5);
  return x >= R_IN ? 0 : Math.ceil(SPRING - 0.5 + Math.sqrt(R_IN * R_IN - x * x));
};
const HMAX = archFoot(0);

/** Wie hoch die Wand noch steht (1 voll, 0 ganz im Becken): sinkt zwischen open 0,1 und 0,8 */
export const level = (open: number) => 1 - ease(seg(open, 0.1, 0.8));
/** Oberkante der Wand in Spalte i: Sie sinkt als Ganzes, oben flach, sobald sie unter den Bogen gerät */
export const wallTop = (i: number, lvl: number) => Math.min(archFoot(i), Math.round(HMAX * lvl));
/** Welche Seite der Wand fließt (zur Kamera hin): Vorderseite, nur bei Lage vorn (Kamera dahinter) die Rückseite */
export const flowSide = (cam: readonly [number, number]) => (cam[1] < 0 ? BACK : FRONT);

/**
 * Farbe der Wand in Zelle (i, j) im Takt `beat`: schmale, senkrechte Glanzstreifen, die nach unten wandern (vorn ein
 * weißer Kopf, dahinter ein heller Schweif); gut die Hälfte der Spalten hat einen langen, die übrigen einen schwachen.
 */
function flow(i: number, j: number, beat: number) {
  const ph = Math.floor(hash3(i, 1, 41) * PERIOD);
  const s = (((j + beat + ph) % PERIOD) + PERIOD) % PERIOD;
  if (hash3(i, 4, 41) < 0.55) {
    const len = 4 + Math.floor(hash3(i, 2, 41) * 4);
    if (s === 0) return C.weiss; // Kopf des Streifens
    if (s < len) return s < 3 ? C.schaum : C.glanz;
  } else if (s < 3) return C.welle;
  return BAND[Math.min(BAND.length - 1, Math.floor(j / VOX))]!;
}

/** Schaumwelle am Fuß (0 … 1): wandert langsam an der Wand entlang, nach 16 Takten wieder gleich */
const surf = (i: number, beat: number) => 0.5 + 0.5 * Math.sin(2 * Math.PI * (beat / PERIOD + (i + R_IN) / 11));

/** Schaum am Fuß über den zwei festen Lagen: eine wolkige Kante, die mit der Welle steigt und fällt (sonst null) */
const footFoam = (i: number, j: number, w: number) => {
  const h = 2 + Math.round(w * 2 + hash3(i >> 1, 7, 43) * 1.5);
  return j > h ? null : j === h ? C.gischt : C.schaum;
};

/** Teil des Bogens in Zelle (i, j, k)? (ohne die Wand und die Sockel) */
const inArch = (i: number, j: number, k: number) => {
  if (k < ARCH[0] || k >= ARCH[1] || j < 0) return false;
  const r = radius(i, j);
  return r >= R_IN && r < R_OUT;
};

/** Farbe des Bogens: Pfeiler mit Bändern, oben Rippen in Rosa, Pfirsich und Creme, dazwischen Nähte, außen ein Rand */
function archColor(i: number, j: number): string {
  if (j < SPRING) return Math.floor(j / 4) % 2 ? C.pfirsich : C.band;
  const r = radius(i, j);
  if (r >= R_OUT - 1.5) return C.rand;
  const a = (Math.atan2(j + 0.5 - SPRING, i + 0.5) / Math.PI) * 9;
  if (a % 1 < 0.12 && a > 0.5 && a < 8.5) return C.naht;
  return [C.rosa, C.pfirsich, C.creme][Math.floor(a) % 3]!;
}

const NEIGHBOURS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

/** Bogen aus Muschelstein, nur die Hülle (innen hohl); vorn und hinten liegen die Nähte eine Lage tiefer (Rillen) */
function arch(v: Vox) {
  for (let k = ARCH[0]; k < ARCH[1]; k++)
    for (let j = 2; j < SPRING + R_OUT; j++)
      for (let i = -R_OUT; i < R_OUT; i++) {
        if (!inArch(i, j, k)) continue;
        if (NEIGHBOURS.every(([a, b, d]) => inArch(i + a, j + b, k + d) || j + b < 2)) continue;
        const c = archColor(i, j);
        if (c === C.naht && (k === ARCH[1] - 1 || k === ARCH[0])) continue; // Rille vorn und hinten
        v.set(i, j, k, c);
      }
  // Sockel der Pfeiler aus Fels, oben heller
  for (const s of [-1, 1]) {
    const [i0, i1] = s > 0 ? [R_IN, R_OUT + 2] : [-R_OUT - 2, -R_IN];
    v.fill(i0 / VOX, 0, -6 / VOX, i1 / VOX, 2 / VOX, 4 / VOX, (_i, j) => (j === 1 ? C.felsHell : C.fels));
  }
}

/** Flaches Becken unter der Wand; offen liegen Bretter darüber (dann ist der Boden eben) */
function pool(v: Vox, open: number) {
  const under = level(open) > 0 ? [BACK - bulge(0), FRONT + bulge(0)] : [1, 0]; // unter der Wand sieht niemand hin
  for (let k = POOL[0]; k < POOL[1]; k++)
    for (let i = -R_IN; i < R_IN; i++)
      if (k < under[0]! || k > under[1]!) v.set(i, -1, k, hash3(i >> 1, k, 3) < 0.12 ? C.gischt : C.becken);
  if (open < 0.9) return;
  for (let k = POOL[0]; k < POOL[1]; k++)
    for (let i = -R_IN; i < R_IN; i++) {
      const end = i === -R_IN || i === R_IN - 1 || (k - POOL[0]) % 4 === 3;
      v.set(i, 0, k, end ? C.kante : Math.floor((k - POOL[0]) / 4) % 2 ? C.planke : C.planke2);
    }
}

/** Wie weit die Wand unten aus dem Bogen quillt (Voxel, vorn und hinten): unten drei, nach oben in Stufen weniger */
const bulge = (j: number) => (j < 6 ? 3 : j < 14 ? 2 : j < 24 ? 1 : 0);
/** Zeile j ist eine Stufe (darüber quillt die Wand weniger weit): dort liegt innen festes Wasser unter der Oberfläche */
const ledge = (j: number) => bulge(j + 1) !== bulge(j);

type WallCell = [number, 'flow' | 'foam' | 'still'];
/**
 * Die Wasserwand in Spalte i, Zeile j: Zellen (k, was), vorn und hinten ihre Oberfläche, dazwischen hohl. „flow“ ist
 * die Oberfläche (fließt auf der Seite zur Kamera, auch über die Stufen hinweg), „still“ festes Wasser innen an einer
 * Stufe (darüber und davor liegt Oberfläche), „foam“ fester Schaum: am Fuß und beim Absinken der Saum oben.
 */
function wallRow(i: number, j: number, top: number): WallCell[] {
  const [f, b] = [FRONT + bulge(j), BACK - bulge(j)];
  const crest = j === top - 1 && top < archFoot(i);
  if (crest) return Array.from({ length: f - b + 1 }, (_, n) => [b + n, 'foam']);
  if (j < 2)
    return [
      [f, 'foam'],
      [b, 'foam'],
    ];
  if (!ledge(j))
    return [
      [f, 'flow'],
      [b, 'flow'],
    ];
  const [f1, b1] = [FRONT + bulge(j + 1), BACK - bulge(j + 1)];
  const out: WallCell[] = [
    [f, 'flow'],
    [b, 'flow'],
  ];
  for (let k = f1; k < f; k++) out.push([k, 'still']);
  for (let k = b + 1; k <= b1; k++) out.push([k, 'still']);
  return out;
}
/** Ob Zelle k der Wand auf der fließenden Seite liegt (vorn oder hinten) */
const flowing = (k: number, cam: readonly [number, number]) => (flowSide(cam) === FRONT ? k > -2 : k < -1);

/** Farbe des festen Schaums: Fuß und Ränder weiß, die Oberseite des Saums beim Absinken hellblau */
const foam = (j: number, k: number, top: number) =>
  j === top - 1 && k < FRONT + bulge(j) && k > BACK - bulge(j) ? C.gischt : j === top - 1 ? C.weiss : C.schaum;

/**
 * Das Feste der Wasserwand: Schaum am Fuß und beim Absinken oben, Wasser innen an den Stufen, die Seite, die nicht zur Kamera
 * schaut, mit Streifen wie in Takt 0, und Schaum auf dem Becken davor. Die fließende Seite zeichnet `motion`.
 */
function wall(v: Vox, g: GateCtx) {
  const lvl = level(g.open);
  for (let i = -R_IN; i < R_IN; i++) {
    const top = wallTop(i, lvl);
    if (top <= 0) continue;
    for (let j = 0; j < top; j++)
      for (const [k, what] of wallRow(i, j, top)) {
        if (what === 'foam') v.set(i, j, k, foam(j, k, top), 'bright');
        else if (what === 'still') v.set(i, j, k, BAND[Math.min(BAND.length - 1, j >> 3)]!, 'bright');
        else if (!flowing(k, g.cam)) v.set(i, j, k, flow(i, j, 0), 'bright');
      }
    // Schaum auf dem Becken hinter der Wand, wenn die Rückseite still ist (vorn wäre schon die Bucht)
    if (flowSide(g.cam) === FRONT && surf(i, 0) > 0.35) v.set(i, 0, BACK - bulge(0) - 1, C.weiss, 'bright');
  }
}

/**
 * Fels in Säulen nach einer Höhenkarte (Voxel); innen hohl, nur was man sehen kann, oben Moos, unten nass mit Algen.
 * `beside` sagt, wie hoch es außerhalb an einer Stelle ist.
 */
function rock(
  v: Vox,
  [i0, i1, k0, k1]: readonly [number, number, number, number],
  height: (i: number, k: number) => number,
  beside: (i: number, k: number) => number,
) {
  const h = (i: number, k: number) => (i < i0 || i >= i1 || k < k0 || k >= k1 ? beside(i, k) : height(i, k));
  for (let k = k0; k < k1; k++)
    for (let i = i0; i < i1; i++) {
      const top = h(i, k);
      const low = Math.min(h(i - 1, k), h(i + 1, k), h(i, k - 1), h(i, k + 1));
      for (let j = Math.max(0, Math.min(low, top - 1) - 1); j < top; j++) {
        const r = hash3(i, j, k);
        const c = j < 3 ? (r < 0.2 ? C.alge : C.felsNass) : r < 0.3 ? C.fels : C.felsHell;
        const moss = j === top - 1 && hash3(i, k, 3) < 0.45;
        v.set(i, j, k, c, 'solid', moss ? C.alge2 : undefined);
      }
    }
}

/** Felsklippen neben dem Bogen: am Bogen niedrig, nach außen höher */
function cliffs(v: Vox) {
  for (const s of [-1, 1]) {
    const [i0, i1] = s > 0 ? [R_OUT + 2, 42] : [-42, -R_OUT - 2];
    const cliff = (i: number, k: number) => {
      const d = s > 0 ? i - i0 : i1 - 1 - i;
      const base = d < 3 ? 9 : d < 7 ? 13 : 16;
      return base + Math.floor(hash3(i >> 1, k >> 1, 5) * 3) - (k === 3 ? 2 : 0);
    };
    rock(v, [i0, i1, -4, 4], cliff, (_i, k) => (k < -4 ? 16 : 0));
  }
}

/**
 * Wo Muschel und Tropfen stehen (x, z): von vorn und hinten auf der Seite des Bogens zur Kamera, von der Seite mitten
 * über dem Bogen (das Bild steht dann quer und reicht nach vorn und hinten); nie über der Bucht.
 */
const signAt = (cam: readonly [number, number], width: number) => {
  if (cam[1] > 0) return [0, ARCH[1] / VOX] as const;
  if (cam[1] < 0) return [0, (ARCH[0] - 1) / VOX] as const;
  return [0, (3 - Math.floor(width / 2)) / VOX] as const;
};

/** Alle festen Voxel des Zugangs in einem Raster (für Tests auch einzeln abrufbar) */
export function model(g: GateCtx) {
  const v = new Vox();
  pool(v, g.open);
  arch(v);
  cliffs(v);
  wall(v, g);
  const [mx, mz] = signAt(g.cam, 11);
  v.image(mx, (SPRING + R_IN) / VOX, mz, MUSCHEL, MUSCHEL_PAL, g.cam, 'solid', 2);
  const [tx, tz] = signAt(g.cam, 15);
  v.image(tx, (SPRING + R_OUT + 3) / VOX, tz, TROPFEN, TROPFEN_PAL, g.cam, 'bright', 2);
  return v;
}

const fixed = new Map<string, Vox>();

/** Das feste Raster je Öffnung und Lage, einmal gebaut (die bewegten Teile prüfen jeden Takt dagegen) */
function fixedModel(g: GateCtx) {
  const at = `${g.open},${g.cam[0]},${g.cam[1]}`;
  let v = fixed.get(at);
  if (!v) {
    if (fixed.size > 32) fixed.clear();
    v = model(g);
    fixed.set(at, v);
  }
  return v;
}

/** Eine bewegte Zelle: i, j, k und Farbe */
export type Cell = readonly [number, number, number, string];

/**
 * Bewegte Zellen im Takt `beat`: die Seite der Wand zur Kamera mit herablaufenden Streifen, darüber am Fuß eine
 * Schaumwelle, die langsam an der Wand entlangzieht, und Schaum auf dem Becken davor. Nie in einer festen Zelle.
 */
export function moving(g: GateCtx, beat: number): Cell[] {
  const lvl = level(g.open);
  if (lvl <= 0) return [];
  const solid = fixedModel(g);
  const k = flowSide(g.cam);
  const b = ((beat % PERIOD) + PERIOD) % PERIOD;
  const cells: Cell[] = [];
  const put = (i: number, j: number, kk: number, c: string) => {
    if (!solid.has(i, j, kk)) cells.push([i, j, kk, c]);
  };
  for (let i = -R_IN; i < R_IN; i++) {
    const top = wallTop(i, lvl);
    if (top <= 0) continue;
    const w = surf(i, b);
    for (let j = 2; j < top; j++)
      for (const [kk, what] of wallRow(i, j, top))
        if (what === 'flow' && flowing(kk, g.cam)) put(i, j, kk, footFoam(i, j, w) ?? flow(i, j, b));
    if (k === BACK && w > 0.35) put(i, 0, BACK - bulge(0) - 1, C.weiss);
  }
  return cells;
}

export const build: GateBuild = (p, g) => {
  model(g).emit(p);
  return [];
};

export const motion: GateMotion = (p, g, beat) => {
  const v = new Vox();
  for (const [i, j, k, c] of moving(g, beat)) v.set(i, j, k, c, 'bright');
  v.emit(p);
};

/** Torplatte vor dem Zugang (mitwachsen-plate-3d.ts, Zeichen in Farben aus `PALETTE`): Planke eines Stegs mit einer Welle (leuchtet wie Wasser), sie wippt leicht, solange die Figur darauf steht */
export const plate: PlateLook = {
  face: ['#8a6238', '#b48d58'],
  mark: ['..vv....vv....vv.', '.v..v..v..v..v..v', 'v....vv....vv....'],
  bob: true,
};
