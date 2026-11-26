// Dach der Bahnhöfe Bär und Fledermaus (Issue 15, Review vom 25.11.2026): klein und hoch, damit man die Figur darunter
// sieht und die Felder an der Bahnsteigkante frei sind. Die Platte liegt nur über der hinteren Hälfte der zwei
// Dachreihen (weg vom Gleis), Unterkante 2,0, auf zwei Pfosten am hinteren Rand; sie ist ein eigener Körper (ein späterer
// Durchblick träfe nur sie). Schild und, an Bahnhof Fledermaus, die drei Kristall-Lampen sitzen obenauf
import { describe, expect, it } from 'vitest';
import type { Part } from '../../../../lib/games/front';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { BAT_POSTS, BAT_ROOF, BAT_SIGN } from '../../../../data/games/worlds/bahn/mitwachsen-bat-model';
import {
  ROOF,
  ROOF_POSTS,
  ROOF_SIZE,
  ROOF_TOP,
  SIGN,
  signAt,
} from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import { dirTo } from '../../mitwachsen-free';
import { withTok } from '../../mitwachsen-ride-save';
import type { RideAt } from '../../mitwachsen-ride-view';
import { initialState } from '../../mitwachsen-state';
import { BAHN_PACK, HOEHLE_PACK, SAMPLE_SEEDS, worldOf } from '../../test-worlds';
import { batBodies } from './mitwachsen-bat-look';
import { withBuilt } from './mitwachsen-built';
import { ROOF_HALF, batPlatform, bearPlatform, underRoof } from './mitwachsen-platform';
import { stationBodies } from './mitwachsen-station-look';

const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const OPEN = withBuilt(withTok({}, { stage: 'offen', gefahren: true }), 2);
/** Die Platte eines Dachs: sein flachster, größter Quader */
const plateOf = (parts: readonly Part[]) => parts.find((p) => p[3] > 1 && p[4] > 2)!;
/** Pfosten: schmale, hohe Quader vom Bahnsteig bis unter die Platte */
const postsOf = (parts: readonly Part[]) => parts.filter((p) => p[3] <= 0.12 && p[4] <= 0.12 && p[5] > 1.5);

describe('Dach der Bahnhöfe: klein und hoch', () => {
  it('die Platte liegt nur über der hinteren Hälfte der zwei Dachreihen, Unterkante 2,0, entlang des Gleises so breit wie bisher', () => {
    expect(ROOF_SIZE).toEqual({ z: 2, h: 0.2, deep: 1.08, wide: 2.16 });
    expect(ROOF_TOP).toBeCloseTo(2.2);
    expect(ROOF_SIZE.wide / 2).toBe(ROOF_HALF); // die Regel „Aussteigen nie unter dem Dach“ rechnet mit derselben Breite
    for (const roof of [ROOF, BAT_ROOF]) {
      const [f, r, z, deep, wide, h] = plateOf(roof);
      expect([f, r, z, deep, wide, h]).toEqual([0, -1.08, 2, 1.08, 2.16, 0.2]);
    }
    expect(ROOF).toHaveLength(1); // Bär: der Körper des Dachs ist nur die Platte
  });

  it('kein Teil über der Hälfte zum Gleis: Platte, Pfosten, Bank und Lampen liegen alle hinten', () => {
    for (const parts of [ROOF, ROOF_POSTS, BAT_ROOF, BAT_POSTS])
      for (const [f, r, , fl, rw] of parts) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f + fl).toBeLessThanOrEqual(ROOF_SIZE.deep + 1e-9);
        expect(Math.max(Math.abs(r), Math.abs(r + rw))).toBeLessThanOrEqual(ROOF_SIZE.wide / 2 + 1e-9);
      }
  });

  it('zwei Pfosten am hinteren Rand statt vier, vom Bahnsteig bis unter die Platte; bei Bär die Bank darunter', () => {
    for (const parts of [ROOF_POSTS, BAT_POSTS]) {
      const posts = postsOf(parts);
      expect(posts).toHaveLength(2);
      for (const [f, , z, , , h] of posts) {
        expect(f).toBeGreaterThanOrEqual(0.7); // am hinteren Rand
        expect(z + h).toBeCloseTo(ROOF_SIZE.z);
      }
      expect(postsOf(parts).map((p) => p[1])).toEqual([-0.92, 0.8]);
    }
    expect(BAT_POSTS).toHaveLength(2);
    const bench = ROOF_POSTS.filter((p) => !postsOf(ROOF_POSTS).includes(p));
    expect(bench.length).toBeGreaterThan(2);
    for (const [, , z, , , h] of bench) expect(z + h).toBeLessThan(1); // niedrig, weit unter der Platte
  });

  it('Bahnhof Fledermaus: drei Kristall-Lampen sitzen auf dem Dach, nicht mehr am Boden, und keine im Schild', () => {
    const lamps = BAT_ROOF.filter((p) => p !== plateOf(BAT_ROOF));
    expect(lamps).toHaveLength(6); // je Lampe Kristall und Schein
    for (const [, , z] of lamps) expect(z).toBeGreaterThanOrEqual(ROOF_TOP);
    const bases = lamps.filter((p) => p[2] === ROOF_TOP);
    expect(bases).toHaveLength(3);
    expect(new Set(bases.map((p) => p[6])).size).toBe(3); // drei Farben
    // das Schild steht mitten auf der Platte (halbe Tiefe, quer 0): Keine Lampe steckt in seinem Feld
    for (const [f, r, , fl, rw] of bases) {
      const [cf, cr] = [f + fl / 2 - ROOF_SIZE.deep / 2, r + rw / 2];
      expect(Math.hypot(cf, cr)).toBeGreaterThan(0.4);
    }
    expect([...BAT_ROOF, ...BAT_POSTS].some((p) => p[6] === GOLD.side || p[7] === GOLD.top)).toBe(false);
  });

  it('im Bild: Platte und Pfosten sind zwei Körper über der Mitte der Dachreihen, das Schild steht mitten auf der Platte in der neuen Höhe', () => {
    for (const seed of SAMPLE_SEEDS) {
      const w = worldOf(seed, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 2 } });
      const s = { ...initialState(w, { packs: OPEN, openGates: ['eis', 'hoehle'] }), sleeping: false };
      const bodies = stationBodies(s, w, AT); // samt Bahnhof Fledermaus (`batBodies`)
      expect(batBodies(w, s).map((b) => b.id)).toContain('bahn:felspfosten');
      for (const [st, roof, posts, sign, models] of [
        [bearPlatform(w), 'bahn:dach', 'bahn:pfosten', 'bahn:schild', [ROOF, ROOF_POSTS, SIGN]],
        [batPlatform(w), 'bahn:felsdach', 'bahn:felspfosten', 'bahn:felsschild', [BAT_ROOF, BAT_POSTS, BAT_SIGN]],
      ] as const) {
        if (!st) continue; // Seed ohne Gleis
        const [top, legs, board] = [roof, posts, sign].map((id) => bodies.filter((b) => b.id === id));
        expect([top!.length, legs!.length, board!.length], `Seed ${seed} ${roof}`).toEqual([1, 1, 1]);
        const [t, l, b] = [top![0]!, legs![0]!, board![0]!];
        expect([t.parts, l.parts, b.parts]).toEqual(models);
        // Platte und Pfosten: derselbe Ort (Mitte der vier Dachfelder), dieselbe Richtung (vom Gleis weg)
        expect([l.x, l.y, l.z, l.dir]).toEqual([t.x, t.y, t.z, t.dir]);
        expect(t.dir).toBe(dirTo(...st.side));
        const under = st.roof.flatMap((i) => [st.rows[i]!.edge, st.rows[i]!.back]);
        expect(t.x).toBeCloseTo(under.reduce((sum, p) => sum + p[0], 0) / 4);
        expect(t.y).toBeCloseTo(under.reduce((sum, p) => sum + p[1], 0) / 4);
        // das Schild schaut zur Kamera und steht mitten auf der Platte: über den hinteren Feldern, nie über der Kante
        expect(b.dir).toBe('s');
        expect([b.x, b.y]).toEqual(Object.values(signAt(t.x, t.y, st.side)));
        expect(b.z).toBeCloseTo(t.z + ROOF_TOP);
        const backs = st.roof.map((i) => st.rows[i]!.back);
        expect(b.x).toBeCloseTo((backs[0]![0] + backs[1]![0]) / 2 + st.side[0] * 0.04);
        expect(b.y).toBeCloseTo((backs[0]![1] + backs[1]![1]) / 2 + st.side[1] * 0.04);
      }
    }
  });

  it('Durchblick (Issue 23): Die Platte ist genau dann durchscheinend, wenn die Figur unter ihr oder auf dem Feld gleich dahinter (nördlich) steht; nie Pfosten, Schild oder Reihen, nie während einer Fahrt', () => {
    let seen = 0;
    for (const seed of SAMPLE_SEEDS) {
      const w = worldOf(seed, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 2 } });
      const base = { ...initialState(w, { packs: OPEN, openGates: ['eis', 'hoehle'] }), sleeping: false };
      for (const [st, roof] of [
        [bearPlatform(w), 'bahn:dach'],
        [batPlatform(w), 'bahn:felsdach'],
      ] as const) {
        if (!st) continue; // Seed ohne Gleis
        seen++;
        const sheerAt = (x: number, y: number, ride?: object) => {
          const s = { ...base, player: { ...base.player, x, y }, ...(ride ? { ride } : {}) };
          return stationBodies(s as typeof base, w, AT)
            .filter((b) => b.sheer)
            .map((b) => b.id);
        };
        const backs = st.roof.map((i) => st.rows[i]!.back);
        const hidden = new Set(backs.flatMap(([x, y]) => [`${x},${y}`, `${x},${y - 1}`]));
        expect(hidden.size, `Seed ${seed} ${roof}`).toBe(backs[0]![0] === backs[1]![0] ? 3 : 4); // seitlich am Gleis: drei Felder in einer Spalte
        const [x0, y0] = backs[0]!;
        for (let dx = -3; dx <= 3; dx++)
          for (let dy = -3; dy <= 3; dy++) {
            const [x, y] = [x0 + dx, y0 + dy];
            expect(sheerAt(x, y), `Seed ${seed} ${roof} (${dx}, ${dy})`).toEqual(hidden.has(`${x},${y}`) ? [roof] : []);
            expect(underRoof(st, { player: { x, y } })).toBe(hidden.has(`${x},${y}`));
          }
        for (const [x, y] of backs) {
          expect(sheerAt(x, y)).toEqual([roof]); // unter der Platte
          expect(sheerAt(x, y - 1)).toEqual([roof]); // gleich dahinter
          expect(sheerAt(x, y, { phase: 'seated' })).toEqual([]); // im Zug sitzt sie nicht unter dem Dach
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
