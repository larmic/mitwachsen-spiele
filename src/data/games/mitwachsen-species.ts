// Tiere von Mitwachsen als Bauplan: Ton, Gangart und Modell einer Art. Die Arten selbst stehen in mitwachsen.ts
// (Lichtung) und mitwachsen-eis.ts (Eis-Welt); hier nur ihre Form, damit beide sie ohne Kreis nutzen.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

import type { Part } from '../../lib/games/front';

/** Ton eines Tiers: Folge von Tönen (Hz) mit Wellenform; alle aus der Pentatonik C–D–E–G–A, klingen also zusammen */
export type Tone = {
  notes: readonly number[];
  wave: OscillatorType;
  len: number;
  gap: number;
  slide?: number;
  gain?: number;
};

/** Gangart beim Gleiten (nur Zierde, nicht bei reduzierter Bewegung); ohne Angabe ein kleiner Hüpfer je Schritt */
export type Gait = 'watscheln' | 'robben' | 'huepfen' | 'huschen' | 'flattern';

/** Eine Art: Name, Größe, Modell aus Quadern (`front.ts`), Ton und Gangart */
export type SpeciesOf<Id extends string> = {
  id: Id;
  name: string;
  scale: number;
  parts: readonly Part[];
  tone: Tone;
  gait?: Gait;
};
