import { describe, expect, it } from 'vitest';
import { STORIES } from '../../data/games/mitwachsen-stories';
import { gateScore } from './mitwachsen-guest-look';
import { GATES } from '../../data/games/mitwachsen';
import { PLATE_KEY, PLATE_TUNE, plateTones, plopp, type Scored } from './sfx';
import { view } from './worlds/eis/view-2d';

describe('Töne beim Öffnen des Eistors', () => {
  const score = gateScore();
  const TAIL = 0.03; // so lange klingt ein Ton nach (`note`)

  it('Eiszapfen spielen ab 0,3 s die Eis-Melodie des Klangsteins, ab 1,2 s Rumms und Akkord; alles unter 5 s', () => {
    const melody = STORIES.eis.melody.notes.map(([f]) => f);
    expect(score.slice(0, melody.length).map(([f]) => f)).toEqual(melody);
    expect(score[0]![5]).toBeCloseTo(0.3);
    const rest = score.slice(melody.length);
    expect(rest.map(([, , , , , at]) => at)).toEqual(rest.map(() => 1.2));
    expect(rest.length).toBeLessThanOrEqual(5); // Rumms und ein Akkord aus höchstens vier Stimmen
    expect(Math.max(...score.map(([, len, , , , at]) => at + len + TAIL))).toBeLessThan(5);
  });

  it('höchstens 6 Stimmen zugleich, alle Töne in der Pentatonik C–D–E–G–A', () => {
    const PENTA = [0, 2, 4, 7, 9];
    for (const [, , , , , at] of score) {
      const sounding = score.filter(([, len, , , , from]) => from <= at + 1e-9 && at < from + len + TAIL);
      expect(sounding.length, `bei ${at.toFixed(2)} s`).toBeLessThanOrEqual(6);
    }
    for (const [hz] of score) {
      const semis = Math.round(12 * Math.log2(hz / 261.63));
      expect(PENTA, `${hz} Hz`).toContain(((semis % 12) + 12) % 12);
    }
  });
});

describe('Töne der Torplatte', () => {
  const TAIL = 0.03;
  /** Halbton über C (0 … 11) */
  const pitch = (hz: number) => ((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12;
  /** höchstens so viele Töne klingen zugleich */
  const voices = (notes: readonly Scored[]) =>
    Math.max(
      ...notes.map(
        ([, , , , , at]) => notes.filter(([, len, , , , from]) => from <= at && at < from + len + TAIL).length,
      ),
    );

  it('Betreten: dumpfes Klonk in der Tonart der Welt (tief, fällt) und ein Ton des Motivs; höchstens 3 Stimmen, kurz', () => {
    for (const { id } of GATES) {
      const [klonk, tone] = plateTones(id, 0);
      expect(klonk![0], id).toBeLessThan(400); // tief, aber über 120 Hz auch am Ende: Tablets spielen es noch
      expect(klonk![0] * klonk![4], id).toBeGreaterThan(110);
      expect(klonk![4], id).toBeLessThan(1); // fällt
      expect(pitch(klonk![0]), id).toBe((PLATE_KEY[id] + 12) % 12);
      expect(tone![0], id).toBeGreaterThan(300);
      expect(voices(plateTones(id, 3))).toBeLessThanOrEqual(3);
      expect(Math.max(...plateTones(id, 4).map(([, len, , , , at]) => at + len))).toBeLessThan(0.5);
    }
    expect(plateTones('sand', 0)[0]![0]).not.toBe(plateTones('lava', 0)[0]![0]); // jede Welt klingt anders
  });

  it('Eis: Klirren aus dem Welt-Paket statt Klonk, hell und in der Pentatonik C–D–E–G–A', () => {
    const clink = view.clink!;
    const notes = plateTones('eis', 0, clink);
    expect(notes.slice(0, clink.length)).toEqual(clink);
    expect(notes.some(([hz]) => hz < 200)).toBe(false); // kein Klonk
    for (const [hz] of notes) expect([0, 2, 4, 7, 9]).toContain(pitch(hz));
    expect(voices(notes)).toBeLessThanOrEqual(3);
  });

  it('fünfmal rauf und runter ergibt das Motiv E G A G C in der Tonart der Welt, danach beginnt es von vorn', () => {
    for (const { id } of GATES) {
      const tune = [0, 1, 2, 3, 4, 5].map((n) => plateTones(id, n).at(-1)![0]);
      expect(tune.map((hz) => pitch(hz))).toEqual(
        [...PLATE_TUNE, PLATE_TUNE[0]!].map((st) => (((st + PLATE_KEY[id]) % 12) + 12) % 12),
      );
      expect(tune[4]! / tune[0]!).toBeCloseTo(2 ** (8 / 12)); // von E hinauf zum hohen C
    }
  });

  it('Verlassen: ein leises, kurzes Plopp nach oben, eine Stimme', () => {
    for (const { id } of GATES) {
      const notes = plopp(id);
      expect(notes).toHaveLength(1);
      const [hz, len, , gain, slide] = notes[0]!;
      expect([hz > 200, len < 0.15, gain < 0.1, slide > 1]).toEqual([true, true, true, true]);
    }
  });
});
