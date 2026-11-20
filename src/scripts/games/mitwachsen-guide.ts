// Der verlaufene Pinguin holt die Figur ab – rein, ohne DOM: Hat das Eistor seinen Schlüssel (den Pinguin) und ist die
// Leiste der Lichtung voll (je Art ein Tier auf der Wiese), taucht er am Bett neben der Figur auf und führt sie zur Bucht vor dem Eistor; dort geht
// es mit ihm auf (die Regeln dazu in mitwachsen-lead.ts und mitwachsen-ritual.ts). Hier steht, was immer gebraucht
// wird: wann er fällig ist, dass er solange nicht im Kessel wohnt, ob er gerade führt, ob das Tor gerade aufgeht und wo
// die Bucht liegt. Nichts davon wird gespeichert: Ob er da ist, folgt aus dem Spielstand. Teil der Regeln
// (mitwachsen-state.ts) und der Ansicht.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“)

import type { Dir } from '../../lib/games/front';
import {
  GATES,
  REGIONS,
  regionAnimalList,
  type GateId,
  type Point,
  type RegionId,
  type SpeciesId,
} from '../../data/games/mitwachsen';
import type { Mode } from './mitwachsen-border';
import type { Crowd } from './mitwachsen-free';
import { PENGUIN, type Home } from './mitwachsen-meadow';
import type { GatePlace, World } from './mitwachsen-world';

export const GUIDE = PENGUIN; // der verlaufene Pinguin
export const GUIDE_GATE: GateId = 'eis'; // sein Tor: Er ist der Schlüssel
export const DUE = 20; // so viele Takte, nachdem das letzte Tier der Lichtung eingezogen ist, taucht er auf
export const APPEAR = [4, 6] as const; // so weit neben der Figur (in Feldern, auch schräg)
export const NEAR = 2; // so nah muss die Figur kommen, dann läuft er die nächste Strecke
export const FAR = 4; // weiter weg (oder nicht mehr hinter ihm): Er holt sie ein und stellt sich wieder vor sie
export const LOST = 10; // noch weiter weg (nach einer Reise mit der Plattform): Er taucht wieder neben ihr auf
export const PEEP_EVERY = 40; // höchstens so oft piept er (4 s), damit es nicht nervt
// Takte je Schritt, beim Ankommen, Führen und Einholen: etwas schneller als die Figur mit gehaltener Taste (ein Schritt
// alle 260 ms), damit sie ihm folgen kann, ohne in ihn hineinzulaufen, und er sie einholt
export const PACE = { lead: 2, chase: 2 };
const BAY_DEPTH = 3; // die Bucht reicht so viele Reihen vor die Tür
// Das Eistor geht auf (mitwachsen-ritual.ts): So viele Takte nach dem Öffnen rutscht der Pinguin durch den Gang hinter
// das Tor (2,4 s); so lange dauert das Ritual, in dem jeder Pfeil die Figur nur hüpfen lässt (3 s)
export const SLIDE = 24;
export const RITUAL = 30;

export type GuideEvent =
  | { type: 'guide'; id: string; species: SpeciesId; x: number; y: number } // taucht neben der Figur auf
  | { type: 'arrive'; id: string; species: SpeciesId } // ist zur Figur gewatschelt: hüpft und zeigt ein Herz
  | { type: 'peep'; id: string; species: SpeciesId } // dreht sich zur Figur und piept
  | { type: 'slide'; id: string; species: SpeciesId } // rutscht durch den Gang bzw. voraus zum Schneebett
  | { type: 'breath'; x: number; y: number } // ein kalter Atemzug weht aus dem offenen Eistor Schnee auf die Lichtung
  | { type: 'hop' }; // die Figur hüpft, solange das Eistor aufgeht

/** Was der Pinguin vom Zustand braucht (Teil des Zustands der Regeln) */
export type Guided = Omit<Crowd, 'player' | 'animals' | 'openGates'> & {
  tick: number;
  openGates: GateId[];
  player: { x: number; y: number; dir: Dir };
  animals: {
    id: string;
    species: SpeciesId;
    x: number;
    y: number;
    dir: Dir;
    mode: Mode;
    home: Home;
    realm: RegionId;
    spawn: Point;
    rest: number; // beim führenden Pinguin: Takte bis zum nächsten Piep
  }[];
  garden: { id: string; species: SpeciesId }[];
  followers: string[];
  day: number;
  calm: number; // Tag, an dem der Pinguin eingezogen ist: an ihm kein Pustewind
  ritual: number; // Takt, an dem das Eistor mit ihm aufging (-1: noch nicht)
  // Takt, ab dem er auftaucht; ist er da, der Takt seines Auftauchens, solange er erst zur Figur watschelt (-1: weder
  // fällig noch unterwegs zur Figur; nicht gespeichert)
  guideDue: number;
};
type Swap = { type: 'swap'; id: string };
/** Ereignisse eines Befehls: Die Regeln des Pinguins lesen sie und hängen ihre an */
export type GuideEvents = { readonly type: string; readonly id?: string }[] & {
  push(
    ...e: (GuideEvent | Swap | { type: 'home'; id: string; species: SpeciesId } | { type: 'gate'; id: GateId })[]
  ): unknown;
};
/**
 * Regeln des Führens (mitwachsen-lead.ts): Die Ansicht lädt sie erst nach, wenn der Pinguin fällig ist (`wanted`), und
 * reicht sie `step` herein; vorher taucht er nicht auf.
 */
export type GuideRules = {
  guide(s: Guided, world: World, cmd: 'move' | 'action' | 'tick', events: GuideEvents, explored: Explored): void;
  meetGuide(s: Guided, world: World, events: GuideEvents): void;
  hold(s: Guided, events: GuideEvents): boolean; // geht das Eistor gerade auf? Dann hüpft die Figur nur
};
type Explored = (x: number, y: number) => boolean;

/** Hat sein Tor den Schlüssel und ist noch zu? Dann ist der Pinguin verlaufen (und wohnt nicht hinter dem Tor). */
const keyed = (open: readonly GateId[]) =>
  !open.includes(GUIDE_GATE) && GATES.some((g) => g.id === GUIDE_GATE && g.opens !== 'never');
/** Wohnt dieses Tier gerade nicht in seiner Gegend, weil es sich verlaufen hat? (der Pinguin, solange sein Tor zu ist) */
export const lost = (id: string, open: readonly GateId[]) => id === GUIDE && keyed(open);

const LICHTUNG = regionAnimalList(REGIONS[0]); // Tiere der Landschaft zählen nicht
/**
 * Soll er da sein? Schlüssel am Tor, Tor zu, und die Leiste der Lichtung ist voll: Von jeder Art der Lichtung wohnt
 * mindestens ein Tier auf der Wiese (wie viele es je Art sind, sieht das Kind nirgends)
 */
export function wanted(s: Pick<Guided, 'openGates' | 'garden'>): boolean {
  if (!keyed(s.openGates)) return false;
  const home = new Set(s.garden.map((p) => p.id));
  return REGIONS[0].animals.every(({ species }) => LICHTUNG.some((a) => a.species === species && home.has(a.id)));
}

/**
 * Braucht es die Regeln des Pinguins (mitwachsen-lead.ts)? Solange er fällig ist und nach dem Öffnen, bis er auf der
 * Schneewiese wohnt
 */
export const pending = (s: Pick<Guided, 'openGates' | 'garden'>) =>
  wanted(s) || (s.openGates.includes(GUIDE_GATE) && !s.garden.some((p) => p.id === GUIDE));

/** Der Pinguin, wenn er da ist: Er führt zum Tor bzw. ist nach dem Öffnen auf dem Weg zum Schneebett */
export const leader = <A extends { mode: Mode }>(s: { animals: readonly A[] }): A | undefined =>
  s.animals.find((a) => a.mode === 'lead');
/** Geht das Eistor gerade auf? (höchstens `span` Takte, seit es mit dem Pinguin aufging) */
export const opening = (s: { tick: number; ritual: number }, span = RITUAL) =>
  s.ritual >= 0 && s.tick - s.ritual < span;
type Shown = { animals: readonly { mode: Mode }[]; openGates: readonly GateId[]; tick: number; ritual: number };
/**
 * Tor, zu dem er führt, solange er da ist und das Tor zu ist oder gerade aufgeht, bis er hindurchrutscht (für die
 * Ansicht: Umriss auf der Tür, goldene Bucht, Gast-Platz auf der Leiste, Pfeil der Karte)
 */
export const guideGate = (s: Shown): GateId | null =>
  leader(s) && (!s.openGates.includes(GUIDE_GATE) || opening(s, SLIDE)) ? GUIDE_GATE : null;

/** Bucht vor der Tür eines Tors: so breit wie die Tür, `BAY_DEPTH` Reihen davor, die vorderste Reihe zuerst */
export function bay(g: Pick<GatePlace, 'cells' | 'out'>): Point[] {
  const out: Point[] = [];
  for (let t = 1; t <= BAY_DEPTH; t++) for (const [x, y] of g.cells) out.push([x - g.out[0] * t, y - g.out[1] * t]);
  return out;
}
