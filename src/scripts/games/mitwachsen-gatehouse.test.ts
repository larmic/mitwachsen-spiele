import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { GATES } from '../../data/games/mitwachsen';
import { gatehouse, parts, platformParts, platformSets, type Parts } from './mitwachsen-gatehouse';

type Face = { axis: number; dir: number; at: number; min: [number, number]; max: [number, number]; part: string };

/** Achsenparallele Flächen einer Geometrie (je vier Ecken hintereinander, wie Geo sie anlegt) */
function faces(g: BufferGeometry, part: string): Face[] {
  const pos = g.getAttribute('position').array;
  const nor = g.getAttribute('normal').array;
  const out: Face[] = [];
  for (let v = 0; v < pos.length / 3; v += 4) {
    const n = [nor[v * 3]!, nor[v * 3 + 1]!, nor[v * 3 + 2]!];
    const axis = n.findIndex((c) => Math.abs(c) > 0.5);
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
function fighting(p: Parts): string[] {
  const all = Object.entries(p).flatMap(([name, geo]) => (geo.empty ? [] : faces(geo.build(), name)));
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

describe('Torhäuser und Portal-Plattformen flackern nicht', () => {
  for (const g of GATES) {
    it(`${g.id}: keine zwei Flächen liegen deckungsgleich in einer Ebene`, () => {
      const p = parts();
      gatehouse(p, g.id);
      expect(fighting(p)).toEqual([]);
    });
    it(`${g.id}: Portal-Plattform in jedem Zustand ebenso (am Tor und am Bett)`, () => {
      for (const side of ['gate', 'home'] as const) {
        const sets = platformSets(g.id, side);
        const asleep = parts();
        platformParts(asleep, sets.asleep);
        expect(fighting(asleep), `${side} schlafend`).toEqual([]);
        // bereit: Gold um die Mitte; angekommen: goldene Pfeile in den Seitenfeldern
        for (const ready of [true, false]) {
          const p = parts();
          platformParts(p, sets.body, sets.awake);
          platformParts(p, sets.picture, sets.awake);
          platformParts(p, ready ? sets.frameGold : sets.frameOff, sets.awake);
          platformParts(p, ready ? sets.accessOff : sets.accessGold, sets.awake);
          expect(fighting(p), side).toEqual([]);
        }
      }
    });
  }

  it('verdeckte Flächen fallen weg: Eine wache Plattform hat nur so viele Flächen, wie man sehen kann', () => {
    const sets = platformSets('sand', 'gate');
    const p = parts();
    for (const set of [sets.body, sets.picture, sets.frameGold, sets.accessOff]) platformParts(p, set, sets.awake);
    const quads = Object.values(p).reduce(
      (n, g) => n + (g.empty ? 0 : g.build().getAttribute('position').count / 4),
      0,
    );
    // oben je Säule eine Fläche (gut 500), dazu Kanten und Zierde; mit allen Würfelflächen wären es über 5000
    expect(quads).toBeGreaterThan(500);
    expect(quads).toBeLessThan(1200);
  });
});
