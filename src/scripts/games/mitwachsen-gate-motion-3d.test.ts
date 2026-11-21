import { describe, expect, it } from 'vitest';
import { Mesh, type Group } from 'three';
import { BEATS, BEAT_MS, Vox, type Parts } from './mitwachsen-gate-kit';
import { MovingGates, beatAt } from './mitwachsen-gate-motion-3d';

/** Macht aus Teilen ein Mesh je nicht leerem Teil und zählt, wie oft gebaut wurde */
function counter() {
  const calls = { n: 0 };
  const meshes = (p: Parts) => {
    calls.n++;
    return Object.values(p)
      .filter((g) => !g.empty)
      .map((g) => new Mesh(g.build()));
  };
  return { calls, meshes };
}
/** Ein Voxel, der mit dem Takt wandert */
const draw = (p: Parts, _id: unknown, beat: number) => {
  const v = new Vox();
  v.set(beat, 0, 0, '#ffffff');
  v.emit(p);
};
const at = (now: number, x = 0, y = 0, reduced = false) => ({ now, reduced, cam: { x, y } });
const visible = (g: Group) => g.children.filter((o) => o.visible).length;

describe('Bewegte Teile der Zugänge', () => {
  it('der Takt läuft alle BEAT_MS weiter und beginnt nach BEATS Takten von vorn; weniger Bewegung: immer Takt 0', () => {
    expect(beatAt(0, false)).toBe(0);
    expect(beatAt(BEAT_MS * 3 + 1, false)).toBe(3);
    expect(beatAt(BEAT_MS * BEATS, false)).toBe(0);
    expect(beatAt(BEAT_MS * 5, true)).toBe(0);
  });

  it('jeder Takt wird einmal gebaut und bleibt; sichtbar ist nur der Takt der Zeit', () => {
    const m = new MovingGates(draw);
    const group = m.add('wasser', [0, 0], 0, [0, 1]);
    const { calls, meshes } = counter();
    m.sync(at(0), meshes);
    const first = group.children.length;
    expect(first).toBeGreaterThan(0);
    expect(visible(group)).toBe(first);
    m.sync(at(BEAT_MS), meshes);
    expect(calls.n).toBe(2);
    expect(visible(group)).toBe(first);
    // eine Runde später: nichts wird neu gebaut
    m.sync(at(BEAT_MS * BEATS), meshes);
    m.sync(at(BEAT_MS * (BEATS + 1)), meshes);
    expect(calls.n).toBe(2);
    m.sync(at(BEAT_MS * (BEATS + 1) + 10), meshes); // derselbe Takt: nichts zu tun
    expect(calls.n).toBe(2);
  });

  it('ein Zugang weit weg von der Kamera bleibt bei seinem Takt; weniger Bewegung zeigt Takt 0', () => {
    const m = new MovingGates(draw);
    m.add('pilze', [100, 100], 0, [0, 1]);
    const { calls, meshes } = counter();
    m.sync(at(0), meshes); // der erste Takt wird immer gebaut
    m.sync(at(BEAT_MS), meshes);
    expect(calls.n).toBe(1);
    m.sync(at(BEAT_MS * 2, 100, 100), meshes); // die Kamera ist nah
    expect(calls.n).toBe(2);
    m.sync(at(BEAT_MS * 5, 100, 100, true), meshes);
    expect(calls.n).toBe(2); // Takt 0 gab es schon
  });

  it('nach clear bewegt sich nichts mehr, bis die Zugänge neu angelegt sind', () => {
    const m = new MovingGates(draw);
    m.add('lava', [0, 0], 0, [0, 1]);
    m.clear();
    const { calls, meshes } = counter();
    m.sync(at(0), meshes);
    expect(calls.n).toBe(0);
  });
});
