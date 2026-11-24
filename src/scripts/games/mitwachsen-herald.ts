// Bote einer Welt, der mit ihrem Paket kommt (heute Tok, der Gleisbauer der Höhlenwelt, Paket worlds/bahn/) – nur Typen
// und was der Kern über ihn wissen muss: Er ist ein Wesen unter den Tieren (`mode: 'herald'`, mit dem Modell seiner Art),
// singt und hüpft, wenn die Figur in ihn hineinläuft, hat einen Gast-Platz in der Leiste, der Pfeil der Karte zeigt auf
// ihn, und schläft er (`nap`), schwebt „Zzz“ über ihm. Wann er kommt, wo er wartet und was gespeichert wird, regelt sein
// Paket (`WorldRules.herald`, worlds/bahn/mitwachsen-tok.ts); `step` reicht ihm den Zustand herein. Fehlt das Paket (bis
// zum Freischalten der Bahn-Phase, `BAHN_LIVE`), gibt es ihn nicht. Teil der Regeln (mitwachsen-state.ts) und der Ansicht.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint)

import type { Guided } from './mitwachsen-guide';
import type { MoveCmd, RideEvents, RideRules, Rider } from './mitwachsen-rider';
import type { World } from './mitwachsen-world';

/**
 * Was ein Bote vom Zustand sieht und ändern darf: wie beim Pinguin (`Guided`), dazu den gespeicherten Zustand der Pakete
 * (`packs`), ob es Abend ist (`late`: die Uhr des Kinds hat `BED_AT` erreicht; die Komponente setzt es, nicht
 * gespeichert) und den Takt, ab dem er auftaucht (`heraldDue`, -1: nicht fällig; nicht gespeichert)
 */
export type Heralded = Guided & { packs: Record<string, unknown>; late: boolean; heraldDue: number };

/**
 * Ereignis eines Boten: Es klopft, und er hüpft aus einem Hügel Steinkrümel neben der Figur (`appear`, gespeichert), ist
 * bei ihr angekommen (`arrive`: Hüpfer, Herz), ruft an seinem Platz (`call`: Ruf und Hüpfer), kommt am Abend schon
 * schlafend (`nap`, gespeichert), schnarcht leise, wenn man in ihn hineinläuft, während er schläft (`snore`), wacht am
 * nächsten echten Spieltag auf (`wake`, Ruf und Hüpfer). `persist`: gleich speichern
 */
export type HeraldEvent = {
  type: 'herald';
  what: 'appear' | 'arrive' | 'call' | 'nap' | 'snore' | 'wake';
  id: string;
  x: number;
  y: number;
  persist?: true;
};

/** Ereignisse, die ein Bote ausgibt (und die er liest: `wake`, `sleep`) */
export type HeraldEvents = { readonly type: string }[] & { push(...e: (HeraldEvent | { type: 'bump' })[]): unknown };

/**
 * Haken eines Boten in `step` (aus dem Welt-Paket als `WorldRules.herald`). `step`: nach jedem Befehl (fällig,
 * auftauchen, ankommen, warten, rufen, schlafen). `meet`: vor dem Schritt der Figur; true, wenn der Zug damit erledigt
 * ist (in den schlafenden Boten gelaufen: Er schnarcht, die Figur bleibt stehen)
 */
export type HeraldRules = {
  step(
    s: Heralded,
    world: World,
    cmd: 'move' | 'action' | 'tick',
    events: HeraldEvents,
    explored: (x: number, y: number) => boolean,
  ): void;
  meet(s: Heralded, world: World, cmd: MoveCmd, events: HeraldEvents): boolean;
};

/** Der Bote, wenn er da ist (ein Wesen mit `mode: 'herald'`) */
export const heraldOf = <A extends { mode: string }>(s: { animals: readonly A[] }): A | undefined =>
  s.animals.find((a) => a.mode === 'herald');

/** Ohne Boten (sein Paket fehlt): Er tut nichts */
const NONE: HeraldRules = { step: () => {}, meet: () => false };

/**
 * Die Haken aus den geladenen Paketen für `step`: Fahrzeug (`ride`, Schlitten), Bote (`herald`, Tok; ohne Paket einer,
 * der nichts tut) und was vor dem Schritt der Figur kommt (`meet`: am Fahrzeug einsteigen, anstoßen, winken; in den
 * schlafenden Boten laufen); true, wenn der Zug damit erledigt ist
 */
export function hooksOf(rules: readonly { rules?: { ride?: RideRules; herald?: HeraldRules } }[]) {
  const ride = rules.find((r) => r.rules?.ride)?.rules?.ride;
  const herald = rules.find((r) => r.rules?.herald)?.rules?.herald ?? NONE;
  const meet = (s: Rider & Heralded, world: World, cmd: MoveCmd, events: RideEvents & HeraldEvents) =>
    !!ride?.move(s, world, cmd, events) || herald.meet(s, world, cmd, events);
  return { ride, herald, meet };
}
