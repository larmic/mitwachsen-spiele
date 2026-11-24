// Zeichenteile der Kristallgrotte für die 2D-Ansicht und die Ebene über 3D, im Welt-Paket der Höhlenwelt: Pilzschale,
// Steintrog, Unterstand mit Kristallwand, Kristall-Lampen, Kristallsäulen (leuchten kurz heller, wenn sie klingen),
// Kristallbogen, Leuchtpilze, Pilzbeete (voll oder abgeerntet), Tropfquelle, Tropfmoos, Stalagmiten und Holzsteg
// (Quader aus mitwachsen-cave-look.ts, je Deko-Art an den Haken `drawDeco` des Kerns gehängt), Lichtflecken auf dem
// Grottenboden, der lila Höhlenhimmel und das Zeichen der Gegend in der Leiste (ein Kristall). Dazu der Schmuck der
// Grotte: Töne des Säulen-Glockenspiels und „blubb“ des Grottenolms (`score`), „plink“ der Tropfsteine (`ambient`) und
// in der Luft Tropfen, Grottenolm und die Fledermaus auf ihrer Runde (`sky.weather`, mitwachsen-cave-sky.ts), am Abend
// golden-orange Lichtschächte (`ground`) und Fledermaus-Runden um den Schacht über dem Bett (mitwachsen-dusk-look.ts).
// Licht der Grotte (mitwachsen-glow.ts): Schatten der Ränder auf Boden und Wand (`ground`), der Lichtkreis um die Figur
// in der Luft; die Kristall-Laterne auf ihrem Sockel als Körper (`bodies`) und ihr Ton beim Nehmen (mitwachsen-lantern.ts). Das
// Hau-ruck am Höhlentor (mitwachsen-heave-look.ts): Hände auf dem Stein, Fledermaus und Glühwürmchen als Körper, der
// Stein in Dritteln (`ajar`), Töne der Stöße (`score`) und des Öffnens (`sky.gateScore`). Wetter gibt es in der Grotte
// keins, Polarlicht auch nicht.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { RegionId } from '../../../../data/games/mitwachsen';
import type { DrawDeco, Turn, View2D } from '../../mitwachsen-view';
import { sprite } from '../../mitwachsen-glyphs';
import { caveBoxes, columnBoxes, patchOf, waterfallBoxes } from './mitwachsen-cave-look';
import { caveWeather, type CaveFx } from './mitwachsen-cave-sky';
import { Chime } from './mitwachsen-chime-look';
import { Drips } from './mitwachsen-drips';
import { Olm } from './mitwachsen-olm-look';
import { duskAway, duskGround } from './mitwachsen-dusk-look';
import { isWall, shadowOver } from './mitwachsen-glow';
import { lanternBodies, lanternScore } from './mitwachsen-lantern';
import { heaveAjar, heaveBodies, heaveScore, openScore } from './mitwachsen-heave-look';

/** Dinge der Grotte: Quader wie in 3D */
const look: DrawDeco = (world, c, x, y) => caveBoxes(world, c, x, y);
/** Pilzbeet: voll, bis die Figur es abgeerntet hat (`picked`), dann leer, bis es nachwächst */
export const bed: DrawDeco = (world, c, x, y, { picked }) => caveBoxes(world, c, x, y, !(`${x},${y}` in picked));

/** So lange klappt die Leiste beim Wechsel der Gegend um (wie in der Eis-Welt) */
export const TURN_MS = 400;

/** Zeichen der Gegenden links in der Leiste: grünes Blatt der Lichtung, Kristall der Grotte */
const SIGN: Partial<Record<RegionId, readonly [string[], string]>> = {
  lichtung: [
    ['.....ggg', '...ggggg', '..gggggg', '.gggg.gg', '.ggg.ggg', '.gg.ggg.', '..gggg..', '.g......'],
    '#3f9a3c',
  ],
  hoehle: [['...k...', '..kkk..', '.kkkkk.', '.kkkkk.', '.kkkkk.', '..kkk..', '...k...'], GROTTE_COLORS.crystals[0]],
};

/**
 * Umklappen der Leiste: Wechselt die Gegend, wird die Leiste erst flach und klappt mit der neuen wieder auf (bei
 * reduzierter Bewegung sofort)
 */
export function turnAlbum(t: Turn, realm: RegionId, now: number, reduced: boolean): [RegionId, number] {
  if (t.shown && t.shown !== realm) [t.from, t.at] = [t.shown, now];
  t.shown = realm;
  const p = reduced || t.at === undefined ? 1 : Math.min(1, (now - t.at) / TURN_MS);
  return p < 0.5 ? [t.from ?? realm, 1 - 2 * p] : [realm, 2 * p - 1];
}

const none = () => {};

/** Was die Grotte sich fürs Bild merkt (nur Bild, kein Spielstand) */
export const fx: CaveFx = { chime: new Chime(), drips: new Drips(), olm: new Olm(), light: {} };

/**
 * Boden der Grotte (der Kern ruft das nur auf Grottenboden und Felswand): Lichtfleck unter einem Lichtschacht und neben
 * Kristallen als helles Licht obenauf (am Abend unter den Schächten golden-orange, `duskGround`); Ränder im Dunkel als
 * halb durchsichtiger Schatten, an der Wand über ihren obersten Block, auf dem Boden (auch unter Stalagmit oder Findling) obenauf (mitwachsen-glow.ts);
 * sonst die Flecken im Grottenboden (`patchOf`), damit er nicht wie Schnee wirkt
 */
export const ground: View2D['ground'] = (c, x, y, _open, evening) => {
  if (c.light) {
    const glow = duskGround(c.light, c.shaft, evening); // am Abend unter den Schächten golden-orange
    return [x, y, c.h, 1, 1, 0.01, glow, glow];
  }
  if (!c.dim) {
    const patch = patchOf(c); // Fleck im Grottenboden: flach obenauf, kühl lila oder zart rosé
    return patch ? [x, y, c.h, 1, 1, 0.01, patch, patch] : null;
  }
  const s = shadowOver(c.dim);
  return isWall(c) ? [x, y, c.h - 1, 1, 1, 1, s, s] : [x, y, c.h, 1, 1, 0.01, s, s];
};

/** Wasserfall am See: helle Streifen gleiten hinunter, bei reduzierter Bewegung stehen sie still */
const fall: DrawDeco = (_world, c, x, y, { now, reduced }) => waterfallBoxes(c, x, y, reduced ? undefined : now);

/** Kristallsäule: leuchtet kurz heller, nachdem sie geklungen hat */
const column: DrawDeco = (_world, c, x, y, { now }) => columnBoxes(c, x, y, fx.chime.glow(x, y, now));

/** Zeichenteile der Grotte; `fx` dazu, damit die Browser-Tests den Lichtkreis sehen */
export const view: View2D & { fx: CaveFx } = {
  fx,
  decos: {
    shroombowl: look,
    stonetrough: look,
    shed: look,
    cavelamp: look,
    column,
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
    // Fülle: Kristallfelder, Adern, Leuchtmoos (flach), der Wasserfall am See (in 2D gleiten helle Streifen hinunter, bei reduzierter
    // Bewegung stehen sie still)
    crystalfield: look,
    vein: look,
    glowmoss: look,
    waterfall: fall,
    lantern: look, // Sockel; die Laterne darauf kommt als Körper (`bodies`)
  },
  ground,
  // Säule klingt (mit Echo; nach je vier Tönen zirpt die Fledermaus und fliegt), Grottenolm macht „blubb“, die Figur
  // nimmt die Kristall-Laterne (der Lichtkreis wächst ab jetzt)
  score: (e) => {
    if (e.type === 'column') return fx.chime.ring(e.x, e.y, e.note, performance.now(), e.perch);
    if (e.type === 'olm') return fx.olm.surface(e.x, e.y, performance.now());
    if (e.type === 'heave') return heaveScore(e.n); // Hau-ruck: Trommel, Geröll
    if (e.type !== 'lantern') return undefined; // die anderen Ereignisse gehören anderen Welten
    fx.light.since = performance.now();
    return lanternScore();
  },
  // die Kristall-Laterne auf ihrem Sockel am Bett, solange die Figur sie nicht trägt; beim Hau-ruck die Hände auf dem
  // Stein, danach Fledermaus und Glühwürmchen
  bodies: (state, world, at) => [...lanternBodies(state, world), ...heaveBodies(state, world, at)],
  ajar: (state, reduced) => heaveAjar(state, reduced), // der Rollstein in Dritteln
  // die verschlafene Fledermaus auf ihrer Runde hängt solange nicht an ihrem Sitzplatz
  away: (x, y, now) => fx.chime.away(x, y, now) || duskAway(fx.dusk, x, y, now), // auch am Abend auf ihren Runden
  // „plink“: höchstens ein Tropfen je 2 s in der Nähe der Figur, nur an Erkundetem
  ambient: (world, state, now, explored) => fx.drips.tick(world, state, now, explored),
  sky: {
    weather: caveWeather(fx),
    aurora: none,
    waitArrow: none,
    realmSign: (ctx, realm, cx, bottom, size) => {
      const sign = SIGN[realm];
      if (sign) sprite(ctx, sign[0], sign[1], cx, bottom, size / 8);
    },
    turnAlbum,
    guestAt: () => null,
    gateScore: openScore, // Akkord, „plopp“, Lampen mit Echo, die Fledermaus zirpt
  },
  heaven: GROTTE_COLORS.heaven,
  water: GROTTE_COLORS.water, // türkis: Felsbecken, See
};
