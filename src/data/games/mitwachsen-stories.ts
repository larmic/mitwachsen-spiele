// Geschichten von Mitwachsen: Klangsteine am Bett, vor jedem großen Tor, am Schneebett im Gletscherkessel (die zweite
// Fassung der Eis-Geschichte, „Wenn das Tor offen ist“), am Höhlenbett (die zweite Fassung der Höhlen-Geschichte) und
// in der Kristallhalle bei den kleinen Lichtgeistern (`lichtgeister`, setzt die Grotte selbst);
// dazu die Steine der Bahn, die erst mit ihr kommen (Paket der Bahn): am Bahnhof Bär ab Bau 1 und am
// Lokschuppen ab Bau 2 (worlds/bahn/mitwachsen-stones.ts), und der Stein am Grubenhalt, den der Maulwurf mit dem
// Glitzergang bringt (`grube`, Paket der Grubenbahn, worlds/grube/mitwachsen-funkel.ts). Läuft die Figur hinein, erklingt die
// Melodie des Ortes, später danach die eingesprochene Geschichte. Titel und Texte stehen in mitwachsen-story-texts.ts
// (nicht im Spiel, das nur Melodie und Aufnahme spielt).
// Aufnahmen: public/games/mitwachsen/stimme/<id>.m4a ablegen und hier bei `voice` eintragen (ein Test prüft die Datei).

import type { GateId, Point } from './mitwachsen';

export type StoryId =
  'bett' | GateId | 'eis-offen' | 'hoehle-offen' | 'lichtgeister' | 'lokschuppen' | 'bahnhof' | 'grube';

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
/** Klangstein am Höhlenbett in der Kristallgrotte: genauso links vorn, relativ zum Höhlenbett (`HOMES.hoehle`) */
export const CAVE_STONE: Point = [-3, 1];

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

/** Melodie der Höhlen-Geschichte: Jeder Ton kommt leise als Echo zurück (beide Fassungen) */
const CAVE_MELODY: Melody = {
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
    melody: CAVE_MELODY,
  },
  // Zweite Fassung der Höhlen-Geschichte, am Höhlenbett in der Kristallgrotte
  'hoehle-offen': {
    melody: CAVE_MELODY,
  },
  lichtgeister: {
    // leise und verspielt hinauf, dann kichern die Geister zweimal: hi-hi
    melody: {
      wave: 'sine',
      gap: 0.05,
      notes: [
        [E5, 0.2],
        [G5, 0.2],
        [A5, 0.3],
        [G5, 0.2],
        [C6, 0.08, 0.1],
        [C6, 0.08, 0.1],
        [A5, 0.2],
        [G5, 0.6],
      ],
    },
  },
  lokschuppen: {
    // dreimal klopft Tok die Nägel ein (pink, pink, pink), dann schaukelt die kleine Bahn in den Schuppen
    melody: {
      wave: 'triangle',
      gap: 0.08,
      notes: [
        [E6, 0.06, 0.12],
        [E6, 0.06, 0.12],
        [E6, 0.06, 0.12],
        [G4, 0.3],
        [E4, 0.3],
        [G4, 0.3],
        [D4, 0.3],
        [C4, 0.7],
      ],
    },
  },
  bahnhof: {
    // zweimal pfeift die Bahn, dann rattert sie los
    melody: {
      wave: 'triangle',
      gap: 0.05,
      notes: [
        [G5, 0.3],
        [A5, 0.45],
        [G5, 0.3],
        [A5, 0.45],
        [C4, 0.12, 0.2],
        [E4, 0.12, 0.2],
        [C4, 0.12, 0.2],
        [E4, 0.12, 0.2],
        [G4, 0.5],
      ],
    },
  },
  grube: {
    // dreimal klopft der Maulwurf leise, dann singt das Klingeltor hinauf wie beim Durchfahren
    melody: {
      wave: 'triangle',
      gap: 0.06,
      notes: [
        [A5, 0.06, 0.1],
        [A5, 0.06, 0.1],
        [A5, 0.06, 0.1],
        [D5, 0.2],
        [E5, 0.2],
        [G5, 0.2],
        [A5, 0.2],
        [C6, 0.6],
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

/**
 * Zweite Fassung der Geschichte eines Tors, „Wenn das Tor offen ist“ (`<tor>-offen`: Eis und Höhle);
 * undefined, wenn es keine gibt. Sie erzählen der Stein vor dem offenen Tor und der Stein am Bett der Welt dahinter.
 */
export function openStory(gate: GateId): StoryId | undefined {
  const id = `${gate}-offen`;
  return Object.hasOwn(STORIES, id) ? (id as StoryId) : undefined;
}

/**
 * Was ein Klangstein erzählt, je Tor: Ist sein Tor offen und hat es eine zweite Fassung, erzählt der Stein davor diese
 * (Eistor `eis-offen`, Höhlentor `hoehle-offen`; das Höhlentor geht erst mit der Bahn-Phase auf, bis dahin bleibt es bei
 * `hoehle`). Alle anderen Steine erzählen immer ihre eigene Geschichte
 */
export const told = (id: StoryId, open: readonly GateId[]): StoryId =>
  (open.includes(id as GateId) && openStory(id as GateId)) || id;

/** Wie lange eine Melodie dauert (s) */
export const melodyLength = (m: Melody) => m.notes.reduce((t, [, len]) => t + len + m.gap, 0);
