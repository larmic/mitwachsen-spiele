// Der Zug in Ton und Licht, im Paket der Bahn, gleich für 2D und 3D: zu jedem Ereignis des Zugs (Fahr-Engine im Paket
// der Fahrzeuge) Töne, wer hüpft und ein Herz bekommt (`trainFx`, Haken `View2D.rideFx`; Ereignisse anderer Fahrzeuge
// beantwortet es nicht), und das Licht im Tunnel (`dim`, Haken `View2D.dim`: 0,7-fach, nie dunkler als die Dämmerung).
// Töne als WebAudio in der C-Pentatonik, je Ereignis höchstens ein Ton sofort, nie mehr als drei zugleich: Angestoßen
// tutet er und die Tür geht mit „pff“ auf; Einsteigen „Ding-Dong“; Abfahrt sein Pfiff A5 → C6 (sein Signal); unterwegs
// tutet er auf einen Pfeil höchstens alle 1,5 s, sonst klingt ein leiser Einzelton; vor einem Hindernis tutet er
// freundlich; vor dem Tunnel „Uh-uh“; Ankunft: jeder Bahnhof seine Ansage aus drei Tönen (Bahnhof Bär der Anfang der
// Bett-Melodie G5–E5–D5, Bahnhof Fledermaus A4–E4–C5 mit Echo: der letzte klingt lang nach), am Prellbock „Ding-Dong“;
// aussteigen G5–C6; Tok hüpft heraus mit „Ju-hu“; schläft er,
// weil ein Paket fehlt, schnarcht er leise (Sinus G4 → E4, ein Zzz steigt auf). Tutet er, pfeifen Murmeltiere in der
// Nähe zurück (Pfeif-Gruß); auf der Laternenfahrt zirpt die Fledermaus beim Losfahren, Tiere der Grotte winken (die
// Murmeltiere pfeifen), am Ziel ein kleines Fest mit Kristall-Funken (mitwachsen-feast-look.ts). Die Glocke
// beim Wechsel der Gegend spielt der Kern (Ereignis `realm`). Die Körper zeichnet mitwachsen-station-look.ts.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Fahren)

import { TUNNEL_LIGHT } from '../../mitwachsen-dusk';
import type { RideEvent } from '../../mitwachsen-pack-types';
import type { RideFx } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { ZZZ, dingDong, juhu, pff, whistle } from './mitwachsen-tok-look';
import { FEAST, SPARKS, batOf, chirp, marmot, whistleBack } from './mitwachsen-feast-look';
import { TRAIN, farOf, inTunnel } from './mitwachsen-train';

const [A5, C6] = TRAIN.signal as readonly [number, number];
/** Weiches Tuten (A5, Sinus), ab `at` s */
export const toot = (at = 0): Scored => [A5, 0.18, 'sine', 0.05, 1, at];
/** „Uh-uh“ vor dem Tunnel: Sinus G4, dann E4, weich und tief (kündigt an, erschreckt nicht) */
export const UH_UH: readonly Scored[] = [
  [392, 0.22, 'sine', 0.05, 1, 0],
  [329.63, 0.3, 'sine', 0.05, 1, 0.28],
];

/** Ansage von Bahnhof Bär: der Anfang der Bett-Melodie (G5–E5–D5, Sinus, wie `lullaby` in sfx.ts) */
export const BEAR_CALL: readonly Scored[] = [
  [783.99, 0.36, 'sine', 0.06, 1, 0],
  [659.25, 0.36, 'sine', 0.06, 1, 0.34],
  [587.33, 0.5, 'sine', 0.06, 1, 0.68],
];
/** Ansage von Bahnhof Fledermaus: A4–E4–C5 im Dreieck, der letzte leise und lang wie ein Echo in der Grotte */
export const BAT_CALL: readonly Scored[] = [
  [440, 0.22, 'triangle', 0.05, 1, 0],
  [329.63, 0.22, 'triangle', 0.05, 1, 0.24],
  [523.25, 0.9, 'triangle', 0.035, 1, 0.48],
];

/** Töne zu Ereignissen, die immer gleich klingen */
const FIXED: Partial<Record<RideEvent['what'], () => readonly Scored[]>> = {
  tunnel: () => UH_UH,
  guest: juhu, // Tok hüpft in der Bucht aus
  snore: () => [ZZZ], // er schläft, bis sein Paket da ist: leise wie Tok im Schlaf
  feast: () => FEAST, // Laternenfahrt am Ziel: kleines Fest
  farewell: chirp, // Laternenfahrt: Die Fledermaus wacht beim Losfahren auf und zirpt
};

/**
 * Töne zu einem Ereignis des Zugs; zur Ankunft sagt der Spielstand, an welchem Halt (Bahnhof Bär auf der Lichtung,
 * Bahnhof Fledermaus ab Ausbau 2, sonst der Prellbock in der Bucht)
 */
export function trainScores(e: RideEvent, state?: Pick<State, 'ride' | 'packs' | 'openGates'>): Scored[] {
  const fixed = FIXED[e.what];
  if (fixed) return [...fixed()];
  switch (e.what) {
    case 'nudge': // er tutet, die Tür geht einladend auf
      return [toot(), pff(0.24)];
    case 'stop': // vor einem Tier: freundlich, zweimal
      return [toot(), toot(0.3)];
    case 'arrive':
      if (state?.ride?.to === 'out') return [...BEAR_CALL];
      if (state?.ride?.to === 'home' && farOf(state)) return [...BAT_CALL];
      return dingDong();
    case 'board':
      return dingDong();
    case 'go': // sein Signal: Pfiff A5 → C6
      return [whistle()];
    case 'leave':
      return [[783.99, 0.1, 'sine', 0.05, 0.8, 0]];
    case 'wave': // gedrosselt tuten, sonst ein leiser Ton: Jeder Druck hört etwas (auch ohne Hüpfer)
      return e.ring ? [toot()] : [[C6, 0.08, 'sine', 0.03, 1, 0]];
    case 'alight':
      return [
        [783.99, 0.12, 'triangle', 0.06, 1, 0],
        [1046.5, 0.24, 'triangle', 0.06, 1, 0.1],
      ];
    default: // ein Tier hüpft beiseite: das zeigt das Bild
      return [];
  }
}

/**
 * Was die Ansicht zu einem Ereignis des Zugs zeigt (ein Ereignis eines anderen Fahrzeugs: undefined): Töne, die Figur
 * hüpft beim Winken und Aussteigen (mit Herz), das Tier, das beiseite hüpft, Tok, wenn er in der Bucht aussteigt (Herz)
 */
export function trainFx(e: RideEvent, state?: State): RideFx | undefined {
  if (e.id !== TRAIN.id) return undefined;
  const back = whistleBack(e, state); // Pfeif-Gruß: Murmeltiere pfeifen zurück
  const score = [...trainScores(e, state), ...back.score];
  const chorus = back.chorus.length ? { chorus: back.chorus } : {};
  switch (e.what) {
    case 'alight':
      return { score, who: 'player', heart: true };
    case 'wave':
      return { score, who: 'player', ...chorus };
    case 'shoo':
      return { score, who: e.who };
    case 'guest':
      return { score, who: e.who, heart: true };
    case 'snore':
      return { score, zzz: true };
    case 'feast':
      return { score, who: 'player', heart: true, burst: SPARKS };
    case 'farewell': {
      const bat = batOf(state);
      return bat ? { score, who: bat, heart: true } : { score };
    }
    case 'cheer': // Laternenfahrt: Tiere der Grotte winken, Murmeltiere pfeifen dazu
      return state?.animals.find((a) => a.id === e.who)?.species === 'murmeltier'
        ? { score: [marmot()], who: e.who, heart: true }
        : { score, who: e.who, heart: true };
    default:
      return { score, ...chorus };
  }
}

/** Licht der Szene (`View2D.dim`): im Tunnel 0,7-fach (nie dunkler als die Dämmerung, `tunnelNight`), sonst 1 */
export const dim = (state: State, world: World): number => (inTunnel(state, world) ? TUNNEL_LIGHT : 1);
