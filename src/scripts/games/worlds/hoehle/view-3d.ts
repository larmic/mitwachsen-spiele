// 3D-Teil des Welt-Pakets der Höhlenwelt: Was die 3D-Ansicht nur für die Kristallgrotte baut. Pilzschale, Steintrog,
// Unterstand mit Kristallwand (das Dach vor der Figur durchsichtig), Kristall-Lampen, Kristallsäulen, Kristallbogen,
// Leuchtpilze, Pilzbeete (voll oder abgeerntet; das Stück wird bei `gather` und `regrow` neu gebaut), Tropfquelle,
// Tropfmoos, Stalagmiten und Holzsteg (Quader aus mitwachsen-cave-look.ts, wie in 2D; Säulen stehen still, ihr
// Leuchten beim Klingen zeichnet die Ebene darüber, mitwachsen-cave-sky.ts), Boden und Klippen in den zart lila-grauen
// Schichten des Höhlentors, Lichtflecken in den Farben der Ecken (keine Punktlichter) und der lila Höhlenhimmel ohne
// Decke mit seiner Nebel-Maske. Braucht Three.js (wie die 3D-Ansicht) und kommt darum erst, wenn die 3D-Ansicht es will
// (`pack.view3d`, index.ts): im Build `_astro/welt-hoehle-3d.<hash>.js` mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { DrawDeco } from '../../mitwachsen-view';
import type { Ground, View3D } from '../../mitwachsen-view-3d';
import { band, caveBoxes } from './mitwachsen-cave-look';

const look: DrawDeco = (world, c, x, y) => caveBoxes(world, c, x, y);
const bed: DrawDeco = (world, c, x, y, { picked }) => caveBoxes(world, c, x, y, !(`${x},${y}` in picked));

/** Kacheln je Boden in der Grotte (wie die 3D-Ansicht sie sonst nimmt), damit der Lichtfleck auch auf Moos und Steg liegt */
const TILES: Partial<Record<Cell['ground'], Ground['tiles']>> = {
  grass: ['grassTop', 'grassSide', 'dirt'],
  stone: ['stone', 'stone', 'stone'],
  path: ['path', 'dirt', 'dirt'],
};

export const view3d: View3D = {
  gate: 'hoehle',
  // Das Höhlentor hat keine Flügel und keine Eiszapfen (Rollstein, mitwachsen-gate-hoehle.ts); die Platte bleibt Stein
  look: { door: () => [], icicle: () => '#ffffff' },
  decos: {
    shroombowl: look,
    stonetrough: look,
    shed: look,
    cavelamp: look,
    column: look,
    crystalarch: look,
    glowshroom: look,
    shroombed: bed,
    dripspring: look,
    dripmoss: look,
    stalagmite: look,
    jetty: look,
    // Füllung (mitwachsen-fill.ts); Farn und Felsbrocken draußen in der Landschaft zeichnet die Ansicht wie immer
    crystalbush: look,
    boulder: look,
    mosstop: look,
    clay: look,
    puddle: look,
    fern: look,
  },
  ground(c) {
    if (c.biome !== 'hoehle' || c.region === 'wild') return null;
    const light = c.light;
    // Grottenstein: Steinkachel, getönt in den zart lila-grauen Schichten (oben heller, Seiten je Höhe)
    if (c.ground === 'grotto')
      return {
        tiles: ['stone', 'stone', 'stone'],
        top: c.region === 'border' ? GROTTE_COLORS.bands[0] : GROTTE_COLORS.floor[1],
        side: band(c.h),
        light,
      };
    const tiles = TILES[c.ground];
    return tiles && light ? { tiles, light } : null;
  },
  bedFrame: () => null,
  air: { realm: 'hoehle', sky: GROTTE_COLORS.sky, mist: GROTTE_COLORS.mist },
  water: GROTTE_COLORS.water[0], // türkis: Felsbecken, See
};
