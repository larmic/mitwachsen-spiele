// Takt der Drehung auf der Torplatte – rein, winzig, ohne DOM: wohin die Kamera vor einem Tor schwenkt (Zielwinkel je
// Torlage), wie schnell, und wie viele Takte das Vorspiel des Rituals (`leadTicks`) dauert, damit die Kamera vor den
// Flügeln ankommt. Geteilt von Kern, Welt-Paketen und 3D-Ansicht; die Drehung selbst (Feder, Pendeln, Heranrücken)
// steht in mitwachsen-turn.ts und liegt nur in der 3D-Ansicht.
// Spezifikation: docs/specs/mitwachsen.md (Begriff „Drehung zur Torfront“)

import type { Point } from '../../data/games/mitwachsen';

/** Lage eines Tors am Rand der Lichtung (N, O, S, W), aus `out` (nach außen, weg von der Lichtung) */
export type Lage = 'N' | 'O' | 'S' | 'W';

/**
 * Zielwinkel der Kamera in Grad je Torlage: eine Dreiviertelansicht, 25° neben der Front. Kamerakonvention der
 * 3D-Ansicht (mitwachsen-3d.ts): Bei 0° steht sie im Süden (+z) und schaut nach Norden; bei ψ steht sie in Richtung
 * (sin ψ, cos ψ) vom Ziel, also schaut sie über die Lichtung zum Tor (nie über dem Fels).
 *
 * Seite der Dreiviertelansicht (bewusste Abweichung vom Konzept, das Süd 155° nennt): Die Sonne (`SUN_XZ`, von links
 * vorn) soll ab dem Einbau der Drehung mit der Kamera mitdrehen. Nord, Ost und Süd liegen darum 25° auf der Seite, von
 * der sie die Front am hellsten bescheint (Licht auf der Front cos ≈ 0,99); Süd ist −155° statt 155°, gleich weit, dort
 * fiele das Licht mit cos ≈ 0,22 fast streifend ein. West hat bei 65° denselben flachen Wert 0,22; auf der hellen Seite
 * (115°) wäre der Weg aber fast doppelt so lang (2,9 s statt 1,6 s, Vorspiel 25 statt 12 Takte Sperre). Offen in den
 * Spielnotizen, nach dem Einbau am Bild zu entscheiden. Bedingung: Dreht die Sonne nicht mit (heute steht sie fest,
 * mitwachsen-3d.ts), ist die Seite für das Licht bedeutungslos; dann gilt nur noch der kürzere Weg.
 */
export const TARGET_DEG: Readonly<Record<Lage, number>> = { N: 25, O: -65, S: -155, W: 65 };
/** Hinweg im Schnitt 40° je Sekunde (mit smoothstep an der Spitze etwa 60°/s), mindestens `MIN_TURN_S` */
export const SPEED_DEG_S = 40;
export const MIN_TURN_S = 1.0;
/** Rückweg 1,3-mal so schnell wie der Hinweg */
export const BACK_FACTOR = 1.3;
/**
 * So lange steht die Figur auf der Platte, ohne Pfeil, bevor die Drehung beginnt: länger als ein Schritt (260 ms).
 * Gezählt ab dem Loslassen aller Pfeile und der Ankunft auf dem Feld, nicht ab dem Betreten: Wer einzeln tippt und
 * kurz absetzt, dreht so höchstens ein kleines Stück. Über `HOLD_MS` (450 ms, input-pace.ts) muss sie darum nicht liegen.
 */
export const TURN_DELAY_MS = 350;
/** Über `BLINK_FROM_DEG` bringt der erste Pfeildruck die Ansicht per Blinzeln (`BLINK_MS`) zurück, dann läuft die Figur */
export const BLINK_MS = 300;
export const BLINK_FROM_DEG = 45;

/**
 * Waagrechte Richtung der Sonne vom Ziel aus (x, z) bei 0°: `SUN_OFFSET` in mitwachsen-3d.ts ist (−9, 22, 7). Die
 * 3D-Ansicht baut sie beim Einbau der Drehung hieraus; bis dahin hält ein Test beide gleich.
 */
export const SUN_XZ = [-9, 7] as const;

/**
 * Takt der Regeln (`TICK_MS` in larmic-mitwachsen.ts) und Stehzeit bis zum Öffnen (`OPEN_TICKS` = 4 in
 * worlds/eis/mitwachsen-ritual.ts). Doppelt, weil der Kern und das Welt-Paket hier nichts hergeben dürfen; Tests halten
 * beide gleich.
 */
export const RULE_TICK_MS = 100;
export const OPEN_MS = 400;

/** Lage des Tors aus `out`: Norden ist −y, Osten +x */
export const lageOf = (out: Point): Lage => (out[1] < 0 ? 'N' : out[1] > 0 ? 'S' : out[0] > 0 ? 'O' : 'W');

/** Dauer des Hinwegs in Sekunden: Nord 1,0, Ost und West 1,625, Süd 3,875 */
export const turnSeconds = (lage: Lage): number => Math.max(MIN_TURN_S, Math.abs(TARGET_DEG[lage]) / SPEED_DEG_S);

/**
 * Vorspiel des Rituals in Takten: Die Flügel gehen erst auf, wenn die Kamera angekommen ist. Die Stehzeit bis zum
 * Öffnen (0,4 s) dreht schon mit. Nord 6, Ost und West 12, Süd 35.
 */
export const leadTicks = (lage: Lage): number =>
  Math.max(0, Math.round((turnSeconds(lage) * 1000 - OPEN_MS) / RULE_TICK_MS));
