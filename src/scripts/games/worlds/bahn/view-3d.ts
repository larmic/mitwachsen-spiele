// 3D-Teil des Pakets der Bahn (`View3D`, per import() aus index.ts, erst wenn die 3D-Ansicht ihn will): das Gleis mit
// denselben Quadern wie in 2D (mitwachsen-rail-look.ts). Ändert sich der Ausbau (`packs.bahn.built`), baut die 3D-Ansicht
// ihre Stücke neu (`stamp`). Im Build `_astro/welt-bahn-3d.<hash>.js`.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“)

import type { View3D } from '../../mitwachsen-view-3d';
import { builtOf } from './mitwachsen-built';
import { railBoxes } from './mitwachsen-rail-look';

export const view3d: View3D = {
  decos: {},
  ground: () => null,
  rails: railBoxes,
  stamp: (packs) => `bahn${builtOf(packs)}`,
};
