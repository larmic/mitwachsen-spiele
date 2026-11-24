// Modelle der Höhlenbahn und von Bahnhof Bär, nur im Paket der Bahn (Teile wie in `front.ts`: vorn, rechts, unten, Länge,
// Breite, Höhe, Farbe, oben; eigene Voxel-Grafik nach der Skizze im Konzept, keine Lore, kein Gesicht): der kleine Zug aus
// Lok und zwei Wagen, Silber mit lila Fensterband und türkisem Leuchtstreifen, vorn im Zielfenster eine Fledermaus, an den
// Seiten der Lok eine Kristall-Raute, weiße Dampfwölkchen; im hinteren Wagen sitzt Tok, sobald er eingestiegen ist, und
// dort geht die Tür auf. Bahnhof Bär: Bahnsteig aus Holzplanken mit heller Kante, eine Stufe über dem Gleis; Grasdach auf
// vier Pfosten mit Bank für wartende Tiere, darauf das Schild „Bär auf Grün“ (ohne Text); Toks Häuschen am Kopf. Fahren:
// Die Figur sitzt im mittleren Wagen (das Dach dort ist offen, Kopf und Schultern schauen heraus), seine Tür hat bis zur
// ersten Fahrt einen goldenen Rahmen (nur dort kann das Kind etwas tun: einsteigen), im Tunnel und am Abend leuchten die
// Lampen. Sonst kein Gold.
// Spec: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 1)

import type { Part } from '../../../../lib/games/front';
import { LOOK, figureParts } from '../../mitwachsen';
import { GOLD } from '../../mitwachsen-portals';
import { TOK_MODEL } from './mitwachsen-tok-model';

/** Farben des Zugs und des Bahnhofs (Konzept „Zug und Bahnhöfe“), je Seite und Oberseite, wo es zwei gibt */
export const TRAIN_COLORS = {
  silver: ['#c9c6d6', '#dcd9e6'],
  lila: '#a07cff',
  light: '#6fd6f0', // türkiser Leuchtstreifen
  wheel: '#3c3f47',
  front: '#3a3550', // Zielfenster und offene Tür
  lamp: '#ffe08a',
  lit: '#fffbe6', // Lampe an (Tunnel, Abend), mit Schein
  glow: '#fff3b0',
  warm: '#ffc06a', // warmes Licht im Fensterband (ab 20 min, nachts bis „Gute Nacht“, auf der Laternenfahrt)
  night: '#f6dca0', // kleines Nachtlicht nach „Gute Nacht“
  mast: '#8a5a34', // Stange des Kristall-Wimpels
  steam: '#ffffff',
  crystal: ['#b48cf0', '#6fd6f0', '#f08cc8'], // Raute: lila, türkis, rosa
  bat: { p: '#f2a7b8', g: '#a08c7c', k: '#1d2838', l: '#f2a7b8', w: '#b9b2dc' },
} as const;

export const STATION_COLORS = {
  plank: ['#c08a55', '#b37c49'],
  edge: '#f4e6c0',
  wood: '#8a5a34',
  bench: '#b07a48',
  roof: ['#5c9e34', '#73b746'],
  hut: '#d9b48a',
  hutRoof: ['#b5523f', '#c4634f'],
  door: '#6e4a30',
  glass: '#bfe3f5',
  sign: '#7cbf4a',
  bear: { b: '#8a5a34', k: '#2e2b33', l: '#e8c9a0' },
} as const;

/** Bär für das Schild auf Grün, 8 × 8 Pixel (b braun, k dunkel, l hell; Punkt: frei) */
const BEAR = ['bb....bb', 'bbbbbbbb', '.bbbbbb.', '.bkbbkb.', '.bbllbb.', '.blkklb.', '..bllb..', '...bb...'];
/** Fledermaus im Zielfenster der Lok, 9 × 7 Pixel (aus der Skizze, ohne Zähne) */
export const BAT = ['..p...p..', '..pgggp..', 'w.gkgkg.w', 'ww.glg.ww', 'wwwgggwww', '.ww.g.ww.', '..w...w..'];

/**
 * Pixelbild als Teile auf einer Fläche, die nach vorn (+vorn) schaut: bei vorn `f`, Mitte quer bei `r`, Oberkante bei
 * `top`, je Pixel `px` groß
 */
export function pixels(
  rows: readonly string[],
  pal: Readonly<Record<string, string>>,
  f: number,
  r: number,
  top: number,
  px: number,
): Part[] {
  const out: Part[] = [];
  const w = Math.max(...rows.map((l) => l.length));
  rows.forEach((line, row) =>
    [...line].forEach((ch, col) => {
      const c = pal[ch];
      if (c) out.push([f, r + (w / 2 - col - 1) * px, top - (row + 1) * px, 0.012, px, px, c]);
    }),
  );
  return out;
}

/** Länge eines Wagens (die Lok gleich lang): Lok und zwei Wagen mit Lücken sind gut 5 Felder lang */
export const CAR = 1.6;
const L = CAR;
const HW = 0.46; // halbe Breite
const S = TRAIN_COLORS.silver;

/** Teil auf beiden Seiten: wie angegeben und quer gespiegelt */
const both = ([f, r, ...rest]: Part): Part[] => [
  [f, r, ...rest],
  [f, -r - rest[2], ...rest],
];

/** Kasten eines Wagens (Mitte in der Mitte, vorn in Fahrtrichtung zum Prellbock von Bahnhof Bär) ohne Dach */
const BODY: readonly Part[] = [
  ...both([-0.62, -HW + 0.04, 0.02, 0.3, 0.1, 0.18, TRAIN_COLORS.wheel]), // Räder
  ...both([0.32, -HW + 0.04, 0.02, 0.3, 0.1, 0.18, TRAIN_COLORS.wheel]),
  [-L / 2, -HW, 0.16, L, 2 * HW, 0.4, ...S],
  [-L / 2, -HW, 0.56, L, 2 * HW, 0.3, TRAIN_COLORS.lila, TRAIN_COLORS.lila], // Fensterband
  ...[-0.42, 0, 0.42].map((f): Part => [f - 0.03, -HW - 0.006, 0.56, 0.06, 2 * HW + 0.012, 0.3, ...S]), // Fensterstege
  ...both([-L / 2, -HW - 0.012, 0.83, L, 0.04, 0.04, TRAIN_COLORS.light]), // Leuchtstreifen
];
/** Dach, ganz oder (`open`) in der Mitte offen: Dort schaut Tok heraus */
const roof = (open: boolean): Part[] =>
  open
    ? [
        [-L / 2 + 0.04, -HW + 0.04, 0.86, 0.42, 2 * HW - 0.08, 0.1, ...S],
        [L / 2 - 0.46, -HW + 0.04, 0.86, 0.42, 2 * HW - 0.08, 0.1, ...S],
      ]
    : [[-L / 2 + 0.04, -HW + 0.04, 0.86, L - 0.08, 2 * HW - 0.08, 0.1, ...S]];

/** Lampen an der Front (aus, oder an mit einem kleinen Schein davor): kein Punktlicht, nur Farbe */
const lamps = (lit: boolean): Part[] =>
  lit
    ? [
        ...both([L / 2, -HW + 0.06, 0.26, 0.03, 0.12, 0.08, TRAIN_COLORS.lit]),
        ...both([L / 2 + 0.03, -HW + 0.04, 0.24, 0.05, 0.16, 0.12, TRAIN_COLORS.glow]),
      ]
    : both([L / 2, -HW + 0.06, 0.26, 0.03, 0.12, 0.08, TRAIN_COLORS.lamp]);

/** Front der Lok: Zielfenster mit Fledermaus; an den Seiten die Kristall-Raute (die Lampen kommen aus `lamps`) */
const FRONT: readonly Part[] = [
  [L / 2, -0.28, 0.6, 0.02, 0.56, 0.24, TRAIN_COLORS.front],
  ...pixels(BAT, TRAIN_COLORS.bat, L / 2 + 0.02, 0, 0.82, 0.026),
  ...both([0.1, -HW - 0.014, 0.36, 0.08, 0.012, 0.08, TRAIN_COLORS.crystal[0]]),
  ...both([0.02, -HW - 0.016, 0.3, 0.08, 0.012, 0.06, TRAIN_COLORS.crystal[1]]),
  ...both([0.18, -HW - 0.016, 0.3, 0.08, 0.012, 0.06, TRAIN_COLORS.crystal[2]]),
];

/** Tok sitzt im hinteren Wagen: sein Modell, etwas tiefer, Kopf und Helm schauen oben heraus */
const RIDER: readonly Part[] = TOK_MODEL.map(([f, r, z, ...rest]): Part => [f, r, z + 0.32, ...rest]);

/** Die Figur sitzt im mittleren Wagen: ohne Beine, Kopf und Schultern schauen oben heraus */
const FIGURE: readonly Part[] = figureParts(LOOK)
  .slice(4)
  .map(([f, r, z, ...rest]): Part => [f - 0.05, r, z + 0.06, ...rest]);

/** Offene Tür zur Seite des Bahnsteigs (`side` +1 rechts, −1 links) */
const door = (side: 1 | -1): Part => [-0.26, side > 0 ? HW : -HW - 0.03, 0.18, 0.52, 0.03, 0.66, TRAIN_COLORS.front];
/** Goldener Rahmen um die Tür zur Seite `side` bis zur ersten Fahrt: Hier steigt man ein */
const frame = (side: 1 | -1): Part[] => {
  const r = side > 0 ? HW + 0.004 : -HW - 0.034;
  return [
    [-0.32, r, 0.16, 0.06, 0.03, 0.74, GOLD.side, GOLD.top],
    [0.26, r, 0.16, 0.06, 0.03, 0.74, GOLD.side, GOLD.top],
    [-0.32, r, 0.86, 0.64, 0.03, 0.06, GOLD.side, GOLD.top],
  ];
};

/** Warmes Licht in den vier Fenstern zwischen den Stegen, auf beiden Seiten (kein Punktlicht, nur Farbe) */
const WARM: readonly Part[] = [-0.76, -0.36, 0.06, 0.48].flatMap((f) =>
  both([f, -HW - 0.01, 0.6, 0.28, 0.012, 0.2, TRAIN_COLORS.warm]),
);
/** Kleines Nachtlicht über der Tür der Lok, nach „Gute Nacht“ (die Lampen sind aus) */
const NIGHT: readonly Part[] = both([-0.06, -HW - 0.012, 0.9, 0.12, 0.012, 0.08, TRAIN_COLORS.night]);
/**
 * Kristall-Wimpel nach der Laternenfahrt (Stufe `fest`): Stange auf dem Dach der Lok, ein lila Wimpel mit Kristall-Raute
 * in Türkis und Rosa (kein Gold: dort kann das Kind nichts tun)
 */
const PENNANT: readonly Part[] = [
  [-0.5, -0.03, 0.96, 0.05, 0.05, 0.62, TRAIN_COLORS.mast],
  [-0.5, 0.02, 1.32, 0.02, 0.36, 0.24, TRAIN_COLORS.lila],
  [-0.5, 0.14, 1.4, 0.022, 0.1, 0.08, TRAIN_COLORS.crystal[1]],
  [-0.5, 0.25, 1.42, 0.022, 0.06, 0.04, TRAIN_COLORS.crystal[2]],
];

/**
 * Wagen des Zugs: die Lok (`loco`, `lit`: die Lampen leuchten), der mittlere (`rider`: mit der Figur), der hintere (mit
 * Tok, sobald er sitzt); `door`: die Tür zum Bahnsteig offen (+1 rechts, −1 links, 0 zu), `frame`: goldener Rahmen um
 * die Tür auf dieser Seite (0: keiner); `warm`: warmes Licht im Fensterband (jeder Wagen); `night`: nur das kleine
 * Nachtlicht der Lok (nach „Gute Nacht“); `pennant`: der Kristall-Wimpel auf der Lok (nach der Laternenfahrt)
 */
export type CarLook = {
  kind: 'loco' | 'mid' | 'rear';
  tok: boolean;
  door: 0 | 1 | -1;
  rider?: boolean;
  frame?: 0 | 1 | -1;
  lit?: boolean;
  warm?: boolean;
  night?: boolean;
  pennant?: boolean;
};
export const carParts = (k: CarLook): Part[] => [
  ...BODY,
  ...roof((k.kind === 'rear' && k.tok) || !!k.rider),
  ...(k.kind === 'loco' ? [...FRONT, ...lamps(!!k.lit)] : []),
  ...(k.kind === 'rear' && k.tok ? RIDER : []),
  ...(k.rider ? FIGURE : []),
  ...(k.door ? [door(k.door)] : []),
  ...(k.frame ? frame(k.frame) : []),
  ...(k.warm ? WARM : []),
  ...(k.kind === 'loco' && k.night ? NIGHT : []),
  ...(k.kind === 'loco' && k.pennant ? PENNANT : []),
];

/** Weiße Dampfwölkchen über der Lok, je Phase (0 … 3) anders hoch (nicht bei reduzierter Bewegung) */
export const steamParts = (phase: number): Part[] =>
  [0, 1, 2].map((i): Part => {
    const k = (phase + i) % 4;
    const s = 0.1 + k * 0.03;
    return [0.4 - k * 0.12, -s / 2 + (i - 1) * 0.08, 1.0 + k * 0.2, s, s, s, TRAIN_COLORS.steam];
  });

// ---------- Bahnhof Bär ----------
// Eine Reihe des Bahnsteigs schaut vom Gleis weg (vorn): von −1 (Kante am Gleis) bis +1 (hinten), quer −0,5 … 0,5.

const SC = STATION_COLORS;
/** Planken einer Reihe mit heller Kante und der Stirnseite aus Holz zum Gleis hin (die Stufe) */
const row = (odd: boolean): Part[] => [
  [-1, -0.5, 0, 2, 1, 0.04, SC.plank[+odd]!, SC.plank[+odd]!],
  [-1, -0.5, 0.04, 0.1, 1, 0.015, SC.edge, SC.edge],
  [-1.03, -0.5, -1, 0.04, 1, 1.02, SC.wood],
];
/** Toks Häuschen auf dem hinteren Feld der Reihe, die Tür zum Gleis */
const HUT: readonly Part[] = [
  [0.08, -0.42, 0.04, 0.84, 0.84, 0.95, SC.hut],
  [0.02, -0.48, 0.99, 0.96, 0.96, 0.18, ...SC.hutRoof],
  [0.06, -0.16, 0.04, 0.03, 0.32, 0.6, SC.door],
  [0.06, 0.2, 0.46, 0.03, 0.16, 0.18, SC.glass],
];
/** Reihe des Bahnsteigs (`hut`: mit Toks Häuschen hinten) */
export const rowParts = (odd: boolean, hut: boolean): Part[] => [...row(odd), ...(hut ? HUT : [])];

/** Grasdach über zwei Reihen (Mitte in der Mitte der vier Felder) auf vier Pfosten, hinten die Bank */
export const ROOF: readonly Part[] = [
  ...[-0.92, 0.8].flatMap((f) => [-0.92, 0.8].map((r): Part => [f, r, 0.04, 0.12, 0.12, 1.5, SC.wood])),
  [-1.08, -1.08, 1.54, 2.16, 2.16, 0.2, ...SC.roof],
  [0.36, -0.6, 0.3, 0.4, 1.2, 0.08, SC.bench, SC.bench],
  [0.7, -0.6, 0.38, 0.06, 1.2, 0.3, SC.bench],
  ...[-0.5, 0.42].flatMap((r) => [0.4, 0.66].map((f): Part => [f, r, 0.04, 0.07, 0.07, 0.26, SC.wood])),
];

/** Schild auf dem Dach, zur Kamera (Körper schaut nach Süden): Bär auf Grün, 2 × 2 Schildbreite, ohne Text */
export const SIGN: readonly Part[] = [
  [-0.05, -0.05, 0, 0.1, 0.1, 0.16, SC.wood],
  [-0.03, -0.44, 0.16, 0.06, 0.88, 0.88, SC.sign, SC.sign],
  ...pixels(BEAR, SC.bear, 0.03, 0, 0.96, 0.09),
];
