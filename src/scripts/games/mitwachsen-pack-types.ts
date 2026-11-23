// Welt-Pakete – nur Typen: Was eine Welt hinter einem Tor dem Kern liefert. Der Kern (Spielseite, sofort geladen) kennt
// Regeln, Eingabe, Lichtung und Tiere; alles, was nur eine Welt braucht (Gelände, Wohnorte, Regeln ihres Schlüssels),
// steckt in ihrem Paket unter src/scripts/games/worlds/<welt>/ und kommt per import() (einziger Einstieg: index.ts).
// Fehlt ein Paket (noch nicht nötig oder Laden gescheitert), baut die Welt hinter dem Gang seines Tors eine Klippe;
// das Spiel läuft ohne. Wann es nötig ist, entscheidet mitwachsen-pack.ts (`needsPack`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { Dir, Part } from '../../lib/games/front';
import type { GateId, Point, RegionId, SpeciesId } from '../../data/games/mitwachsen';
import type { RideId } from '../../data/games/mitwachsen-rides';
import type { Cell } from './mitwachsen-cell';
import type { Portal, PortalId } from './mitwachsen-portal';

/**
 * Kennung eines Welt-Pakets: die Gegend hinter einem Tor, deren Welt es baut (Eis-Welt, Höhlenwelt). Unter ihr steht
 * auch sein Zustand in `State.packs`; je Kennung ein Lader in mitwachsen-packs.ts
 */
export type PackId = Exclude<RegionId, 'lichtung'>;

/** Gang hinter einem Tor, in Koordinaten u (entlang des Tors) und t (nach außen) */
export type Gang = {
  at: (u: number, t: number) => Point;
  depth: number; // t der Torreihe
  end: number; // letzte Reihe des Gangs durch den Felsring
  half: number; // Boden des Gangs: u von −half bis half
  wall: number; // daneben auf jeder Seite so viele Felder Wand
};

/** Lage einer Welt hinter ihrem Gang: ihr Bett und alle Felder samt Klippen (wo ihre Mitte liegt, weiß nur ihr Paket) */
export type KesselPlace = { bed: Point; cells: readonly Point[] };

/**
 * Eine gebaute Welt: Bett, ihre Felder (`realm`, als "x,y"), Wohnplätze und Wohnorte ihrer Tiere, Klangstein und
 * Portal (als Eintrag für `world.portals`)
 */
export type Kessel = {
  bed: Point;
  realm: ReadonlySet<string>;
  spots: readonly Point[];
  spawns: ReadonlyMap<string, Point>;
  stone: Point;
  portal: [PortalId, Portal];
};

/**
 * Ereignis aus den Regeln einer Welt (Eis-Welt: ein Schneehaufen wächst um eine Kugel, Stufe 1 bis 3; ein Eiszapfen
 * des Glockenspiels klingt mit seiner Tonhöhe `note`, 0 tief)
 */
export type PackEvent =
  { type: 'snowman'; x: number; y: number; stage: number } | { type: 'icicle'; x: number; y: number; note: number };

/**
 * Was die Regeln einer Welt vom Zustand sehen und ändern dürfen: den gespeicherten Zustand der Welt-Pakete (`packs`, je
 * Paket unter seiner Kennung in seinem eigenen Format; der Kern trägt ihn nur und speichert ihn mit), Figur und Tiere,
 * Takt und Beginn des Rituals am Eistor (`ritual`, mitwachsen-guide.ts)
 */
export type Ruled = {
  packs: Record<string, unknown>;
  tick: number;
  ritual: number;
  player: { x: number; y: number };
  animals: { x: number; y: number; dir: Dir; mode: string; rest: number }[];
};

/**
 * Eine Fahrt mit einem Fahrzeug (nicht gespeichert; Regeln im Welt-Paket, worlds/eis/mitwachsen-ride.ts): `phase`
 * eingestiegen (`seated`, gleich geht es los), unterwegs (`go`), hält vor einem Hindernis (`stop`), angekommen (`arrive`,
 * gleich steigt die Figur aus); `at` Takt, an dem die Phase begann; `pos` Fortschritt auf der Strecke in Feldern,
 * `speed` Felder je Takt; `to` Halt, zu dem es fährt: sein Zuhause am Schuppen in der Welt (`home`) oder der Halt auf der
 * Lichtung (`out`; für das Kind die Heimfahrt); `feast` die Festfahrt (erste Heimfahrt);
 * `jingleAt` Takt des letzten Bimmelns; `greeted` Tiere, die auf der Festfahrt schon gewinkt haben
 */
export type Ride = {
  id: RideId;
  phase: 'seated' | 'go' | 'stop' | 'arrive';
  at: number;
  pos: number;
  speed: number;
  to: 'home' | 'out';
  feast: boolean;
  jingleAt: number;
  greeted: string[];
};

/**
 * Ereignis eines Fahrzeugs (ein Typ, Unterart `what`): erscheint (`appear`, mit `persist` gespeichert), trabt herbei
 * (`come`), schnaubt (`snort`), stößt sanft an (`nudge`), Figur steigt ein (`board`) oder gleich wieder aus (`leave`),
 * fährt los (`go`), Figur winkt im Sitz (`wave`), hält vor einem Hindernis (`stop`), Tier hüpft beiseite (`shoo`, `who`),
 * kommt an (`arrive`), Figur steigt aus (`alight`), Fest nach der ersten Heimfahrt (`feast`, gespeichert), ein Tier
 * winkt am Weg (`cheer`, `who`), der Pinguin winkt zum Abschied (`farewell`). `from`: Feld, von dem es herbeitrabt
 * (`appear`); `ring`: das Fahrzeug bimmelt dazu (`wave`, höchstens alle 1,5 s)
 */
export type RideEvent = {
  type: 'ride';
  what:
    | 'appear'
    | 'come'
    | 'snort'
    | 'nudge'
    | 'board'
    | 'leave'
    | 'go'
    | 'wave'
    | 'stop'
    | 'shoo'
    | 'arrive'
    | 'alight'
    | 'feast'
    | 'cheer'
    | 'farewell';
  id: RideId;
  x: number;
  y: number;
  who?: string;
  from?: Point;
  ring?: true;
  persist?: true;
};

/**
 * Regeln einer Welt aus ihrem Paket (Eis-Welt: Schneemänner bauen, Glockenspiel). `step` bekommt sie hereingereicht,
 * sobald das Paket da ist. `bump`: Die Figur läuft in das Feld (x, y) mit dem Inhalt `c`; `move` sagt, auf welchem
 * Feld sie steht (`here`) und ob der Schritt ginge (`walks`). true, wenn der Zug damit erledigt ist (sie bleibt stehen),
 * sonst geht es weiter wie immer (auch nach einem Ereignis, etwa dem Ton eines Eiszapfens). `ride`: Regeln eines
 * Fahrzeugs (`RideRules` in mitwachsen-rider.ts; hier nur als Parameter, weil die Welt diese Datei kennt).
 */
export type WorldRules<Ride = never> = {
  bump(
    s: Ruled,
    c: Cell,
    x: number,
    y: number,
    events: { push(e: PackEvent | { type: 'hop' }): unknown }, // `hop`: Die Figur hüpft nur (Eistor im Vorspiel)
    move: { here: Cell; walks: boolean },
  ): boolean;
  ride?: Ride;
};

/** Liegt ein Feld ganz hinter dem Felsring der Lichtung? */
export type Beyond = (x: number, y: number) => boolean;

/**
 * Ein Welt-Paket. `build` baut die Welt in die Karte der festen Felder (`map`, dort liegt schon der Gang durch den
 * Felsring; `passage` liefert ein Feld des Gangs), `place` sagt nur, wo sie läge. `lead`: Regeln, die das Paket der
 * Ansicht mitbringt (Eis-Welt: der verlaufene Pinguin führt zum Tor und öffnet es, `GuideRules`). `view`: ihre
 * Zeichenteile für die Ansicht (Eis-Welt: `View2D` aus mitwachsen-view.ts, Wetter und Bild der Weltgrenze). `view3d`:
 * lädt ihren 3D-Teil nach (`View3D` aus mitwachsen-view-3d.ts; braucht Three.js, darum ein eigener `import()`, erst wenn
 * die 3D-Ansicht da ist). `models`: Modelle der Tiere dieser Welt (`addModels`). `rules`: Regeln, die nur in dieser
 * Welt gelten (Eis-Welt: Schneehaufen wachsen zu Schneemännern, `ride`: Fahrzeug), `step` hereingereicht.
 */
export type WorldPack<Rules = unknown, View = unknown, View3 = unknown, Ride = unknown> = {
  id: PackId;
  gate: GateId; // das Tor, hinter dem seine Welt liegt (`REGIONS`: `behind` der Gegend `id`)
  build(
    seed: number,
    gang: Gang,
    beyond: Beyond,
    passage: (x: number, y: number) => Cell,
    map: Map<string, Cell>,
  ): Kessel;
  place(seed: number, gang: Gang, beyond: Beyond): KesselPlace;
  lead?: Rules;
  rules?: WorldRules<Ride>;
  view?: View;
  view3d?: () => Promise<View3>;
  models?: Partial<Record<SpeciesId, readonly Part[]>>;
};
