// Eis-Welt von Mitwachsen: Maße des Gletscherkessels hinter dem Eistor, Lage von Eisloch, Fischkisten und Moosfleck,
// Farben der Eis-Dinge, das Netz mit Fischen und die zehn Eis-Tiere (Wohnort, Modell, Ton, Gangart).
// Die Gegend selbst steht in `REGIONS` (Gegend 'eis'), ihr Zuhause (Bett, Wiese, Tröge, Iglu) in `HOMES.eis`.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

import { eyes, type Part } from '../../lib/games/front';
import type { SpeciesOf } from './mitwachsen-species';

/** Gletscherkessel: Lagen quer zum Tor (`across`) und vom Tor weg (`out`), von der Mitte (dem Schneebett) aus */
export const KESSEL = {
  /** Halbachsen des Kessels innen: quer zum Tor und vom Tor weg (etwa 44 × 38 Felder) */
  shape: { rx: 22, ry: 19 },
  /** so dick sind die Eisklippen ringsum (mindestens, der Rand innen ist leicht gewellt) */
  cliff: 5,
  /** so weit um das Bett bleibt der Boden eben und frei: Wiese, Iglu, Platz für Klangstein und Portal */
  flat: 11,
  /** so viele Felder Abstand hält der Kessel mindestens vom Felsring der Lichtung */
  gap: 2,
  /** Eisloch: rundes Wasserloch (Radius in Feldern) seitlich hinter dem Bett, ringsum ebenes Ufer */
  hole: { across: 13, out: 5, r: 1.6 },
  /**
   * Fischkisten [quer, vom Tor weg]: am Ende der Rutschspur nahe dem Tor, am Fuß der Klippe gegenüber und nahe dem
   * Eisloch; jede 8 bis 14 Felder von der Schneewiese, einzeln mit freiem Platz ringsum
   */
  crates: [
    [-4, -15],
    [0, 15],
    [17, 1],
  ],
  /** Moosfleck: grünes Moos und Flechten unter dem Schnee (nur Kulisse, begehbar) */
  moss: { across: -14, out: 3, r: 1.8 },
} as const;

/** Farben im Kessel (Spielgrafik): Seite und Oberseite */
export const ICE_COLORS = {
  snow: ['#d5e4f0', '#f6f9fc'],
  block: ['#e8f0f7', '#ffffff'], // hellere Schneeblöcke des Iglus (im Wechsel mit `snow`)
  ice: ['#9fd6ef', '#d4f1ff'],
  cliff: ['#9fd6ef', '#f4f8fb'], // Eisklippen: Eis an der Seite, Schnee obenauf
  bowl: ['#8fc6e9', '#cdeaf8'], // Futterschale aus Eis
  bowlIn: '#6fb3df',
  slide: ['#bfe6f5', '#e8f8ff'], // glänzende Rutschspur
  crate: ['#7d6a55', '#9a8670'], // Fischkiste aus Treibholz
  fish: ['#9fb4c8', '#dfe9f2'], // silberblaue Fische: Rücken, heller Bauch
  fin: '#7f96ad', // Schwanzflossen
  moss: ['#5f8f3a', '#7aa84a'], // Moosbüschel am Rand der Eisschale (nur Bild)
} as const;

/** Netz mit zwei silberblauen Fischen in der linken Hand (nach dem Fangen, bis zur Eisschale); gespiegelt zum Eimer */
export const FISH_PARTS: Part[] = [
  [-0.11, -0.47, 0.06, 0.22, 0.2, 0.19, '#d8cfb4', ICE_COLORS.fish[0]], // Netz, oben schauen die Fische heraus
  [-0.115, -0.475, 0.13, 0.23, 0.21, 0.02, '#b9ae90'], // Maschen
  [-0.115, -0.475, 0.25, 0.23, 0.21, 0.03, '#8a5f2a'], // Rand
  [-0.01, -0.38, 0.28, 0.02, 0.02, 0.08, '#5d4a2f'], // Stiel bis zur Hand
  [-0.07, -0.44, 0.22, 0.06, 0.05, 0.1, ...ICE_COLORS.fish], // zwei Fische, die Schwänze stehen über den Rand
  [-0.09, -0.46, 0.31, 0.1, 0.09, 0.06, ICE_COLORS.fin],
  [0.02, -0.37, 0.22, 0.06, 0.05, 0.08, ...ICE_COLORS.fish],
  [0.0, -0.39, 0.29, 0.1, 0.09, 0.06, ICE_COLORS.fin],
];

/** Funken beim Fangen (Platsch) und beim Füttern mit Fisch (silbern und goldgelb) */
export const FISH_SPARKS = {
  catch: ['#9fb4c8', '#dfe9f2', '#3f8fd8'],
  feed: ['#dfe9f2', '#c3ced8', '#ffd47e', '#f2d14b'],
} as const;

// ---------- Tiere der Eis-Welt ----------

/** Die zehn Arten der Eis-Welt, in der Reihenfolge der Leiste */
export type IceSpeciesId =
  | 'pinguin'
  | 'eisbaer'
  | 'robbe'
  | 'schneeeule'
  | 'walross'
  | 'rentier'
  | 'polarfuchs'
  | 'moschusochse'
  | 'papageitaucher'
  | 'lemming';

/**
 * Wohnorte der Eis-Tiere, relativ zum Schneebett: im Kreis (Radius 11) um die Schneewiese, gut verteilt. Die Welt sucht
 * das nächste erreichbare Feld im Kessel (wie der Kessel gedreht ist, würfelt der Seed mit dem Eistor).
 */
export const ICE_ANIMALS: readonly { species: IceSpeciesId; at: readonly [number, number] }[] = [
  { species: 'pinguin', at: [3, 10] },
  { species: 'eisbaer', at: [-9, -6] },
  { species: 'robbe', at: [11, 0] },
  { species: 'schneeeule', at: [-3, -10] },
  { species: 'walross', at: [9, 6] },
  { species: 'rentier', at: [-11, 0] },
  { species: 'polarfuchs', at: [9, -6] },
  { species: 'moschusochse', at: [-9, 6] },
  { species: 'papageitaucher', at: [3, -10] },
  { species: 'lemming', at: [-3, 10] },
];

/**
 * Fischfresser: Sie machen beim Füttern mit Fisch zusätzlich einen Schnapp-Hüpfer. Rentier, Moschusochse und Lemming
 * scharren lieber am Moosfleck (am Rand der Eisschale liegt auch ein Büschel Moos für sie).
 */
export const FISH_EATERS: ReadonlySet<string> = new Set<IceSpeciesId>([
  'pinguin',
  'eisbaer',
  'robbe',
  'schneeeule',
  'walross',
  'polarfuchs',
  'papageitaucher',
]);

const EYE = '#1d2233';
/** Teil auf beiden Seiten: wie angegeben und an der Mitte gespiegelt (Flecken, Ohren, Gesicht an den Seiten) */
const both = ([f, r, ...rest]: Part): Part[] => [
  [f, r, ...rest],
  [f, -r - rest[2], ...rest],
];
const legs = (front: number, back: number, half: number, size: number, h: number, color: string): Part[] => [
  ...both([front, -half, 0, size, size, h, color]),
  ...both([back, -half, 0, size, size, h, color]),
];

/**
 * Modelle und Töne der Eis-Tiere (Teile wie in `front.ts`: vorn, rechts, unten, Länge, Breite, Höhe, Farbe, oben).
 * Töne in der Pentatonik, von tief (Walross, Moschusochse, Eisbär) bis hoch (Lemming, Papageitaucher), damit man jedes
 * Tier am Ton erkennt. Die Gangart (`gait`) ist nur Zierde beim Gleiten.
 */
export const ICE_SPECIES: { [K in IceSpeciesId]: SpeciesOf<K> } = {
  pinguin: {
    id: 'pinguin',
    name: 'Pinguin',
    scale: 1.15,
    gait: 'watscheln',
    // fröhliches Tröten, aufwärts
    tone: { notes: [392, 440], wave: 'square', len: 0.1, gap: 0.03, gain: 0.05 },
    parts: [
      ...both([0.04, -0.13, 0, 0.12, 0.1, 0.04, '#f08a3c']), // Füße
      [-0.17, -0.15, 0.04, 0.3, 0.3, 0.5, '#262b36'], // schwarzer Rücken
      [0.13, -0.12, 0.06, 0.04, 0.24, 0.42, '#f4f6f8'], // weißer Bauch
      ...both([-0.05, 0.15, 0.08, 0.16, 0.012, 0.36, '#f4f6f8']),
      ...both([-0.08, 0.15, 0.18, 0.14, 0.05, 0.26, '#262b36']), // Flossen angelegt
      [-0.13, -0.13, 0.54, 0.26, 0.26, 0.2, '#262b36'], // Kopf
      ...both([-0.02, 0.13, 0.52, 0.1, 0.012, 0.1, '#f2b33d']), // gelb-orange Ohrflecken
      [0.13, -0.035, 0.57, 0.1, 0.07, 0.045, '#f08a3c'], // Schnabel
      ...eyes(0.13, 0.13, 0.63, 0.045, 0.045, 0.045),
    ],
  },
  eisbaer: {
    id: 'eisbaer',
    name: 'Eisbärkind',
    scale: 1.2,
    // tiefes, freundliches Brummen, gleitet leicht nach unten
    tone: { notes: [130.81, 146.83], wave: 'triangle', len: 0.26, gap: 0.06, slide: 0.88, gain: 0.22 },
    parts: [
      ...legs(0.16, -0.32, 0.18, 0.13, 0.18, '#e4dcc6'),
      [-0.37, -0.2, 0.15, 0.62, 0.4, 0.32, '#efe8d6', '#f8f4ea'], // runder Körper
      [-0.42, -0.04, 0.34, 0.05, 0.08, 0.07, '#efe8d6'], // Stummelschwanz
      [0.2, -0.16, 0.26, 0.26, 0.32, 0.27, '#efe8d6', '#f8f4ea'], // Kopf
      ...both([0.25, 0.09, 0.53, 0.08, 0.08, 0.07, '#efe8d6']), // runde Ohren
      ...both([0.33, 0.1, 0.55, 0.01, 0.06, 0.04, '#cfc4a8']),
      [0.46, -0.08, 0.28, 0.1, 0.16, 0.11, '#f8f4ea'], // helle Schnauze
      [0.56, -0.04, 0.35, 0.015, 0.08, 0.05, EYE], // schwarze Nase
      [0.56, -0.025, 0.29, 0.012, 0.05, 0.015, '#8a7f6a'], // Mund
      ...eyes(0.46, 0.16, 0.43, 0.05, 0.05, 0.07),
    ],
  },
  robbe: {
    id: 'robbe',
    name: 'Robbe',
    scale: 1.2,
    gait: 'robben',
    // kurzes, hohes Bellen
    tone: { notes: [659.25, 659.25], wave: 'square', len: 0.07, gap: 0.06, gain: 0.05 },
    parts: [
      [-0.32, -0.14, 0, 0.5, 0.28, 0.2, '#8f99a5', '#a5aeb9'], // liegender Körper
      ...both([-0.44, 0.03, 0, 0.13, 0.1, 0.04, '#76808b']), // Schwanzflossen
      ...both([0.06, 0.14, 0, 0.13, 0.07, 0.04, '#76808b']), // Vorderflossen
      [0.14, -0.12, 0.08, 0.22, 0.24, 0.22, '#8f99a5', '#a5aeb9'], // Kopf
      [0.36, -0.075, 0.1, 0.07, 0.15, 0.09, '#c0c7ce'], // helle Schnauze
      [0.43, -0.03, 0.15, 0.012, 0.06, 0.035, EYE], // Nase
      ...both([0.43, 0.04, 0.12, 0.012, 0.03, 0.012, '#ffffff']), // Barthaare
      [-0.22, -0.07, 0.2, 0.07, 0.06, 0.006, '#6b7480'], // Tupfen auf dem Rücken
      [-0.02, 0.02, 0.2, 0.06, 0.06, 0.006, '#6b7480'],
      ...both([-0.14, 0.14, 0.07, 0.06, 0.006, 0.06, '#6b7480']), // Tupfen an der Seite
      ...both([-0.27, 0.14, 0.1, 0.05, 0.006, 0.05, '#6b7480']),
      ...eyes(0.36, 0.12, 0.2, 0.06, 0.06, 0.035), // große Kulleraugen
    ],
  },
  schneeeule: {
    id: 'schneeeule',
    name: 'Schneeeule',
    scale: 1.2,
    gait: 'flattern',
    // weiches Huhu
    tone: { notes: [392, 329.63], wave: 'sine', len: 0.32, gap: 0.1, gain: 0.2 },
    parts: [
      ...both([0.04, 0.03, 0, 0.08, 0.07, 0.05, '#d8d8d0']), // Füße
      [-0.16, -0.15, 0.04, 0.3, 0.3, 0.34, '#f3f3ee'], // runder Körper
      ...both([-0.13, 0.15, 0.12, 0.24, 0.04, 0.24, '#e6e6de']), // Flügel
      [-0.14, -0.15, 0.38, 0.28, 0.3, 0.22, '#f3f3ee', '#fafaf6'], // Kopf
      ...both([-0.08, 0.19, 0.18, 0.05, 0.006, 0.035, '#2a2a30']), // schwarze Tupfen
      ...both([0.02, 0.19, 0.26, 0.05, 0.006, 0.035, '#2a2a30']),
      ...both([-0.06, 0.19, 0.31, 0.05, 0.006, 0.035, '#2a2a30']),
      [0.14, -0.07, 0.14, 0.006, 0.05, 0.035, '#2a2a30'],
      [0.14, 0.05, 0.22, 0.006, 0.05, 0.035, '#2a2a30'],
      [-0.08, -0.06, 0.6, 0.05, 0.05, 0.006, '#2a2a30'],
      [-0.02, 0.06, 0.6, 0.05, 0.05, 0.006, '#2a2a30'],
      ...both([0.14, 0.03, 0.45, 0.012, 0.1, 0.1, '#f2c94c']), // große gelbe Augen
      ...both([0.03, 0.15, 0.45, 0.1, 0.012, 0.1, '#f2c94c']),
      [0.14, -0.035, 0.42, 0.04, 0.07, 0.06, '#3a3a44'], // kleiner dunkler Schnabel
      ...eyes(0.155, 0.162, 0.47, 0.055, 0.055, 0.045),
    ],
  },
  walross: {
    id: 'walross',
    name: 'Walross',
    scale: 1.15,
    gait: 'robben',
    // tiefes Grunzen, leise, gleitet nach unten
    tone: { notes: [65.41], wave: 'sawtooth', len: 0.5, gap: 0, slide: 0.85, gain: 0.08 },
    parts: [
      [-0.38, -0.2, 0, 0.6, 0.4, 0.32, '#a8705a', '#b8806a'], // liegender Körper
      ...both([-0.5, 0.03, 0, 0.13, 0.12, 0.04, '#8e5c48']), // Flossen
      ...both([0.08, 0.19, 0, 0.15, 0.08, 0.04, '#8e5c48']),
      [0.18, -0.15, 0.1, 0.24, 0.3, 0.3, '#a8705a', '#b8806a'], // Kopf
      [0.42, -0.13, 0.12, 0.08, 0.26, 0.13, '#d7ad92'], // heller Schnauzbart
      [0.5, -0.11, 0.17, 0.006, 0.22, 0.012, '#8e5c48'],
      [0.5, -0.11, 0.2, 0.006, 0.22, 0.012, '#8e5c48'],
      ...both([0.45, 0.055, 0, 0.045, 0.045, 0.13, '#f7f2e3']), // lange weiße Stoßzähne
      ...eyes(0.42, 0.15, 0.3, 0.045, 0.045, 0.06),
    ],
  },
  rentier: {
    id: 'rentier',
    name: 'Rentier',
    scale: 1.15,
    // kurzes Grunzen aus zwei Tönen
    tone: { notes: [293.66, 261.63], wave: 'triangle', len: 0.12, gap: 0.04, gain: 0.18 },
    parts: [
      ...legs(0.13, -0.22, 0.11, 0.07, 0.26, '#5e4a3a'), // hohe dunkle Beine
      [-0.26, -0.13, 0.26, 0.5, 0.26, 0.24, '#8a6a50', '#9a7a5e'], // Körper
      [-0.3, -0.04, 0.42, 0.04, 0.08, 0.07, '#efe7d8'], // weißes Schwänzchen
      [0.16, -0.11, 0.3, 0.09, 0.22, 0.22, '#efe7d8'], // weißer Hals
      [0.17, -0.07, 0.46, 0.1, 0.14, 0.16, '#8a6a50'],
      [0.2, -0.08, 0.56, 0.24, 0.16, 0.14, '#8a6a50', '#9a7a5e'], // Kopf
      [0.44, -0.04, 0.6, 0.015, 0.08, 0.05, EYE], // Nase
      ...both([0.2, 0.08, 0.64, 0.04, 0.07, 0.04, '#8a6a50']), // Ohren
      // großes, verzweigtes, helles Geweih
      ...both([0.22, 0.095, 0.7, 0.035, 0.035, 0.2, '#e2cfa8']),
      ...both([0.22, 0.12, 0.84, 0.035, 0.1, 0.035, '#e2cfa8']),
      ...both([0.1, 0.095, 0.86, 0.12, 0.035, 0.035, '#e2cfa8']),
      ...both([0.1, 0.095, 0.89, 0.035, 0.035, 0.08, '#e2cfa8']),
      ...both([0.25, 0.205, 0.87, 0.035, 0.035, 0.08, '#e2cfa8']),
      ...eyes(0.44, 0.08, 0.64, 0.035, 0.035, 0.04),
    ],
  },
  polarfuchs: {
    id: 'polarfuchs',
    name: 'Polarfuchs',
    scale: 1.25,
    gait: 'huepfen',
    // helles Kläffen
    tone: { notes: [440, 523.25], wave: 'triangle', len: 0.08, gap: 0.04, gain: 0.16 },
    parts: [
      ...legs(0.11, -0.16, 0.08, 0.06, 0.16, '#d9dfe8'),
      [-0.2, -0.1, 0.16, 0.4, 0.2, 0.17, '#eef2f8'], // schlanker Körper
      // riesiger, buschig hochstehender Schwanz mit grauer Spitze
      [-0.4, -0.1, 0.2, 0.22, 0.2, 0.2, '#eef2f8', '#ffffff'],
      [-0.5, -0.09, 0.3, 0.12, 0.18, 0.2, '#eef2f8', '#ffffff'],
      [-0.54, -0.07, 0.42, 0.1, 0.14, 0.12, '#c3ccd9', '#d5dce6'],
      [0.15, -0.1, 0.24, 0.19, 0.2, 0.16, '#eef2f8', '#ffffff'], // Kopf
      [0.34, -0.05, 0.24, 0.09, 0.1, 0.07, '#eef2f8'], // spitze Schnauze
      [0.43, -0.02, 0.28, 0.015, 0.04, 0.035, EYE], // schwarze Nase
      ...both([0.19, 0.04, 0.4, 0.06, 0.06, 0.06, '#eef2f8']), // spitze Ohren
      ...both([0.2, 0.05, 0.46, 0.04, 0.04, 0.04, '#eef2f8']),
      ...both([0.25, 0.1, 0.41, 0.012, 0.035, 0.04, '#e7a3b0']),
      ...eyes(0.34, 0.1, 0.32, 0.035, 0.035, 0.04),
    ],
  },
  moschusochse: {
    id: 'moschusochse',
    name: 'Moschusochse',
    scale: 1.15,
    // tiefes Muhen, leise und lang
    tone: { notes: [98], wave: 'sawtooth', len: 0.55, gap: 0, slide: 0.94, gain: 0.07 },
    parts: [
      ...legs(0.14, -0.28, 0.14, 0.08, 0.12, '#d6c8a8'), // helle kurze Beine
      [-0.34, -0.2, 0.07, 0.6, 0.4, 0.38, '#4a3426', '#5a4030'], // Zottelfell bis fast zum Boden
      [-0.36, -0.21, 0.07, 0.62, 0.42, 0.06, '#3d2a1e'],
      [-0.02, -0.17, 0.42, 0.2, 0.34, 0.08, '#4a3426', '#5a4030'], // Buckel
      [-0.2, -0.12, 0.45, 0.2, 0.24, 0.03, '#a88c6a'], // heller Sattel
      [0.24, -0.13, 0.14, 0.2, 0.26, 0.26, '#3d2a1e'], // Kopf
      [0.44, -0.08, 0.16, 0.04, 0.16, 0.08, '#7a6450'], // Schnauze
      [0.24, -0.15, 0.38, 0.14, 0.3, 0.06, '#e3d6b8'], // Hörner, seitlich nach unten gebogen
      ...both([0.26, 0.15, 0.24, 0.07, 0.06, 0.18, '#e3d6b8']),
      ...both([0.33, 0.17, 0.2, 0.06, 0.05, 0.07, '#e3d6b8']),
      ...eyes(0.44, 0.13, 0.3, 0.04, 0.04, 0.05),
    ],
  },
  papageitaucher: {
    id: 'papageitaucher',
    name: 'Papageitaucher',
    scale: 1.3,
    gait: 'huschen',
    // schnelles Schnarren, leise
    tone: { notes: [1318.51, 1567.98, 1318.51], wave: 'square', len: 0.05, gap: 0.02, gain: 0.035 },
    parts: [
      ...both([0.0, 0.02, 0, 0.1, 0.07, 0.07, '#f08a3c']), // orange Füße
      [-0.13, -0.1, 0.06, 0.23, 0.2, 0.24, '#23262e'], // Körper
      [0.1, -0.08, 0.06, 0.03, 0.16, 0.21, '#f4f6f8'], // weißer Bauch
      ...both([-0.1, 0.1, 0.13, 0.16, 0.03, 0.15, '#23262e']), // Flügel
      [-0.1, -0.1, 0.3, 0.2, 0.2, 0.16, '#23262e'], // Kopf
      [0.1, -0.1, 0.3, 0.012, 0.2, 0.13, '#eceef1'], // weißes Gesicht
      ...both([-0.02, 0.1, 0.3, 0.12, 0.012, 0.13, '#eceef1']),
      [0.1, -0.045, 0.29, 0.06, 0.09, 0.12, '#e3532c'], // großer bunter Schnabel
      [0.16, -0.04, 0.31, 0.04, 0.08, 0.08, '#f2b33d'],
      [0.1, -0.05, 0.4, 0.02, 0.1, 0.02, '#8193ad'],
      ...eyes(0.112, 0.112, 0.36, 0.03, 0.03, 0.055),
    ],
  },
  lemming: {
    id: 'lemming',
    name: 'Lemming',
    scale: 1.3, // winzig: etwas größer gezeichnet, damit man ihn gut sieht
    gait: 'huschen',
    // Piepsen in schneller Folge
    tone: { notes: [880, 1046.5, 880, 1046.5], wave: 'sine', len: 0.05, gap: 0.015, gain: 0.12 },
    parts: [
      [-0.14, -0.1, 0, 0.24, 0.2, 0.14, '#c98e4a', '#d8a15e'], // runder Körper
      [-0.12, -0.04, 0.14, 0.16, 0.08, 0.015, '#2f2620'], // Rückenstreif
      [0.06, -0.08, 0.02, 0.12, 0.16, 0.12, '#c98e4a', '#d8a15e'], // Kopf
      [0.07, -0.06, 0.14, 0.08, 0.12, 0.015, '#2f2620'], // schwarze Kappe
      ...both([0.08, 0.06, 0.12, 0.03, 0.03, 0.03, '#a8733a']), // Öhrchen
      [0.18, -0.015, 0.06, 0.012, 0.03, 0.025, '#e7a3b0'], // rosa Näschen
      ...both([0.1, 0.06, 0, 0.05, 0.04, 0.02, '#e7a3b0']), // rosa Pfötchen
      ...eyes(0.18, 0.08, 0.08, 0.03, 0.03, 0.025),
    ],
  },
};
