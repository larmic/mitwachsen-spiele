// Bäume und Grasbüschel der 3D-Ansicht (mitwachsen-3d.ts): Quader und gekreuzte Halm-Flächen in die Geometrie eines
// Stücks. Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import { Color } from 'three';
import { cycle, hash } from '../../lib/games/rng';
import type { Geo } from './mitwachsen-geo';
import type { TreeKind } from './mitwachsen-world';

/** Laubfarbe je Baumart */
const LEAF: Record<TreeKind, string> = {
  oak: '#4fa84a',
  birch: '#7cbf48',
  autumn: '#e8823a',
  red: '#c8452e',
  blossom: '#f0a8c8',
  winter: '#e3ecf1', // Krone voll Schnee
  pine: '#2f6f3a',
  snowpine: '#2f6f3a',
  palm: '#4fa84a',
  dead: '#5d3e21',
};

/** Grasbüschel: `n` Paare gekreuzter Halm-Flächen auf dem Feld (x, y) in Höhe `h` */
export function tufts(blades: Geo, x: number, y: number, h: number, n: number) {
  // Normale nach oben: Halme sind von beiden Seiten gleich hell und nicht schwarz von hinten
  const greens = ['#4f9a3c', '#5fae45', '#6dbd47', '#468f37'].map((c) => new Color(c));
  for (let i = 0; i < n; i++) {
    const r = hash(3, x, y, i);
    const cx = x + 0.15 + (r % 70) / 100,
      cz = y + 0.15 + ((r >>> 8) % 70) / 100;
    const bh = 0.22 + ((r >>> 16) % 8) / 40;
    const s = 0.09;
    const c = cycle(greens, r);
    // zwei gekreuzte Halm-Flächen, von beiden Seiten sichtbar
    blades.quad(
      [cx - s, h, cz - s],
      [cx + s, h, cz + s],
      [cx + s, h + bh, cz + s],
      [cx - s, h + bh, cz - s],
      [0, 1, 0],
      'white',
      c,
    );
    blades.quad(
      [cx - s, h, cz + s],
      [cx + s, h, cz - s],
      [cx + s, h + bh * 0.85, cz - s],
      [cx - s, h + bh * 0.85, cz + s],
      [0, 1, 0],
      'white',
      c,
    );
  }
}

/** Baum der Art `kind` auf dem Feld (x, y): Stamm in `g`, Krone in `canopy` (wird vor der Figur durchsichtig) */
export function tree(g: Geo, canopy: Geo, x: number, y: number, h: number, kind: TreeKind) {
  const leaf = new Color(LEAF[kind]);
  const top = leaf.clone().lerp(new Color('#ffffff'), 0.18);
  if (kind === 'pine' || kind === 'snowpine') {
    // Tanne: drei Stufen, oben schmaler; die Schneetanne mit weißen Hauben
    g.box(x + 0.4, h, y + 0.4, 0.2, 0.7, 0.2, '#7a5432', '#93683f', 'log', 'logTop');
    const layers = [
      [-0.25, 0.5, 1.5],
      [0.0, 1.2, 1.0],
      [0.2, 1.8, 0.6],
    ] as const;
    for (const [o, yy, w] of layers) {
      canopy.box(x + o, h + yy, y + o, w, 0.6, w, leaf, top, 'leaves');
      if (kind === 'snowpine') canopy.box(x + o + 0.05, h + yy + 0.6, y + o + 0.05, w - 0.1, 0.12, w - 0.1, '#ffffff');
    }
    return;
  }
  if (kind === 'palm') {
    // Palme: leicht schräger Stamm aus Stücken, oben Wedel im Kreuz und Kokosnüsse
    for (let i = 0; i < 5; i++)
      g.box(x + 0.38 + i * 0.04, h + i * 0.42, y + 0.38, 0.22, 0.42, 0.22, '#a77c46', '#c9a066', 'log', 'logTop');
    const tx = x + 0.58,
      ty = h + 2.1;
    canopy.box(tx - 1.1, ty, y + 0.38, 2.4, 0.14, 0.32, leaf, top, 'leaves');
    canopy.box(tx - 0.08, ty, y - 0.62, 0.32, 0.14, 2.3, leaf, top, 'leaves');
    canopy.box(tx - 0.3, ty + 0.12, y + 0.18, 0.76, 0.2, 0.72, leaf, top, 'leaves');
    // Wedelspitzen hängen nach unten
    canopy.box(tx - 1.3, ty - 0.3, y + 0.4, 0.3, 0.32, 0.28, leaf, top, 'leaves');
    canopy.box(tx + 1.25, ty - 0.3, y + 0.4, 0.3, 0.32, 0.28, leaf, top, 'leaves');
    canopy.box(tx - 0.06, ty - 0.3, y - 0.85, 0.28, 0.32, 0.3, leaf, top, 'leaves');
    canopy.box(tx - 0.06, ty - 0.3, y + 1.65, 0.28, 0.32, 0.3, leaf, top, 'leaves');
    g.box(tx - 0.12, ty - 0.2, y + 0.42, 0.16, 0.16, 0.16, '#6b4423');
    g.box(tx + 0.12, ty - 0.2, y + 0.58, 0.16, 0.16, 0.16, '#6b4423');
    return;
  }
  if (kind === 'dead') {
    // kahler Baum in den Lavabergen
    g.box(x + 0.4, h, y + 0.4, 0.2, 1.5, 0.2, '#4a3426', '#5d3e21');
    g.box(x + 0.15, h + 0.9, y + 0.45, 0.3, 0.1, 0.1, '#4a3426');
    g.box(x + 0.6, h + 1.15, y + 0.45, 0.3, 0.1, 0.1, '#4a3426');
    g.box(x + 0.15, h + 0.9, y + 0.45, 0.1, 0.4, 0.1, '#4a3426');
    return;
  }
  if (kind === 'birch') {
    g.box(x + 0.4, h, y + 0.4, 0.2, 1.6, 0.2, '#e8e4d8', '#f3efe6');
    for (const z of [0.3, 0.75, 1.15]) g.box(x + 0.39, h + z, y + 0.53, 0.22, 0.06, 0.08, '#3a3a44');
    canopy.box(x + 0.05, h + 1.35, y + 0.05, 0.9, 0.95, 0.9, leaf, top, 'leaves');
    canopy.box(x + 0.2, h + 2.3, y + 0.2, 0.6, 0.45, 0.6, leaf, top, 'leaves');
    return;
  }
  g.box(x + 0.36, h, y + 0.36, 0.28, 1.3, 0.28, '#7a5432', '#93683f', 'log', 'logTop');
  // runde Krone: Mitte am breitesten, oben kleiner
  canopy.box(x - 0.1, h + 1.05, y - 0.1, 1.2, 0.55, 1.2, leaf, top, 'leaves');
  canopy.box(x - 0.4, h + 1.45, y - 0.4, 1.8, 0.8, 1.8, leaf, top, 'leaves');
  canopy.box(x - 0.15, h + 2.25, y - 0.15, 1.3, 0.55, 1.3, leaf, top, 'leaves');
  canopy.box(x + 0.15, h + 2.8, y + 0.15, 0.7, 0.35, 0.7, leaf, top, 'leaves');
  if (kind === 'blossom')
    for (let i = 0; i < 8; i++) {
      const r = hash(17, x, y, i);
      canopy.box(x - 0.35 + (r % 170) / 100, h + 1.5 + ((r >>> 8) % 66) / 100, y + 1.41, 0.09, 0.09, 0.02, '#ffffff');
    }
}
