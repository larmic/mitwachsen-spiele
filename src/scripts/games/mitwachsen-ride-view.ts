// Haken der Ansicht für Fahrzeuge aus einem Welt-Paket (Eis-Welt: Schlitten mit Schlittenrentier und Schuppen,
// worlds/eis/mitwachsen-sled-look.ts) – rein, ohne DOM und Three.js. Das Paket liefert Körper (Modelle mit Lage), flache
// Marken am Boden (Spur, Fleck am Halt) und zu jedem Ereignis Ton, Hüpfer, Herz und Funken; der Kern zeichnet sie in 2D
// und 3D gleich, lässt die Figur dem Sitz folgen und trifft sie beim Antippen. Die Figur sitzt im Modell des Fahrzeugs
// (der Körper mit `seat`); solange sie fährt, zeichnen beide Ansichten sie nicht selbst.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import type { Dir, Part, Projection } from '../../lib/games/front';
import type { RideId } from '../../data/games/mitwachsen-rides';
import { dirTo } from './mitwachsen-free';
import type { MoveCmd } from './mitwachsen-rider';
import type { Scored } from './sfx';

/**
 * Ein Körper eines Fahrzeugs: `id` fest je Teil (beginnt mit `ride:`, so trifft ihn das Antippen), `key` je Variante
 * seines Modells (wenige, feste: die 3D-Ansicht hält jede Form, einmal gebaut), Lage in Feldern (Mitte bei x + 0,5),
 * Blickrichtung, Teile wie bei den Tieren; `seat`: Hier sitzt die Figur (die Kamera folgt ihm)
 */
export type RideBody = {
  id: string;
  key: string;
  x: number;
  y: number;
  z: number;
  dir: Dir;
  parts: readonly Part[];
  seat?: true;
};

/**
 * Was die Körper je Bild brauchen: Zeit, Bruchteil des laufenden Takts (0 … 1), reduzierte Bewegung, Abendlicht (`lit`:
 * Laterne und Lampen), warmes Licht (`warm`: ab 20 min Spielzeit und nachts, Fensterband des Zugs), welche Fahrzeuge
 * nach „Gute Nacht“ ihr Licht aus haben (`asleep`, nur im Schlaf)
 */
export type RideAt = {
  now: number;
  frac: number;
  reduced: boolean;
  lit: boolean;
  warm?: boolean;
  asleep?: readonly RideId[];
};

/**
 * Antwort der Ansicht auf ein Ereignis eines Fahrzeugs: Töne, wer hüpft (`who`: Tier, `player`, sonst niemand), ob er
 * ein Herz bekommt, Funken an der Stelle des Ereignisses (`burst`, nicht bei reduzierter Bewegung), ein Zzz steigt dort
 * auf (`zzz`: ein schlafendes Fahrzeug, nicht bei reduzierter Bewegung); `chorus`: Tiere, die kurz danach antworten und
 * hüpfen (`CHORUS_MS`; ihr Ton steht in `score`)
 */
export type RideFx = {
  score: readonly Scored[];
  who?: string;
  heart?: true;
  burst?: readonly string[];
  zzz?: true;
  chorus?: readonly string[];
};

/** So viel später (ms) hüpfen die Tiere, die antworten (`RideFx.chorus`: Murmeltiere pfeifen zurück, wenn der Zug tutet) */
export const CHORUS_MS = 400;

/**
 * „Gute Nacht“ eines Fahrzeugs (`View2D.goodNight`): seine Töne ab 0 s; die Spielseite reiht die Fahrzeuge in Sichtweite
 * nacheinander (mitwachsen-bedtime.ts), danach ist sein Licht aus (`RideAt.asleep`)
 */
export type GoodNight = { id: RideId; score: readonly Scored[] };

/** Der Körper, in dem die Figur sitzt (nur während der Fahrt) */
export const seatOf = (rides: readonly RideBody[]) => rides.find((r) => r.seat);

/** Die Figur hüpft im Sitz (winkt): Der Körper mit ihr hüpft um `hop` Felder mit */
export const withHop = (rides: readonly RideBody[], hop: number): readonly RideBody[] =>
  hop ? rides.map((r) => (r.seat ? { ...r, z: r.z + hop } : r)) : rides;

/** Quader nach der Reihe, in der die 2D-Ansicht sie zeichnet (ihre Vorderkante, wie die Eis-Dinge) */
export function byRow<B extends readonly [number, number, number, number, number, ...unknown[]]>(
  boxes: readonly B[],
): Map<number, B[]> {
  const out = new Map<number, B[]>();
  for (const b of boxes) {
    const row = Math.ceil(b[1] + b[4] - 1e-6) - 1;
    out.set(row, [...(out.get(row) ?? []), b]);
  }
  return out;
}

/** So weit um seine Mitte (in Feldbreiten auf dem Bildschirm) trifft ein Finger einen Körper */
export const TAP_RADIUS = 0.8;

/**
 * Antippen: der Körper eines Fahrzeugs unter dem Bildschirmpunkt (px, py), der nächste zuerst; `project` ist die
 * Projektion der Ansicht (2D von vorn oder die 3D-Kamera), so trifft es in beiden gleich
 */
export function tapRide(rides: readonly RideBody[], project: Projection, px: number, py: number): RideBody | undefined {
  let best: RideBody | undefined;
  let near = Infinity;
  for (const r of rides) {
    if (!r.id.startsWith('ride:')) continue;
    const [cx, cy] = project(r.x + 0.5, r.y + 0.5, r.z + 0.4);
    const [ex, ey] = project(r.x + 1.5, r.y + 0.5, r.z + 0.4);
    const d = Math.hypot(px - cx, py - cy);
    if (d <= Math.hypot(ex - cx, ey - cy) * TAP_RADIUS && d < near) [best, near] = [r, d];
  }
  return best;
}

/**
 * Befehl zum angetippten Körper: ein neuer Druck in seine Richtung (`tap`: nur einsteigen, nie laufen), `ride` das
 * Fahrzeug, dem er gehört (aus seiner Kennung `ride:<Fahrzeug>…`)
 */
export const tapCmd = (r: Pick<RideBody, 'id' | 'x' | 'y'>, player: { x: number; y: number }): MoveCmd => {
  const ride = r.id.split(':')[1] as RideId | undefined;
  return {
    type: 'move',
    dir: dirTo(Math.round(r.x) - player.x, Math.round(r.y) - player.y),
    fresh: true,
    tap: true,
    ...(ride ? { ride } : {}),
  };
};
