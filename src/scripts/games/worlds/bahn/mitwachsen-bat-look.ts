// Bahnhof Fledermaus und der Lokschuppen im Bild – rein, ohne DOM, gleich für 2D und 3D (Körper über den Haken
// `View2D.bodies`, wie Bahnhof Bär): die Reihen des Bahnsteigs aus lila geschichtetem Stein, das Steindach mit
// Kristall-Lampen und dem Schild „Fledermaus auf Lila“, daneben der Lokschuppen, vorn zum Gleis offen. Sie stehen, sobald
// die Welt mit Ausbau 2 gebaut ist (Bau 2: zum Augenblick `pop` wird sie neu gebaut, der Bahnsteig liegt dann eine Stufe
// über dem Gleis, die Rückwand des Lokschuppens ist fest); vorher nichts. Wo alles steht, rechnet `batOf` je Welt einmal
// aus den Feldern. Teil des Pakets der Bahn (mitwachsen-station-look.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 2)

import { dirTo } from '../../mitwachsen-free';
import type { Point } from '../../../../data/games/mitwachsen';
import { LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import { BAT_ROOF, BAT_SIGN, batRowParts, shedParts } from '../../../../data/games/worlds/bahn/mitwachsen-bat-model';
import type { Part } from '../../../../lib/games/front';
import type { RideBody } from '../../mitwachsen-ride-view';
import type { World } from '../../mitwachsen-world';
import { rowsOf } from './mitwachsen-bear';
import { shedIn } from './mitwachsen-build2';
import { key } from './mitwachsen-ground';
import { lineOf } from './mitwachsen-train-line';
import { STEPS } from './mitwachsen-trace';

/** Bahnhof Fledermaus in einer Welt: Reihen des Bahnsteigs (Kante am Gleis, hinten) und vom Gleis weg */
export type BatStation = { rows: { edge: Point; back: Point }[]; side: Point };

const memo = new Map<string, Part[]>();
const model = (k: string, make: () => Part[]) => memo.get(k) ?? (memo.set(k, make()), memo.get(k)!);
const stations = new WeakMap<World, BatStation | null>();

/**
 * Bahnhof Fledermaus aus den Feldern der Welt (je Welt einmal): das Gleis hinter dem Prellbock an seinem Ende (so lang
 * wie der Bahnsteig), die Felder des Bahnsteigs daneben (`Cell.stop`); null ohne Grotte oder solange der Bahnsteig
 * nicht über dem Gleis liegt (vor Ausbau 2)
 */
export function batOf(world: World): BatStation | null {
  if (stations.has(world)) return stations.get(world)!;
  const far = lineOf(world, true);
  const near = lineOf(world, false);
  const lane = far.length > near.length ? far.slice(-LINE.bear.long) : [];
  const found = new Map<string, Point>();
  for (const [x, y] of lane)
    for (const [dx, dy] of STEPS)
      for (const k of [1, 2]) {
        const q: Point = [x + dx * k, y + dy * k];
        if (world.cell(...q).stop === 'hoehle' && world.cell(...q).region === 'hoehle') found.set(key(...q), q);
      }
  const rows = rowsOf({ lane, platform: [...found.values()] });
  const [first, head] = [rows[0], lane[0]];
  const raised = !!first && !!head && world.cell(...first.edge).h > world.cell(...head).h;
  const st: BatStation | null =
    first && head && raised ? { rows, side: [first.edge[0] - head[0], first.edge[1] - head[1]] } : null;
  stations.set(world, st);
  return st;
}

/** Körper von Bahnhof Fledermaus und Lokschuppen (ab Ausbau 2 in der Welt; sonst leer) */
export function batBodies(world: World): RideBody[] {
  const st = batOf(world);
  if (!st) return [];
  const dir = dirTo(...st.side);
  const out: RideBody[] = st.rows.map(({ edge, back }, i) => {
    const k = `bahn:fels:${i % 2}`;
    const [x, y, z] = [(edge[0] + back[0]) / 2, (edge[1] + back[1]) / 2, world.cell(...edge).h];
    return { id: `bahn:fels:${i}`, key: k, x, y, z, dir, parts: model(k, () => batRowParts(i % 2 === 1)) };
  });
  const mid = Math.floor(st.rows.length / 2);
  const under = [mid - 1, mid].flatMap((i) => (st.rows[i] ? [st.rows[i].edge, st.rows[i].back] : []));
  if (under.length === 4) {
    const x = under.reduce((s, p) => s + p[0], 0) / 4,
      y = under.reduce((s, p) => s + p[1], 0) / 4;
    const z = world.cell(...under[0]!).h;
    out.push(
      { id: 'bahn:felsdach', key: 'bahn:felsdach', x, y, z, dir, parts: BAT_ROOF },
      { id: 'bahn:felsschild', key: 'bahn:felsschild', x, y, z: z + 1.74, dir: 's', parts: BAT_SIGN },
    );
  }
  return [...out, ...shedBody(world)];
}

/** Der Lokschuppen als ein Körper über seinem Platz, sobald seine Rückwand steht (ab Ausbau 2) */
function shedBody(world: World): RideBody[] {
  const shed = shedIn(world);
  if (!shed.cells.length || !shed.wall.every((p) => world.cell(...p).solid)) return [];
  const depthOf = (p: Point) => p[0] * shed.dir[0] + p[1] * shed.dir[1];
  const depth = new Set(shed.cells.map(depthOf)).size;
  const long = Math.round(shed.cells.length / depth);
  const x = shed.cells.reduce((s, p) => s + p[0], 0) / shed.cells.length,
    y = shed.cells.reduce((s, p) => s + p[1], 0) / shed.cells.length;
  const floor = shed.cells.find((p) => !world.cell(...p).solid) ?? shed.cells[0]!;
  const k = `bahn:schuppen:${depth}x${long}`;
  return [
    {
      id: 'bahn:schuppen',
      key: k,
      x,
      y,
      z: world.cell(...floor).h,
      dir: dirTo(...shed.dir),
      parts: model(k, () => shedParts(depth, long)),
    },
  ];
}
