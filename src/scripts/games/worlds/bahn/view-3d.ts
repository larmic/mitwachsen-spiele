// 3D-Teil des Pakets der Bahn (`View3D`, per import() aus index.ts, erst wenn die 3D-Ansicht ihn will): das Gleis mit
// denselben Quadern wie in 2D (mitwachsen-rail-look.ts). Ändert sich, welche Stücke des Gleises liegen (der Ausbau
// `packs.bahn.built` oder, solange Tok baut, die Stufe der Gleiswelle, in 3D immer drei Stufen), baut die 3D-Ansicht
// ihre Stücke neu (`stamp`): Stufe 0 zeigt dasselbe wie der Ausbau davor, die letzte dasselbe wie der fertige, so baut
// sie bei Bau 1 nur dreimal neu. Bahnhof und Zug sind Körper wie in 2D (`bodies` in der Ansicht,
// mitwachsen-station-look.ts). Im Build `_astro/welt-bahn-3d.<hash>.js`.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“)

import type { View3D } from '../../mitwachsen-view-3d';
import { builtOf } from './mitwachsen-built';
import { STAGES, railBoxes, waveStage } from './mitwachsen-rail-look';

export const view3d: View3D = {
  decos: {},
  ground: () => null,
  rails: railBoxes,
  stamp: (packs, work) => {
    const built = builtOf(packs);
    const wave = waveStage(work);
    if (wave === undefined || wave >= STAGES) return `bahn${built}`;
    return wave === 0 ? `bahn${built - 1}` : `bahn${built - 1}:${wave}`;
  },
};
