// Torplatte vor jedem großen Tor – rein, ohne DOM: Lage (mitten in der Bucht, Reihe 2, drei Felder quer zum Tor), Form
// als Voxel (ein flacher, ovaler Stein mit Rand) und wie weit sie gerade eingesunken ist. Ein Spielzeug: Die Figur läuft
// drüber, ohne anzuhalten (keine Begegnung); Betreten und Verlassen merkt sich nur die Ansicht (`PlateFx`, nicht
// gespeichert). Vor dem Eistor öffnet sie das Tor, wenn die Figur darauf steht (Regel im Welt-Paket der Eis-Welt,
// worlds/eis/mitwachsen-ritual.ts, mit der Stehzeit `still` aus mitwachsen-state.ts). Gesetzt im Weltbau (`forecourt` in mitwachsen-apron.ts), gezeichnet in 2D
// (mitwachsen-platform-2d.ts) und 3D (mitwachsen-plate-3d.ts), Töne in sfx.ts.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore, Begriff „Torplatte“)

import type { GateId, Point } from '../../data/games/mitwachsen';

/** Reihe der Bucht vor der Tür (1 direkt davor … 3), in der die Platte liegt: Reihe 1 bleibt frei für den Pinguin */
export const PLATE_ROW = 2;
/** Die Platte reicht quer zum Tor von −1 bis 1 (drei Felder), ein Feld tief */
export const PLATE_HALF = 1;
/** Voxel je Feld; die Platte ist 24 × 8 Voxel groß und einen Voxel dick */
export const PLATE_VOX = 8;
export const PLATE_LEN = (2 * PLATE_HALF + 1) * PLATE_VOX;
/** So tief sinkt sie ein, wenn man drauftritt (ein Voxel), in `SINK_MS`; hoch springt sie in `RISE_MS` */
export const SINK = 1 / PLATE_VOX;
export const SINK_MS = 80;
export const RISE_MS = 120;

/** Stein der Torplatte: Seite und Oberseite; der Rand hat die Farbe der Welt */
export const PLATE_STONE = ['#7f7a71', '#a9a49a'] as const;
/**
 * Schmuck der Torplatte aus dem Welt-Paket (Eis: Scholle mit Schneeflocke): Fläche (Seite, Oberseite) und eingelegtes
 * Zeichen in Weiß (Zeilen quer zur Platte, `plateVoxel`), gleich in 2D und 3D
 */
export type PlateLook = { face: readonly [side: string, top: string]; mark: readonly string[] };

/** Betreten oder Verlassen der Platte des Tors `id` zur Zeit `since` (ms); `on`: die Figur steht darauf */
export type PlateFx = { id: GateId; since: number; on: boolean };

/** Mittelfeld der Platte vor dem Tor `g` */
export const plateMid = (g: { mid: Point; out: Point }): Point => [
  g.mid[0] - g.out[0] * PLATE_ROW,
  g.mid[1] - g.out[1] * PLATE_ROW,
];

/**
 * Voxel (i entlang der Platte 0 … 23, k quer 0 … 7): Rand, Zeichen (aus `mark`, Zeilen quer, mittig; jedes Zeichen außer
 * '.'), Fläche oder nichts (die Ecken fehlen, so wirkt sie oval)
 */
export function plateVoxel(i: number, k: number, mark: readonly string[] = []): 'rim' | 'mark' | 'face' | null {
  const inside = (a: number, b: number) => {
    const end = Math.min(a, PLATE_LEN - 1 - a);
    const edge = Math.min(b, PLATE_VOX - 1 - b);
    return edge >= 0 && end >= ([3, 1][edge] ?? 0); // an den Längsrändern fehlen 3 bzw. 1 Voxel je Ecke
  };
  if (!inside(i, k)) return null;
  if (!inside(i - 1, k) || !inside(i + 1, k) || !inside(i, k - 1) || !inside(i, k + 1)) return 'rim';
  const row = mark[k - ((PLATE_VOX - mark.length) >> 1)] ?? '';
  const ch = row[i - ((PLATE_LEN - row.length) >> 1)];
  return ch && ch !== '.' ? 'mark' : 'face';
}

/**
 * Wie tief die Platte des Tors `id` gerade eingesunken ist (0 … `SINK`): Betreten sinkt sie in `SINK_MS`, Verlassen
 * springt sie in `RISE_MS` hoch; bei reduzierter Bewegung ohne Übergang
 */
export function plateSink(fx: PlateFx | null, id: GateId, now: number, reduced: boolean): number {
  if (fx?.id !== id) return 0;
  const t = reduced ? 1 : Math.min(1, (now - fx.since) / (fx.on ? SINK_MS : RISE_MS)); // since liegt nie nach now
  return SINK * (fx.on ? t : 1 - t);
}
