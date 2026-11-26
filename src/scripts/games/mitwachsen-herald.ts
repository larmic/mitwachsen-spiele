// Bote einer Welt, der mit ihrem Paket kommt (heute Tok, der Gleisbauer der Höhlenwelt, Paket worlds/bahn/) – nur Typen
// und was der Kern über ihn wissen muss: Er ist ein Wesen unter den Tieren (`mode: 'herald'`, mit dem Modell seiner Art),
// singt und hüpft, wenn die Figur in ihn hineinläuft, hat einen Gast-Platz in der Leiste, der Pfeil der Karte zeigt auf
// ihn, und schläft er (`nap`), schwebt „Zzz“ über ihm. Wann er kommt, wo er wartet und was gespeichert wird, regelt sein
// Paket (`WorldRules.herald`, worlds/bahn/mitwachsen-tok.ts); `step` reicht ihm den Zustand herein. Fehlt das Paket (vor der
// Eis-Welt oder wenn es nicht lädt), gibt es ihn nicht. Teil der Regeln (mitwachsen-state.ts) und der Ansicht.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint)

import type { GateId } from '../../data/games/mitwachsen';
import type { Guided } from './mitwachsen-guide';
import type { PackEvent } from './mitwachsen-pack-types';
import {
  vehiclesOf,
  type MoveCmd,
  type RideEngine,
  type RideEvents,
  type RideRules,
  type Rider,
  type Vehicle,
} from './mitwachsen-rider';
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
  dig?: Work;
};

/**
 * Arbeit eines Boten (Tok baut: Bau 1 und Bau 2 in `work`; der Maulwurf gräbt den Glitzergang der Grubenbahn in `dig`,
 * worlds/grube/mitwachsen-dig.ts; zwei Felder, damit keiner die Arbeit des anderen für seine hält), von Takt `from` bis vor Takt `to` (`to` Infinity: Sie wartet noch,
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
 * Zug (`board`). Der Maulwurf, Bote der Grubenbahn (worlds/grube/mitwachsen-dig.ts): Er klopft am Grubenhalt und die
 * Erdwelle läuft (`dig`), der Glitzergang ist gegraben (`dug`, die Welt wird neu gebaut, gleich gespeichert), Funkel ist
 * aus dem Gang an den Halt gerollt (`rolled`). `persist`: gleich speichern; `relay`: Der Spielstand der Pakete, nach dem ein
 * Paket ohne eigene Welt legt, hat sich geändert, die Welt wird neu gebaut (`World.relay`)
 */
export type HeraldEvent = {
  type: 'herald';
  what:
    | 'appear'
    | 'arrive'
    | 'call'
    | 'nap'
    | 'snore'
    | 'wake'
    | 'build'
    | 'sink'
    | 'pop'
    | 'board'
    | 'dig'
    | 'dug'
    | 'rolled';
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
 * Bau; solange er baut, hüpft die Figur nur). `hold`: vor allem anderen, auch vor dem Ritual und den Fahrzeugen; true,
 * solange er arbeitet und die Figur nur hüpft (der Maulwurf gräbt: Niemand steigt dabei in ein Fahrzeug)
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
  hold?(s: Heralded, cmd: MoveCmd, events: HeraldEvents): boolean;
};

/** Der Bote, wenn er da ist (ein Wesen mit `mode: 'herald'`) */
export const heraldOf = <A extends { mode: string }>(s: { animals: readonly A[] }): A | undefined =>
  s.animals.find((a) => a.mode === 'herald');

/** Ohne Ritual am Tor (sein Paket fehlt): Es tut nichts */
const NONE: HeraldRules = { step: () => {}, meet: () => false };

type Hooks = {
  rules?: {
    ride?: RideEngine;
    vehicle?: Vehicle;
    more?: readonly Vehicle[];
    herald?: HeraldRules;
    ritual?: HeraldRules;
  };
};
// je Fahr-Engine die zuletzt gebauten Regeln: `step` fragt in jedem Befehl, die Fahrzeuge ändern sich nur, wenn ein Paket kommt
const built = new WeakMap<RideEngine, { vehicles: readonly Vehicle[]; rules: RideRules }>();

/** Regeln aller Fahrzeuge: die Fahr-Engine (Paket der Fahrzeuge) mit den Fahrzeugen der geladenen Pakete */
function ridesOf(rules: readonly Hooks[]): RideRules | undefined {
  const engine = rules.find((r) => r.rules?.ride)?.rules?.ride;
  const vehicles = vehiclesOf(rules);
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
 * Fahrzeugen der Pakete, Schlitten, Zug und Funkel; ohne Engine oder ohne Fahrzeug keine), Boten (`herald`: alle aus den
 * Paketen in ihrer Reihe, Tok aus dem Paket der Bahn und der Maulwurf aus dem Paket der Grubenbahn; ohne Paket keiner;
 * danach das Ritual am Tor einer Welt, `ritual`, das Hau-ruck aus dem Paket der Höhlenwelt) und was vor dem Schritt der
 * Figur kommt (`meet`: zuerst, ob ein Bote arbeitet und sie nur hüpft, `hold`; beim Hau-ruck ein Stoß; am Fahrzeug
 * einsteigen, anstoßen, winken; in den schlafenden Boten laufen); true, wenn der Zug damit erledigt ist
 */
export function hooksOf(rules: readonly Hooks[]) {
  const ride = ridesOf(rules);
  const heralds = rules.flatMap((r) => (r.rules?.herald ? [r.rules.herald] : []));
  const ritual = rules.find((r) => r.rules?.ritual)?.rules?.ritual ?? NONE;
  const herald: HeraldRules = {
    step: (...a) => {
      for (const h of heralds) h.step(...a);
      ritual.step(...a);
    },
    meet: (...a) => ritual.meet(...a) || heralds.some((h) => h.meet(...a)),
  };
  const meet = (s: Rider & Heralded, world: World, cmd: MoveCmd, events: RideEvents & HeraldEvents) =>
    heralds.some((h) => h.hold?.(s, cmd, events)) ||
    ritual.meet(s, world, cmd, events) ||
    !!ride?.move(s, world, cmd, events) ||
    heralds.some((h) => h.meet(s, world, cmd, events));
  return { ride, herald, meet };
}
