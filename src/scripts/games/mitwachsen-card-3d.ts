// Postkarte der Torfront in 3D: Steht die Figur eine Sekunde auf einer Torplatte, rendert eine zweite Kamera die Front
// ihres Tors einmal als Standbild in das Canvas der Postkarte (mitwachsen-card.ts). Teil der 3D-Ansicht
// (mitwachsen-3d.ts, mit Three.js nachgeladen); die Szene ist dieselbe, nur der Blick ist ein anderer.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Postkarte der Torfront)

import { PerspectiveCamera, type Scene, type Vector3, type WebGLRenderer } from 'three';
import type { GateId } from '../../data/games/mitwachsen';
import type { GatePlace, World } from './mitwachsen-world';

export const DIST = 15; // so weit vor der Tür steht die Kamera der Postkarte (in Feldern, über die Bucht hinweg)
const EYE = 6.5; // auf dieser Höhe über dem Boden des Tors, mindestens
export const LOOK = 3.3; // und schaut auf diese Höhe der Tür: Türme samt Schmuck sind ganz im Bild
const camera = new PerspectiveCamera(34, 4 / 3, 0.5, 140);

/** Was ein Feld vor der Kamera verdeckt: sein Boden, Festes darauf (Fels, Stamm) ein Feld höher */
export const top = (c: { h: number; solid?: boolean }) => c.h + (c.solid ? 1 : 0);

/**
 * Höhe der Kamera vor dem Tor `g` (absolut): `EYE` über dem Boden des Tors, höher, wenn ein Hügel oder Fels zwischen ihr
 * und der Tür (fünf Felder breit) sonst in den Blick ragte: Die Sichtlinie zur Tür bleibt über jedem Feld
 * mindestens ein Feld frei, auch über dem, auf dem die Kamera steht. Laub ist durchsichtig, zählt also nicht
 */
export function frontEye(world: Pick<World, 'cell'>, g: Pick<GatePlace, 'mid' | 'out'>) {
  const [[mx, my], [ox, oy]] = [g.mid, g.out];
  const look = world.cell(mx, my).h + LOOK;
  let eye = look - LOOK + EYE;
  for (let k = 1; k <= DIST; k++)
    for (let u = -2; u <= 2; u++) {
      const h = top(world.cell(mx - ox * k + oy * u, my - oy * k + ox * u));
      eye = Math.max(eye, look + ((h + 1 - look) * DIST) / k);
    }
  return eye;
}

/**
 * Front des Tors `id` von vorn, gleich wo es liegt, in `out` (2D-Canvas, Größe aus dem CSS): gerendert in die linke
 * untere Ecke des Bilds (`size`: Bildgröße in CSS-Pixeln) und von dort kopiert; das folgende Bild der 3D-Ansicht
 * übermalt die Ecke. Laub zwischen Kamera und Tor wird durchsichtig (`see`: Durchblick des Nebel-Shaders)
 */
export function frontShot(
  r: WebGLRenderer,
  scene: Scene,
  see: { mwEye: { value: Vector3 }; mwTarget: { value: Vector3 } },
  world: World,
  id: GateId,
  out: HTMLCanvasElement,
  size: { w: number; h: number },
) {
  const g = world.gates.get(id);
  const ctx = out.getContext('2d');
  const [w, h] = [out.clientWidth, out.clientHeight];
  if (!g || !ctx || !w || !h) return;
  const [x, z, y] = [g.mid[0] + 0.5, g.mid[1] + 0.5, world.cell(...g.mid).h];
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  camera.position.set(x - g.out[0] * DIST, frontEye(world, g), z - g.out[1] * DIST);
  camera.lookAt(x, y + LOOK, z);
  see.mwEye.value.copy(camera.position);
  see.mwTarget.value.set(x, y + 0.9, z);
  r.setScissorTest(true);
  r.setViewport(0, 0, w, h);
  r.setScissor(0, 0, w, h);
  r.render(scene, camera);
  const dpr = r.getPixelRatio();
  [out.width, out.height] = [Math.round(w * dpr), Math.round(h * dpr)];
  const gl = r.domElement;
  ctx.drawImage(gl, 0, gl.height - out.height, out.width, out.height, 0, 0, out.width, out.height);
  r.setScissorTest(false);
  r.setViewport(0, 0, size.w, size.h);
}
