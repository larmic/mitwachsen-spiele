// Drehung zur Torfront: Was sich an einem Zugang ändert, während die Kamera auf der Torplatte zur Front dreht.
// Regel: Der Körper bleibt, nur das Schild dreht (Fassung 1 → Fassung 2, mitwachsen-gatehouses-3d.ts); die Wolke dreht
// den Kopf in kleinen Stufen mit.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Torplatte: Drehung)

import { describe, expect, it } from 'vitest';
import { GATES, type GateTheme } from '../../data/games/mitwachsen';
import { BEATS, parts, type GateCtx, type Vox } from './mitwachsen-gate-kit';
import { raster as eis } from './mitwachsen-gate-eis';
import { hoehleVox } from './mitwachsen-gate-hoehle';
import { bands, voxels as lava } from './mitwachsen-gate-lava';
import { motionVox, pilzVox } from './mitwachsen-gate-pilze';
import { sandGate } from './mitwachsen-gate-sand';
import { raster as wald } from './mitwachsen-gate-wald';
import { model as wasser, moving } from './mitwachsen-gate-wasser';
import { puffs as wolkenPuffs, voxels as wolken } from './mitwachsen-gate-wolken';
import { frontMode } from './mitwachsen-gatehouses-3d';
import { TURN_STEPS, gate, motion, moves } from './mitwachsen-gates-3d';
import { SWAY_DEG } from './mitwachsen-turn';
import { TARGET_DEG } from './mitwachsen-turn-pace';

const RASTER: Record<GateTheme, (g: GateCtx) => Vox> = {
  eis,
  sand: sandGate,
  wasser,
  lava,
  hoehle: hoehleVox,
  wald,
  wolken,
  pilze: pilzVox,
};
/** Richtung zur Kamera in Ruhe für die Lagen Ost, West und Süd (im Norden dreht nichts) */
const HOMES = [
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const OPENS = [0, 0.5, 1];
const GATE_IDS = GATES.map((g) => g.id);
/**
 * So viele Voxel darf das Schild beim Wechsel der Seite ändern (weg, neu oder umgefärbt). Das größte hat das Wassertor:
 * Muschel und Tropfen in doppelter Größe, 938 Voxel. Ein Körper, der mitwechselt, lag immer darüber (Höhle 1295)
 */
const SIGN = 1000;
/**
 * So weit (Felder) gleitet der Kopf der Wolke höchstens von Stufe zu Stufe (`HEAD`, Bausch 3) und jeder andere Bausch
 * (`GLIDE`: Schnarchwölkchen und Füße des Regenbogens haben den weitesten Weg); der Sprung vorher war 2,7 bis 5,7 Felder
 */
const HEAD = 0.4;
const GLIDE = 1;
/** Grenze eines Zugangs, zur Front gebaut (mitwachsen-gatehouse.test.ts) */
const FRONT_VOX = 6600;

const cells = (v: Vox) => {
  const all = (v as unknown as { cells: Map<number, { c: string; part: string }> }).cells;
  return new Map([...all].map(([k, c]) => [k, `${c.c}|${c.part}`]));
};
/** Voxel, die in genau einem Raster liegen oder anders gefärbt sind */
function diff(a: Vox, b: Vox) {
  const [ca, cb] = [cells(a), cells(b)];
  let n = 0;
  for (const [k, c] of ca) if (cb.get(k) !== c) n++;
  for (const k of cb.keys()) if (!ca.has(k)) n++;
  return n;
}
const ctx = (open: number, home: readonly [number, number], turn: number): GateCtx => ({
  open,
  outline: false,
  lit: 0,
  cam: turn > 0.5 ? [0, 1] : home,
  home,
  turn,
  all: true,
});

describe('Drehung zur Torfront: am Zugang ändert sich nur das Schild', () => {
  it('jeder Zugang, Lage Ost, West und Süd, zu, halb und offen: Fassung 1 und Fassung 2 haben denselben Körper', () => {
    const bad: string[] = [];
    for (const id of GATE_IDS)
      for (const home of HOMES)
        for (const open of OPENS) {
          if (TURN_STEPS[id]) continue; // dreht in Stufen mit, eigener Test unten
          const [a, b] = [RASTER[id](ctx(open, home, 0)), RASTER[id](ctx(open, home, 1))];
          const n = diff(a, b);
          if (n > SIGN) bad.push(`${id} ${home.join()} offen ${open}: ${n} Voxel`);
          if (b.size > FRONT_VOX) bad.push(`${id} ${home.join()} offen ${open}: ${b.size} Voxel`);
        }
    expect(bad).toEqual([]);
  });

  it('die Wolke dreht den Kopf mit: Von Stufe zu Stufe gleitet er höchstens 0,4 Felder, jeder andere Bausch höchstens eins', () => {
    const bad: string[] = [];
    const steps = TURN_STEPS.wolken!;
    expect(Object.keys(TURN_STEPS)).toEqual(['wolken']);
    for (const home of HOMES)
      for (const open of [0, 0.5, 0.7]) {
        // (ganz offen steht der Regenbogen wie ein Schild zur Kamera: Seine Füße wechseln mit ihm bei halber Drehung)
        let moved = 0;
        for (let s = 0; s < steps; s++) {
          const [a, b] = [wolkenPuffs(ctx(open, home, s / steps)), wolkenPuffs(ctx(open, home, (s + 1) / steps))];
          a.forEach((p, n) => {
            const q = b[n]!;
            const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
            const grow = Math.max(...[3, 4, 5].map((k) => Math.abs(q[k]! - p[k]!)));
            moved += d;
            if (d > (n === 3 ? HEAD : GLIDE) || grow > HEAD)
              bad.push(`${home.join()} offen ${open} Stufe ${s} Bausch ${n}: ${d.toFixed(2)}`);
          });
          const v = wolken(ctx(open, home, (s + 1) / steps));
          if (v.size > FRONT_VOX) bad.push(`${home.join()} offen ${open} Stufe ${s + 1}: ${v.size} Voxel`);
        }
        if (moved < 0.3) bad.push(`${home.join()} offen ${open}: der Kopf dreht nicht mit`);
      }
    expect(bad).toEqual([]);
    // am Ziel steht die Wolke genau wie von vorn gebaut, am Anfang genau wie für die Ruhe-Kamera
    for (const home of HOMES) {
      expect(diff(wolken(ctx(0, home, 1)), wolken({ ...ctx(0, [0, 1], 0), home: undefined }))).toBe(0);
      expect(diff(wolken(ctx(0, home, 0)), wolken({ ...ctx(0, home, 0), home: undefined, turn: undefined }))).toBe(0);
    }
  });

  it('beim Betreten der Bucht springt nichts um: Fassung 1 hat jeden Voxel der Fassung für den Süden, gleich gefärbt', () => {
    const bad: string[] = [];
    for (const id of GATE_IDS)
      for (const home of HOMES) {
        const south = { open: 0, outline: false, lit: 0, cam: home };
        const all = cells(RASTER[id](ctx(0, home, 0)));
        let miss = 0;
        for (const [k, c] of cells(RASTER[id](south))) if (all.get(k) !== c) miss++;
        if (miss) bad.push(`${id} ${home.join()}: ${miss} Voxel`);
      }
    expect(bad).toEqual([]);
  });

  it('die bewegten Teile (Wasserwand, Glut, Ranken) bleiben beim Wechsel der Fassung, wo sie sind, in jedem Takt', () => {
    const bad: string[] = [];
    const key = (c: readonly unknown[]) => c.join();
    for (const home of HOMES)
      for (const open of OPENS)
        for (let beat = 0; beat < BEATS; beat++) {
          const [a, b] = [ctx(open, home, 0), ctx(open, home, 1)];
          const [wa, wb] = [moving(a, beat).map(key).sort(), moving(b, beat).map(key).sort()];
          if (wa.join('|') !== wb.join('|')) bad.push(`wasser ${home.join()} ${open} Takt ${beat}`);
          if (diff(bands(a, beat), bands(b, beat))) bad.push(`lava ${home.join()} ${open} Takt ${beat}`);
          const n = diff(motionVox(a, beat), motionVox(b, beat));
          if (n > SIGN) bad.push(`pilze ${home.join()} ${open} Takt ${beat}: ${n}`);
        }
    expect(bad).toEqual([]);
  });

  it('welche Fassung gezeigt wird: ohne Stufen ab halber Drehung die Front, mit Stufen die nächste; am Ziel pendelt nichts', () => {
    expect([false, true].map((far) => frontMode(1, { far, amount: far ? 1 : 0 }))).toEqual([1, 2]);
    expect(frontMode(1, null)).toBe(1);
    const steps = TURN_STEPS.wolken!;
    const modes = Array.from({ length: 101 }, (_, n) => frontMode(steps, { far: n > 50, amount: n / 100 }));
    expect(modes[0]).toBe(1);
    expect(modes[100]).toBe(steps + 1);
    expect(modes.every((m, n) => n === 0 || m === modes[n - 1] || m === modes[n - 1]! + 1)).toBe(true); // keine Stufe fehlt
    expect(frontMode(steps, { far: true, amount: 1.3 })).toBe(steps + 1);
    // das Pendeln am Ziel (±`SWAY_DEG`) wechselt die Stufe nie; im Norden gibt es keine Fassungen zur Front
    for (const deg of [TARGET_DEG.O, TARGET_DEG.W, TARGET_DEG.S]) {
      const sway = SWAY_DEG / Math.abs(deg);
      expect(frontMode(steps, { far: true, amount: 1 - sway }), `${deg}°`).toBe(steps + 1);
    }
  });

  it('`gate` und `motion` reichen `home` und `turn` an den Bauplan durch; ohne `home` gilt `cam`', () => {
    for (const id of GATE_IDS) {
      const count = (home?: readonly [number, number]) => {
        const p = parts();
        gate(p, id, 0, false, 0, [0, 1], undefined, true, home, 1);
        if (moves(id)) motion(p, id, 0, 0, [0, 1], true, home);
        return Object.values(p).reduce((n, g) => n + g.build().index!.count, 0);
      };
      expect(count(), id).toBe(count([0, 1]));
    }
    // das Lavator von vorn: der Glutbaum bleibt, wo er aus der Ruhe-Kamera im Osten steht
    const tree = (home?: readonly [number, number]) =>
      cells(lava({ open: 0, outline: false, lit: 0, cam: [0, 1], home, all: true }));
    expect(tree([1, 0])).not.toEqual(tree());
  });
});
