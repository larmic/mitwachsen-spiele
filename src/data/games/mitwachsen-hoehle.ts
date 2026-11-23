// Höhlenwelt von Mitwachsen, was alle brauchen (Leiste, Album, Arten, Ansicht): die acht Höhlen-Tiere (Name, Ton,
// Gangart). Wohnorte, Futter und Modelle der Tiere braucht nur das Welt-Paket der Höhlenwelt:
// src/data/games/worlds/hoehle/mitwachsen-cave-animals.ts und mitwachsen-cave-models.ts. Die Gegend steht in `REGIONS`
// (Gegend 'hoehle'), ihr Zuhause in `HOMES.hoehle`.
// Konzept: docs/games/mitwachsen.md (Höhlenwelt) · Spec: docs/specs/mitwachsen.md (Abschnitt „Die Höhlen-Tiere“)

import type { SpeciesOf } from './mitwachsen-species';

/** Die acht Arten der Höhlenwelt, in der Reihenfolge der Leiste (der Maulwurf zieht später als erster ein) */
export type CaveSpeciesId =
  'maulwurf' | 'dachs' | 'grottenolm' | 'eidechse' | 'siebenschlaefer' | 'fledermaus' | 'murmeltier' | 'gluehwuermchen';

/**
 * Töne und Gangart der Höhlen-Tiere wie im Konzept; ihre Modelle (`parts`, bei der Fledermaus auch `roost`) bringt
 * das Welt-Paket der Höhlenwelt mit (`CAVE_MODELS` in worlds/hoehle/mitwachsen-cave-models.ts, eingetragen mit
 * `addModels`), denn ein Höhlen-Tier zeigt sich erst mit ihm. Alle Töne in der Pentatonik; der Dachs brummt auf A3
 * (220 Hz, nicht 110: so tief klingen Lautsprecher von Handy und Tablet nicht). Die Gangart ist nur Zierde beim Gleiten.
 */
export const CAVE_SPECIES: { [K in CaveSpeciesId]: SpeciesOf<K> } = {
  maulwurf: {
    id: 'maulwurf',
    name: 'Maulwurf',
    scale: 1.35, // klein: etwas größer gezeichnet, damit man ihn gut sieht
    gait: 'huschen',
    // „mümm-mümm“: D4, E4
    tone: { notes: [293.66, 329.63], wave: 'triangle', len: 0.12, gap: 0.05, gain: 0.16 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  dachs: {
    id: 'dachs',
    name: 'Dachs',
    scale: 1.2,
    gait: 'watscheln',
    // tiefes Schnaufen auf A3, gleitet nach unten
    tone: { notes: [220], wave: 'triangle', len: 0.3, gap: 0, slide: 0.9, gain: 0.2 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  grottenolm: {
    id: 'grottenolm',
    name: 'Grottenolm',
    scale: 1.3,
    gait: 'robben',
    // „blubb“: C4, gleitet nach unten
    tone: { notes: [261.63], wave: 'sine', len: 0.16, gap: 0, slide: 0.7, gain: 0.2 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  eidechse: {
    id: 'eidechse',
    name: 'Sonnen-Eidechse',
    scale: 1.3,
    gait: 'huschen',
    // „tik-tik“: zweimal kurz G4
    tone: { notes: [392, 392], wave: 'triangle', len: 0.04, gap: 0.06, gain: 0.14 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  siebenschlaefer: {
    id: 'siebenschlaefer',
    name: 'Siebenschläfer',
    scale: 1.3,
    gait: 'huepfen',
    // Triller A4, C5, A4
    tone: { notes: [440, 523.25, 440], wave: 'sine', len: 0.07, gap: 0.01, gain: 0.13 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  fledermaus: {
    id: 'fledermaus',
    name: 'Fledermaus',
    scale: 1.3,
    gait: 'flattern',
    // leises Zirpen E5, G5
    tone: { notes: [659.25, 783.99], wave: 'sine', len: 0.06, gap: 0.03, gain: 0.05 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
    roost: [], // hängt tagsüber kopfüber im Kristallbogen (`Cell.perch`); Modell dazu aus dem Welt-Paket
  },
  murmeltier: {
    id: 'murmeltier',
    name: 'Murmeltier',
    scale: 1.25,
    gait: 'huepfen',
    // heller Pfiff A5
    tone: { notes: [880], wave: 'sine', len: 0.18, gap: 0, gain: 0.12 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  gluehwuermchen: {
    id: 'gluehwuermchen',
    name: 'Glühwürmchen',
    scale: 1.5, // winzig: deutlich größer gezeichnet
    gait: 'flattern',
    // Glöckchen C6, E6, ganz leise
    tone: { notes: [1046.5, 1318.51], wave: 'sine', len: 0.09, gap: 0.04, gain: 0.04 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
};
