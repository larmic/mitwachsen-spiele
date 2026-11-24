// Fahrzeuge – nur Typen: was die Regeln eines Fahrzeugs vom Zustand sehen (`Rider`), welche Haken `step` ihnen gibt
// (`RideRules`), was ein Paket über sein Fahrzeug sagt (`Vehicle`: Strecke, wann es erscheint) und die Fahr-Engine, die
// daraus die Regeln aller Fahrzeuge macht (`RideEngine`, aus dem Paket der Fahrzeuge worlds/fahrt/). Eigene Datei, weil
// mitwachsen-pack-types.ts von der Welt importiert wird und darum `World` nicht kennen darf.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Der Schlitten“ und „Tok und die Bahn“, Fahren)

import type { Dir } from '../../lib/games/front';
import type { Point, RegionId, SpeciesId } from '../../data/games/mitwachsen';
import type { RideId, RideSpec } from '../../data/games/mitwachsen-rides';
import type { BorderEvent } from './mitwachsen-border';
import type { Guided } from './mitwachsen-guide';
import type { Ride, RideEvent } from './mitwachsen-pack-types';
import type { World } from './mitwachsen-world';

/**
 * Ein Pfeil (Befehl `move`): `fresh` neu gedrückt oder gemerkter Tipp (nicht gehalten, `InputPace.lastFresh`), `tap`
 * angetippt (mitwachsen-tap.ts): ein Fahrzeug, `ride` welches (aus dem Körper, den der Finger traf), oder ein Bote
 * (Tok), `who` seine Kennung unter den Wesen. Gelaufen wird per Antippen nie
 */
export type MoveCmd = { type: 'move'; dir: Dir; fresh?: true; tap?: true; ride?: RideId; who?: string };

/** Ende einer Strecke: der Halt in der Welt (`home`) oder der auf der Lichtung (`out`) */
export type End = 'home' | 'out';

/**
 * Was die Regeln eines Fahrzeugs vom Zustand sehen und ändern dürfen: wie beim Pinguin (`Guided`), dazu den
 * gespeicherten Zustand der Pakete (`packs.fahrt`), die laufende Fahrt (`ride`, nicht gespeichert) und den Takt, ab dem
 * das Fahrzeug erscheint (`rideDue`, danach der Takt, an dem es herbeitrabt bzw. zuletzt angestoßen wurde; -1: nicht
 * fällig; nicht gespeichert). Fahrzeuge, die nicht von selbst erscheinen (der Zug: Tok baut ihn), merken sich das
 * Anstoßen in `nudged`; liegen beide Halte in derselben Gegend (der Zug bei Ausbau 1: Bahnhof Bär und Prellbock in der
 * Bucht), sagt `docked`, an welchem es zuletzt ankam (beides nicht gespeichert). `dozing`: Fahrzeuge, denen ein Paket
 * zum Fahren fehlt (Fahr-Engine, Ziel-Gegend; `dozingOf` in mitwachsen-preload.ts, `step` setzt es je Befehl): Sie
 * schlafen freundlich am Halt; `snored`: welches zuletzt auf einen Druck schnarchte und wann (Drossel, getrennt von
 * `nudged`, sonst stünde die Tür beim Aufwachen offen; beides nicht gespeichert)
 */
export type Rider = Guided & {
  packs: Record<string, unknown>;
  ride?: Ride;
  rideDue: number;
  nudged?: { id: RideId; at: number };
  docked?: Partial<Record<RideId, End>>;
  dozing?: readonly RideId[];
  snored?: { id: RideId; at: number };
  work?: { from: number; to: number; laid?: true }; // ein Bote baut (`Work` in mitwachsen-herald.ts; Bau 2 wartet auf den Zug)
};

/**
 * Ereignisse, die ein Fahrzeug ausgibt: seine eigenen, dazu Warten der folgenden Tiere, Wechsel der Gegend, `bump`
 * (gegen den Schuppen gelaufen, wie gegen jede Wand), `home` (ein Tier zieht nach der Fahrt ein: der Maulwurf nach
 * Bau 2) und, was ein Bote dabei tut (`herald`, `sink`: Tok beginnt Bau 2 am Prellbock; `HeraldEvent` in
 * mitwachsen-herald.ts, das diese Datei nicht importiert)
 */
export type RideEvents = {
  push(
    ...e: (
      | RideEvent
      | BorderEvent
      | { type: 'herald'; what: 'sink'; id: string; x: number; y: number }
      | { type: 'bump' }
      | { type: 'home'; id: string; species: SpeciesId }
    )[]
  ): unknown;
};

/**
 * Haken der Fahrzeuge in `step` (aus der Fahr-Engine, `RideEngine`). `tick`: nach dem Takt der Tiere (fällig,
 * erscheinen, fahren). `move`: vor allem anderen; true, wenn der Zug damit erledigt ist (einsteigen, anstoßen, während
 * der Fahrt immer; ein Antippen eines Fahrzeugs immer, sobald es eine Strecke hat: gelaufen wird per Antippen nie;
 * ein angetippter Bote, `MoveCmd.who`, gehört nicht den Fahrzeugen).
 * `blocks`: Darf das Tier `a` nicht auf (x, y) gehen (Halte, Fahrzeug, Schuppen, Strecke)?
 */
export type RideRules = {
  tick(s: Rider, world: World, events: RideEvents): void;
  move(s: Rider, world: World, cmd: MoveCmd, events: RideEvents): boolean;
  blocks(s: Rider, world: World, a: Rider['animals'][number], x: number, y: number): boolean;
};

/**
 * Strecke eines Fahrzeugs in einer Welt: `path` die Felder des Sitzes vom Halt in der Welt (`home`) bis zum Halt auf der
 * Lichtung (`out`), `stops` beide Sitze, `shed` sein Schuppen (am Halt `home`), `seats` feste Warteplätze je Halt für
 * folgende Tiere, `on` alle Felder der Strecke. Ein Fahrzeug mit Wagen (der Zug) belegt am Halt mehrere Felder (`cars`,
 * jedes davon ist zum Einsteigen da, es gibt kein Zugtier), vor ihm müssen `ahead` Felder frei sein (sonst 2: dort geht
 * das Zugtier); `dark`: Felder im Tunnel (Tunnelportal, Einschnitt, Gang), davor kündigt es ihn an
 */
export type RideRoute = {
  path: readonly Point[];
  stops: { home: Point; out: Point };
  shed: readonly Point[];
  seats: { home: readonly Point[]; out: readonly Point[] };
  on: ReadonlySet<string>;
  cars?: Record<End, readonly Point[]>;
  ahead?: number;
  dark?: ReadonlySet<string>;
};

/** Wer auf der Festfahrt außer den Tieren noch winkt (Eis-Welt: Schneemänner) */
export type Fan = { who: string; x: number; y: number };

/**
 * Was ein Paket über sein Fahrzeug sagt (`WorldRules.vehicle`): seinen Eintrag in `RIDES`, seine Strecke in einer Welt
 * (`route`; undefined: dort keins; sie darf vom Spielstand abhängen, der Zug fährt bei Ausbau 1 nur bis zum Prellbock),
 * ob es jetzt erscheinen soll (`ready`; ohne: es erscheint nie von selbst, der Zug kommt mit Bau 1), wer auf der
 * Festfahrt winkt (`fans`) und was nach dem Aussteigen geschieht (`landed`: Tok hüpft aus dem Zug an seinen Platz, die erste Fahrt ist gemacht).
 * `needs`: Gegenden, deren Welt (aus ihrem Paket) es zum Fahren braucht, außer der eigenen (Zug: die Grotte, seine
 * Ziel-Gegend); sie werden vor seinem Halt vorgeladen (`RIDE_PRELOAD`, mitwachsen-preload.ts). `reaches`: Fährt es beim
 * jetzigen Stand schon dorthin (Zug: erst ab Ausbau 2; ohne: immer)? Nur dann schläft es, solange eine fehlt.
 * `depart`: beim Abfahren (nach den 2 s, in denen ein Pfeil wieder aussteigt); true: Diese Fahrt hält unterwegs einmal
 * (`Ride.stopover`, der Zug: Bau 2 beginnt, Ausbau 2 sofort gespeichert); ändert es den Spielstand, rechnet die Engine
 * die Strecke neu und speichert gleich. `hold`: solange der Halt unterwegs aussteht, bis wohin es höchstens fahren darf
 * (Fortschritt der Fahrt; undefined: weiter, der Halt ist gemacht). `feast`: Ist diese Fahrt auf die Lichtung (`to`
 * `'out'`) seine Festfahrt (danach Stufe `fest`, Wimpel)? Ohne: die erste Heimfahrt bei `bereit`, wenn es erst danach
 * auf der Lichtung hält (`spec.out` `'fest'`, der Schlitten); der Zug: die erste Heimfahrt nach voller Höhlen-Leiste
 * (die Laternenfahrt, Zierde, nie Bedingung)
 */
export type Vehicle = {
  spec: RideSpec;
  needs?: readonly RegionId[];
  reaches?(s: Pick<Rider, 'packs'>): boolean;
  route(world: World, s: Pick<Rider, 'packs' | 'openGates'>): RideRoute | undefined;
  ready?(s: Rider, world: World): boolean;
  fans?(s: Rider, world: World): Fan[];
  landed?(s: Rider, world: World, end: End, events: RideEvents): void;
  depart?(s: Rider, world: World, to: End, events: RideEvents): boolean;
  hold?(s: Rider, world: World, events: RideEvents): number | undefined;
  feast?(s: Rider, world: World): boolean;
};

/** Die Fahr-Engine (Paket der Fahrzeuge, `WorldRules.ride`): macht aus den Fahrzeugen der geladenen Pakete ihre Regeln */
export type RideEngine = (vehicles: readonly Vehicle[]) => RideRules;
