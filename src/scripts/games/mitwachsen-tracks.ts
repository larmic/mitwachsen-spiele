// Spuren am Boden – nur Bild, nie gespeichert: ein Ringpuffer der letzten Abdrücke (Feld, Richtung, Art des Abdrucks,
// wann), die langsam verwehen. Generisch: Welcher Boden Abdrücke nimmt und wer läuft, sagt die Welt, die ihn nutzt
// (heute die Eis-Welt mit Fußspuren im Schnee, worlds/eis/mitwachsen-prints.ts; später etwa Sand). Rein und ohne DOM;
// gezeichnet wird mit `marks` als flache Rechtecke, gleich in 2D und 3D.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Was angezeigt wird“, Zeile „Fußspuren“)

import type { Dir } from '../../lib/games/front';
import type { Gait } from '../../data/games/mitwachsen';

/** Form eines Abdrucks: Stiefel der Figur, Dreizack (watscheln), Tatze, Huf, Hoppelspur, Trippeln, Robbenspur, Krallen */
export type PrintKind = 'stiefel' | 'dreizack' | 'tatze' | 'huf' | 'hoppel' | 'trippel' | 'schleif' | 'kralle';
/** Ein Abdruck auf Feld (x, y), in Richtung `dir` gelaufen, entstanden bei `born` (Uhr des Puffers) */
export type Print = { x: number; y: number; dir: Dir; kind: PrintKind; born: number };
/** Rechteck am Boden in Feldern: x, y (links oben), Breite, Tiefe */
export type Mark = readonly [number, number, number, number];

// höchstens so viele Abdrücke zugleich; der älteste weicht dem neuen. Reicht für die Figur mit Kette und die Tiere
// ringsum (gut 15 Abdrücke je Sekunde) über die ganze Lebensdauer
export const TRACKS_CAP = 720;
export const TRACKS_LIFE = 40; // so viele Sekunden bei Windstille, bis ein Abdruck verweht ist
const WIND_DRIFT = 3; // beim Pustewind (1) verweht es viermal so schnell
const SNOW_DRIFT = 1; // bei Schneefall (1) doppelt so schnell
const STEPS = 3; // bei reduzierter Bewegung verschwindet ein Abdruck in so vielen Stufen statt zu verblassen
const PER_CELL = 2; // höchstens so viele noch ganz deutliche Abdrücke auf einem Feld (eine Kette tritt in dieselben)

/** Abdruck je Gangart (`Gait`); ohne Gangart Tatzen, bei Hufen (`hoof`) Hufe */
export function printOf(gait: Gait | undefined, hoof = false): PrintKind {
  if (!gait) return hoof ? 'huf' : 'tatze';
  return (
    { watscheln: 'dreizack', robben: 'schleif', huepfen: 'hoppel', huschen: 'trippel', flattern: 'kralle' } as const
  )[gait];
}

/**
 * Teile eines Abdrucks in einem Feld: quer (nach rechts), längs (nach vorn), Breite quer, Länge längs; um die Mitte
 * des Felds. Klein und mit Lücken, damit eine Spur nie wie ein Weg aussieht
 */
const SHAPES: Record<PrintKind, readonly Mark[]> = {
  stiefel: [
    [-0.12, -0.15, 0.12, 0.2],
    [0.12, 0.15, 0.12, 0.2],
  ],
  dreizack: [-1, 1].flatMap((s) => [
    [s * 0.12, s * 0.12, 0.04, 0.13],
    [s * 0.12 - 0.06, s * 0.12 + 0.04, 0.04, 0.08],
    [s * 0.12 + 0.06, s * 0.12 + 0.04, 0.04, 0.08],
  ]),
  tatze: [-1, 1].flatMap((s) => [
    [s * 0.13, s * 0.12, 0.12, 0.1],
    [s * 0.13 - 0.06, s * 0.12 + 0.1, 0.04, 0.04],
    [s * 0.13, s * 0.12 + 0.12, 0.04, 0.04],
    [s * 0.13 + 0.06, s * 0.12 + 0.1, 0.04, 0.04],
  ]),
  huf: [-1, 1].flatMap((s) => [
    [s * 0.12 - 0.035, s * 0.14, 0.05, 0.13],
    [s * 0.12 + 0.035, s * 0.14, 0.05, 0.13],
  ]),
  hoppel: [
    [-0.09, 0.2, 0.08, 0.15],
    [0.09, 0.2, 0.08, 0.15],
    [0, -0.04, 0.07, 0.07],
    [0, -0.2, 0.07, 0.07],
  ],
  trippel: [
    [-0.06, 0.24, 0.04, 0.04],
    [0.06, 0.09, 0.04, 0.04],
    [-0.06, -0.06, 0.04, 0.04],
    [0.06, -0.21, 0.04, 0.04],
  ],
  schleif: [
    [0, 0, 0.16, 0.5],
    [-0.17, 0.1, 0.06, 0.1],
    [0.17, 0.1, 0.06, 0.1],
  ],
  kralle: [
    [-0.08, -0.06, 0.03, 0.14],
    [0.08, 0.06, 0.03, 0.14],
  ],
};
/** Höchstens so viele Rechtecke hat ein Abdruck (`marks`) */
export const MAX_PARTS = Math.max(...Object.values(SHAPES).map((s) => s.length));
/** Vorn je Richtung als (dx, dy); rechts davon ist (−dy, dx) */
const FORWARD: Record<Dir, readonly [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/**
 * Rechtecke eines Abdrucks am Boden (in Feldern), gedreht in seine Richtung. Links und rechts wechseln von Feld zu
 * Feld (gespiegelt, wenn x + y ungerade ist), so sieht eine Spur aus wie Schritte
 */
export function marks(p: Print): Mark[] {
  const [fx, fy] = FORWARD[p.dir];
  const side = (p.x + p.y) & 1 ? -1 : 1;
  return SHAPES[p.kind].map(([a, f, w, l]) => {
    const [cx, cy] = [p.x + 0.5 + side * a * -fy + f * fx, p.y + 0.5 + side * a * fx + f * fy];
    const [mw, md] = fx ? [l, w] : [w, l];
    return [cx - mw / 2, cy - md / 2, mw, md];
  });
}

/**
 * Wie deutlich ein Abdruck noch zu sehen ist (0 … 1) nach `age` Sekunden (Uhr des Puffers) bei `life` Sekunden
 * Lebensdauer: die erste Hälfte ganz, dann verblasst er; bei reduzierter Bewegung ohne Ausblenden, in Stufen
 */
export function fade(age: number, life: number, reduced: boolean): number {
  const t = 1 - age / life;
  if (t <= 0) return 0;
  return reduced ? Math.ceil(t * STEPS) / STEPS : Math.min(1, t * 2);
}

/** Ringpuffer der Abdrücke mit eigener Uhr, die bei Wind und Schneefall schneller läuft (so verweht es schneller) */
export class Tracks {
  private ring: Print[] = [];
  private next = 0;
  /** Uhr des Puffers in Sekunden */
  clock = 0;

  constructor(
    readonly cap = TRACKS_CAP,
    readonly life = TRACKS_LIFE,
  ) {}

  /** Es vergehen `dt` Sekunden, bei Pustewind (`wind`, 0 … 1) und Schneefall (`snow`, 0 … 1) verweht es schneller */
  pass(dt: number, wind = 0, snow = 0) {
    this.clock += Math.max(0, dt) * (1 + WIND_DRIFT * wind + SNOW_DRIFT * snow);
  }

  /**
   * Ein neuer Abdruck; ist der Puffer voll, weicht der älteste. Liegen auf dem Feld schon `PER_CELL` ganz deutliche
   * Abdrücke (eine Kette tritt in dieselben Felder), bleibt es dabei: nichts kommt dazu, sonst würde es dunkel und unruhig
   */
  add(x: number, y: number, dir: Dir, kind: PrintKind): boolean {
    let fresh = 0;
    for (const q of this.ring) if (q.x === x && q.y === y && this.clock - q.born < this.life / 2) fresh++;
    if (fresh >= PER_CELL) return false;
    const p: Print = { x, y, dir, kind, born: this.clock };
    if (this.ring.length < this.cap) this.ring.push(p);
    else this.ring[this.next] = p;
    this.next = (this.next + 1) % this.cap;
    return true;
  }

  /**
   * Alle Abdrücke, die noch zu sehen sind, je mit Deutlichkeit (`fade`), die neuesten zuerst. Kommen so viele dazu,
   * dass der Puffer vor Ablauf der Lebensdauer voll wäre, verwehen alle so viel schneller, dass der älteste schon weg
   * ist, wenn er dem nächsten weicht (nie verschwindet ein deutlicher Abdruck schlagartig). Geschätzt aus dem Alter des
   * ältesten und der Füllung, so wird es gleitend schneller, schon bevor der Puffer voll ist
   */
  live(reduced: boolean): [Print, number][] {
    const n = this.ring.length;
    const oldest = this.ring[n === this.cap ? this.next : 0];
    const full = oldest ? ((this.clock - oldest.born) * this.cap) / n : Infinity; // so alt wäre er, wenn er weicht
    const life = Math.max(1e-6, Math.min(this.life, full));
    const out: [Print, number][] = [];
    for (let i = 1; i <= n; i++) {
      const p = this.ring[(this.next - i + n) % n]!; // rückwärts vom zuletzt geschriebenen Platz: neueste zuerst
      const a = fade(this.clock - p.born, life, reduced);
      if (a > 0) out.push([p, a]);
    }
    return out;
  }

  /** Alles vergessen (eine andere Welt) */
  clear() {
    this.ring = [];
    this.next = 0;
  }
}
