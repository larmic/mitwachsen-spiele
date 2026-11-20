// Zuhause je Gegend von Mitwachsen: Bett, Plätze zum Aufwachen, Wiese mit Trögen, Unterstand und Kreis der Portale.
// Jede Gegend bekommt hier ihren Eintrag (TypeScript verlangt ihn); die Welt legt ihn an das Bett der Gegend.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

import type { Point, Rect, RegionId } from './mitwachsen';

/**
 * Zuhause einer Gegend, alle Lagen relativ zu ihrem Bett (wo das Bett liegt, weiß die Welt; das der Lichtung in ihrer
 * Mitte bei 0, 0). Jede Gegend hat ein eigenes Zuhause mit Bett, Wiese, Trögen und Unterstand.
 */
export type HomePlan = {
  /** freie Plätze am Bett zum Aufwachen */
  wake: readonly Point[];
  /** so weit um das Bett bleibt es flach und frei */
  clear: number;
  /**
   * Gegenstücke der Portal-Plattformen stehen im Kreis um das Bett, jedes in Richtung seines Tors; schlafend sind sie
   * leere graue Sockel.
   */
  portalRing: number;
  /**
   * Zuhause der gefundenen Tiere: eine offene Wiese rund um das Bett (ohne Zaun), mit Futter und Wasser.
   * Folgende Tiere, die sie betreten, bleiben dort und verteilen sich.
   */
  meadow: number; // Radius der Wiese um das Bett
  food: Point; // Futtertrog
  water: Point; // Wassertrog
  shelter: Rect; // Unterstand: Bei Regen gehen die Tiere der Wiese hierher
  shelterStem: Point; // fester Teil des Unterstands (in der Mitte, unter dem Dach zu sehen)
};

export const HOMES: Record<RegionId, HomePlan> = {
  lichtung: {
    wake: [
      [1, 0],
      [0, 1],
      [1, 1],
      [-1, 0],
      [-1, 1],
    ],
    clear: 2,
    portalRing: 9, // Die Plattformen (3 × 3) berühren einander nicht und ragen nicht in die Wiese
    meadow: 6,
    food: [-4, 3],
    water: [4, 3],
    shelter: { x0: -3, y0: -5, x1: 3, y1: -3 }, // unter dem Riesenpilz
    shelterStem: [0, -4], // Stiel des Riesenpilzes
  },
};
