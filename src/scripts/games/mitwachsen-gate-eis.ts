// Zugang zur Eiswelt in 3D (Entwurf „Welten-Zugänge“, Idee a): eine Eisschlucht. Statt Türmen stehen links und rechts
// Gletscherwände, blau und weiß gestreift, oben Schnee; quer darüber liegt ein Bogen aus Eis mit Schneehaube und
// Eiszapfen. Darin bleibt die Doppeltür mit dem Umriss des Pinguins (er öffnet sie, das Ritual lässt die Eiszapfen
// leuchten). Über dem Bogen ragt eine Krone aus Orgelpfeifen aus Eis, ihre Kerne leuchten mit dem Ritual auf; liegt der
// Zugang nicht hinten, zeigt eine Schneeflocke als Schild zur Kamera. Im Boden der Schlucht leuchtet eine Eisrinne.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import { THEME_COLORS } from '../../data/games/mitwachsen';
import { VOX, Vox, hash3, type GateBuild, type Part } from './mitwachsen-gate-kit';
import { ARCH_Y, W, door, icicle } from './mitwachsen-gatehouse';

const SNOW = '#f6f9fc',
  SNOW_SIDE = '#e6eef5',
  CORE = '#e8f8ff',
  LIT = '#9fe3ff',
  ZAPF = '#d4f1ff';
const BAND = ['#5aa6e8', '#9fd6ef', '#bfe6f5'] as const; // Streifen der Gletscherwand: unten dunkel, dann hell im Wechsel

/** Rundung auf das Raster (1/8 Feld) */
const r8 = (v: number) => Math.round(v * VOX);
/** Farbe zwischen a und b (Hex), t 0 … 1 */
function mix(a: string, b: string, t: number) {
  const ch = (c: string, n: number) => parseInt(c.slice(1 + n * 2, 3 + n * 2), 16);
  const v = [0, 1, 2].map((n) => Math.round(ch(a, n) + (ch(b, n) - ch(a, n)) * t));
  return `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

type Paint = (i: number, j: number, k: number, top: number) => readonly [c: string, part: Part, top?: string];
type Body = { i0: number; i1: number; j0: number; j1: number; k0: number; k1: number; paint: Paint };
const NEXT = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

/**
 * Raster mit festen Körpern: Von einem Körper (Gletscherwand, Bogen, Pfeife) kommen nur die Voxel an seiner
 * Oberfläche ins Raster, sein Inneres zählt nur als besetzt (`has`). So entstehen dieselben Flächen wie bei einem
 * vollen Körper, aber mit einem Bruchteil der Voxel. Unter dem Boden (j < 0) ist alles besetzt: Unterseiten fallen weg.
 */
class Ice extends Vox {
  private bodies: Body[] = [];

  /** Körper in Feldkoordinaten anmelden; erst `carve` setzt seine Oberfläche */
  body(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, paint: Paint) {
    const [i0, i1] = [Math.min(r8(x0), r8(x1)), Math.max(r8(x0), r8(x1))];
    const [k0, k1] = [Math.min(r8(z0), r8(z1)), Math.max(r8(z0), r8(z1))];
    this.bodies.push({ i0, i1, j0: r8(y0), j1: r8(y1), k0, k1, paint });
  }

  inside(i: number, j: number, k: number) {
    return j < 0 || this.bodies.some((b) => i >= b.i0 && i < b.i1 && j >= b.j0 && j < b.j1 && k >= b.k0 && k < b.k1);
  }

  override has(i: number, j: number, k: number) {
    return super.has(i, j, k) || this.inside(i, j, k);
  }

  /** Oberflächen aller Körper ins Raster (was ein anderer Körper verdeckt, bleibt leer) */
  carve() {
    for (const b of this.bodies)
      for (let j = b.j0; j < b.j1; j++)
        for (let k = b.k0; k < b.k1; k++) for (let i = b.i0; i < b.i1; i++) this.surface(b, i, j, k);
  }

  /** Voxel (i, j, k) des Körpers `b` setzen, wenn er an seinem Rand liegt und von außen zu sehen ist */
  private surface(b: Body, i: number, j: number, k: number) {
    const edge = i === b.i0 || i === b.i1 - 1 || j === b.j0 || j === b.j1 - 1 || k === b.k0 || k === b.k1 - 1;
    if (!edge || NEXT.every(([a, c, d]) => this.inside(i + a, j + c, k + d))) return;
    const [c, part, top] = b.paint(i, j, k, b.j1);
    this.set(i, j, k, c, part, top);
  }
}

/** Gletscherwand: Streifen je halbes Feld, oben zwei Lagen Schnee */
const glacier: Paint = (_i, j, _k, top) => {
  if (j >= top - 2) return [SNOW_SIDE, 'solid', SNOW];
  const band = Math.floor(j / 4);
  return [band === 0 ? BAND[0] : band % 2 ? BAND[1] : BAND[2], 'solid'];
};
/** Bogen aus Eis: hellblau, dunklere Unterkante, oben Schneehaube */
const archIce: Paint = (_i, j, _k, top) => {
  if (j >= top - 2) return [SNOW_SIDE, 'solid', SNOW];
  return [j === ARCH_J ? '#8ccbe8' : '#9fd6ef', 'solid', ZAPF];
};

const ARCH_J = r8(ARCH_Y) + 1; // Unterseite des Bogens (4,75): knapp über der Tür, die Flügel schwingen darunter frei
const ARCH_BASE = ARCH_J / VOX;
const FRONT = 0.375; // Vorderkante von Bogen und Wänden (die Bucht beginnt bei 0,5)
/** Stufen des Bogens: |x| von, bis, Oberkante samt Schnee, Rückseite */
const ARCH: readonly (readonly [number, number, number, number])[] = [
  [0, 1.5, 6.25, -1.125], // Mitte: trägt die Orgel, reicht weiter nach hinten
  [1.5, 2.5, 6.0, -0.5],
  [2.5, 3.5, 5.75, -0.5],
];
const CROWN_Y = 6.25; // Fuß der Orgelpfeifen
/** Gletscherwände je Seite: |x| von, bis, z von, bis, Höhe – zur Schlucht hin niedriger, außen höher */
const CLIFFS: readonly (readonly [number, number, number, number, number])[] = [
  [W, 4.25, -0.625, FRONT, ARCH_BASE], // vorn neben der Tür, trägt den Bogen
];

/** Gletscherwände links und rechts und der Bogen darüber (als Körper) */
function gorge(v: Ice) {
  for (const s of [-1, 1]) for (const [a, b, z0, z1, h] of CLIFFS) v.body(s * a, 0, z0, s * b, h, z1, glacier);
  for (const [a, b, top, back] of ARCH)
    for (const s of a === 0 ? [1] : [-1, 1]) v.body(a === 0 ? -b : s * a, ARCH_BASE, back, s * b, top, FRONT, archIce);
}

/** Schnee hängt vorn über die Kanten von Wänden und Bogen (feine Tropfen, eine Lage vor der Vorderkante) */
function snowDrips(v: Ice) {
  const k = r8(FRONT);
  const edges: [number, number, number][] = [
    [-4.25, -3.5, ARCH_BASE],
    [3.5, 4.25, ARCH_BASE],
    ...ARCH.flatMap(([a, b, top]): [number, number, number][] =>
      a === 0
        ? [[-b, b, top]]
        : [
            [-b, -a, top],
            [a, b, top],
          ],
    ),
  ];
  for (const [x0, x1, top] of edges)
    for (let i = r8(x0); i < r8(x1); i++) {
      const r = hash3(i, 7, 41);
      if (r < 0.45) v.set(i, r8(top) - 1, k, r < 0.2 ? '#ffffff' : SNOW);
      if (r < 0.2) v.set(i, r8(top) - 2, k, '#ffffff');
    }
}

/** Eiszapfen unter dem Bogen, vor der Tür; bis `lit` leuchten sie nacheinander eisblau (Ritual) */
function icicles(v: Ice, lit: number) {
  const k = r8(FRONT) - 1;
  for (let x = -W + 0.25; x < W - 0.1; x += 0.5) {
    const i = r8(x),
      len = 3 + Math.floor(hash3(i, 3, 9) * 4); // 3 … 6 Voxel lang
    const c = icicle(x, lit);
    for (let d = 1; d <= len; d++) {
      v.set(i, ARCH_J - d, k, c, 'bright');
      if (d <= 2) v.set(i + 1, ARCH_J - d, k, c, 'bright'); // oben zwei Voxel breit
    }
  }
}

/** Orgelpfeifen der Krone: dx, dz, halbe Breite, Höhe über dem Fuß (Mitte hoch, vier Seiten, vier Ecken) */
const PIPES: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0.375, 2.0],
  [0.5, 0, 0.25, 1.5],
  [-0.5, 0, 0.25, 1.5],
  [0, 0.5, 0.25, 1.5],
  [0, -0.5, 0.25, 1.5],
  [0.5, 0.5, 0.125, 0.875],
  [-0.5, 0.5, 0.125, 0.875],
  [0.5, -0.5, 0.125, 0.875],
  [-0.5, -0.5, 0.125, 0.875],
];
const CROWN_Z = -0.375; // Mitte der Krone (so bleibt sie hinter der Vorderkante des Bogens)

/** Pfeife als Körper: Eis mit Reifring, oben eine schmale Spitze; leuchtender Kern auf allen vier Seiten */
function pipe(v: Ice, x: number, z: number, hw: number, h: number, core: string) {
  const top = CROWN_Y + h;
  const [ci, ck, half] = [r8(x), r8(z), r8(hw)];
  const [ring, lo] = [r8(top - 0.375), r8(CROWN_Y + 0.25)];
  v.body(x - hw, CROWN_Y, z - hw, x + hw, top, z + hw, (i, j, k) => {
    if (j === ring) return ['#8ccbe8', 'solid'];
    const onCore = half >= 2 && (Math.abs(i + 0.5 - ci) < 1 || Math.abs(k + 0.5 - ck) < 1);
    if (onCore && j >= lo && j < ring - 1) return [core, 'bright'];
    return ['#5aa6e8', 'solid', ZAPF];
  });
  if (half >= 2)
    v.body(x - hw / 2, top, z - hw / 2, x + hw / 2, top + 0.25, z + hw / 2, () => [ZAPF, 'solid', '#ffffff']);
}

/** Krone aus Orgelpfeifen über dem Bogen; `glow` 0 … 1 lässt die Kerne aufleuchten */
function crown(v: Ice, glow: number) {
  const core = mix(CORE, LIT, glow);
  for (const [dx, dz, hw, h] of PIPES) pipe(v, dx, CROWN_Z + dz, hw, h, core);
}

/** Schneeflocke, das Zeichen der Eiswelt */
const FLOCKE = [
  '.....o.....',
  '..o..o..o..',
  '...oojoo...',
  '..oojjjoo..',
  '...jjWjj...',
  'ooojWWWjooo',
  '...jjWjj...',
  '..oojjjoo..',
  '...oojoo...',
  '..o..o..o..',
  '.....o.....',
];
const FLAKE = ['...j...', '.j.j.j.', '..jjj..', 'jjjWjjj', '..jjj..', '.j.j.j.', '...j...'];

/** Kleine Flocke vorn am Bogen; liegt der Zugang nicht hinten, schaut eine große Flocke als Schild zur Kamera */
function flakes(v: Ice, cam: readonly [number, number]) {
  v.image(0, ARCH_BASE + 0.25, FRONT, FLAKE, { j: CORE, W: '#ffffff' }, [0, 1]);
  if (cam[0] === 0 && cam[1] === 1) return;
  const r = 1.25;
  v.image(cam[0] * r, 6.75, CROWN_Z + cam[1] * r, FLOCKE, { o: '#ffffff', j: LIT, W: '#ffffff' }, cam);
}

/** Leuchtende Eisrinne im Boden der Schlucht: zeigt von jeder Seite, wo der Weg in den Fels führt */
function rinne(v: Ice) {
  for (let k = r8(-5); k < r8(-1.25); k++)
    for (let i = -2; i < 2; i++) {
      const mid = i === -1 || i === 0;
      v.set(i, 0, k, mid ? LIT : '#c9eefc', mid ? 'bright' : 'solid');
    }
}

/** Das Raster eines Zustands (ohne Tür): Schlucht, Bogen, Krone, Zierde */
export function raster(g: Parameters<GateBuild>[1]): Vox {
  const v = new Ice();
  gorge(v);
  crown(v, Math.max(g.lit, g.open));
  v.carve();
  snowDrips(v);
  icicles(v, g.lit);
  flakes(v, g.cam);
  rinne(v);
  return v;
}

export const build: GateBuild = (p, g) => {
  raster(g).emit(p);
  // Die Doppeltür wie bisher: Angel, Zeichen oder Umriss des Pinguins, Ritual
  return door(THEME_COLORS.eis.portal, g.open, g.outline, g.lit);
};
