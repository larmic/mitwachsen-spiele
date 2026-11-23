// Licht der Kristallgrotte – rein, im Welt-Paket der Höhlenwelt, ohne Punktlichter. Zwei Teile:
// Ränder im Dunkel (`dimGrotte`, beim Bauen der Grotte): Die Felswände sind um `GROTTE.edge.wall` dunkler, der Boden
// direkt an der Wand um `GROTTE.edge.floor`, nach innen weniger, ab `reach` Feldern gar nicht mehr (`Cell.dim`). Hell
// bleiben die Wege (Mündung, Weg durch die Mitte, Platz des Bahnhofs), das Bett mit seiner Wiese und dem Gegenstück des
// Portals, die Lichtschächte und alles, was leuchtet (`Cell.light`): Dort ist es nie dunkler als bisher, also nie dunkler
// als die Dämmerung (mitwachsen-dusk.ts); am Abend und in der Nacht kommt nichts dazu. 2D legt den Schatten halb
// durchsichtig über Grottenboden und Wand (view-2d.ts), 3D dunkelt die Farbe der Oberseite und der Wände ab (view-3d.ts).
// Lichtkreis um die Figur (`circleOf`, `drawCircle`): ein weicher, heller Kreis auf der Ebene über der Welt, gleich für
// 2D und die Ebene über 3D (ein Verlauf in einem Quadrat um die Figur, kein Punktlicht, kein Neubau), immer, solange sie
// wach in der Grotte ist. Mit der Kristall-Laterne (mitwachsen-lantern.ts) wächst er in `GROTTE.circle.grow` ms und wird
// etwas heller, bei reduzierter Bewegung sofort.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Licht der Grotte“)

import type { Projection } from '../../../../lib/games/front';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';

const key = (x: number, y: number) => `${x},${y}`;

/** Felswand der Grotte: Felsklippe ringsum, auch was unerreichbar war und zu Fels wurde */
export const isWall = (c: Cell) => c.ground === 'grotto' && c.deco === 'rock' && c.solid;

/** So viel dunkler ist Boden `d` Felder (Schachbrett-Abstand) von der nächsten Wand: an ihr am meisten, ab `reach` nichts */
export function edgeDim(d: number): number {
  const { floor, reach } = GROTTE.edge;
  if (d < 1 || d > reach) return 0;
  return Math.round(floor * (1 - (d - 1) / reach) * 100) / 100;
}

/** Die acht Nachbarn von (x, y) */
const around = (x: number, y: number): [number, number][] =>
  [-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx || dy).map((dx): [number, number] => [x + dx, y + dy]));

/** Bleibt ein Boden hell, so nah er auch an der Wand liegt? Licht, Wiese am Bett, Wasser und die Wege (`path`) */
const staysBright = (c: Cell, path: boolean) => path || (c.light ?? 0) > 0 || c.garden === true || c.ground === 'water';

/**
 * Ränder im Dunkel in die Karte der Grotte schreiben (`Cell.dim`): Wände `GROTTE.edge.wall`, Boden nach seinem Abstand
 * zur nächsten Wand (`edgeDim`; Breitensuche von allen Wänden aus, acht Nachbarn, nur bis `reach`), außer er bleibt hell
 * (`path(x, y)`: Wege, Bett, Plätze; dazu Licht, Wiese, Wasser). Als Letztes nach dem Licht (`Cell.light`) aufrufen
 */
export function dimGrotte(realm: ReadonlySet<string>, path: (x: number, y: number) => boolean, map: Map<string, Cell>) {
  const dist = new Map<string, number>();
  let front: [number, number][] = [];
  for (const k of realm) {
    const c = map.get(k);
    if (!c || !isWall(c)) continue;
    dist.set(k, 0);
    front.push(k.split(',').map(Number) as [number, number]);
  }
  for (let d = 1; d <= GROTTE.edge.reach && front.length; d++) {
    const next: [number, number][] = [];
    for (const [x, y] of front)
      for (const [nx, ny] of around(x, y)) {
        const k = key(nx, ny);
        if (dist.has(k) || !realm.has(k) || !map.has(k)) continue;
        dist.set(k, d);
        next.push([nx, ny]);
      }
    front = next;
  }
  for (const [k, d] of dist) {
    const c = map.get(k)!; // nur Felder der Karte kommen hinein
    const [x, y] = k.split(',').map(Number) as [number, number];
    const dim = d === 0 ? GROTTE.edge.wall : staysBright(c, path(x, y)) ? 0 : edgeDim(d);
    if (dim > 0) map.set(k, { ...c, dim });
  }
}

/** Schatten eines Felds in 2D: halb durchsichtig in der Farbe der Schatten, so stark wie `dim` */
export const shadowOver = (dim: number) => {
  const n = parseInt(GROTTE_COLORS.shadow.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${Math.min(GROTTE.edge.wall, dim).toFixed(2)})`;
};

/** Farbe `hex` um `k` (0 … 1) abdunkeln, für Wände und Boden im Schatten in 3D */
export function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 - Math.max(0, Math.min(1, k));
  return `#${[n >> 16, (n >> 8) & 255, n & 255]
    .map((v) =>
      Math.round(v * f)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Lichtkreis: Radius in Feldern und Stärke (0 … 1) des Lichts in seiner Mitte */
export type Circle = { r: number; alpha: number };

/**
 * Lichtkreis um die Figur: ohne Laterne `GROTTE.circle.r`; mit Laterne (`lamp`) wächst er seit `since` (ms, als sie sie
 * nahm) in `grow` ms auf `lantern` und wird etwas heller (sanft auslaufend). Bei reduzierter Bewegung oder ohne `since`
 * gleich ganz. Legt sie sie zurück, ist er sofort wieder klein (nichts bewegt sich)
 */
export function circleOf(lamp: boolean, since: number | undefined, now: number, reduced: boolean): Circle {
  const { r, lantern, alpha, lanternAlpha, grow } = GROTTE.circle;
  if (!lamp) return { r, alpha };
  const p = reduced || since === undefined ? 1 : Math.max(0, Math.min(1, (now - since) / grow));
  const e = 1 - (1 - p) ** 2;
  return { r: r + (lantern - r) * e, alpha: alpha + (lanternAlpha - alpha) * e };
}

/** Wo der Lichtkreis liegt: Mitte und Radius in Pixeln (in 2D und 3D mit der Projektion der Ansicht) */
export function circleOnScreen(P: Projection, at: { x: number; y: number; z: number }, c: Circle) {
  const z = at.z + 0.5;
  const [cx, cy] = P(at.x + 0.5, at.y + 0.5, z);
  const [ex, ey] = P(at.x + 0.5 + c.r, at.y + 0.5, z);
  return { cx, cy, r: Math.hypot(ex - cx, ey - cy) };
}

/**
 * Den Lichtkreis zeichnen: ein heller Verlauf, innen `alpha`, nach außen weich bis durchsichtig, nur im Quadrat um den
 * Kreis (billig, auch auf langsamen Rechnern)
 */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  at: { x: number; y: number; z: number },
  c: Circle,
) {
  const { cx, cy, r } = circleOnScreen(P, at, c);
  if (!(r > 1) || c.alpha <= 0) return;
  const [red, green, blue] = GROTTE_COLORS.circle;
  const rgba = (a: number) => `rgba(${red}, ${green}, ${blue}, ${a.toFixed(3)})`;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(c.alpha));
  g.addColorStop(0.55, rgba(c.alpha * 0.6));
  g.addColorStop(1, rgba(0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
}
