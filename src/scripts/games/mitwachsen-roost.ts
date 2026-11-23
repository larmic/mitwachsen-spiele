// Ruhehaltung – rein, ohne DOM: Tiere einer Art mit Ruhehaltung (`Species.roost`, die Fledermaus) hängen kopfüber an
// einem Sitzplatz (`Cell.perch`, in der Grotte unter dem Kristallbogen). Beim Verteilen bekommen sie zuerst die freien
// Sitzplätze ihrer Gegend (mitwachsen-scatter.ts), dort bleiben sie, solange sie frei umherlaufen (mitwachsen-state.ts),
// bis man sie findet; die Ansichten zeigen sie dann mit dem Modell der Ruhehaltung an der Höhe des Sitzplatzes.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Höhlen-Tiere“)

import { SPECIES, type Point, type SpeciesId } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';
import { perRealm } from './mitwachsen-home';
import type { World } from './mitwachsen-world';

/** Hat diese Art eine Ruhehaltung (hängt sie kopfüber)? */
export const roosts = (species: SpeciesId) => SPECIES[species].roost !== undefined;

/**
 * Hängt dieses Tier gerade an seinem Sitzplatz? Ein frei umherlaufendes Tier einer Art mit Ruhehaltung auf einem Feld
 * mit Sitzplatz (`c`: sein Feld). Liefert die Höhe, an der es hängt, über dem Boden des Felds, sonst undefined
 */
export const roostAt = (a: { species: SpeciesId; mode: string }, c: Cell): number | undefined =>
  a.mode === 'wander' && roosts(a.species) ? c.perch : undefined;

/**
 * Höhe, an der die Ansichten dieses Tier kopfüber zeichnen: wie `roostAt`, aber nur, wenn das Modell der Ruhehaltung
 * schon da ist (es kommt mit dem Welt-Paket, `addModels`). Fehlt es, zeigen die Ansichten das Tier mit seinem
 * gewöhnlichen Modell am Boden statt unsichtbar
 */
export const hangAt = (a: { species: SpeciesId; mode: string }, c: Cell): number | undefined =>
  SPECIES[a.species].roost?.length ? roostAt(a, c) : undefined;

/** Abstand des Zeichens über einem hängenden Tier (Fragezeichen) über seinem Sitzplatz */
export const HANG_LABEL = 0.3;

/**
 * Höhe des Zeichens über einem Tier (Herz, Fragezeichen) über dem Boden seines Felds: über dem Kopf, bei einem
 * hängenden Tier knapp über seinem Sitzplatz, damit es zu ihm gehört und nicht zum leeren Boden darunter
 */
export const labelHeight = (a: { species: SpeciesId; mode: string }, c: Cell, hop: number): number => {
  const perch = hangAt(a, c);
  return perch !== undefined ? perch + HANG_LABEL : hop + 1.05 * SPECIES[a.species].scale * 0.75;
};

/** Erreichbare Felder einer Gegend mit Sitzplatz (je Welt und Gegend einmal gesucht) */
export const perchesOf = perRealm((world: World, realm): Point[] =>
  world.spotsOf(realm).filter(([x, y]) => world.cell(x, y).perch !== undefined),
);
