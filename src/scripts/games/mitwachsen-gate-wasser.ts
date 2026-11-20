// Zugang zur Wasserwelt in 3D (Entwurf „Welten-Zugänge“, Lagune mit wachsendem Steg): Zwischen zwei Felsklippen
// führt ein Meeresarm in die Welt. Zu liegt nur ein kurzer Anleger in der Torreihe, dahinter Wasser, daneben ein Stapel
// Bretter auf einem Felsen. Beim Öffnen schiebt sich Brett für Brett vom Stapel über das Wasser, bis der Steg die ganze
// Breite des Gangs bedeckt; dann gehen die Laternen an. Ein rot-weißer Leuchtturm mit Tropfen-Schild ragt über den Ring.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import { type GateBuild, type GateCtx, Vox, VOX, ease, hash3, seg } from './mitwachsen-gate-kit';

const C = {
  wasser: '#8cc6f0',
  welle: '#b8e2ff',
  tief: '#7ab8e6',
  planke: '#93683f',
  planke2: '#a0703f',
  kante: '#7a5232',
  pfosten: '#5d3e21',
  fels: '#8f949b',
  felsHell: '#a8adb3',
  felsNass: '#6b6f78',
  alge: '#3f9a3c',
  alge2: '#5ab651',
  muschel: '#f4a7b9',
  muschel2: '#ffd7a8',
  rot: '#d9473a',
  weiss: '#f4f8fb',
  dunkel: '#3a3a44',
  lampe: '#ffe6a0',
  lampeAus: '#c9b98a',
  lampeTag: '#fff1c4',
};

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

// Maße in Voxeln (1/8 Feld): Gang |x| ≤ 2,5, Wasser von der Torreihe (z 0,5) bis z −3,5, Bretter je 1/2 Feld
const HALF = 20; // halbe Breite des Gangs
const FRONT = 4; // Vorderkante der Torreihe (z 0,5)
const BACK = -28; // Ende des Meeresarms (z −3,5)
const BOARDS = 6; // Bretter, die beim Öffnen heranrutschen (hinter den zwei des Anlegers)
const BOARD = 4; // Tiefe eines Bretts
const PIER = -4; // Ende des Anlegers (z −0,5)
const PLINTH = 18; // Höhe der Kuppe, auf der der Leuchtturm steht
const SIGN_Y = 3.25; // Unterkante des Schilds (über dem Durchgang, der bis 3 Felder frei bleibt)

/** Wie weit Brett `n` vom Stapel herangerutscht ist (0 … 1): eins nach dem anderen, bis open 0,83 */
export const slide = (open: number, n: number) => ease(seg(open, 0.05 + n * 0.13, 0.18 + n * 0.13));
/** Die Laternen leuchten, sobald der Steg fertig ist */
export const LIT = 0.9;

/** Wasser knapp unter Bodenhöhe (Oberseite bei y 0): hell, mit Wellenstreifen und dunkleren Stellen */
function water(v: Vox) {
  for (let k = BACK; k < FRONT; k++)
    for (let i = -HALF; i < HALF; i++) {
      const h = hash3(Math.floor(i / 3), k, 7);
      v.set(i, -1, k, h < 0.07 ? C.welle : h > 0.95 ? C.tief : C.wasser);
    }
}

/**
 * Ein Brett quer über den Gang von Voxel `a` bis `b` (ohne b): drei Reihen Planke, dann eine Fuge, durch die man das
 * Wasser sieht. Die Enden sind dunkler.
 */
function board(v: Vox, k0: number, n: number, a = -HALF, b = HALF) {
  for (let r = 0; r < BOARD - 1; r++)
    for (let i = a; i < b; i++) {
      const end = i === a || i === b - 1;
      v.set(i, 0, k0 + r, end ? C.kante : (n + (r > 0 ? 1 : 0)) % 2 ? C.planke : C.planke2);
      v.set(i, -1, k0 + r, null); // Wasser darunter sieht niemand
    }
}

/** Anleger (immer da) und die Bretter, die schon liegen oder gerade von der Seite `from` heranrutschen */
function pier(v: Vox, open: number, from: number) {
  board(v, FRONT - BOARD, 0);
  board(v, PIER, 1);
  for (let n = 0; n < BOARDS; n++) {
    const len = Math.round(slide(open, n) * 2 * HALF);
    if (len <= 0) continue;
    const k0 = PIER - (n + 1) * BOARD;
    // vom Stapel aus über das Wasser: das freie Ende wandert zur anderen Seite
    if (from > 0) board(v, k0, n, HALF - len, HALF);
    else board(v, k0, n, -HALF, -HALF + len);
  }
}

/**
 * Fels in Säulen nach einer Höhenkarte (Voxel); innen hohl, nur was man sehen kann, oben Moos, unten nass mit Algen.
 * `beside` sagt, wie hoch es außerhalb an einer Stelle ist (dort steht der Felsring, die Wand dahinter sieht niemand).
 */
function rock(
  v: Vox,
  [i0, i1, k0, k1]: readonly [number, number, number, number],
  height: (i: number, k: number) => number,
  beside: (i: number, k: number) => number = () => 0,
) {
  const h = (i: number, k: number) => (i < i0 || i >= i1 || k < k0 || k >= k1 ? beside(i, k) : height(i, k));
  for (let k = k0; k < k1; k++)
    for (let i = i0; i < i1; i++) {
      const top = h(i, k);
      const low = Math.min(h(i - 1, k), h(i + 1, k), h(i, k - 1), h(i, k + 1));
      for (let j = Math.max(0, Math.min(low, top - 1) - 1); j < top; j++) {
        const r = hash3(i, j, k);
        const c = j < 3 ? (r < 0.2 ? C.alge : C.felsNass) : r < 0.3 ? C.fels : C.felsHell;
        const moss = j === top - 1 && top > 6 && hash3(i, k, 3) < 0.55;
        v.set(i, j, k, c, 'solid', moss ? C.alge2 : undefined);
      }
    }
}

/**
 * Klippen zu beiden Seiten der Torreihe: zum Wasser hin niedrig und nass mit Algen, nach außen hoch. Um (lx, lz) eine
 * ebene Kuppe für den Leuchtturm.
 */
function cliffs(v: Vox, lx: number, lz: number) {
  const [ci, ck] = [Math.round(lx * VOX), Math.round(lz * VOX)];
  for (const s of [-1, 1]) {
    const [i0, i1] = s > 0 ? [HALF, 36] : [-36, -HALF];
    const behind = (i: number, k: number) => (k < -12 || (s > 0 ? i >= i1 : i < i0) ? 12 : 0);
    const cliff = (i: number, k: number) => {
      if (Math.hypot(i + 0.5 - ci, k + 0.5 - ck) < 6.5) return PLINTH;
      const d = s > 0 ? i - HALF : -HALF - 1 - i; // Abstand vom Wasser
      if (k < PIER && d < 10) return 0; // hinter der Torreihe nur der hohe Teil
      const base = d < 3 ? 6 : d < 8 ? 14 : 22;
      return base + Math.floor(hash3(Math.floor(i / 2), Math.floor(k / 2), 5) * 4) - (k < -6 ? 6 : 0);
    };
    rock(v, [i0, i1, -12, FRONT], cliff, behind);
  }
}

/** Pfosten am Rand des Gangs; Laternen darauf, sobald ihr Brett liegt, leuchtend erst, wenn der Steg fertig ist */
function posts(v: Vox, open: number) {
  const lit = open >= LIT;
  const spots: [number, number][] = [
    [PIER - 2 * BOARD - 2, slide(open, 1)],
    [PIER - 5 * BOARD - 2, slide(open, 4)],
  ];
  for (const [k, laid] of spots)
    for (const i of [-HALF - 2, HALF]) {
      const [x0, x1, z0, z1] = [i / VOX, (i + 2) / VOX, k / VOX, (k + 2) / VOX];
      v.fill(x0, 0, z0, x1, 0.5, z1, C.pfosten);
      if (laid < 1) continue;
      v.fill(x0, 0.5, z0, x1, 0.75, z1, lit ? C.lampe : C.lampeAus, lit ? 'bright' : 'solid');
      v.fill(x0, 0.75, z0, x1, 0.875, z1, C.pfosten);
    }
}

/** Felsen neben dem Wasser (Seite `s`) mit dem Stapel der Bretter, die noch fehlen */
function stack(v: Vox, open: number, s: number) {
  const [i0, i1] = s > 0 ? [HALF + 1, HALF + 9] : [-HALF - 9, -HALF - 1];
  rock(v, [i0, i1, -19, -5], (i, k) => 2 + Math.floor(hash3(i, k, 11) * 2));
  let left = 0;
  for (let n = 0; n < BOARDS; n++) if (slide(open, n) <= 0) left++;
  for (let l = 0; l < left; l++) {
    const y = (4 + l) / VOX;
    const plank = (i: number, _j: number, k: number) =>
      k === -15 || k === -10 ? C.pfosten : (l + (i % 2 ? 1 : 0)) % 2 ? C.planke : C.planke2;
    v.fill((i0 + 2) / VOX, y, -17 / VOX, (i1 - 2) / VOX, y + 1 / VOX, -7 / VOX, plank);
  }
  // Muscheln am Felsen
  v.set(i0 + 1, 4, -6, C.muschel);
  v.set(i1 - 2, 4, -19, C.muschel2);
}

/** Rot-weißer Leuchtturm um (x, z) auf der Kuppe: Ringe, Umgang, leuchtende Laterne, rotes Dach */
function lighthouse(v: Vox, x: number, z: number, lit: boolean) {
  const [ci, ck] = [Math.round(x * VOX), Math.round(z * VOX)];
  const disk = (j: number, r: number, c: string, inner = 0, part: 'solid' | 'bright' = 'solid') => {
    for (let k = -6; k < 6; k++)
      for (let i = -6; i < 6; i++) {
        const d = Math.hypot(i + 0.5, k + 0.5);
        if (d <= r && d > inner) v.set(ci + i, j, ck + k, c, part);
      }
  };
  let j = PLINTH - 2;
  for (let ring = 0; ring < 6; ring++)
    for (let n = 0; n < 5; n++, j++) disk(j, 4.6 - ring * 0.2, ring % 2 ? C.rot : C.weiss, 3.3 - ring * 0.2);
  disk(j++, 4.4, C.dunkel); // Umgang
  for (let n = 0; n < 4; n++, j++) disk(j, 2.3, lit ? C.lampe : C.lampeTag, 0, 'bright');
  disk(j++, 3.2, C.rot);
  disk(j++, 2.2, C.rot);
  disk(j++, 1.2, C.dunkel);
  disk(j, 0.8, C.dunkel);
}

/** Wo der Leuchtturm steht: auf der Klippe, bei Lage links/rechts auf der Seite weg von der Kamera, sonst rechts */
export const lighthouseAt = (cam: readonly [number, number]) => [cam[0] > 0 ? -3.75 : 3.75, -0.25] as const;

/**
 * Mitte des Tropfen-Schilds: aus Sicht der Kamera neben dem Leuchtturm, damit er ganz zu sehen bleibt. Von vorn und
 * hinten hängt es über dem Rand des Gangs (höher als 3 Felder), von der Seite dahinter; nie über der Bucht
 */
const signAt = (cam: readonly [number, number], lx: number, lz: number) =>
  cam[1] !== 0 ? ([lx - Math.sign(lx) * 1.3, lz + cam[1] * 0.6] as const) : ([lx + cam[0] * 0.6, lz - 1.3] as const);

/** Alle Voxel des Zugangs in einem Raster (für Tests auch einzeln abrufbar) */
export function model(g: GateCtx) {
  const v = new Vox();
  const [lx, lz] = lighthouseAt(g.cam);
  const from = -Math.sign(lx); // der Stapel liegt gegenüber dem Leuchtturm, von dort rutschen die Bretter heran
  water(v);
  cliffs(v, lx, lz);
  stack(v, g.open, from);
  pier(v, g.open, from);
  posts(v, g.open);
  lighthouse(v, lx, lz, g.open >= LIT);
  const [sx, sz] = signAt(g.cam, lx, lz);
  v.image(sx, SIGN_Y, sz, TROPFEN, TROPFEN_PAL, g.cam, 'bright', 2);
  return v;
}

export const build: GateBuild = (p, g) => {
  model(g).emit(p);
  return [];
};
