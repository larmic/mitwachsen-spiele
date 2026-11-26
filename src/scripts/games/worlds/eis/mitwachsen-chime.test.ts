import { describe, expect, it } from 'vitest';
import type { Dir } from '../../../../lib/games/front';
import { initialState, progressOf, step, type GameEvent, type State } from '../../mitwachsen-state';
import { kesselPlace } from '../../mitwachsen-world';
import { ENCOUNTERS, stops } from '../../input-pace';
import { reshapes } from '../../mitwachsen-chores';
import { fly, glints } from '../../mitwachsen-glyphs';
import { EIS_PACK, PACKS, worldOf } from '../../test-worlds';
import { CHIME, LIP, chimes, lipOf } from './mitwachsen-chime';
import { SCALE, chimeBoxes, chimeScore, ring, since, swing } from './mitwachsen-chime-look';
import { view3d } from './view-3d';
import type { Cell } from '../../mitwachsen-cell';

/** Die Eiszapfen im Tal eines Seeds, von West nach Ost */
const rowOf = (seed: number) =>
  kesselPlace(seed, EIS_PACK)
    .cells.filter(([x, y]) => worldOf(seed).cell(x, y).deco === 'icicle')
    .sort((a, b) => a[0] - b[0]);
// zwei Täler mit der Reihe an einer niedrigen Hügelstufe (1, 9), zwei am Rand (3, 6); jede Welt zu bauen kostet Zeit
const SEEDS = [1, 3, 6, 9];
const world = worldOf(1);
const ROW = rowOf(1);
const [WX, WY] = ROW[0]!;

/** Wach, Eistor offen, die Figur steht an (x, y) */
function at(x: number, y: number, dir: Dir = 'e'): State {
  const s = initialState(world, { openGates: ['eis'] });
  return { ...s, sleeping: false, wokeAt: -100, player: { x, y, dir }, animals: [] };
}
/** Pfeil in Richtung `dir` mit den Regeln aus den Paketen */
const walk = (s: State, dir: Dir) => step(s, world, { type: 'move', dir }, undefined, undefined, PACKS);
const chimed = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: 'icicle' }> => e.type === 'icicle');

describe('Eiszapfen-Glockenspiel (Eis-Welt): Lage', () => {
  it('jedes Tal hat eine Reihe von fünf bis sieben Zapfen nebeneinander, Töne von West (tief) nach Ost', () => {
    for (const seed of SEEDS) {
      const row = rowOf(seed);
      const w = worldOf(seed);
      expect(row.length, `Seed ${seed}`).toBeGreaterThanOrEqual(CHIME.least);
      expect(row.length, `Seed ${seed}`).toBeLessThanOrEqual(CHIME.most);
      row.forEach(([x, y], i) => {
        expect([x, y]).toEqual([row[0]![0] + i, row[0]![1]]); // eine Reihe, ohne Lücke
        expect(w.cell(x, y).note).toBe(i);
      });
    }
  });

  it('am Fuß einer Klippe: dahinter höher, gleich hohe Eiskante, davor ebener, begehbarer Boden', () => {
    for (const seed of SEEDS) {
      const w = worldOf(seed);
      const row = rowOf(seed);
      const lips = new Set(row.map(([x, y]) => lipOf(w.cell(x, y - 1), w.cell(x, y))));
      expect(lips.size, `Seed ${seed}`).toBe(1);
      for (const [x, y] of row) {
        const c = w.cell(x, y);
        const back = w.cell(x, y - 1);
        expect(back.h).toBeGreaterThan(c.h);
        if (back.solid) expect(back.region, `Seed ${seed}: kein Zapfen unter einer Tanne`).toBe('border');
        expect(lipOf(w.cell(x, y - 1), c)).toBeLessThanOrEqual(LIP);
        const front = w.cell(x, y + 1);
        expect(front.solid || front.ground === 'water').toBe(false);
        expect(front.h).toBe(c.h);
        expect(c.h).toBe(w.cell(row[0]![0], row[0]![1]).h);
      }
    }
  });

  it('nie auf Spur, Plattform, Wiese, Weg oder Wasser; begehbar und vom Schneebett aus erreichbar', () => {
    for (const seed of SEEDS) {
      const w = worldOf(seed);
      const spots = new Set(w.spotsOf('eis').map(([x, y]) => `${x},${y}`));
      for (const [x, y] of rowOf(seed)) {
        const c = w.cell(x, y);
        expect(c.region).toBe('eis');
        expect(c.ground).toBe('snow');
        expect(c.solid).toBe(false);
        expect(c.slide || c.portal || c.garden).toBeFalsy();
        expect(spots.has(`${x},${y}`), `Seed ${seed}: ${x},${y}`).toBe(true);
      }
    }
  });

  it('lieber am Rand des Tals (dahinter die Eisklippe), dann an einer hohen, zuletzt an einer niedrigen Hügelstufe', () => {
    const snow = (h: number, region: Cell['region'] = 'eis'): Cell => ({
      h,
      ground: 'snow',
      deco: null,
      region,
      solid: region === 'border',
      biome: 'eis',
    });
    /** Je ein Lauf von sechs Feldern auf Höhe 1 vor jeder Wand: `border` die Eisklippe, sonst eine Stufe so hoch */
    const pick = (walls: readonly ('border' | number)[]) => {
      const map = new Map<string, Cell>();
      const wild: { x: number; y: number }[] = [];
      walls.forEach((wall, i) => {
        const y = 1 + 3 * i;
        for (let x = 0; x < 6; x++) {
          map.set(`${x},${y - 1}`, wall === 'border' ? snow(5, 'border') : snow(1 + wall));
          map.set(`${x},${y}`, snow(1));
          map.set(`${x},${y + 1}`, snow(1));
          wild.push({ x, y });
        }
      });
      const row = chimes(7, wild, map);
      return walls[(row[0]![1] - 1) / 3];
    };
    expect(pick([1, 2, 'border'])).toBe('border');
    expect(pick(['border', 1])).toBe('border');
    expect(pick([1, 2])).toBe(2);
    expect(pick([2, 1])).toBe(2);
    expect(pick([1])).toBe(1); // sonst hinge in gut einem Drittel der Täler kein Glockenspiel
    // in den echten Tälern: am Rand, wo dort ein Lauf ist
    for (const seed of [3, 6])
      expect(rowOf(seed).every(([x, y]) => worldOf(seed).cell(x, y - 1).region === 'border')).toBe(true);
  });

  it('nur auf blankem Schnee und nur dort, wo ein Lauf lang genug ist; sonst kein Glockenspiel', () => {
    const snow = (h: number, extra: Partial<Cell> = {}): Cell => ({
      h,
      ground: 'snow',
      deco: null,
      region: 'eis',
      solid: false,
      biome: 'eis',
      ...extra,
    });
    const build = (n: number, extra: Partial<Cell> = {}) => {
      const map = new Map<string, Cell>();
      const wild = [];
      for (let x = 0; x < 9; x++) {
        map.set(`${x},0`, snow(3)); // Klippe dahinter
        map.set(`${x},1`, x < n ? snow(1, extra) : snow(2));
        map.set(`${x},2`, snow(1));
        wild.push({ x, y: 1 });
      }
      return { map, row: chimes(1, wild, map) };
    };
    expect(build(4).row).toEqual([]);
    expect(build(9).row).toHaveLength(CHIME.most); // die Mitte eines langen Laufs
    expect(build(9).row[0]).toEqual([1, 1]);
    expect(build(6, { slide: true }).row).toEqual([]);
    expect(build(6, { deco: 'crystal', solid: true }).row).toEqual([]);
    const { map, row } = build(6);
    expect(row).toHaveLength(6);
    expect(map.get('0,2')!.deco).toBeNull(); // davor bleibt alles, wie es war
  });
});

describe('Eiszapfen-Glockenspiel (Eis-Welt): Regel', () => {
  it('die Reihe entlang spielt eine Tonfolge, je Zapfen sein Ton, und die Figur läuft ohne Halt weiter', () => {
    let s = at(WX - 1, WY);
    const notes: number[] = [];
    for (const [x, y] of ROW) {
      const r = walk(s, 'e');
      s = r.state;
      expect([s.player.x, s.player.y]).toEqual([x, y]); // sie steht jetzt auf dem Feld des Zapfens
      expect(stops(r.events)).toBeNull(); // kein Halt
      expect(r.events.some((e) => e.type === 'step')).toBe(true);
      notes.push(...chimed(r.events).map((e) => e.note));
    }
    expect(notes).toEqual(ROW.map((_, i) => i));
    // zurück spielt sie die Tonfolge rückwärts
    const back: number[] = [];
    for (let i = 1; i < ROW.length; i++) {
      const r = walk(s, 'w');
      s = r.state;
      back.push(...chimed(r.events).map((e) => e.note));
    }
    expect(back).toEqual(ROW.slice(0, -1).map((_, i) => ROW.length - 2 - i));
  });

  it('dagegenlaufen von vorn klingt seinen Ton; wer vom Zapfen weggeht, hört nichts', () => {
    ROW.forEach(([x, y], note) => {
      const r = walk(at(x, y + 1, 'n'), 'n');
      expect(chimed(r.events)).toEqual([{ type: 'icicle', x, y, note }]);
      expect([r.state.player.x, r.state.player.y]).toEqual([x, y]);
      expect(chimed(walk(r.state, 's').events)).toEqual([]);
    });
  });

  it('gegen die Wand drücken läutet erneut, statt anzustoßen; hinauf durch die Zapfen geht es nie', () => {
    ROW.forEach(([x, y], note) => {
      let s = at(x, y, 'n');
      for (let i = 0; i < 3; i++) {
        const r = walk(s, 'n');
        s = r.state;
        expect(chimed(r.events)).toEqual([{ type: 'icicle', x, y, note }]);
        expect(r.events.some((e) => e.type === 'bump' || e.type === 'step')).toBe(false);
        expect(stops(r.events)).toBeNull(); // kein Halt: gehalten klingt er im Takt der Schritte
        expect([s.player.x, s.player.y]).toEqual([x, y]);
      }
    });
  });

  it('von oben durch die Zapfen herunter geht es nicht: er klingt, die Figur bleibt oben', () => {
    // Seed 1: die Reihe hängt an einer niedrigen Hügelstufe, oben kann man stehen
    ROW.forEach(([x, y], note) => {
      const r = walk(at(x, y - 1, 's'), 's');
      expect(chimed(r.events)).toEqual([{ type: 'icicle', x, y, note }]);
      expect([r.state.player.x, r.state.player.y]).toEqual([x, y - 1]);
    });
  });

  it('geht der Schritt aufs Feld eines Zapfens nicht, klingt nichts: die Figur stößt nur an', () => {
    const [x, y] = ROW[0]!;
    const high = {
      ...world,
      cell: (cx: number, cy: number) => {
        const c = world.cell(cx, cy);
        return cx === x - 1 && cy === y ? { ...c, h: c.h - 2 } : c; // links davor zwei tiefer: hinauf geht es nicht
      },
    };
    const s = at(x - 1, y);
    const r = step(s, high, { type: 'move', dir: 'e' }, undefined, undefined, PACKS);
    expect(chimed(r.events)).toEqual([]);
    expect(r.events.map((e) => e.type)).toEqual(['bump']);
  });

  it('kein Spielstand außer „gefunden“: Zustand der Pakete und alles Gespeicherte bleiben; nur das Hinführen merkt sich den ersten Ton (Issue 28)', () => {
    // der erste Besuch des Tals ist schon gemerkt (`gast`, mitwachsen-cat.ts): Die Zapfen ändern daran nichts
    const s: State = { ...at(WX - 1, WY), packs: { eis: { v: 1, snow: {}, gast: 1 } } };
    let t = s;
    for (let i = 0; i < ROW.length; i++) t = walk(t, 'e').state;
    expect(t.packs).toBe(s.packs);
    expect({ ...progressOf(t), position: null }).toEqual({
      ...progressOf(s),
      position: null,
      found: ['eis:glockenspiel'],
    });
  });

  it('kein Halt, kein Neubau in 3D: `icicle` ist keine Begegnung und ändert kein Feld', () => {
    expect(ENCOUNTERS.has('icicle')).toBe(false);
    expect(
      stops([
        { type: 'icicle', x: 0, y: 0, note: 0 },
        { type: 'step', climb: 0 },
      ]),
    ).toBeNull();
    expect(reshapes({ type: 'icicle' })).toBe(false);
  });

  it('ohne die Regeln des Pakets ist ein Zapfen nur Schnee: kein Ton, die Figur läuft', () => {
    const r = step(at(WX - 1, WY), world, { type: 'move', dir: 'e' });
    expect(chimed(r.events)).toEqual([]);
    expect([r.state.player.x, r.state.player.y]).toEqual([WX, WY]);
  });

  it('Schneehaufen und andere Felder klingen nicht', () => {
    const cells = kesselPlace(1, EIS_PACK).cells.filter(([x, y]) => {
      const c = world.cell(x, y);
      return c.deco !== 'icicle' && !world.cell(x, y + 1).solid;
    });
    for (const [x, y] of cells.slice(0, 300)) expect(chimed(walk(at(x, y + 1, 'n'), 'n').events)).toEqual([]);
  });
});

describe('Eiszapfen-Glockenspiel (Eis-Welt): Bild und Klang', () => {
  it('Pentatonik von tief nach hoch, sanft, kein falscher Ton', () => {
    const freq = (note: number) => chimeScore({ type: 'icicle', x: 0, y: 0, note })[0]![0];
    const tones = SCALE.map((_, i) => freq(i));
    expect(tones).toEqual([...SCALE]);
    for (let i = 1; i < tones.length; i++) expect(tones[i]!).toBeGreaterThan(tones[i - 1]!);
    // fünf Töne je Oktave: C D E G A
    const steps = SCALE.map((f) => Math.round(12 * Math.log2(f / SCALE[0])) % 12);
    for (const s of steps) expect([0, 2, 4, 7, 9]).toContain(s);
    // außerhalb der Tonleiter der nächste Rand, kein falscher Ton
    expect(freq(-3)).toBe(SCALE[0]);
    expect(freq(40)).toBe(SCALE[SCALE.length - 1]);
    for (const [, len, , gain] of chimeScore({ type: 'icicle', x: 0, y: 0, note: 3 })) {
      expect(gain).toBeLessThanOrEqual(0.08);
      expect(len).toBeLessThan(1);
    }
  });

  it('je tiefer der Ton, desto länger der Zapfen; alles hinten im eigenen Feld', () => {
    const tip = (note: number) => {
      const [x, y] = ROW[note]!;
      return Math.min(...chimeBoxes(world, world.cell(x, y), x, y).map((b) => b[2]));
    };
    for (let i = 1; i < ROW.length; i++) expect(tip(i)).toBeGreaterThan(tip(i - 1));
    for (const [x, y] of ROW)
      for (const b of chimeBoxes(world, world.cell(x, y), x, y, 0.1)) {
        expect(b[1]).toBeGreaterThanOrEqual(y);
        expect(b[1] + b[4]).toBeLessThanOrEqual(y + 0.3); // die Figur läuft davor
        expect(b[2]).toBeGreaterThan(world.cell(x, y).h); // er hängt, berührt den Boden nicht
      }
  });

  it('schwingt nach dem Anschlagen kurz, dann hängt er still; bei reduzierter Bewegung und in 3D nie', () => {
    expect(swing(-1)).toBe(0);
    expect(Math.abs(swing(120))).toBeGreaterThan(0);
    expect(swing(700)).toBe(0);
    const draw = EIS_PACK.view!.decos.icicle!;
    const c = world.cell(WX, WY);
    const still = chimeBoxes(world, c, WX, WY);
    const frame = (now: number, reduced: boolean) => ({ now, reduced, picked: {}, packs: {} });
    expect(since(WX, WY, 5000)).toBe(Infinity); // nie angeschlagen
    expect(draw(world, c, WX, WY, frame(5000, false))).toEqual(still);
    ring(WX, WY, 5000);
    expect(draw(world, c, WX, WY, frame(5120, false))).not.toEqual(still);
    expect(draw(world, c, WX, WY, frame(5120, true))).toEqual(still);
    expect(draw(world, c, WX, WY, frame(6000, false))).toEqual(still);
    expect(view3d.decos.icicle!(world, c, WX, WY, frame(5120, false))).toEqual(still);
  });

  it('der Ton kommt aus dem Paket, und ab dann schwingt der Zapfen in 2D', () => {
    const [x, y] = ROW[2]!;
    const notes = EIS_PACK.view!.score!({ type: 'icicle', x, y, note: 2 })!;
    expect(notes[0]![0]).toBe(SCALE[2]);
    expect(since(x, y, performance.now())).toBeLessThan(100);
  });

  it('Glitzern: fliegt kurz auseinander, bei reduzierter Bewegung blitzt es still an seinem Platz', () => {
    const moving = glints([100, 100], ['#fff'], 1, false);
    const still = glints([100, 100], ['#fff'], 1, true);
    expect(moving.length).toBeGreaterThan(0);
    const pos = (ps: readonly { x: number; y: number }[]) => ps.map((p) => [p.x, p.y]);
    const before = pos(still);
    expect(pos(fly(still, 0.1))).toEqual(before);
    const m0 = pos(moving);
    expect(pos(fly(moving, 0.1))).not.toEqual(m0);
    expect(fly(still, 1)).toEqual([]); // nach kurzer Zeit verloschen
  });
});
