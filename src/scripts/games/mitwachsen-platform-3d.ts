// Portal-Plattformen in der 3D-Ansicht: am Tor und ihr Gegenstück am Bett, flach aus Voxeln im Material der Welt.
// Jede Plattform hat ihre Zustände als eigene Teile, die je nach Spiel sichtbar werden: schlafend (am Tor matt, am
// Bett ein leerer grauer Sockel), wach mit leuchtendem Bild, Gold-Rahmen um die Mitte (bereit: hier drauf) oder Gold
// auf den Zugängen (nach der Ankunft: erst runter). Keine zwei Teile teilen einen Voxel, so flackert nichts.
// Wird nur mit der 3D-Ansicht nachgeladen (Three.js).

import { BoxGeometry, Group, type BufferGeometry, Mesh, MeshBasicMaterial, type Material } from 'three';
import { GATES, THEME_COLORS, type GateId } from '../../data/games/mitwachsen';
import { FRAME_RING, GOLD, SOCKET_TOP, SUB, type PlatformVoxel } from '../../data/games/mitwachsen-portals';
import { parts, platformParts, platformSets } from './mitwachsen-gatehouse';
import { PLATFORM_HALF, PORTAL_WAKE } from './mitwachsen-portal';
import type { Scene } from './mitwachsen-render';
import type { State } from './mitwachsen-state';
import type { World } from './mitwachsen-world';

const RUNNER_H = 0.3; // die hellen Voxel des Lauflichts: etwas größer als die Gold-Voxel, die sie umschließen
const WAVE_MS = 150; // Erwachen: eine Stufe des Lichts

type Platform3D = {
  id: GateId;
  side: 'gate' | 'home';
  centre: readonly [number, number];
  asleep: Group; // am Tor matt, am Bett ein leerer grauer Sockel
  body: Group; // wach: Sockel und Zierde
  picture: Group; // leuchtendes Bild auf dem Mittelfeld
  frame: Group; // Gold-Rahmen um die Mitte: hier drauf
  frameOff: Group; // derselbe Rahmen in Sockelfarbe
  access: Group; // Gold auf den Zugängen nach der Ankunft: erst runter
  accessOff: Group; // dieselben Zugänge in ihrer Farbe
  runner: Mesh[]; // Lauflicht im Gold-Rahmen
  sparks: Mesh[];
  pictureMat: MeshBasicMaterial;
  accessMat: MeshBasicMaterial;
};

export class Platforms3D {
  readonly group = new Group();
  private platforms: Platform3D[] = [];
  private awakeSeen: Set<GateId> | null = null; // wache Plattformen beim letzten Bild (null: neue Welt, noch keins)
  private wokeAt = new Map<GateId, number>(); // gerade erwacht: Das Licht kommt in Stufen
  private sparkGeo = new BoxGeometry(0.1, 0.1, 0.1);
  private runnerGeo = new BoxGeometry(1 / SUB + 0.06, RUNNER_H, 1 / SUB + 0.06);
  private runnerMat = new MeshBasicMaterial({ color: GOLD.light });

  /**
   * `solid`: Material für Stein, Holz, Eis …; `bright`: leuchtet aus sich selbst; `glow()` legt ein eigenes
   * Leuchtmaterial an (Helligkeit je Plattform einstellbar, mit Nebel wie die anderen)
   */
  constructor(
    private readonly solid: Material,
    private readonly bright: MeshBasicMaterial,
    private readonly glow: () => MeshBasicMaterial,
  ) {}

  /** Gruppe aus Voxeln: leuchtende mit `bright` (eigenes Material, z. B. zum Pulsieren), andere mit `solid` */
  private voxels(voxels: readonly PlatformVoxel[], gold = false, bright = this.bright): Group {
    const p = parts();
    platformParts(p, voxels, gold);
    const group = new Group();
    for (const [g, mat] of [
      [p.solid, this.solid],
      [p.bright, bright],
    ] as const) {
      if (g.empty) continue;
      const m = new Mesh(g.build(), mat);
      m.castShadow = mat === this.solid;
      m.receiveShadow = true;
      group.add(m);
    }
    return group;
  }

  build(world: World) {
    for (const p of this.platforms) {
      p.pictureMat.dispose();
      p.accessMat.dispose();
      for (const s of p.sparks) (s.material as Material).dispose();
    }
    this.group.traverse((o) => {
      if (o instanceof Mesh && o.geometry !== this.sparkGeo && o.geometry !== this.runnerGeo)
        (o.geometry as BufferGeometry).dispose();
    });
    this.group.clear();
    this.platforms = [];
    this.awakeSeen = null;
    this.wokeAt.clear();
    for (const g of GATES) {
      const pair = world.portals.get(g.id);
      if (!pair) continue;
      for (const [centre, side] of [
        [pair.gate, 'gate'],
        [pair.home, 'home'],
      ] as const)
        this.platforms.push(this.platform(world, g.id, centre, side));
    }
  }

  private platform(world: World, id: GateId, centre: readonly [number, number], side: 'gate' | 'home') {
    const [cx, cy] = centre;
    const host = new Group();
    host.position.set(cx + 0.5, world.cell(cx, cy).h, cy + 0.5);
    const sets = platformSets(id, side);
    const pictureMat = this.glow();
    const accessMat = this.glow();
    const sparks = Array.from({ length: 6 }, (_, i) => {
      const spark = new Mesh(
        this.sparkGeo,
        new MeshBasicMaterial({ color: i % 2 ? '#ffffff' : THEME_COLORS[id].portal }),
      );
      spark.userData.phase = i / 6;
      return spark;
    });
    const p: Platform3D = {
      id,
      side,
      centre,
      asleep: this.voxels(sets.asleep),
      body: this.voxels(sets.body),
      picture: this.voxels(sets.picture, false, pictureMat),
      frame: this.voxels(sets.frameGold, true),
      frameOff: this.voxels(sets.frameOff),
      access: this.voxels(sets.accessGold, true, accessMat),
      accessOff: this.voxels(sets.accessOff),
      runner: [0, 1].map(() => new Mesh(this.runnerGeo, this.runnerMat)),
      sparks,
      pictureMat,
      accessMat,
    };
    host.add(p.asleep, p.body, p.picture, p.frame, p.frameOff, p.access, p.accessOff, ...p.runner, ...sparks);
    this.group.add(host);
    return p;
  }

  sync(state: State, sc: Scene) {
    if (!this.awakeSeen) this.awakeSeen = new Set(state.portals); // geladene Welt: ohne Erwachen
    for (const id of state.portals)
      if (!this.awakeSeen.has(id)) {
        this.awakeSeen.add(id);
        this.wokeAt.set(id, sc.now);
      }
    for (const p of this.platforms) this.show(p, state, sc);
  }

  private show(p: Platform3D, state: State, sc: Scene) {
    const t = sc.now / 1000;
    const awake = state.portals.includes(p.id);
    const [cx, cy] = p.centre;
    const wave = this.wave(p.id, sc);
    const arrived = !!state.arrived && state.arrived[0] === cx && state.arrived[1] === cy;
    // Am Bett laufen Lauflicht und Funken nur, wenn die Figur nah ist: sonst blinken dort acht Ringe
    const { x, y } = state.player;
    const near = !state.sleeping && Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= PLATFORM_HALF + PORTAL_WAKE;
    const lively = awake && !arrived && !sc.reduced && wave >= 4 && (p.side === 'gate' || near);
    p.asleep.visible = !awake;
    p.body.visible = p.picture.visible = awake;
    // Bild: pulsiert, nach der Ankunft gedimmt, bei reduzierter Bewegung ruhig
    const glow = wave < 4 ? (wave + 1) / 4 : arrived ? 0.5 : sc.reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 3);
    p.pictureMat.color.setScalar(glow);
    p.frame.visible = awake && !arrived && wave >= 2;
    p.frameOff.visible = awake && !p.frame.visible;
    p.access.visible = awake && arrived;
    p.accessOff.visible = awake && !arrived;
    p.accessMat.color.setScalar(sc.reduced ? 1 : Math.floor(t * 3) % 2 ? 1 : 0.72); // pulsiert in Stufen
    this.sparkle(p, lively, t);
  }

  /** Erwachen: Das Licht kommt in vier Stufen (0 bis 4; bei reduzierter Bewegung und nach dem Laden sofort ganz) */
  private wave(id: GateId, sc: Scene): number {
    const since = this.wokeAt.get(id);
    return sc.reduced || since === undefined ? 4 : Math.min(4, Math.floor((sc.now - since) / WAVE_MS));
  }

  /** Lauflicht im Gold-Rahmen und Funken über der Mitte (nur, wenn `lively`) */
  private sparkle(p: Platform3D, lively: boolean, t: number) {
    // Lauflicht: zwei helle Voxel wandern in acht Stufen um die Mitte
    const at = Math.floor(t * 6) % (FRAME_RING.length / 2);
    p.runner.forEach((m, i) => {
      m.visible = lively;
      const [vx, vz] = FRAME_RING[at * 2 + i] ?? [0, 0];
      m.position.set((vx + 0.5) / SUB - 1.5, SOCKET_TOP - RUNNER_H / 2 + 0.03, (vz + 0.5) / SUB - 1.5);
    });
    for (const spark of p.sparks) {
      spark.visible = lively;
      const a = (spark.userData.phase as number) * Math.PI * 2 + t * 1.3;
      spark.position.set(Math.cos(a) * 0.8, 0.6 + Math.sin(a * 2 + t) * 0.3, Math.sin(a) * 0.8);
    }
  }
}
