// Tok in Bild und Ton, im Paket der Bahn, gleich für 2D und 3D: zu jedem seiner Ereignisse (mitwachsen-herald.ts) Töne,
// Hüpfer, Herz und Steinkrümel (`heraldFx`, Haken `View2D.heraldFx`), und „noch nicht“ am Höhlentor zeigt ihn als den
// fehlenden Schritt (`lacks`, Haken `View2D.lacks`), sobald er fällig ist und solange noch nichts gebaut ist. Töne als
// WebAudio in der C-Pentatonik: „Ju-hu“ ist sein Ton (`TOK_SPECIES`), seine Hacke klopft metallisch „pink“ (Dreieck
// E6 → A5 in 50 ms; „tock“ bleibt dem Specht), schlafend macht er leise „Zzz“ (Sinus G4 → E4). Bau 1: pink-pink-pink,
// „plopp“, „klonk“ der Schienen, Pfiff, „Ding-Dong“, „pff“ (`buildScore`). Höchstens drei Stimmen zugleich.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint)

import { SPECIES, type GateId, type SpeciesId } from '../../../../data/games/mitwachsen';
import { BUILD } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import { TOK_CRUMBS } from '../../../../data/games/worlds/bahn/mitwachsen-tok-model';
import { RULE_TICK_MS } from '../../mitwachsen-turn-pace';
import type { HeraldEvent, Heralded } from '../../mitwachsen-herald';
import type { RideFx } from '../../mitwachsen-ride-view';
import type { Scored } from '../../sfx';
import { builtOf } from './mitwachsen-built';
import { tokWanted } from './mitwachsen-tok';
import { tokOf } from './mitwachsen-tok-save';

/** Hacke „pink“: Dreieck E6 → A5 (1319 → 880 Hz) in 50 ms, metallisch, ab `at` s */
export const pink = (at = 0): Scored => [1318.51, 0.05, 'triangle', 0.05, 880 / 1318.51, at];
/** Leises „Zzz“ des schlafenden Tok: Sinus G4, gleitet zu E4 */
export const ZZZ: Scored = [392, 0.5, 'sine', 0.03, 329.63 / 392, 0];

/** „Ju-hu“, ab `at` s: Toks Ton (E4–G4–E4, Rechteck) als Partitur */
export function juhu(at = 0): Scored[] {
  const { notes, wave, len, gap, gain = 0.05 } = SPECIES.tok.tone;
  return notes.map((f, i): Scored => [f, len, wave, gain, 1, at + i * (len + gap)]);
}

/** Bahnhof Bär ploppt auf: Sinus C5, gleitet hinauf zu G5 */
export const plopp = (at = 0): Scored => [523.25, 0.12, 'sine', 0.05, 783.99 / 523.25, at];
/** Schiene „klonk“: Rechteck G3 und D4 zugleich, metallisch, ohne Rauschen */
export const klonk = (at = 0): Scored[] => [
  [196, 0.12, 'square', 0.04, 1, at],
  [293.66, 0.12, 'square', 0.04, 1, at],
];
/** Pfiff des Zugs: Sinus A5, gleitet zu C6 */
export const whistle = (at = 0): Scored => [880, 0.4, 'sine', 0.04, 1046.5 / 880, at];
/** „Ding-Dong“ an den Türen: Dreieck E5, dann C5 */
export const dingDong = (at = 0): Scored[] => [
  [659.25, 0.25, 'triangle', 0.06, 1, at],
  [523.25, 0.3, 'triangle', 0.06, 1, at + 0.27],
];
/** Die Tür geht auf, „pff“: weiches Dreieck G4, fällt zu C4 */
export const pff = (at = 0): Scored => [392, 0.15, 'triangle', 0.03, 261.63 / 392, at];

/** Sekunden ab dem Beginn des Baus bis zu einem seiner Augenblicke (`BUILD`, Bruchteil des Baus) */
const sec = (beat: number) => (beat * BUILD.ticks * RULE_TICK_MS) / 1000;

/**
 * Töne des ganzen Baus 1, eingeplant zu seinem Beginn: pink-pink-pink, Bahnhof Bär ploppt auf, je Stufe der Gleiswelle
 * ein „klonk“, Pfiff, wenn der Zug heranrollt, „Ding-Dong“, „pff“ (das „Ju-hu“ kommt, wenn Tok einsteigt)
 */
export function buildScore(): Scored[] {
  const [w0, w1] = BUILD.wave;
  return [
    pink(0),
    pink(0.25),
    pink(0.5),
    plopp(sec(BUILD.pop)),
    ...[0, 1, 2].flatMap((k) => klonk(sec(w0 + (k * (w1 - w0)) / 3))),
    whistle(sec(BUILD.roll[0])),
    ...dingDong(sec(BUILD.ding)),
    pff(sec(BUILD.door)),
  ];
}

/**
 * Bild und Ton zu einem Ereignis von Tok: auftauchen (es klopft pink-pink, Steinkrümel stieben, „Ju-hu“, Hüpfer),
 * ankommen (Ruf, Hüpfer, Herz), rufen und aufwachen (Ruf, Hüpfer), schlafend kommen und schnarchen (leises „Zzz“), Bau 1
 * beginnen (die Töne des ganzen Baus, Hüpfer, Steinkrümel), in den Zug steigen („Ju-hu“)
 */
export function heraldFx(e: HeraldEvent): RideFx {
  switch (e.what) {
    case 'build':
      return { score: buildScore(), who: e.id, burst: TOK_CRUMBS };
    case 'pop':
      return { score: [] }; // das Plopp klingt schon mit den Tönen des Baus
    case 'board':
      return { score: juhu() };
    case 'appear':
      return { score: [pink(0), pink(0.16), ...juhu(0.4)], who: e.id, burst: TOK_CRUMBS };
    case 'arrive':
      return { score: juhu(), who: e.id, heart: true };
    case 'call':
    case 'wake':
      return { score: juhu(), who: e.id };
    case 'nap':
    case 'snore':
      return { score: [ZZZ] };
  }
}

/**
 * Was dem Höhlentor fehlt, als nächster Schritt für das Kind: Tok, sobald er fällig ist (`tokWanted`) oder schon kam,
 * solange noch nichts gebaut ist (Ausbau 0). Vorher (Eis-Welt nicht fertig, keine Heimfahrt mit dem Schlitten) und
 * danach nichts von hier: Das Tor zeigt das Zeichen seiner Welt
 */
export const lacks = (state: Pick<Heralded, 'openGates' | 'garden' | 'packs'>, gate: GateId): SpeciesId | undefined =>
  gate === 'hoehle' && builtOf(state.packs) === 0 && (tokWanted(state) || tokOf(state.packs) !== undefined)
    ? 'tok'
    : undefined;
