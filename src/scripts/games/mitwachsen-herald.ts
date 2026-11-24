// Bote einer Welt, der mit ihrem Paket kommt (heute Tok, der Gleisbauer der Höhlenwelt, Paket worlds/bahn/) – nur Typen
// und was der Kern über ihn wissen muss: Er ist ein Wesen unter den Tieren (`mode: 'herald'`, mit dem Modell seiner Art),
// singt und hüpft, wenn die Figur in ihn hineinläuft, hat einen Gast-Platz in der Leiste, der Pfeil der Karte zeigt auf
// ihn, und schläft er (`nap`), schwebt „Zzz“ über ihm. Wann er kommt, wo er wartet und was gespeichert wird, regelt sein
// Paket (`WorldRules.herald`, worlds/bahn/mitwachsen-tok.ts); `step` reicht ihm den Zustand herein. Fehlt das Paket (bis
// zum Freischalten der Bahn-Phase, `BAHN_LIVE`), gibt es ihn nicht. Teil der Regeln (mitwachsen-state.ts) und der Ansicht.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint)

import type { GateId } from '../../data/games/mitwachsen';
import type { Guided } from './mitwachsen-guide';
import type { PackEvent } from './mitwachsen-pack-types';
import type { MoveCmd, RideEngine, RideEvents, RideRules, Rider, Vehicle } from './mitwachsen-rider';
import type { World } from './mitwachsen-world';

/**
 * Was ein Bote vom Zustand sieht und ändern darf: wie beim Pinguin (`Guided`), dazu den gespeicherten Zustand der Pakete
 * (`packs`), ob es Abend ist (`late`: die Uhr des Kinds hat `BED_AT` erreicht; die Komponente setzt es, nicht
 * gespeichert) und den Takt, ab dem er auftaucht (`heraldDue`, -1: nicht fällig; nicht gespeichert)
 */
export type Heralded = Guided & {
  packs: Record<string, unknown>;
  late: boolean;
  heraldDue: number;
  work?: Work;
};

/**
 * Arbeit eines Boten (Tok baut: Bau 1 und Bau 2), von Takt `from` bis vor Takt `to` (`to` Infinity: Sie wartet noch,
 * Fortschritt 0; Bau 2 wartet auf den Zug am Prellbock); solange hüpft die Figur auf jeden Pfeil nur
 * (nicht gespeichert: Wer mitten im Bau neu lädt, findet ihn fertig, denn sein Ergebnis ist schon gespeichert).
 * `laid`: Was er baut, steht schon in der Welt (sie wurde neu gebaut, `relay`)
 */
export type Work = { from: number; to: number; laid?: true };

/** Wie weit die Arbeit eines Boten ist (0 … 1), undefined, wenn er gerade nichts baut */
export const workOf = (s: { tick: number; work?: Work }): number | undefined =>
  s.work && s.tick < s.work.to ? Math.max(0, (s.tick - s.work.from) / (s.work.to - s.work.from)) : undefined;

/**
 * Ereignis eines Boten: Es klopft, und er hüpft aus einem Hügel Steinkrümel neben der Figur (`appear`, gespeichert), ist
 * bei ihr angekommen (`arrive`: Hüpfer, Herz), ruft an seinem Platz (`call`: Ruf und Hüpfer), kommt am Abend schon
 * schlafend (`nap`, gespeichert), schnarcht leise, wenn man in ihn hineinläuft, während er schläft (`snore`), wacht am
 * nächsten echten Spieltag auf (`wake`, Ruf und Hüpfer), beginnt zu bauen (`build`: Läuft die Figur in den wachen Boten
 * und gibt es einen nächsten Bau, Tok: Bau 1), beginnt Bau 2 am Prellbock in der Bucht (`sink`: Er klopft, der
 * Prellbock versinkt), was er baut, ploppt auf (`pop`, die Welt wird neu gebaut) und er steigt am Ende des Baus in den
 * Zug (`board`). `persist`: gleich speichern; `relay`: Der Spielstand der Pakete, nach dem ein
 * Paket ohne eigene Welt legt, hat sich geändert, die Welt wird neu gebaut (`World.relay`)
 */
export type HeraldEvent = {
  type: 'herald';
  what: 'appear' | 'arrive' | 'call' | 'nap' | 'snore' | 'wake' | 'build' | 'sink' | 'pop' | 'board';
  id: string;
  x: number;
  y: number;
  persist?: true;
  relay?: true;
};

/**
 * Ereignisse, die ein Bote ausgibt (und die er liest: `wake`, `sleep`); `hop`: Die Figur hüpft nur (er baut); beim
 * Hau-ruck (`WorldRules.ritual`) ein Stoß (`heave`, `PackEvent`) und das Tor geht auf (`gate`, sofort gespeichert)
 */
export type HeraldEvents = { readonly type: string }[] & {
  push(
    ...e: (HeraldEvent | PackEvent | { type: 'bump' } | { type: 'hop' } | { type: 'gate'; id: GateId; at: number })[]
  ): unknown;
};

/**
 * Haken eines Boten in `step` (aus dem Welt-Paket als `WorldRules.herald`). `step`: nach jedem Befehl (fällig,
 * auftauchen, ankommen, warten, rufen, schlafen). `meet`: vor dem Schritt der Figur; true, wenn der Zug damit erledigt
 * ist (in den schlafenden Boten gelaufen: Er schnarcht, die Figur bleibt stehen; in den wachen: Er beginnt den nächsten
 * Bau; solange er baut, hüpft die Figur nur)
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

type Hooks = { rules?: { ride?: RideEngine; vehicle?: Vehicle; herald?: HeraldRules; ritual?: HeraldRules } };
// je Fahr-Engine die zuletzt gebauten Regeln: `step` fragt in jedem Befehl, die Fahrzeuge ändern sich nur, wenn ein Paket kommt
const built = new WeakMap<RideEngine, { vehicles: readonly Vehicle[]; rules: RideRules }>();

/** Regeln aller Fahrzeuge: die Fahr-Engine (Paket der Fahrzeuge) mit den Fahrzeugen der geladenen Pakete */
function ridesOf(rules: readonly Hooks[]): RideRules | undefined {
  const engine = rules.find((r) => r.rules?.ride)?.rules?.ride;
  const vehicles = rules.flatMap((r) => (r.rules?.vehicle ? [r.rules.vehicle] : []));
  if (!engine || !vehicles.length) return undefined;
  const last = built.get(engine);
  if (last && last.vehicles.length === vehicles.length && last.vehicles.every((v, i) => v === vehicles[i]))
    return last.rules;
  const made = engine(vehicles);
  built.set(engine, { vehicles, rules: made });
  return made;
}

/**
 * Die Haken aus den geladenen Paketen für `step`: Fahrzeuge (`ride`: die Fahr-Engine aus dem Paket der Fahrzeuge mit den
 * Fahrzeugen der Pakete, Schlitten und Zug; ohne Engine oder ohne Fahrzeug keine), Bote (`herald`, Tok; ohne Paket einer,
 * der nichts tut; danach das Ritual am Tor einer Welt, `ritual`, das Hau-ruck aus dem Paket der Höhlenwelt) und was vor
 * dem Schritt der Figur kommt (`meet`: beim Hau-ruck ein Stoß; am Fahrzeug einsteigen, anstoßen, winken; in den
 * schlafenden Boten laufen); true, wenn der Zug damit erledigt ist
 */
export function hooksOf(rules: readonly Hooks[]) {
  const ride = ridesOf(rules);
  const one = rules.find((r) => r.rules?.herald)?.rules?.herald ?? NONE;
  const ritual = rules.find((r) => r.rules?.ritual)?.rules?.ritual ?? NONE;
  const herald: HeraldRules = {
    step: (...a) => (one.step(...a), ritual.step(...a)),
    meet: (...a) => ritual.meet(...a) || one.meet(...a),
  };
  const meet = (s: Rider & Heralded, world: World, cmd: MoveCmd, events: RideEvents & HeraldEvents) =>
    ritual.meet(s, world, cmd, events) || !!ride?.move(s, world, cmd, events) || one.meet(s, world, cmd, events);
  return { ride, herald, meet };
}
