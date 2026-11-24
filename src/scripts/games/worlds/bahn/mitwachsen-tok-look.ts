// Tok in Bild und Ton, im Paket der Bahn, gleich für 2D und 3D: zu jedem seiner Ereignisse (mitwachsen-herald.ts) Töne,
// Hüpfer, Herz und Steinkrümel (`heraldFx`, Haken `View2D.heraldFx`), und „noch nicht“ am Höhlentor zeigt ihn als den
// fehlenden Schritt (`lacks`, Haken `View2D.lacks`), sobald er fällig ist und solange noch nichts gebaut ist. Töne als
// WebAudio in der C-Pentatonik: „Ju-hu“ ist sein Ton (`TOK_SPECIES`), seine Hacke klopft metallisch „pink“ (Dreieck
// E6 → A5 in 50 ms; „tock“ bleibt dem Specht), schlafend macht er leise „Zzz“ (Sinus G4 → E4). Höchstens drei Stimmen
// zugleich.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint)

import { SPECIES, type GateId, type SpeciesId } from '../../../../data/games/mitwachsen';
import { TOK_CRUMBS } from '../../../../data/games/worlds/bahn/mitwachsen-tok-model';
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

/**
 * Bild und Ton zu einem Ereignis von Tok: auftauchen (es klopft pink-pink, Steinkrümel stieben, „Ju-hu“, Hüpfer),
 * ankommen (Ruf, Hüpfer, Herz), rufen und aufwachen (Ruf, Hüpfer), schlafend kommen und schnarchen (leises „Zzz“)
 */
export function heraldFx(e: HeraldEvent): RideFx {
  switch (e.what) {
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
