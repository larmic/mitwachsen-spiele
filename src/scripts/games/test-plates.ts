// Nur für Tests: Flächen einer Geometrie, Flackern (Z-Fighting) und Grenzen, für die Torhäuser und ihre Torplatten
// (mitwachsen-gatehouse.test.ts, mitwachsen-gate-<welt>.test.ts); dazu die Prüfung einer Torplatte mit dem Schmuck
// ihres Zugangs (`checkPlate`).

import { expect } from 'vitest';
import type { BufferGeometry } from 'three';
import type { GateId } from '../../data/games/mitwachsen';
import { parts, type Parts } from './mitwachsen-gate-kit';
import { gate } from './mitwachsen-gates-3d';
import { DIP, plateParts } from './mitwachsen-plate-3d';
import { PLATE_LEN, PLATE_VOX, SINK, plateVoxel, type PlateLook } from './mitwachsen-plate';

type Face = { axis: number; dir: number; at: number; min: [number, number]; max: [number, number]; part: string };

/**
 * Achsenparallele Flächen einer Geometrie (je vier Ecken hintereinander, wie Geo sie anlegt). Schräge Flächen (halb
 * offene Türflügel) liegen nie in einer Ebene mit achsenparallelen und fallen weg.
 */
export function faces(g: BufferGeometry, part: string): Face[] {
  const pos = g.getAttribute('position').array;
  const nor = g.getAttribute('normal').array;
  const out: Face[] = [];
  for (let v = 0; v < pos.length / 3; v += 4) {
    const n = [nor[v * 3]!, nor[v * 3 + 1]!, nor[v * 3 + 2]!];
    const axis = n.findIndex((c) => Math.abs(c) > 0.99);
    if (axis < 0) continue;
    const [u, w] = [0, 1, 2].filter((k) => k !== axis) as [number, number];
    const pts = [0, 1, 2, 3].map((k) => [pos[(v + k) * 3]!, pos[(v + k) * 3 + 1]!, pos[(v + k) * 3 + 2]!]);
    out.push({
      axis,
      dir: Math.sign(n[axis]!),
      at: pts[0]![axis]!,
      min: [Math.min(...pts.map((p) => p[u]!)), Math.min(...pts.map((p) => p[w]!))],
      max: [Math.max(...pts.map((p) => p[u]!)), Math.max(...pts.map((p) => p[w]!))],
      part,
    });
  }
  return out;
}

/** Paare von Flächen, die in derselben Ebene in dieselbe Richtung schauen und sich überdecken: Sie flackern (Z-Fighting) */
export function fighting(p: Parts, extra: [string, BufferGeometry][] = []): string[] {
  const all = [
    ...Object.entries(p).flatMap(([name, geo]) => (geo.empty ? [] : faces(geo.build(), name))),
    ...extra.flatMap(([name, g]) => faces(g, name)),
  ];
  // nur Flächen in derselben Ebene mit derselben Richtung können sich überdecken
  const planes = new Map<string, Face[]>();
  for (const f of all) {
    const k = `${f.axis},${f.dir},${Math.round(f.at * 1e3)}`;
    planes.set(k, [...(planes.get(k) ?? []), f]);
  }
  const found: string[] = [];
  for (const list of planes.values())
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!,
          b = list[j]!;
        if (Math.abs(a.at - b.at) > 1e-4) continue;
        const du = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
        const dw = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
        if (du > 1e-3 && dw > 1e-3) found.push(`${a.part}/${b.part} Achse ${'xyz'[a.axis]} bei ${a.at.toFixed(2)}`);
      }
  return found;
}

/** Grenzen einer Geometrie (min, max je Achse) */
export const bounds = (gs: BufferGeometry[]) => {
  const pts = gs.flatMap((g) => [...g.getAttribute('position').array]);
  const axis = (k: number) => pts.filter((_, i) => i % 3 === k);
  const span = (k: number) => [Math.min(...axis(k)), Math.max(...axis(k))] as const;
  return [span(0), span(1), span(2)] as const;
};

/** Höchstens so viele Voxel hat eine Torplatte: zwei Lagen zu 24 × 8 (an den Ecken fehlen welche) */
export const PLATE_MAX = 2 * PLATE_LEN * PLATE_VOX;

/**
 * Torplatte vor dem Zugang `id` mit Schmuck `look`: flackert nicht (vor ihrem Torhaus, auch mit goldenem Rand), liegt
 * flach in Reihe 2 der Bucht (3 × 1 Felder, ein Voxel dick, mit `under` zwei), hat höchstens `PLATE_MAX` Voxel; ganz
 * eingesunken (tief mit `deep`) bleibt ihre Oberseite knapp über dem Boden, unter den Füßen der Figur. Das Zeichen liegt ganz in der
 * Fläche (der Rand deckt nichts davon). Liefert die Zahl ihrer Voxel.
 */
export function checkPlate(id: GateId, look: PlateLook | undefined, house?: Parts): number {
  const p = house ?? parts();
  if (!house) gate(p, id);
  plateParts(p, id, look, true);
  expect(fighting(p), id).toEqual([]);
  const solo = parts();
  plateParts(solo, id, look);
  const thick = (look?.under ? 2 : 1) / PLATE_VOX;
  const [x, y, z] = bounds([solo.solid.build(), solo.bright.build()]);
  for (const [[lo, hi], [a, b]] of [
    [x, [-1.5, 1.5]],
    [y, [0, thick]],
    [z, [1.5, 2.5]], // Reihe 2 der Bucht (die Torreihe liegt bei z −0,5 … 0,5)
  ] as const) {
    expect(lo, id).toBeCloseTo(a, 2);
    expect(hi, id).toBeCloseTo(b, 2);
  }
  // ganz eingesunken: Abstand zum Boden wie eine Markierung 0,02 darüber, sonst flackert sie (wippen geht nur nach
  // oben); und höchstens 0,05, sonst stecken die Füße der Figur (bei 0) darin
  const top = thick - DIP - (look?.deep ? SINK : 0);
  expect(top, id).toBeGreaterThanOrEqual(0.02);
  expect(top, id).toBeLessThanOrEqual(0.05);
  const { cells, marks } = count(id, look);
  expect(marks, id).toBe((look?.mark ?? []).join('').replace(/\./g, '').length); // ganz, nichts vom Rand verdeckt
  const voxels = cells * (look?.under ? 2 : 1);
  expect(voxels, id).toBeLessThanOrEqual(PLATE_MAX);
  return voxels;
}

/** Felder der Platte und ihre Zeichen; das Zeichen ändert den Rand nicht */
function count(id: GateId, look?: PlateLook) {
  let cells = 0;
  let marks = 0;
  for (let i = 0; i < PLATE_LEN; i++)
    for (let k = 0; k < PLATE_VOX; k++) {
      const kind = plateVoxel(i, k, look?.mark);
      if (kind) cells++;
      if (kind && kind !== 'rim' && kind !== 'face') marks++;
      expect(kind === 'rim', `${id} ${i},${k}`).toBe(plateVoxel(i, k) === 'rim');
    }
  return { cells, marks };
}
