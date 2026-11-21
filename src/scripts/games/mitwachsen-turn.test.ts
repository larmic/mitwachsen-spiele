import { describe, expect, it } from 'vitest';
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
import {
  BACK_BLINK_FROM_DEG,
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
import { OPEN_TICKS } from './worlds/eis/mitwachsen-ritual';

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

  it('Doppelte Werte bleiben gleich: Takt wie larmic-mitwachsen.ts, Stehzeit wie das Ritual, Sonne wie die 3D-Ansicht', () => {
    expect(OPEN_MS).toBe(OPEN_TICKS * RULE_TICK_MS);
    const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
    expect(src('./larmic-mitwachsen.ts')).toContain(`const TICK_MS = ${RULE_TICK_MS};`);
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
