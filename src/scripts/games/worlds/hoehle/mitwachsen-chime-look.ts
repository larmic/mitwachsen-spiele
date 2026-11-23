// Säulen-Glockenspiel der Kristallgrotte in Bild und Ton, gleich für 2D und 3D: Jede der fünf Kristallsäulen klingt mit
// ihrem Ton (C5, D5, E5, G5, A5, Sinus, 0,4 s) und einem leisen Echo nach 0,25 s und leuchtet 0,5 s heller (in 2D die
// Säule selbst, in 3D ein heller Schein auf der Ebene darüber). Nach je vier Tönen beliebiger Säulen dreht eine
// verschlafene Fledermaus, die im Kristallbogen hängt (die Regel nennt ihren Sitzplatz), eine kleine Runde und zirpt;
// solange hängt sie nicht an ihrem Platz (`away`). Hängt keine, fliegt und zirpt keine. Bei reduzierter Bewegung fliegt
// sie nicht und bleibt hängen, das Zirpen bleibt. Eine falsche Melodie gibt es nicht. Rein bis auf die Uhr, die `Chime` sich merkt (nur Bild, kein
// Spielstand). Teil des Welt-Pakets der Höhlenwelt; die Regel steht in mitwachsen-cave-rules.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Schmuck der Grotte“)

import type { Dir } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';

/** Töne der fünf Säulen von links nach rechts: C5, D5, E5, G5, A5 (Pentatonik, jeder passt zu jedem) */
export const COLUMN_SCALE = [523.25, 587.33, 659.25, 783.99, 880] as const;
/** Ton: so lang (s), Echo so viel später (s) und so viel leiser */
export const TONE = { len: 0.4, echo: 0.25, gain: 0.07, echoGain: 0.025 } as const;
/** So lange (ms) leuchtet eine Säule heller, nachdem sie geklungen hat */
export const GLOW_MS = 500;
/** Nach je so vielen Tönen dreht eine Fledermaus eine Runde, so lange (ms), so weit (Felder) und so hoch über dem Bogen */
export const ROUND = { every: 4, ms: 2400, r: 2, lift: 0.8 } as const;

/** Ton einer Säule mit leisem Echo */
export function columnScore(note: number): Scored[] {
  const f = COLUMN_SCALE[Math.max(0, Math.min(note, COLUMN_SCALE.length - 1))] ?? COLUMN_SCALE[0];
  return [
    [f, TONE.len, 'sine', TONE.gain, 1, 0],
    [f, TONE.len, 'sine', TONE.echoGain, 1, TONE.echo],
  ];
}

/** Zirpen der Fledermaus zu Beginn ihrer Runde (ihr Ton aus `CAVE_SPECIES`), `delay` s später */
export function chirp(delay: number): Scored[] {
  const { notes, len, gap, gain, wave } = CAVE_SPECIES.fledermaus.tone;
  return notes.map((f, i) => [f, len, wave, gain, 1, delay + i * (len + gap)] as Scored);
}

/** Wie hell eine Säule `ms` nach ihrem Ton leuchtet: 1 sofort, nach `GLOW_MS` wieder 0 */
export const glowOf = (ms: number) => (ms >= 0 && ms < GLOW_MS ? 1 - ms / GLOW_MS : 0);

/**
 * Wo die Fledermaus `ms` nach dem Beginn ihrer Runde ist: ein Kreis, der am Bogen beginnt und endet, etwas über ihm,
 * mit Blickrichtung nach vorn im Flug; vorbei (oder vor dem Beginn): null
 */
export function batAt(ms: number, from: { x: number; y: number; z: number }) {
  if (ms < 0 || ms >= ROUND.ms) return null;
  const a = (ms / ROUND.ms) * 2 * Math.PI;
  const [vx, vy] = [Math.cos(a), Math.sin(a)];
  const dir: Dir = Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'e' : 'w') : vy > 0 ? 's' : 'n';
  return {
    x: from.x + ROUND.r * Math.sin(a),
    y: from.y + ROUND.r * (1 - Math.cos(a)), // nach vorn, vom Bogen weg, und zurück
    z: from.z + ROUND.lift * Math.sin(a / 2),
    dir,
  };
}

/** Eine Runde der Fledermaus: ab wann, von welchem Sitzplatz aus */
type Round = { at: number; perch: Point };

/** Was das Glockenspiel sich fürs Bild merkt: wann jede Säule zuletzt klang, die Zahl der Töne, die laufende Runde */
export class Chime {
  private rung = new Map<string, number>();
  private tones = 0;
  private flight: Round | null = null;

  /**
   * Eine Säule klingt (um `now`): ihr Ton; beim vierten, achten … Ton beginnt eine Runde der Fledermaus, die an `perch`
   * hängt, und sie zirpt (hängt keine: nur der Ton)
   */
  ring(x: number, y: number, note: number, now: number, perch?: Point): Scored[] {
    this.rung.set(`${x},${y}`, now);
    this.tones++;
    if (this.tones % ROUND.every || !perch) return columnScore(note);
    this.flight = { at: now, perch };
    return [...columnScore(note), ...chirp(0.3)];
  }

  /** Wie hell die Säule auf (x, y) gerade leuchtet (0 … 1) */
  glow(x: number, y: number, now: number) {
    return glowOf(now - (this.rung.get(`${x},${y}`) ?? -Infinity));
  }

  /** Säulen, die gerade heller leuchten, mit ihrem Leuchten */
  glowing(now: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (const [k, at] of this.rung) {
      const g = glowOf(now - at);
      if (g > 0) out.push([...(k.split(',').map(Number) as [number, number]), g]);
    }
    return out;
  }

  /** Wo die Fledermaus ihrer Runde gerade ist: von ihrem Sitzplatz aus (null: keine Runde oder vorbei) */
  bat(world: Pick<World, 'cell'>, now: number) {
    const f = this.flight;
    if (!f || now - f.at < 0 || now - f.at >= ROUND.ms) return null;
    const [x, y] = f.perch;
    const c = world.cell(x, y);
    return batAt(now - f.at, { x: x + 0.5, y: y + 0.5, z: c.h + (c.perch ?? 0) });
  }

  /** Ist die Fledermaus vom Sitzplatz (x, y) gerade auf ihrer Runde (dann hängt sie dort nicht)? */
  away(x: number, y: number, now: number) {
    const f = this.flight;
    return !!f && f.perch[0] === x && f.perch[1] === y && now - f.at >= 0 && now - f.at < ROUND.ms;
  }
}
