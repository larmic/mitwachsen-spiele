// Geschichten von Mitwachsen: Klangsteine am Bett, vor jedem großen Tor und am Schneebett im Gletscherkessel (die
// zweite Fassung der Eis-Geschichte, „Wenn das Tor offen ist“). Läuft die Figur hinein, erklingt die
// Melodie des Ortes, später danach die eingesprochene Geschichte. Titel und Texte stehen in mitwachsen-story-texts.ts
// (nicht im Spiel, das nur Melodie und Aufnahme spielt).
// Aufnahmen: public/games/mitwachsen/stimme/<id>.m4a ablegen und hier bei `voice` eintragen (ein Test prüft die Datei).

import type { GateId, Point } from './mitwachsen';

export type StoryId = 'bett' | GateId | 'eis-offen';

/** Melodie: Töne [Hz, Länge in s, Lautstärke?] nacheinander, alle aus der Pentatonik C–D–E–G–A */
export type Melody = {
  wave: OscillatorType;
  gap: number; // Pause zwischen zwei Tönen (s)
  notes: readonly (readonly [number, number, number?])[];
};

export type Story = {
  melody: Melody;
  voice?: string; // Adresse der Aufnahme, sobald es sie gibt
};

/** Klangstein am Bett: links vorn, gleich außerhalb des freien Platzes ums Bett (`HOMES.lichtung.clear` in mitwachsen-homes.ts) */
export const BED_STONE: Point = [-3, 1];
/** Klangstein am Schneebett im Gletscherkessel: genauso links vorn, relativ zum Schneebett (`HOMES.eis`) */
export const ICE_STONE: Point = [-3, 1];

// Töne der Pentatonik
const C3 = 130.81,
  G3 = 196,
  A3 = 220,
  C4 = 261.63,
  D4 = 293.66,
  E4 = 329.63,
  G4 = 392,
  A4 = 440,
  C5 = 523.25,
  D5 = 587.33,
  E5 = 659.25,
  G5 = 783.99,
  A5 = 880,
  C6 = 1046.5,
  E6 = 1318.51;

/** Melodie der Eis-Geschichte: hell und klirrend wie Eiszapfen (beide Fassungen) */
const ICE_MELODY: Melody = {
  wave: 'triangle',
  gap: 0.04,
  notes: [
    [C6, 0.14],
    [A5, 0.14],
    [G5, 0.14],
    [E5, 0.14],
    [G5, 0.14],
    [A5, 0.14],
    [C6, 0.2],
    [E6, 0.5, 0.06],
  ],
};

export const STORIES: Record<StoryId, Story> = {
  bett: {
    // Schlaflied: langsam und weich
    melody: {
      wave: 'sine',
      gap: 0.06,
      notes: [
        [G4, 0.42],
        [E4, 0.42],
        [G4, 0.42],
        [A4, 0.6],
        [G4, 0.42],
        [E4, 0.42],
        [D4, 0.42],
        [C4, 0.9],
      ],
    },
  },
  eis: {
    melody: ICE_MELODY,
  },
  // Zweite Fassung der Eis-Geschichte, am Schneebett im Gletscherkessel
  'eis-offen': {
    melody: ICE_MELODY,
  },
  sand: {
    // gemächlich schaukelnd wie ein Kamel
    melody: {
      wave: 'triangle',
      gap: 0.08,
      notes: [
        [D4, 0.3],
        [E4, 0.3],
        [G4, 0.45],
        [E4, 0.3],
        [D4, 0.3],
        [C4, 0.45],
        [D4, 0.3],
        [E4, 0.7],
      ],
    },
  },
  wasser: {
    // auf und ab wie Wellen
    melody: {
      wave: 'sine',
      gap: 0.02,
      notes: [
        [C5, 0.2],
        [E5, 0.2],
        [G5, 0.2],
        [E5, 0.2],
        [C5, 0.2],
        [E5, 0.2],
        [G5, 0.2],
        [A5, 0.3],
        [G5, 0.6],
      ],
    },
  },
  lava: {
    // tief und gemütlich brummend
    melody: {
      wave: 'triangle',
      gap: 0.06,
      notes: [
        [C3, 0.32, 0.2],
        [G3, 0.32, 0.2],
        [C4, 0.4],
        [G3, 0.32, 0.2],
        [A3, 0.32, 0.2],
        [G3, 0.32, 0.2],
        [C3, 0.8, 0.2],
      ],
    },
  },
  hoehle: {
    // jeder Ton kommt leise als Echo zurück
    melody: {
      wave: 'sine',
      gap: 0.05,
      notes: [
        [A4, 0.3],
        [A4, 0.3, 0.04],
        [E4, 0.3],
        [E4, 0.3, 0.04],
        [C5, 0.3],
        [C5, 0.3, 0.04],
        [A4, 0.6],
        [A4, 0.6, 0.03],
      ],
    },
  },
  wald: {
    // dreimal klopft der Specht, dann singt ein Vogel
    melody: {
      wave: 'triangle',
      gap: 0.1,
      notes: [
        [G3, 0.06, 0.2],
        [G3, 0.06, 0.2],
        [G3, 0.06, 0.2],
        [E5, 0.18],
        [G5, 0.18],
        [A5, 0.18],
        [G5, 0.18],
        [E5, 0.5],
      ],
    },
  },
  wolken: {
    // langsam nach oben schwebend
    melody: {
      wave: 'sine',
      gap: 0.04,
      notes: [
        [C5, 0.4],
        [D5, 0.4],
        [E5, 0.4],
        [G5, 0.4],
        [A5, 0.4],
        [C6, 0.9],
      ],
    },
  },
  pilze: {
    // hüpfend und verspielt
    melody: {
      wave: 'triangle',
      gap: 0.05,
      notes: [
        [E5, 0.18],
        [C5, 0.18],
        [E5, 0.18],
        [G5, 0.3],
        [E5, 0.18],
        [C5, 0.18],
        [D5, 0.18],
        [G4, 0.5],
      ],
    },
  },
};

/** Was ein Klangstein erzählt: Ist das Eistor offen, erzählt der Stein davor die zweite Fassung der Eis-Geschichte */
export const told = (id: StoryId, open: readonly GateId[]): StoryId =>
  id === 'eis' && open.includes('eis') ? 'eis-offen' : id;

/** Wie lange eine Melodie dauert (s) */
export const melodyLength = (m: Melody) => m.notes.reduce((t, [, len]) => t + len + m.gap, 0);
