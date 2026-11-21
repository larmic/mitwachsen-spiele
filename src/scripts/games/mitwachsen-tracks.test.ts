import { describe, expect, it } from 'vitest';
import {
  MAX_PARTS,
  TRACKS_CAP,
  TRACKS_LIFE,
  Tracks,
  fade,
  marks,
  printOf,
  type Print,
  type PrintKind,
} from './mitwachsen-tracks';

const KINDS: PrintKind[] = ['stiefel', 'dreizack', 'tatze', 'huf', 'hoppel', 'trippel', 'schleif', 'kralle'];
const at = (kind: PrintKind, dir: Print['dir'] = 'n', x = 4, y = 6): Print => ({ x, y, dir, kind, born: 0 });

describe('Spuren am Boden (Ringpuffer, nur Bild)', () => {
  it('Obergrenze: höchstens cap Abdrücke, der älteste weicht dem neuen; die neuesten zuerst', () => {
    const t = new Tracks(5, 100);
    for (let i = 0; i < 8; i++) {
      t.add(i, 0, 'e', 'stiefel');
      t.pass(1);
    }
    // 3 weicht als nächster und ist darum schon verweht
    expect(t.live(false).map(([p]) => p.x)).toEqual([7, 6, 5, 4]);
    expect(new Tracks().cap).toBe(TRACKS_CAP);
    expect(MAX_PARTS).toBe(8); // Tatze: Ballen und drei Zehen, je Fuß
  });

  it('mit einer Kette von Folgern: nie mehr als zwei deutliche Abdrücke je Feld, nichts verschwindet schlagartig', () => {
    const t = new Tracks();
    const kinds: PrintKind[] = ['stiefel', 'dreizack', 'tatze', 'huf'];
    // die Figur geht mit drei Folgern eine lange Strecke, gut vier Schritte je Sekunde; ringsum laufen
    // zwölf Tiere, je etwa einen Schritt je Sekunde: mehr, als der Puffer über die ganze Lebensdauer hält
    let before = new Map<Print, number>();
    let other = 0;
    for (let step = 0; step < 600; step++) {
      for (const k of kinds) t.add(step, 0, 'e', k);
      for (let i = 0; i < 3; i++) t.add(other++ % 900, 10 + i, 'e', 'tatze');
      t.pass(0.24);
      const now = new Map(t.live(false));
      for (const [p, a] of before) {
        if (!now.has(p)) expect(a, 'weicht erst, wenn er schon (fast) verweht ist').toBeLessThan(0.05);
        else expect(now.get(p), 'wird blasser, nie in einem Sprung').toBeGreaterThan(a - 0.05);
      }
      before = now;
    }
    const field = [...before.keys()].filter((p) => p.y === 0 && p.x === 590);
    expect(field.map((p) => p.kind)).toEqual(['dreizack', 'stiefel']); // die Folger dahinter treten hinein
  });

  it('verweht mit der Zeit: erst ganz deutlich, dann blasser, nach `life` Sekunden weg', () => {
    const t = new Tracks(10, TRACKS_LIFE);
    t.add(1, 1, 'n', 'tatze');
    const seen = () => t.live(false)[0]?.[1] ?? 0;
    expect(seen()).toBe(1);
    t.pass(TRACKS_LIFE * 0.4);
    expect(seen()).toBe(1);
    t.pass(TRACKS_LIFE * 0.35);
    expect(seen()).toBeGreaterThan(0);
    expect(seen()).toBeLessThan(1);
    t.pass(TRACKS_LIFE * 0.3);
    expect(t.live(false)).toEqual([]);
    t.pass(-5); // die Zeit läuft nie rückwärts
    expect(t.live(false)).toEqual([]);
  });

  it('beim Pustewind und bei Schneefall verweht es schneller', () => {
    const left = (wind: number, snow: number) => {
      const t = new Tracks(10, 40);
      t.add(0, 0, 's', 'huf');
      t.pass(25, wind, snow);
      return t.live(false)[0]?.[1] ?? 0;
    };
    const calm = left(0, 0);
    expect(calm).toBeGreaterThan(0);
    expect(left(0.5, 0)).toBeLessThan(calm);
    expect(left(1, 0)).toBe(0); // viermal so schnell: nach 25 s längst verweht
    expect(left(0, 1)).toBeLessThan(calm);
  });

  it('bei reduzierter Bewegung kein Ausblenden: ein Abdruck verschwindet in Stufen', () => {
    const steps = new Set<number>();
    for (let age = 0; age < 40; age += 0.5) steps.add(fade(age, 40, true));
    expect([...steps].sort()).toEqual([1 / 3, 2 / 3, 1]);
    expect(fade(40, 40, true)).toBe(0);
    expect(fade(30, 40, false)).toBeCloseTo(0.5);
  });

  it('Abdruck je Gangart: Pinguin-Dreizack, Robbenspur, Hoppeln, Trippeln, Krallen, sonst Tatzen oder Hufe', () => {
    expect(printOf('watscheln')).toBe('dreizack');
    expect(printOf('robben')).toBe('schleif');
    expect(printOf('huepfen')).toBe('hoppel');
    expect(printOf('huschen')).toBe('trippel');
    expect(printOf('flattern')).toBe('kralle');
    expect(printOf(undefined)).toBe('tatze');
    expect(printOf(undefined, true)).toBe('huf');
    // jede Form sieht anders aus
    const shapes = KINDS.map((k) => JSON.stringify(marks(at(k))));
    expect(new Set(shapes).size).toBe(KINDS.length);
  });

  it('jeder Abdruck bleibt klein in seinem Feld, mit Lücken: nie ein Weg', () => {
    for (const kind of KINDS)
      for (const dir of ['n', 's', 'e', 'w'] as const) {
        const ms = marks(at(kind, dir));
        let area = 0;
        for (const [x, y, w, d] of ms) {
          expect(x, `${kind} ${dir}`).toBeGreaterThanOrEqual(4);
          expect(y, `${kind} ${dir}`).toBeGreaterThanOrEqual(6);
          expect(x + w, `${kind} ${dir}`).toBeLessThanOrEqual(5);
          expect(y + d, `${kind} ${dir}`).toBeLessThanOrEqual(7);
          area += w * d;
        }
        expect(area, kind).toBeLessThan(0.12); // höchstens ein Achtel des Felds
        // längs der Richtung reicht kein Abdruck von Kante zu Kante
        const along = dir === 'n' || dir === 's' ? ms.map(([, , , d]) => d) : ms.map(([, , w]) => w);
        expect(Math.max(...along), kind).toBeLessThanOrEqual(0.5);
      }
  });

  it('dreht sich mit der Richtung und wechselt links und rechts von Feld zu Feld', () => {
    const [n] = marks(at('stiefel', 'n'));
    const [e] = marks(at('stiefel', 'e'));
    expect([n![2], n![3]]).toEqual([e![3], e![2]]); // quer und längs getauscht
    const [a] = marks(at('stiefel', 'n', 4, 6));
    const [b] = marks(at('stiefel', 'n', 4, 7));
    expect(a![0] - 4).not.toBeCloseTo(b![0] - 4); // gespiegelt
  });

  it('clear vergisst alles', () => {
    const t = new Tracks(3, 10);
    t.add(0, 0, 'n', 'kralle');
    t.clear();
    expect(t.live(true)).toEqual([]);
    expect(t.add(1, 0, 'n', 'kralle')).toBe(true);
    expect(t.live(true)).toHaveLength(1);
  });
});
