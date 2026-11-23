// Fußspuren im Schnee der Eis-Welt in 3D, im 3D-Teil ihres Welt-Pakets: flache Plättchen knapp über dem Schnee, alle in
// einem Mesh, dessen Puffer einmal angelegt und nur neu gefüllt werden, wenn sich etwas Sichtbares ändert
// (`prints.rev`); höchstens `MAX_MARKS` Plättchen, die neuesten Abdrücke zuerst. Gezeigt wird, was gerade zu sehen ist
// (nah an der Kamera, ringsum erkundet, nicht verweht; `prints.seen` aus mitwachsen-prints.ts, je Bild auch in 3D
// nachgeführt). Ein verwehender Abdruck wird durchsichtiger, bis nur der Schnee bleibt (bei reduzierter Bewegung in
// Stufen). Nur Klassen von Three.js, die die 3D-Ansicht schon nutzt (sonst wüchse three.<hash>.js). Die 3D-Ansicht
// hängt das Mesh in ihre Szene und führt es je Bild nach (`View3D.layer`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Was angezeigt wird“, Zeile „Fußspuren“)

import { BufferAttribute, BufferGeometry, Color, Mesh, MeshLambertMaterial } from 'three';
import { marks } from '../../mitwachsen-tracks';
import type { Layer } from '../../mitwachsen-view-3d';
import type { World } from '../../mitwachsen-world';
import { PRINT_RGB, prints, type Prints } from './mitwachsen-prints';

// höchstens so viele Plättchen zugleich: 300 Abdrücke mit den meisten Teilen (Tatze, Dreizack), mehr liegt selten um
// die Kamera; darüber fehlen die ältesten, schon blassen
export const MAX_MARKS = 2400;
const LIFT = 0.012; // so weit über dem Schnee (kein Flimmern)
const PRINT = new Color(`rgb(${PRINT_RGB})`); // kühles Blaugrau, wie in 2D
export const OPACITY = 0.65; // ein frischer Abdruck; verweht wird er ganz durchsichtig (kein Fleck, kein Sprung)

/** Mesh der Fußspuren einer 3D-Ansicht (je Plättchen eine Fläche nach oben); liest die Spuren `from` */
export function printLayer(from: Pick<Prints, 'seen' | 'rev'>): Layer & {
  object: Mesh;
  update(world: World): void; // braucht nur die Welt
  drawn: () => number;
} {
  const pos = new BufferAttribute(new Float32Array(MAX_MARKS * 12), 3);
  const rgba = new BufferAttribute(new Float32Array(MAX_MARKS * 16), 4);
  const up = new Float32Array(MAX_MARKS * 12);
  const idx: number[] = [];
  for (let i = 0; i < MAX_MARKS; i++) {
    for (let k = 1; k < 12; k += 3) up[i * 12 + k] = 1;
    idx.push(4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 2, 4 * i + 1, 4 * i + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', pos);
  geo.setAttribute('normal', new BufferAttribute(up, 3));
  geo.setAttribute('color', rgba);
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  mesh.frustumCulled = false; // die Plättchen wandern mit der Figur
  mesh.receiveShadow = true;
  let n = 0;
  let rev = NaN;
  const update = (world: World) => {
    if (from.rev === rev) return; // nichts Sichtbares hat sich geändert
    rev = from.rev;
    n = 0;
    for (const [p, a] of from.seen) {
      const h = world.cell(p.x, p.y).h + LIFT;
      for (const [x, y, w, d] of marks(p)) {
        if (n >= MAX_MARKS) break;
        pos.setXYZ(n * 4, x, h, y);
        pos.setXYZ(n * 4 + 1, x, h, y + d);
        pos.setXYZ(n * 4 + 2, x + w, h, y);
        pos.setXYZ(n * 4 + 3, x + w, h, y + d);
        for (let k = 0; k < 4; k++) rgba.setXYZW(n * 4 + k, PRINT.r, PRINT.g, PRINT.b, OPACITY * a);
        n++;
      }
    }
    geo.setDrawRange(0, n * 6);
    if (!n) return; // ohne Bereich lüde Three.js den ganzen Puffer hoch
    for (const [b, size] of [
      [pos, 12],
      [rgba, 16],
    ] as const) {
      b.clearUpdateRanges();
      b.addUpdateRange(0, n * size); // nur den genutzten Teil hochladen
      b.needsUpdate = true;
    }
  };
  return { object: mesh, update, drawn: () => n };
}

/** Die Fußspuren des Spiels in 3D */
export const layer = printLayer(prints);
