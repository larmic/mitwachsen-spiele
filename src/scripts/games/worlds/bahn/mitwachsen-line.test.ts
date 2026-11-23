import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../data/games/mitwachsen';
import { LINE } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { Cell, Rail } from '../../mitwachsen-cell';
import { LICHTUNG_HOME } from '../../mitwachsen-home';
import { BESIDE, plateRow } from '../../mitwachsen-bay';
import { canStep, createWorld, type World } from '../../mitwachsen-world';
import { BAHN_PACK, BUILT, HOEHLE_PACK, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { bayAt, besideRay, centreOf } from './mitwachsen-bear';
import { APPROACH, PORTAL_T, clean, joined } from './mitwachsen-line';
import { LETTERS, STEPS, gridOf } from './mitwachsen-trace';

/** Seeds, deren Grotte um eine Ecke liegt (wie in mitwachsen-grotte.test.ts): Dort biegt auch das Gleis im Gang ab */
const TURNED = [26, 30];
/** Eigenschafts-Tests über ganze Welten: wenige Seeds, im tiefen Lauf 20 und die gebogenen */
const SEEDS = seedsFor([...seedRange(1, 20), ...TURNED], [...SAMPLE_SEEDS, ...TURNED]);
const key = ([x, y]: Point) => `${x},${y}`;
const step = ([x, y]: Point, l: string): Point => {
  const [dx, dy] = STEPS[LETTERS.indexOf(l)]!;
  return [x + dx, y + dy];
};
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

type Laid = { cells: Point[]; rails: Rail[]; c: (p: Point) => Cell };

/** Die Linie aus den Feldern der Welt: vom Prellbock in der Bucht zurück bis Bahnhof Bär, dann vorwärts bis zum Ende */
function lineOf(w: World): Laid {
  const g = w.gates.get('hoehle')!;
  const c = (p: Point) => w.cell(...p);
  const buffer = bayAt(g)(LINE.lane, -1);
  const back: Point[] = [];
  for (let p = buffer; c(p).rail && back.length < 400;) {
    back.push(p);
    const r = c(p).rail!;
    if (back.length > 1 && r.to.length < 2) break;
    p = step(p, r.to[0]!);
  }
  const fwd: Point[] = [];
  const first = c(buffer).rail;
  if (first && first.to.length === 2)
    for (let p = step(buffer, first.to[1]!); c(p).rail && fwd.length < 400;) {
      fwd.push(p);
      const r = c(p).rail!;
      if (r.to.length < 2) break;
      p = step(p, r.to[1]!);
    }
  const cells = [...back.reverse(), ...fwd];
  return { cells, rails: cells.map((p) => c(p).rail!), c };
}

/** Felder, die man vom Bett `wake` aus erreicht, ohne `blocked` zu betreten (offen: `open`) */
function reach(w: World, wake: readonly Point[], blocked: ReadonlySet<string>, open: string[] = []) {
  const seen = new Set<string>(wake.map(key));
  const queue = [...wake];
  for (let i = 0; i < queue.length && seen.size < 60000; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of STEPS) {
      const q: Point = [x + dx, y + dy];
      if (seen.has(key(q)) || blocked.has(key(q)) || !canStep(w, open as never[], x, y, ...q)) continue;
      seen.add(key(q));
      queue.push(q);
    }
  }
  return seen;
}

/** So viele Schritte braucht man vom Bett (`wake`) bis zum nächsten Feld aus `goal` (−1: gar nicht) */
function stepsTo(w: World, wake: readonly Point[], goal: ReadonlySet<string>) {
  const dist = new Map<string, number>(wake.map((p) => [key(p), 0]));
  const queue = [...wake];
  for (let i = 0; i < queue.length && dist.size < 60000; i++) {
    const [x, y] = queue[i]!;
    const d = dist.get(key([x, y]))!;
    if (goal.has(key([x, y]))) return d;
    for (const [dx, dy] of STEPS) {
      const q: Point = [x + dx, y + dy];
      if (dist.has(key(q)) || !canStep(w, [], x, y, ...q)) continue;
      dist.set(key(q), d + 1);
      queue.push(q);
    }
  }
  return -1;
}

/** Felder eines Bahnsteigs (`Cell.stop`) in der Gegend `realm` rund um die Linie */
function platformOf(laid: Laid, realm: Cell['region']): Point[] {
  const out = new Map<string, Point>();
  for (const p of laid.cells)
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const q: Point = [p[0] + dx, p[1] + dy];
        const cell = laid.c(q);
        if (cell.stop === 'hoehle' && cell.region === realm) out.set(key(q), q);
      }
  return [...out.values()];
}

/** Was an einem Feld von Bahnhof Bär nicht stimmt: Lichtung, trocken, frei, außerhalb des Portalrings, nichts Gemiedenes nah */
function siteFaults(laid: Laid, p: Point, bed: Point): string[] {
  const bad: string[] = [];
  const cell = laid.c(p);
  if (cell.ground === 'water' || cell.solid || cell.region !== 'lichtung') bad.push(`Feld ${key(p)}`);
  if (Math.hypot(p[0] - bed[0], p[1] - bed[1]) < LINE.bear.ring) bad.push(`${key(p)} im Portalring`);
  const near = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => laid.c([p[0] + dx, p[1] + dy])));
  if (near.some((n) => n.portal || n.garden || n.plate || n.deco === 'klangstein' || n.ground === 'water'))
    bad.push(`${key(p)} zu nah an etwas`);
  return bad;
}

/** So viele Felder sind in `a` anders als in `b`: die Lichtung bis 60 Felder ums Bett und die Spur u −2 hinter dem Tor */
function unlike(a: World, b: World) {
  const g = a.gates.get('hoehle')!;
  const cells = [
    ...Array.from({ length: 121 * 121 }, (_, i): Point => [(i % 121) - 60, Math.floor(i / 121) - 60]),
    ...Array.from({ length: 40 }, (_, t) => bayAt(g)(LINE.lane, g.deep + t)),
  ];
  return cells.filter((p) => JSON.stringify(a.cell(...p)) !== JSON.stringify(b.cell(...p))).length;
}

describe('Gleis der Höhlenbahn als Boden (Paket der Bahn)', () => {
  it('gesucht wird nur, wo Anfang und Ziel über freie Felder zusammenhängen (joined)', () => {
    const rows = ['11#11', '11#11', '11111'];
    const g = gridOf(0, 0, 4, 2, (x, y) => (rows[y]![x] === '#' ? null : [1, 0]));
    expect(joined(g, [0, 0], [4, 0])).toBe(true); // unten herum
    const walled = gridOf(0, 0, 4, 2, (x) => (x === 2 ? null : [1, 0]));
    expect(joined(walled, [0, 0], [4, 0])).toBe(false);
    expect(joined(walled, [2, 0], [4, 0])).toBe(false); // Anfang zu
  });

  it('ohne das Paket der Bahn liegt nirgends Gleis', () => {
    const w = worldOf(SEEDS[0]!, [HOEHLE_PACK]);
    const g = w.gates.get('hoehle')!;
    const lane = Array.from({ length: APPROACH }, (_, i) => bayAt(g)(LINE.lane, -1 - i));
    expect(lane.some((p) => w.cell(...p).ride || w.cell(...p).rail)).toBe(false);
  });

  it('vor Ausbau 1 legt das Paket nichts: Lichtung und Grotte Feld für Feld wie ohne das Paket der Bahn', () => {
    // frisch gebaut, nicht über worldOf: Die Welten bleiben nicht im Speicher (der tiefe Lauf hält schon 20 mit Gleis)
    const bad = SAMPLE_SEEDS.slice(0, 1).flatMap((seed) => {
      const plain = createWorld(seed, [HOEHLE_PACK]);
      return [{}, { bahn: { built: 0 } }].flatMap((saved) => {
        const diff = unlike(createWorld(seed, [HOEHLE_PACK, BAHN_PACK], saved), plain);
        return diff ? [`Seed ${seed}, ${JSON.stringify(saved)}: ${diff} Felder anders`] : [];
      });
    });
    expect(bad).toEqual([]);
  });

  for (const seed of SEEDS) {
    const w = worldOf(seed, [HOEHLE_PACK, BAHN_PACK], BUILT);
    const laid = lineOf(w);
    const g = w.gates.get('hoehle')!;
    const at = bayAt(g);
    const buffer = laid.rails.findIndex((r) => r.part === 'buffer');

    it(`Seed ${seed}: eine Linie von Bahnhof Bär durch die Bucht bis zum Bahnhof Fledermaus, Ausbau 1 bis zum Prellbock`, () => {
      const bad: string[] = [];
      if (laid.cells.length < 40) bad.push(`nur ${laid.cells.length} Felder`);
      if (laid.rails[0]?.part !== 'end' || laid.rails.at(-1)?.part !== 'end') bad.push('ohne Prellbock an den Enden');
      if (key(laid.cells[buffer] ?? [0, 0]) !== key(at(LINE.lane, -1))) bad.push('Prellbock nicht vor der Tür');
      if (laid.rails.some((r, i) => r.stage !== (i <= buffer ? 1 : 2)))
        bad.push('Ausbau nicht 1 bis zum Prellbock, dann 2');
      if (laid.c(laid.cells[0]!).region !== 'lichtung') bad.push('Anfang nicht auf der Lichtung');
      if (laid.c(laid.cells.at(-1)!).region !== 'hoehle') bad.push('Ende nicht in der Grotte');
      if (!laid.cells.every((p) => laid.c(p).ride === 'hoehle')) bad.push('Felder ohne Strecke');
      // nur Lichtung, Gang und Grotte (das Tor auf seiner Spur u −2)
      const door = key(at(LINE.lane, 0));
      const where = laid.cells.filter(
        (p) => !['lichtung', 'hoehle', 'wild'].includes(laid.c(p).region) && key(p) !== door,
      );
      if (where.length) bad.push(`außerhalb von Lichtung und Grotte: ${where.map(key).join(' ')}`);
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: rechtwinklig, mindestens ${LINE.straight} Felder Gerade zwischen Kurven, Rampen höchstens 1 je ${LINE.ramp}`, () => {
      const bad: string[] = [];
      if (!clean(laid.cells)) bad.push('Felder nicht als Kette, doppelt oder sich berührend');
      const corners: number[] = [];
      for (let i = 1; i < laid.cells.length - 1; i++) {
        const [a, b, c] = [laid.cells[i - 1]!, laid.cells[i]!, laid.cells[i + 1]!];
        if (a[0] - b[0] !== b[0] - c[0] || a[1] - b[1] !== b[1] - c[1]) corners.push(i);
      }
      for (let k = 1; k < corners.length; k++)
        if (corners[k]! - corners[k - 1]! - 1 < LINE.straight)
          bad.push(`Kurven bei ${corners[k - 1]} und ${corners[k]}`);
      const hs = laid.cells.map((p) => laid.c(p).h);
      const changes = hs.flatMap((h, i) => (i > 0 && h !== hs[i - 1] ? [i] : []));
      if (hs.some((h, i) => i > 0 && Math.abs(h - hs[i - 1]!) > 1)) bad.push('Stufe höher als eins');
      for (let k = 1; k < changes.length; k++)
        if (changes[k]! - changes[k - 1]! < LINE.ramp) bad.push(`Stufen bei ${changes[k - 1]} und ${changes[k]}`);
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Bahnhof Bär 2 × 7 neben dem Gleis, ${LINE.bear.r.join('–')} Felder vom Bett, ${LINE.bear.angle.join('–')}° neben dem Strahl zum Tor, ${LINE.bear.steps.join('–')} Schritte`, () => {
      const platform = platformOf(laid, 'lichtung');
      const lane = laid.cells.slice(0, LINE.bear.long);
      const bed = LICHTUNG_HOME.bed;
      const bad: string[] = [];
      if (platform.length !== LINE.bear.long * LINE.bear.wide) bad.push(`Bahnsteig ${platform.length} Felder`);
      if (!lane.every((p) => platform.some((q) => cheb(p, q) === 1 && (p[0] === q[0] || p[1] === q[1]))))
        bad.push('Gleis nicht am Bahnsteig');
      const station = [...lane, ...platform];
      if (new Set(station.map((p) => laid.c(p).h)).size !== 1) bad.push('Bahnhof nicht eben');
      const c = centreOf({ lane, platform });
      const r = Math.hypot(c[0] - bed[0], c[1] - bed[1]);
      const deg = besideRay(c, g, bed);
      const { bear } = LINE;
      if (r < bear.r[0] || r > bear.r[1] || deg < bear.angle[0] || deg > bear.angle[1])
        bad.push(`Mitte ${r.toFixed(1)} Felder, ${deg.toFixed(0)}°`);
      const steps = stepsTo(w, LICHTUNG_HOME.wake, new Set(platform.map(key)));
      if (steps < bear.steps[0] || steps > bear.steps[1]) bad.push(`${steps} Schritte vom Bett`);
      bad.push(...station.flatMap((p) => siteFaults(laid, p, bed)));
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: freier Weg vom Bett zum Bahnsteig, Fußweg zur Torplatte frei, keine Plattform berührt`, () => {
      const track = new Set(laid.cells.map(key));
      const stops = platformOf(laid, 'lichtung');
      const free = reach(w, LICHTUNG_HOME.wake, track);
      const bad: string[] = [];
      if (!stops.some((p) => free.has(key(p)))) bad.push('Bahnsteig nur über das Gleis');
      // der Fußweg zur Torplatte: ohne das Gleis zu betreten und mit zwei Feldern Abstand zum Bahnhof
      const station = [...laid.cells.slice(0, LINE.bear.long), ...stops];
      const around = station.flatMap(([x, y]) =>
        [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => key([x + dx, y + dy]))),
      );
      const walkway = reach(w, LICHTUNG_HOME.wake, new Set([...track, ...around]));
      if (!walkway.has(key(at(0, -2)))) bad.push('Torplatte nur über Gleis oder nah am Bahnhof');
      const touched = laid.cells.filter((p) => {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (laid.c([p[0] + dx, p[1] + dy]).portal) return true;
        return false;
      });
      if (touched.length) bad.push(`an Plattformen: ${touched.map(key).join(' ')}`);
      const pond = laid.cells.filter((p) => laid.c(p).ground === 'water' || laid.c(p).solid);
      if (pond.some((p) => key(p) !== key(at(LINE.lane, 0)))) bad.push('Gleis auf Wasser oder Festem');
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: auf der Lichtung nie auf oder neben Wiese, Trögen, Unterstand, Pilz, Plattformen, Torplatten, Klangsteinen`, () => {
      const fixed = new Set(Array.from({ length: APPROACH }, (_, i) => key(at(LINE.lane, -1 - i))));
      const avoided = (n: Cell) =>
        !!n.garden ||
        !!n.roof ||
        !!n.portal ||
        n.deco === 'trough' ||
        n.deco === 'watertrough' ||
        n.deco === 'shelterpilz' ||
        n.deco === 'klangstein';
      const bad = laid.cells
        .filter((p) => laid.c(p).region === 'lichtung')
        .filter((p) =>
          [-1, 0, 1].some((dy) =>
            [-1, 0, 1].some((dx) => {
              const n = laid.c([p[0] + dx, p[1] + dy]);
              // die feste Spur u −2 der Bucht liegt mit Absicht neben der Torplatte (u −1 … 1), nie auf ihr
              return avoided(n) || (!!n.plate && (!fixed.has(key(p)) || (dx === 0 && dy === 0)));
            }),
          ),
        )
        .map(key);
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: in der Bucht nur auf der Spur u ${LINE.lane}, davor Einschnitt und Tunnelportal`, () => {
      const bad: string[] = [];
      const plate = [-1, 0, 1].map((u) => key(plateRow(g, u)));
      const tok = key(plateRow(g, BESIDE));
      for (let t = -1; t >= -3; t--)
        for (let u = -6; u <= 6; u++) {
          const onTrack = laid.cells.some((p) => key(p) === key(at(u, t)));
          if (onTrack !== (u === LINE.lane)) bad.push(`Bucht u ${u}, t ${t}`);
        }
      if (laid.cells.some((p) => plate.includes(key(p)) || key(p) === tok)) bad.push('auf Torplatte oder Toks Platz');
      const parts = new Map(laid.cells.map((p, i) => [key(p), laid.rails[i]!.part]));
      if (parts.get(key(at(LINE.lane, PORTAL_T))) !== 'portal') bad.push('kein Tunnelportal');
      for (let i = 1; i <= LINE.cut; i++)
        if (parts.get(key(at(LINE.lane, PORTAL_T + i))) !== 'cut') bad.push(`kein Einschnitt in Reihe ${PORTAL_T + i}`);
      for (let t = -1; t >= -APPROACH; t--) if (!parts.has(key(at(LINE.lane, t)))) bad.push(`Spur endet bei ${t}`);
      // im Gang belegt das Gleis eines von fünf Feldern, auf derselben Spur
      for (let t = 0; t <= g.deep; t++) {
        const row = [-2, -1, 0, 1, 2].filter((u) => parts.has(key(at(u, t))));
        if (row.join() !== `${LINE.lane}`) bad.push(`Gang Reihe ${t}: ${row.join()}`);
      }
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: in der Grotte bis an den Bahnhof Fledermaus (12–16 Schritte vor dem Höhlenbett); Wege vom Höhlenbett zum Bahnsteig und zum Tor frei`, () => {
      const platform = platformOf(laid, 'hoehle');
      const lane = laid.cells.slice(-LINE.bear.long);
      const home = w.homes.hoehle;
      const track = new Set(laid.cells.map(key));
      const bad: string[] = [];
      if (platform.length !== LINE.bear.long * LINE.bear.wide) bad.push(`Bahnsteig ${platform.length} Felder`);
      if (!lane.every((p) => platform.some((q) => cheb(p, q) === 1 && (p[0] === q[0] || p[1] === q[1]))))
        bad.push('Gleis nicht am Bahnsteig');
      const near = (p: Point) => Math.hypot(p[0] - home.bed[0], p[1] - home.bed[1]);
      const plat = platform.reduce((m, p) => Math.min(m, near(p)), Infinity);
      if (lane.some((p) => near(p) < plat)) bad.push('Gleis auf der Seite zum Höhlenbett');
      const free = reach(w, home.wake, track);
      if (!platform.some((p) => free.has(key(p)))) bad.push('Bahnsteig nur über das Gleis');
      const steps = stepsTo(w, home.wake, new Set(platform.map(key)));
      if (steps < 12 || steps > 16) bad.push(`${steps} Schritte vom Höhlenbett`);
      if (!free.has(key(at(0, g.deep)))) bad.push('Mündung des Gangs nur über das Gleis');
      const portal = [...w.portals.values()].flatMap((p) => [p.gate, p.home]);
      if (laid.cells.some((p) => portal.some((q) => cheb(p, q) <= 2))) bad.push('an einer Plattform');
      if (laid.cells.some((p) => laid.c(p).garden)) bad.push('auf der Mooswiese');
      expect(bad, `Seed ${seed}`).toEqual([]);
    });
  }

  it('ohne Grotte endet das Gleis am Prellbock vor der Tür, auf der Lichtung dasselbe', () => {
    const seed = SEEDS[0]!;
    const alone = lineOf(worldOf(seed, [BAHN_PACK], BUILT));
    const full = lineOf(worldOf(seed, [HOEHLE_PACK, BAHN_PACK], BUILT));
    const end = full.rails.findIndex((r) => r.part === 'buffer');
    expect(alone.cells).toEqual(full.cells.slice(0, end + 1));
    expect(alone.rails.at(-1)).toMatchObject({ part: 'end', stage: 1 });
    expect(alone.rails.every((r) => r.stage === 1)).toBe(true);
  });
});
