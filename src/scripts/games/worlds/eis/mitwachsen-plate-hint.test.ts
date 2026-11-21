// „Noch nicht“ am Eistor in der Ansicht (Haken `View2D.hint` des Welt-Pakets): je Bild gefragt, gegen die echte Welt.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HINT_AFTER, HINT_EVERY } from '../../mitwachsen-guide';
import { notYet } from '../../mitwachsen-hint-look';
import { plateMid } from '../../mitwachsen-plate';
import { initialState, type State } from '../../mitwachsen-state';
import type { Scored } from '../../sfx';
import { worldOf } from '../../test-worlds';
import { plateHint } from './mitwachsen-plate-hint';
import { view } from './view-2d';

describe('„Noch nicht“ am Eistor in der Ansicht', () => {
  const w = worldOf(1);
  const [x, y] = plateMid(w.gates.get('eis')!);
  const base = initialState(w, {});
  /** Wache Figur ohne Tiere auf (px, py), Takt `tick`, steht seit `still` Takten */
  const at = (tick: number, still: number, [px, py] = [x, y]): State => ({
    ...base,
    sleeping: false,
    animals: [],
    player: { x: px, y: py, dir: 'n' },
    tick,
    still,
  });
  function setup(reduced = false) {
    vi.useFakeTimers();
    const played: Scored[][] = [];
    let peeks = 0;
    const say = { textContent: 'alt' };
    vi.stubGlobal('document', { querySelector: () => say }); // Live-Region des Spiels
    const show = plateHint();
    const sfx = { score: (n: readonly Scored[]) => void played.push([...n]) };
    const ask = (s: State, now: number) => show(s, w, now, reduced, sfx, () => peeks++);
    return { ask, played, say, peeks: () => peeks };
  }
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hängt am Welt-Paket der Eis-Welt', () => {
    expect(typeof view.hint).toBe('function');
  });

  it('das Bild kommt schon beim Betreten; dann einmal Nebel, Ton, Live-Region und Umriss im selben Bild', async () => {
    const { ask, played, say, peeks } = setup();
    // noch keine Sekunde gestanden: nichts (kein Tor, kein Zeitpunkt, keine Zeichnung), aber das Bild wird geholt
    const none = ask(at(100, HINT_AFTER - 1), 5000);
    expect([none.id, none.at, none.draw, played.length, peeks(), say.textContent]).toEqual([
      undefined,
      undefined,
      undefined,
      0,
      0,
      'alt',
    ]);
    await vi.dynamicImportSettled();
    // nach 1 s: sofort alles zugleich, in vielen Bildern desselben Zustands nur einmal
    const s = at(101, HINT_AFTER);
    const first = ask(s, 6000);
    expect(first).toMatchObject({ id: 'eis', at: 6000 });
    expect(typeof first.draw).toBe('function');
    expect([played, peeks()]).toEqual([[notYet('eis')], 1]);
    for (let i = 1; i < 5; i++) expect(ask(s, 6000 + i * 16)).toBe(first);
    expect([played.length, peeks()]).toEqual([1, 1]);
    vi.advanceTimersByTime(150);
    expect(say.textContent).toBe('Noch nicht. Es fehlt noch: Hase');
    // nach 5 s wieder (neues Stehen), gleich danach nicht
    expect(ask(at(101 + HINT_EVERY, 3 * HINT_AFTER), 11000).at).toBe(11000);
    expect(ask(at(101 + HINT_EVERY + 1, 3 * HINT_AFTER), 11100).at).toBe(11000);
    expect([played.length, peeks()]).toEqual([2, 2]);
    // eine andere Welt öffnet (ihr Takt beginnt bei 0): Dort zeigt das Tor es wieder, ohne erst aufzuholen
    expect(ask(at(HINT_AFTER, HINT_AFTER), 12000).at).toBe(12000);
    expect([played.length, peeks()]).toEqual([3, 3]);
  });

  it('kommt das Bild erst später, beginnt alles zusammen, sobald es da ist; neben der Platte kommt nichts nach', async () => {
    const { ask, played, peeks } = setup(true);
    // gleich nach 1 s gefragt, das Bild ist noch unterwegs: noch nichts, auch kein Wackeln
    expect(ask(at(200, HINT_AFTER), 1000).at).toBeUndefined();
    await vi.dynamicImportSettled();
    const late = ask(at(201, HINT_AFTER + 1), 1300);
    expect([late.at, peeks()]).toEqual([1300, 1]);
    // reduzierte Bewegung: ohne Klappern des Riegels (die Tür wackelt nicht)
    expect(played).toEqual([notYet('eis', true)]);

    // neben der Platte stehen: nichts, und was noch ausstand, verfällt
    const other = setup();
    expect(other.ask(at(300, HINT_AFTER), 2000).at).toBeUndefined();
    other.ask(at(301, 0, [x + 9, y + 9]), 2100);
    await vi.dynamicImportSettled();
    expect(other.ask(at(320, HINT_AFTER - 1), 4000).at).toBeUndefined();
    expect([other.played.length, other.peeks()]).toEqual([0, 0]);
  });
});
