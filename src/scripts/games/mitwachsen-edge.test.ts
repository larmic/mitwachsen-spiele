// Eigene Antwort am Rand einer Welt (Issue 41): Hecke der Lichtung, Eisklippe, Felswand der Grotte antworten mit `edge`
// statt mit dem gewöhnlichen Anstoßen, höchstens alle 1,5 s; Baum, Stein und Wasser antworten wie immer
import { describe, expect, it } from 'vitest';
import type { Cell } from './mitwachsen-cell';
import { EDGE_EVERY, bumpEdge, edgeOf, type EdgeEvent, type EdgeKind } from './mitwachsen-edge';
import { initialState, progressOf, step, type GameEvent, type State } from './mitwachsen-state';
import { standHeight, type World } from './mitwachsen-world';
import { worldOf } from './test-worlds';

const world = worldOf(1);
const DIRS = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] } as const;
type Dir = keyof typeof DIRS;

/** Schritt vom begehbaren Feld (x, y) gegen einen Rand der Art `kind`, sonst undefined */
function against(w: World, kind: EdgeKind, x: number, y: number) {
  if (standHeight(w, ['eis', 'hoehle'], x, y) === null) return undefined;
  for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][])
    if (edgeOf(w.cell(x + dx, y + dy)) === kind) return { x, y, dir, tx: x + dx, ty: y + dy };
  return undefined;
}
/** Ein Feld, von dem aus ein Schritt gegen einen Rand der Art `kind` geht, nah an `from` gesucht */
function before(w: World, kind: EdgeKind, [fx, fy]: readonly [number, number], r: number) {
  for (let d = 0; d <= r; d++)
    for (let y = fy - d; y <= fy + d; y++)
      for (let x = fx - d; x <= fx + d; x++) {
        const hit = Math.max(Math.abs(x - fx), Math.abs(y - fy)) === d ? against(w, kind, x, y) : undefined;
        if (hit) return hit;
      }
  throw new Error(`kein Rand ${kind}`);
}
function at(x: number, y: number, dir: Dir): State {
  const s = initialState(world, {});
  return { ...s, sleeping: false, wokeAt: -100, openGates: ['eis', 'hoehle'], player: { x, y, dir }, animals: [] };
}
const edges = (events: readonly GameEvent[]) => events.filter((e): e is EdgeEvent => e.type === 'edge');

describe('Weltrand: eigene Antwort', () => {
  it('erkennt die drei Ränder und sonst nichts', () => {
    const cell = (more: Partial<Cell>): Cell => ({
      h: 3,
      ground: 'stone',
      deco: 'rock',
      region: 'border',
      solid: true,
      ...more,
    });
    expect(edgeOf(cell({}))).toBe('hedge'); // Felsring der Lichtung
    expect(edgeOf(cell({ h: 2, rim: true }))).toBe('hedge'); // seine innerste Reihe
    expect(edgeOf(cell({ ground: 'ice', biome: 'eis' }))).toBe('ice');
    expect(edgeOf(cell({ ground: 'grotto', region: 'hoehle', biome: 'hoehle' }))).toBe('cave');
    expect(edgeOf(cell({ ground: 'grass', deco: 'tree', region: 'lichtung' }))).toBeNull();
    expect(edgeOf(cell({ h: 2, region: 'lichtung' }))).toBeNull(); // ein Stein auf der Wiese
    expect(edgeOf(cell({ ground: 'water', deco: null, region: 'lichtung', solid: false }))).toBeNull();
    expect(edgeOf(cell({ ground: 'grotto', deco: 'stalagmite', region: 'hoehle' }))).toBeNull();
  });

  it('antwortet höchstens alle 1,5 s; dazwischen nimmt der Rand den Schritt still', () => {
    const rim: Cell = { h: 3, ground: 'stone', deco: 'rock', region: 'border', solid: true };
    const tree: Cell = { h: 1, ground: 'grass', deco: 'tree', region: 'lichtung', solid: true };
    const s: { tick: number; edgeAt?: number } = { tick: 100 };
    const out: EdgeEvent[] = [];
    expect(bumpEdge(s, tree, 1, 1, out)).toBe(false);
    expect(out).toEqual([]);
    expect(bumpEdge(s, rim, 4, 5, out)).toBe(true);
    expect(out).toEqual([{ type: 'edge', kind: 'hedge', x: 4, y: 5 }]);
    s.tick = 100 + EDGE_EVERY - 1;
    expect(bumpEdge(s, rim, 4, 5, out)).toBe(true); // still: kein Ereignis, aber auch kein Anstoßen
    expect(out).toHaveLength(1);
    s.tick = 100 + EDGE_EVERY;
    expect(bumpEdge(s, rim, 4, 5, out)).toBe(true);
    expect(out).toHaveLength(2);
    expect(bumpEdge({ tick: 0 }, rim, 0, 0, out)).toBe(true); // gleich am Anfang des Spiels antwortet er auch
    expect(out).toHaveLength(3);
  });

  it.each([
    ['hedge', world.homes.lichtung.bed, 90],
    ['ice', world.homes.eis.bed, 70],
    ['cave', world.homes.hoehle.bed, 60],
  ] as const)(
    'im Spiel, Rand %s: `edge` statt Anstoßen, die Figur bleibt stehen, nichts wird gespeichert',
    (kind, from, r) => {
      const b = before(world, kind, from, r);
      const s = at(b.x, b.y, b.dir);
      const first = step(s, world, { type: 'move', dir: b.dir, fresh: true });
      expect(edges(first.events)).toEqual([{ type: 'edge', kind, x: b.tx, y: b.ty }]);
      expect(first.events.some((e) => e.type === 'bump')).toBe(false);
      expect(first.state.player).toMatchObject({ x: b.x, y: b.y });
      const again = step(first.state, world, { type: 'move', dir: b.dir, fresh: true });
      expect(again.events.filter((e) => e.type === 'edge' || e.type === 'bump')).toEqual([]); // gleich danach: still
      let t = first.state;
      for (let i = 0; i < EDGE_EVERY; i++) t = step(t, world, { type: 'tick' }).state;
      expect(edges(step(t, world, { type: 'move', dir: b.dir, fresh: true }).events)).toHaveLength(1);
      expect('edgeAt' in progressOf(first.state)).toBe(false);
    },
  );

  it('ein Baum antwortet wie immer mit dem sanften Anstoßen', () => {
    const [bx, by] = world.homes.lichtung.bed;
    for (let d = 2; d < 60; d++)
      for (let x = bx - d; x <= bx + d; x++) {
        const c = world.cell(x, by + d);
        if (c.deco !== 'tree' || standHeight(world, [], x, by + d + 1) === null) continue;
        const r = step(at(x, by + d + 1, 'n'), world, { type: 'move', dir: 'n', fresh: true });
        expect(r.events.map((e) => e.type)).toContain('bump');
        expect(edges(r.events)).toEqual([]);
        return;
      }
    throw new Error('kein Baum gefunden');
  });
});
