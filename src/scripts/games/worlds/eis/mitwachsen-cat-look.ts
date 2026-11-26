// Aussehen und Klang der Schneeraupe (Issue 54), gleich für 2D und 3D (Haken `View2D.bodies` und `rideFx`,
// mitwachsen-ride-view.ts) – rein, ohne DOM und Three.js: Sie steht ab dem zweiten Besuch an ihrem Halt, solange die
// Figur in der Eis-Welt ist (bis zur ersten Fahrt mit goldenem Tritt), oder fährt ihre Runde mit der Figur in der
// Kabine: Sie gleitet zwischen den Takten weiter; bei reduzierter Bewegung steht sie in festen Bildern (alle `JUMP`
// Felder). Die Lampe leuchtet während der Fahrt und am Abend. Am Halt steht ein Schild mit der Zahl 4. Töne: ihr Signal
// C5 → E5 und ein tiefes Brummen beim Losfahren, C-Pentatonik.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Schneeraupe“)

import type { Dir } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { CAT_COLORS, CAT_SIGN, catParts } from '../../../../data/games/worlds/eis/mitwachsen-cat-model';
import type { Cell } from '../../mitwachsen-cell';
import { dirTo } from '../../mitwachsen-free';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { parked } from '../../mitwachsen-ride-kit';
import { ridden } from '../../mitwachsen-ride-save';
import type { RideAt, RideBody, RideFx } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { Box } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { CAT_SPEC, catRoute } from './mitwachsen-cat';
import { CAT } from './mitwachsen-loop';

/** Kennung des Körpers (`ride:` trifft das Antippen) */
export const CAT_ID = `ride:${CAT}`;
/** Bei reduzierter Bewegung springt sie alle so viele Felder weiter */
export const JUMP = 12;

const memo = new Map<string, ReturnType<typeof catParts>>();
const model = (k: string, look: Parameters<typeof catParts>[0]) =>
  memo.get(k) ?? (memo.set(k, catParts(look)), memo.get(k)!);

/** Punkt bei Fortschritt `p` auf der Runde (sie schließt sich), zwischen den Feldern gleitend, in Fahrtrichtung */
function along(path: readonly Point[], p: number, world: World): { x: number; y: number; z: number; dir: Dir } {
  const n = path.length - 1; // das letzte Feld ist wieder das erste
  const at = (i: number) => path[((Math.floor(i) % n) + n) % n]!;
  const [a, b] = [at(p), at(p + 1)];
  const f = p - Math.floor(p);
  const [ha, hb] = [world.cell(...a).h, world.cell(...b).h];
  return {
    x: a[0] + (b[0] - a[0]) * f,
    y: a[1] + (b[1] - a[1]) * f,
    z: ha + (hb - ha) * f,
    dir: dirTo(b[0] - a[0], b[1] - a[1]),
  };
}

/**
 * Körper der Schneeraupe je Bild: das Schild am Halt (auf dem ersten Warteplatz) und die Raupe am Halt oder unterwegs.
 * Leer, solange sie noch nicht da ist (erster Besuch), ohne Runde im Tal oder wenn die Figur woanders ist
 */
export function catBodies(state: State, world: World, at: RideAt): readonly RideBody[] {
  const r = catRoute(world);
  if (!r) return [];
  const ride = state.ride?.id === CAT ? state.ride : undefined;
  if (!ride && !parked(CAT_SPEC, r, state, world)) return [];
  let p = 0;
  if (ride) {
    p = ride.phase === 'go' ? Math.max(0, ride.pos - ride.speed * (1 - at.frac)) : ride.pos;
    if (at.reduced && p < r.path.length - 1) p = Math.floor(ride.pos / JUMP) * JUMP;
  }
  const spot = along(r.path, p, world);
  const look = {
    lit: !!ride || at.lit,
    // goldener Tritt bis zur ersten Fahrt, nur solange das Kind einsteigen kann
    gold: !ride && !state.ride && !ridden(state.packs, CAT) && !state.dozing?.includes(CAT),
    rider: !!ride,
  };
  const k = `${CAT_ID}:${+look.lit}${+look.gold}${+look.rider}`;
  const sign = r.seats.home.at(-1);
  return [
    ...(sign
      ? [
          {
            id: 'raupe:schild',
            key: 'raupe:schild',
            x: sign[0],
            y: sign[1],
            z: world.cell(...sign).h,
            dir: 's' as const,
            parts: CAT_SIGN,
          },
        ]
      : []),
    { id: CAT_ID, key: k, ...spot, parts: model(k, look), ...(ride && { seat: true as const }) },
  ];
}

/** Ein Feld der Runde (`Cell.ride` `'raupe'`): gewalzter Schnee, eine Spur dunkler; das ganze Feld, so liest sich die Runde als Band */
export const pisteBox = (c: Cell, x: number, y: number): Box => [x, y, c.h, 1, 1, 0.012, ...CAT_COLORS.piste];

const [C5, E5] = CAT_SPEC.signal as readonly [number, number];
/** Ihr Signal C5 → E5, weich, ab `at` s */
const signal = (at = 0, gain = 0.05): Scored[] => [
  [C5, 0.14, 'triangle', gain, 1, at],
  [E5, 0.22, 'triangle', gain, 1, at + 0.16],
];

/** Töne zu einem Ereignis der Schneeraupe */
export function catScores(e: RideEvent): Scored[] {
  switch (e.what) {
    case 'nudge':
      return signal();
    case 'board':
      return [
        [E5, 0.1, 'sine', 0.04, 1, 0],
        [783.99, 0.16, 'sine', 0.04, 1, 0.1],
      ];
    case 'go': // los: das Signal, darunter brummt der Motor an (C3, G3)
      return [...signal(), [130.81, 0.9, 'triangle', 0.05, 1, 0.1], [196, 0.9, 'triangle', 0.035, 1, 0.3]];
    case 'stop':
      return [...signal(), ...signal(0.45)];
    case 'wave':
      return e.ring ? signal(0, 0.04) : [[E5, 0.08, 'sine', 0.03, 1, 0]];
    case 'arrive': // angekommen: das Signal abwärts
      return [
        [E5, 0.14, 'triangle', 0.05, 1, 0],
        [C5, 0.3, 'triangle', 0.05, 1, 0.16],
      ];
    case 'leave':
      return [[E5, 0.1, 'sine', 0.05, 0.8, 0]];
    case 'alight':
      return [
        [E5, 0.12, 'triangle', 0.06, 1, 0],
        [1046.5, 0.24, 'triangle', 0.06, 1, 0.1],
      ];
    case 'snore':
      return [[C5, 0.5, 'sine', 0.02, 0.9, 0]];
    default:
      return [];
  }
}

/** Was die Ansicht zu einem Ereignis der Schneeraupe zeigt (ein anderes Fahrzeug: undefined) */
export function catFx(e: RideEvent): RideFx | undefined {
  if (e.id !== CAT) return undefined;
  const score = catScores(e);
  switch (e.what) {
    case 'alight':
      return { score, who: 'player', heart: true };
    case 'wave':
      return { score, who: 'player' };
    case 'shoo':
      return { score, who: e.who };
    case 'snore':
      return { score, zzz: true };
    default:
      return { score };
  }
}
