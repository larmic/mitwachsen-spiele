// Bewegte Teile der Zugänge in 3D (fließende Wasserwand, Glutkaskade, wiegende Pilzranken): je Takt ein kleines Mesh,
// das beim ersten Mal gebaut wird und dann stehen bleibt; danach wechselt nur, welcher Takt sichtbar ist. Gehört zur
// 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore)

import { Group, type Mesh } from 'three';
import type { GateId } from '../../data/games/mitwachsen';
import { BEATS, BEAT_MS, parts, type Parts } from './mitwachsen-gate-kit';
import { motion } from './mitwachsen-gates-3d';

const RANGE = 30; // Zugänge, die weiter von der Kamera weg sind, bleiben bei ihrem Takt (man sieht sie kaum)

/** Ein bewegter Zugang: wo er steht (Welt), wie weit er offen ist, Richtung zur Kamera, die Meshes je Takt */
type Moving = {
  id: GateId;
  at: readonly [number, number];
  open: number;
  cam: readonly [number, number];
  beats: Group;
  built: Map<number, Mesh[]>;
  shown: number;
};

/** Takt der Bewegung zur Zeit `now` (ms); wer weniger Bewegung wünscht, sieht nur Takt 0 */
export const beatAt = (now: number, reduced: boolean) => (reduced ? 0 : Math.floor(now / BEAT_MS) % BEATS);

export class MovingGates {
  private list: Moving[] = [];

  /** `draw` zeichnet die bewegten Teile eines Zugangs im Takt (in der 3D-Ansicht die Baupläne der Welten) */
  constructor(private draw: typeof motion = motion) {}

  /** Die Torhäuser werden neu gebaut: Ihre Gruppen räumt der Aufrufer weg (samt den Meshes aller Takte) */
  clear() {
    this.list = [];
  }

  /** Zugang `id` bewegt sich: liefert die Gruppe für seine Takte, die der Aufrufer ins Torhaus hängt */
  add(id: GateId, at: readonly [number, number], open: number, cam: readonly [number, number]) {
    const beats = new Group();
    this.list.push({ id, at, open, cam, beats, built: new Map(), shown: -1 });
    return beats;
  }

  /** Den Takt der Zeit zeigen; `meshes` macht aus Teilen Meshes mit den Materialien der Torhäuser */
  sync(sc: { now: number; reduced: boolean; cam: { x: number; y: number } }, meshes: (p: Parts) => Mesh[]) {
    const beat = beatAt(sc.now, sc.reduced);
    for (const m of this.list) {
      if (m.shown === beat) continue;
      if (m.shown >= 0 && Math.hypot(m.at[0] - sc.cam.x, m.at[1] - sc.cam.y) > RANGE) continue;
      for (const o of m.built.get(m.shown) ?? []) o.visible = false;
      let shown = m.built.get(beat);
      if (!shown) {
        const p = parts();
        this.draw(p, m.id, beat, m.open, m.cam);
        shown = meshes(p);
        m.built.set(beat, shown);
        if (shown.length) m.beats.add(...shown);
      }
      for (const o of shown) o.visible = true;
      m.shown = beat;
    }
  }
}
