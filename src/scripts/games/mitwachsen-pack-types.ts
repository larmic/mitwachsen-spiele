// Welt-Pakete – nur Typen: Was eine Welt hinter einem Tor dem Kern liefert. Der Kern (Spielseite, sofort geladen) kennt
// Regeln, Eingabe, Lichtung und Tiere; alles, was nur eine Welt braucht (Gelände, Wohnorte, Regeln ihres Schlüssels),
// steckt in ihrem Paket unter src/scripts/games/worlds/<welt>/ und kommt per import() (einziger Einstieg: index.ts).
// Fehlt ein Paket (noch nicht nötig oder Laden gescheitert), baut die Welt hinter dem Gang seines Tors eine Eisklippe;
// das Spiel läuft ohne. Wann es nötig ist, entscheidet mitwachsen-pack.ts (`needsPack`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { Part } from '../../lib/games/front';
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

/** Liegt ein Feld ganz hinter dem Felsring der Lichtung? */
export type Beyond = (x: number, y: number) => boolean;

/**
 * Ein Welt-Paket. `build` baut die Welt in die Karte der festen Felder (`map`, dort liegt schon der Gang durch den
 * Felsring; `passage` liefert ein Feld des Gangs), `place` sagt nur, wo sie läge. `lead`: Regeln, die das Paket der
 * Ansicht mitbringt (Eis-Welt: der verlaufene Pinguin führt zum Tor und öffnet es, `GuideRules`). `view`: ihre
 * Zeichenteile für die Ansicht (Eis-Welt: `View2D` aus mitwachsen-view.ts, Wetter und Bild der Weltgrenze). `models`:
 * Modelle der Tiere dieser Welt (`addModels`).
 */
export type WorldPack<Rules = unknown, View = unknown> = {
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
  view?: View;
  models?: Partial<Record<SpeciesId, readonly Part[]>>;
};
