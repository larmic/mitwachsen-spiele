import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../data/games/mitwachsen';
import { Heap, dirOf, gridOf, trace, type Leg } from './mitwachsen-trace';

const RULES = { straight: 4, ramp: 3, turn: 3 };
/** Raster aus Zeilen: Ziffer = Höhe, `#` zu, `~` Wasser (Höhe 1, kostet 4 mehr) */
const grid = (rows: string[]) =>
  gridOf(0, 0, rows[0]!.length - 1, rows.length - 1, (x, y) => {
    const ch = rows[y]![x]!;
    return ch === '#' ? null : ch === '~' ? [1, 4] : [Number(ch), 0];
  });
/** Ecken eines Wegs (Felder, an denen er abbiegt) */
const corners = (cells: Point[]) =>
  cells.flatMap((b, i) => {
    const a = cells[i - 1],
      c = cells[i + 1];
    return a && c && (a[0] - b[0] !== b[0] - c[0] || a[1] - b[1] !== b[1] - c[1]) ? [i] : [];
  });

describe('Trassen-Suche (trace)', () => {
  it('der Haufen gibt das Kleinste zuerst', () => {
    const h = new Heap();
    for (const v of [5, 1, 4, 2, 3]) h.push(v);
    expect(Array.from({ length: 5 }, () => h.pop())).toEqual([1, 2, 3, 4, 5]);
    expect(dirOf([0, 0], [1, 0])).toBe(0);
    expect(dirOf([0, 0], [0, -1])).toBe(3);
  });

  it('Grenze der Suche: mehr als `budget` Zustände, dann nichts (so dauert eine Suche nie lange)', () => {
    const g = grid(Array.from({ length: 14 }, () => '1'.repeat(20)));
    const leg: Leg = { from: [0, 2], z: 1, dir: 0, run: 9, flat: 3, to: [19, 4], toDir: 0 };
    expect(trace(g, leg, RULES)).not.toBeNull();
    expect(trace(g, leg, RULES, 200_000)).toEqual(trace(g, leg, RULES));
    expect(trace(g, leg, RULES, 10)).toBeNull();
  });

  it('geradeaus, wenn es geht', () => {
    const g = grid(['11111111']);
    const leg: Leg = { from: [0, 0], z: 1, dir: 0, run: 9, flat: 3, to: [7, 0], toDir: 0 };
    expect(trace(g, leg, RULES)?.cells).toEqual(Array.from({ length: 8 }, (_, i) => [i, 0]));
  });

  it('Kurven nur rechtwinklig und mit mindestens vier Feldern Gerade dazwischen (ein Versatz um zwei Felder wird lang)', () => {
    const g = grid(Array.from({ length: 14 }, () => '1'.repeat(20)));
    const leg: Leg = { from: [0, 2], z: 1, dir: 0, run: 9, flat: 3, to: [19, 4], toDir: 0 };
    const found = trace(g, leg, RULES)!;
    const at = corners(found.cells);
    expect(at.length).toBeGreaterThanOrEqual(2);
    for (let k = 1; k < at.length; k++) expect(at[k]! - at[k - 1]! - 1).toBeGreaterThanOrEqual(RULES.straight);
    // auch gleich nach dem Start: wer gerade erst abgebogen ist (run 1), darf nicht gleich wieder
    const fresh = trace(g, { ...leg, run: 1 }, RULES)!;
    expect(corners([[-1, 2], ...fresh.cells])[0]).toBeGreaterThanOrEqual(RULES.straight + 1);
  });

  it('Rampen: nie mehr als eine Stufe, höchstens eine je drei Felder; ohne Einschnitt kein Weg über eine Kante', () => {
    const g = grid(['1112223333']);
    const leg: Leg = { from: [0, 0], z: 1, dir: 0, run: 9, flat: 3, to: [9, 0], toDir: 0 };
    const found = trace(g, leg, RULES)!;
    expect(found.z).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 3]);
    expect(trace(grid(['1122333']), { ...leg, to: [6, 0] }, RULES)).toBeNull(); // zwei Felder je Stufe: zu steil
    expect(trace(grid(['11133']), { ...leg, to: [4, 0] }, RULES)).toBeNull(); // zwei Stufen auf einmal
  });

  it('mit Einschnitt liegt das Gleis tiefer als ein Hügel, statt hinauf und hinab', () => {
    const g = grid(['1123211']);
    const leg: Leg = { from: [0, 0], z: 1, dir: 0, run: 9, flat: 3, to: [6, 0], toDir: 0 };
    expect(trace(g, leg, RULES)).toBeNull();
    const found = trace(g, leg, { ...RULES, cut: 1 })!;
    expect(found.z).toEqual([1, 1, 2, 2, 2, 1, 1]); // eine Stufe hinauf, durch die Kuppe geschnitten, wieder hinab
    expect(found.z.every((z, i) => z <= Number('1123211'[i]))).toBe(true);
    const flat = trace(g, leg, { ...RULES, cut: 0 })!; // Einschnitt umsonst: ganz unten durch
    expect(flat.z).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('ein Damm durch Wasser kostet mehr: lieber ein Umweg, wenn er billiger ist', () => {
    const g = grid(['11111111111111', '1111~~~~111111', '11111111111111', '11111111111111']);
    const leg: Leg = { from: [0, 1], z: 1, dir: 0, run: 9, flat: 3, to: [13, 1], toDir: 0 };
    const found = trace(g, leg, RULES)!;
    expect(found.cells.some(([x, y]) => y === 1 && x >= 4 && x <= 7)).toBe(true); // Umweg mit zwei Kurven kostet mehr
    const wide = grid(['11111111111111', '1~~~~~~~~~~~~1', '11111111111111']);
    const around = trace(wide, { ...leg, to: [13, 1] }, RULES);
    expect(around === null || around.cells.length > 0).toBe(true);
  });

  it('ohne Weg, außerhalb des Rasters oder am Ziel in falscher Richtung: null', () => {
    const g = grid(['11#11']);
    const leg: Leg = { from: [0, 0], z: 1, dir: 0, run: 9, flat: 3, to: [4, 0], toDir: 0 };
    expect(trace(g, leg, RULES)).toBeNull();
    expect(trace(grid(['11111']), { ...leg, to: [9, 0] }, RULES)).toBeNull();
    expect(trace(grid(['11111']), { ...leg, toDir: 2 }, RULES)).toBeNull();
  });
});
