// Drehung zur Torfront in der 3D-Ansicht: verbindet den reinen Drehregler (mitwachsen-turn.ts) mit Welt, Spielstand
// und Bild. Je Bild: Steht die Figur auf einer Torplatte, schwenkt die Kamera in die Dreiviertelansicht der Front,
// rückt heran und pendelt; dazu das Blinzeln (Abdunkeln über `--mw-blink` an der Spielfläche, CSS in
// MitwachsenGame.astro), der Blickfächer der Karte (`--mw-look`, `--mw-fan`) und welches Tor zur Front gebaut ist
// (`front`, ab dem Betreten seiner Bucht). Bei reduzierter Bewegung oder Elternschalter „Kamera bewegen: aus“ (`calm`)
// dreht nichts; dann kommt die Postkarte (mitwachsen-card.ts). Die 3D-Ansicht lädt dieses Modul samt Drehregler erst
// nach (`import()`), wenn die Figur einem Tor nah kommt (`NEAR_GATE` in mitwachsen-3d.ts); bis dahin und ohne es steht
// die Kamera wie immer im Süden. Im Build _astro/mitwachsen-turn-3d.<hash>.js, mit eigener Grenze im Bundle-Gate.
// Spezifikation: docs/specs/mitwachsen.md (Begriff „Drehung zur Torfront“, „Was angezeigt wird“: Torplatte: Drehung)

import type { GateId } from '../../data/games/mitwachsen';
import { GUIDE_GATE, RITUAL, guideGate, heaveLeft, opening } from './mitwachsen-guide';
import type { PlateFx } from './mitwachsen-plate';
import type { State } from './mitwachsen-state';
import { RULE_TICK_MS, TARGET_DEG, lageOf, type Lage } from './mitwachsen-turn-pace';
import {
  Blink,
  CAMERA_BACK_S,
  TURN_REST,
  backNeedsBlink,
  bayOf,
  fanDeg,
  sunYaw,
  turnStep,
  turnView,
  type Turn,
  type TurnInput,
} from './mitwachsen-turn';
import type { CamView } from './mitwachsen-camera';
import type { World } from './mitwachsen-world';

/** Was die Drehung je Bild aus der Szene braucht */
type Frame = {
  now: number;
  reduced: boolean;
  plate: PlateFx | null;
  bodies: ReadonlyMap<string, { x: number; y: number }>;
};

/** Elternschalter „Kamera bewegen“ im Speicher: wie `CALM_KEY` im Menü, das sie nicht mitladen soll (Test in mitwachsen-turn.test.ts) */
const CALM_STORE = 'larmic.games.calm';

export class PlateTurn {
  private st: Turn = TURN_REST;
  private lage: Lage = 'N';
  private id: GateId | null = null; // Tor der Platte, zu der sie zuletzt drehte
  private last = -1; // Zeit des letzten Bilds (ms)
  private calmAt: boolean; // Elternschalter beim Start (aus dem Speicher), bis das Menü ihn an der Spielfläche setzt
  private still = true; // reduzierte Bewegung oder Schalter aus: keine Drehung
  private busy = false; // Ritual läuft: Pfeile lassen nur hüpfen, kein Blinzeln
  private blinker = new Blink();
  private css = '';
  /** Tor, dessen Zugang zur Front gebaut ist (Bucht betreten), bis p = 0 ist und die Figur die Bucht verlassen hat */
  front: GateId | null = null;
  /** Blick der Kamera im letzten Bild */
  view: CamView = turnView(TURN_REST);
  /** Richtung zum Tor (x, z), in die der Blickpunkt rückt */
  to: readonly [number, number] = [0, -1];

  constructor(private host: HTMLElement | null) {
    let calm = false;
    try {
      calm = localStorage.getItem(CALM_STORE) === '1';
    } catch {
      /* gesperrt: Schalter an */
    }
    this.calmAt = calm;
    // Verliert die 3D-Ansicht ihren Kontext, springt die 2D-Ansicht ein: kein Abdunkeln, kein Fächer bleibt stehen
    // (das Ereignis steigt nicht auf, darum beim Einfangen an der Spielfläche)
    host?.addEventListener('webglcontextlost', () => this.paint(0, null), true);
  }

  /** Dreht sie gerade überhaupt (nicht bei reduzierter Bewegung und Schalter aus)? Sonst kommt die Postkarte */
  turns() {
    return !this.still;
  }

  /** Ist die Kamera an der Front angekommen (oder dreht sie gar nicht)? Dann zeigt ein Tor „noch nicht“ */
  arrived() {
    return this.still || this.st.p >= 0.999;
  }

  /** Ein Pfeil kommt: true, wenn sein Schritt `go` aufs Blinzeln warten muss (über 45°, nicht im Ritual) */
  blink(go: () => void): boolean {
    return !this.busy && this.blinker.ask(this.view.yaw, performance.now(), () => queueMicrotask(go));
  }

  /** Mehr als halb zur Front gedreht? Dann zeigt der Zugang Schild und Seiten zur Front (mitwachsen-gatehouses-3d.ts) */
  get far(): boolean {
    return Math.abs(this.view.yaw) > Math.abs(TARGET_DEG[this.lage]) / 2;
  }

  /** Winkel der Sonne (Bogenmaß): dreht mit, ohne Pendeln, gerastet (`sunYaw`) */
  get sun(): number {
    return sunYaw(this.st);
  }

  /** Ein Bild weiter: Drehung aus Platte, Schritt und Pfeilen; liefert den Blick der Kamera */
  frame(world: World, state: State, sc: Frame): CamView {
    const dt = this.last < 0 ? 0 : Math.min(0.05, Math.max(0, (sc.now - this.last) / 1000));
    this.last = sc.now;
    const calm = this.host?.dataset.calm;
    this.still = sc.reduced || (calm === undefined ? this.calmAt : calm === '1');
    const { dark, cut } = this.blinker.frame(sc.now);
    // geschnitten auf 0°: wie die Demo, nur Winkel und Fortschritt; erst nach dem Verlassen der Platte dreht es wieder
    // (sonst begänne nach jedem Anstoßen an der Tür die Drehung von vorn, mit neuem Blinzeln)
    if (cut) this.st = { ...TURN_REST, needLeave: true };
    this.st = turnStep(this.st, this.input(world, state, sc), dt);
    if (this.st.p === 0 && Math.abs(this.st.yaw) < 0.01) this.st = { ...this.st, yaw: 0, v: 0 }; // ganz zurück
    const body = sc.bodies.get('player');
    const near = body && bayOf(world.gates.values(), Math.round(body.x), Math.round(body.y));
    // zur Front gebaut nur, wenn sie drehen kann (sonst bleibt der Zugang, wie er ist); zurück erst bei p = 0
    if (near && !this.still) this.front = near.id;
    else if (this.st.p === 0 && this.st.yaw === 0) this.front = null; // ganz zurück, auch die Feder
    this.view = turnView(this.st);
    this.paint(dark, fanDeg(this.view.yaw));
    return this.view;
  }

  /**
   * Eingabe des Drehreglers: Platte unter den Füßen, Schritt (der Körper gleitet noch), Pfeil (die Stehzeit der Regeln
   * zählt nicht), Bedingung des Tors erfüllt oder Vorspiel (dann ohne Wartezeit; läuft die Figur weg, dreht es zurück);
   * während des Rituals bleibt die Kamera vorn (`lead`), auch wenn die Figur hüpft, in seinen letzten 0,6 s fährt sie
   * zurück (`back`, Süd blinzelt), beim Blinzeln wächst nichts. Ebenso beim Hau-ruck am Höhlentor (`heave`), schon ab
   * seinem Vorspiel (jeder Pfeil ist dort ein Stoß, die Figur geht nicht weg)
   */
  private input(world: World, state: State, sc: Frame): TurnInput {
    const t = state.tick - state.ritual; // Takte seit Beginn des Rituals, negativ im Vorspiel
    const { back, gate, heave } = this.ritual(state, t);
    const on = !!sc.plate?.on && !state.sleeping && !state.ride; // im Fahrzeug dreht die Kamera nie, sie folgt nur
    if (back && backNeedsBlink(this.lage)) this.blinker.ask(this.view.yaw, sc.now, () => {}); // einmal: danach 0°
    // im Ritual das Eistor (beim Hau-ruck sein Tor); im Vorspiel (noch nicht `busy`) ist es das Tor der Platte, auf der
    // die Figur steht, und läuft sie weg, bleibt `id`, wie es war: Das Eistor
    if (gate) this.id = gate;
    else if (on && sc.plate) this.id = sc.plate.id;
    const g = this.id ? world.gates.get(this.id) : undefined;
    if (g) [this.lage, this.to] = [lageOf(g.out), [g.out[0], g.out[1]]];
    const body = sc.bodies.get('player');
    return {
      lage: this.lage,
      onPlate: on,
      moving: !!body && Math.abs(body.x - state.player.x) + Math.abs(body.y - state.player.y) > 0.02,
      held: state.still === 0,
      ready: t < 0 || heave || (!!g && guideGate(state) === g.id && !state.openGates.includes(g.id)),
      reduce: this.still,
      mode: this.mode(on, back),
    };
  }

  /**
   * Läuft ein Ritual (`busy`)? Am Eistor ab seinem Beginn (`t`: Takte seit dem Beginn, nicht schon im Vorspiel), beim
   * Hau-ruck am Höhlentor die ganze Zeit (`heave`). `back`: in seinen letzten `CAMERA_BACK_S` fährt die Kamera zurück;
   * `gate`: sein Tor, solange es läuft
   */
  private ritual(state: State, t: number): { back: boolean; gate: GateId | null; heave: boolean } {
    const left = heaveLeft(state) ?? 0; // Takte bis zum Ende des Hau-rucks (0: keins)
    const heave = left > 0 && !!state.heave;
    this.busy = (t >= 0 && opening(state, RITUAL)) || heave;
    const backTicks = (CAMERA_BACK_S * 1000) / RULE_TICK_MS;
    const back = this.busy && (heave ? left <= backTicks : t >= RITUAL - backTicks);
    const gate = heave && state.heave ? state.heave.gate : this.busy ? GUIDE_GATE : null;
    return { back, gate, heave };
  }

  /**
   * Blinzeln, sonst im Ritual vorn (`lead`, am Ende `back`): nur, wenn die Figur auf der Platte steht (sonst ging das Tor
   * durch Anstoßen auf, oder sie lief im Vorspiel weg: dann dreht es zurück) und die Kamera nicht schon im Vorspiel
   * zurückgeblinzelt hat (`p` 0 und `needLeave`: dann keine neue Drehung und kein zweites Blinzeln im Ritual)
   */
  private mode(on: boolean, back: boolean): TurnInput['mode'] {
    if (this.blinker.busy) return 'blink';
    return this.busy && on && (this.st.p || !this.st.needLeave) ? (back ? 'back' : 'lead') : 'play';
  }

  /** Abdunkeln und Blickfächer an der Spielfläche (CSS-Variablen), nur wenn sich etwas ändert */
  private paint(dark: number, fan: number | null) {
    const css = `${dark.toFixed(2)}|${fan === null ? '' : Math.round(fan)}`;
    if (css === this.css || !this.host) return;
    this.css = css;
    const s = this.host.style;
    s.setProperty('--mw-blink', dark.toFixed(2));
    s.setProperty('--mw-fan', fan === null ? '0' : '1');
    if (fan !== null) s.setProperty('--mw-look', `${Math.round(fan)}deg`);
  }
}
