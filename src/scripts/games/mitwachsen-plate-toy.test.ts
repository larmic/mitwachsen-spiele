import { describe, expect, it } from 'vitest';
import type { GateId } from '../../data/games/mitwachsen';
import { plateMid } from './mitwachsen-plate';
import { plateToy } from './mitwachsen-plate-toy';
import { PLATE_TUNE, plateTones, plopp, type Scored } from './sfx';
import { view } from './worlds/eis/view-2d';
import { createWorld } from './mitwachsen-world';
import { worldOf } from './test-worlds';

describe('Spielzeug der Torplatte', () => {
  const w = worldOf(1);
  /** Feld u der Platte vor `id` (u null: eine Reihe davor, in der Bucht) und ob die Figur dort schläft */
  const at = (id: GateId, u: number | null, sleeping = false): [{ x: number; y: number }, boolean] => {
    const g = w.gates.get(id)!;
    const [mx, my] = plateMid(g);
    const along = [Math.abs(g.out[1]), Math.abs(g.out[0])];
    const [x, y] = u === null ? [mx - g.out[0], my - g.out[1]] : [mx + along[0]! * u, my + along[1]! * u];
    return [{ x: x + 0.3, y: y - 0.4 }, sleeping]; // der Körper gleitet noch: Es zählt das Feld, über dem er ist
  };
  const setup = () => {
    const played: Scored[][] = [];
    const glints: { x: number; y: number }[] = [];
    const play = plateToy({ score: (n) => void played.push([...n]) }, (p) => void glints.push(p));
    const toy = (
      world: typeof w,
      [cell, sleeping]: ReturnType<typeof at>,
      packs: Parameters<typeof play>[3],
      now: number,
    ) => play(world, cell, sleeping, packs, now);
    return { toy, played, glints };
  };

  it('drauf sinkt sie ein und klonkt mit dem ersten Ton, längs drüber nichts Neues, herunter springt sie hoch und ploppt', () => {
    const { toy, played } = setup();
    expect(toy(w, at('sand', null), [], 0)).toBeNull(); // eine neue Welt: nur merken
    expect(toy(w, at('sand', 0), [], 100)).toEqual({ id: 'sand', since: 100, on: true });
    expect(played).toEqual([plateTones('sand', 0)]);
    expect(toy(w, at('sand', 1), [], 360)).toEqual({ id: 'sand', since: 100, on: true }); // dieselbe Platte
    expect(toy(w, at('sand', null), [], 620)).toEqual({ id: 'sand', since: 620, on: false });
    expect(played).toEqual([plateTones('sand', 0), plopp('sand')]);
  });

  it('fünfmal rauf und runter spielt das Motiv, beim fünften glitzert die Platte über ihrer Mitte; dann von vorn', () => {
    const { toy, played, glints } = setup();
    toy(w, at('lava', null), [], 0);
    for (let n = 0; n < 2 * PLATE_TUNE.length; n++) {
      toy(w, at('lava', -1), [], 1000 * n);
      toy(w, at('lava', null), [], 1000 * n + 500);
    }
    const tune = played.filter((_, i) => i % 2 === 0).map((tones) => tones.at(-1)![0]);
    expect(tune).toEqual([...Array(10).keys()].map((n) => plateTones('lava', n).at(-1)![0]));
    const [mx, my] = plateMid(w.gates.get('lava')!);
    expect(glints).toEqual([
      { x: mx, y: my, z: 1 },
      { x: mx, y: my, z: 1 },
    ]);
  });

  it('Eis: Klirren aus dem Welt-Paket; ohne Paket das Klonk; eine andere Platte beginnt das Motiv neu', () => {
    const { toy, played } = setup();
    toy(w, at('eis', null), [], 0);
    toy(w, at('eis', 0), [{ id: 'eis', view }], 10);
    toy(w, at('eis', null), [], 20);
    toy(w, at('eis', 0), [], 30);
    toy(w, at('eis', null), [], 40);
    toy(w, at('wald', 0), [], 50);
    expect(played).toEqual([
      plateTones('eis', 0, view.clink),
      plopp('eis'),
      plateTones('eis', 1),
      plopp('eis'),
      plateTones('wald', 0),
    ]);
  });

  it('eine Welt öffnet mit der Figur auf der Platte: gleich eingesunken, ohne Ton; Einschlafen und Weltwechsel still', () => {
    const { toy, played } = setup();
    expect(toy(w, at('sand', 0), [], 5000)).toEqual({ id: 'sand', since: -Infinity, on: true });
    expect(toy(w, at('sand', 0, true), [], 5100)).toEqual({ id: 'sand', since: 5100, on: false }); // schläft: hoch
    expect(played).toEqual([]);
    toy(w, at('sand', null), [], 5300); // wach, vor der Platte (aufwachen kann sie nur am Bett)
    toy(w, at('sand', 0), [], 5400);
    expect(played).toEqual([plateTones('sand', 0)]); // dann wie immer, das Motiv von vorn
    const other = createWorld(1, []); // dieselbe Welt ohne Paket (wie vor dem Ankommen der Eis-Welt): neu, still
    expect(toy(other, at('sand', null), [], 5500)).toBeNull();
    expect(played).toHaveLength(1);
  });
});
