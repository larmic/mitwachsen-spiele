// Welt-Pakete – nur Typen: Was eine Welt hinter einem Tor dem Kern liefert. Der Kern (Spielseite, sofort geladen) kennt
// Regeln, Eingabe, Lichtung und Tiere; alles, was nur eine Welt braucht (Gelände, Wohnorte, Regeln ihres Schlüssels),
// steckt in ihrem Paket unter src/scripts/games/worlds/<welt>/ und kommt per import() (einziger Einstieg: index.ts).
// Fehlt ein Paket (noch nicht nötig oder Laden gescheitert), baut die Welt hinter dem Gang seines Tors eine Eisklippe;
// das Spiel läuft ohne. Wann es nötig ist, entscheidet mitwachsen-pack.ts (`needsPack`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { Dir, Part } from '../../lib/games/front';
import type { GateId, Point, SpeciesId } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';
import type { Portal, PortalId } from './mitwachsen-portal';

/** Gang hinter einem Tor, in Koordinaten u (entlang des Tors) und t (nach außen) */
export type Gang = {
  at: (u: number, t: number) => Point;
  depth: number; // t der Torreihe
  end: number; // letzte Reihe des Gangs durch den Felsring
  half: number; // Boden des Gangs: u von −half bis half
  wall: number; // daneben auf jeder Seite so viele Felder Wand
};

/** Lage einer Welt hinter ihrem Gang: Mitte (dort steht ihr Bett) und alle Felder samt Klippen */
export type KesselPlace = { bed: Point; centre: number; cells: readonly Point[] };

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

/** Ereignis aus den Regeln einer Welt (Eis-Welt: ein Schneehaufen wächst um eine Kugel, Stufe 1 bis 3) */
export type PackEvent = { type: 'snowman'; x: number; y: number; stage: number };

/**
 * Was die Regeln einer Welt vom Zustand sehen und ändern dürfen: den gespeicherten Zustand der Welt-Pakete (`packs`, je
 * Paket unter seiner Kennung in seinem eigenen Format; der Kern trägt ihn nur und speichert ihn mit), Figur und Tiere
 */
export type Ruled = {
  packs: Record<string, unknown>;
  player: { x: number; y: number };
  animals: { x: number; y: number; dir: Dir; mode: string; rest: number }[];
};

/**
 * Regeln einer Welt aus ihrem Paket (Eis-Welt: Schneemänner bauen). `step` bekommt sie hereingereicht, sobald das Paket
 * da ist. `bump`: Die Figur läuft in das Feld (x, y) mit dem Inhalt `c`; true, wenn der Zug damit erledigt ist (sie
 * bleibt stehen, eine Begegnung), sonst geht es weiter wie immer.
 */
export type WorldRules = {
  bump(s: Ruled, c: Cell, x: number, y: number, events: { push(e: PackEvent): unknown }): boolean;
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
 * Welt gelten (Eis-Welt: Schneehaufen wachsen zu Schneemännern), `step` hereingereicht.
 */
export type WorldPack<Rules = unknown, View = unknown, View3 = unknown> = {
  id: 'eis';
  gate: GateId;
  build(
    seed: number,
    gang: Gang,
    beyond: Beyond,
    passage: (x: number, y: number) => Cell,
    map: Map<string, Cell>,
  ): Kessel;
  place(seed: number, gang: Gang, beyond: Beyond): KesselPlace;
  lead?: Rules;
  rules?: WorldRules;
  view?: View;
  view3d?: () => Promise<View3>;
  models?: Partial<Record<SpeciesId, readonly Part[]>>;
};
