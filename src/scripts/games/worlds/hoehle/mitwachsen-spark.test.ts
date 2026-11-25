// Ein Funke über den Sammelstellen der Grotte (Konzept „Höhle nach dem ersten Spielen“, Punkt 8, Schritt 9): höchstens
// einer auf dem Bild, alle 3 bis 4 s, über den nächsten vollen Pilzbeeten, bei reduzierter Bewegung keiner.
import { describe, expect, it } from 'vitest';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { HOEHLE_PACK, worldOf } from '../../test-worlds';
import { Spark, oneGlitter, sparkBoxes, sparkSources, type SparkState } from './mitwachsen-spark';
import { DRIP, Drips } from './mitwachsen-drips';
import type { World } from '../../mitwachsen-world';
import { caveFrame } from './mitwachsen-mask';

const S = GROTTE.spark;
const w = worldOf(1, [HOEHLE_PACK]);
const frame = caveFrame(w)!;
/** die beiden Beete nah am Bett und das Bett selbst, in der Welt */
const [b1, b2] = GROTTE.nearBeds.at.map(([a, o]) => frame.at(a, o));
const bed = w.homes.hoehle.bed;
const at = (x: number, y: number, extra: Partial<SparkState> = {}): SparkState => ({
  player: { x, y },
  picked: {},
  ...extra,
});

describe('Funke über den Sammelstellen', () => {
  it('die Beete nah am Bett liegen etwa 12 Felder vom Bett, beide voll in Reichweite des Funkens', () => {
    for (const b of [b1!, b2!]) {
      expect(w.cell(...b).deco).toBe('shroombed');
      expect(Math.hypot(b[0] - bed[0], b[1] - bed[1])).toBeGreaterThan(11);
      expect(Math.hypot(b[0] - bed[0], b[1] - bed[1])).toBeLessThan(13);
    }
  });

  it('Quellen: volle Pilzbeete bis 12 Felder, die nächsten zuerst, höchstens drei; leere und unerkundete nicht', () => {
    const [x, y] = b1!;
    const near = sparkSources(w, at(x + 1, y));
    expect(near[0]).toEqual([x, y]);
    expect(near.length).toBeLessThanOrEqual(S.of);
    expect(near.some(([a, b]) => a === b2![0] && b === b2![1])).toBe(true);
    for (const [a, b] of near) expect(Math.hypot(a - x - 1, b - y)).toBeLessThanOrEqual(S.near);
    expect(sparkSources(w, at(x + 1, y, { picked: { [`${x},${y}`]: 0 } }))[0]).not.toEqual([x, y]);
    expect(sparkSources(w, at(x + 1, y), () => false)).toEqual([]);
    // am Bett der Lichtung keine
    expect(sparkSources(w, at(...w.homes.lichtung.bed))).toEqual([]);
  });

  it('höchstens ein Funke zur selben Zeit, alle 3 bis 4 s ein neuer, nur kurz; abwechselnd über den nächsten Beeten', () => {
    expect(S.every).toBeGreaterThanOrEqual(3000);
    expect(S.every).toBeLessThanOrEqual(4000);
    expect(S.show).toBeLessThan(S.every / 2);
    const spark = new Spark();
    const s = at(b1![0] + 1, b1![1]);
    const starts: number[] = [];
    const where = new Set<string>();
    let lit = false;
    for (let t = 0; t <= 30000; t += 50) {
      const now = spark.now(w, s, t, false);
      if (now && !lit) starts.push(t);
      if (now) where.add(`${now.x},${now.y}`);
      lit = !!now;
    }
    const gaps = starts.slice(1).map((t, i) => t - starts[i]!);
    expect(gaps.every((g) => g >= 3000 && g <= 4000)).toBe(true);
    expect(starts.length).toBeGreaterThanOrEqual(8);
    expect(where.size).toBeGreaterThan(1); // abwechselnd
    // jedes Mal nur `show` ms
    const shown = Array.from({ length: S.every / 50 }, (_, i) => spark.now(w, s, 70 * S.every + i * 50, false)).filter(
      Boolean,
    ).length;
    expect(shown * 50).toBeLessThanOrEqual(S.show + 50);
  });

  it('bei reduzierter Bewegung, im Schlaf, im Fahrzeug und außerhalb der Grotte kein Funke', () => {
    const s = at(b1![0] + 1, b1![1]);
    const never = (f: (t: number) => unknown) => Array.from({ length: 200 }, (_, i) => f(i * 50)).every((v) => !v);
    expect(never((t) => new Spark().now(w, s, t, true))).toBe(true);
    expect(never((t) => new Spark().now(w, { ...s, sleeping: true }, t, false))).toBe(true);
    expect(never((t) => new Spark().now(w, { ...s, ride: {} }, t, false))).toBe(true);
    expect(never((t) => new Spark().now(w, at(...w.homes.lichtung.bed), t, false))).toBe(true);
  });

  it('wird das Beet geerntet, verlischt sein Funke sofort; der Funke ist weiß und klein, kein Gold', () => {
    const spark = new Spark();
    const s = at(b1![0] + 1, b1![1]);
    const lit = spark.now(w, s, 10, false)!;
    expect(lit).not.toBeNull();
    expect(spark.now(w, { ...s, picked: { [`${lit.x},${lit.y}`]: 1 } }, 20, false)).toBeNull();
    const boxes = sparkBoxes({ ...lit, p: 0.5 });
    expect(boxes.every((b) => b[6] === '#ffffff')).toBe(true);
    expect(Math.max(...boxes.map((b) => Math.max(b[3], b[5])))).toBeLessThan(0.4);
  });

  it('Funke und Glitzern der fernen Tropfquelle nie zugleich: über 30 s mit einem vollen Beet und der Quelle in Reichweite', () => {
    // kleine Grotte: Figur auf (0, 0), ein volles Beet 5 Felder weit, die Tropfquelle 10 Felder weit (fern), kein Stalagmit
    const deco = (x: number, y: number) =>
      x === 5 && y === 0 ? 'shroombed' : x === 10 && y === 0 ? 'dripspring' : undefined;
    const fake = {
      cell: (x: number, y: number) => ({ h: 1, ground: 'grotto', region: 'hoehle', deco: deco(x, y) }),
      realm: () => 'hoehle',
    } as unknown as World;
    expect(10).toBeGreaterThan(DRIP.near);
    const s = at(0, 0);
    const [spark, drips] = [new Spark(), new Drips()];
    let [sparks, glints, both, clash] = [0, 0, 0, 0];
    for (let t = 0; t <= 30000; t += 25) {
      drips.tick(fake, s, t, () => true);
      const drop = drips.falling(t);
      const raw = { spark: spark.now(fake, s, t, false), far: drop?.far ? drop : null };
      if (raw.spark && raw.far) clash++; // ohne die Regel stünden beide zugleich
      const lit = oneGlitter(raw.spark, raw.far);
      if (lit.spark) sparks++;
      if (lit.far) glints++;
      if (lit.spark && lit.far) both++;
    }
    expect({ clash: clash > 0, sparks: sparks > 0, glints: glints > 0, both }).toEqual({
      clash: true,
      sparks: true,
      glints: true,
      both: 0,
    });
  });
});
