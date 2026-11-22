import { describe, expect, it, vi } from 'vitest';
import { STORIES } from '../../data/games/mitwachsen-stories';
import { gateScore } from './mitwachsen-guest-look';
import { GATES, type GateId } from '../../data/games/mitwachsen';
import { PENTA, PLATE_SOUND, PLATE_TUNE, Sfx, plateHz, plateNote, plateTones, plopp, type Scored } from './sfx';
import { notYet } from './mitwachsen-hint-look';
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

  it('mit Vorspiel: alles wie ohne, nur später; die Melodie beginnt mit dem Leuchten der Eiszapfen (Süd: Flügel bei 4,7 s)', () => {
    const late = gateScore(47); // Takte
    expect(late.map(([f, len, wave, gain, r]) => [f, len, wave, gain, r])).toEqual(
      score.map(([f, len, wave, gain, r]) => [f, len, wave, gain, r]),
    );
    for (const [i, [, , , , , at]] of late.entries()) expect(at, `Ton ${i}`).toBeCloseTo(score[i]![5] + 3.5);
    expect(late[0]![5]).toBeCloseTo(3.8); // 0,3 s nach Beginn des Rituals, wie die Eiszapfen
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

  /** Tonart der Welt (Halbton über C) und die Halbtöne ihrer Pentatonik (0 … 11) */
  const key = (id: GateId) => PLATE_SOUND[id][0];
  const scale = (id: GateId) => [...PENTA[PLATE_SOUND[id][1]]!];

  it('Betreten: Klonk in der Tonart der Welt (tief, nie wie das Anstoßen) und ein Ton des Motivs; höchstens 3 Stimmen, kurz', () => {
    for (const { id } of GATES) {
      const [klonk, tone] = plateTones(id, 0);
      const [hz, len, , , slide] = klonk!;
      expect(hz, id).toBeLessThan(400); // tief, aber über 110 Hz auch am Ende: Tablets spielen es noch
      expect(hz * slide, id).toBeGreaterThan(110);
      expect(scale(id), id).toContain((((pitch(hz) - key(id)) % 12) + 12) % 12); // Grundton, Quarte oder Quinte darunter
      // Anstoßen (Fehler-Familie: 300 Hz, 0,22 s, fällt um die Hälfte): Fällt ein Klonk deutlich, ist er kurz
      expect(slide < 0.8 && len >= 0.15, id).toBe(false);
      expect(tone![0], id).toBeGreaterThan(300);
      expect(voices(plateTones(id, 3))).toBeLessThanOrEqual(3);
      expect(Math.max(...plateTones(id, 4).map(([, l, , , , at]) => at + l))).toBeLessThan(0.5);
    }
  });

  it('jede Welt klingt anders: Planke, Fliese, Basalt, Schiene, Holz, Wolke und Pilzhut je mit eigenem Klonk und eigener Melodie', () => {
    const klonks = GATES.map(({ id }) => plateTones(id, 0)[0]!.slice(0, 5).join());
    expect(new Set(klonks).size).toBe(GATES.length);
    const tunes = GATES.map(({ id }) => PLATE_TUNE.map((_, n) => plateTones(id, n).at(-1)![0]).join());
    expect(new Set(tunes).size).toBe(GATES.length);
    // die Wolke macht ein weiches „puff“ nach oben, die Schiene klingt am längsten nach, das Holz ist am kürzesten
    expect(plateTones('wolken', 0)[0]![4]).toBeGreaterThan(1);
    const lens = GATES.map(({ id }) => plateTones(id, 0)[0]![1]);
    expect(plateTones('hoehle', 0)[0]![1]).toBe(Math.max(...lens));
    expect(plateTones('wald', 0)[0]![1]).toBe(Math.min(...lens));
  });

  it('Eis: Klirren aus dem Welt-Paket statt Klonk, hell und in der Pentatonik C–D–E–G–A', () => {
    const clink = view.clink!;
    const notes = plateTones('eis', 0, clink);
    expect(notes.slice(0, clink.length)).toEqual(clink);
    expect(notes.some(([hz]) => hz < 200)).toBe(false); // kein Klonk
    for (const [hz] of notes) expect([0, 2, 4, 7, 9]).toContain(pitch(hz));
    expect(voices(notes)).toBeLessThanOrEqual(3);
  });

  it('fünfmal rauf und runter ergibt das Motiv in der Pentatonik der Welt (Dur: E G A G C), danach beginnt es von vorn', () => {
    for (const { id } of GATES) {
      const tune = [0, 1, 2, 3, 4, 5].map((n) => plateTones(id, n).at(-1)![0]);
      for (const hz of tune) expect(scale(id), id).toContain((((pitch(hz) - key(id)) % 12) + 12) % 12);
      expect(tune[5]).toBe(tune[0]);
      expect(tune[4]).toBeCloseTo(plateHz(id, 12)); // endet auf dem hohen Grundton
      expect(tune[1]).toBeCloseTo(tune[3]!);
    }
    expect(PLATE_TUNE.map((_, n) => plateNote('eis', n))).toEqual([4, 7, 9, 7, 12]);
    // keine Pentatonik hat einen Halbtonschritt (nichts reibt)
    for (const s of PENTA) for (let i = 1; i < s.length; i++) expect(s[i]! - s[i - 1]!).toBeGreaterThan(1);
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

describe('„Noch nicht“ am Tor', () => {
  const TAIL = 0.03;
  /** Halbtöne zwischen zwei Tönen, ohne Oktaven (0 … 11) */
  const interval = (a: number, b: number) => ((Math.round(12 * Math.log2(b / a)) % 12) + 12) % 12;
  const sounding = (notes: readonly Scored[], at: number) =>
    notes.filter(([, len, , , , from]) => from <= at + 1e-9 && at < from + len + TAIL);

  it('hm-hm ohne Moll und ohne Dissonanz, höchstens 2 Stimmen, nie ein Ton aus der Fehler-Familie, unter 2,5 s', () => {
    for (const { id } of GATES) {
      const notes = notYet(id);
      // „hm-hm?“: zwei weiche Töne, der zweite eine Quarte höher (fragend, kein Mollschritt)
      const [hm, hm2] = notes;
      expect([hm![2], hm2![2]], id).toEqual(['sine', 'sine']);
      expect(hm2![0] / hm![0], id).toBeCloseTo(2 ** (5 / 12));
      expect(hm2![5], id).toBeGreaterThan(hm![5] + hm![1]); // nacheinander
      for (const [, , , , , at] of notes) {
        const now = sounding(notes, at);
        expect(now.length, `${id} bei ${at} s`).toBeLessThanOrEqual(2);
        // was zugleich klingt, ist Einklang, Oktave, große Terz, Quarte oder Quinte: keine kleine Terz, keine Reibung
        for (const a of now) for (const b of now) expect([0, 4, 5, 7]).toContain(interval(a[0], b[0]));
      }
      // alles in der Pentatonik der Welt
      const scale = [...PENTA[PLATE_SOUND[id][1]]!];
      for (const [hz] of notes) expect(scale, id).toContain(interval(261.63 * 2 ** (PLATE_SOUND[id][0] / 12), hz));
      // Fehler-Familie: Anstoßen (fällt tief ab) – hier fällt nichts, nichts ist laut, nichts tief und brummig
      for (const [hz, , , gain, slide] of notes)
        expect([slide >= 1, gain <= 0.1, hz > 150], id).toEqual([true, true, true]);
      expect(Math.max(...notes.map(([, len, , , , at]) => at + len + TAIL)), id).toBeLessThan(2.5);
    }
  });

  it('der Klangstein summt das Motiv der Torplatte, eine Oktave tiefer; der Riegel klappert mit jedem Wackeln', () => {
    const notes = notYet('eis');
    const hum = notes.slice(-PLATE_TUNE.length);
    expect(hum.map(([hz]) => Math.round(12 * Math.log2(hz / 261.63)))).toEqual(
      PLATE_TUNE.map((_, n) => plateNote('eis', n)),
    );
    const latch = notes.filter(([, len]) => len < 0.05);
    expect(latch.map(([, , , , , at]) => at)).toEqual([0, 0.8]);
    // reduzierte Bewegung: Die Tür wackelt nicht, also klappert auch kein Riegel; sonst klingt alles gleich
    expect(notYet('eis', true)).toEqual(notes.filter(([, len]) => len >= 0.05));
  });

  /** Was die echte Klangmaschine spielt (gegen ein aufzeichnendes WebAudio): je Ton Frequenz, Welle und Ziel des Gleitens */
  function heard(play: (sfx: Sfx) => void) {
    const notes: { hz: number; wave: string; to?: number }[] = [];
    const node = () => ({ connect: <T>(d: T) => d });
    const param = () => ({ value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
    class FakeAudio {
      currentTime = 0;
      state = 'running';
      destination = {};
      createDynamicsCompressor = node;
      createGain = () => ({ ...node(), gain: param() });
      createOscillator() {
        const osc = {
          ...node(),
          type: '',
          onended: null,
          start() {},
          stop() {},
          frequency: {
            setValueAtTime: (hz: number) => void notes.push({ hz, wave: osc.type }),
            exponentialRampToValueAtTime: (to: number) => void (notes.at(-1)!.to = to),
          },
        };
        return osc;
      }
    }
    vi.stubGlobal('AudioContext', FakeAudio);
    const sfx = new Sfx();
    sfx.unlock();
    play(sfx);
    vi.unstubAllGlobals();
    return notes;
  }

  it('klingt anders als der Ton beim Anstoßen (Fehler-Familie): nicht seine Töne, nichts gleitet hinab', () => {
    const bump = heard((s) => s.bump());
    expect(bump.length).toBeGreaterThan(0);
    expect(bump.some((n) => n.to !== undefined && n.to < n.hz)).toBe(true); // das Anstoßen fällt
    for (const { id } of GATES) {
      const hm = heard((s) => s.score(notYet(id)));
      expect(hm.length, id).toBe(notYet(id).length); // alles erklingt (höchstens 2 zugleich, unter dem Limit)
      for (const n of hm)
        expect(n.to === undefined || n.to >= n.hz, `${id}: ${n.hz} Hz gleitet nicht hinab`).toBe(true);
      // keine Folge von Tönen des Anstoßens, nirgends (Frequenz, Welle und Gleiten)
      const sig = (ns: typeof hm) =>
        ns.map((n) => `${Math.round(n.hz)}/${n.wave}/${n.to ? Math.round(n.to) : '-'}`).join();
      for (let i = 0; i + bump.length <= hm.length; i++)
        expect(sig(hm.slice(i, i + bump.length)), id).not.toBe(sig(bump));
    }
  });
});
