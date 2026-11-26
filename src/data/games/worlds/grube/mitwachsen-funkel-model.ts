// Modell des Grubenbähnchens Funkel, nur im Paket der Grubenbahn (Teile wie in `front.ts`: vorn, rechts, unten, Länge,
// Breite, Höhe, Farbe, oben; eigene Voxel-Grafik nach der Skizze der Konzeptseite „Höhle nach dem ersten Spielen“): eine
// kastenförmige Lok in Petrol mit großer runder Lampe vorn (sie ist sein Gesicht, Augen hat es keine) und kurzem
// Schornstein, dahinter zwei geschlossene Bankwagen mit Cremedach, schmal wie eine Feldbahn. Keine offene Lore (zu nah
// an anderen Spielen). Fahren: Die Figur sitzt im ersten Wagen hinter der Lok (dort ist das Dach offen, Kopf und
// Schultern schauen heraus); seine Tür hat bis zur ersten Fahrt einen goldenen Rahmen (nur dort kann das Kind etwas tun:
// einsteigen). Sonst kein Gold. Dazu die Farben seines eigenen, schmalen Gleises (mitwachsen-funkel-look.ts).
// Spec: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“)

import type { Part } from '../../../../lib/games/front';
import { HALT_NUMBER, numberBadge } from '../../mitwachsen-digits';
import { LOOK, figureParts } from '../../mitwachsen';
import { GOLD } from '../../mitwachsen-portals';

/** Farben von Funkel (Konzeptseite: Petrol #2f8f83, Dach Creme #f3ead2), je Seite und Oberseite, wo es zwei gibt */
export const FUNKEL_COLORS = {
  petrol: ['#2f8f83', '#3aa596'],
  cream: ['#f3ead2', '#fbf5e4'],
  window: '#1f4f4a', // Fenster und offene Tür: dunkles Petrol
  wheel: '#3c3f47',
  frame: '#2b2f38',
  lamp: '#ffe08a', // Lampe aus
  lit: '#fffbe6', // Lampe an
  glow: '#fff3b0', // Schein vor der Lampe
  rim: '#d9cfb4', // Rand der Lampe
} as const;

/** Farben des schmalen Gleises: Schwellen aus Schiefer, dunkle Schienen (anders als das Gleis der Höhlenbahn) */
export const GRUBE_RAIL = {
  sleeper: ['#5d5870', '#6c6680'],
  rail: ['#3f4552', '#59606e'],
} as const;

/** Zaunkristalle zur Höhle hin am Glitzergang (Kristallbusch der Grotte, lila wie die Kristalle der Halle) */
export const FENCE_CRYSTAL = '#cbacff';

/** Farben des Bahnsteigs an Funkels Halt (Issue 39): Planken aus Holz, Pfosten aus Schiefer, Tafel in Petrol */
export const HALT_COLORS = {
  plank: ['#b98a58', '#c99a66'],
  seam: '#8a633c',
  post: ['#5d5870', '#6c6680'],
  board: FUNKEL_COLORS.petrol,
} as const;
/** Eine Planke des Bahnsteigs: flach auf dem Boden ihres Felds (Mitte in der Mitte), zwei Fugen quer */
export const PLANK: readonly Part[] = [
  [-0.5, -0.5, 0, 1, 1, 0.06, ...HALT_COLORS.plank],
  [-0.5, -0.18, 0.06, 1, 0.03, 0.006, HALT_COLORS.seam],
  [-0.5, 0.15, 0.06, 1, 0.03, 0.006, HALT_COLORS.seam],
];
/**
 * Schild am Halt (zur Kamera, ohne Text): Pfosten, Tafel in Petrol, darauf ein Kristall in der Farbe der Zaunkristalle.
 * `SIGN_FACE`: Lage der Vorderseite der Tafel (vorn, unten, Breite, Höhe), für eine Zahl darauf
 */
export const SIGN_FACE = { f: 0.06, z: 1.02, wide: 0.64, high: 0.5 } as const;
export const HALT_SIGN: readonly Part[] = [
  [-0.05, -0.05, 0, 0.1, 0.1, 1.05, ...HALT_COLORS.post],
  [0, -SIGN_FACE.wide / 2, SIGN_FACE.z, SIGN_FACE.f, SIGN_FACE.wide, SIGN_FACE.high, ...HALT_COLORS.board],
  [SIGN_FACE.f, -0.2, SIGN_FACE.z + 0.2, 0.015, 0.2, 0.1, FENCE_CRYSTAL, FENCE_CRYSTAL], // Kristall: Raute aus drei Lagen
  [SIGN_FACE.f, -0.16, SIGN_FACE.z + 0.1, 0.015, 0.12, 0.1, FENCE_CRYSTAL, FENCE_CRYSTAL],
  [SIGN_FACE.f, -0.16, SIGN_FACE.z + 0.3, 0.015, 0.12, 0.1, FENCE_CRYSTAL, FENCE_CRYSTAL],
  ...numberBadge(HALT_NUMBER.funkel, SIGN_FACE.f, 0.17, SIGN_FACE.z + SIGN_FACE.high - 0.03, 0.045), // Halt 3 (Issue 40)
];

/** Länge eines Wagens (die Lok gleich lang): je Wagen ein Feld, mit Lücke */
export const CAR = 0.86;
const L = CAR;
const HW = 0.33; // halbe Breite: schmal wie eine Feldbahn
const P = FUNKEL_COLORS.petrol;
const C = FUNKEL_COLORS.cream;

/** Teil auf beiden Seiten: wie angegeben und quer gespiegelt */
const both = ([f, r, ...rest]: Part): Part[] => [
  [f, r, ...rest],
  [f, -r - rest[2], ...rest],
];

/** Räder und Rahmen jedes Wagens */
const UNDER: readonly Part[] = [
  ...both([-0.32, -HW + 0.02, 0.02, 0.2, 0.08, 0.16, FUNKEL_COLORS.wheel]),
  ...both([0.12, -HW + 0.02, 0.02, 0.2, 0.08, 0.16, FUNKEL_COLORS.wheel]),
  [-L / 2, -HW + 0.04, 0.12, L, 2 * HW - 0.08, 0.06, FUNKEL_COLORS.frame],
];

/** Die große runde Lampe vorn (gestuft rund aus drei Quadern, mit Rand); `lit`: an, mit kleinem Schein davor */
const lamp = (lit: boolean): Part[] => {
  const face = lit ? FUNKEL_COLORS.lit : FUNKEL_COLORS.lamp;
  return [
    [L / 2, -0.15, 0.24, 0.025, 0.3, 0.3, FUNKEL_COLORS.rim],
    [L / 2 + 0.02, -0.11, 0.26, 0.025, 0.22, 0.26, face],
    [L / 2 + 0.02, -0.14, 0.29, 0.025, 0.28, 0.2, face],
    ...(lit ? ([[L / 2 + 0.045, -0.09, 0.3, 0.03, 0.18, 0.18, FUNKEL_COLORS.glow]] as Part[]) : []),
  ];
};

/** Lok: Kasten in Petrol, hinten das Führerhaus mit Cremedach und Fenstern, vorn der kurze Schornstein */
const LOCO: readonly Part[] = [
  ...UNDER,
  [-L / 2, -HW, 0.18, L, 2 * HW, 0.36, ...P],
  [-L / 2, -HW, 0.54, 0.4, 2 * HW, 0.26, ...P], // Führerhaus
  ...both([-L / 2 + 0.08, -HW - 0.006, 0.6, 0.24, 0.012, 0.14, FUNKEL_COLORS.window]),
  [-L / 2 - 0.03, -HW - 0.03, 0.8, 0.46, 2 * HW + 0.06, 0.06, ...C], // Dach
  [0.12, -0.07, 0.54, 0.14, 0.14, 0.14, FUNKEL_COLORS.frame], // Schornstein
  [0.1, -0.09, 0.68, 0.18, 0.18, 0.04, ...C],
];

/** Die Figur sitzt im ersten Wagen: ohne Beine, Kopf und Schultern schauen oben heraus */
const FIGURE: readonly Part[] = figureParts(LOOK)
  .slice(4)
  .map(([f, r, z, ...rest]): Part => [f - 0.02, r, z - 0.02, ...rest]);

/** Bankwagen ohne Dach: Kasten in Petrol, darüber ein Fensterband mit Stegen */
const BENCH: readonly Part[] = [
  ...UNDER,
  [-L / 2, -HW, 0.18, L, 2 * HW, 0.28, ...P],
  [-L / 2, -HW, 0.46, L, 2 * HW, 0.24, FUNKEL_COLORS.window, FUNKEL_COLORS.window],
  ...[-L / 2, -0.03, L / 2 - 0.06].map((f): Part => [f, -HW - 0.006, 0.46, 0.06, 2 * HW + 0.012, 0.24, ...P]),
];
/** Cremedach, ganz oder (`open`) in der Mitte offen: Dort schaut die Figur heraus */
const roof = (open: boolean): Part[] =>
  open
    ? [
        [-L / 2 - 0.02, -HW - 0.03, 0.7, 0.2, 2 * HW + 0.06, 0.06, ...C],
        [L / 2 - 0.18, -HW - 0.03, 0.7, 0.2, 2 * HW + 0.06, 0.06, ...C],
      ]
    : [[-L / 2 - 0.02, -HW - 0.03, 0.7, L + 0.04, 2 * HW + 0.06, 0.06, ...C]];

/** Offene Tür zur Seite des Bahnsteigs (`side` +1 rechts, −1 links) */
const door = (side: 1 | -1): Part => [-0.16, side > 0 ? HW : -HW - 0.02, 0.18, 0.32, 0.02, 0.5, FUNKEL_COLORS.window];
/** Goldener Rahmen um die Tür zur Seite `side` bis zur ersten Fahrt: Hier steigt man ein */
const frame = (side: 1 | -1): Part[] => {
  const r = side > 0 ? HW + 0.004 : -HW - 0.03;
  return [
    [-0.21, r, 0.16, 0.05, 0.026, 0.56, GOLD.side, GOLD.top],
    [0.16, r, 0.16, 0.05, 0.026, 0.56, GOLD.side, GOLD.top],
    [-0.21, r, 0.68, 0.42, 0.026, 0.05, GOLD.side, GOLD.top],
  ];
};

/**
 * Wagen von Funkel: die Lok (`loco`, `lit`: die Lampe leuchtet), der erste Wagen (`seat`: hier sitzt die Figur,
 * `rider` während der Fahrt, `door` offen zur Seite +1/−1, `frame` goldener Rahmen um die Tür auf dieser Seite bis zur
 * ersten Fahrt), der zweite Wagen (`rear`)
 */
export type FunkelLook = {
  kind: 'loco' | 'seat' | 'rear';
  lit?: boolean;
  rider?: boolean;
  door?: 0 | 1 | -1;
  frame?: 0 | 1 | -1;
};

export const funkelParts = (k: FunkelLook): Part[] =>
  k.kind === 'loco'
    ? [...LOCO, ...lamp(!!k.lit)]
    : [
        ...BENCH,
        ...roof(!!k.rider),
        ...(k.rider ? FIGURE : []),
        ...(k.door ? [door(k.door)] : []),
        ...(k.frame ? frame(k.frame) : []),
      ];
