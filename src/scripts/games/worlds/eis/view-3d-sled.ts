// Schneespur und Schneefleck des Schlittens in 3D, im 3D-Teil des Welt-Pakets der Eis-Welt: flache Plättchen knapp
// über dem Boden, alle in einem Mesh (wie die Fußspuren, view-3d-prints.ts). Welche es gibt, sagt mitwachsen-sled-look.ts
// (`sledMarks`, gleich wie in 2D); neu gebaut wird nur, wenn sich das ändert (der Schlitten erscheint, die erste
// Heimfahrt, die Spur wächst auf der Festfahrt) oder sich der Nebel über ihr lichtet: Im Nebel liegt keine Spur. Den
// Schlitten selbst, das Rentier und den Schuppen zeichnet die 3D-Ansicht wie die Tiere (`View2D.bodies`). Nur Klassen
// von Three.js, die die 3D-Ansicht schon nutzt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshLambertMaterial } from 'three';
import type { Box } from '../../mitwachsen-view';
import type { Layer } from '../../mitwachsen-view-3d';
import type { State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { sledMarks } from './mitwachsen-sled-look';

const LIFT = 0.01; // so weit über dem Boden (kein Flimmern)

/** Mesh der Marken einer 3D-Ansicht (je Quader eine Fläche nach oben, in seiner Farbe oben); liest sie aus `marks` */
export function marksLayer(
  marks: (state: State, world: World) => readonly Box[] = sledMarks,
): Layer & { object: Mesh; drawn: () => number } {
  const mesh = new Mesh(new BufferGeometry(), new MeshLambertMaterial({ vertexColors: true }));
  mesh.frustumCulled = false; // eine Spur quer durch die Welt
  mesh.receiveShadow = true;
  let last: readonly Box[] = [];
  let n = 0;
  const color = new Color();
  const update: Layer['update'] = (world, state, sc) => {
    const all = marks(state, world);
    const seen = all.filter((b) => sc.explored(Math.floor(b[0]), Math.floor(b[1])));
    if (all === last && seen.length === n) return; // nichts Neues (der Nebel lichtet sich nur)
    [last, n] = [all, seen.length];
    const pos = new Float32Array(n * 12);
    const rgb = new Float32Array(n * 12);
    const up = new Float32Array(n * 12);
    const idx: number[] = [];
    seen.forEach(([x, y, z, w, d, h, side, top], i) => {
      const t = z + h + LIFT;
      pos.set([x, t, y, x, t, y + d, x + w, t, y, x + w, t, y + d], i * 12);
      color.set(top ?? side);
      for (let k = 0; k < 4; k++) {
        rgb.set([color.r, color.g, color.b], i * 12 + k * 3);
        up[i * 12 + k * 3 + 1] = 1;
      }
      idx.push(4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 2, 4 * i + 1, 4 * i + 3);
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('normal', new BufferAttribute(up, 3));
    geo.setAttribute('color', new BufferAttribute(rgb, 3));
    geo.setIndex(idx);
    mesh.geometry.dispose();
    mesh.geometry = geo;
  };
  return { object: mesh, update, drawn: () => n };
}

/** Mehrere Ebenen als eine: ein Objekt in der Szene, je Bild alle nachgeführt */
export function joined(...layers: readonly Layer[]): Layer {
  const object = new Group();
  for (const l of layers) object.add(l.object);
  return { object, update: (...a) => layers.forEach((l) => l.update(...a)) };
}
