// Zugang zum Pilzwald in 3D (Entwurf „Welten-Zugänge“, Idee a: der Pilzhut, der aufploppt). Zu schläft im Durchgang
// nur der breite rote Hut eines Riesenpilzes, flach wie eine Kuppel, mit geschlossenen Augen und Zzz. Beim Öffnen
// wacht er auf, ploppt auf einem kurzen, dicken Stiel hoch und rückt nach links in die Nische neben dem Weg: Offen
// steht dort ein gedrungener Fliegenpilz mit Gesicht, der Durchgang ist frei. Über dem Ende des Gangs spannt sich ein
// bemooster Felsbogen mit drei dicken bunten Hüten (Wahrzeichen), daneben ein Schild mit Fliegenpilz zur Kamera.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
//
// Jeder Pilz bleibt breit und gedrungen: Der Hut ist in jeder Lage und jedem Öffnungsgrad viel breiter, als der Stiel
// hoch ist (nie ein langer Stiel mit Kopf).

import { VOX, Vox, ease, hash3, seg, type GateBuild, type GateCtx } from './mitwachsen-gate-kit';

type Cam = GateCtx['cam'];
/** Farbe eines Voxels: fest (Zeichenkette) oder selbst leuchtend; null bleibt leer */
type Paint = string | { c: string; glow: true } | null;
type Shape = (x: number, y: number, z: number, i: number, j: number, k: number) => Paint;

const P = {
  stiel: '#efe4d2',
  rille: '#e4d7bf',
  rot: '#d9473a',
  rotSeite: '#c8323a',
  tupf: '#ffffff',
  lamelle: '#c9a8f0',
  lamelle2: '#b48fe0',
  auge: '#3a2a4a',
  wange: '#f2a0c8',
  moos: '#8a76cc',
  moosDunkel: '#7462b4',
  moosHell: '#a594e3',
  leuchtMoos: '#e08cff',
  fels: '#8d8798',
  felsDunkel: '#77718a',
  holz: '#8a5a32',
  blau: '#4f7fd9',
  blauDunkel: '#3a63b8',
  orange: '#e0a03a',
  orangeDunkel: '#c88a2a',
  lila: '#d47ff2',
  lilaDunkel: '#b866d8',
};

const BAY_K = 4; // erste Voxel-Reihe der Bucht (z ≥ 0,5): dort baut der Zugang nichts
const HAT_Z = -0.85; // Mitte des roten Huts in der Tiefe: vorn endet er knapp vor der Bucht
const NICHE_X = -4.0; // offen steht der Pilz hier, links neben dem Weg (ganz bei |x| > 2,5)

/** weiches Ende mit kleinem Überschwingen (Plopp) */
const back = (x: number, k = 1.6) => {
  const u = Math.min(1, Math.max(0, x)) - 1;
  return 1 + (k + 1) * u ** 3 + k * u ** 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Körper aus einer Formfunktion (Voxelmitte → Farbe) im Quader [x0, y0, z0, x1, y1, z1]: gesetzt wird nur die Hülle
 * (Voxel mit einem leeren Nachbarn), unter dem Boden zählt als voll. So kostet das Innere keine Voxel. Nichts bei z ≥ 0,5.
 */
function shell(v: Vox, box: readonly number[], f: Shape) {
  const [x0 = 0, y0 = 0, z0 = 0, x1 = 0, y1 = 0, z1 = 0] = box;
  const i0 = Math.floor(x0 * VOX),
    j0 = Math.max(0, Math.floor(y0 * VOX)),
    k0 = Math.floor(z0 * VOX);
  const [ni, nj, nk] = [Math.ceil(x1 * VOX) - i0, Math.ceil(y1 * VOX) - j0, Math.min(Math.ceil(z1 * VOX), BAY_K) - k0];
  const grid: Paint[] = [];
  const at = (i: number, j: number, k: number) => ((k - k0) * nj + (j - j0)) * ni + (i - i0);
  for (let k = k0; k < k0 + nk; k++)
    for (let j = j0; j < j0 + nj; j++)
      for (let i = i0; i < i0 + ni; i++)
        grid[at(i, j, k)] = f((i + 0.5) / VOX, (j + 0.5) / VOX, (k + 0.5) / VOX, i, j, k);
  const inside = (i: number, j: number, k: number) =>
    i >= i0 && i < i0 + ni && j >= j0 && j < j0 + nj && k >= k0 && k < k0 + nk;
  const full = (i: number, j: number, k: number) => j < 0 || (inside(i, j, k) && grid[at(i, j, k)] != null);
  for (let k = k0; k < k0 + nk; k++)
    for (let j = j0; j < j0 + nj; j++)
      for (let i = i0; i < i0 + ni; i++) {
        const p = grid[at(i, j, k)];
        if (!p) continue;
        const around = [full(i + 1, j, k), full(i - 1, j, k), full(i, j + 1, k), full(i, j - 1, k)];
        if (around.every(Boolean) && full(i, j, k + 1) && full(i, j, k - 1)) continue;
        if (typeof p === 'string') v.set(i, j, k, p);
        else v.set(i, j, k, p.c, 'bright');
      }
}

/* ---------- Hut und Stiel ---------- */

/** Hut: Mitte (x, z), Unterkante y, Radien R1 (entlang x) und R2 (entlang z), Höhe H; o 0 Kuppel … 1 Fliegenpilzhut */
type Hat = {
  x: number;
  y: number;
  z: number;
  R1: number;
  R2: number;
  H: number;
  o: number;
  cap: readonly [string, string];
  spot: string;
  lam: readonly [string, string];
  glow: boolean;
};
/** Tupfen auf dem Hut (in Hutradien) */
const SPOTS = [
  [0.02, 0.05, 0.16],
  [0.56, 0.2, 0.14],
  [-0.52, 0.32, 0.14],
  [0.12, 0.66, 0.13],
  [-0.18, -0.58, 0.14],
  [0.58, -0.42, 0.13],
  [-0.7, -0.2, 0.12],
  [0.36, -0.12, 0.1],
  [-0.3, 0.72, 0.11],
] as const;
const spotAt = (p1: number, p2: number) => SPOTS.some(([sx, sy, sr]) => (p1 - sx) ** 2 + (p2 - sy) ** 2 < sr * sr);

function hatPaint(h: Hat, x: number, y: number, z: number, spots = true): Paint {
  const p1 = (x - h.x) / h.R1,
    p2 = (z - h.z) / h.R2,
    w = p1 * p1 + p2 * p2,
    a = y - h.y;
  if (w > 1) return null;
  const top = h.H * lerp(Math.sqrt(1 - w), (1 - w) ** 0.42 * (1 - 0.18 * w * w), h.o);
  const bot = lerp(0, 0.12 + 0.2 * (1 - w), h.o);
  if (a > top || a < bot) return null;
  if (a > top - 0.22 || w > 0.82) return spots && spotAt(p1, p2) ? h.spot : a > top - 0.22 ? h.cap[0] : h.cap[1];
  if (h.o > 0.4 && a < bot + 0.13) {
    const c = Math.floor(((Math.atan2(p2, p1) + Math.PI) / (2 * Math.PI)) * 36) % 2 ? h.lam[0] : h.lam[1];
    return h.glow ? { c, glow: true } : c;
  }
  return h.cap[1];
}

/** Stiel: fassförmig, unten breiter, Mitte (x0, z0), Radius r, von y0 bis y1 */
function stemPaint(x0: number, z0: number, r: number, y0: number, y1: number, x: number, y: number, z: number): Paint {
  if (y < y0 || y > y1) return null;
  const q = (y - y0) / Math.max(0.01, y1 - y0),
    rr = r * (1.12 - 0.18 * q),
    [dx, dz] = [x - x0, z - z0];
  if (dx * dx + dz * dz > rr * rr) return null;
  return Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * 24) % 3 === 0 ? P.rille : P.stiel;
}

/* ---------- Der rote Pilz: schläft als Kuppel, ploppt hoch und rückt in die Nische ---------- */

type Plopp = { hat: Hat; hs: number; rs: number; awake: boolean };
export function plopp(t: number): Plopp {
  const up = back(seg(t, 0.25, 0.5)); // Plopp: der Stiel wächst
  const aside = ease(seg(t, 0.35, 0.75)); // rückt zur Seite
  const o = ease(seg(t, 0.25, 0.55)); // Kuppel → Fliegenpilzhut
  const hs = 0.95 * up; // sichtbare Stielhöhe, höchstens etwa 1 – der Hut ist immer über 3 breit
  const hat: Hat = {
    x: NICHE_X * aside,
    y: hs,
    z: HAT_Z,
    R1: lerp(2.5, 1.45, aside),
    R2: lerp(1.3, 1.25, aside),
    H: lerp(1.2, 0.9, o),
    o,
    cap: [P.rot, P.rotSeite],
    spot: P.tupf,
    lam: [P.lamelle, P.lamelle2],
    glow: t > 0.9,
  };
  return { hat, hs, rs: 0.62, awake: t >= 0.15 };
}

/** kleine Bilder fürs Gesicht (Zeile 0 oben): Augen zu, Augen auf, Lächeln */
const EYE_SHUT = ['x....x', '.xxxx.'];
const EYE_OPEN = ['.ww.', 'wxxw', 'wxxw', '.ww.'];
const SMILE = ['x....x', '.xxxx.'];
const FACE: Record<string, string> = { x: P.auge, w: '#ffffff' };

/** ein Bild auf einer Fläche: Pixel bei Höhe y (Oberkante top) und seitlich u (Mitte cu) */
function stamp(rows: readonly string[], top: number, cu: number, y: number, u: number) {
  const r = Math.floor((top - y) * VOX),
    c = Math.floor((u - cu) * VOX + (rows[0]?.length ?? 0) / 2);
  return FACE[rows[r]?.[c] ?? '.'] ?? null;
}

/** Gesicht auf der Seite, die zur Kamera schaut: erst am Hut (schlafend, dann wach), nach dem Plopp am Stiel */
function facePaint(s: Plopp, cam: Cam, x: number, y: number, z: number): Paint {
  const [dx, dz] = [x - s.hat.x, z - s.hat.z];
  const u = dx * cam[1] - dz * cam[0]; // seitlich aus Sicht der Kamera
  if (dx * cam[0] + dz * cam[1] <= 0) return null;
  if (s.hs < 0.5) {
    const a = y - s.hat.y,
      e = 0.5 * (Math.abs(cam[1]) * s.hat.R1 + Math.abs(cam[0]) * s.hat.R2);
    for (const side of [-1, 1]) {
      const eye = s.awake ? stamp(EYE_OPEN, 0.85, side * e, a, u) : stamp(EYE_SHUT, 0.7, side * e, a, u);
      if (eye) return eye;
      if (Math.abs(u - side * (e + 0.25)) < 0.13 && a > 0.3 && a < 0.45) return P.wange; // rote Bäckchen
    }
    return null;
  }
  const zf = s.hs * 0.62;
  for (const side of [-1, 1]) {
    const eye = stamp(EYE_OPEN, zf + 0.25, side * 0.3, y, u);
    if (eye) return eye;
  }
  return stamp(SMILE, zf - 0.28, 0, y, u);
}

function redShroom(v: Vox, s: Plopp, cam: Cam) {
  const h = s.hat;
  // vorn, wo das Gesicht sitzt, keine Tupfen
  const plain = (x: number, y: number, z: number) =>
    s.hs < 0.5 &&
    y - h.y < 1 &&
    ((x - h.x) * cam[0] + (z - h.z) * cam[1]) / (Math.abs(cam[0]) * h.R1 + Math.abs(cam[1]) * h.R2) > 0.3;
  const box = [h.x - h.R1 - 0.2, 0, h.z - h.R2 - 0.2, h.x + h.R1 + 0.2, h.y + h.H + 0.3, h.z + h.R2 + 0.2];
  shell(v, box, (x, y, z) => {
    const inHat = hatPaint(h, x, y, z, !plain(x, y, z));
    const inStem = s.hs > 0.05 ? stemPaint(h.x, h.z, s.rs, 0, s.hs + 0.4, x, y, z) : null;
    if (!inHat && !inStem) return null;
    return facePaint(s, cam, x, y, z) ?? inHat ?? inStem;
  });
}

/** Zzz steigen über dem schlafenden Hut auf und schauen zur Kamera (seitlich zur Seite weg von der Bucht) */
const ZZZ = ['xxxx', '..x.', '.x..', 'xxxx'];
const ZZZ2 = ['xxxxx', '...x.', '..x..', '.x...', 'xxxxx'];
function snore(v: Vox, cam: Cam) {
  const [rx, rz] = [cam[1], -cam[0]];
  const d = rz > 0 ? -1 : 1; // nie zur Bucht hin
  v.image(rx * d * 1.1, 1.45, HAT_Z + rz * d * 1.1, ZZZ, { x: '#ffffff' }, cam);
  v.image(rx * d * 1.7, 2.05, HAT_Z + rz * d * 1.7, ZZZ2, { x: '#ffffff' }, cam);
}

/* ---------- Felsbogen über dem Ende des Gangs, darauf drei dicke bunte Hüte ---------- */

const ARCH = { x: 3.4, z0: -3.25, z1: -2.5, top: 4.5, foot: 2 };
/** Unterkante des Bogens: im Gang mindestens 3,15 hoch, außen steht er auf dem Felsring */
const archUnder = (x: number) => (Math.abs(x) >= 2.5 ? ARCH.foot : 3.15 + 0.8 * Math.sqrt(1 - (x / 2.5) ** 2));

function arch(v: Vox) {
  shell(v, [-ARCH.x, ARCH.foot, ARCH.z0, ARCH.x, ARCH.top, ARCH.z1], (x, y, _z, i, j, k) => {
    if (y < archUnder(x)) return null;
    const h = hash3(i, j, k);
    if (y > ARCH.top - 1 / 8) return h < 0.15 ? P.moosHell : P.moos;
    if (y > ARCH.top - 3 / 8 && h < 0.6) return P.moos; // Moos hängt über die Kante
    if (h < 0.08) return P.moosHell;
    if (h < 0.25) return P.moosDunkel;
    return h < 0.62 ? P.fels : h < 0.8 ? P.felsDunkel : P.moos;
  });
  // Moosfransen unter dem Bogen, vorn und hinten; der Gang bleibt über 3 frei
  for (let i = -20; i < 20; i++) {
    const under = Math.ceil(archUnder((i + 0.5) / VOX) * VOX - 0.5);
    for (const k of [-26, -21]) {
      if (hash3(i, k, 33) > 0.45) continue;
      const n = 1 + Math.floor(hash3(i, k, 34) * 2);
      for (let j = under - n; j < under; j++) if (j / VOX >= 3.05) v.set(i, j, k, P.moosDunkel);
    }
  }
}

type Look = Pick<Hat, 'cap' | 'spot' | 'lam' | 'glow'>;
/** gedrungener Pilz: Fuß (x, y, z), Hut R breit (Radius), Stiel hs hoch und rs dick, Hut H hoch */
function shroom(v: Vox, x: number, y: number, z: number, size: [number, number, number, number], look: Look) {
  const [R, hs, H, rs] = size;
  const hat: Hat = { x, y: y + hs, z, R1: R, R2: R * 0.88, H, o: 1, ...look };
  shell(
    v,
    [x - R - 0.2, y, z - R - 0.2, x + R + 0.2, y + hs + H + 0.2, z + R + 0.2],
    (px, py, pz) => hatPaint(hat, px, py, pz) ?? stemPaint(x, z, rs, y, y + hs + 0.4, px, py, pz),
  );
}

function crown(v: Vox) {
  const y = ARCH.top;
  const lam = (c: string, d: string) => [c, d] as const;
  shroom(v, -2.45, y, -2.75, [0.85, 0.36, 0.72, 0.3], {
    cap: [P.orange, P.orangeDunkel],
    spot: '#fff1d0',
    lam: lam('#e8c48a', '#d8ac6a'),
    glow: false,
  });
  shroom(v, 2.45, y, -3.05, [0.82, 0.34, 0.7, 0.28], {
    cap: [P.lila, P.lilaDunkel],
    spot: '#f7e2ff',
    lam: lam(P.lamelle, P.lamelle2),
    glow: false,
  });
  shroom(v, 0, y, -2.9, [1.4, 0.8, 1.15, 0.5], {
    cap: [P.blau, P.blauDunkel],
    spot: '#d7e4ff',
    lam: lam('#9fb8f0', '#7f9ee0'),
    glow: true,
  });
}

/* ---------- Schild, kleine Pilze und lila Moos ---------- */

/** Schild: gedrungener Fliegenpilz (Hut 12 breit, Stiel 4 breit und 3 hoch) im Holzrahmen */
const SIGN = [
  '.bbbbbbbbbbbbbb.',
  'bhhhhhrrrrhhhhhb',
  'bhhhrrwwrrrrhhhb',
  'bhhrrrwwrrrrrhhb',
  'bhrrrrrrrrwwrrhb',
  'bhrwwrrrrrwwrrhb',
  'bhrwwrrrrrrrrrhb',
  'bhlllllllllllllb',
  'bhhhhhsssshhhhhb',
  'bhhhhhsssshhhhhb',
  'bmmmmssssssmmmmb',
  '.bbbbbbbbbbbbbb.',
];
const SIGN_PAL = { b: P.holz, h: '#f6efe0', r: P.rot, w: '#ffffff', l: P.lamelle, s: P.stiel, m: P.moos };
function sign(v: Vox, cam: Cam) {
  const [x, z] = [3.5, -0.625]; // 16 breit: auch seitlich gedreht bleibt es vor der Bucht
  v.fill(x - 1 / 8, 0, z - 1 / 8, x + 1 / 8, 5 / 8, z + 1 / 8, P.holz);
  v.image(x, 5 / 8, z, SIGN, SIGN_PAL, cam, 'solid');
}

/** kleiner Pilz aus Voxeln bei (x, z): klein (Hut 4, Stiel 1 hoch) oder groß (Hut 6, Stiel 2 hoch) */
function mini(v: Vox, x: number, z: number, c: string, big: boolean) {
  const [ci, ck] = [Math.round(x * VOX), Math.round(z * VOX)];
  const [sh, r] = big ? [2, 3] : [1, 2];
  const sq = (j: number, n: number, color: string, round = false) => {
    for (let a = -n; a < n; a++)
      for (let b = -n; b < n; b++) {
        const corner = round && (a === -n || a === n - 1) && (b === -n || b === n - 1);
        if (!corner) v.set(ci + a, j, ck + b, color);
      }
  };
  for (let j = 0; j < sh; j++) sq(j, 1, P.stiel);
  sq(sh, r, c, big);
  sq(sh + 1, r - 1, c);
  if (c === P.rot) v.set(ci, sh + 1, ck, P.tupf);
}

/** kleine Pilze dicht hinter dem schlafenden Hut (ducken sich beim Öffnen weg) und am Rand des Gangs */
function smalls(v: Vox, t: number) {
  const duck = 1 - ease(seg(t, 0.55, 0.75));
  const colors = [P.rot, P.blau, P.orange, P.lila];
  if (duck > 0.25)
    for (let n = 0; n < 7; n++) {
      const x = -2.1 + n * 0.7;
      mini(v, x, n % 2 ? -2.3 : -1.95, colors[n % 4] ?? P.rot, duck > 0.6 && n % 3 !== 1);
    }
  const rim: [number, number, string, boolean][] = [
    [-3.05, 0.05, P.orange, true],
    [-2.95, -2.2, P.blau, false],
    [-5.3, -1.9, P.lila, false],
    [3.1, -1.95, P.rot, true],
    [4.15, -1.3, P.orange, false],
    [2.9, -1.1, P.blau, false],
  ];
  for (const [x, z, c, big] of rim) mini(v, x, z, c, big);
}

/** lila Moos auf dem Fels neben dem Durchgang, in Flecken aus 2 × 2 Voxeln, hier und da ein leuchtender Punkt */
function moss(v: Vox) {
  for (let k = -20; k < BAY_K - 1; k++)
    for (let i = -37; i < 37; i++) {
      if (i > -21 && i < 20) continue; // Voxel −21 endet bei x −2,5, Voxel 20 beginnt bei 2,5
      const h = hash3(i >> 1, k >> 1, 5);
      if (h > 0.38) continue;
      if (hash3(i, k, 6) < 0.04) v.set(i, 0, k, P.leuchtMoos, 'bright');
      else v.set(i, 0, k, h < 0.1 ? P.moosHell : h < 0.22 ? P.moosDunkel : P.moos);
    }
}

/** alle Voxel des Zugangs bei Öffnung `g.open` (0 zu … 1 offen) */
export function pilzVox(g: Pick<GateCtx, 'open' | 'cam'>): Vox {
  const t = Math.min(1, Math.max(0, g.open));
  const v = new Vox();
  moss(v);
  smalls(v, t);
  arch(v);
  crown(v);
  sign(v, g.cam);
  redShroom(v, plopp(t), g.cam);
  if (t < 0.15) snore(v, g.cam);
  return v;
}

export const build: GateBuild = (p, g) => {
  pilzVox(g).emit(p);
  return [];
};
