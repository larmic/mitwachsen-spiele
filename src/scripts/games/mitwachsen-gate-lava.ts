// Zugang zur Lavaberge in 3D (Entwurf „Welten-Zugänge“, Idee B): erkaltender Glutbach unter einem Glutbaum.
// Säulenbasalt zu beiden Seiten, zur Gasse hin abgestuft; quer durch die Torreihe fließt ein Glutbach in seiner Rinne.
// Beim Öffnen erkaltet er Feld für Feld von außen zur Mitte zu dunklem Stein mit glimmenden Fugen, über den man geht.
// Hinter der Torreihe neben dem Gang steht ein großer Glutbaum als Wahrzeichen (leuchtende Krone wie eine Laterne,
// nichts brennt), an ihm das Flammenzeichen der Welt als Schild zur Kamera.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import { Vox, VOX, ease, hash3, seg, type GateBuild, type GateCtx, type Part } from './mitwachsen-gate-kit';

/* ---------- Farben ---------- */
const RIM = '#2a2b30'; // Rand der Rinne, Querfugen im Basalt
const SIDE = ['#4a4c56', '#50525c', '#565964'] as const; // Säulen, je Säule etwas anders
const DECK = '#8a8c98'; // Säulen-Deckel
const LAVA = ['#ff7a1a', '#ff8a2a', '#ff6a14'] as const;
const BUBBLE = '#ffd34d';
const COOL = '#b8380a'; // Glut kurz vor dem Erkalten
const STONE = ['#3e4048', '#45474f'] as const; // erkalteter Stein
const FUGE = '#ff7a1a';
const BARK = '#3b2a22';
const BARK_TOP = '#4a3529';

/** Farbe zwischen a und b (#rrggbb), t 0 … 1 */
function mix(a: string, b: string, t: number) {
  const ch = (c: string, k: number) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
  const v = [0, 1, 2].map((k) => Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * t));
  return `#${v.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Ein voller Körper (Säulen, Stamm, Krone), von dem nur die Hülle ins Raster kommt: Voxel, an denen ein Nachbar
 * fehlt. Innen sieht man ohnehin nichts, so bleibt der Zugang unter der Voxel-Grenze. Unter dem Boden (j < 0) gilt
 * als voll.
 */
class Mass {
  private cells = new Map<string, { c: string; top?: string }>();
  add(i: number, j: number, k: number, c: string, top?: string) {
    this.cells.set(`${i},${j},${k}`, { c, top });
  }
  private full(i: number, j: number, k: number) {
    return j < 0 || this.cells.has(`${i},${j},${k}`);
  }
  private inner(i: number, j: number, k: number) {
    return (
      this.full(i + 1, j, k) &&
      this.full(i - 1, j, k) &&
      this.full(i, j + 1, k) &&
      this.full(i, j - 1, k) &&
      this.full(i, j, k + 1) &&
      this.full(i, j, k - 1)
    );
  }
  emit(vox: Vox, part: Part, paint?: (i: number, j: number, k: number, c: string) => string) {
    for (const [at, v] of this.cells) {
      const [i, j, k] = at.split(',').map(Number) as [number, number, number];
      if (!this.inner(i, j, k)) vox.set(i, j, k, paint ? paint(i, j, k, v.c) : v.c, part, v.top);
    }
  }
}

/* ---------- Säulenbasalt ---------- */
type Column = { ci: number; r: number; x0: number; x1: number; z0: number; z1: number; y0: number; y1: number };

/**
 * Höhe der Säulen je Spalte (0 an der Gasse … 2 außen) und Reihe (0 vorn … 2 hinten, die hinterste nur an der Gasse):
 * zur Gasse und nach vorn hin abgestuft
 */
const HEIGHT = [
  [1.5, 2.25, 2.75],
  [2, 2.5],
  [2.25, 2.75],
] as const;

/** Säulen einer Flanke (side −1 links, 1 rechts) */
function columns(side: number): Column[] {
  const out: Column[] = [];
  for (let ci = 0; ci < 3; ci++)
    for (let r = 0; r < (HEIGHT[ci]?.length ?? 0); r++) {
      const a = 2.5 + 0.75 * ci;
      const [x0, x1] = side < 0 ? [-a - 0.75, -a] : [a, a + 0.75];
      const back = ci === 1 ? 0.375 : ci === 0 && r > 0 ? 0.25 : 0; // versetzt wie echter Säulenbasalt
      const bridge = ci === 0 && r === 0; // über dem Bach: eine Säule auf dem Rand der Rinne
      const z1 = 0.5 - back - 0.75 * r;
      const z0 = z1 - (bridge ? 1 : 0.75);
      const h = (HEIGHT[ci]?.[r] ?? 2) + Math.round(hash3(ci, r, side + 5) * 2) / 8;
      out.push({ ci, r, x0, x1, z0, z1, y0: bridge ? 0.375 : 0, y1: h });
    }
  return out;
}

/** Eine Säule mit gekappten Ecken (sechseckig wirkend) in die Masse */
function column(m: Mass, c: Column, seed: number) {
  const r = (v: number) => Math.round(v * VOX);
  const [i0, i1, k0, k1, j0, j1] = [r(c.x0), r(c.x1), r(c.z0), r(c.z1), r(c.y0), r(c.y1)];
  const side = SIDE[Math.floor(hash3(seed, 1, 7) * SIDE.length)] ?? SIDE[0];
  for (let i = i0; i < i1; i++)
    for (let k = k0; k < k1; k++) {
      if ((i === i0 || i === i1 - 1) && (k === k0 || k === k1 - 1)) continue; // Ecke
      for (let j = j0; j < j1; j++) m.add(i, j, k, side, DECK);
    }
}

/** Beide Flanken: Säulen, vorn mit Querfugen; die Brückensäulen stehen auf Pfosten über dem Bach */
function basalt(vox: Vox) {
  const m = new Mass();
  const joints: { j: number; k: number; i0: number; i1: number }[] = [];
  [-1, 1].forEach((side) =>
    columns(side).forEach((c, n) => {
      column(m, c, n + side * 11);
      // Pfosten vorn und hinten auf dem Rand der Rinne
      if (c.y0 > 0)
        for (const k of [-4, -3, 2, 3]) for (const i of side < 0 ? [-26, -21] : [20, 25]) m.add(i, 2, k, RIM, RIM);
      // Querfugen vorn auf den vorderen Säulen, wie bei echtem Säulenbasalt
      if (c.r < 2)
        for (let q = 0; q < 2; q++) {
          const y = c.y0 + 0.5 + hash3(c.ci, c.r, q + side * 3) * (c.y1 - c.y0 - 0.9);
          const i0 = Math.round(c.x0 * VOX) + 1;
          joints.push({ j: Math.round(y * VOX), k: Math.round(c.z1 * VOX) - 1, i0, i1: i0 + 4 });
        }
    }),
  );
  const joint = (i: number, j: number, k: number) =>
    joints.some((f) => f.j === j && f.k === k && i >= f.i0 && i < f.i1);
  m.emit(vox, 'solid', (i, j, k, c) => (joint(i, j, k) ? RIM : c));
}

/* ---------- Glutbach ---------- */
/** Erkalten eines Torfelds (cell −2 … 2): von außen zur Mitte, 0 … 1 */
const cooling = (cell: number, open: number) => {
  const st = 0.3 * (2 - Math.abs(cell));
  return seg(open, st, st + 0.4);
};

/** Rinne quer durch die Torreihe: Rand vorn und hinten, darin Glut oder erkalteter Stein */
function stream(vox: Vox, open: number) {
  // Rand x −3,25 … 3,25, zwei Voxel hoch; an den Enden ein Basaltstein
  for (let i = -26; i < 26; i++)
    for (const k of [-4, -3, 2, 3]) for (let j = 0; j < 2; j++) vox.set(i, j, k, RIM, 'solid');
  for (const i of [-28, -27, 26, 27]) for (let k = -4; k < 4; k++) vox.set(i, 0, k, SIDE[1], 'solid', DECK);
  for (let i = -26; i < 26; i++) {
    const cell = Math.round((i + 0.5) / VOX); // Torfeld, in dem der Voxel liegt
    const under = i < -20 || i >= 20; // unter den Brückensäulen glüht der Bach immer
    const p = under ? 0 : cooling(cell, open);
    for (let k = -2; k < 2; k++) streamVoxel(vox, i, k, p, cell);
  }
}

/** Ein Voxel der Rinne je nach Erkalten p: Glut, dunkler werdende Glut, dann Stein (erst flach, dann eben mit dem Rand) */
function streamVoxel(vox: Vox, i: number, k: number, p: number, cell: number) {
  if (p < 0.25) {
    const h = hash3(i, k, 3);
    vox.set(i, 0, k, LAVA[Math.floor(h * LAVA.length)] ?? LAVA[0], 'bright');
    if (h > 0.93 && k > -2 && k < 1) vox.set(i, 1, k, BUBBLE, 'bright'); // Bläschen
    return;
  }
  if (p < 0.6) {
    vox.set(i, 0, k, mix(LAVA[0], COOL, seg(p, 0.25, 0.55)), 'bright');
    return;
  }
  // je Torfeld zwei Platten, dazwischen glimmende Fugen
  const fuge = ((i % 4) + 4) % 4 === 0;
  const stone = STONE[(cell + 8) % 2] ?? STONE[0];
  vox.set(i, 0, k, fuge ? FUGE : stone, fuge ? 'bright' : 'solid');
  if (p >= 0.8 && !fuge) vox.set(i, 1, k, stone, 'solid');
}

/* ---------- Glutbaum ---------- */
type Tree = { x: number; z: number; h: number; k: number };
/**
 * Lage des Baums: dicht hinter der Torreihe neben dem Gang (Stamm bei |x| ≥ 2,75, die Krone erst ab 4 Feldern Höhe).
 * Die Kamera dreht sich nie, ein Zugang sieht sie also immer aus derselben Richtung: Liegt er hinten, steht der Baum
 * links (rechts oben im Bild liegt die Karte), sonst rechts, wo ihn die Kamera ganz im Bild hat.
 */
export const treeAt = (cam: readonly [number, number]): Tree => ({
  x: cam[1] > 0 ? -3 : 3,
  z: -0.875,
  h: 4.625,
  k: 1.5,
});
const CROWN = [
  // dx, dz, dy, rx, rz, ry (wie im Entwurf, mal k)
  [0, 0, 0.36, 0.66, 0.66, 0.48],
  [0.06, -0.04, 0.86, 0.5, 0.5, 0.38],
  [-0.03, 0.02, 1.22, 0.3, 0.3, 0.24],
] as const;

/** Stamm: dunkel, mit einem Glutriss im Zickzack auf allen vier Seiten */
function trunk(vox: Vox, t: Tree, lit: number) {
  const [ci, ck] = [Math.round(t.x * VOX), Math.round(t.z * VOX)];
  const m = new Mass();
  for (let j = 0; j < t.h * VOX; j++)
    for (let i = ci - 2; i < ci + 2; i++) for (let k = ck - 2; k < ck + 2; k++) m.add(i, j, k, BARK, BARK_TOP);
  // Wurzelfüße
  m.add(ci - 3, 0, ck + 1, BARK);
  m.add(ci + 2, 0, ck - 1, BARK);
  m.add(ci, 0, ck + 2, BARK);
  m.emit(vox, 'solid');
  const crack = mix('#c8601a', '#ff8a2a', lit);
  for (let j = 6; j < 32; j++) {
    const u = j < 14 || j >= 24 ? -1 : 0; // Zickzack: welche Spalte der Seite
    vox.set(ci + u, j, ck + 1, crack, 'bright');
    vox.set(ci + u, j, ck - 2, crack, 'bright');
    vox.set(ci - 2, j, ck + u, crack, 'bright');
    vox.set(ci + 1, j, ck + u, crack, 'bright');
  }
}

/** Krone aus drei runden Ballen, leuchtet von innen (heller, sobald der Weg frei ist) */
function crown(vox: Vox, t: Tree, lit: number) {
  const base = mix('#d9772e', '#ff9a3c', lit),
    top = mix('#eea040', '#ffc24d', lit),
    under = mix('#b8562a', '#d9702e', lit);
  const m = new Mass();
  CROWN.forEach(([dx, dz, dy, rx, rz, ry], b) => {
    const [cx, cy, cz] = [t.x + dx * t.k, t.h + dy * t.k, t.z + dz * t.k];
    const [ax, ay, az] = [rx * t.k, ry * t.k, rz * t.k];
    for (let j = Math.floor((cy - ay) * VOX); j <= Math.ceil((cy + ay) * VOX); j++)
      for (let k = Math.floor((cz - az) * VOX); k <= Math.ceil((cz + az) * VOX); k++)
        for (let i = Math.floor((cx - ax) * VOX); i <= Math.ceil((cx + ax) * VOX); i++) {
          const [x, y, z] = [(i + 0.5) / VOX, (j + 0.5) / VOX, (k + 0.5) / VOX];
          const d = ((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2 + ((z - cz) / az) ** 2;
          if (d > 1 + (hash3(i, j, k) - 0.5) * 0.1) continue;
          m.add(i, j, k, b === 0 && y < cy - ay * 0.45 ? under : y > cy + ay * 0.3 ? top : base);
        }
  });
  m.emit(vox, 'bright', (i, j, k, c) => (hash3(i, j, k + 31) < 0.08 ? '#ffe08a' : c));
}

/* ---------- Weltzeichen: Flamme auf runder Basaltplakette, schaut zur Kamera ---------- */
const FLAME = [
  '...oooooo...',
  '..oddddddo..',
  '.oddddrdddo.',
  'oddddrrddddo',
  'odddrrrdrddo',
  'oddrrRrrrddo',
  'oddrRRRrrddo',
  'odrrRYYRrrdo',
  'odrRYYYYRrdo',
  '.odrRYYRrdo.',
  '..oddddddo..',
  '...oooooo...',
];

function sign(vox: Vox, t: Tree, cam: readonly [number, number]) {
  const d = 1.125; // vor dem Stamm und vor der Krone
  const [x, z] = [t.x + cam[0] * d, t.z + cam[1] * d];
  vox.image(x, 3.375, z, FLAME, { o: '#6b6f78', d: RIM }, cam, 'solid', 2);
  vox.image(x, 3.375, z, FLAME, { r: '#ff7a1a', R: '#ff9a3c', Y: '#ffe08a' }, cam, 'bright', 2);
}

/** Alle Voxel des Zugangs in einem Raster (auch für Tests) */
export function voxels(g: GateCtx): Vox {
  const vox = new Vox();
  const lit = 0.75 + 0.25 * ease(seg(g.open, 0.7, 1));
  basalt(vox);
  stream(vox, g.open);
  const tree = treeAt(g.cam);
  trunk(vox, tree, lit);
  crown(vox, tree, lit);
  sign(vox, tree, g.cam);
  return vox;
}

export const build: GateBuild = (p, g) => {
  voxels(g).emit(p);
  return [];
};
