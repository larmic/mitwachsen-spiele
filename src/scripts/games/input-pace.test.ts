import { describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../lib/games/front';
import { ACTION_MS, ENCOUNTERS, HOLD_MS, InputPace, STEP_MS, stops } from './input-pace';
import { initialState, step, type GameEvent, type State } from './mitwachsen-state';
import { plateMid } from './mitwachsen-plate';
import { worldOf } from './test-worlds';
import { Blink } from './mitwachsen-turn';
import { BLINK_MS } from './mitwachsen-turn-pace';

/** Simuliert `ms` Millisekunden mit einem Bild alle 16 ms und zählt die Schritte */
function steps(pace: InputPace, from: number, ms: number, taps: number[] = [], dir: Dir = 'e') {
  const out: number[] = [];
  for (let t = from; t < from + ms; t += 16) {
    if (taps.some((tap) => tap >= t && tap < t + 16)) {
      if (pace.press(dir, t)) out.push(t);
      pace.release(dir);
    }
    if (pace.poll(t)) out.push(t);
  }
  return out;
}

describe('Ruhiger Takt der Eingabe', () => {
  it('der erste Druck läuft sofort', () => {
    expect(new InputPace().press('e', 0)).toBe('e');
  });

  it('ein Druck ist genau ein Schritt, auch wenn der Finger etwas länger liegt', () => {
    const pace = new InputPace();
    expect(pace.press('e', 0)).toBe('e');
    expect(steps(pace, 0, HOLD_MS - 20)).toEqual([]);
    pace.release('e');
    expect(steps(pace, HOLD_MS - 20, 2000)).toEqual([]);
  });

  it('wer hält, läuft nach der Wartezeit gleichmäßig im Takt weiter', () => {
    const pace = new InputPace();
    pace.press('e', 0);
    const times = steps(pace, 0, 2000);
    expect(times[0]).toBeGreaterThanOrEqual(HOLD_MS);
    expect(times[0]).toBeLessThanOrEqual(HOLD_MS + 16);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeLessThan(STEP_MS + 17);
  });

  it('wildes Tippen ist nicht schneller als Halten', () => {
    const held = new InputPace();
    held.press('e', 0);
    const holding = steps(held, 0, 3000).length + 1;
    const tapper = new InputPace();
    const taps = Array.from({ length: 60 }, (_, i) => i * 50); // 20 Tipps pro Sekunde
    const tapping = steps(tapper, 0, 3000, taps).length;
    expect(tapping).toBeLessThanOrEqual(holding + 1); // höchstens der eine Schritt der Wartezeit
  });

  it('merkt sich einen Tipp während eines Schritts, aber nur einen', () => {
    const pace = new InputPace();
    expect(pace.press('e', 0)).toBe('e');
    pace.release('e');
    expect(pace.press('n', 50)).toBeNull();
    pace.release('n');
    expect(pace.press('s', 100)).toBeNull(); // ersetzt den gemerkten
    pace.release('s');
    expect(pace.poll(STEP_MS - 1)).toBeNull();
    expect(pace.poll(STEP_MS)).toBe('s');
    expect(pace.poll(2 * STEP_MS)).toBeNull(); // nichts gehalten, nichts gemerkt
  });

  it('beim Halten zweier Pfeile gilt der zuletzt gedrückte, nach dem Loslassen wieder der andere', () => {
    const pace = new InputPace();
    pace.press('e', 0);
    pace.press('n', 10);
    expect(pace.poll(10 + HOLD_MS)).toBe('n');
    pace.release('n');
    expect(pace.poll(10 + HOLD_MS + STEP_MS)).toBe('e');
  });

  it('nach clear läuft nichts weiter', () => {
    const pace = new InputPace();
    pace.press('e', 0);
    pace.clear();
    expect(pace.poll(STEP_MS * 3)).toBeNull();
  });

  it('Begegnungen halten die Figur an: Tiere, Beeren, Fische, Futter, Wasser, Plattformen, Klangsteine, das Eistor, das Bett', () => {
    for (const type of [
      'sing',
      'follow',
      'pick',
      'catch',
      'fill',
      'feed',
      'pour',
      'portal',
      'teleport',
      'story',
      'gate', // das Eistor geht auf: Die Figur bleibt stehen …
      'hop', // … und jeder Pfeil lässt sie nur hüpfen, bis es offen ist
      'sleep', // ins Bett gelaufen: Der gehaltene Pfeil weckt sie nicht gleich wieder
    ] as const)
      expect(ENCOUNTERS.has(type), type).toBe(true);
    // Laufen, Anstoßen, Platz machen, Heimkommen und Nachwachsen halten nicht an
    for (const type of ['step', 'bump', 'swap', 'aside', 'home', 'regrow', 'ready'] as const)
      expect(ENCOUNTERS.has(type), type).toBe(false);
  });

  it('die Torplatte ist keine Begegnung: drauf, längs drüber und wieder runter läuft die Figur ohne Halt', () => {
    const w = worldOf(1);
    for (const id of ['eis', 'sand'] as const) {
      const g = w.gates.get(id)!;
      const [px, py] = plateMid(g);
      const dir = (v: readonly [number, number]) =>
        (Object.keys(DIRS) as Dir[]).find((d) => DIRS[d][0] === v[0] && DIRS[d][1] === v[1])!;
      const along: [number, number] = [Math.abs(g.out[1]), Math.abs(g.out[0])];
      // von Reihe 3 der Bucht auf die Platte, längs ein Feld hin, zwei zurück, eins hin, wieder herunter
      const moves = [g.out, along, [-along[0], -along[1]], [-along[0], -along[1]], along, [-g.out[0], -g.out[1]]];
      const start = initialState(w);
      let s: State = {
        ...start,
        sleeping: false,
        animals: [],
        player: { x: px - g.out[0], y: py - g.out[1], dir: 's' },
      };
      for (const m of moves) {
        const { state, events } = step(s, w, { type: 'move', dir: dir(m as [number, number]) });
        expect(
          events.map((e) => e.type),
          id,
        ).toContain('step');
        expect(stops(events), id).toBeNull();
        s = state;
      }
      expect([s.player.x, s.player.y]).toEqual([px - g.out[0], py - g.out[1]]);
    }
  });

  it('der führende Pinguin hält nicht an, wenn die Figur in ihn läuft; jedes andere Tier schon', () => {
    const sing = (id: string) => ({ type: 'sing', id, species: 'pinguin', first: false }) as const;
    expect(stops([{ type: 'step', climb: 0 }, sing('eis:pinguin')], 'eis:pinguin')).toBeNull();
    expect(stops([sing('eis:pinguin')])).toBe('pause'); // führt nicht (wohnt schon im Kessel): Begegnung wie jedes Tier
    expect(stops([sing('eis:robbe')], 'eis:pinguin')).toBe('pause');
    expect(stops([sing('eis:pinguin'), { type: 'portal', id: 'eiskessel' }], 'eis:pinguin')).toBe('pause');
  });

  it('nach einer Begegnung steht die Figur kurz und läuft mit gehaltenem Pfeil weiter; aus dem Bett erst nach neuem Druck', () => {
    expect(stops([{ type: 'sleep' }])).toBe('clear');
    expect(stops([{ type: 'step', climb: 0 }])).toBeNull();
    const pace = new InputPace();
    pace.press('e', 0);
    pace.halt('pause', 100); // Begegnung, der Pfeil bleibt gehalten
    expect(steps(pace, 100, HOLD_MS - 20)).toEqual([]); // kurz stehen …
    const later = steps(pace, 100 + HOLD_MS - 20, 1000);
    expect(later[0]).toBeLessThanOrEqual(100 + HOLD_MS + 16); // … dann weiter im Takt
    expect(later.length).toBeGreaterThan(2);
    const bed = new InputPace();
    bed.press('e', 0);
    bed.halt('clear', 100);
    expect(steps(bed, 100, 2000)).toEqual([]);
  });

  it('ein falsches Loslassen kurz nach dem Druck (Chrome auf dem Mac): Die Wiederholungen halten den Pfeil, die Figur läuft weiter', () => {
    // So aufgezeichnet: keydown 4942, keyup 4963 (Taste weiter gehalten), keydown repeat ab 5276, keyup 7027
    const pace = new InputPace();
    expect(pace.press('s', 4942)).toBe('s');
    pace.release('s');
    pace.repeat('s');
    const times = steps(pace, 5276, 7027 - 5276);
    expect(times[0]).toBeLessThanOrEqual(4942 + HOLD_MS + 16 + 5276 - 4942); // spätestens mit der ersten Wiederholung
    expect(times.length).toBeGreaterThanOrEqual(5); // läuft durch bis zum echten Loslassen
    pace.release('s');
    expect(steps(pace, 7027, 1000)).toEqual([]);
  });

  it('nach clear (Bett, Fokus weg) bringen Wiederholungen den Pfeil nicht zurück, erst ein neuer Druck', () => {
    const pace = new InputPace();
    pace.press('s', 0);
    pace.clear();
    pace.repeat('s');
    expect(steps(pace, 0, 2000)).toEqual([]);
    expect(pace.press('s', 2000)).toBe('s');
    pace.repeat('s');
    expect(steps(pace, 2000, 1000).length).toBeGreaterThan(0);
  });

  it('held: solange ein Pfeil gedrückt ist, steht die Figur nicht (Torplatte)', () => {
    const pace = new InputPace();
    expect(pace.held()).toBe(false);
    expect(pace.press('e', 0)).toBe('e');
    expect(pace.held()).toBe(true); // gehalten, auch in der Wartezeit bis HOLD_MS
    pace.release('e');
    expect(pace.held()).toBe(false);
    expect(pace.press('e', 100)).toBeNull(); // Tipp im Takt gemerkt: kommt nach weniger als 260 ms dran
    pace.release('e');
    expect(pace.held()).toBe(false);
    expect(pace.poll(STEP_MS)).toBe('e');
    pace.press('w', 1000);
    pace.clear();
    expect(pace.held()).toBe(false);
  });

  it('Blinzeln verzögert den Schritt um 300 ms, ohne ihn zu verlieren (Pfeile bleiben weltbezogen)', () => {
    // wie die Web Component: jeder Schritt des Takts fragt erst die 3D-Ansicht (`blink`); gedreht wartet er
    const pace = new InputPace();
    const blink = new Blink();
    const yaw = -155; // vor dem Südtor ganz zur Front gedreht
    const done: [number, Dir][] = [];
    let now = 0;
    const move = (dir: Dir) => {
      const go = () => done.push([now, dir]);
      if (!blink.ask(done.length ? 0 : yaw, now, go)) go(); // nach dem Blinzeln steht die Ansicht wieder bei 0°
    };
    const go = pace.press('n', 0);
    expect(go).toBe('n');
    move(go!);
    pace.release('n');
    for (now = 16; now < 1000; now += 16) {
      if (now === 96) {
        const tap = pace.press('e', now); // zweiter Tipp während des Blinzelns: wird im Takt gemerkt …
        pace.release('e');
        if (tap) move(tap);
      }
      blink.frame(now);
      const next = pace.poll(now);
      if (next) move(next); // … und verfällt, solange es blinzelt (wie ein zweiter gemerkter Tipp)
    }
    expect(done).toHaveLength(1);
    expect(done[0]![1]).toBe('n'); // derselbe Pfeil, nicht umgerechnet
    expect(done[0]![0]).toBeGreaterThanOrEqual(BLINK_MS);
    expect(done[0]![0]).toBeLessThan(BLINK_MS + 16);
    // danach läuft alles wie gewohnt: ein neuer Druck geht sofort
    expect(pace.press('n', 1000)).toBe('n');
  });

  it('nach dem Blinzeln läuft ein gehaltener Pfeil erst nach der Wartezeit weiter, nie schneller als im Takt', () => {
    // wie die Web Component: der verzögerte Schritt setzt den Takt zurück (`halt`), wie nach einem frischen Druck
    const pace = new InputPace();
    const blink = new Blink();
    const done: number[] = [];
    let [now, yaw] = [0, -155];
    const move = () => {
      const late = () => {
        pace.halt('pause', now); // nur der verzögerte Schritt
        done.push(now);
        yaw = 0; // geschnitten: die Ansicht steht wieder bei 0°
      };
      if (!blink.ask(yaw, now, late)) done.push(now);
    };
    if (pace.press('n', 0)) move(); // gehalten, nicht losgelassen
    for (now = 16; now < 2000; now += 16) {
      blink.frame(now);
      if (pace.poll(now)) move();
    }
    expect(done[0]).toBeGreaterThanOrEqual(BLINK_MS);
    expect(done[1]! - done[0]!).toBeGreaterThanOrEqual(HOLD_MS); // nicht gleich hinterher
    for (let i = 2; i < done.length; i++) expect(done[i]! - done[i - 1]!).toBeGreaterThanOrEqual(STEP_MS);
    expect(done.length).toBeGreaterThan(4); // und dann läuft sie gleichmäßig weiter
  });

  it('lastFresh: neuer Druck und gemerkter Tipp sind frisch, ein gehaltener Pfeil nicht (Einsteigen ins Fahrzeug)', () => {
    const pace = new InputPace();
    expect(pace.lastFresh).toBe(false);
    expect(pace.press('e', 0)).toBe('e'); // Tipp: sofort
    expect(pace.lastFresh).toBe(true);
    // gehalten: Nach der Wartezeit läuft die Figur weiter, aber nicht frisch
    const held = steps(pace, 16, HOLD_MS + STEP_MS);
    expect(held.length).toBeGreaterThan(0);
    expect(pace.lastFresh).toBe(false);
    pace.release('e');
    // gemerkter Tipp: kommt im Takt dran und zählt wie ein neuer Druck
    const at = held.at(-1)! + 16;
    expect(pace.press('w', at)).toBeNull();
    pace.release('w');
    expect(pace.poll(at + STEP_MS)).toBe('w');
    expect(pace.lastFresh).toBe(true);
    // kein Schritt: lastFresh bleibt beim zuletzt gelieferten
    expect(pace.poll(at + STEP_MS + 16)).toBeNull();
    expect(pace.lastFresh).toBe(true);
  });

  it('Fahrzeuge: nach dem Einsteigen erst nach neuem Druck weiter, kurz stehen nach Aussteigen und Fest, sonst nie', () => {
    const ride = (what: Extract<GameEvent, { type: 'ride' }>['what']): GameEvent => ({
      type: 'ride',
      what,
      id: 'schlitten',
      x: 0,
      y: 0,
    });
    expect(stops([ride('board')])).toBe('clear');
    expect(stops([{ type: 'step', climb: 0 }, ride('board')])).toBe('clear');
    for (const what of ['leave', 'alight', 'feast'] as const) expect(stops([ride(what)]), what).toBe('pause');
    for (const what of [
      'appear',
      'come',
      'snort',
      'nudge',
      'go',
      'wave',
      'stop',
      'shoo',
      'arrive',
      'cheer',
      'farewell',
    ] as const)
      expect(stops([ride(what)]), what).toBeNull();
    expect(stops([{ type: 'realm', to: 'eis' }])).toBeNull(); // Wechsel der Gegend unterwegs hält nicht an
    expect(ENCOUNTERS.has('ride')).toBe(false); // nur mit Unterart
  });

  it('Aktionen zählen höchstens im eigenen Takt', () => {
    const pace = new InputPace();
    expect(pace.action(0)).toBe(true);
    expect(pace.action(ACTION_MS - 1)).toBe(false);
    expect(pace.action(ACTION_MS)).toBe(true);
  });
});
