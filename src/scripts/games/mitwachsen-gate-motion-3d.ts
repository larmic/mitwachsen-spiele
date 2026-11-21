// Bewegte Teile der Zugänge in 3D (fließende Wasserwand, Glutkaskade, wiegende Pilzranken): je Takt ein kleines Mesh,
// das beim ersten Mal gebaut wird und dann stehen bleibt; danach wechselt nur, welcher Takt sichtbar ist. Dazu wackeln
// die Flügel eines Tors, wenn es „noch nicht“ zeigt (nur gedreht, nicht neu gebaut): bewusst für alle Tore gleich, kein
// Sonderfall einer Welt (heute zeigt es nur das Eistor, ab Schritt 6 der Torplatte jedes). Gehört zur 3D-Ansicht und
// wird nur mit ihr nachgeladen (Three.js).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore)

import { Group, type Mesh } from 'three';
import type { GateId } from '../../data/games/mitwachsen';
import { BEATS, BEAT_MS, parts, type Parts, type Wing } from './mitwachsen-gate-kit';
import { motion } from './mitwachsen-gates-3d';
import type { Hint } from './mitwachsen-guide';

const RANGE = 30; // Zugänge, die weiter von der Kamera weg sind, bleiben bei ihrem Takt (man sieht sie kaum)
/** „Noch nicht“: so weit (rad) wackelt ein Flügel nach innen, 2 Voxel (1/4 Feld) an seiner freien Kante */
export const SHAKE = 0.25 / 2.4;
// „noch nicht“ pulsiert zweimal je 0,8 s (`HINT_MS` in mitwachsen-hint-look.ts); je Puls wackeln die Flügel so lange (ms)
const [PULSE, PUSH] = [800, 300];
/**
 * Wie weit die Flügel eines Tors gerade nach innen wackeln (0 … 1), `t` ms nachdem es „noch nicht“ zu zeigen begann:
 * zu Beginn jedes der zwei Pulse einmal kurz, mit dem Klappern des Riegels; bei reduzierter Bewegung nie
 */
export const hintShake = (t: number, reduced: boolean) =>
  !reduced && t >= 0 && t < 2 * PULSE && t % PULSE < PUSH ? Math.sin((Math.PI * (t % PULSE)) / PUSH) : 0;

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
  private wings: [id: GateId, wing: Group, angle: number, side: number][] = []; // Flügel aller Tore

  /** `draw` zeichnet die bewegten Teile eines Zugangs im Takt (in der 3D-Ansicht die Baupläne der Welten) */
  constructor(private draw: typeof motion = motion) {}

  /** Die Torhäuser werden neu gebaut: Ihre Gruppen räumt der Aufrufer weg (samt den Meshes aller Takte) */
  clear() {
    this.list = [];
    this.wings = [];
  }

  /** Ein Flügel des Tors `id` (Gruppe an seiner Angel, gebaut aus `w`): wackelt, wenn das Tor „noch nicht“ zeigt */
  wing(id: GateId, group: Group, w: Wing) {
    this.wings.push([id, group, w.angle, Math.sign(w.hinge[0])]);
  }

  /** Zugang `id` bewegt sich: liefert die Gruppe für seine Takte, die der Aufrufer ins Torhaus hängt */
  add(id: GateId, at: readonly [number, number], open: number, cam: readonly [number, number]) {
    const beats = new Group();
    this.list.push({ id, at, open, cam, beats, built: new Map(), shown: -1 });
    return beats;
  }

  /**
   * Den Takt der Zeit zeigen; `meshes` macht aus Teilen Meshes mit den Materialien der Torhäuser. Zeigt ein Tor
   * „noch nicht“ (`hint`), wackeln seine Flügel zweimal kurz nach innen (`hintShake`, nicht bei reduzierter Bewegung)
   */
  sync(
    sc: { now: number; reduced: boolean; cam: { x: number; y: number }; hint?: Hint | null },
    meshes: (p: Parts) => Mesh[],
  ) {
    const shake = hintShake(sc.now - (sc.hint?.at ?? -1e9), sc.reduced) * SHAKE;
    for (const [id, wing, angle, side] of this.wings) wing.rotation.y = angle - (id === sc.hint?.id ? side * shake : 0);
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
