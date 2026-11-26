// Kristallfackeln an den Wegen der Grotte (Issue 31, Review vom 25.11.2026, Punkt 13) – rein und deterministisch, im
// Welt-Paket der Höhlenwelt. Ein schmaler Steinpfosten mit einer Kristallflamme in Lila, Türkis oder Rosa: kühles
// Licht, kein Feuer. Sie leuchten immer und zeigen als Kette die Wege: links und rechts am Weg durch die Mitte (als
// Fortsetzung des Lampengangs) von der Mündung über das Höhlenbett bis vor den stillen See, dazu ein Abzweig zur
// Kristallhalle und einer zum Pilzgarten. Gesetzt wird ganz zuletzt im Bau der Grotte, nach Füllung und Einebnen, und
// nur, wo eine Fackel niemandem im Weg steht (`fits`): nie auf einem Weg, nie am Bett, am Bahnhof oder an der Schleife
// der Grubenbahn, ringsum alle acht Nachbarn frei und gleich hoch (man kommt immer um sie herum). Passt es am
// Wunschplatz nicht, rückt sie ein, zwei Felder nach außen oder entlang des Wegs (`NUDGE`), sonst fehlt sie. Jede hat ein festes Lichtloch in der Dunkelmaske (`GROTTE.dark.fixed.torch`, mitwachsen-mask.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“, Kristallfackeln)

import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import { caveFrame, type Cave } from './mitwachsen-frame';

const T = GROTTE.torch;
const key = (x: number, y: number) => `${x},${y}`;

/**
 * Wunschplätze der Fackeln als [quer, vom Tor weg] von der Mündung aus, in fester Reihe: Paare am Weg durch die Mitte,
 * dann der Abzweig zur Kristallhalle, dann der zum Pilzgarten
 */
export function torchPlan(): [number, number][] {
  const { lamps, lake, hall, garden } = GROTTE;
  const out: [number, number][] = [];
  for (let o = lamps.to + T.every; o <= lake.out - lake.ry - T.shore; o += T.every) out.push([-T.side, o], [T.side, o]);
  for (const [to, row] of [
    [hall.across, hall.out - 2],
    [garden.across, garden.out - 2],
  ] as const)
    for (let u = 2 * T.side; u <= Math.abs(to) - T.zone; u += T.side) out.push([Math.sign(to) * u, row]);
  return out;
}

/** Flache Zierde, die einer Fackel weicht (begehbar, nichts hängt daran; Kristallfelder nicht: Sie brauchen ihre Größe) */
const SOFT: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>(['puddle', 'vein', 'glowmoss', 'glowshroom']);
/**
 * Ausweichen, wenn es am Wunschplatz nicht passt: erst nach außen (weg vom Weg), dann ein, zwei Felder vor oder zurück; in
 * Schritten [nach außen, vom Tor weg]
 */
const NUDGE: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [2, 0],
  [0, 2],
  [0, -2],
  [2, 1],
  [2, -1],
  [3, 0],
];

/**
 * Passt hier eine Fackel: freier, leerer Grottenboden ohne Merkmal (kein Weg, keine Wiese, kein Halt, keine Schleife),
 * ringsum alle acht Nachbarn begehbar, gleich hoch und ohne Schleife, und keine andere Fackel näher als zwei Felder
 */
function fits(map: ReadonlyMap<string, Cell>, [x, y]: Point): boolean {
  const c = map.get(key(x, y));
  const plain = (n: Cell | undefined): n is Cell =>
    !!n && n.region === 'hoehle' && !n.solid && n.ground === 'grotto' && !n.lane && !n.stop && !n.garden && !n.portal;
  if (!plain(c) || (c.deco && !SOFT.has(c.deco))) return false;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const n = map.get(key(x + dx, y + dy));
      if (n?.deco === 'torch') return false;
      if (Math.max(Math.abs(dx), Math.abs(dy)) === 1 && (!plain(n) || n.h !== c.h)) return false;
    }
  return true;
}

/**
 * Fackeln in die fertige Karte der Grotte setzen (`at`: Feld für eine Lage [quer, vom Tor weg]; `keep`: Felder, die frei
 * bleiben, als (x, y): Wege, Bett samt Wiese, Bahnhof). Liefert ihre Felder
 */
export function plantTorches(
  map: Map<string, Cell>,
  at: (p: readonly [number, number]) => Point,
  keep: (x: number, y: number) => boolean,
): Point[] {
  const set: Point[] = [];
  torchPlan().forEach(([u, o], i) => {
    const spot = NUDGE.map(([du, dv]) => at([u + Math.sign(u) * du, o + dv])).find(
      ([x, y]) => !keep(x, y) && fits(map, [x, y]),
    );
    if (!spot) return;
    const [x, y] = spot;
    const color = GROTTE_COLORS.crystals[i % GROTTE_COLORS.crystals.length]!;
    map.set(key(x, y), { ...map.get(key(x, y))!, deco: 'torch', solid: true, color, tufts: undefined });
    set.push([x, y]);
  });
  return set;
}

const found = new WeakMap<object, Point[]>();
/** Kristallfackeln einer Welt, in der Reihe des Plans; ohne Grotte keine; je Welt einmal (für ihre festen Lichtlöcher) */
export function torchesOf(world: Cave): Point[] {
  const known = found.get(world);
  if (known) return known;
  const frame = caveFrame(world);
  const near = frame
    ? torchPlan().flatMap(([u, o]) => NUDGE.map(([du, dv]) => frame.at(u + Math.sign(u) * du, o + dv)))
    : [];
  const lit = [...new Map(near.filter((p) => world.cell(...p).deco === 'torch').map((p) => [key(...p), p])).values()];
  found.set(world, lit);
  return lit;
}
