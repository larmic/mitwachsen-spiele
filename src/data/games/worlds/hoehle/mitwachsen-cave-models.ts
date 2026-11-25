// Modelle der acht Höhlen-Tiere, nur im Welt-Paket der Höhlenwelt (Teile wie in `front.ts`: vorn, rechts, unten, Länge,
// Breite, Höhe, Farbe, oben). Nach den Porträts im Konzept (Skizze 9), mit den Farben aus dem Konzept. Kindgerecht:
// runde Gesichter, keine Zähne, die Fledermaus mit Flughund-Gesicht. Der Kern kennt Name, Ton und Gangart
// (`CAVE_SPECIES` in mitwachsen-hoehle.ts); die Modelle trägt die Spielseite ein, wenn das Paket ankommt (`addModels`).
// Spec: docs/specs/mitwachsen.md (Abschnitt „Die Höhlen-Tiere“)

import { eyes, type Part } from '../../../../lib/games/front';
import type { CaveSpeciesId } from '../../mitwachsen-hoehle';
import { GROTTE_COLORS } from './mitwachsen-grotte';

const MOLE = '#2e2b33';
const PINK = '#f2a7b8';
const GLASS = '#e8e4f3'; // helle „Brille“ des Maulwurfs, helle Augen des Glühwürmchens
const SMILE = '#c4606a';

/**
 * Teil aus der Skizze im Konzept (x nach rechts im Bild, y nach oben, z vom Betrachter weg, das Tier schaut zum
 * Betrachter): als Teil des Modells, das nach vorn (+x im Modell) schaut, um `lift` angehoben
 */
const s = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  c: string,
  top?: string,
  lift = 0,
): Part => (top ? [-(z + d), -(x + w), y + lift, d, w, h, c, top] : [-(z + d), -(x + w), y + lift, d, w, h, c]);

/** Modell je Höhlen-Tier (wie es läuft, flattert oder schwimmt) */
export const CAVE_MODELS: Record<CaveSpeciesId, readonly Part[]> = {
  maulwurf: [
    s(-0.22, 0, -0.22, 0.44, 0.28, 0.5, MOLE, '#3a3640'), // runder Körper
    s(-0.12, 0.05, -0.3, 0.24, 0.16, 0.08, MOLE), // Schnauze
    s(-0.05, 0.1, -0.32, 0.1, 0.08, 0.02, PINK), // rosa Nase
    s(-0.34, 0, -0.24, 0.13, 0.06, 0.16, PINK), // rosa Grabehände
    s(0.21, 0, -0.24, 0.13, 0.06, 0.16, PINK),
    s(-0.03, 0.02, 0.28, 0.06, 0.06, 0.06, PINK), // Stummelschwanz
    ...eyes(0.23, 0.22, 0.2, 0.05, 0.045, 0.04, GLASS), // Brille aus zwei hellen Pixeln
  ],
  dachs: [
    s(-0.12, 0, 0.1, 0.08, 0.1, 0.1, MOLE), // Beine
    s(0.04, 0, 0.1, 0.08, 0.1, 0.1, MOLE),
    s(-0.2, 0, -0.3, 0.08, 0.1, 0.1, MOLE),
    s(0.12, 0, -0.3, 0.08, 0.1, 0.1, MOLE),
    s(-0.26, 0.1, -0.22, 0.52, 0.34, 0.8, '#8a8f96', '#9aa0a8'), // grauer Körper
    s(-0.2, 0.14, -0.42, 0.4, 0.3, 0.24, '#f2f0ea'), // heller Kopf
    s(-0.12, 0.16, -0.43, 0.07, 0.28, 0.25, MOLE, MOLE), // Kopfstreifen
    s(0.05, 0.16, -0.43, 0.07, 0.28, 0.25, MOLE, MOLE),
    s(-0.04, 0.14, -0.46, 0.08, 0.06, 0.04, MOLE), // Nase
    s(-0.2, 0.44, -0.36, 0.08, 0.06, 0.08, '#f2f0ea'), // Öhrchen mit hellem Rand
    s(0.12, 0.44, -0.36, 0.08, 0.06, 0.08, '#f2f0ea'),
    s(-0.05, 0.3, 0.58, 0.1, 0.08, 0.06, '#8a8f96'), // Stummelschwanz
    ...eyes(0.44, 0.2, 0.31, 0.045, 0.045, 0.085),
  ],
  grottenolm: [
    s(-0.06, 0, 0.32, 0.12, 0.08, 0.46, '#f3ead8'), // langer Schwanz
    s(-0.12, 0, -0.1, 0.24, 0.12, 0.44, '#f3ead8', '#fbf5ea'), // schlanker Körper
    s(-0.14, 0, -0.36, 0.28, 0.12, 0.26, '#f3ead8', '#fbf5ea'), // Kopf
    s(-0.2, 0.05, -0.26, 0.06, 0.04, 0.04, '#e0605a'), // kleine rote Kiemenpunkte
    s(0.14, 0.05, -0.26, 0.06, 0.04, 0.04, '#e0605a'),
    s(-0.21, 0.02, -0.2, 0.05, 0.03, 0.03, '#e0605a'),
    s(0.16, 0.02, -0.2, 0.05, 0.03, 0.03, '#e0605a'),
    s(-0.08, 0.025, -0.365, 0.16, 0.02, 0.01, SMILE), // lächelt
    s(-0.18, 0, -0.14, 0.06, 0.04, 0.1, '#e9dec8'), // Beinchen
    s(0.12, 0, -0.14, 0.06, 0.04, 0.1, '#e9dec8'),
    s(-0.16, 0, 0.18, 0.05, 0.04, 0.08, '#e9dec8'),
    s(0.11, 0, 0.18, 0.05, 0.04, 0.08, '#e9dec8'),
    ...eyes(0.36, 0.14, 0.07, 0.04, 0.035, 0.05),
  ],
  eidechse: [
    s(-0.05, 0, 0.26, 0.1, 0.07, 0.5, '#4fa38c'), // Schwanz
    s(-0.11, 0, -0.12, 0.22, 0.13, 0.42, '#5fb8a0', '#6cc6ad'), // Körper, grün-türkis
    s(-0.115, 0, -0.08, 0.23, 0.04, 0.34, '#ffe08a'), // gelber Bauch, an den Seiten zu sehen
    s(-0.1, 0, -0.34, 0.2, 0.11, 0.22, '#5fb8a0', '#6cc6ad'), // Kopf
    s(-0.08, 0, -0.35, 0.16, 0.05, 0.02, '#ffe08a'), // gelbe Kehle
    s(-0.06, 0.055, -0.355, 0.12, 0.015, 0.01, SMILE), // lächelt
    s(-0.2, 0, -0.1, 0.09, 0.04, 0.07, '#4fa38c'), // Beine
    s(0.11, 0, -0.1, 0.09, 0.04, 0.07, '#4fa38c'),
    s(-0.2, 0, 0.16, 0.09, 0.04, 0.07, '#4fa38c'),
    s(0.11, 0, 0.16, 0.09, 0.04, 0.07, '#4fa38c'),
    ...eyes(0.35, 0.1, 0.065, 0.04, 0.035, 0.04),
  ],
  siebenschlaefer: [
    s(-0.1, 0.22, 0.14, 0.2, 0.5, 0.18, '#d3d6de', '#e2e4ea'), // buschiger Schwanz, aufgestellt
    s(-0.19, 0, -0.2, 0.38, 0.34, 0.4, '#b9bcc6', '#c8cbd3'), // silbergrauer Körper
    s(-0.12, 0.04, -0.21, 0.24, 0.2, 0.02, '#e6e7ec'), // heller Bauch
    s(-0.17, 0.34, -0.26, 0.34, 0.28, 0.3, '#b9bcc6', '#c8cbd3'), // Kopf
    s(-0.15, 0.6, -0.2, 0.08, 0.1, 0.08, PINK), // rosa Öhrchen
    s(0.07, 0.6, -0.2, 0.08, 0.1, 0.08, PINK),
    s(-0.03, 0.38, -0.28, 0.06, 0.04, 0.02, PINK), // Näschen
    ...eyes(0.27, 0.17, 0.42, 0.09, 0.1, 0.03), // große Augen
  ],
  fledermaus: [
    // fliegt: Flügel ausgebreitet, etwas über dem Boden
    s(-0.12, 0.06, -0.1, 0.24, 0.26, 0.2, '#7a6a5e', '#8a7a6e', 0.15), // graubrauner Körper
    s(-0.11, 0.3, -0.12, 0.22, 0.2, 0.2, '#a08c7c', '#b09c8c', 0.15), // rundes Flughund-Gesicht
    s(-0.1, 0.48, -0.08, 0.06, 0.1, 0.06, PINK, PINK, 0.15), // rosa Ohren
    s(0.04, 0.48, -0.08, 0.06, 0.1, 0.06, PINK, PINK, 0.15),
    s(-0.02, 0.33, -0.13, 0.04, 0.03, 0.02, PINK, undefined, 0.15), // Näschen, kein Maul mit Zähnen
    s(-0.46, 0.16, -0.06, 0.34, 0.16, 0.14, '#8a82b0', '#9a93c0', 0.15), // Flügel
    s(0.12, 0.16, -0.06, 0.34, 0.16, 0.14, '#8a82b0', '#9a93c0', 0.15),
    ...eyes(0.12, 0.11, 0.53, 0.05, 0.05, 0.03),
  ],
  murmeltier: [
    s(-0.08, 0, 0.14, 0.16, 0.1, 0.2, '#8a6a3c'), // Schwanz
    s(-0.17, 0, -0.15, 0.34, 0.5, 0.3, '#b08850', '#bf9760'), // goldbraun, macht Männchen
    s(-0.1, 0.06, -0.16, 0.2, 0.3, 0.02, '#d9be8c'), // heller Bauch
    s(-0.15, 0.5, -0.18, 0.3, 0.26, 0.28, '#b08850', '#bf9760'), // Kopf
    s(-0.08, 0.52, -0.21, 0.16, 0.1, 0.04, '#e8d3a8'), // helle Schnauze
    s(-0.03, 0.6, -0.22, 0.06, 0.04, 0.02, '#3a2a22'), // Nase
    s(-0.15, 0.74, -0.12, 0.07, 0.06, 0.07, '#8a6a3c'), // Öhrchen
    s(0.08, 0.74, -0.12, 0.07, 0.06, 0.07, '#8a6a3c'),
    s(-0.12, 0.32, -0.2, 0.08, 0.08, 0.06, '#e8d3a8'), // Pfoten vor der Brust
    s(0.04, 0.32, -0.2, 0.08, 0.08, 0.06, '#e8d3a8'),
    ...eyes(0.21, 0.15, 0.64, 0.05, 0.05, 0.04),
  ],
  gluehwuermchen: [
    // fliegt etwas über dem Boden; das Hinterteil leuchtet gelbgrün
    s(-0.09, 0, 0.02, 0.18, 0.1, 0.14, '#d8ff6a', '#e6ff9a', 0.25),
    s(-0.09, 0, -0.12, 0.18, 0.12, 0.14, '#2f4a2a', '#3a5a34', 0.25), // dunkelgrüner Körper
    s(-0.07, 0, -0.2, 0.14, 0.1, 0.08, '#24381f', '#2f4a2a', 0.25), // Kopf
    s(-0.2, 0.1, -0.08, 0.12, 0.03, 0.16, '#7d8f6a', '#8a9c78', 0.25), // Flügel wie im Konzept (dort halb durchsichtig, hier deckend)
    s(0.08, 0.1, -0.08, 0.12, 0.03, 0.16, '#7d8f6a', '#8a9c78', 0.25),
    s(-0.05, 0.1, -0.16, 0.02, 0.06, 0.02, '#24381f', undefined, 0.25), // Fühler
    s(0.03, 0.1, -0.16, 0.02, 0.06, 0.02, '#24381f', undefined, 0.25),
    ...eyes(0.2, 0.07, 0.3, 0.04, 0.04, 0.02, GLASS),
  ],
};

/**
 * Die Fledermaus in Ruhehaltung: kopfüber, die Flügel angelegt, die Füße oben am Sitzplatz. Hängt von z = 0 nach unten
 * (die Ansicht hängt sie an die Unterkante des Kristallbogens, `Cell.perch`); rundes Gesicht, keine Zähne
 */
export const BAT_ROOST: readonly Part[] = [
  s(-0.06, -0.08, -0.04, 0.04, 0.08, 0.04, MOLE), // Füße halten sich oben fest
  s(0.02, -0.08, -0.04, 0.04, 0.08, 0.04, MOLE),
  s(-0.12, -0.32, -0.1, 0.24, 0.26, 0.2, '#7a6a5e', '#8a7a6e'), // Körper oben
  s(-0.2, -0.34, -0.08, 0.08, 0.24, 0.16, '#8a82b0'), // angelegte Flügel
  s(0.12, -0.34, -0.08, 0.08, 0.24, 0.16, '#8a82b0'),
  s(-0.11, -0.52, -0.12, 0.22, 0.2, 0.2, '#a08c7c', '#b09c8c'), // rundes Gesicht unten
  s(-0.1, -0.62, -0.08, 0.06, 0.1, 0.06, PINK), // Ohren zeigen nach unten
  s(0.04, -0.62, -0.08, 0.06, 0.1, 0.06, PINK),
  s(-0.02, -0.45, -0.13, 0.04, 0.03, 0.02, PINK), // Näschen
  ...eyes(0.12, 0.11, -0.43, 0.05, 0.05, 0.03),
];

/**
 * Ein kleiner Lichtgeist (Schritt 11 der Rückmeldung; kein Tier der Leiste): ein runder Tropfen, etwa 0,4 Felder hoch,
 * unten drei weiche Zipfel, milchiges Pfirsich mit dunklerem, warmem Rand (der Rand liegt als etwas größerer Quader
 * dahinter), kräftige Wangen, geschlossene lachende Augen (zwei kleine Bögen) und ein Lächeln. Kein Würfel, keine
 * Tentakel, keine Zunge, kein Laken mit Augenlöchern. Schwebt knapp über dem Boden (z = 0 ist seine Unterkante)
 */
export const GHOST_MODEL: readonly Part[] = ((c) => {
  const eye = (x: number): Part[] => [
    s(x + 0.012, 0.215, -0.118, 0.036, 0.016, 0.006, c.eye), // Bogen oben
    s(x, 0.196, -0.118, 0.014, 0.024, 0.006, c.eye), // links hinunter
    s(x + 0.046, 0.196, -0.118, 0.014, 0.024, 0.006, c.eye), // rechts hinunter
  ];
  return [
    s(-0.17, 0.05, -0.1, 0.34, 0.28, 0.2, c.rim), // warmer Rand
    s(-0.12, 0.31, -0.08, 0.24, 0.08, 0.16, c.rim),
    ...[-0.15, -0.045, 0.06].map((x) => s(x, 0, -0.095, 0.09, 0.07, 0.15, c.rim)),
    s(-0.15, 0.07, -0.112, 0.3, 0.25, 0.2, c.body, c.top), // runder Körper
    s(-0.1, 0.32, -0.09, 0.2, 0.065, 0.16, c.body, c.top), // gewölbt oben
    ...[-0.14, -0.035, 0.07].map((x, i) => s(x, i === 1 ? 0.005 : 0.015, -0.106, 0.07, 0.065, 0.17, c.body)), // drei weiche Zipfel
    s(-0.135, 0.13, -0.117, 0.05, 0.035, 0.005, c.cheek), // Wangen
    s(0.085, 0.13, -0.117, 0.05, 0.035, 0.005, c.cheek),
    ...eye(-0.1),
    ...eye(0.04),
    s(-0.025, 0.152, -0.118, 0.05, 0.014, 0.006, SMILE), // lächelt
  ];
})(GROTTE_COLORS.ghost);
