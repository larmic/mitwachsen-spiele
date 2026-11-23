// Modelle des Schlittens der Eis-Welt, nur im Welt-Paket (Teile wie in `front.ts`: vorn, rechts, unten, Länge, Breite,
// Höhe, Farbe, oben; eigene Voxel-Grafik): ein niedriger, langer Holzschlitten in Himmelblau mit weißer Decke und
// silbernen Kufen, in dem die Figur sitzt (nie auf dem Tier); das Schlittenrentier mit rotem Geschirr und goldenen
// Glöckchen (es gehört zum Schlitten, kein Tier der Leiste, darum nicht in `SPECIES`); der Schuppen aus Eisblöcken mit
// Laterne an der Tür. Varianten: goldener Rahmen bis zur ersten Fahrt, Wimpel mit Schneeflocke danach, Laterne am
// Schlitten am Abend und in der Nacht (dann leuchtet auch die am Schuppen), kurz offene Seitenwände beim Anstoßen.
// Spec: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import type { Part } from '../../../../lib/games/front';
import { LOOK, figureParts } from '../../mitwachsen';
import { GOLD } from '../../mitwachsen-portals';
import { RIDES } from '../../mitwachsen-rides';
import { ICE_COLORS } from './mitwachsen-ice-colors';
import { ICE_MODELS } from './mitwachsen-ice-models';

const SKY = [RIDES[0].color, '#a6d4f4'] as const; // Himmelblau, oben heller
const SKY_DARK = '#5a94c4';
const RUNNER = ['#b4bec8', '#e6ecf2'] as const; // Silber
const BLANKET = ['#e8eef5', '#ffffff'] as const;
const FRAME = [GOLD.side, GOLD.top] as const;
const HARNESS = ['#c0392b', '#d9573f'] as const;
const LEATHER = '#6b4a36';
const IRON = '#4a4f5a';
const LAMP = ['#ffc94a', '#fff1b8'] as const; // brennt
const GLASS = ['#c9d6e0', '#e8eef3'] as const; // aus

/** Teil auf beiden Seiten: wie angegeben und an der Mitte gespiegelt */
const both = ([f, r, ...rest]: Part): Part[] => [
  [f, r, ...rest],
  [f, -r - rest[2], ...rest],
];
/** Teile um (df, dz) versetzt */
const shift = (parts: readonly Part[], df: number, dz: number): Part[] =>
  parts.map(([f, r, z, ...rest]) => [f + df, r, z + dz, ...rest]);

/** Schlitten (Mitte auf dem Feld des Sitzes, vorn zum Zugtier) */
const SLED: readonly Part[] = [
  ...both([-0.55, 0.24, 0, 1.08, 0.06, 0.04, ...RUNNER]), // Kufen, vorn hochgebogen
  ...both([0.5, 0.24, 0.04, 0.06, 0.06, 0.14, ...RUNNER]),
  ...both([0.4, 0.24, 0.16, 0.14, 0.06, 0.04, ...RUNNER]),
  ...both([-0.4, 0.25, 0.04, 0.05, 0.05, 0.08, SKY_DARK]), // Streben
  ...both([0.2, 0.25, 0.04, 0.05, 0.05, 0.08, SKY_DARK]),
  [-0.5, -0.28, 0.12, 0.95, 0.56, 0.05, ...SKY], // Boden
  [-0.56, -0.28, 0.12, 0.06, 0.56, 0.34, ...SKY], // Lehne
  [0.42, -0.28, 0.17, 0.05, 0.56, 0.1, ...SKY], // Brett vorn
  [0.02, -0.23, 0.17, 0.4, 0.46, 0.08, ...BLANKET], // weiße Decke über den Beinen
];
/** Seitenwände, stehend */
const SIDES: readonly Part[] = both([-0.5, 0.23, 0.17, 0.95, 0.05, 0.14, ...SKY]);
/** Seitenwände, einladend nach außen geklappt (angestoßen: Die Tür geht auf) */
const SIDES_OPEN: readonly Part[] = both([-0.5, 0.28, 0.12, 0.95, 0.14, 0.04, ...SKY]);
/** Goldener Rahmen bis zur ersten Fahrt (wie die Tür eines Fahrzeugs: Hier geht es los) */
const GOLDEN: readonly Part[] = [
  ...both([-0.5, 0.22, 0.31, 0.95, 0.07, 0.03, ...FRAME]),
  [-0.57, -0.29, 0.46, 0.08, 0.58, 0.03, ...FRAME],
];
/** Wimpel mit Schneeflocke nach der ersten Heimfahrt */
const PENNANT: readonly Part[] = [
  [-0.6, 0.18, 0.46, 0.04, 0.04, 0.5, LEATHER], // Stange
  [-0.56, 0.19, 0.74, 0.26, 0.015, 0.2, ...BLANKET], // Wimpel
  [-0.47, 0.205, 0.83, 0.1, 0.006, 0.025, ...SKY], // Schneeflocke
  [-0.43, 0.205, 0.79, 0.025, 0.006, 0.1, ...SKY],
  [-0.47, 0.179, 0.83, 0.1, 0.006, 0.025, ...SKY],
  [-0.43, 0.179, 0.79, 0.025, 0.006, 0.1, ...SKY],
];
/** Laterne am Schlitten, am Abend und in der Nacht */
const LANTERN: readonly Part[] = [
  [0.44, -0.31, 0.22, 0.03, 0.03, 0.32, IRON],
  [0.4, -0.35, 0.42, 0.1, 0.1, 0.12, ...LAMP],
  [0.39, -0.36, 0.54, 0.12, 0.12, 0.03, IRON],
];
/** Die Figur sitzt im Schlitten: ohne Beine (sie liegen unter der Decke), etwas tiefer, an der Lehne */
const RIDER: readonly Part[] = shift(figureParts(LOOK).slice(4), -0.22, -0.16);

/** Variante des Schlittens */
export type SledLook = { frame: boolean; pennant: boolean; lamp: boolean; seated: boolean; open: boolean };
/** Teile des Schlittens in seiner Variante */
export const sledParts = (k: SledLook): Part[] => [
  ...SLED,
  ...(k.open ? SIDES_OPEN : SIDES),
  ...(k.frame ? GOLDEN : []),
  ...(k.pennant ? PENNANT : []),
  ...(k.lamp ? LANTERN : []),
  ...(k.seated ? RIDER : []),
];

/** Das Schlittenrentier (Mitte auf dem Feld vor dem Sitz) mit Geschirr, Glöckchen und Zugriemen zum Schlitten */
export const REINDEER: readonly Part[] = [
  ...ICE_MODELS.rentier,
  [0.14, -0.14, 0.4, 0.12, 0.28, 0.06, ...HARNESS], // Halsband
  [-0.1, -0.145, 0.25, 0.06, 0.29, 0.26, ...HARNESS], // Bauchgurt
  ...both([0.2, 0.12, 0.33, 0.06, 0.05, 0.06, ...FRAME]), // Glöckchen
  [0.27, -0.03, 0.32, 0.05, 0.06, 0.06, ...FRAME],
  ...both([-0.44, 0.13, 0.32, 0.36, 0.02, 0.025, LEATHER]), // Zugriemen zum Schlitten
];

const BLOCKS = [ICE_COLORS.ice, ICE_COLORS.slide] as const;
/** Mauer aus Eisblöcken in zwei Lagen, versetzt: von (f, r) aus `len` lang (entlang `along`), `thick` dick */
function wall(f: number, r: number, along: 'f' | 'r', len: number, thick: number): Part[] {
  const out: Part[] = [];
  for (let row = 0; row < 3; row++)
    for (let a = row % 2 ? -0.25 : 0, i = 0; a < len - 1e-6; a += 0.5, i++) {
      const s = Math.max(0, a);
      const l = Math.min(len, a + 0.5) - s;
      const [side, top] = BLOCKS[(row + i) % 2]!;
      const z = row * 0.36;
      out.push(along === 'r' ? [f, r + s, z, thick, l, 0.36, side, top] : [f + s, r, z, l, thick, 0.36, side, top]);
    }
  return out;
}

/** Schuppen aus Eisblöcken, 2 Felder tief und 3 breit (Mitte in seiner Mitte, vorn die Tür zum Halt) */
const SHED: readonly Part[] = [
  ...wall(-0.98, -1.45, 'r', 2.9, 0.25), // Rückwand
  ...wall(-0.73, -1.45, 'f', 1.71, 0.25), // Seiten
  ...wall(-0.73, 1.2, 'f', 1.71, 0.25),
  ...wall(0.73, -1.2, 'r', 0.65, 0.25), // vorn, mit Tor für den Schlitten
  ...wall(0.73, 0.55, 'r', 0.65, 0.25),
  [0.73, -0.55, 0.78, 0.25, 1.1, 0.3, ...ICE_COLORS.ice], // Sturz über dem Tor
  [-1.02, -1.5, 1.08, 2.04, 3, 0.1, ...ICE_COLORS.ice], // Dach mit Schnee
  [-0.96, -1.44, 1.18, 1.92, 2.88, 0.08, ...ICE_COLORS.snow],
  [0.98, 0.6, 0.86, 0.12, 0.03, 0.03, IRON], // Haken der Laterne
];
/** Schuppen; seine Laterne an der Tür brennt am Abend und in der Nacht (`lit`) */
export const shedParts = (lit: boolean): Part[] => [
  ...SHED,
  [1.02, 0.56, 0.64, 0.12, 0.12, 0.16, ...(lit ? LAMP : GLASS)],
  [1.01, 0.55, 0.8, 0.14, 0.14, 0.03, IRON],
];
