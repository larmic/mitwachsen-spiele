// Portal-Plattformen von Mitwachsen: Form, Farben und Bild je Welt als Voxel-Raster.
// Eine flache, achteckige Plattform aus 3 × 3 Feldern, die man von allen vier Seiten betritt. Im Raster ist sie
// 9 × 9 Voxel groß (ein Voxel ist ein Drittel Feld). Lage 0 ist der Sockel mit dem Gold-Rahmen um das Mittelfeld,
// darüber liegen das Bild der Welt auf dem Mittelfeld und niedrige Zierde auf den vier Eckfeldern.
// Die Seitenmitten bleiben frei: Dort steigt man auf. Entwurf: Artefakt „Portal-Plattformen“ (docs/games/mitwachsen.md).
// Spezifikation: docs/specs/mitwachsen.md

import type { GateTheme } from './mitwachsen';

/** Voxel je Feld und Raster der Plattform */
export const SUB = 3;
export const GRID = SUB * 3;

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
};
/** Gold der Plattform (Aktionsfarbe): oben Gold, an den Seiten die dunkle Kante, hell im Lauflicht */
export const GOLD = { top: '#f0a531', side: '#b46a0c', light: '#ffd47e' } as const;

/** Diese Zeichen leuchten aus sich selbst, sobald die Plattform wach ist */
const GLOW = new Set('GWejyuvrRhmnkLF123456');

const EMPTY = '.........';
const NONE = [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];

/** Je Welt drei Lagen zu 9 Zeilen (Norden oben); `.` ist leer */
export const PLATFORMS: Record<GateTheme, readonly (readonly string[])[]> = {
  // Eisscholle: Schneekante, klares Eis, Eisspitzen in den Ecken; Bild: Schneeflocke
  eis: [
    [
      '..sssss..',
      '.siiiiis.',
      'siGGGGGis',
      'siGeeeGis',
      'siGeeeGis',
      'siGeeeGis',
      'siGGGGGis',
      '.siiiiis.',
      '..sssss..',
    ],
    [EMPTY, '.j.....j.', EMPTY, '...WeW...', '...eWe...', '...WeW...', EMPTY, '.j.....j.', EMPTY],
    [EMPTY, '.j.....j.', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, '.j.....j.', EMPTY],
  ],
  // Sandsteinstufe: Mini-Pyramiden mit glühender Spitze; Bild: Stufenpyramide mit blauen Ecken
  sand: [
    [
      '..AAAAA..',
      '.AaaaaaA.',
      'AaGGGGGaA',
      'AaGyyyGaA',
      'AaGyyyGaA',
      'AaGyyyGaA',
      'AaGGGGGaA',
      '.AaaaaaA.',
      '..AAAAA..',
    ],
    [EMPTY, '.a.....a.', EMPTY, '...bWb...', '...yyy...', '...yyy...', EMPTY, '.a.....a.', EMPTY],
    [EMPTY, '.y.....y.', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, '.y.....y.', EMPTY],
  ],
  // Brunnenrand: Wellensteine, Muscheln über Kreuz; Bild: Wassertropfen
  wasser: [
    [
      '..qqqqq..',
      '.qvvvvvq.',
      'qvGGGGGvq',
      'qvGuuuGvq',
      'qvGuuuGvq',
      'qvGuuuGvq',
      'qvGGGGGvq',
      '.qvvvvvq.',
      '..qqqqq..',
    ],
    [EMPTY, '.p.....P.', EMPTY, '...uWu...', '...WWW...', '...WWW...', EMPTY, '.P.....p.', EMPTY],
    NONE,
  ],
  // Glutstein: kühler Basalt, Glutrisse über die Zugänge zur Mitte, runde Glutsteine; Bild: freundliche Flamme
  lava: [
    [
      '..xxrxx..',
      '.XXXrXXX.',
      'xXGGGGGXx',
      'xXGRRRGXx',
      'rrGRRRGrr',
      'xXGRRRGXx',
      'xXGGGGGXx',
      '.XXXrXXX.',
      '..xxrxx..',
    ],
    [EMPTY, '.X.....X.', EMPTY, '...xrx...', '...rRr...', '...rRr...', EMPTY, '.X.....X.', EMPTY],
    [EMPTY, '.r.....r.', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, '.r.....r.', EMPTY],
  ],
  // Kristallnest: dunkle Schale, Kristallsäulen in den Ecken; Bild: Kristall-Raute
  hoehle: [
    [
      '..ccccc..',
      '.cCCCCCc.',
      'cCGGGGGCc',
      'cCGhhhGCc',
      'cCGhhhGCc',
      'cCGhhhGCc',
      'cCGGGGGCc',
      '.cCCCCCc.',
      '..ccccc..',
    ],
    [EMPTY, '.m.....n.', EMPTY, '...chc...', '...hnh...', '...chc...', EMPTY, '.k.....m.', EMPTY],
    [EMPTY, '.m.....n.', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, '.k.....m.', EMPTY],
  ],
  // Baumstumpf: Rinde außen, Jahresringe innen, Moos und Farn in den Ecken; Bild: Blatt
  wald: [
    [
      '..TTTTT..',
      '.TtttttT.',
      'TtGGGGGtT',
      'TtGLLLGtT',
      'TtGLLLGtT',
      'TtGLLLGtT',
      'TtGGGGGtT',
      '.TtttttT.',
      '..TTTTT..',
    ],
    [EMPTY, '.z.....z.', EMPTY, '...tLz...', '...LzL...', '...zLt...', EMPTY, '.z.....z.', EMPTY],
    [EMPTY, '.Z.....Z.', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, '.Z.....Z.', EMPTY],
  ],
  // Wolkenkissen: Wolkenbällchen mit bunten Knöpfen; Bild: Regenbogen über einer Wolke
  wolken: [
    [
      '..DDDDD..',
      '.DdddddD.',
      'DdGGGGGdD',
      'DdGWWWGdD',
      'DdGWWWGdD',
      'DdGWWWGdD',
      'DdGGGGGdD',
      '.DdddddD.',
      '..DDDDD..',
    ],
    [EMPTY, '.d.....d.', EMPTY, '...234...', '...1W5...', '...WWW...', EMPTY, '.d.....d.', EMPTY],
    [EMPTY, '.1.....3.', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, '.5.....6.', EMPTY],
  ],
  // Pilzteller: lila Moos, Mini-Pilze in den Ecken; Bild: Fliegenpilz
  pilze: [
    [
      '..MMMMM..',
      '.MSSSSSM.',
      'MSGGGGGSM',
      'MSGFFFGSM',
      'MSGFFFGSM',
      'MSGFFFGSM',
      'MSGGGGGSM',
      '.MSSSSSM.',
      '..MMMMM..',
    ],
    [EMPTY, '.N.....N.', EMPTY, '...BWB...', '...HBH...', '...FMF...', EMPTY, '.N.....N.', EMPTY],
    [EMPTY, '.B.....U.', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, '.o.....B.', EMPTY],
  ],
};

/**
 * Rolle eines Voxels: `socket` Sockel, `frame` Gold-Rahmen um die Mitte, `access` äußere Voxel der vier Zugänge
 * (nach der Ankunft golden), `core` Sockel unter dem Bild, `picture` Bild der Welt auf dem Mittelfeld, `deco` Zierde
 * auf den Eckfeldern
 */
export type VoxelRole = 'socket' | 'frame' | 'access' | 'core' | 'picture' | 'deco';
/** Ein Voxel: Spalte x (Westen → Osten) und Zeile z (Norden → Süden) im 9 × 9-Raster, Lage, Farbe, leuchtet es? */
export type PlatformVoxel = { x: number; z: number; layer: number; color: string; glow: boolean; role: VoxelRole };

/** Höhe der Lagen über dem Boden (in Feldern): Sockel, Bild bzw. Zierde unten, Zierde oben */
export const SOCKET_TOP = 0.25; // Rand der Plattform: Hier steht die Figur
export const CENTRE_TOP = 0.4; // Mittelfeld mit dem Bild
const DECO_LAYER = 0.3;

/** Unter- und Oberkante eines Voxels */
export function voxelSpan(v: Pick<PlatformVoxel, 'layer' | 'role'>): [number, number] {
  if (v.layer === 0) return [0, SOCKET_TOP];
  if (v.role === 'picture') return [SOCKET_TOP, CENTRE_TOP];
  const y0 = SOCKET_TOP + (v.layer - 1) * DECO_LAYER;
  return [y0, y0 + DECO_LAYER];
}

const inCentre = (x: number, z: number) => x >= SUB && x < 2 * SUB && z >= SUB && z < 2 * SUB;
const inFrame = (x: number, z: number) =>
  x >= SUB - 1 && x <= 2 * SUB && z >= SUB - 1 && z <= 2 * SUB && !inCentre(x, z);
/** Äußere Voxel der Seitenmitten: dort, wo man auf die Plattform steigt */
const isAccess = (x: number, z: number) =>
  ((z === 0 || z === GRID - 1) && x >= SUB && x < 2 * SUB) || ((x === 0 || x === GRID - 1) && z >= SUB && z < 2 * SUB);

function roleOf(x: number, z: number, layer: number): VoxelRole {
  if (layer > 0) return inCentre(x, z) ? 'picture' : 'deco';
  if (inCentre(x, z)) return 'core';
  if (inFrame(x, z)) return 'frame';
  return isAccess(x, z) ? 'access' : 'socket';
}

/** Alle Voxel der Plattform einer Welt, wach (Farben wie im Entwurf) */
export function platformVoxels(theme: GateTheme): PlatformVoxel[] {
  const out: PlatformVoxel[] = [];
  PLATFORMS[theme].forEach((rows, layer) =>
    rows.forEach((row, z) => {
      for (let x = 0; x < GRID; x++) {
        const ch = row[x] ?? '.';
        const color = PALETTE[ch];
        if (!color) continue;
        out.push({ x, z, layer, color, glow: GLOW.has(ch), role: roleOf(x, z, layer) });
      }
    }),
  );
  return out;
}

/** Farbe des Sockels um das Mittelfeld: So sieht der Rahmen aus, wenn kein Gold darauf liegt */
export function frameOffColor(theme: GateTheme): string {
  return PALETTE[PLATFORMS[theme][0]?.[1]?.[4] ?? 'Q'] ?? PALETTE.Q!;
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
 * Schlafende Plattform in ihrer Welt: alles matt, das Bild nur eingeritzt, kein Gold (der Rahmen hat die
 * Sockelfarbe), die Zierde in den Ecken steht da, leuchtet aber nicht
 */
export function sleepingVoxels(theme: GateTheme): PlatformVoxel[] {
  const off = frameOffColor(theme);
  return platformVoxels(theme).map((v) => ({
    ...v,
    glow: false,
    color:
      v.role === 'picture' || v.role === 'core'
        ? GREY.engraved
        : v.role === 'frame'
          ? off
          : v.glow
            ? dim(v.color)
            : v.color,
  }));
}

/**
 * Schlafendes Gegenstück am Bett: ein leerer grauer Sockel aus Lichtungsstein, für alle Welten gleich. Kein Bild,
 * keine Zierde der Welt; nur die erhöhte Mitte und je ein niedriger Eckstein zeigen, wo man steht und wo nicht.
 * So verrät er nicht, zu welcher Welt er gehört.
 */
export function emptySocketVoxels(): PlatformVoxel[] {
  const base = PLATFORMS.eis[0]!; // die Form ist bei allen Welten gleich
  const has = (x: number, z: number) => (base[z]?.[x] ?? '.') !== '.';
  const out: PlatformVoxel[] = [];
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++) {
      if (!has(x, z)) continue;
      const edge = !has(x - 1, z) || !has(x + 1, z) || !has(x, z - 1) || !has(x, z + 1);
      out.push({ x, z, layer: 0, color: edge ? GREY.edge : GREY.inner, glow: false, role: roleOf(x, z, 0) });
      if (inCentre(x, z)) out.push({ x, z, layer: 1, color: GREY.edge, glow: false, role: 'picture' });
    }
  for (const [x, z] of [
    [1, 1],
    [GRID - 2, 1],
    [1, GRID - 2],
    [GRID - 2, GRID - 2],
  ] as const)
    out.push({ x, z, layer: 1, color: GREY.edge, glow: false, role: 'deco' });
  return out;
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
 * die Mitte) oder wach nach der Ankunft (Gold auf den Zugängen). Gold-Voxel haben `gold: true`.
 */
export type PlatformLook = 'asleep' | 'ready' | 'arrived';
export function platformLook(
  theme: GateTheme,
  side: 'gate' | 'home',
  look: PlatformLook,
): (PlatformVoxel & { gold?: true })[] {
  if (look === 'asleep') return side === 'gate' ? sleepingVoxels(theme) : emptySocketVoxels();
  const off = frameOffColor(theme);
  const goldRole = look === 'ready' ? 'frame' : 'access';
  return platformVoxels(theme).map((v) =>
    v.role === goldRole
      ? { ...v, color: GOLD.top, glow: true, gold: true }
      : v.role === 'frame'
        ? { ...v, color: off, glow: false }
        : v,
  );
}
