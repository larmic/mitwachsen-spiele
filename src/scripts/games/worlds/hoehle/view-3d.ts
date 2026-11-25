// 3D-Teil des Welt-Pakets der Höhlenwelt: Was die 3D-Ansicht nur für die Kristallgrotte baut. Pilzschale, Steintrog,
// Unterstand mit Kristallwand (das Dach vor der Figur durchsichtig), Kristall-Lampen, Kristallsäulen, Kristallbogen,
// Leuchtpilze, Pilzbeete (voll oder abgeerntet; das Stück wird bei `gather` und `regrow` neu gebaut), Pilzschale und
// Steintrog (leer oder voll; neu gebaut bei `feed`, `pour` und `regrow`), Tropfquelle,
// Tropfmoos, Stalagmiten und Holzsteg (Quader aus mitwachsen-cave-look.ts, wie in 2D; Säulen stehen still, ihr
// Leuchten beim Klingen zeichnet die Ebene darüber, mitwachsen-cave-sky.ts), Boden und Klippen in den zart lila-grauen
// Schichten des Höhlentors (der Boden etwas dunkler als früher, ohne Flecken), Lichtflecken in den Farben der Ecken
// (keine Punktlichter), Ränder im Dunkel (Wände und Boden an ihnen dunkler, mitwachsen-glow.ts), der Sockel der Kristall-Laterne und der lila Höhlenhimmel ohne
// Decke mit seiner Nebel-Maske. Braucht Three.js (wie die 3D-Ansicht) und kommt darum erst, wenn die 3D-Ansicht es will
// (`pack.view3d`, index.ts): im Build `_astro/welt-hoehle-3d.<hash>.js` mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { DrawDeco } from '../../mitwachsen-view';
import type { Ground, View3D } from '../../mitwachsen-view-3d';
import { band, caveBoxes } from './mitwachsen-cave-look';
import { darken, isWall } from './mitwachsen-glow';

const look: DrawDeco = (world, c, x, y) => caveBoxes(world, c, x, y);
const bed: DrawDeco = (world, c, x, y, { picked }) => caveBoxes(world, c, x, y, !(`${x},${y}` in picked));
const bowl: DrawDeco = (world, c, x, y, { picked }) => caveBoxes(world, c, x, y, `${x},${y}` in picked);

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
    shroombowl: bowl,
    stonetrough: bowl,
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
    // Fülle: Kristallfelder, Adern, Leuchtmoos (flach), der Wasserfall am See (steht still)
    crystalfield: look,
    vein: look,
    glowmoss: look,
    shore: look, // helle Steine am Seeufer (Sammelstellen, Schritt 9)
    waterfall: look,
    lantern: look, // Sockel; die Laterne darauf kommt als Körper (wie in 2D)
    web: look, // Netz der Tupfspinne; die Spinne davor kommt als Körper (wie in 2D)
  },
  ground(c) {
    if (c.biome !== 'hoehle' || c.region === 'wild') return null;
    // Lichtfleck heller, Ränder im Dunkel dunkler (mitwachsen-glow.ts): beides über `Ground.light`, nie beides zugleich
    const light = c.light || (c.dim ? -c.dim : undefined);
    // Grottenstein: Steinkachel, getönt in den zart lila-grauen Schichten (oben heller, Seiten je Höhe; die Flecken gibt es
    // nur in 2D, in 3D zeichnen Licht und Kachel den Boden); die Felswand im Schatten auch an ihren Seiten dunkler
    if (c.ground === 'grotto')
      return {
        tiles: ['stone', 'stone', 'stone'],
        top: c.region === 'border' ? GROTTE_COLORS.bands[0] : GROTTE_COLORS.floor,
        side: isWall(c) && c.dim ? darken(band(c.h), c.dim) : band(c.h),
        light,
      };
    const tiles = TILES[c.ground];
    return tiles && light ? { tiles, light } : null;
  },
  bedFrame: () => null,
  air: { realm: 'hoehle', sky: GROTTE_COLORS.sky, mist: GROTTE_COLORS.mist },
  water: GROTTE_COLORS.water[0], // türkis: Felsbecken, See
};
