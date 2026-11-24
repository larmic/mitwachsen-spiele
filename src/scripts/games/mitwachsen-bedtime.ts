// „Gute Nacht, Fahrzeuge“ (Konzept „Reisewege“, „Gleisbauer und Höhlen-Welt“: Gute Nacht, Bahn) – rein, ohne DOM: Schläft
// die Figur im Bett der Lichtung, sagen die Fahrzeuge in Sichtweite nach dem Schlaflied nacheinander mit ihrem Ton gute
// Nacht (Zug: Pfiff) und machen danach ihr Licht aus. Zusammen dauert das höchstens `BEDTIME.max` s; wer nicht mehr
// hineinpasst, macht still sein Licht aus. Jede Taste beendet es sofort: Die übrigen Töne fallen weg, alle Lichter sind
// aus. Die Töne spielt die Spielseite im Takt der Bilder (`dueTones`), nicht als eingeplante WebAudio-Töne, damit eine
// Taste sie anhalten kann. Welche Fahrzeuge in Sichtweite stehen und wie sie klingen, sagen ihre Pakete
// (`View2D.goodNight`). Bleiben Bilder aus (Tab im Hintergrund, langes Bild), fallen verpasste Töne weg, statt danach
// als Akkord zu klingen (`BEDTIME.stale`). Dazu das Licht der Fahrzeuge je Bild (`rideLight`: Lampen am Abend und
// nachts, warmes Licht ab 20 min) und welche Eingabe die gute Nacht beendet (`endsBedtime`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Tok und die Bahn“, Schmuck mit Zug)

import type { RideId } from '../../data/games/mitwachsen-rides';
import type { GoodNight } from './mitwachsen-ride-view';
import type { Cmd } from './mitwachsen-state';
import type { Scored } from './sfx';

/**
 * Beginn nach dem Einschlafen (s, nach dem Schlaflied), höchstens so lange zusammen (s), Pause zwischen zwei Fahrzeugen;
 * ein Ton, dessen Zeit länger als `stale` s vorbei ist (Bilder blieben aus), fällt weg
 */
export const BEDTIME = { from: 2, max: 4, gap: 0.3, stale: 0.25 } as const;

/** Abend für die Regeln (`State.late`, im Blick hinein `&abend=1`) zählt im Bild mindestens so abendlich */
export const LATE_EVENING = 0.6;

/**
 * Licht der Fahrzeuge in diesem Bild aus der Nacht (`night`, 0 … 1) und dem Abend (`evening` aus der Spielzeit, 0 bis
 * 20 min 0): `evening` des Bilds (schläft die Figur, 0; `late` zählt mindestens `LATE_EVENING`), Laterne und Lampen an
 * (`lit`: nachts oder gut abendlich), warmes Licht im Fensterband (`warm`: nachts oder ab 20 min)
 */
export function rideLight(night: number, evening: number, sleeping: boolean, late: boolean) {
  const eve = sleeping ? 0 : Math.max(evening, late ? LATE_EVENING : 0);
  return { evening: eve, lit: night > 0.3 || eve > 0.3, warm: night > 0.3 || eve > 0 };
}

/** Beendet diese Eingabe „Gute Nacht“? Jede Taste (Pfeil, Antippen, Leertaste), solange die Figur schläft; kein Takt */
export const endsBedtime = (cmd: Cmd, sleeping: boolean) => sleeping && cmd.type !== 'tick';

/** Plan der guten Nacht: alle Töne mit Beginn in s nach dem Einschlafen, je Fahrzeug, wann sein Licht ausgeht (s) */
export type Bedtime = { tones: readonly Scored[]; off: Partial<Record<RideId, number>> };

/** Ende eines Tons (s) */
const endOf = ([, len, , , , at]: Scored) => at + len;

/**
 * Plan aus den Fahrzeugen in Sichtweite (in ihrer Reihe): eins nach dem anderen ab `BEDTIME.from`, dazwischen eine kleine
 * Pause; sein Licht geht aus, wenn sein letzter Ton verklingt. Was über `BEDTIME.max` hinaus klänge, fällt weg (das
 * Fahrzeug macht sein Licht dann still am Ende aus)
 */
export function bedtime(list: readonly GoodNight[]): Bedtime {
  const end = BEDTIME.from + BEDTIME.max;
  const tones: Scored[] = [];
  const off: Partial<Record<RideId, number>> = {};
  let at = BEDTIME.from;
  for (const { id, score } of list) {
    const len = Math.max(0, ...score.map(endOf));
    if (at + len > end) {
      off[id] = end;
      continue;
    }
    tones.push(...score.map(([f, l, w, g, sl, d]): Scored => [f, l, w, g, sl, at + d]));
    off[id] = at + len;
    at += len + BEDTIME.gap;
  }
  return { tones, off };
}

/**
 * Töne, die zwischen `from` und `to` (s nach dem Einschlafen) beginnen, sofort zu spielen; beendet: keine mehr. Was
 * schon länger als `BEDTIME.stale` vorbei ist, fällt weg (nie mehrere verpasste Töne auf einmal)
 */
export const dueTones = (b: Bedtime, from: number, to: number, over = false): Scored[] =>
  over
    ? []
    : b.tones
        .filter((n) => n[5] >= Math.max(from, to - BEDTIME.stale) && n[5] < to)
        .map(([f, l, w, g, sl]): Scored => [f, l, w, g, sl, 0]);

/** Fahrzeuge, deren Licht `t` s nach dem Einschlafen aus ist (beendet per Taste: alle im Plan) */
export const lightsOut = (b: Bedtime, t: number, over = false): RideId[] =>
  (Object.entries(b.off) as [RideId, number][]).filter(([, at]) => over || t >= at).map(([id]) => id);

/**
 * Was die Spielseite sich für die gute Nacht merkt: den Plan beim Einschlafen (`start`), bis wohin gespielt ist, ob eine
 * Taste es beendet hat (`end`); beim Aufwachen ist es vorbei (`stop`). Zeiten in s nach dem Einschlafen
 */
export class GoodNights {
  private plan: Bedtime | null = null;
  private played = 0;
  private over = false;

  /** Eingeschlafen: die Fahrzeuge in Sichtweite in ihrer Reihe */
  start(list: readonly GoodNight[]) {
    [this.plan, this.played, this.over] = [bedtime(list), 0, false];
  }
  /** Aufgewacht: keine Töne mehr, alle Lichter wieder an */
  stop() {
    this.plan = null;
  }
  /** Eine Taste: sofort vorbei, keine Töne mehr, alle Lichter aus */
  end() {
    this.over = true;
  }
  /** Töne, deren Zeit bis `t` gekommen ist (je Bild gefragt, jeder einmal) */
  tones(t: number): Scored[] {
    if (!this.plan || t <= this.played) return [];
    const out = dueTones(this.plan, this.played, t, this.over);
    this.played = t;
    return out;
  }
  /** Fahrzeuge, deren Licht `t` s nach dem Einschlafen aus ist */
  out(t: number): RideId[] {
    return this.plan ? lightsOut(this.plan, t, this.over) : [];
  }
}
