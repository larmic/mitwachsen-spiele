// Drehung zur Torfront – rein, ohne DOM und ohne Three.js: Steht die Figur auf einer Torplatte, schwenkt die Kamera
// weich in die Dreiviertelansicht der Front (Zielwinkel aus mitwachsen-turn-pace.ts) und pendelt dort ruhig, solange sie
// steht. Fortschritt `p` statt einmal gestarteter Fahrt: Ziel = Δ · smoothstep(p), der gezeigte Winkel folgt über eine
// kritisch gedämpfte Feder, so kehrt die Drehung an jeder Stelle ohne Sprung um. Drüberlaufen dreht nicht. Bei
// reduzierter Bewegung (oder Elternschalter aus) gar nicht. Die Spiellogik liest nie die Kamera. Werte aus der Demo des
// Konzepts „Torplatte“ (update() in demo.js); nur die 3D-Ansicht importiert dieses Modul (Regel in .dependency-cruiser.cjs).
// Spezifikation: docs/specs/mitwachsen.md (Begriff „Drehung zur Torfront“)

import { BACK_FACTOR, BLINK_FROM_DEG, TARGET_DEG, TURN_DELAY_MS, turnSeconds, type Lage } from './mitwachsen-turn-pace';

/** Gedämpfte Feder (SmoothDamp) zwischen Ziel und gezeigtem Winkel, in Sekunden */
export const SPRING_S = 0.25;
/** Am Ziel atmet das Bild: ±4° Pendeln mit 6 s Periode (nicht bei reduzierter Bewegung) */
export const SWAY_DEG = 4;
export const SWAY_PERIOD_S = 6;
/** Am Ende des Rituals fährt die Kamera in 0,6 s zurück … */
export const CAMERA_BACK_S = 0.6;
/**
 * … außer bei Toren mit mehr als 65° Weg (Süd): Dort wären es nach der Feder fast 300°/s (ohne Feder 390°/s), darum
 * blinzelt sie zurück (`BLINK_MS`), wie die Demo. Nord (Spitze etwa 50°/s), Ost und West (etwa 125°/s, nur 65° weit, ein
 * kurzer Rückschwung zur gewohnten Ansicht) fahren wie in der Demo
 */
export const BACK_BLINK_FROM_DEG = 65;
/**
 * Heranrücken mit p: Neigung 55° → 45°, Abstand 18 → 16 Felder, Blickhöhe 0,6 → 2,7 (damit das ganze Tor samt Spitze
 * ins Bild passt und die Figur im unteren Drittel bleibt), Blickpunkt bis 1,5 Felder zum Tor
 */
export const TILT_DEG = [55, 45] as const;
export const DIST = [18, 16] as const;
export const LOOK_Y = [0.6, 2.7] as const;
export const LOOK_SHIFT = 1.5;

/**
 * Zustand der Drehung: Fortschritt `p` (0 … 1), gezeigter Winkel `yaw` in Grad und seine Geschwindigkeit `v` (Feder),
 * Stehzeit `still` in s (auf der Platte, kein Schritt, kein Pfeil), Hülle `sway` (0 … 1) und Phase `phase` (s) des
 * Pendelns, `needLeave`: nach dem Ritual dreht es erst wieder, wenn die Figur die Platte einmal verlassen hat
 */
export type Turn = Readonly<{
  p: number;
  yaw: number;
  v: number;
  still: number;
  sway: number;
  phase: number;
  needLeave: boolean;
}>;
/** Ruhelage, eingefroren: geteilt, darum nie verändern, sondern neu bauen */
export const TURN_REST: Turn = Object.freeze({ p: 0, yaw: 0, v: 0, still: 0, sway: 0, phase: 0, needLeave: false });

/**
 * Eingabe je Bild: Lage des Tors, ob die Figur auf der Platte steht (`onPlate`), gerade einen Schritt macht
 * (`moving`), ein Pfeil gedrückt ist (`held`), die Bedingung des Tors erfüllt und das Tor noch zu ist (`ready`: dann
 * ohne Startverzögerung; bei offenem Tor nie setzen), reduzierte Bewegung (`reduce`). `mode`: 'lead' dreht im Vorspiel
 * und weiter im Ritual bis zur Rückfahrt sicher hin, 'back' fährt am Ende in `CAMERA_BACK_S` zurück (Süd blinzelt
 * stattdessen, `backNeedsBlink`), 'blink' hält die Drehung an, solange geblinzelt wird. Nach 'lead' oder 'back' wächst
 * `p` erst wieder, wenn die Figur die Platte verlassen hat und neu draufsteht
 */
export type TurnInput = {
  lage: Lage;
  onPlate: boolean;
  moving: boolean;
  held: boolean;
  ready?: boolean;
  reduce?: boolean;
  mode?: 'play' | 'lead' | 'back' | 'blink';
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** smoothstep auf 0 … 1 */
export const smooth = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Kritisch gedämpfte Feder wie Unitys SmoothDamp: neuer Wert und neue Geschwindigkeit */
function smoothDamp(cur: number, goal: number, v: number, time: number, dt: number): [number, number] {
  const om = 2 / time;
  const x = om * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = cur - goal;
  const tmp = (v + om * ch) * dt;
  return [goal + (ch + tmp) * e, (v - om * tmp) * e];
}

/** Ob p gerade wächst */
function grows(st: Turn, inp: TurnInput): boolean {
  if (inp.mode === 'lead') return true;
  if (inp.mode === 'back' || inp.mode === 'blink') return false;
  if (st.needLeave || !inp.onPlate || inp.moving || inp.held) return false;
  return inp.ready === true || st.still * 1000 >= TURN_DELAY_MS;
}

/** Ein Bild weiter um `dt` Sekunden */
export function turnStep(st: Turn, inp: TurnInput, dt: number): Turn {
  if (inp.reduce) return { ...TURN_REST };
  const ritual = inp.mode === 'lead' || inp.mode === 'back';
  // im Ritual zählt keine Stehzeit; danach erst wieder, wenn die Figur einmal von der Platte war
  const needLeave = ritual || (st.needLeave && inp.onPlate);
  const still = !ritual && inp.onPlate && !inp.moving && !inp.held ? st.still + dt : 0;
  const rate = 1 / turnSeconds(inp.lage);
  let p: number;
  if (inp.mode === 'back') p = Math.max(0, st.p - dt / CAMERA_BACK_S);
  else if (grows({ ...st, still, needLeave }, inp)) p = Math.min(1, st.p + dt * rate);
  else p = Math.max(0, st.p - dt * rate * BACK_FACTOR);
  const [yaw, v] = smoothDamp(st.yaw, TARGET_DEG[inp.lage] * smooth(p), st.v, SPRING_S, dt);
  const atGoal = p >= 0.999;
  const sway = atGoal ? Math.min(1, st.sway + dt) : Math.max(0, st.sway - dt * 2);
  const phase = atGoal && st.sway === 0 ? 0 : sway > 0 ? st.phase + dt : 0;
  return { p, yaw, v, still, sway, phase, needLeave };
}

/** Über `BLINK_FROM_DEG` bringt der erste Pfeildruck die Ansicht per Blinzeln zurück (dann `TURN_REST`) */
export const needsBlink = (yaw: number): boolean => Math.abs(yaw) > BLINK_FROM_DEG;

/** Ob die Kamera am Ende des Rituals zurückblinzelt statt zu fahren (nur Süd); danach `TURN_REST` mit `needLeave` */
export const backNeedsBlink = (lage: Lage): boolean => Math.abs(TARGET_DEG[lage]) > BACK_BLINK_FROM_DEG;

/** Pendeln am Ziel in Grad */
export const swayDeg = (st: Turn): number => st.sway * SWAY_DEG * Math.sin((st.phase / SWAY_PERIOD_S) * Math.PI * 2);

/**
 * Kamera aus dem Zustand: Winkel samt Pendeln (Grad), Neigung (Grad), Abstand und Blickhöhe (Felder), wie weit der
 * Blickpunkt zum Tor rückt (Felder)
 */
export function turnView(st: Turn): { yaw: number; tilt: number; dist: number; lookY: number; shift: number } {
  const ep = smooth(st.p);
  return {
    yaw: st.yaw + swayDeg(st),
    tilt: lerp(TILT_DEG[0], TILT_DEG[1], ep),
    dist: lerp(DIST[0], DIST[1], ep),
    lookY: lerp(LOOK_Y[0], LOOK_Y[1], ep),
    shift: LOOK_SHIFT * ep,
  };
}
