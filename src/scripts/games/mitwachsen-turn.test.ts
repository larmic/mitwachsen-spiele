import { describe, expect, it, vi } from 'vitest';
import {
  BACK_FACTOR,
  BLINK_FROM_DEG,
  BLINK_MS,
  MIN_TURN_S,
  OPEN_MS,
  RULE_TICK_MS,
  SPEED_DEG_S,
  SUN_XZ,
  TARGET_DEG,
  TURN_DELAY_MS,
  lageOf,
  leadTicks,
  turnSeconds,
  type Lage,
} from './mitwachsen-turn-pace';
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { CAM_REST, DIST, TILT_DEG, camPose } from './mitwachsen-camera';
import { plateMid } from './mitwachsen-plate';
import { worldOf } from './test-worlds';
import {
  BACK_BLINK_FROM_DEG,
  BAY_ROWS,
  Blink,
  FAN_FROM_DEG,
  bayOf,
  fanDeg,
  sunYaw,
  CAMERA_BACK_S,
  SWAY_DEG,
  SWAY_PERIOD_S,
  TURN_REST,
  backNeedsBlink,
  needsBlink,
  smooth,
  turnStep,
  turnView,
  type Turn,
  type TurnInput,
} from './mitwachsen-turn';
import { STEP_MS } from './input-pace';
import { CALM_KEY } from './mitwachsen-menu';
import { OPEN_TICKS } from './worlds/eis/mitwachsen-ritual';
import { GUIDE_GATE, RITUAL } from './mitwachsen-guide';
import { PlateTurn } from './mitwachsen-turn-3d';
import type { State } from './mitwachsen-state';
import type { World } from './mitwachsen-world';

const DT = 1 / 60; // ein Bild
const LAGEN: Lage[] = ['N', 'O', 'S', 'W'];
const OUT: Record<Lage, readonly [number, number]> = { N: [0, -1], O: [1, 0], S: [0, 1], W: [-1, 0] };
const STAND = { onPlate: true, moving: false, held: false };
const OFF = { onPlate: false, moving: false, held: false };

/** Läuft `s` Sekunden mit derselben Eingabe; `seen` bekommt jedes Bild */
function run(st: Turn, inp: TurnInput, s: number, seen?: (t: Turn) => void): Turn {
  let cur = st;
  for (let i = 0; i < Math.round(s / DT); i++) {
    cur = turnStep(cur, inp, DT);
    seen?.(cur);
  }
  return cur;
}

/** Erste Zeit (s), zu der `p` 1 erreicht */
function arrival(lage: Lage, inp: Omit<TurnInput, 'lage'>): number {
  let st = TURN_REST;
  for (let i = 1; i < 1000; i++) {
    st = turnStep(st, { lage, ...inp }, DT);
    if (st.p >= 1) return i * DT;
  }
  return Infinity;
}

describe('Takt der Drehung (mitwachsen-turn-pace.ts)', () => {
  it('Zahlen des Konzepts: 40°/s, mindestens 1 s, Rückweg 1,3-mal so schnell, Verzögerung 350 ms, Blinzeln 300 ms ab 45°', () => {
    expect([SPEED_DEG_S, MIN_TURN_S, BACK_FACTOR, TURN_DELAY_MS, BLINK_MS, BLINK_FROM_DEG]).toEqual([
      40, 1, 1.3, 350, 300, 45,
    ]);
    expect(TURN_DELAY_MS).toBeGreaterThan(STEP_MS); // länger als ein Schritt
  });

  it('Dreiviertelansicht: 25° neben der Front, Nord 25°, Ost −65°, West 65°, Süd 155° (zur Sonnenseite −155°)', () => {
    expect(TARGET_DEG).toEqual({ N: 25, O: -65, S: -155, W: 65 });
  });

  it('Dauer: Nord 1,0 s, Ost und West 1,625 s, Süd 3,875 s', () => {
    expect(LAGEN.map(turnSeconds)).toEqual([1, 1.625, 3.875, 1.625]);
  });

  it('Vorspiel LEAD: Nord 6, Ost und West 12, Süd 35 Takte; die Stehzeit bis zum Öffnen dreht schon mit', () => {
    expect(LAGEN.map(leadTicks)).toEqual([6, 12, 35, 12]);
    for (const l of LAGEN)
      expect(Math.abs((leadTicks(l) + OPEN_TICKS) * RULE_TICK_MS - turnSeconds(l) * 1000)).toBeLessThanOrEqual(50);
  });

  it('Doppelte Werte bleiben gleich: Takt wie larmic-mitwachsen.ts, Stehzeit wie das Ritual, Sonne wie die 3D-Ansicht, Elternschalter wie das Menü', () => {
    expect(OPEN_MS).toBe(OPEN_TICKS * RULE_TICK_MS);
    const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
    expect(src('./larmic-mitwachsen.ts')).toContain(`const TICK_MS = ${RULE_TICK_MS};`);
    expect(src('./mitwachsen-turn-3d.ts')).toContain(`const CALM_STORE = '${CALM_KEY}';`);
    expect(src('./mitwachsen-3d.ts')).toContain(`const SUN_OFFSET = new Vector3(${SUN_XZ[0]}, 22, ${SUN_XZ[1]});`);
  });

  it('Lage aus `out`: Norden −y, Osten +x', () => {
    expect(LAGEN.map((l) => lageOf(OUT[l]))).toEqual(LAGEN);
  });

  it('Kamera steht in jeder Lage über der Lichtung und schaut zum Tor, auch beim Pendeln', () => {
    for (const l of LAGEN) {
      for (const d of [-SWAY_DEG, 0, SWAY_DEG]) {
        const psi = ((TARGET_DEG[l] + d) * Math.PI) / 180;
        const look = [-Math.sin(psi), -Math.cos(psi)] as const; // Blick vom Kamera-Ort (sin ψ, cos ψ) zum Ziel
        expect(look[0] * OUT[l][0] + look[1] * OUT[l][1]).toBeGreaterThan(0.4);
      }
    }
  });

  it('Sonnenseite: die mitdrehende Sonne (SUN_XZ) bescheint jede Front', () => {
    const [sx, sz] = SUN_XZ;
    const lit = (l: Lage, deg: number) => {
      const a = (deg * Math.PI) / 180;
      const sun = [sx * Math.cos(a) + sz * Math.sin(a), -sx * Math.sin(a) + sz * Math.cos(a)] as const; // um +y gedreht
      return -(sun[0] * OUT[l][0] + sun[1] * OUT[l][1]); // Front zeigt zur Lichtung (−out)
    };
    for (const l of LAGEN) expect(lit(l, TARGET_DEG[l])).toBeGreaterThan(0);
    // Nord, Ost und Süd auf der helleren Seite der Front (West bleibt beim kürzeren Weg)
    const front = { N: 0, O: -90, S: -180, W: 90 }; // Winkel der Kamera genau vor der Front
    for (const l of ['N', 'O', 'S'] as const) {
      expect(lit(l, TARGET_DEG[l])).toBeGreaterThan(lit(l, 2 * front[l] - TARGET_DEG[l])); // gespiegelt an der Front
    }
  });
});

describe('Drehung zur Torfront (mitwachsen-turn.ts)', () => {
  it('Drüberlaufen mit gehaltener Taste dreht nicht', () => {
    let st = TURN_REST;
    for (let i = 0; i < 6; i++) {
      st = run(st, { lage: 'S', ...STAND, moving: true, held: true }, STEP_MS / 1000);
      st = run(st, { lage: 'S', ...STAND, held: true }, 0.2); // zwischen zwei Schritten, Taste noch unten
    }
    expect(st.p).toBe(0);
    expect(st.yaw).toBe(0);
  });

  it('Draufstellen: erst nach 350 ms ohne Pfeil wächst p, mit erfüllter Bedingung sofort', () => {
    expect(run(TURN_REST, { lage: 'N', ...STAND }, 0.33).p).toBe(0);
    expect(run(TURN_REST, { lage: 'N', ...STAND }, 0.4).p).toBeGreaterThan(0);
    expect(run(TURN_REST, { lage: 'N', ...STAND, ready: true }, 0.1).p).toBeGreaterThan(0);
    // die Verzögerung zählt ab dem Loslassen: wer lange auf der Platte hält, beginnt danach wieder bei 0
    const held = run(TURN_REST, { lage: 'N', ...STAND, held: true }, 2);
    expect(run(held, { lage: 'N', ...STAND }, 0.33).p).toBe(0);
  });

  it('Einzeln tippen mit kurzem Halt dreht höchstens etwa 15° und kehrt weich zurück', () => {
    for (const lage of ['N', 'S'] as const) {
      let st = TURN_REST;
      let most = 0;
      const seen = (t: Turn) => (most = Math.max(most, Math.abs(t.yaw)));
      for (let i = 0; i < 3; i++) {
        st = run(st, { lage, ...STAND, moving: true, held: true }, 0.1, seen); // Tipp
        st = run(st, { lage, ...STAND, moving: true }, STEP_MS / 1000 - 0.1, seen); // Taste los, Schritt läuft aus
        st = run(st, { lage, ...STAND }, 0.8, seen); // kurzer Halt
      }
      st = run(st, { lage, ...OFF }, 2, seen); // weiter, runter von der Platte
      expect(most).toBeGreaterThan(0);
      expect(most).toBeLessThanOrEqual(15);
      expect(Math.abs(st.yaw)).toBeLessThan(0.1);
    }
  });

  it('Einzeln tippen wie ein Kind (Halt 0,4–0,5 s, sechs Tipps über die Platte): höchstens etwa 15°, kein Aufschaukeln', () => {
    for (const lage of LAGEN) {
      for (const pause of [0.4, 0.45, 0.5]) {
        let st = TURN_REST;
        const peaks: number[] = [];
        for (let i = 0; i < 6; i++) {
          let most = 0;
          const seen = (t: Turn) => (most = Math.max(most, Math.abs(t.yaw)));
          st = run(st, { lage, ...STAND, moving: true, held: true }, 0.1, seen);
          st = run(st, { lage, ...STAND, moving: true }, STEP_MS / 1000 - 0.1, seen);
          st = run(st, { lage, ...STAND }, pause, seen);
          peaks.push(most);
        }
        expect(Math.max(...peaks)).toBeLessThanOrEqual(15);
        // kein Aufschaukeln: der letzte Tipp dreht nicht weiter als der erste mit Spielraum
        expect(peaks[5]!).toBeLessThanOrEqual(peaks[0]! + 1);
      }
    }
  });

  it('Stehen erreicht Süd −155° in etwa 3,9 s und Nord 25° in 1,0 s', () => {
    expect(arrival('S', { ...STAND, ready: true })).toBeCloseTo(3.875, 1);
    expect(arrival('N', { ...STAND, ready: true })).toBeCloseTo(1, 1);
    expect(arrival('O', { ...STAND, ready: true })).toBeCloseTo(1.625, 1);
    expect(arrival('S', STAND)).toBeCloseTo(3.875 + TURN_DELAY_MS / 1000, 1);
    // die Feder kommt knapp danach an
    const st = run(TURN_REST, { lage: 'S', ...STAND, ready: true }, 3.875 + 1);
    expect(st.yaw).toBeCloseTo(-155, 0);
    expect(turnView(st).tilt).toBeCloseTo(45);
    expect(turnView(st).dist).toBeCloseTo(16);
    expect(turnView(st).lookY).toBeCloseTo(2.7);
    expect(turnView(st).shift).toBeCloseTo(1.5);
    expect(turnView(TURN_REST)).toEqual({ yaw: 0, tilt: 55, dist: 18, lookY: 0.6, shift: 0 });
  });

  it('Rückweg 1,3-mal so schnell: Süd in 3,875 / 1,3 s zurück', () => {
    const top = run(TURN_REST, { lage: 'S', ...STAND, ready: true }, 4);
    let t = 0;
    let st = top;
    while (st.p > 0) {
      st = turnStep(st, { lage: 'S', ...OFF }, DT);
      t += DT;
    }
    expect(t).toBeCloseTo(3.875 / BACK_FACTOR, 1);
  });

  it('Umkehren an jeder Stelle ohne Sprung: Winkelgeschwindigkeit stetig, Spitze hin etwa 60°/s, zurück 78°/s', () => {
    for (const lage of LAGEN) {
      for (const stand of [0.3, 0.8, 1.5, 2.5]) {
        let st = TURN_REST;
        const yaws: number[] = [0];
        const seen = (t: Turn) => yaws.push(t.yaw);
        st = run(st, { lage, ...STAND, ready: true }, stand, seen);
        st = run(st, { lage, ...OFF }, 1, seen); // runter
        run(st, { lage, ...STAND, ready: true }, 1, seen); // wieder drauf
        const speed = yaws.slice(1).map((y, i) => (y - yaws[i]!) / DT);
        expect(Math.max(...speed.map(Math.abs))).toBeLessThan(80); // Spitze hin 60°/s, zurück 1,3-mal so schnell
        const jerk = speed.slice(1).map((s, i) => Math.abs(s - speed[i]!));
        expect(Math.max(...jerk)).toBeLessThan(10); // °/s je Bild (gemessen bis 6,5); ohne Feder spränge sie beim Umkehren um bis zu 140
      }
    }
  });

  it('Pendeln am Ziel: ±4° mit 6 s Periode, setzt weich ein', () => {
    let st = run(TURN_REST, { lage: 'N', ...STAND, ready: true }, 1.5);
    const views: number[] = [];
    st = run(st, { lage: 'N', ...STAND, ready: true }, SWAY_PERIOD_S * 2, (t) => views.push(turnView(t).yaw));
    expect(Math.max(...views)).toBeCloseTo(25 + SWAY_DEG, 0);
    expect(Math.min(...views)).toBeCloseTo(25 - SWAY_DEG, 0);
    expect(st.sway).toBe(1);
    // runter: Pendeln klingt ab, dann ruht es
    st = run(st, { lage: 'N', ...OFF }, 2);
    expect(st.sway).toBe(0);
    expect(st.phase).toBe(0);
  });

  it('Blinzeln ab 45°: der erste Pfeildruck bringt die Ansicht zurück', () => {
    expect(needsBlink(45)).toBe(false);
    expect(needsBlink(46)).toBe(true);
    expect(needsBlink(-65)).toBe(true);
    expect(needsBlink(25 + SWAY_DEG)).toBe(false); // Nord blinzelt nie
    const ost = run(TURN_REST, { lage: 'O', ...STAND, ready: true }, 2);
    expect(needsBlink(turnView(ost).yaw)).toBe(true);
    // solange geblinzelt wird, wächst nichts
    expect(turnStep(ost, { lage: 'O', ...STAND, ready: true, mode: 'blink' }, DT).p).toBeLessThan(ost.p);
  });

  it('Ritual: im Vorspiel dreht sie sicher hin (auch ohne Platte), am Ende in 0,6 s zurück', () => {
    const lead = run(TURN_REST, { lage: 'S', ...OFF, mode: 'lead' }, turnSeconds('S') + 0.05);
    expect(lead.p).toBe(1);
    const back = run(lead, { lage: 'S', ...STAND, mode: 'back' }, CAMERA_BACK_S + 0.02);
    expect(back.p).toBe(0);
  });

  it('Kamera vor den Flügeln: Stehzeit und Vorspiel drehen ohne 350 ms hin (`ready`), Ritual hält vorn, am Ende zurück', () => {
    for (const lage of LAGEN) {
      const ready = { lage, ...STAND, ready: true };
      // Stehzeit bis zum Öffnen und Vorspiel: Beim Beginn des Rituals (die Flügel folgen 1,2 s später) ist sie vorn
      let st = run(TURN_REST, ready, ((OPEN_TICKS + leadTicks(lage)) * RULE_TICK_MS) / 1000);
      expect(st.p, lage).toBeGreaterThan(0.97);
      st = run(st, { lage, ...STAND, mode: 'lead' }, (RITUAL * RULE_TICK_MS) / 1000 - CAMERA_BACK_S);
      expect(st.p, lage).toBe(1);
      st = run(st, { lage, ...STAND, mode: 'back' }, CAMERA_BACK_S);
      expect(st.p, lage).toBe(0); // danach ist die Figur frei, die Pfeile stimmen
      // auch der Winkel samt Feder: Ohne Blinzeln (Nord, Ost, West) hängt die Feder (0,25 s) etwas nach, bleibt aber
      // unter 45°, also blinzelt kein Pfeil, und kurz danach ist sie ganz zurück (Süd blinzelt am Ende auf 0°)
      if (backNeedsBlink(lage)) continue;
      expect(Math.abs(turnView(st).yaw), lage).toBeLessThan(BLINK_FROM_DEG);
      expect(Math.abs(turnView(run(st, { lage, ...STAND }, 0.5)).yaw), lage).toBeLessThan(2);
    }
    // läuft die Figur im Vorspiel weg, dreht es zurück (die Logik öffnet das Tor trotzdem)
    const half = run(TURN_REST, { lage: 'S', ...STAND, ready: true }, 1.5);
    const away = run(half, { lage: 'S', ...OFF, ready: true }, 2.5);
    expect(away.p).toBe(0);
  });

  it('Blinzeln im Vorspiel: im Ritual keine neue Drehung, kein zweites Blinzeln', () => {
    // Südtor (am weitesten gedreht), die Figur steht auf seiner Platte; nur Tore und Zustand, die die Drehung liest
    const gate = { id: GUIDE_GATE, mid: [0, 0], out: OUT.S, cells: [] };
    const world = { gates: new Map([[GUIDE_GATE, gate]]) } as unknown as World;
    const pre = leadTicks('S');
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const turn = new PlateTurn(null);
    const at = (tick: number, still: number) =>
      ({
        tick,
        ritual: pre,
        still,
        sleeping: false,
        player: { x: 0, y: -2 },
        openGates: [GUIDE_GATE],
        animals: [],
      }) as unknown as State;
    const sc = () => ({
      now,
      reduced: false,
      plate: { id: GUIDE_GATE, since: 0, on: true },
      bodies: new Map([['player', { x: 0, y: -2 }]]),
    });
    let steps = 0;
    let pressed = -1; // Takt, an dem das Kind im Vorspiel einen Pfeil drückt (über 45°: Blinzeln, dann Anstoßen)
    for (; now < (pre + RITUAL) * RULE_TICK_MS; now += DT * 1000) {
      const tick = Math.floor(now / RULE_TICK_MS);
      const yaw = turn.frame(world, at(tick, pressed < 0 ? tick + 10 : tick - pressed), sc()).yaw;
      if (pressed < 0 && Math.abs(yaw) > BLINK_FROM_DEG) {
        expect(turn.blink(() => steps++)).toBe(true);
        pressed = tick;
      }
      if (tick >= pre) expect(Math.abs(yaw), `Takt ${tick}`).toBeLessThan(0.01); // im Ritual bleibt sie im Süden
    }
    expect(pressed).toBeGreaterThan(0);
    expect(pressed).toBeLessThan(pre);
    clock.mockRestore();
  });

  it('Rückfahrt: Süd blinzelt zurück, Nord, Ost und West fahren', () => {
    expect(BACK_BLINK_FROM_DEG).toBe(65);
    expect(LAGEN.map(backNeedsBlink)).toEqual([false, false, true, false]);
  });

  it('Nach dem Ritual dreht es erst wieder, wenn die Figur die Platte verlassen hat und neu draufsteht', () => {
    for (const lage of LAGEN) {
      let st = run(TURN_REST, { lage, ...STAND, mode: 'lead' }, turnSeconds(lage) + 1);
      st = run(st, { lage, ...STAND, mode: 'back' }, CAMERA_BACK_S + 0.1);
      st = run(st, { lage, ...STAND }, 3); // bleibt stehen: kein Schwenk zurück zur Front
      expect(st.p).toBe(0);
      expect(Math.abs(st.yaw)).toBeLessThan(0.5);
      st = run(st, { lage, ...STAND, moving: true }, STEP_MS / 1000); // runter
      st = run(st, { lage, ...OFF }, 0.1);
      expect(st.needLeave).toBe(false);
      st = run(st, { lage, ...STAND }, TURN_DELAY_MS / 1000 + 0.2); // wieder drauf
      expect(st.p).toBeGreaterThan(0);
    }
  });

  it('Ruhelage ist eingefroren und wird nie geteilt zurückgegeben', () => {
    expect(Object.isFrozen(TURN_REST)).toBe(true);
    expect(turnStep(TURN_REST, { lage: 'S', ...STAND, reduce: true }, DT)).not.toBe(TURN_REST);
  });

  it('Reduzierte Bewegung: immer 0, auch mitten in einer Drehung', () => {
    const half = run(TURN_REST, { lage: 'S', ...STAND, ready: true }, 2);
    for (const st of [TURN_REST, half]) {
      const r = turnStep(st, { lage: 'S', ...STAND, ready: true, reduce: true }, DT);
      expect(r).toEqual(TURN_REST);
      expect(turnView(r).yaw).toBe(0);
    }
    expect(run(TURN_REST, { lage: 'W', ...STAND, ready: true, mode: 'lead', reduce: true }, 3)).toEqual(TURN_REST);
  });

  it('smoothstep: 0, ½, 1 und außerhalb begrenzt', () => {
    expect([smooth(-1), smooth(0), smooth(0.5), smooth(1), smooth(2)]).toEqual([0, 0, 0.5, 1, 1]);
  });
});

/** Steht `s` Sekunden auf der Platte vor einem Tor der Lage `lage` (Bedingung erfüllt: ohne Verzögerung) */
const stood = (lage: Lage, s = 5) => run(TURN_REST, { lage, ...STAND, ready: true }, s);

describe('Kamera aus der Drehung (mitwachsen-camera.ts)', () => {
  const at = [10.5, 1, 20.5] as const; // Figur (x, Höhe, z)

  it('bei p = 0 genau wie bisher: 55° von oben aus Süden, 18 Felder (im Hochformat bis 1,8-fach), Blick auf die Figur', () => {
    expect(turnView(TURN_REST)).toEqual(CAM_REST);
    expect([TILT_DEG[0], DIST[0]]).toEqual([55, 18]);
    const PITCH = (55 * Math.PI) / 180; // so stand es fest in mitwachsen-3d.ts
    for (const k of [1, 1.4, 1.8]) {
      const dist = 18 * k;
      const { eye, look } = camPose(at, CAM_REST, k, [0, -1]);
      expect(eye).toEqual([at[0], at[1] + dist * Math.sin(PITCH), at[2] + dist * Math.cos(PITCH)]);
      expect(look).toEqual([...at]);
    }
    // auch nach einer Drehung, sobald sie ganz zurück ist
    const back = run(stood('S'), { lage: 'S', ...OFF }, 6);
    expect(back.p).toBe(0);
    expect(camPose(at, turnView({ ...back, yaw: 0, v: 0 }), 1, [0, 1])).toEqual(camPose(at, CAM_REST, 1, [0, 1]));
  });

  it('an der Front: Figur im unteren Drittel (im Hochformat in der unteren Hälfte), Tor in der Mitte darüber', () => {
    for (const lage of LAGEN) {
      const v = turnView(stood(lage));
      for (const aspect of [16 / 9, 4 / 3, 0.5]) {
        const k = Math.min(1.8, Math.max(1, 0.95 / aspect));
        const { eye, look } = camPose(at, v, k, OUT[lage]);
        const cam = new PerspectiveCamera(34, aspect, 0.5, 140);
        cam.position.set(...eye);
        cam.lookAt(...look);
        cam.updateMatrixWorld();
        const p = new Vector3(...at).project(cam);
        const down = (1 - p.y) / 2; // 0 oben, 1 unten
        expect(down).toBeGreaterThan(aspect < 1 ? 0.55 : 2 / 3);
        expect(down).toBeLessThan(0.85);
        expect(Math.abs(p.x)).toBeLessThan(0.3);
        // die Tür (drei Felder vor der Figur, zur Lage hin, auf Höhe 2) liegt über der Figur im Bild
        const door = new Vector3(at[0] + 3 * OUT[lage][0], 3, at[2] + 3 * OUT[lage][1]).project(cam);
        expect(door.y).toBeGreaterThan(p.y);
      }
    }
  });

  it('die Kamera steht in allen vier Lagen über der Lichtung, nie über Fels oder hinter dem Tor', () => {
    const w = worldOf(1);
    const lagen = new Set<Lage>();
    for (const g of w.gates.values()) {
      const lage = lageOf(g.out);
      lagen.add(lage);
      const [x, y] = plateMid(g);
      for (const st of [stood(lage), run(stood(lage), { lage, ...STAND, ready: true }, SWAY_PERIOD_S / 4)]) {
        const { eye } = camPose([x + 0.5, 1, y + 0.5], turnView(st), 1, OUT[lage]);
        const c = w.cell(Math.floor(eye[0]), Math.floor(eye[2]));
        expect(c.region, `${g.id}`).toBe('lichtung');
        expect(c.solid, `${g.id}`).toBeFalsy();
        expect(eye[1]).toBeGreaterThan(c.h + 8);
      }
    }
    expect(lagen.size).toBe(4);
  });

  it('die Sonne dreht mit, aber ohne Pendeln und gerastet: Steht die Figur, steht auch die Sonne (Schatten flimmern nicht)', () => {
    expect(sunYaw(TURN_REST)).toBe(0);
    const top = stood('O', 8);
    expect(sunYaw(top)).toBeCloseTo((-65 * Math.PI) / 180, 6);
    const suns = new Set<number>();
    run(top, { lage: 'O', ...STAND, ready: true }, SWAY_PERIOD_S, (t) => suns.add(sunYaw(t)));
    expect(suns.size).toBe(1); // das Bild pendelt, die Sonne nicht
  });

  it('Blickfächer der Karte nur, wenn gedreht: Richtung im Uhrzeigersinn von oben', () => {
    expect(fanDeg(0)).toBeNull();
    expect(fanDeg(FAN_FROM_DEG / 2)).toBeNull();
    expect(fanDeg(25)).toBe(-25); // Kamera südöstlich, Blick nach Nordnordwest
    expect(fanDeg(-155)).toBe(155);
    expect(Math.abs(fanDeg(turnView(stood('W')).yaw)! + 65)).toBeLessThanOrEqual(SWAY_DEG); // samt Pendeln
  });

  it('Bucht für die Ansicht: Reihen 1 bis 4 vor der Tür, quer ±5; nicht das Torhaus selbst, nicht weiter weg', () => {
    const w = worldOf(1);
    const gates = [...w.gates.values()];
    for (const g of gates) {
      const [px, py] = plateMid(g);
      expect(bayOf(gates, px, py)?.id).toBe(g.id);
      const ahead = (r: number, u = 0) =>
        bayOf(gates, g.mid[0] - g.out[0] * r - g.out[1] * u, g.mid[1] - g.out[1] * r + g.out[0] * u);
      expect(ahead(1, 5)?.id).toBe(g.id);
      expect(ahead(BAY_ROWS)?.id).toBe(g.id);
      expect(ahead(BAY_ROWS + 1)).toBeUndefined();
      expect(ahead(2, 6)).toBeUndefined();
      expect(ahead(0)).toBeUndefined();
    }
  });
});

describe('Blinzeln zurück (Blink in mitwachsen-turn.ts)', () => {
  /** Bilder alle 16 ms von `from` bis `to`: wann geschnitten wurde, wie dunkel es war */
  function frames(b: Blink, from: number, to: number) {
    const cuts: number[] = [];
    let darkest = 0;
    for (let t = from; t <= to; t += 16) {
      const f = b.frame(t);
      if (f.cut) cuts.push(t);
      darkest = Math.max(darkest, f.dark);
    }
    return { cuts, darkest };
  }

  it('unter 45° kein Blinzeln: Der Schritt geht sofort', () => {
    const b = new Blink();
    let steps = 0;
    expect(b.ask(BLINK_FROM_DEG, 0, () => steps++)).toBe(false);
    expect(b.ask(-30, 0, () => steps++)).toBe(false);
    expect(b.busy).toBe(false);
    expect(b.frame(500)).toEqual({ dark: 0, cut: false });
    expect(steps).toBe(0);
  });

  it('über 45°: abdunkeln, in der Mitte einmal schneiden, nach 300 ms genau ein Schritt; weitere Pfeile verfallen', () => {
    const b = new Blink();
    let steps = 0;
    expect(b.ask(-155, 1000, () => steps++)).toBe(true);
    expect(b.busy).toBe(true);
    expect(b.ask(-155, 1100, () => (steps += 10))).toBe(true); // zweiter Tipp: wartet nicht zusätzlich
    const early = frames(b, 1000, 1000 + BLINK_MS - 1);
    expect(steps).toBe(0);
    expect(early.cuts).toHaveLength(1);
    expect(early.cuts[0]).toBeGreaterThanOrEqual(1000 + BLINK_MS / 2);
    expect(early.darkest).toBeGreaterThan(0.95);
    frames(b, 1000 + BLINK_MS, 2000);
    expect(steps).toBe(1);
    expect(b.busy).toBe(false);
  });

  it('ein einziges langes Bild schneidet trotzdem und lässt den Schritt laufen; ein verpasster (Hintergrund) verfällt', () => {
    const b = new Blink();
    let steps = 0;
    b.ask(65, 0, () => steps++);
    expect(b.frame(BLINK_MS + 50)).toEqual({ dark: 0, cut: true });
    expect(steps).toBe(1);
    b.ask(65, 0, () => steps++);
    expect(b.frame(60_000).cut).toBe(true);
    expect(steps).toBe(1);
    expect(b.busy).toBe(false);
  });
});
