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
  animalId,
  gateOfKey,
  keyOf,
  regionAnimalList,
  regionBehind,
  type GateId,
  type Point,
  type Region,
  type RegionId,
  type SpeciesId,
} from '../../data/games/mitwachsen';
import type { Mode } from './mitwachsen-border';
import type { Crowd } from './mitwachsen-free';
import { PENGUIN, type Home } from './mitwachsen-meadow';
import type { World } from './mitwachsen-world';

export const GUIDE = PENGUIN; // der verlaufene Pinguin
export const GUIDE_GATE: GateId = gateOfKey('pinguin') ?? 'eis'; // sein Tor: Er ist der Schlüssel (`GATES`, `opens`)
export const DUE = 20; // so viele Takte, nachdem das letzte Tier der Lichtung eingezogen ist, taucht er auf
export const APPEAR = [4, 6] as const; // so weit neben der Figur (in Feldern, auch schräg)
export const NEAR = 2; // so nah muss die Figur kommen, dann läuft er die nächste Strecke
export const FAR = 4; // weiter weg (oder nicht mehr hinter ihm): Er holt sie ein und stellt sich wieder vor sie
export const LOST = 10; // noch weiter weg (nach einer Reise mit der Plattform): Er taucht wieder neben ihr auf
export const PEEP_EVERY = 40; // höchstens so oft piept er (4 s), damit es nicht nervt
// Takte je Schritt, beim Ankommen, Führen und Einholen: etwas schneller als die Figur mit gehaltener Taste (ein Schritt
// alle 260 ms), damit sie ihm folgen kann, ohne in ihn hineinzulaufen, und er sie einholt
export const PACE = { lead: 2, chase: 2 };
// Das Eistor geht auf (worlds/eis/mitwachsen-ritual.ts): Nach dem Vorspiel (die Kamera dreht zur Front, ohne Sperre;
// `leadTicks` in mitwachsen-turn-pace.ts) beginnt das Ritual. So viele Takte danach rutscht der Pinguin durch den Gang
// hinter das Tor (2,4 s); so lange dauert das Ritual, in dem jeder Pfeil die Figur nur hüpfen lässt (3 s, in jeder Lage)
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
    nap?: true; // ein Bote schläft (Tok, am Abend gekommen: mitwachsen-herald.ts)
    wait?: number; // beim führenden Pinguin: Takte, die er mit der Figur in der Bucht wartet (nicht gespeichert)
    bench?: true; // wartet am Halt eines Fahrzeugs (mitwachsen-border.ts, `BENCH`)
  }[];
  garden: { id: string; species: SpeciesId }[];
  followers: string[];
  day: number;
  calm: number; // Tag, an dem der Pinguin eingezogen ist: an ihm kein Pustewind
  ritual: number; // Takt, an dem das Ritual am Eistor beginnt, nach dem Vorspiel (-1: noch nicht)
  still: number; // Takte, die die Figur schon auf demselben Feld steht (jeder Schritt: 0; nicht gespeichert)
  // Takt, ab dem er auftaucht; ist er da, der Takt seines Auftauchens, solange er erst zur Figur watschelt (-1: weder
  // fällig noch unterwegs zur Figur; nicht gespeichert)
  guideDue: number;
};
type Swap = { type: 'swap'; id: string };
/** Ereignisse eines Befehls: Die Regeln des Pinguins lesen sie und hängen ihre an */
export type GuideEvents = { readonly type: string; readonly id?: string }[] & {
  push(
    ...e: (
      GuideEvent | Swap | { type: 'home'; id: string; species: SpeciesId } | { type: 'gate'; id: GateId; at: number }
    )[]
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

/** Hat das Tor einen Schlüssel (`opens: { key }`) und ist noch zu? Dann ist sein Bote verlaufen. */
export const keyed = (open: readonly GateId[], gate: GateId = GUIDE_GATE) => !open.includes(gate) && !!keyOf(gate);
/**
 * Der Bote eines Tors als Tier: das erste Tier der Schlüssel-Art in der Gegend hinter dem Tor (beim Eistor der
 * Pinguin `eis:pinguin`); undefined, wenn das Tor keinen Schlüssel oder keine Gegend dahinter hat
 */
export function keyAnimal(gate: GateId): string | undefined {
  const key = keyOf(gate);
  const region = regionBehind(gate);
  return key && region ? animalId(region.id, key) : undefined;
}
/**
 * Wohnt dieses Tier gerade nicht in seiner Gegend, weil es sich verlaufen hat? Der Bote eines Tors, solange es zu ist
 * (heute der Pinguin)
 */
export const lost = (id: string, open: readonly GateId[]) =>
  GATES.some((g) => keyed(open, g.id) && keyAnimal(g.id) === id);

/**
 * Die erste Art einer Gegend (sonst der Lichtung), von der noch kein Tier auf ihrer Wiese wohnt (undefined: ihre Leiste
 * ist voll). Tiere der Landschaft zählen nicht; in der Eis-Welt zählt der Pinguin mit.
 */
const lacking = (s: Pick<Guided, 'garden'>, region: Region = REGIONS[0]) => {
  const home = new Set(s.garden.map((p) => p.id));
  const all = regionAnimalList(region);
  return region.animals.find(({ species }) => !all.some((a) => a.species === species && home.has(a.id)))?.species;
};
/** Ist die Leiste einer Gegend voll? Von jeder ihrer Arten wohnt mindestens ein Tier auf ihrer Wiese (Fahrzeug fällig) */
export const full = (s: Pick<Guided, 'garden'>, region: Region) => !lacking(s, region);
/** Gegend, in der ein Tor steht (alle großen Tore stehen heute auf der Lichtung) */
const standsIn = (gate: GateId): Region =>
  REGIONS.find((r) => GATES.some((g) => g.id === gate && g.region === r.id)) ?? REGIONS[0];
/**
 * Soll der Bote des Tors `gate` da sein? Schlüssel am Tor, Tor zu, und die Leiste der Gegend `region` ist voll: Von
 * jeder ihrer Arten wohnt mindestens ein Tier auf ihrer Wiese (wie viele es je Art sind, sieht das Kind nirgends).
 * Ohne Angabe der Pinguin und die Leiste der Gegend, in der sein Tor steht (die Lichtung)
 */
export const wanted = (
  s: Pick<Guided, 'openGates' | 'garden'>,
  gate: GateId = GUIDE_GATE,
  region: Region = standsIn(gate),
): boolean => keyed(s.openGates, gate) && !lacking(s, region);

/**
 * Was einem Tor noch fehlt, als nächster Schritt für das Kind (nicht ein fernes Ziel): die erste Art der Gegend, in der
 * es steht, die noch nicht auf ihrer Wiese wohnt (in der Reihe der Leiste), sonst sein Bote (beim Eistor der Pinguin)
 */
export const missing = (s: Pick<Guided, 'garden'>, gate: GateId = GUIDE_GATE): SpeciesId =>
  lacking(s, standsIn(gate)) ?? keyOf(gate) ?? 'pinguin';

/**
 * „Noch nicht“ in der Ansicht: an welchem Tor (`id`), wann es zu zeigen begann, was fehlt (ms; Wackeln der Flügel; noch
 * nie: fehlt), und, sobald nachgeladen, die Zeichnung des Umrisses (mitwachsen-hint-look.ts)
 */
export type Hint = { id?: GateId; at?: number; draw?: HintDraw };
export type HintDraw = (ctx: CanvasRenderingContext2D, world: World, P: Projection, now: number) => void;
export const HINT_AFTER = 10; // „noch nicht“: so lange (1 s) steht die Figur auf der Torplatte, dann zeigt das Tor, was fehlt …
export const HINT_EVERY = 50; // … höchstens alle 5 s, und je Stehen einmal
/** Steht die Figur seit `HINT_AFTER` Takten, ist es ein neues Stehen und sind seit `last` `HINT_EVERY` Takte um? */
const ripe = (s: Pick<Guided, 'still' | 'tick'>, last: number) =>
  s.still >= HINT_AFTER && s.tick - last >= HINT_EVERY && s.tick - s.still > last;
/**
 * „Noch nicht“ an einem Tor mit Schlüssel (heute das Eistor; rein, ändert nichts, öffnet nichts): Steht die Figur seit
 * `HINT_AFTER` Takten auf seiner Torplatte (nur Stehen zählt, `still`; eine schlafende liegt im Bett), ist es zu und
 * führt kein Bote (er ist auch nicht schon fällig oder auf dem Weg zur Figur, `guideDue`: dann kommt er ja gleich),
 * zeigt das Tor freundlich, was fehlt (`missing`); `last`: Takt, an dem es das zuletzt tat. Je Stehen einmal (danach steht die Figur einfach da und schaut
 * das Tor an) und höchstens alle `HINT_EVERY` Takte, auch beim Rauf und Runter; kam es eben erst, holt es das im selben
 * Stehen nach, sobald 5 s um sind. Liefert die fehlende Art, sonst undefined. Bild und Ton macht die Ansicht.
 */
export const hint = (s: Guided, world: World, last: number): SpeciesId | undefined => {
  const gate = world.cell(s.player.x, s.player.y).plate;
  return gate && ripe(s, last) && keyed(s.openGates, gate) && s.guideDue < 0 && !leader(s)
    ? missing(s, gate)
    : undefined;
};
/**
 * „Noch nicht“ an einem Tor, das nie aufgeht (`opens: 'never'`, rein, ändert nichts, öffnet nichts): Steht die Figur
 * seit `HINT_AFTER` Takten auf seiner Torplatte, zeigt es freundlich das Zeichen seiner Welt, getaktet wie am Eistor (je
 * Stehen einmal, höchstens alle `HINT_EVERY` Takte; `last` wie bei `hint`). Keine Bedingung, kein Tier: Es fehlt
 * nichts, was das Kind tun könnte. Liefert das Tor, sonst undefined; Bild und Ton macht mitwachsen-hint-look.ts
 */
export const nope = (s: Guided, world: World, last: number): GateId | undefined => {
  const id = world.cell(s.player.x, s.player.y).plate;
  return ripe(s, last) && GATES.some((g) => g.id === id && g.opens === 'never') ? id : undefined;
};

/**
 * Braucht es die Regeln des Boten eines Tors (beim Eistor der Pinguin, worlds/eis/mitwachsen-lead.ts)? Solange er
 * fällig ist und nach dem Öffnen, bis er auf der Wiese seiner Gegend wohnt (beim Pinguin die Schneewiese)
 */
export const pending = (s: Pick<Guided, 'openGates' | 'garden'>, gate: GateId = GUIDE_GATE): boolean => {
  const id = keyAnimal(gate);
  return wanted(s, gate) || (!!id && s.openGates.includes(gate) && !s.garden.some((p) => p.id === id));
};

/** Der Pinguin, wenn er da ist: Er führt zum Tor bzw. ist nach dem Öffnen auf dem Weg zum Schneebett */
export const leader = <A extends { mode: Mode }>(s: { animals: readonly A[] }): A | undefined =>
  s.animals.find((a) => a.mode === 'lead');
/**
 * Geht das Eistor gerade auf? Im Vorspiel und höchstens `span` Takte, seit das Ritual begann. Die Sperre gilt erst ab
 * Beginn des Rituals (`hold` in worlds/eis/mitwachsen-ritual.ts, die Kamera vorn in mitwachsen-turn-3d.ts)
 */
export const opening = (s: { tick: number; ritual: number }, span = RITUAL) =>
  s.ritual >= 0 && s.tick - s.ritual < span;
type Shown = { animals: readonly { mode: Mode }[]; openGates: readonly GateId[]; tick: number; ritual: number };
/**
 * Tor, zu dem er führt, solange er da ist und das Tor zu ist oder gerade aufgeht (samt Vorspiel), bis er hindurchrutscht
 * (für die Ansicht: Umriss auf der Tür, goldener Rand der Torplatte, Gast-Platz auf der Leiste, Pfeil der Karte)
 */
export const guideGate = (s: Shown): GateId | null =>
  leader(s) && (!s.openGates.includes(GUIDE_GATE) || opening(s, SLIDE)) ? GUIDE_GATE : null;
