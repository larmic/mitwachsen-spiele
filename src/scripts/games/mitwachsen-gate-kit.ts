// Baukasten der Zugänge in 3D: ein Raster aus Voxeln zu 1/8 Feld, aus dem nur die sichtbaren Flächen ins Mesh kommen
// (gleiche Nachbarflächen in einer Reihe zusammengefasst), und ein Schild, das immer zur Kamera schaut. Liefert nur
// Geometrie in Torhaus-Koordinaten; gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
//
// Koordinaten wie im Torhaus: x entlang des Tors (Mitte 0), y nach oben, z nach vorn (+z schaut zur Lichtung).
// Die Torreihe liegt bei z −0,5 … 0,5, davor (z > 0,5) beginnt die Bucht, dahinter (z < −0,5) Fels und Gang.

import { Geo, col, type V3 } from './mitwachsen-geo';

/** Teile, die mit verschiedenen Materialien gezeichnet werden */
export type Parts = {
  solid: Geo; // Stein, Holz, Eis … (wird vor der Figur durchsichtig, damit man sie hinter dem Tor sieht)
  lava: Geo; // glühende Lava
  bright: Geo; // leuchtet aus sich selbst: Kristalle, Zeichen, Wasserfall
  leaves: Geo; // Laub
};
export type Part = keyof Parts;
export const parts = (): Parts => ({ solid: new Geo(), lava: new Geo(), bright: new Geo(), leaves: new Geo() });

/** Ein Türflügel: eigene Teile, die um ihre Angel (x, z) um `angle` gedreht stehen (um die senkrechte Achse, Bogenmaß) */
export type Wing = { parts: Parts; hinge: readonly [number, number]; angle: number };

/**
 * Was ein Zugang zum Bauen weiß: `open` wie weit er offen ist (0 zu … 1 offen, dazwischen der Übergang), `outline`
 * ob der Umriss des verlaufenen Tiers daran steht, `lit` wie weit dessen Ritual leuchtet (0 … 1) und `cam` die
 * Richtung zur Kamera in Torhaus-Koordinaten (x, z), eine der vier Achsen. Die Kamera dreht sich nie; liegt der Zugang
 * im Westen, Osten oder Süden der Lichtung, sieht sie ihn von der Seite oder von hinten.
 */
export type GateCtx = { open: number; outline: boolean; lit: number; cam: readonly [number, number] };
/** Bauplan eines Zugangs: legt Geometrie in `p` an und liefert Türflügel, falls er welche hat */
export type GateBuild = (p: Parts, g: GateCtx) => Wing[];

/** Teilstück 0 … 1 eines Ablaufs: wie weit `t` im Abschnitt [a, b] ist */
export const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
/** sanft an- und auslaufen */
export const ease = (t: number) => t * t * (3 - 2 * t);
/** Zufall aus Zahlen, wiederholbar (0 … 1) */
export function hash3(a: number, b: number, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const VOX = 8; // Voxel je Feld
const LIFT = 0.004; // so weit rückt jede Fläche nach außen (siehe face)

type Voxel = { c: string; top: string; part: Part };
type Paint = string | null | ((i: number, j: number, k: number) => string | null);
const key = (i: number, j: number, k: number) => ((i + 1024) * 2048 + (j + 1024)) * 2048 + (k + 1024);

/** Richtungen der sechs Flächen eines Voxels: Normale (x, y, z) */
const DIRS: readonly V3[] = [
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0],
];

/**
 * Raster aus Voxeln zu 1/8 Feld: i entlang x, j nach oben, k entlang z (ganze Zahlen; Feldkoordinate = Index / 8).
 * Was ein Zugang aus Voxeln baut, gehört in ein Raster: Dann liegen keine zwei Flächen deckungsgleich (kein Flackern),
 * und verdeckte Flächen fallen weg.
 */
export class Vox {
  private cells = new Map<number, Voxel & { i: number; j: number; k: number }>();

  get size() {
    return this.cells.size;
  }

  /** Voxel setzen (`c` null löscht ihn); `top` färbt die Oberseite anders */
  set(i: number, j: number, k: number, c: string | null, part: Part = 'solid', top?: string) {
    const at = key(i, j, k);
    if (c === null) this.cells.delete(at);
    else this.cells.set(at, { i, j, k, c, top: top ?? c, part });
  }

  has(i: number, j: number, k: number) {
    return this.cells.has(key(i, j, k));
  }

  /** Quader in Feldkoordinaten (auf 1/8 gerundet); `c` als Farbe oder je Voxel (null lässt ihn aus) */
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Paint, part: Part = 'solid') {
    const r = (v: number) => Math.round(v * VOX);
    const [i0, i1] = [Math.min(r(x0), r(x1)), Math.max(r(x0), r(x1))];
    const [j0, j1] = [Math.min(r(y0), r(y1)), Math.max(r(y0), r(y1))];
    const [k0, k1] = [Math.min(r(z0), r(z1)), Math.max(r(z0), r(z1))];
    for (let j = j0; j < j1; j++)
      for (let k = k0; k < k1; k++)
        for (let i = i0; i < i1; i++) {
          const v = typeof c === 'function' ? c(i, j, k) : c;
          if (v) this.set(i, j, k, v, part);
        }
  }

  /** Rundlicher Körper (Ellipsoid) um (cx, cy, cz) mit Halbachsen in Feldern; `rough` raut den Rand auf */
  blob(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    c: Paint,
    part: Part = 'solid',
    rough = 0,
  ) {
    for (let j = Math.floor((cy - ry) * VOX); j <= Math.ceil((cy + ry) * VOX); j++)
      for (let k = Math.floor((cz - rz) * VOX); k <= Math.ceil((cz + rz) * VOX); k++)
        for (let i = Math.floor((cx - rx) * VOX); i <= Math.ceil((cx + rx) * VOX); i++) {
          const [x, y, z] = [(i + 0.5) / VOX, (j + 0.5) / VOX, (k + 0.5) / VOX];
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d > 1 + (hash3(i, j, k) - 0.5) * rough) continue;
          const v = typeof c === 'function' ? c(i, j, k) : c;
          if (v) this.set(i, j, k, v, part);
        }
  }

  /**
   * Bild aus Pixeln (`rows[0]` oben, ein Pixel = ein Voxel), senkrecht und zur Richtung `face` (x, z) gewandt:
   * waagerecht mittig über (x, z), Unterkante y, `depth` Voxel dick nach hinten. Zeichen ohne Farbe in `pal` (und
   * '.') bleiben leer. Mit `face` = ctx.cam ist es das Schild, das immer zur Kamera schaut.
   */
  image(
    x: number,
    y: number,
    z: number,
    rows: readonly string[],
    pal: Readonly<Record<string, string>>,
    face: readonly [number, number],
    part: Part = 'bright',
    depth = 1,
  ) {
    const width = Math.max(...rows.map((r) => r.length));
    const [rx, rz] = [face[1], -face[0]]; // rechts aus Sicht des Betrachters
    const [ci, cj, ck] = [Math.round(x * VOX), Math.round(y * VOX), Math.round(z * VOX)];
    rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const color = pal[ch];
        if (!color) return;
        const s = c - Math.floor(width / 2);
        for (let d = 0; d < depth; d++)
          this.set(ci + rx * s - face[0] * d, cj + rows.length - 1 - r, ck + rz * s - face[1] * d, color, part);
      });
    });
  }

  /**
   * Alle sichtbaren Flächen in die Teile: Eine Fläche fällt weg, wenn dort ein anderer Voxel anliegt (gleich welchen
   * Teils). Gleiche Flächen nebeneinander werden zu einer zusammengefasst (Oberseiten, Vorder- und Rückseiten entlang
   * x, Seitenflächen entlang z), damit acht Zugänge mit tausenden Voxeln auch auf alten Tablets flüssig bleiben.
   */
  emit(p: Parts) {
    const s = 1 / VOX;
    DIRS.forEach((n, di) => {
      // entlang welcher Achse Flächen dieser Richtung zusammengefasst werden: x (0) oder z (2)
      const run = n[0] !== 0 ? 2 : 0;
      const rows = new Map<string, (Voxel & { i: number; j: number; k: number })[]>();
      for (const v of this.cells.values()) {
        if (this.has(v.i + n[0], v.j + n[1], v.k + n[2])) continue;
        const rest = run === 0 ? `${v.j},${v.k}` : `${v.i},${v.j}`;
        const list = rows.get(rest) ?? [];
        list.push(v);
        rows.set(rest, list);
      }
      for (const list of rows.values()) {
        list.sort((a, b) => (run === 0 ? a.i - b.i : a.k - b.k));
        let start = 0;
        for (let q = 1; q <= list.length; q++) {
          const a = list[start]!,
            b = list[q];
          const pos = (v: Voxel & { i: number; k: number }) => (run === 0 ? v.i : v.k);
          const same = b && b.part === a.part && b.c === a.c && b.top === a.top && pos(b) === pos(list[q - 1]!) + 1;
          if (same) continue;
          face(p, a, list[q - 1]!, n, di, run, s);
          start = q;
        }
      }
    });
  }
}

/** Eine zusammengefasste Fläche von Voxel `a` bis `b` (gleiche Reihe) mit Normale `n` */
function face(
  p: Parts,
  a: Voxel & { i: number; j: number; k: number },
  b: { i: number; j: number; k: number },
  n: V3,
  di: number,
  run: number,
  s: number,
) {
  // Jede Fläche rückt um LIFT nach außen: So liegt keine genau in einer Fläche des Geländes (Fels, Boden), die auf
  // ganzen Feldern liegt, und flackert mit ihr
  const out = (axis: number) => n[axis]! * LIFT;
  const x0 = a.i * s + out(0),
    y0 = a.j * s + out(1),
    z0 = a.k * s + out(2);
  const x1 = (run === 0 ? b.i + 1 : a.i + 1) * s + out(0),
    y1 = (a.j + 1) * s + out(1),
    z1 = (run === 2 ? b.k + 1 : a.k + 1) * s + out(2);
  const color = col(di === 0 ? a.top : a.c);
  const g = p[a.part];
  // Ecken wie in Geo.box: a-b unten, c-d oben, gegen den Uhrzeigersinn von außen gesehen
  switch (di) {
    case 0:
      g.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], n, 'white', color);
      break;
    case 1:
      g.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], n, 'white', color);
      break;
    case 2:
      g.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], n, 'white', color);
      break;
    case 3:
      g.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], n, 'white', color);
      break;
    case 4:
      g.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], n, 'white', color);
      break;
    default:
      g.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], n, 'white', color);
  }
}
