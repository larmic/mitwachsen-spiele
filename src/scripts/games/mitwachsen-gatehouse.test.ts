import { describe, expect, it } from 'vitest';
import { Color, type BufferGeometry } from 'three';
import { GATES, THEME_COLORS } from '../../data/games/mitwachsen';
import { col } from './mitwachsen-geo';
import { DIP, plateParts } from './mitwachsen-plate-3d';
import { PLATE_LEN, PLATE_STONE, PLATE_VOX, SINK, plateSink, plateVoxel } from './mitwachsen-plate';
import { parts, platformParts, platformSets } from './mitwachsen-gatehouse';
import { gate as gatehouse, motion, moves, plate } from './mitwachsen-gates-3d';
import { BEATS, type Vox } from './mitwachsen-gate-kit';
import { gateLook, iceGlow, icicle } from './worlds/eis/view-3d-gate';
import { GLOW, GOLD, LOOKS, PALETTE } from '../../data/games/mitwachsen-portals';
import { plateSign } from './mitwachsen-platform-2d';
import {
  GUEST_COLORS,
  GUEST_FILLED,
  GUEST_OUTLINE,
  PULSE_MS,
  guestPixel,
  plateGold,
  PRE_FILL,
  PRE_SPAN,
  ritualGlow,
} from './mitwachsen-guest-look';
import { RITUAL } from './mitwachsen-guide';
import { bounds, checkPlate, fighting } from './test-plates';
import { sandGate } from './mitwachsen-gate-sand';
import { pilzVox } from './mitwachsen-gate-pilze';
import { voxels as wolkenVox } from './mitwachsen-gate-wolken';

/**
 * Ein Torhaus samt Türflügeln, so wie die 3D-Ansicht sie aufstellt: jeder Flügel um seine Angel gedreht. Liefert die
 * Teile des Hauses, die Flügel und ihre Geometrie an ihrem Platz. Halb offen stehen die Flügel schräg: Dann vergleicht
 * der Test jeden Flügel für sich (ungedreht) und das Haus ohne sie, denn schräge Flächen liegen nie in einer Ebene mit
 * achsenparallelen (und ihre Ränder taugen nicht für den Vergleich in `fighting`).
 */
function house(
  theme: (typeof GATES)[number]['id'],
  open: number,
  outline: boolean,
  lit = 0,
  packed = true,
  all = false,
) {
  const p = parts();
  const look = packed && theme === 'eis' ? gateLook : undefined; // Tür und Eiszapfen aus dem Welt-Paket
  const wings = gatehouse(p, theme, open, outline, lit, [0, 1], look, all);
  const placed = wings.flatMap((w, i) =>
    Object.entries(w.parts).flatMap(([name, geo]): [string, BufferGeometry][] =>
      geo.empty ? [] : [[`Flügel ${i} ${name}`, geo.build().rotateY(w.angle).translate(w.hinge[0], 0, w.hinge[1])]],
    ),
  );
  return { p, wings, placed };
}
describe('Torhäuser und Portal-Plattformen flackern nicht', () => {
  for (const g of GATES) {
    it(`${g.id}: keine zwei Flächen liegen deckungsgleich in einer Ebene (Tür zu, halb und ganz offen)`, () => {
      for (const open of [0, 0.5, 1]) {
        const { p, wings, placed } = house(g.id, open, false);
        expect(fighting(p, open === 0.5 ? [] : placed), `offen ${open}`).toEqual([]);
        for (const w of wings) expect(fighting(w.parts), `Flügel bei ${open}`).toEqual([]); // jeder Flügel für sich
      }
    });
    if (moves(g.id))
      it(`${g.id}: bewegte Teile in jedem Takt ebenso, auch zusammen mit dem festen Raster`, () => {
        for (const open of [0, 0.5, 1])
          for (let beat = 0; beat < BEATS; beat++) {
            const { p } = house(g.id, open, false);
            const m = parts();
            motion(m, g.id, beat, open);
            const moving = Object.entries(m).flatMap(([name, geo]): [string, BufferGeometry][] =>
              geo.empty ? [] : [[`Takt ${name}`, geo.build()]],
            );
            expect(fighting(p, moving), `offen ${open}, Takt ${beat}`).toEqual([]);
          }
      });
    it(`${g.id}: mit Umriss des Pinguins und goldener Bucht ebenso, auch wenn er sich füllt und die Eiszapfen leuchten`, () => {
      for (const open of [0, 0.5, 1])
        for (const lit of [0, 0.5, 1]) {
          const { p, wings, placed } = house(g.id, open, true, lit);
          expect(fighting(p, open === 0.5 ? [] : placed), `offen ${open}, leuchtet ${lit}`).toEqual([]);
          for (const w of wings) expect(fighting(w.parts), `Flügel bei ${open}, leuchtet ${lit}`).toEqual([]);
        }
    });
    it(`${g.id}: zur Front gebaut (Figur in der Bucht, cam [0, 1], alle Flächen) ebenso, auch die bewegten Teile`, () => {
      // so baut die 3D-Ansicht den Zugang vor der Platte in jeder Lage (N, O, S, W): Die Kamera dreht zur Front
      for (const open of [0, 0.5, 1]) {
        const { p, wings, placed } = house(g.id, open, g.id === 'eis', 0, true, true);
        expect(fighting(p, open === 0.5 ? [] : placed), `offen ${open}`).toEqual([]);
        for (const w of wings) expect(fighting(w.parts), `Flügel bei ${open}`).toEqual([]);
        if (!moves(g.id)) continue;
        for (let beat = 0; beat < BEATS; beat += 5) {
          const m = parts();
          motion(m, g.id, beat, open, [0, 1], true);
          const moving = Object.entries(m).flatMap(([name, geo]): [string, BufferGeometry][] =>
            geo.empty ? [] : [[`Takt ${name}`, geo.build()]],
          );
          expect(fighting(p, moving), `offen ${open}, Takt ${beat}`).toEqual([]);
        }
      }
    });
    it(`${g.id}: Portal-Plattform in jedem Zustand ebenso (am Tor und am Bett)`, () => {
      for (const side of ['gate', 'home'] as const) {
        const sets = platformSets(g.id, side);
        const asleep = parts();
        platformParts(asleep, sets.asleep);
        expect(fighting(asleep), `${side} schlafend`).toEqual([]);
        // bereit: Gold um die Mitte; angekommen: goldene Pfeile in den Seitenfeldern
        for (const ready of [true, false]) {
          const p = parts();
          platformParts(p, sets.body, sets.awake);
          platformParts(p, sets.picture, sets.awake);
          platformParts(p, ready ? sets.frameGold : sets.frameOff, sets.awake);
          platformParts(p, ready ? sets.accessOff : sets.accessGold, sets.awake);
          expect(fighting(p), side).toEqual([]);
        }
      }
    });
  }

  it('Türflügel: zu ganz geschlossen (kein Spalt zum Rahmen, ungedreht), offen quer im Gang und frei vom Mauerwerk', () => {
    const closed = house('eis', 0, false);
    expect(closed.wings.map((w) => Math.abs(w.angle))).toEqual([0, 0]);
    const [[x0, x1], , [z0, z1]] = bounds(closed.placed.map(([, g]) => g));
    expect([x0, x1, z0, z1].map((v) => +v.toFixed(2))).toEqual([-2.45, 2.45, -0.9, -0.21]); // wie die Tür bisher
    const open = house('eis', 1, false);
    for (const [i, w] of open.wings.entries()) {
      const [[a, b], , [c, d]] = bounds(open.placed.filter(([n]) => n.startsWith(`Flügel ${i}`)).map(([, g]) => g));
      expect(Math.min(Math.abs(a), Math.abs(b))).toBeGreaterThan(1.7); // am Rand des Gangs (halb so breit: 2,5)
      expect(Math.max(Math.abs(a), Math.abs(b))).toBeLessThan(2.35); // nicht im Sockel der Türme (ab 2,35)
      expect(d).toBeLessThanOrEqual(-0.75 + 0.01); // hinter der Türlinie, nach innen aufgeschwungen
      expect(c).toBeLessThan(-2.5);
      expect(Math.abs(w.angle)).toBeCloseTo(Math.PI / 2);
    }
  });

  it('Eistor, solange das Welt-Paket lädt: schlichte Türbretter an derselben Stelle, ohne Flackern, nichts leuchtet', () => {
    for (const open of [0, 0.5, 1]) {
      const plain = house('eis', open, true, 1, false);
      const full = house('eis', open, true, 1);
      expect(plain.wings.map((w) => [w.hinge, w.angle])).toEqual(full.wings.map((w) => [w.hinge, w.angle]));
      expect(fighting(plain.p, open === 0.5 ? [] : plain.placed), `offen ${open}`).toEqual([]);
      // nur die Bretter: keine Bänder, kein Umriss, kein Zeichen
      for (const w of plain.wings) {
        expect(w.parts.bright.empty).toBe(true);
        expect(w.parts.solid.build().getAttribute('position').count).toBe(20); // ein Quader (ohne Unterseite)
      }
      if (open === 0) {
        const [a, b] = [plain.placed, full.placed].map((ps) => bounds(ps.map(([, g]) => g)));
        // Bänder und Umriss liegen vorn und hinten auf den Brettern
        expect(a?.slice(0, 2)).toEqual(b?.slice(0, 2)); // so breit und hoch wie die geschmückte Tür
      }
    }
  });

  it('verdeckte Flächen fallen weg: Eine wache Plattform hat nur so viele Flächen, wie man sehen kann', () => {
    const sets = platformSets('sand', 'gate');
    const p = parts();
    for (const set of [sets.body, sets.picture, sets.frameGold, sets.accessOff]) platformParts(p, set, sets.awake);
    const quads = Object.values(p).reduce(
      (n, g) => n + (g.empty ? 0 : g.build().getAttribute('position').count / 4),
      0,
    );
    // oben je Säule eine Fläche (gut 500), dazu Kanten und Zierde; mit allen Würfelflächen wären es über 5000
    expect(quads).toBeGreaterThan(500);
    expect(quads).toBeLessThan(1200);
  });
});

describe('Das Eistor geht auf: Eiszapfen leuchten, der Umriss füllt sich', () => {
  it('Eiszapfen ab 0,3 s bis 1,2 s nach Beginn des Rituals nacheinander, sonst nicht', () => {
    const at = (t: number) => iceGlow(ritualGlow({ tick: 100 + t, ritual: 100 }));
    expect([at(0), at(3), at(12), at(20)]).toEqual([0, 0, 1, 1]);
    expect(at(7)).toBeGreaterThan(0);
    expect(at(7)).toBeLessThan(1);
    expect(ritualGlow({ tick: 100 + RITUAL, ritual: 100 })).toBe(0); // danach wie ohne Ritual
    expect(ritualGlow({ tick: 100, ritual: -1 })).toBe(0); // kein Ritual, auch nach dem Laden mitten im Vorspiel
    // die Farbe am Bogen (Welt-Paket): links zuerst, im Vorspiel und bei 0,3 s noch keiner
    expect(icicle(-1, ritualGlow({ tick: 99, ritual: 100 }))).toBe(icicle(-1, 0));
    expect(icicle(-1, ritualGlow({ tick: 103, ritual: 100 }))).toBe(icicle(-1, 0));
    expect(icicle(-1, ritualGlow({ tick: 112, ritual: 100 }))).not.toBe(icicle(-1, 0));
  });

  it('Umriss füllt sich im Vorspiel langsam, aber nicht vor der Zeit; die Eiszapfen leuchten erst im Ritual', () => {
    const fill = (k: number) => ritualGlow({ tick: 100 + k, ritual: 100 }); // `k` Takte nach Beginn des Rituals
    const rows = GUEST_OUTLINE.length;
    expect(PRE_SPAN).toBe(35); // so lang wie das längste Vorspiel (Süd)
    let last = 0;
    for (let k = -PRE_SPAN; k < RITUAL; k++) {
      // im Vorspiel und im Ritual nur wachsend, ganz erst, wenn die Flügel aufschwingen (1,2 s ins Ritual)
      expect(fill(k), `Takt ${k}`).toBeGreaterThanOrEqual(last);
      expect(fill(k) === 1, `Takt ${k}`).toBe(k >= 12);
      expect(iceGlow(fill(k)) > 0, `Takt ${k}`).toBe(k > 3); // Eiszapfen erst, wenn die Kamera vorn ist
      if (k < 0) {
        expect(fill(k)).toBeLessThanOrEqual(PRE_FILL); // im Vorspiel höchstens die Füße und etwas mehr
        expect(Math.round(fill(k) * 20)).toBeCloseTo(fill(k) * 20); // in Zwanzigsteln: selten neu bauen
      }
      last = fill(k);
    }
    expect(fill(-PRE_SPAN)).toBe(0); // das lange Vorspiel beginnt leer …
    expect(fill(-1)).toBe(PRE_FILL); // … und endet mit gefüllten Füßen
    expect(guestPixel(rows - 2, 3, fill(-1))).toEqual(GUEST_COLORS.y); // Füße orange
    expect(guestPixel(rows - 6, 2, fill(-1))).toEqual(GUEST_COLORS.o); // weiter oben noch leer
  });

  it('der Umriss füllt sich von unten mit den Farben des Pinguins, der Goldrahmen bleibt', () => {
    const rows = GUEST_OUTLINE.length;
    const feet = rows - 2; // Füße: unten orange
    expect(guestPixel(feet, 3, 0)).toEqual(GUEST_COLORS.o);
    expect(guestPixel(feet, 3, 0.2)).toEqual(GUEST_COLORS.y);
    expect(guestPixel(1, 4, 0.2)).toEqual(GUEST_COLORS.o); // oben noch Umriss
    expect(guestPixel(1, 4, 1)).toEqual(GUEST_COLORS.k);
    for (const lit of [0, 0.5, 1]) expect(guestPixel(0, 0, lit)).toEqual(GUEST_COLORS.g);
    // gefüllt: innen die Farben des Pinguins, außen derselbe Goldrahmen wie beim Umriss
    expect(GUEST_FILLED.map((r) => r.length + 2)).toEqual(GUEST_OUTLINE.slice(1, -1).map((r) => r.length));
    GUEST_OUTLINE.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === 'g') expect(guestPixel(r, c, 1), `${r},${c}`).toEqual(GUEST_COLORS.g);
        else
          expect(guestPixel(r, c, 1), `${r},${c}`).toEqual(
            GUEST_COLORS[GUEST_FILLED[r - 1]![c - 1] as 'k'] ?? undefined,
          );
      }),
    );
  });
});

describe('Torplatte vor jedem Tor (3D)', () => {
  /** Farben einer Geometrie als #rrggbb (wie `col` sie anlegt) */
  const colors = (g: BufferGeometry) => {
    const rgb = g.getAttribute('color').array;
    const out = new Set<string>();
    for (let i = 0; i < rgb.length; i += 3) out.add(col_(rgb[i]!, rgb[i + 1]!, rgb[i + 2]!));
    return out;
  };
  const col_ = (r: number, g: number, b: number) => `#${new Color(r, g, b).getHexString()}`;
  const hex = (c: string) => `#${col(c).getHexString()}`;

  for (const g of GATES) {
    const look = g.id === 'eis' ? gateLook.plate : plate(g.id); // Eis aus dem Welt-Paket, die anderen aus ihrem Bauplan
    it(`${g.id}: flackert nicht, auch mit Torhaus und goldenem Rand; flach in Reihe 2 der Bucht, 3 × 1 Felder`, () => {
      const { p } = house(g.id, 0, g.id === 'eis');
      checkPlate(g.id, look, p);
      checkPlate(g.id, undefined, house(g.id, 0, false, 0, false).p); // schlicht (Eis, solange das Paket lädt)
      const solo = parts();
      plateParts(solo, g.id, look);
      // Rand in der Farbe der Welt, er leuchtet (eigenes Material, `bright`), mit ihm nur die leuchtenden Zeichen
      const glow = [...(look?.mark ?? []).join(''), look?.under ?? ''].filter((c) => GLOW.has(c));
      expect([...colors(solo.bright.build())].sort()).toEqual(
        [...new Set([hex(THEME_COLORS[g.id].portal), ...glow.map((c) => hex(PALETTE[c]!))])].sort(),
      );
      // Führt der Pinguin zu diesem Tor, ist der Rand golden (an derselben Stelle), Fläche und Zeichen bleiben
      const gold = parts();
      plateParts(gold, g.id, look, true);
      expect(colors(gold.bright.build()).has(hex(GOLD.top))).toBe(true);
      expect(colors(gold.bright.build()).has(hex(THEME_COLORS[g.id].portal))).toBe(
        glow.some((c) => PALETTE[c] === THEME_COLORS[g.id].portal),
      );
      expect(gold.bright.build().getAttribute('position').array).toEqual(
        solo.bright.build().getAttribute('position').array,
      );
      expect(gold.solid.build().getAttribute('color').array).toEqual(solo.solid.build().getAttribute('color').array);
    });
  }

  it('jede Welt hat ihre eigene Platte: andere Fläche und anderes Zeichen, nie Rot', () => {
    const looks = GATES.map((g) => (g.id === 'eis' ? gateLook.plate : plate(g.id))!);
    expect(new Set(looks.map((l) => l.face.join())).size).toBe(GATES.length);
    expect(new Set(looks.map((l) => l.mark.join())).size).toBe(GATES.length);
    const red = (c: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
      return r > 150 && g < 90 && b < 90;
    };
    for (const l of looks) {
      const all = [...l.face, ...[...l.mark.join(''), l.under ?? ''].flatMap((c) => PALETTE[c] ?? [])];
      for (const c of all) expect(red(c), c).toBe(false);
    }
    // 2D: das Bild der Portal-Plattform, ohne Rot (Fliegenpilz, Regenbogen), aufrecht auch an Toren im Osten und Westen
    for (const g of GATES)
      for (const along of [true, false]) {
        const sign = plateSign(g.id, along);
        expect(sign, g.id).toHaveLength(PLATE_VOX);
        for (const ch of sign.join('')) expect(red(PALETTE[ch]!), `${g.id} ${ch}`).toBe(false);
        // ohne Rot: dieselben Pixel, Rot wird Orange ('2'); entlang die Reihen des Bilds, quer (Osten, Westen) seine
        // Spalten, so steht es von oben gesehen aufrecht; zu sehen sind 6 aufeinanderfolgende
        const pic = LOOKS[g.id].picture.map((r) => r.replace(/[1BH]/g, '2'));
        const lines = along ? pic : [...pic[0]!].map((_, c) => pic.map((r) => r[c]).join(''));
        const shown = sign.slice(1, 7).join();
        expect(
          [0, 1, 2].some((w) => lines.slice(w, w + 6).join() === shown),
          `${g.id} ${along}`,
        ).toBe(true);
      }
    // es fällt weg, was am wenigsten Bild hat: Wasser verliert die leere Reihe unten und die doppelte Spitze oben, nicht
    // den Fuß des Tropfens; an Toren im Osten und Westen ist das ganze Bild hoch zu sehen (entlang 22 Voxel)
    expect(plateSign('wasser', true).slice(1, 7)).toEqual(LOOKS.wasser.picture.slice(1, 7));
    expect(
      plateSign('wasser', false)
        .slice(1, 7)
        .map((r) => r[0]),
    ).toEqual([...'uuWWuu']); // Reihe 0 des Bilds samt Spitze
  });

  it('goldener Rand pulsiert weich (1,2 s je Puls), bei reduzierter Bewegung ruhig ganz golden', () => {
    expect(PULSE_MS).toBe(1200);
    expect(plateGold(0, false)).toBeCloseTo(0);
    expect(plateGold(PULSE_MS / 2, false)).toBeCloseTo(1);
    expect(plateGold(PULSE_MS, false)).toBeCloseTo(0);
    for (let t = 0; t < 3000; t += 37) {
      expect(plateGold(t, false)).toBeGreaterThanOrEqual(0);
      expect(plateGold(t, false)).toBeLessThanOrEqual(1);
      expect(Math.abs(plateGold(t + 10, false) - plateGold(t, false))).toBeLessThan(0.03); // weich, ohne Sprung
      expect(plateGold(t, true)).toBe(1);
    }
  });

  it('oval: an den Ecken fehlen Voxel, ein geschlossener Rand aus einem Voxel; das Zeichen liegt mittig in der Fläche', () => {
    const mark = gateLook.plate!.mark;
    expect([plateVoxel(0, 0), plateVoxel(2, 0), plateVoxel(0, 1), plateVoxel(23, 7)]).toEqual([null, null, null, null]);
    expect([plateVoxel(3, 0), plateVoxel(1, 1), plateVoxel(0, 2), plateVoxel(12, 4)]).toEqual([
      'rim',
      'rim',
      'rim',
      'face',
    ]);
    let marks = 0;
    for (let i = 0; i < PLATE_LEN; i++)
      for (let k = 0; k < PLATE_VOX; k++) {
        const kind = plateVoxel(i, k, mark);
        if (kind === 'rim' || kind === 'face' || !kind) continue;
        marks++;
        expect(Math.abs(i + 0.5 - PLATE_LEN / 2), `${i},${k}`).toBeLessThan(4); // mittig
      }
    expect(marks).toBe(mark.join('').replace(/\./g, '').length); // ganz, nichts vom Rand verdeckt
    // der Rand bleibt mit Zeichen derselbe; jedes Randvoxel hat einen Nachbarn außerhalb der Platte
    for (let i = 0; i < PLATE_LEN; i++)
      for (let k = 0; k < PLATE_VOX; k++) {
        expect(plateVoxel(i, k, mark) === 'rim').toBe(plateVoxel(i, k) === 'rim');
        if (plateVoxel(i, k) !== 'rim') continue;
        const out = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([di, dk]) => !plateVoxel(i + di!, k + dk!));
        expect(out, `${i},${k}`).toBe(true);
      }
  });

  it('Eis mit Schmuck: Scholle in Eisfarbe mit schneeweißer Schneeflocke; ohne Paket schlicht: Stein ohne Zeichen', () => {
    const [ice, plain] = [gateLook.plate, undefined].map((look) => {
      const p = parts();
      plateParts(p, 'eis', look);
      return colors(p.solid.build());
    });
    expect(ice!.has(hex(PALETTE.s!))).toBe(true);
    expect([...ice!].sort()).toEqual([...gateLook.plate!.face, PALETTE.s!].map(hex).sort());
    expect(ice!.has(hex(PLATE_STONE[1]))).toBe(false);
    expect([...plain!].sort()).toEqual(PLATE_STONE.map(hex).sort());
  });

  it('sinkt einen Voxel ein (80 ms), springt in 120 ms hoch; bei reduzierter Bewegung ohne Übergang; andere Platten bleiben', () => {
    const on = { id: 'eis' as const, since: 1000, on: true };
    const off = { ...on, on: false };
    expect([0, 40, 80, 500].map((t) => plateSink(on, 'eis', 1000 + t, false))).toEqual([0, SINK / 2, SINK, SINK]);
    expect([0, 60, 120].map((t) => plateSink(off, 'eis', 1000 + t, false))).toEqual([SINK, SINK / 2, 0]);
    expect([plateSink(on, 'eis', 1000, true), plateSink(off, 'eis', 1000, true)]).toEqual([SINK, 0]);
    expect([plateSink(on, 'sand', 2000, false), plateSink(null, 'eis', 2000, false)]).toEqual([0, 0]);
    expect(SINK).toBe(1 / 8);
  });

  it('3D: ganz eingesunken liegt ihre Oberseite noch über dem Boden und der goldenen Bucht (sonst flackert sie)', () => {
    const p = parts();
    plateParts(p, 'eis', gateLook.plate);
    const [, [, top]] = bounds([p.solid.build(), p.bright.build()]);
    expect(top - DIP).toBeGreaterThan(0.04); // der Boden liegt bei 0: Abstand wie eine Markierung 0,02 darüber
    expect(DIP).toBeGreaterThan(SINK / 2); // sichtbar eingesunken
  });
});

describe('Zugang vor der Torplatte zur Front gebaut (mitwachsen-gatehouses-3d.ts)', () => {
  type Ctx = Parameters<typeof sandGate>[0];
  const rasters: Record<string, (g: Ctx) => Vox> = { sand: sandGate, pilze: pilzVox, wolken: wolkenVox };
  /** alle Voxel eines Rasters mit Farbe und Teil (nur im Test: der Baukasten gibt sie sonst nicht heraus) */
  const cells = (v: Vox) => {
    const all = (v as unknown as { cells: Map<number, { c: string; part: string }> }).cells;
    return new Map([...all].map(([k, c]) => [k, `${c.c}|${c.part}`]));
  };
  /**
   * Gemessen in der Spec: zur Front gebaut höchstens 6561 Voxel (Sand), knapp 10 ms je Torhaus. Mehr als die 6000 eines
   * Zugangs für die Kamera im Süden, bewusst: Die Fassungen zur Front entstehen im Leerlauf, nie in einem Bild
   */
  const FRONT_VOX = 6600;

  it('mit allen Flächen: Sand, Pilze und Wolken behalten auch die Hülle, die von der Front weg schaut', () => {
    // sonst fehlten Voxel der Rückseite, und dreht die Kamera nach Süden, bevor der Zugang zurückgebaut ist, sähe sie
    // durch die Löcher ins hohle Innere
    for (const open of [0, 0.5, 1])
      for (const cam of [
        [0, 1],
        [0, -1],
        [1, 0],
      ] as const) {
        const ctx = { open, outline: false, lit: 0, cam };
        for (const [id, raster] of Object.entries(rasters)) {
          const [cut, all] = [raster(ctx), raster({ ...ctx, all: true })];
          expect(all.size, id).toBeGreaterThan(cut.size);
          expect(all.size, `${id} ${open} ${cam.join()}`).toBeLessThanOrEqual(FRONT_VOX);
        }
      }
  });

  it('beim Betreten der Bucht springt nichts um: Fassung 1 hat jeden Voxel der Fassung für den Süden, gleich gefärbt', () => {
    // Schild, Flocke, Wasserwand, Glutbaum und Wolkengesicht richten sich weiter nach der Kamera im Süden; erst mehr als
    // halb gedreht kommt die Fassung zur Front (cam [0, 1])
    for (const cam of [
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const ctx = { open: 0, outline: false, lit: 0, cam };
      for (const [id, raster] of Object.entries(rasters)) {
        const all = cells(raster({ ...ctx, all: true }));
        for (const [k, c] of cells(raster(ctx))) expect(all.get(k), `${id} ${cam.join()}`).toBe(c);
      }
    }
  });
});
