// Der verlaufene Pinguin holt die Figur ab – rein, ohne DOM: Hat das Eistor seinen Schlüssel (den Pinguin) und ist die
// Leiste der Lichtung voll (je Art ein Tier auf der Wiese), taucht er am Bett neben der Figur auf und führt sie zur Bucht vor dem Eistor; dort
// stellt er sich neben die Torplatte, und steht die Figur darauf, geht es mit ihm auf (die Regeln dazu im Welt-Paket der
// Eis-Welt: worlds/eis/mitwachsen-lead.ts, mitwachsen-bay.ts und mitwachsen-ritual.ts). Hier steht, was immer gebraucht
// wird: wann er fällig ist, dass er solange nicht im Kessel wohnt, ob er gerade führt und ob das Tor gerade aufgeht
// (wo die Bucht liegt, weiß nur das Welt-Paket: worlds/eis/mitwachsen-bay.ts). Nichts davon wird gespeichert: Ob er da ist, folgt aus dem Spielstand. Teil der Regeln
// (mitwachsen-state.ts) und der Ansicht.
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“)

import type { Dir, Projection } from '../../lib/games/front';
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
import type { World } from './mitwachsen-world';

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
// Das Eistor geht auf (worlds/eis/mitwachsen-ritual.ts): So viele Takte nach dem Öffnen rutscht der Pinguin durch den Gang hinter
// das Tor (2,4 s); so lange dauert das Ritual, in dem jeder Pfeil die Figur nur hüpfen lässt (3 s)
export const SLIDE = 24;
export const RITUAL = 30;

export type GuideEvent =
  | { type: 'guide'; id: string; species: SpeciesId; x: number; y: number } // taucht neben der Figur auf
  | { type: 'arrive'; id: string; species: SpeciesId } // ist zur Figur gewatschelt: hüpft und zeigt ein Herz
  | { type: 'peep'; id: string; species: SpeciesId } // dreht sich zur Figur und piept
  | { type: 'bob'; id: string } // hüpft still (neben der Torplatte, alle 2 s)
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
    wait?: number; // beim führenden Pinguin: Takte, die er mit der Figur in der Bucht wartet (nicht gespeichert)
  }[];
  garden: { id: string; species: SpeciesId }[];
  followers: string[];
  day: number;
  calm: number; // Tag, an dem der Pinguin eingezogen ist: an ihm kein Pustewind
  ritual: number; // Takt, an dem das Eistor mit ihm aufging (-1: noch nicht)
  still: number; // Takte, die die Figur schon auf demselben Feld steht (jeder Schritt: 0; nicht gespeichert)
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
 * Regeln des Führens (worlds/eis/mitwachsen-lead.ts, im Welt-Paket als `pack.lead`): Die Ansicht reicht sie `step`
 * erst herein, wenn der Pinguin fällig ist (`pending`); vorher taucht er nicht auf.
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
/** Die erste Art der Lichtung, von der noch kein Tier auf der Wiese wohnt (undefined: die Leiste ist voll) */
const lacking = (s: Pick<Guided, 'garden'>) => {
  const home = new Set(s.garden.map((p) => p.id));
  return REGIONS[0].animals.find(({ species }) => !LICHTUNG.some((a) => a.species === species && home.has(a.id)))
    ?.species;
};
/**
 * Soll er da sein? Schlüssel am Tor, Tor zu, und die Leiste der Lichtung ist voll: Von jeder Art der Lichtung wohnt
 * mindestens ein Tier auf der Wiese (wie viele es je Art sind, sieht das Kind nirgends)
 */
export const wanted = (s: Pick<Guided, 'openGates' | 'garden'>): boolean => keyed(s.openGates) && !lacking(s);

/**
 * Was dem Eistor noch fehlt, als nächster Schritt für das Kind (nicht ein fernes Ziel): die erste Art der Lichtung, die
 * noch nicht auf der Wiese wohnt (in der Reihe der Leiste), sonst der Pinguin
 */
export const missing = (s: Pick<Guided, 'garden'>): SpeciesId => lacking(s) ?? 'pinguin';

/**
 * „Noch nicht“ in der Ansicht: an welchem Tor (`id`), wann es zu zeigen begann, was fehlt (ms; Wackeln der Flügel; noch
 * nie: fehlt), und, sobald nachgeladen, die Zeichnung des Umrisses (mitwachsen-hint-look.ts)
 */
export type Hint = { id?: GateId; at?: number; draw?: HintDraw };
export type HintDraw = (ctx: CanvasRenderingContext2D, world: World, P: Projection, now: number) => void;
export const HINT_AFTER = 10; // „noch nicht“: so lange (1 s) steht die Figur auf der Torplatte, dann zeigt das Tor, was fehlt …
export const HINT_EVERY = 50; // … höchstens alle 5 s, und je Stehen einmal
/**
 * „Noch nicht“ am Eistor (rein, ändert nichts, öffnet nichts): Steht die Figur seit `HINT_AFTER` Takten auf seiner
 * Torplatte (nur Stehen zählt, `still`; eine schlafende liegt im Bett), ist es zu und führt kein Pinguin (er ist auch
 * nicht schon fällig oder auf dem Weg zur Figur, `guideDue`: dann kommt er ja gleich), zeigt das Tor freundlich, was
 * fehlt (`missing`); `last`: Takt, an dem es das zuletzt tat. Je Stehen einmal (danach steht die Figur einfach da und schaut
 * das Tor an) und höchstens alle `HINT_EVERY` Takte, auch beim Rauf und Runter; kam es eben erst, holt es das im selben
 * Stehen nach, sobald 5 s um sind. Liefert die fehlende Art, sonst undefined. Bild und Ton macht die Ansicht.
 */
export const hint = (s: Guided, world: World, last: number): SpeciesId | undefined =>
  s.still >= HINT_AFTER &&
  s.tick - last >= HINT_EVERY &&
  s.tick - s.still > last &&
  keyed(s.openGates) &&
  s.guideDue < 0 &&
  !leader(s) &&
  world.cell(s.player.x, s.player.y).plate === GUIDE_GATE
    ? missing(s)
    : undefined;

/**
 * Braucht es die Regeln des Pinguins (worlds/eis/mitwachsen-lead.ts)? Solange er fällig ist und nach dem Öffnen, bis er auf der
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
 * Ansicht: Umriss auf der Tür, goldener Rand der Torplatte, Gast-Platz auf der Leiste, Pfeil der Karte)
 */
export const guideGate = (s: Shown): GateId | null =>
  leader(s) && (!s.openGates.includes(GUIDE_GATE) || opening(s, SLIDE)) ? GUIDE_GATE : null;
