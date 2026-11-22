// Drehung zur Torfront – rein, ohne DOM und ohne Three.js: Steht die Figur auf einer Torplatte, schwenkt die Kamera
// weich in die Dreiviertelansicht der Front (Zielwinkel aus mitwachsen-turn-pace.ts) und pendelt dort ruhig, solange sie
// steht. Fortschritt `p` statt einmal gestarteter Fahrt: Ziel = Δ · smoothstep(p), der gezeigte Winkel folgt über eine
// kritisch gedämpfte Feder, so kehrt die Drehung an jeder Stelle ohne Sprung um. Drüberlaufen dreht nicht. Bei
// reduzierter Bewegung (oder Elternschalter aus) gar nicht. Die Spiellogik liest nie die Kamera. Werte aus der Demo des
// Konzepts „Torplatte“ (update() in demo.js); nur die Drehung der 3D-Ansicht (mitwachsen-turn-3d.ts, nachgeladen)
// importiert dieses Modul (Regel in .dependency-cruiser.cjs). Wo die Kamera daraus steht, rechnet mitwachsen-camera.ts.
// Spezifikation: docs/specs/mitwachsen.md (Begriff „Drehung zur Torfront“)

import type { GateId, Point } from '../../data/games/mitwachsen';
import {
  BACK_FACTOR,
  BLINK_FROM_DEG,
  BLINK_MS,
  TARGET_DEG,
  TURN_DELAY_MS,
  turnSeconds,
  type Lage,
} from './mitwachsen-turn-pace';
import { DIST, LOOK_SHIFT, LOOK_Y, TILT_DEG, type CamView } from './mitwachsen-camera';

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
 * ohne Startverzögerung; bei offenem Tor nur im Vorspiel des Rituals), reduzierte Bewegung (`reduce`). `mode`: 'lead'
 * dreht im Ritual bis zur Rückfahrt sicher hin, 'back' fährt am Ende in `CAMERA_BACK_S` zurück (Süd blinzelt
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
export function turnView(st: Turn): CamView {
  const ep = smooth(st.p);
  return {
    yaw: st.yaw + swayDeg(st),
    tilt: lerp(TILT_DEG[0], TILT_DEG[1], ep),
    dist: lerp(DIST[0], DIST[1], ep),
    lookY: lerp(LOOK_Y[0], LOOK_Y[1], ep),
    shift: LOOK_SHIFT * ep,
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Winkel der Sonne um die Hochachse (Bogenmaß): Sie dreht mit der Kamera, damit keine Front im Gegenlicht liegt, aber
 * ohne das Pendeln und auf ¼° gerastet: So steht sie still, solange die Figur steht, und die Schatten flimmern nicht
 */
export const sunYaw = (st: Turn): number => rad(Math.round(st.yaw * 4) / 4);

/** Ab so viel Grad zeigt die Karte den Blickfächer (sie bleibt genordet) */
export const FAN_FROM_DEG = 2;
/** Blickfächer der Karte: Blickrichtung im Uhrzeigersinn von oben (Grad), null ohne Drehung */
export const fanDeg = (yaw: number): number | null => (Math.abs(yaw) < FAN_FROM_DEG ? null : -yaw);

/** Bucht vor einem Tor für die Ansicht: so viele Reihen vor der Torreihe und so weit quer zur Mitte */
export const BAY_ROWS = 4;
export const BAY_HALF = 5;
/** Das Tor, in dessen Bucht (x, y) liegt, sonst undefined */
export function bayOf<G extends { id: GateId; mid: Point; out: Point }>(gates: Iterable<G>, x: number, y: number) {
  for (const g of gates) {
    const [dx, dy] = [x - g.mid[0], y - g.mid[1]];
    const ahead = -(dx * g.out[0] + dy * g.out[1]);
    if (ahead >= 1 && ahead <= BAY_ROWS && Math.abs(dx * g.out[1] - dy * g.out[0]) <= BAY_HALF) return g;
  }
  return undefined;
}

/** Ein so lange verpasster Schritt (Bilder standen still, etwa im Hintergrund) kommt nicht mehr */
const BLINK_STALE_MS = 1000;

/**
 * Blinzeln zurück zur gewohnten Ansicht: Kommt über `BLINK_FROM_DEG` ein Pfeil (`ask`), wartet sein Schritt `BLINK_MS`;
 * das Bild dunkelt in einem Bogen ab und wieder auf, in der Mitte schneidet es auf 0° (`cut`), am Ende kommt der
 * Schritt (`go`), genau einmal. Weitere Pfeile in der Zwischenzeit verfallen, wie ein zweiter Tipp im Takt
 * (input-pace.ts). Rein, ohne DOM; die Ansicht ruft `frame` in jedem Bild
 */
export class Blink {
  private at = 0;
  private go: (() => void) | null = null;
  private cutDone = false;

  /** Blinzelt es gerade? */
  get busy() {
    return !!this.go;
  }

  /** Ein Pfeil bei Winkel `yaw` (Grad) zur Zeit `now` (ms): true, wenn sein Schritt `go` warten muss */
  ask(yaw: number, now: number, go: () => void): boolean {
    if (this.go) return true;
    if (!needsBlink(yaw)) return false;
    [this.at, this.go, this.cutDone] = [now, go, false];
    return true;
  }

  /** Je Bild: wie dunkel das Bild ist (0 … 1) und ob jetzt auf 0° geschnitten wird; nach `BLINK_MS` kommt der Schritt */
  frame(now: number): { dark: number; cut: boolean } {
    if (!this.go) return { dark: 0, cut: false };
    const e = now - this.at;
    const cut = !this.cutDone && e >= BLINK_MS / 2;
    if (cut) this.cutDone = true;
    if (e < BLINK_MS) return { dark: Math.sin((Math.max(0, e) / BLINK_MS) * Math.PI), cut };
    const go = this.go;
    this.go = null;
    if (e < BLINK_MS + BLINK_STALE_MS) go();
    return { dark: 0, cut };
  }
}
