// Zugang zur Höhlenwelt in 3D (Entwurf „Welten-Zugänge“, Höhlenmund mit Rollstein): eine geschichtete Felswand mit
// rundem Höhlenmund, Tropfsteinen an der Kante, Moos und Kristallen in den Ritzen. Im Mund steckt ein großer runder
// Rollstein (zu); beim Öffnen wackelt er, rollt in Dritteln nach rechts in seine Nische (je Stoß des Hau-rucks ein
// Drittel, `THIRDS`) und dreht sich dabei sichtbar (Moos und Kristallader wandern mit), dann gehen paarweise von außen
// nach innen Kristall-Lampen an, erst am Mund, dann im Gang (offen). Auf der Felsbrücke über dem
// Mund steht eine leuchtende Kristallgruppe als Wahrzeichen, daneben eine Steinscheibe mit Kristall, die zur Kamera
// schaut. Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
//
// Die großen Felsmassen sind Quader mit Steinkachel (wenige Flächen), alles Feine ist ein Voxel-Raster. Die Quader
// liegen auf Achteln, die Voxel-Flächen rücken um LIFT nach außen: So liegt nichts deckungsgleich (kein Flackern).

import type { Geo } from './mitwachsen-geo';
import { VOX, Vox, ease, hash3, seg, type GateBuild, type GateCtx, type Part, type Parts } from './mitwachsen-gate-kit';
import type { PlateLook } from './mitwachsen-plate';

const FRONT = 0.375; // Vorderseite der Felswand (davor bis 0,5 nur Simse, Moos, Kristalle)
const BACK = -1.625; // Rückseite der Wand über dem Mund
const N_BACK = -3.375; // Rückseite des Felsens um die Nische
const N_WALL = -3.25; // Rückwand der Nische (innen)
const LEFT = -6.375;
const RIGHT = 7;
const MOUTH_R = 2.625; // Halbmesser des Mundbogens
const MOUTH_Y = 2.125; // Mitte des Bogens: Bei |x| = 2,4 ist der Mund noch 3 hoch
const R = 1.875; // Halbmesser des Rollsteins
const R8 = R * VOX;
const STONE_Z = 0.5 - R; // Mitte des Steins: vorn reicht er genau bis an die Bucht
const NICHE_X = 4.375; // Mitte des Steins in der Nische (linker Rand bei 2,5, der Gang bleibt frei)
const NICHE_R = 2; // Halbmesser der Nische
const TRACK = 3.875; // Decke über der Rollbahn zwischen Mund und Nische
const BAND = 0.75; // Höhe einer Gesteinsschicht
const BRIDGE = 5.5; // Oberkante der Felsbrücke über dem Mund (dort steht das Wahrzeichen)
const CROWN_Z = -0.625; // Mitte der Wand in der Tiefe

const BANDS = ['#f0ecfa', '#d6d2e6', '#e6e2f2', '#ccc8de']; // Schichten, zart lila getöntes Grau
const RIM = '#5d596e'; // dunkler Rand um Mund und Nische
const MOSS = '#6f9a4a';
const MOSS_LIGHT = '#86b45a';
const MOSS_TOP = '#a3bf86'; // Oberseite der Wand: bemooster Stein
const KR = ['#b48cf0', '#6fd6f0', '#f08cc8']; // Kristalle: lila, türkis, rosa
const DULL = '#5f5876'; // Kristall-Lampe aus
const LEDGE = '#6c6f7c';
const LEDGE_TOP = '#9599a6';

const floor8 = (v: number) => Math.floor(v * VOX + 1e-6) / VOX;
/** Höhe ohne ganze Zahlen: Dort liegen die Oberseiten des Geländes */
const offGrid = (y: number) => (Number.isInteger(y) ? y + 1 / VOX : y);

/** Oberkante der Felswand bei x: über dem Mund flach (Brücke), nach außen in Stufen tiefer, leicht zerklüftet */
export function wallTop(x: number) {
  const a = Math.abs(x);
  if (a <= 1.25) return BRIDGE;
  const base = a < 3 ? 5.375 : a < 5 ? 4.875 : 4.25;
  return offGrid(base + Math.round((hash3(Math.floor(x * 2), 3, 5) - 0.5) * 4) / VOX);
}

/** Oberkante der Öffnung bei x (0: keine): runder Mund, Rollbahn und Nische rechts daneben */
export function openTop(x: number) {
  let h = 0;
  if (Math.abs(x) < MOUTH_R) h = MOUTH_Y + Math.sqrt(MOUTH_R ** 2 - x ** 2);
  if (x >= 0 && x <= NICHE_X) h = Math.max(h, TRACK);
  const d = x - NICHE_X;
  if (Math.abs(d) < NICHE_R) h = Math.max(h, R + Math.sqrt(NICHE_R ** 2 - d ** 2));
  return floor8(h);
}

/** höchste Stelle des Steins bei x auf seinem ganzen Weg (zu, rollend, in der Nische) */
function stoneTop(x: number) {
  const d = x < 0 ? x : x > NICHE_X ? x - NICHE_X : 0;
  return Math.abs(d) < R ? R + Math.sqrt(R * R - d * d) : 0;
}

/**
 * Öffnungsgrad t, bei dem der Stein zu ist, ein Drittel, zwei Drittel und ganz in der Nische liegt: Jeder Stoß des
 * Hau-rucks (worlds/hoehle/mitwachsen-heave-look.ts, `HEAVE_T`, ein Test hält beide gleich) rollt ihn ein Drittel weiter,
 * jedes Drittel sanft an- und auslaufend. Auf Schritten von `OPEN_STEPS`, in denen die 3D-Ansicht das Torhaus neu baut
 */
export const THIRDS = [0.15, 0.4, 0.6, 0.8] as const;
/**
 * In so vielen Schritten baut die 3D-Ansicht das Höhlentor beim Öffnen neu (`openStep` in mitwachsen-gates-3d.ts; die
 * anderen Tore in Zehnteln): je 0,04, damit nach der Nische (0,8) jeder Schritt genau ein Lampenpaar mehr anzündet
 */
export const OPEN_STEPS = 25;
/** Ab hier gehen die Lampen an, paarweise je `LAMP_STEP` (der Stein liegt schon in der Nische); zwischen den Schritten */
const LAMP_FROM = 0.82;
const LAMP_STEP = 1 / OPEN_STEPS;

/** Wo der Stein beim Öffnen steht: erst wackeln, dann in Dritteln in die Nische rollen */
export function stoneX(t: number) {
  const wobble = Math.sin(seg(t, 0, 0.15) * Math.PI * 2) * 0.0625;
  const k = t < THIRDS[1] ? 0 : t < THIRDS[2] ? 1 : 2;
  const [a, b] = [THIRDS[k] ?? 0, THIRDS[k + 1] ?? 1];
  return wobble + ((k + ease(seg(t, a, b))) / 3) * NICHE_X;
}

// ---------- Fels aus Quadern ----------

/** Fels von y0 bis y1, in Schichten getönt; `mossy` legt Moos auf die Oberseite */
function rock(g: Geo, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mossy: boolean) {
  let a = y0;
  while (a < y1 - 1e-6) {
    const band = Math.floor(a / BAND + 1e-6);
    const b = Math.min(y1, (band + 1) * BAND);
    const tint = BANDS[band % BANDS.length] ?? '#b0b0b0';
    const top = mossy && b >= y1;
    g.box(x0, a, z0, x1 - x0, b - a, z1 - z0, tint, top ? MOSS_TOP : tint, 'stone');
    a = b;
  }
}

/** eine Spalte (1/8 breit) der Wand: was bei x über, neben und hinter der Öffnung steht */
type Column = { open: number; top: number; z0: number; bay: boolean };
const BAY = [-3.125, -2.625] as const; // Bucht im Fuß der linken Wand: dorthin kullert das Geröll
function column(i: number): Column {
  const x = (i + 0.5) / VOX;
  const open = x > -MOUTH_R && x < NICHE_X + NICHE_R ? openTop(x) : 0;
  return { open, top: wallTop(x), z0: x > 2.5 ? N_BACK : BACK, bay: x > BAY[0] && x < BAY[1] };
}

/** Quader einer Reihe gleicher Spalten von x0 bis x1 */
function columnBoxes(g: Geo, c: Column, x0: number, x1: number) {
  if (c.bay) {
    rock(g, x0, x1, 0.625, c.top, c.z0, FRONT, true);
    rock(g, x0, x1, 0, 0.625, c.z0, -1.125, false);
    rock(g, x0, x1, 0, 0.625, -0.125, FRONT, false);
  } else if (c.open > 0) {
    g.box(x0, c.open, c.z0, x1 - x0, 1 / VOX, FRONT - c.z0, RIM, RIM, 'stone');
    rock(g, x0, x1, c.open + 1 / VOX, c.top, c.z0, FRONT, true);
    if (c.z0 < BACK) rock(g, x0, x1, 0, c.open, N_BACK, N_WALL, false); // Rückwand der Nische
  } else rock(g, x0, x1, 0, c.top, c.z0, FRONT, true);
}

/** die Felswand: Spalten zu 1/8, gleiche nebeneinander als ein Quader */
function wall(g: Geo) {
  const [i0, i1] = [Math.round(LEFT * VOX), Math.round(RIGHT * VOX)];
  let start = i0;
  let cur = column(i0);
  for (let i = i0 + 1; i <= i1; i++) {
    const c = i < i1 ? column(i) : null;
    if (c && c.open === cur.open && c.top === cur.top && c.z0 === cur.z0 && c.bay === cur.bay) continue;
    columnBoxes(g, cur, start / VOX, i / VOX);
    if (!c) break;
    [start, cur] = [i, c];
  }
}

// ---------- Feines aus Voxeln ----------

const K_FACE = Math.round(FRONT * VOX); // Voxel-Reihe vor der Wand (z 0,375 … 0,5)

/** liegt (x, y) auf der Vorderseite der Wand (nicht in der Öffnung, nicht über der Kante)? */
function onFace(x: number, y: number, margin = 0.25) {
  if (x < LEFT + margin || x > RIGHT - margin || y > wallTop(x) - margin) return false;
  const o = x > -MOUTH_R && x < NICHE_X + NICHE_R ? openTop(x) : 0;
  return o === 0 || y > o + margin;
}

/** Simse an den Schichtgrenzen, mit Lücken */
function ledges(v: Vox) {
  for (let b = BAND; b < 5.5; b += BAND) {
    const j = Math.round(b * VOX);
    for (let i = LEFT * VOX; i < RIGHT * VOX; i++) {
      const x = (i + 0.5) / VOX;
      if (onFace(x, b, 0.3) && hash3(i >> 2, j, 9) > 0.15) v.set(i, j, K_FACE, LEDGE, 'solid', LEDGE_TOP);
    }
  }
}

/** Moos hängt in Fransen über die Oberkante */
function moss(v: Vox) {
  for (let i = LEFT * VOX; i < RIGHT * VOX; i++) {
    const x = (i + 0.5) / VOX;
    const h = hash3(i, 7, 3);
    if (h < 0.2) continue;
    const top = Math.round(wallTop(x) * VOX);
    const len = Math.floor(hash3(i, 8, 3) * 4);
    for (let n = 1; n <= len + 1; n++) v.set(i, top - n, K_FACE, n === len + 1 || h > 0.7 ? MOSS_LIGHT : MOSS);
  }
}

/** Kristalle in Ritzen: dunkler Riss, darin ein leuchtender Kristall */
const CRACKS: readonly [number, number, number][] = [
  [-5.25, 1.25, 0],
  [-4.25, 3.25, 1],
  [-5.625, 3.5, 2],
  [-3.375, 4.375, 0],
  [-1.75, 5.0, 1],
  [1.375, 4.875, 2],
  [3.875, 4.375, 0],
  [5.5, 4.25, 1],
  [6.625, 0.875, 2],
];
function cracks(v: Vox) {
  for (const [x, y, ci] of CRACKS) {
    if (!onFace(x, y, 0.2)) continue;
    const [i, j] = [Math.round(x * VOX), Math.round(y * VOX)];
    const c = KR[ci] ?? '#b48cf0';
    for (const [a, b] of [
      [-2, -1],
      [-1, -1],
      [2, 2],
      [3, 2],
      [3, 3],
    ] as const)
      v.set(i + a, j + b, K_FACE, '#4a4658');
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ] as const)
      v.set(i + a, j + b, K_FACE, a === 1 && b === 2 ? '#ffffff' : c, 'bright');
  }
}

/** Tropfsteine an der Mundkante: nie tiefer als der Stein auf seinem Weg, über dem Gang nie unter 3 */
const STAL: readonly [number, number][] = [
  [-2.25, 0.375],
  [-1.875, 0.5],
  [-1.375, 0.625],
  [-0.875, 0.75],
  [-0.375, 0.625],
  [0.125, 0.75],
  [0.625, 0.5],
  [1.125, 0.625],
  [1.625, 0.375],
];
function stalactites(v: Vox) {
  for (const [x, len] of STAL) {
    const i = Math.round(x * VOX);
    const top = Math.min(openTop(i / VOX + 0.06), openTop(i / VOX + 0.19));
    const lowest = Math.max(Math.abs(x) <= 2.5 ? 3 : 0, stoneTop(x - 0.25), stoneTop(x + 0.25)) + 0.125;
    const n = Math.floor(Math.min(len, top - lowest) * VOX + 1e-6);
    const kt = Math.round(top * VOX);
    for (let s = 1; s <= n; s++)
      for (const k of [1, 2]) {
        v.set(i, kt - s, k, s === n ? '#d6d4de' : '#a6a3b4');
        if (s <= n / 2) v.set(i + 1, kt - s, k, '#8e8b9e');
      }
  }
}

/** Farne am Fuß der Wand */
const FERN = ['Z...Z', '.Z.Z.', 'ZzZzZ', '.zZz.', '..z..'];
function ferns(v: Vox) {
  const pal = { Z: '#6fae45', z: '#4e8a3a' };
  for (const x of [-5.75, -3.75, 6.6875]) v.image(x, 0, FRONT, FERN, pal, [0, 1], 'solid');
}

// ---------- der Rollstein ----------

/** Farbe eines Punkts der Steinhülle in Stein-Koordinaten (dreht sich mit): Moos oben, Kristalladern, Flecken */
function stonePaint(lx: number, ly: number, lz: number): [string, Part] {
  const q = (a: number, f: number) => Math.floor((a + 1) * f);
  if (ly > 0.6 + (hash3(q(lx, 6), q(lz, 6), 1) - 0.5) * 0.25)
    return [hash3(q(lx, 12), q(ly, 12), q(lz, 12)) < 0.4 ? MOSS_LIGHT : MOSS, 'solid'];
  if (Math.abs(0.75 * lx + 0.55 * ly - 0.3 + 0.06 * Math.sin(lz * 9)) < 0.075 && lz > -0.3 && ly < 0.45)
    return ['#b48cf0', 'bright'];
  if (Math.abs(0.85 * lx - 0.45 * ly + 0.6) < 0.065 && lz > 0 && ly < 0.2) return ['#6fd6f0', 'bright'];
  if (hash3(q(lx, 5), q(ly, 5), q(lz, 5)) < 0.22) return ['#86839a', 'solid'];
  if (hash3(q(lx, 12), q(ly, 12), q(lz, 12) + 40) < 0.14) return ['#c4c1d2', 'solid'];
  return ['#a5a2b5', 'solid'];
}

/** Hülle des Steins; die Rückseite (von der Kamera weg) bleibt weg, die sieht man nie */
function stone(v: Vox, t: number, cam: readonly [number, number]) {
  const x = stoneX(t);
  const [ci, ck] = [Math.round(x * VOX), Math.round(STONE_Z * VOX)];
  const phi = ci / VOX / R; // rollt nach rechts: dreht sich im Uhrzeigersinn
  const [c, s] = [Math.cos(phi), Math.sin(phi)];
  const view = [cam[0] * 0.6, 0.8, cam[1] * 0.6] as const;
  for (let k = -R8; k < R8; k++)
    for (let j = -R8; j < R8; j++)
      for (let i = -R8; i < R8; i++) {
        const [dx, dy, dz] = [i + 0.5, j + 0.5, k + 0.5];
        const d = Math.hypot(dx, dy, dz);
        if (d > R8 || d < R8 - 1.7) continue;
        if ((dx * view[0] + dy * view[1] + dz * view[2]) / d < -0.25) continue;
        const [color, part] = stonePaint((c * dx - s * dy) / d, (s * dx + c * dy) / d, dz / d);
        v.set(ci + i, R8 + j, ck + k, color, part);
      }
}

/** ein Kiesel aus Voxeln */
function pebble(v: Vox, x: number, y: number, z: number, r: number) {
  v.blob(x, y, z, r, r * 0.8, r, (i, j, k) => (hash3(i, j, k) < 0.3 ? '#7f7c90' : '#9693a6'), 'solid', 0.3);
}

/** Geröll in den Lücken neben dem Stein: links kullert es beim Öffnen in die Bucht, rechts schiebt es der Stein vor sich her */
const GRAVEL_L: readonly [number, number, number, number][] = [
  [-2.25, 0.22, -0.1, 0.24],
  [-2.05, 0.18, 0.15, 0.2],
  [-2.3, 0.55, 0.05, 0.18],
  [-2.15, 0.2, -0.55, 0.22],
];
const GRAVEL_R: readonly [number, number, number, number][] = [
  [2.2, 0.22, -0.05, 0.24],
  [2.0, 0.18, 0.2, 0.2],
  [2.25, 0.55, 0.1, 0.18],
  [2.1, 0.2, -0.6, 0.22],
];
function gravel(v: Vox, t: number) {
  const away = ease(seg(t, 0.02, 0.2));
  GRAVEL_L.forEach(([x, y, z, r], n) =>
    pebble(v, x + (-2.875 - x) * away, y * (1 - away) + r * 0.8 * away, z + (-0.625 + n * 0.12 - z) * away, r),
  );
  const pushed = Math.max(0, stoneX(t));
  for (const [x, y, z, r] of GRAVEL_R) pebble(v, Math.min(x + pushed, 6.25 - r), y, z, r);
}

// ---------- Licht und Wahrzeichen ----------

/** Kristall-Lampe am Mund (an der Wand, Bild nach vorn) */
const LAMP = ['..d..', '.ddd.', 'dmWmd', 'dmmmd', 'dnmnd', '.ddd.'];
/** Kristall-Lampe im Gang: ein schmaler leuchtender Kristall dicht an der Wand, frei vom Durchgang */
function post(v: Vox, i: number, k: number, on: boolean, c: string) {
  for (let j = 0; j < 5; j++)
    for (const kk of [k, k + 1]) v.set(i, j, kk, on ? (j === 4 ? '#ffffff' : c) : DULL, on ? 'bright' : 'solid');
}
/** Lampen gehen paarweise an, wenn der Stein in der Nische liegt: von außen nach innen, erst am Mund, dann in den Gang hinein */
export const lampOn = (t: number, n: number) => t >= LAMP_FROM + n * LAMP_STEP;
function lamps(v: Vox, t: number) {
  const on = (n: number) => lampOn(t, n);
  for (let n = 0; n < 4; n++) {
    // links x −2,625 … −2,5, rechts 2,5 … 2,625; vorn im Mund bis hinten in den Gang
    post(v, -21, -n * 6, on(n + 1), KR[n % 2] ?? '#b48cf0');
    post(v, 20, -n * 6, on(n + 1), KR[(n + 1) % 2] ?? '#6fd6f0');
  }
  for (const [x, n] of [
    [-3.75, 0],
    [6.6875, 0],
  ] as const) {
    const lit = on(n);
    const glow = lit
      ? { m: KR[x < 0 ? 0 : 2] ?? '#b48cf0', n: '#6fd6f0', W: '#ffffff' }
      : { m: DULL, n: DULL, W: DULL };
    v.image(x, 1.5, FRONT, LAMP, { d: '#3a3846' }, [0, 1], 'solid');
    v.image(x, 1.5, FRONT, LAMP, glow, [0, 1], lit ? 'bright' : 'solid');
  }
}

/** Wahrzeichen: Kristallgruppe auf der Felsbrücke (dx, dz, Breite, Stufen, Neigung x, Neigung z, Farbe) */
const CROWN: readonly [number, number, number, number, number, number, number][] = [
  [0, 0, 0.5, 9, 0, 0, 0],
  [-0.5, 0.125, 0.375, 7, -1, 0, 1],
  [0.5, -0.125, 0.375, 8, 1, 0, 2],
  [0.125, 0.375, 0.375, 6, 0, 1, 1],
  [-0.125, -0.5, 0.375, 6, 0, -1, 2],
  [-0.625, -0.375, 0.25, 4, -1, -1, 0],
  [0.625, 0.375, 0.25, 4, 1, 1, 0],
  [-0.5, 0.5, 0.25, 4, -1, 1, 2],
  [0.5, -0.5, 0.25, 3, 1, -1, 1],
];
const SOCKEL = 0.25;
/** schräger Kristall aus Stufen (je 1/4 hoch, je Stufe 1/8 versetzt), oben spitz und hell */
function crystal(v: Vox, x: number, z: number, y0: number, w: number, n: number, sx: number, sz: number, c: string) {
  for (let s = 0; s < n; s++) {
    const ww = Math.max(1, Math.round(w * VOX) - Math.max(0, s - n + 3) * 2);
    const i0 = Math.round(x * VOX) + sx * s - Math.floor(ww / 2);
    const k0 = Math.round(z * VOX) + sz * s - Math.floor(ww / 2);
    const color = s === n - 1 ? '#ffffff' : c;
    for (let j = 0; j < 2; j++)
      for (let a = 0; a < ww; a++) for (let b = 0; b < ww; b++) v.set(i0 + a, y0 + s * 2 + j, k0 + b, color, 'bright');
  }
}
function crown(g: Geo, v: Vox) {
  g.box(-1.125, BRIDGE, -1.5, 2.25, SOCKEL, 1.75, '#9d99b0', '#d8d4ea', 'cave', 'cave');
  const y0 = Math.round((BRIDGE + SOCKEL) * VOX);
  for (const [dx, dz, w, n, sx, sz, ci] of CROWN) crystal(v, dx, CROWN_Z + dz, y0, w, n, sx, sz, KR[ci] ?? '#b48cf0');
}

/** Steinscheibe mit Kristall, schaut zur Kamera; liegt der Zugang hinten, spricht die Wand selbst */
const SIGN = [
  '...ooooo...',
  '.ooCCCCCoo.',
  '.oCCCWCCCo.',
  'oCCCWmhCCCo',
  'oCCWmmhhCCo',
  'oCCWmmhhCCo',
  'oCCnmmhhCCo',
  'oCCCnmhCCCo',
  '.oCCCnCCCo.',
  '.ooCCCCCoo.',
  '...ooooo...',
];
function sign(v: Vox, cam: readonly [number, number]) {
  if (cam[0] === 0 && cam[1] === 1) return;
  const [x, z] = [cam[0] * 1.25, CROWN_Z + cam[1] * 1];
  v.image(x, BRIDGE, z, SIGN, { o: '#3a3846', C: '#6a6680' }, cam, 'solid');
  v.image(x, BRIDGE, z, SIGN, { W: '#ffffff', m: '#b48cf0', h: '#a07cff', n: '#6fd6f0' }, cam, 'bright');
}

/** Alles aus Voxeln für einen Zustand; die Felsquader legt `build` selbst an */
export function hoehleVox(g: GateCtx): Vox {
  const v = new Vox();
  ledges(v);
  moss(v);
  cracks(v);
  stalactites(v);
  ferns(v);
  stone(v, g.open, g.cam);
  gravel(v, g.open);
  lamps(v, g.open);
  sign(v, g.cam);
  return v;
}

export const build: GateBuild = (p: Parts, g) => {
  wall(p.solid);
  const v = hoehleVox(g);
  crown(p.solid, v);
  v.emit(p);
  return [];
};

/** Torplatte vor dem Zugang (mitwachsen-plate-3d.ts, Zeichen in Farben aus `PALETTE`): Schienenende: zwei Schienen auf Schwellen, am Ende ein Prellbock mit Kristall-Lampe */
const RAIL = 'TTVVVVVVVVVVVVVVV';
const SLEEPERS = 'Th.t..t..t..t..t.';
export const plate: PlateLook = { face: [RIM, LEDGE], mark: [RAIL, SLEEPERS, SLEEPERS, RAIL] };
