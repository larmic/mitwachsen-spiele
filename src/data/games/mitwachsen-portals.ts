// Portal-Plattformen von Mitwachsen: Form, Farben und Bild je Welt als Voxel.
// Eine flache Platte mit runden Ecken aus 3 × 3 Feldern, ganz begehbar, von allen Seiten zu betreten. Ein Voxel ist
// 1/8 Feld groß und 1/8 Feld hoch, so groß wie ein Pixel der Bodentexturen. Der Sockel ist zwei Lagen hoch (0,25),
// sein äußerster Ring nur eine (eine kleine Schwelle). Auf dem Mittelfeld liegt eine Lage höher das Bild der Welt
// (8 × 8 Pixel), eng darum der Gold-Rahmen mit dunkler Kante. Die Zierde steht klein in der äußersten Spitze der
// Ecken, höchstens drei Lagen hoch, und hält niemanden auf. Nach der Ankunft zeigen goldene Pfeile in den vier
// Seitenfeldern nach außen. Entwurf: Artefakt „Portal-Plattformen“ (docs/games/mitwachsen.md).
// Spezifikation: docs/specs/mitwachsen.md

import type { GateTheme } from './mitwachsen';

/** Voxel je Feld und Raster der Plattform */
export const SUB = 8;
export const GRID = SUB * 3;
/** Höhe einer Lage (in Feldern) */
export const LAYER = 1 / SUB;

/** Farben der Zeichen in den Rastern */
const PALETTE: Record<string, string> = {
  '1': '#e8504a',
  '2': '#f39a3d',
  '3': '#f2d14b',
  '4': '#6dbd47',
  '5': '#5aa6e8',
  '6': '#8a6bd6',
  G: '#f0a531', // Gold-Rahmen (GOLD.top)
  W: '#ffffff',
  K: '#6b6f78', // eingeritzt (schlafend)
  Q: '#8f949b', // Lichtungsstein
  V: '#a8adb3',
  s: '#f4f8fb',
  i: '#bfe6f5',
  e: '#9fe3ff',
  j: '#e8f8ff',
  A: '#d1b273',
  a: '#e2c78e',
  y: '#ffd98a',
  b: '#2f6fb8',
  q: '#a9c9ea',
  v: '#7fc8ff',
  u: '#4fb3ff',
  p: '#f4a7b9',
  P: '#ffd7a8',
  x: '#3a3b42',
  X: '#50525c',
  r: '#ff7a1a',
  R: '#ffd34d',
  c: '#3c3f47',
  C: '#5a5f70',
  h: '#a07cff',
  m: '#b48cf0',
  n: '#6fd6f0',
  k: '#f08cc8',
  T: '#5d3e21',
  t: '#93683f',
  L: '#7fdc6a',
  z: '#3f9a3c',
  Z: '#5ab651',
  D: '#e6eef7',
  d: '#fbfdff',
  M: '#efe4d2',
  N: '#f7efe2',
  S: '#8a76cc',
  B: '#d9473a',
  H: '#c8323a',
  F: '#e08cff',
  U: '#4f7fd9',
  o: '#e0a03a',
  w: '#b07d4c', // helle Jahresringe
};
/** Gold der Plattform (Aktionsfarbe): oben Gold, an den Seiten die dunkle Kante, hell im Lauflicht */
export const GOLD = { top: '#f0a531', side: '#b46a0c', light: '#ffd47e' } as const;

/** Diese Zeichen leuchten aus sich selbst, sobald die Plattform wach ist */
const GLOW = new Set('GWejyuvrRhmnkLF123456');

/**
 * Aussehen einer Welt: Material des Rands (`edge`) und der Fläche (`surf`), gestreute helle Körner (`speck`), das Bild
 * auf dem Mittelfeld (8 × 8, Norden oben) und die Zierde einer Ecke als [nach innen x, nach innen z, Lage über dem
 * Sockel, Zeichen]; `*` nimmt je Ecke eine eigene Farbe aus `corners` (Nordwest, Nordost, Südwest, Südost)
 */
type Look = {
  edge: string;
  surf: string;
  speck?: string;
  picture: readonly string[];
  deco: readonly (readonly [number, number, number, string])[];
  corners?: readonly [string, string, string, string];
};

export const LOOKS: Record<GateTheme, Look> = {
  // Eisscholle: Schneekante, klares Eis mit Glitzer, Eisspitzen; Bild: Schneeflocke
  eis: {
    edge: 's',
    surf: 'i',
    speck: 'j',
    picture: ['eeeWWeee', 'eWeWWeWe', 'eeWWWWee', 'WWWeeWWW', 'WWWeeWWW', 'eeWWWWee', 'eWeWWeWe', 'eeeWWeee'],
    deco: [
      [0, 0, 0, 'j'],
      [0, 0, 1, 'j'],
      [0, 0, 2, 'W'],
      [1, 0, 0, 'e'],
      [0, 1, 0, 'e'],
    ],
  },
  // Sandsteinstufe: Mini-Pyramide mit glühender Spitze; Bild: Stufenpyramide mit blauen Ecken
  sand: {
    edge: 'A',
    surf: 'a',
    speck: 'A',
    picture: ['yyyyyyyy', 'yyyWWyyy', 'yyybbyyy', 'yybAAbyy', 'yyAAAAyy', 'ybAAAAby', 'yAAAAAAy', 'yyyyyyyy'],
    deco: [
      [0, 0, 0, 'A'],
      [1, 0, 0, 'A'],
      [0, 1, 0, 'A'],
      [1, 1, 0, 'A'],
      [0, 0, 1, 'a'],
      [0, 0, 2, 'y'],
    ],
  },
  // Brunnenrand: Wellensteine, Muscheln; Bild: Wassertropfen
  wasser: {
    edge: 'q',
    surf: 'v',
    speck: 'W',
    picture: ['uuuWWuuu', 'uuuWWuuu', 'uuWWWWuu', 'uWWWWWWu', 'uWqWWWWu', 'uWWqWWWu', 'uuWWWWuu', 'uuuuuuuu'],
    deco: [
      [0, 0, 0, 'p'],
      [1, 0, 0, 'p'],
      [0, 1, 0, 'p'],
      [1, 1, 0, 'P'],
    ],
  },
  // Glutstein: kühler Basalt, Glutrisse vom Rand zur Mitte, die vor dem Gold enden; runde Glutsteine; Bild: Flamme
  lava: {
    edge: 'x',
    surf: 'X',
    picture: ['xxxrxxxx', 'xxrrxxxx', 'xxrrrxrx', 'xrrRrrrx', 'xrRRRrrx', 'xrRRRRrx', 'xxrRRrxx', 'xxxxxxxx'],
    deco: [
      [0, 0, 0, 'x'],
      [1, 0, 0, 'x'],
      [0, 1, 0, 'x'],
      [1, 1, 0, 'x'],
      [0, 0, 1, 'r'],
      [1, 0, 1, 'r'],
      [0, 1, 1, 'r'],
      [0, 0, 2, 'R'],
    ],
  },
  // Kristallnest: dunkle Schale, Kristalle in drei Farben; Bild: Kristall
  hoehle: {
    edge: 'c',
    surf: 'C',
    speck: 'n',
    picture: ['cccnhccc', 'ccnhhhcc', 'cnhhhmhc', 'cnhhmhhc', 'cnhhhmhc', 'ccnhhhcc', 'cccnhccc', 'cccccccc'],
    deco: [
      [0, 0, 0, '*'],
      [0, 0, 1, '*'],
      [0, 0, 2, '*'],
      [1, 0, 0, '*'],
      [1, 1, 0, 'n'],
    ],
    corners: ['h', 'n', 'k', 'm'],
  },
  // Baumstumpf: Rinde außen, Jahresringe innen, Moos und Farn; Bild: Blatt
  wald: {
    edge: 'T',
    surf: 't',
    picture: ['tttttLLL', 'tttLLLLL', 'ttLLLLzL', 'tLLLLzLL', 'tLLLzLLt', 'tLLzLLtt', 'tLzLLttt', 'zztttttt'],
    deco: [
      [0, 0, 0, 'z'],
      [1, 0, 0, 'Z'],
      [0, 1, 0, 'Z'],
      [1, 1, 0, 'z'],
      [0, 0, 1, 'L'],
      [1, 0, 1, 'z'],
    ],
  },
  // Wolkenkissen: Wolkenbällchen mit bunten Knöpfen; Bild: Regenbogen über einer Wolke
  wolken: {
    edge: 'D',
    surf: 'd',
    picture: ['qq1111qq', 'q122221q', '12333321', '23444432', '345qq543', '45WWWW54', '5WWWWWW5', 'qWWWWWWq'],
    deco: [
      [0, 0, 0, 'd'],
      [1, 0, 0, 'd'],
      [0, 1, 0, 'd'],
      [1, 1, 0, 'd'],
      [0, 0, 1, 'd'],
      [0, 1, 1, 'd'],
      [1, 0, 1, '*'],
    ],
    corners: ['1', '3', '5', '6'],
  },
  // Pilzteller: heller Rand, Ring aus lila Moos; Mini-Pilze; Bild: Fliegenpilz
  pilze: {
    edge: 'M',
    surf: 'N',
    speck: 'S',
    picture: ['FFBBBBFF', 'FBWBBWBF', 'BBBBBBBB', 'BWBBBWBB', 'FFFNNFFF', 'FFFNNFFF', 'FFNNNNFF', 'FFFFFFFF'],
    deco: [
      [0, 0, 0, 'N'],
      [0, 0, 1, '*'],
      [1, 0, 1, '*'],
      [0, 1, 1, '*'],
      [1, 1, 1, '*'],
    ],
    corners: ['B', 'U', 'o', 'B'],
  },
};

/** Goldener Pfeil nach der Ankunft in einem Seitenfeld (8 × 8, zeigt nach unten = nach außen); `o` dunkle Kante */
const ARROW = ['........', '........', '.o....o.', 'oGo..oGo', 'oGGooGGo', '.oGGGGo.', '..oGGo..', '...oo...'];

/**
 * Rolle eines Voxels: `socket` Sockel, `frame` Gold-Rahmen um die Mitte, `access` goldener Pfeil in einem Seitenfeld
 * (nach der Ankunft), `accessEdge` seine dunkle Kante, `core` Sockel unter dem Bild, `picture` Bild der Welt auf dem
 * Mittelfeld, `deco` Zierde in den Ecken
 */
export type VoxelRole = 'socket' | 'frame' | 'access' | 'accessEdge' | 'core' | 'picture' | 'deco';
/** Ein Voxel: Spalte x (Westen → Osten) und Zeile z (Norden → Süden) im Raster, Lage, Farbe, leuchtet es? */
export type PlatformVoxel = { x: number; z: number; layer: number; color: string; glow: boolean; role: VoxelRole };

/** Höhe über dem Boden (in Feldern): Sockel, auf dem die Figur steht, und Mittelfeld mit dem Bild */
export const SOCKET_TOP = 2 * LAYER;
export const CENTRE_TOP = 3 * LAYER;

/** Unter- und Oberkante eines Voxels */
export const voxelSpan = (v: Pick<PlatformVoxel, 'layer'>): [number, number] => [
  v.layer * LAYER,
  (v.layer + 1) * LAYER,
];

const inCentre = (x: number, z: number) => x >= SUB && x < 2 * SUB && z >= SUB && z < 2 * SUB;
const inBox = (x: number, z: number, d: number) => x >= SUB - d && x < 2 * SUB + d && z >= SUB - d && z < 2 * SUB + d;
const inFrame = (x: number, z: number) => inBox(x, z, 1) && !inCentre(x, z);
const inFrameEdge = (x: number, z: number) => inBox(x, z, 2) && !inBox(x, z, 1);

/** Platte mit runden Ecken (Radius 0,6 Feld): Abstand der Voxelmitte zur Kante nach innen (in Feldern), < 0 außen */
const ROUND = 0.6;
export function inset(x: number, z: number): number {
  const u = (x + 0.5) / SUB,
    v = (z + 0.5) / SUB;
  const corner = (u < ROUND || u > 3 - ROUND) && (v < ROUND || v > 3 - ROUND);
  if (!corner) return Math.min(u, v, 3 - u, 3 - v);
  const cu = Math.min(Math.max(u, ROUND), 3 - ROUND),
    cv = Math.min(Math.max(v, ROUND), 3 - ROUND);
  return ROUND - Math.hypot(u - cu, v - cv);
}
const BAND = 0.22; // Breite des Rands im Material `edge`

/** Kleiner, fester Zufall je Voxel (für die gestreuten Körner) */
function grain(x: number, z: number, salt: number): number {
  let h = (x * 374761393 + z * 668265263 + salt * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Zeichen der Oberfläche an einem Voxel des Sockels */
function surface(theme: GateTheme, x: number, z: number, d: number): string {
  const look = LOOKS[theme];
  const u = (x + 0.5) / SUB,
    v = (z + 0.5) / SUB;
  switch (theme) {
    case 'lava': {
      if (d < BAND) return 'x';
      // Glutrisse auf den Achsen, zwei Voxel breit; sie enden ein Stück vor dem Gold
      const axis = Math.abs(u - 1.5) < 1 / SUB || Math.abs(v - 1.5) < 1 / SUB;
      return axis && !inBox(x, z, 4) ? 'r' : 'X';
    }
    case 'wald':
      if (d < 0.17) return 'T';
      return Math.floor(Math.hypot(u - 1.5, v - 1.5) / 0.19) % 2 ? 'w' : 't';
    case 'pilze':
      if (d < BAND) return 'M';
      if (d < 0.42) return 'S';
      return 'N';
    default:
      if (d < BAND) return look.edge;
      return look.speck && grain(x, z, theme.length) < 0.06 ? look.speck : look.surf;
  }
}

/** Seitenfeld, in dem ein Voxel liegt, und seine Lage im Pfeil-Muster (Zeile zeigt nach außen) */
function arrowAt(x: number, z: number): string {
  const fx = Math.floor(x / SUB),
    fz = Math.floor(z / SUB),
    a = x % SUB,
    b = z % SUB;
  const r = SUB - 1;
  const [col, row] =
    fx === 1 && fz === 2
      ? [a, b]
      : fx === 1 && fz === 0
        ? [a, r - b]
        : fx === 2 && fz === 1
          ? [b, a]
          : fx === 0 && fz === 1
            ? [b, r - a]
            : [-1, -1];
  return ARROW[row]?.[col] ?? '.';
}

const color = (ch: string) => PALETTE[ch] ?? PALETTE.Q!;
const voxel = (x: number, z: number, layer: number, ch: string, role: VoxelRole): PlatformVoxel => ({
  x,
  z,
  layer,
  color: color(ch),
  glow: GLOW.has(ch),
  role,
});

/** Farbe abdunkeln (Faktor 0 … 1) */
export function darken(c: string, f: number): string {
  const n = parseInt(c.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * f);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}
const EDGE_DARK = 0.62; // dunkle Kante neben dem Gold

/**
 * Alle Voxel der Plattform einer Welt, wach, in ihrem Material: Rahmen und Pfeile haben hier noch ihre Sockelfarbe;
 * Gold legt erst `platformLook` darauf. Die dunkle Kante außen um den Rahmen gehört fest zum Sockel.
 */
export function platformVoxels(theme: GateTheme): PlatformVoxel[] {
  const look = LOOKS[theme];
  const out: PlatformVoxel[] = [];
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++) {
      const d = inset(x, z);
      if (d < 0) continue;
      const top = d < LAYER ? 1 : 2; // äußerster Ring eine Lage tiefer: eine kleine Schwelle
      const ch = surface(theme, x, z, d);
      const arrow = arrowAt(x, z);
      const role: VoxelRole = inCentre(x, z)
        ? 'core'
        : inFrame(x, z)
          ? 'frame'
          : arrow === 'G'
            ? 'access'
            : arrow === 'o'
              ? 'accessEdge'
              : 'socket';
      for (let layer = 0; layer < top; layer++) {
        const v = voxel(x, z, layer, ch, role);
        if (inFrameEdge(x, z)) out.push({ ...v, color: darken(v.color, EDGE_DARK), glow: false });
        else out.push(v);
      }
      if (inCentre(x, z)) {
        const p = look.picture[z - SUB]?.[x - SUB] ?? '.';
        out.push(voxel(x, z, 2, p, 'picture'));
      }
    }
  // Zierde: klein in der äußersten Spitze jeder Ecke, gespiegelt nach innen
  const tip = 2;
  (
    [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const
  ).forEach(([sx, sz], i) => {
    const bx = sx > 0 ? tip : GRID - 1 - tip,
      bz = sz > 0 ? tip : GRID - 1 - tip;
    for (const [dx, dz, dl, ch] of look.deco)
      out.push(voxel(bx + dx * sx, bz + dz * sz, 2 + dl, ch === '*' ? (look.corners?.[i] ?? 'W') : ch, 'deco'));
  });
  return out;
}

const GREY = { edge: PALETTE.Q!, inner: PALETTE.V!, engraved: PALETTE.K! };

/** Farbe halb zum eingeritzten Grau hin: so matt sieht eine schlafende Plattform in ihrer Welt aus */
export function dim(color: string): string {
  const a = parseInt(color.slice(1), 16),
    b = parseInt(GREY.engraved.slice(1), 16);
  const mix = (shift: number) => Math.round((((a >> shift) & 255) + ((b >> shift) & 255)) / 2);
  return `#${((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, '0')}`;
}

/**
 * Schlafende Plattform in ihrer Welt: alles matt, das Bild nur grau eingeritzt (sein Grund matt), kein Gold, die
 * Zierde steht da, leuchtet aber nicht
 */
export function sleepingVoxels(theme: GateTheme): PlatformVoxel[] {
  const ground = color(LOOKS[theme].picture[0]![0]!);
  return platformVoxels(theme).map((v) => ({
    ...v,
    glow: false,
    color: v.role === 'picture' ? (v.color === ground ? dim(v.color) : GREY.engraved) : v.glow ? dim(v.color) : v.color,
  }));
}

/**
 * Schlafendes Gegenstück am Bett: ein leerer grauer Sockel aus Lichtungsstein, für alle Welten gleich. Kein Bild,
 * keine Zierde; nur die erhöhte Mitte zeigt, wo man reist. So verrät er nicht, zu welcher Welt er gehört.
 */
export function emptySocketVoxels(): PlatformVoxel[] {
  return platformVoxels('eis')
    .filter((v) => v.role !== 'deco')
    .map((v) => ({
      ...v,
      glow: false,
      color: v.role === 'picture' || inset(v.x, v.z) < BAND ? GREY.edge : GREY.inner,
    }));
}

/** Die Plätze des Gold-Rahmens im Kreis (für das Lauflicht), im Uhrzeigersinn ab Nordwesten */
export const FRAME_RING: readonly (readonly [number, number])[] = (() => {
  const a = SUB - 1,
    b = 2 * SUB;
  const ring: [number, number][] = [];
  for (let x = a; x < b; x++) ring.push([x, a]);
  for (let z = a; z < b; z++) ring.push([b, z]);
  for (let x = b; x > a; x--) ring.push([x, b]);
  for (let z = b; z > a; z--) ring.push([a, z]);
  return ring;
})();

/**
 * Wie eine Plattform gerade aussieht: schlafend (am Tor matt, am Bett leerer Sockel), wach und bereit (Gold-Rahmen um
 * die Mitte) oder wach nach der Ankunft (goldene Pfeile mit dunkler Kante in den Seitenfeldern). Gold-Voxel haben
 * `gold: true`.
 */
export type PlatformLook = 'asleep' | 'ready' | 'arrived';
export function platformLook(
  theme: GateTheme,
  side: 'gate' | 'home',
  look: PlatformLook,
): (PlatformVoxel & { gold?: true })[] {
  if (look === 'asleep') return side === 'gate' ? sleepingVoxels(theme) : emptySocketVoxels();
  const gold = look === 'ready' ? 'frame' : 'access';
  return platformVoxels(theme).map((v) =>
    v.role === gold
      ? { ...v, color: GOLD.top, glow: true, gold: true }
      : look === 'arrived' && v.role === 'accessEdge'
        ? { ...v, color: darken(v.color, EDGE_DARK), glow: false }
        : v,
  );
}
