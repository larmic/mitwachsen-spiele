import { describe, expect, it } from 'vitest';
import { Group, Mesh } from 'three';
import { BEATS, BEAT_MS, Vox, type Parts } from './mitwachsen-gate-kit';
import { MovingGates, SHAKE, beatAt } from './mitwachsen-gate-motion-3d';
import { leaves } from './mitwachsen-gatehouse';

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

  it('nach drop bewegt sich dieses Torhaus nicht mehr, bis es neu angelegt ist; die anderen bleiben', () => {
    const m = new MovingGates(draw);
    const [lava, wasser] = [new Group(), new Group()];
    lava.add(m.add('lava', [0, 0], 0, [0, 1]));
    m.drop(lava);
    const { calls, meshes } = counter();
    m.sync(at(0), meshes);
    expect(calls.n).toBe(0);
    m.add('lava', [0, 0], 0, [0, 1], true); // zur Front gebaut, mit allen Flächen
    wasser.add(m.add('wasser', [0, 0], 0, [0, 1]));
    m.drop(wasser);
    m.sync(at(0), meshes);
    expect(calls.n).toBe(1);
  });

  it('zur Front im Leerlauf: alle Takte gleich gebaut, versteckt; ein verstecktes Torhaus zeigt keinen Takt', () => {
    const m = new MovingGates(draw);
    const house = new Group();
    const beats = m.add('pilze', [0, 0], 0, [0, 1], true);
    house.add(beats);
    const { calls, meshes } = counter();
    m.fill(beats, meshes);
    expect(calls.n).toBe(BEATS);
    expect(visible(beats)).toBe(0);
    house.visible = false;
    m.sync(at(0), meshes);
    expect(visible(beats)).toBe(0); // noch nicht zu sehen: nichts zu tun
    house.visible = true;
    m.sync(at(BEAT_MS * 3), meshes);
    expect(calls.n).toBe(BEATS); // nichts neu gebaut
    expect(visible(beats)).toBeGreaterThan(0);
  });

  it('„noch nicht“: Die Flügel des Tors wackeln zweimal kurz nach innen (2 Voxel), nicht bei reduzierter Bewegung', () => {
    const m = new MovingGates(draw);
    const { meshes } = counter();
    const house = new Group();
    const ws = leaves(0).map((l) => {
      const g = new Group();
      house.add(g);
      g.rotation.y = l.angle;
      m.wing('eis', g, l);
      return [g, l] as const;
    });
    const other = new Group(); // ein Flügel eines anderen Tors: bleibt still
    m.wing('sand', other, leaves(0)[0]);
    const hint = { id: 'eis', at: 1000 } as const;
    const angles = (now: number, reduced = false) => {
      m.sync({ ...at(now, 0, 0, reduced), hint }, meshes);
      return ws.map(([g]) => +g.rotation.y.toFixed(4));
    };
    expect(angles(0)).toEqual([0, 0]); // vorher zu
    // nach innen: wie beim Öffnen (der linke Flügel dreht positiv, der rechte negativ), höchstens SHAKE
    const peak = angles(1150);
    expect(peak.map(Math.sign)).toEqual(ws.map(([, l]) => -Math.sign(l.hinge[0])));
    expect(peak.map(Math.abs)).toEqual([+SHAKE.toFixed(4), +SHAKE.toFixed(4)]);
    expect(SHAKE * 2.4).toBeCloseTo(2 / 8); // 2 Voxel an der freien Kante
    expect(angles(1500)).toEqual([0, 0]); // dazwischen still
    expect(other.rotation.y).toBe(0); // nur das Tor, das „noch nicht“ zeigt
    expect(angles(1950).map(Math.abs)).toEqual([+SHAKE.toFixed(4), +SHAKE.toFixed(4)]); // zum zweiten Mal
    expect(angles(2700)).toEqual([0, 0]); // vorbei
    expect(angles(1150, true)).toEqual([0, 0]); // reduzierte Bewegung: kein Wackeln
    m.drop(house);
    ws[0]![0].rotation.y = 0.5;
    angles(1150);
    expect(ws[0]![0].rotation.y).toBe(0.5); // neu gebaut: die alten Flügel gehören nicht mehr dazu
  });
});
