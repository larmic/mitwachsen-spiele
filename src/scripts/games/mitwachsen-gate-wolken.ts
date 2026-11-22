// Zugang zur Wolkenwelt in 3D (Entwurf „Welten-Zugänge“, Idee b): Im Durchgang schläft eine riesige Wolke mit
// geschlossenen Augen und rosa Bäckchen, das Gesicht immer zur Kamera, und ragt weit über den Felsring. Beim Öffnen
// wird sie gekitzelt, wacht auf, gähnt und streckt sich: Ihr Kopf legt sich in die linke Nische, ihr Bauch wird zu einer
// Wolkentreppe in der rechten Nische hinauf auf den Ring, zwei Kuppeln werden zu den Füßen eines Regenbogens hoch über
// dem freien Durchgang. Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
//
// Wolken sind Bausche (Superellipsoide) in einem Raster; gesetzt werden nur Voxel, die man von der Kamera aus sehen
// kann (Oberseite, zur Kamera, zu den Seiten), damit die große Wolke unter der Grenze von etwa 6000 Voxeln bleibt.

import { Vox, ease, hash3, seg, VOX, type GateBuild, type GateCtx } from './mitwachsen-gate-kit';

/** Ein Bausch: Mitte (x, y, z), Halbachsen (rx, ry, rz) in Feldern, p Rundung (2 rund, 4–5 kissenförmig) */
export type Puff = readonly [x: number, y: number, z: number, rx: number, ry: number, rz: number, p: number];
type Cam = GateCtx['cam'];

const TOP = '#ffffff'; // Oberseite
const SIDE = '#eef4fb'; // Seiten
const UNDER = '#d6e2ef'; // Unterseite, im Schatten
const FRONT = 3; // vorderste Voxelreihe (z bis 0,5): davor beginnt die Bucht
const RAINBOW = ['#e8504a', '#f39a3d', '#f2d14b', '#6dbd47', '#5aa6e8', '#8a6bd6'];

/** Die schlafende Wolke (zu): Füße, Bauch, Gesicht, Seiten, drei Kuppeln; das Gesicht (3) je nach Kamera, siehe sleepFace */
const SLEEP: readonly Puff[] = [
  [-2.3, 1.0, -0.9, 1.25, 1.0, 1.35, 2], // linker Fuß
  [0, 1.3, -0.6, 1.6, 1.3, 1.15, 2], // Bauch
  [2.3, 1.0, -0.9, 1.25, 1.0, 1.35, 2], // rechter Fuß
  [0, 3.9, -0.9, 2.3, 1.55, 1.25, 2], // Gesicht
  [-2.45, 2.6, -1.2, 0.95, 1.15, 1.1, 2], // linke Seite
  [2.45, 2.6, -1.2, 0.95, 1.15, 1.1, 2], // rechte Seite
  [-1.6, 5.0, -1.35, 1.1, 1.0, 1.0, 2], // linke Kuppel
  [0, 5.6, -1.2, 1.3, 1.2, 1.1, 2], // mittlere Kuppel
  [1.6, 5.0, -1.35, 1.1, 1.0, 1.0, 2], // rechte Kuppel
];

/** Gesichtsbausch der schlafenden Wolke auf der Seite, die zur Kamera zeigt */
function sleepFace(cam: Cam): Puff {
  if (cam[0] !== 0) return [cam[0] * 2.2, 4.2, -1.0, 1.25, 1.5, 1.8, 2];
  return cam[1] < 0 ? [0, 3.9, -1.3, 2.3, 1.55, 1.25, 2] : [0, 3.9, -0.9, 2.3, 1.55, 1.25, 2];
}

/**
 * Regenbogen: Außenradius, Unterkante (3 Felder über dem Durchgang) und Mitte (x, z) seiner Ebene; von hinten gesehen
 * steht er weiter vorn, damit seine Füße den Kopf der Wolke nicht verdecken
 */
const BOW_R = 3.5;
export const BOW_Y = 3;
const bowAt = (cam: Cam): [number, number] => (cam[0] !== 0 ? [0, -3.25] : cam[1] < 0 ? [0, -0.4] : [0, -1.5]);

/** Fuß des Regenbogens (side −1 links, 1 rechts aus Sicht der Kamera): ein Wölkchen, ganz über 3 Feldern Höhe */
function bowFoot(cam: Cam, side: number): Puff {
  const [bx, bz] = bowAt(cam);
  const [rx, rz] = [cam[1], -cam[0]]; // rechts aus Sicht der Kamera
  const u = side * (BOW_R - 0.85);
  const [ax, az] = rx !== 0 ? [0.7, 0.45] : [0.45, 0.7];
  return [bx + rx * u, 3.32, bz + rz * u, ax, 0.3, az, 2];
}

/**
 * Die wache Wolke (offen), Bausch für Bausch zu SLEEP: Kopf und Körper liegen in der linken Nische, die Treppe steigt in
 * der rechten Nische nach hinten auf den Ring, zwei Kuppeln tragen den Regenbogen. Alles bleibt außerhalb von |x| ≤ 2,5
 * oder über 3 Feldern Höhe. Schaut die Kamera von hinten, liegt der Kopf hinten, damit man sein Gesicht sieht.
 */
function wake(cam: Cam): Puff[] {
  const [head, body, tail] = cam[1] < 0 ? [-2.3, -1.2, -0.25] : [-0.35, -1.45, -2.35];
  return [
    [-3.35, 0.5, tail, 0.75, 0.5, 0.6, 2], // linker Fuß → Schwanzbausch
    [3.45, 0.3, 0.0, 0.85, 0.3, 0.45, 4.5], // Bauch → unterste Stufe
    [3.45, 0.55, -0.85, 0.85, 0.55, 0.45, 4.5], // rechter Fuß → zweite Stufe
    [-3.45, 0.85, head, 0.88, 0.85, 0.8, 2.3], // Gesicht → Kopf
    [-3.5, 0.75, body, 0.85, 0.75, 0.75, 2], // linke Seite → Körper
    [3.45, 0.8, -1.7, 0.85, 0.8, 0.45, 4.5], // rechte Seite → dritte Stufe
    bowFoot(cam, -1), // linke Kuppel → linker Fuß des Regenbogens
    [3.45, 1.05, -2.55, 0.85, 1.05, 0.45, 4.5], // mittlere Kuppel → oberste Stufe am Ring
    bowFoot(cam, 1), // rechte Kuppel → rechter Fuß des Regenbogens
  ];
}

/** Ablauf beim Öffnen (0 … 1): gekitzelt, aufgewacht und gähnen, strecken (Bausche wandern), Regenbogen */
function phases(open: number) {
  return { tickle: seg(open, 0, 0.2), awake: open >= 0.18, m: ease(seg(open, 0.3, 0.85)), rb: seg(open, 0.8, 1) };
}

/** Bausche für den Öffnungsgrad: von der Schlafform zur Treppe; beim Kitzeln hüpfen sie nacheinander */
export function puffs(g: GateCtx): Puff[] {
  const { tickle, m } = phases(g.open);
  const awake = wake(g.cam);
  const lerp = (a: number, b: number) => a + (b - a) * m;
  const wiggle = Math.sin(Math.PI * tickle) * 0.09;
  const list = SLEEP.map((s, n): Puff => {
    const a = n === 3 ? sleepFace(g.cam) : s;
    const b = awake[n] ?? a;
    const q = a.map((v, k) => lerp(v, b[k] ?? v));
    const at = (k: number) => q[k] ?? 0;
    return [at(0), at(1) + Math.sin(n * 1.9 + g.open * 60) * wiggle, at(2), at(3), at(4), at(5), at(6)];
  });
  return [...list, ...snore(g)];
}

/** Schnarchwölkchen schräg über dem Gesicht (nur im Schlaf), rechts aus Sicht der Kamera */
function snore(g: GateCtx): Puff[] {
  if (g.open > 0) return [];
  const f = sleepFace(g.cam);
  const [rx, rz] = [g.cam[1], -g.cam[0]];
  return [0.17, 0.24, 0.32].map((r, n): Puff => {
    const u = 1.7 + n * 0.55;
    const z = Math.min(0.45 - r, f[2] + rz * u + g.cam[1] * 0.6);
    return [f[0] + rx * u, 5.9 + n * 0.6, z, r, r * 0.85, r, 2];
  });
}

type Box = readonly [i0: number, i1: number, j0: number, j1: number, k0: number, k1: number];

/** Raster der Bausche: Nummer des Bauschs je Voxel (0 leer), vorn bei z 0,5 und unten am Boden abgeschnitten */
function occupancy(list: readonly Puff[]) {
  const live = list.filter((p) => p[3] > 0.05 && p[4] > 0.05 && p[5] > 0.05);
  const lo = (c: number, r: number) => Math.floor((c - r) * VOX);
  const hi = (c: number, r: number) => Math.ceil((c + r) * VOX);
  const box: Box = [
    Math.min(...live.map((p) => lo(p[0], p[3]))),
    Math.max(...live.map((p) => hi(p[0], p[3]))),
    0,
    Math.max(...live.map((p) => hi(p[1], p[4]))),
    Math.min(...live.map((p) => lo(p[2], p[5]))),
    Math.min(FRONT + 1, Math.max(...live.map((p) => hi(p[2], p[5])))),
  ];
  const [i0, i1, j0, j1, k0, k1] = box;
  const [nx, ny] = [i1 - i0, j1 - j0];
  const grid = new Uint8Array(Math.max(0, nx * ny * (k1 - k0)));
  const at = (i: number, j: number, k: number) =>
    i >= i0 && i < i1 && j >= j0 && j < j1 && k >= k0 && k < k1 ? ((k - k0) * ny + (j - j0)) * nx + (i - i0) : -1;
  for (const p of live) fillPuff(p, list.indexOf(p) + 1, at, grid);
  const get = (i: number, j: number, k: number) => {
    const q = at(i, j, k);
    return q < 0 ? 0 : (grid[q] ?? 0);
  };
  return { get, box };
}

/** Einen Bausch ins Raster: freie Plätze bekommen seine Nummer `id`; der Rand ist ein wenig aufgeraut */
function fillPuff(p: Puff, id: number, at: (i: number, j: number, k: number) => number, grid: Uint8Array) {
  const [x, y, z, rx, ry, rz, e] = p;
  const rough = e > 3 ? 0.04 : 0.08;
  const d = (v: number, c: number, r: number) => Math.abs(((v + 0.5) / VOX - c) / r) ** e;
  for (let k = Math.floor((z - rz) * VOX); k < Math.ceil((z + rz) * VOX); k++)
    for (let j = Math.floor((y - ry) * VOX); j < Math.ceil((y + ry) * VOX); j++)
      for (let i = Math.floor((x - rx) * VOX); i < Math.ceil((x + rx) * VOX); i++) {
        const q = at(i, j, k);
        if (q < 0 || grid[q]) continue;
        if (d(i, x, rx) + d(j, y, ry) + d(k, z, rz) <= 1 + (hash3(i, j, k + id * 131) - 0.5) * rough) grid[q] = id;
      }
}

/**
 * Die Wolke in das Raster: nur Voxel, deren Oberseite, Seite zur Kamera oder Seiten links und rechts frei sind (mit
 * `all` auch die Rückseite)
 */
function cloud(vox: Vox, list: readonly Puff[], cam: Cam, all = false) {
  const { get, box } = occupancy(list);
  const [i0, i1, j0, j1, k0, k1] = box;
  const free = (i: number, j: number, k: number) => j >= 0 && get(i, j, k) === 0;
  const [rx, rz] = [cam[1], -cam[0]];
  for (let k = k0; k < k1; k++)
    for (let j = j0; j < j1; j++)
      for (let i = i0; i < i1; i++) {
        const id = get(i, j, k);
        if (!id) continue;
        const seen =
          free(i, j + 1, k) ||
          free(i + cam[0], j, k + cam[1]) ||
          free(i + rx, j, k + rz) ||
          free(i - rx, j, k - rz) ||
          (all && free(i - cam[0], j, k - cam[1]));
        if (!seen) continue;
        const p = list[id - 1];
        const low = p !== undefined && (j + 0.5) / VOX < p[1] - p[4] * 0.42;
        vox.set(i, j, k, low ? UNDER : SIDE, 'solid', TOP);
      }
}

// Gesicht als Pixelbilder (rows[0] oben); Farben in FACE
const EYE_SHUT = ['#......#', '##....##', '.######.', '..####..'];
const EYE_BIG = ['.###.', '#ww##', '#w###', '#####', '.###.'];
const EYE_SMALL = ['#w', '##', '##'];
const CHEEK_BIG = ['.kkkk.', 'kkkkkk', '.kkkk.'];
const CHEEK_SMALL = ['kkk', 'kkk'];
const MOUTH_SNORE = ['.o.', 'ooo', '.o.'];
const MOUTH_YAWN = ['.mmm.', 'mmmmm', 'mmmmm', 'mpppm', '.ppp.'];
const MOUTH_SMILE = ['m...m', '.mmm.'];
const FACE: Record<string, string> = { '#': '#4b5d78', w: '#ffffff', k: '#f6b6c4', o: '#8a9bb4', m: '#4b5d78' };
const FACE_AWAKE: Record<string, string> = { ...FACE, '#': '#2b3a52', p: '#f39aa8' };

/**
 * Ein Pixelbild auf die Wolke malen, dort wo sie zur Kamera zeigt: Mitte des Bilds (u quer, y hoch) in der Ebene durch
 * die Mitte `c` des Bauschs; je Pixel wird von der Kamera her der erste Voxel der Wolke umgefärbt.
 */
function paint(
  vox: Vox,
  c: Puff,
  cam: Cam,
  u: number,
  y: number,
  rows: readonly string[],
  pal: Record<string, string>,
) {
  const [rx, rz] = [cam[1], -cam[0]];
  const reach = Math.ceil((Math.max(c[3], c[5]) + 1.2) * VOX);
  const w = Math.max(...rows.map((r) => r.length));
  const ci = Math.round((c[0] + rx * u) * VOX),
    ck = Math.round((c[2] + rz * u) * VOX);
  const cj = Math.round((c[1] + y) * VOX - rows.length / 2);
  rows.forEach((row, r) =>
    [...row].forEach((ch, col) => {
      const color = pal[ch];
      if (!color) return;
      const s = col - Math.floor(w / 2);
      const [i, j, k] = [ci + rx * s, cj + rows.length - 1 - r, ck + rz * s];
      for (let t = reach; t >= -reach; t--)
        if (vox.has(i + cam[0] * t, j, k + cam[1] * t)) {
          vox.set(i + cam[0] * t, j, k + cam[1] * t, color, 'solid');
          return;
        }
    }),
  );
}

/** Das Gesicht: schläft (Augen zu, schnarcht), wacht auf (große Augen, gähnt), liegt als Kopf in der Nische und lacht */
function face(vox: Vox, head: Puff, g: GateCtx) {
  const { awake, m } = phases(g.open);
  const side = g.cam[0] !== 0;
  const lerp = (a: number, b: number) => a + (b - a) * m;
  const [ex, ey] = [lerp(side ? 0.72 : 1.05, 0.36), lerp(0.72, 0.14)];
  const [bx, by] = [lerp(side ? 1.12 : 1.6, 0.6), lerp(0.22, -0.12)];
  const eye = !awake ? EYE_SHUT : m < 0.45 ? EYE_BIG : EYE_SMALL;
  const yawn = awake && m < 0.4;
  const mouth = yawn ? MOUTH_YAWN : awake ? MOUTH_SMILE : MOUTH_SNORE;
  const pal = awake ? FACE_AWAKE : FACE;
  for (const sx of [-1, 1]) {
    paint(vox, head, g.cam, sx * ex, ey, eye, pal);
    paint(vox, head, g.cam, sx * bx, by, m < 0.45 ? CHEEK_BIG : CHEEK_SMALL, pal);
  }
  paint(vox, head, g.cam, 0, lerp(-0.22, -0.3) - (yawn ? 0.06 : 0), mouth, pal);
}

/** Regenbogen als Pixelbild: Band für Band von außen, `shown` Bänder (0 … 6), je Band 2 Pixel breit */
export function rainbowRows(shown: number) {
  const w = Math.ceil(BOW_R * 2 * VOX),
    h = Math.ceil(BOW_R * VOX);
  const rows: string[] = [];
  for (let r = 0; r < h; r++) {
    let line = '';
    for (let c = 0; c < w; c++) {
      const d = Math.hypot((c + 0.5) / VOX - BOW_R, (h - 1 - r + 0.5) / VOX);
      const band = Math.floor(((BOW_R - d) * VOX) / 2);
      line += band >= 0 && band < Math.min(6, shown) ? String(band) : '.';
    }
    rows.push(line);
  }
  return rows;
}
const BOW_PAL: Record<string, string> = Object.fromEntries(RAINBOW.map((c, i) => [String(i), c]));

/** Der ganze Zugang in ein Raster (für den Bau und für Tests) */
export function voxels(g: GateCtx) {
  const vox = new Vox();
  const list = puffs(g);
  cloud(vox, list, g.cam, g.all);
  const head = list[3];
  if (head) face(vox, head, g);
  const { rb } = phases(g.open);
  if (rb > 0) {
    const [bx, bz] = bowAt(g.cam);
    vox.image(bx, BOW_Y, bz, rainbowRows(Math.ceil(rb * 6)), BOW_PAL, g.cam);
  }
  return vox;
}

export const build: GateBuild = (p, g) => {
  voxels(g).emit(p);
  return [];
};
