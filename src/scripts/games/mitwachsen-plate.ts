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
 * Schmuck einer Torplatte (Eis: Scholle mit Schneeflocke aus dem Welt-Paket; die anderen Welten in 3D aus ihrem Bauplan
 * mitwachsen-gate-<welt>.ts): Fläche (Seite, Oberseite) und eingelegtes Zeichen (Zeilen quer zur Platte, `plateVoxel`;
 * jedes Zeichen außer '.' ist eine Farbe aus `PALETTE` in mitwachsen-portals.ts, in 3D leuchten die aus `GLOW`). Nur 3D:
 * `under` legt eine zweite Lage in dieser Farbe darunter (die Platte ist dann zwei Voxel dick: Wolkenkissen, Pilzhut,
 * der von unten glimmt), `deep` lässt sie zwei Voxel tief einsinken (sie federt), `bob` wippt sie leicht, solange die
 * Figur darauf steht (Stegplanke); bei reduzierter Bewegung beides nicht
 */
export type PlateLook = {
  face: readonly [side: string, top: string];
  mark: readonly string[];
  under?: string;
  deep?: true;
  bob?: true;
};

/** Betreten oder Verlassen der Platte des Tors `id` zur Zeit `since` (ms); `on`: die Figur steht darauf */
export type PlateFx = { id: GateId; since: number; on: boolean };

/** Mittelfeld der Platte vor dem Tor `g` */
export const plateMid = (g: { mid: Point; out: Point }): Point => [
  g.mid[0] - g.out[0] * PLATE_ROW,
  g.mid[1] - g.out[1] * PLATE_ROW,
];

/**
 * Voxel (i entlang der Platte 0 … 23, k quer 0 … 7): Rand ('rim'), Zeichen (aus `mark`, Zeilen quer, mittig: das Zeichen
 * selbst, ein Buchstabe; '.' ist keines), Fläche ('face') oder nichts (die Ecken fehlen, so wirkt sie oval)
 */
export function plateVoxel(i: number, k: number, mark: readonly string[] = []): string | null {
  const inside = (a: number, b: number) => {
    const end = Math.min(a, PLATE_LEN - 1 - a);
    const edge = Math.min(b, PLATE_VOX - 1 - b);
    return edge >= 0 && end >= ([3, 1][edge] ?? 0); // an den Längsrändern fehlen 3 bzw. 1 Voxel je Ecke
  };
  if (!inside(i, k)) return null;
  if (!inside(i - 1, k) || !inside(i + 1, k) || !inside(i, k - 1) || !inside(i, k + 1)) return 'rim';
  const row = mark[k - ((PLATE_VOX - mark.length) >> 1)] ?? '';
  const ch = row[i - ((PLATE_LEN - row.length) >> 1)];
  return ch && ch !== '.' ? ch : 'face';
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

/** So lange steht (oder läuft) die Figur auf einer Platte, bis oben die Postkarte der Torfront einblendet */
export const POSTCARD_MS = 1000;

/**
 * Tor, dessen Front die Postkarte gerade zeigt: seit `POSTCARD_MS` ist die Figur auf seiner Platte (`fx` aus
 * mitwachsen-plate-toy.ts), sonst null. Nie bei Toren im Norden (`out` [0, −1]): Deren Front sieht die Kamera von
 * Süden ohnehin, die Postkarte läge über dem echten Tor, gerade wenn dort „noch nicht“ oder das Öffnen zu sehen ist.
 * Gleich in 2D, 3D und bei reduzierter Bewegung; Ein- und Ausblenden (250 ms) macht das CSS der Spielfläche
 */
export const postcard = (fx: PlateFx | null, now: number, gates: ReadonlyMap<GateId, { out: Point }>): GateId | null =>
  fx?.on && now - fx.since >= POSTCARD_MS && gates.get(fx.id)?.out[1] !== -1 ? fx.id : null;
