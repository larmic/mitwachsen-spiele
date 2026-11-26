// Das Gletschertal im Kessel der Eis-Welt im Einzelnen: Landschaft, Seen, Eisberg, Eisfall, Eis-Portal, Wege
// (Eigenschafts-Tests über VALLEY_SEEDS)
import { beforeAll, describe, expect, it } from 'vitest';
import { fromKey } from '../../../../lib/games/chunks';
import { DIRS } from '../../../../lib/games/front';
import { PLATFORM_HALF, platformArea, platformCells } from '../../mitwachsen-portal';
import { HILL, KESSEL, KESSEL_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import { KESSEL_WILDS } from './mitwachsen-kessel';
import { FROST, HEAPS } from './mitwachsen-frost';
import { hillOf } from './mitwachsen-hill';
import { bergPeak } from './mitwachsen-ice-sky';
import { ICE_CRYSTALS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import { crossings } from '../../mitwachsen-border';
import { canStep, kesselPlace, standHeight, type Cell, type World } from '../../mitwachsen-world';
import { EIS_PACK, reachable, seedRange, seedsFor, worldOf } from '../../test-worlds';

/** Die acht Nachbarfelder und das Feld selbst */
/** Nur das Paket dieser Welt: Ein neues Paket baut die Welten dieser Tests nicht mit */
const ICE = [EIS_PACK];
const RING_1 = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const));

const keyOf = ([x, y]: readonly [number, number]) => `${x},${y}`;
const chebOf = (a: readonly number[], b: readonly number[]) =>
  Math.max(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!));

/** Feld (dx, dy) um eine Plattform: frei und nicht im Gang; im äußeren Ring auch eben und keine Plattform */
function ringFree(w: World, gang: ReadonlySet<string>, [cx, cy]: readonly [number, number], dx: number, dy: number) {
  const c = w.cell(cx + dx, cy + dy);
  const free = !c.solid && c.ground !== 'water' && !c.garden && !gang.has(`${cx + dx},${cy + dy}`);
  return free && (Math.max(Math.abs(dx), Math.abs(dy)) < 2 || (!c.portal && c.h === 1));
}

/** Was an einer Plattform des Eis-Portals nicht stimmt: Felder, Ring ringsum, Zugänge (leer, wenn alles passt) */
function icePlatformFaults(w: World, side: 'gate' | 'home', reach: ReadonlySet<string>): string[] {
  const wrong: string[] = [];
  const centre = w.portals.get('eiskessel')![side];
  const crossing = crossings(w)[0]!;
  for (const { x, y, at } of platformCells(centre)) {
    const c = w.cell(x, y);
    if (JSON.stringify(c.portal) !== JSON.stringify({ id: 'eiskessel', side, at }))
      wrong.push(`${side} ${x},${y} Feld`);
    if (c.solid || c.h !== w.cell(...centre).h || c.slide || c.garden) wrong.push(`${side} ${x},${y} flach und frei`);
    if (w.realm(x, y) !== 'eis' || c.region !== 'eis' || !reach.has(`${x},${y}`))
      wrong.push(`${side} ${x},${y} Kessel`);
  }
  // ringsum zwei Felder ebener Schnee, frei, nicht im Gang; von allen vier Seiten erreichbar
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      if (!ringFree(w, crossing.cells, centre, dx, dy)) wrong.push(`${side} Ring ${dx},${dy}`);
  for (const [dx, dy] of Object.values(DIRS))
    if (!reach.has(`${centre[0] + 2 * dx},${centre[1] + 2 * dy}`)) wrong.push(`${side} Zugang ${dx},${dy}`);
  return wrong;
}

/** Was am Eis-Portal einer Welt nicht stimmt: beide Plattformen, ihre Lage, Warteplätze (leer, wenn alles passt) */
function icePortalFaults(w: World): string[] {
  const home = w.homes.eis;
  const gate = w.gates.get('eis')!;
  const p = w.portals.get('eiskessel')!;
  const crossing = crossings(w)[0]!;
  const reach = new Set(reachable(w, [], home.wake[0]!, 200000).map(keyOf)); // vom Schneebett aus, Tor zu
  const wrong = [...icePlatformFaults(w, 'gate', reach), ...icePlatformFaults(w, 'home', reach)];
  if (keyOf(p.bed!) !== keyOf(home.bed)) wrong.push('erwacht nicht am Schneebett');
  // kein Warteplatz auf einer der Plattformen oder an ihren Zugängen (Durchgänge wie an den Toren)
  const area = new Set(platformArea(new Map([['eiskessel', p]])));
  for (const seat of crossing.seats.get('eis')!) if (area.has(keyOf(seat))) wrong.push(`Warteplatz ${keyOf(seat)}`);
  // ganz hinten am Talende: weit vom Schneebett, höchstens 20 Felder vor dem hintersten Boden des Tals
  const along = ([x, y]: readonly number[]) => (x! - home.bed[0]) * gate.out[0] + (y! - home.bed[1]) * gate.out[1];
  const end = Math.max(...[...w.spawns.values(), ...w.spotsOf('eis')].map(along));
  if (along(p.gate) < 100 || end - along(p.gate) > 20) wrong.push(`nicht am Talende (${along(p.gate)} von ${end})`);
  // im Kreis um das Schneebett, in Richtung des Tors; berührt weder Wiese, Iglu, Tröge noch Klangstein
  const [vx, vy] = [p.home[0] - home.bed[0], p.home[1] - home.bed[1]];
  if (Math.abs(Math.hypot(vx, vy) - home.portalRing) >= 1) wrong.push('nicht im Ring um das Schneebett');
  if (vx * -gate.out[0] + vy * -gate.out[1] <= 0.95 * Math.hypot(vx, vy)) wrong.push('nicht in Richtung des Tors');
  for (const f of [home.bed, home.food, home.water, home.shelterStem, w.stones.get('eis-offen')!])
    if (chebOf(p.home, f) <= 2) wrong.push(`an ${keyOf(f)}`);
  const { x0, y0, x1, y1 } = home.shelter;
  for (const { x, y } of platformCells(p.home))
    if (x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 2 && y <= y1 + 1) wrong.push(`Iglu ${x},${y}`);
  return wrong;
}

/** Liegt das Feld auf dem Rodelberg (höchstens `HILL.rings` Ringe um seinen Gipfel)? Dort reicht der Schnee bis `HILL.top` */
function onHill(w: World, x: number, y: number): boolean {
  const top = hillOf(w)?.top;
  return !!top && Math.max(Math.abs(x - top[0]), Math.abs(y - top[1])) <= HILL.rings;
}

describe('Gletschertal im Kessel (Eis-Welt)', () => {
  /**
   * Seeds der Tal-Tests: tief (MITWACHSEN_DEEP) die 20 Seeds 121 bis 140, sonst die Stichprobe (seedsFor). Eine Welt zu
   * bauen kostet etwa 0,15 s, darum teilen sich die Tests dieselben (`worldOf`)
   */
  const VALLEY_SEEDS = seedsFor(seedRange(121, 140));
  /** Seeds des Eis-Portals: dazu die vier der Tests je Seed (worlds/eis/mitwachsen-kessel.test.ts) */
  const PORTAL_SEEDS = [...new Set([1, 42, 2026, 7, ...VALLEY_SEEDS])];
  // einmal vorab bauen (Frist der Hooks: vitest.config.ts): Das dauert länger als ein einzelner Test darf
  beforeAll(() => PORTAL_SEEDS.forEach((s) => worldOf(s, ICE)));

  it(`Jedes begehbare Feld im Tal ist vom Schneebett aus erreichbar (${VALLEY_SEEDS.length} Seeds)`, () => {
    // über den Felsring und die Gangausgänge prüft mitwachsen-kessel.test.ts
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed, ICE);
      const { cells } = kesselPlace(seed, EIS_PACK);
      const inKessel = new Set(cells.map(([x, y]) => `${x},${y}`));
      // Suche nur über Felder des Kessels: der Boden hängt in sich zusammen, ohne Umweg über den Gang
      const start = w.homes.eis.wake[0]!;
      const seen = new Set([start.join(',')]);
      const queue: (readonly [number, number])[] = [start];
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i]!;
        for (const [dx, dy] of Object.values(DIRS)) {
          const k = `${x + dx},${y + dy}`;
          if (seen.has(k) || !inKessel.has(k) || !canStep(w, ['eis'], x, y, x + dx, y + dy)) continue;
          seen.add(k);
          queue.push([x + dx, y + dy]);
        }
      }
      const cut = cells.filter(
        ([x, y]) => w.cell(x, y).region === 'eis' && standHeight(w, [], x, y) !== null && !seen.has(`${x},${y}`),
      );
      expect(cut, `Seed ${seed}`).toEqual([]);
    }
  });

  /**
   * Eisblock im Kessel: Eis eine Stufe über dem Boden (Seen liegen auf Höhe 1, die Spur ist eben; die Stufen des
   * Eisbergs sind gefärbt)
   */
  const isBlock = (c: Cell) => c.ground === 'ice' && c.h >= 2 && !c.slide && !c.solid && !c.color;
  /** Stufe des Eisbergs */
  const isBerg = (c: Cell) => c.region === 'eis' && c.color === KESSEL_COLORS.berg;
  /**
   * Was an Tannen und Eisblöcken im Kessel falsch ist: zu nah an Bett, Spur, Kisten, Eisloch oder Plattformen; Tannen
   * nicht einzeln, Eisblöcke nicht über allen Nachbarn
   */
  function wildFaults(w: World, kessel: readonly (readonly [number, number])[]) {
    const bed = w.homes.eis.bed;
    const pick = (f: (c: Cell) => boolean) => kessel.filter(([x, y]) => f(w.cell(x, y)));
    const cheb = (a: readonly [number, number], b: readonly [number, number]) =>
      Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    const near = (list: readonly (readonly [number, number])[], p: readonly [number, number], r: number) =>
      list.some((q) => cheb(q, p) <= r);
    const slide = pick((c) => !!c.slide);
    const crates = pick((c) => c.deco === 'fishcrate');
    const water = pick((c) => c.ground === 'water');
    const portals = [...w.portals.values()].flatMap((p) => [p.gate, p.home]);
    const wrong: string[] = [];
    for (const p of pick((c) => c.tree === 'snowpine' || isBlock(c))) {
      const pine = w.cell(...p).tree === 'snowpine';
      const at = `${pine ? 'Tanne' : 'Eisblock'} ${p.join(',')}`;
      if (Math.hypot(p[0] - bed[0], p[1] - bed[1]) <= KESSEL.flat + 2) wrong.push(`am Bett ${at}`);
      if (near(slide, p, pine ? 2 : 1)) wrong.push(`an der Spur ${at}`);
      if (near(crates, p, 3)) wrong.push(`an einer Kiste ${at}`);
      if (near(water, p, 2)) wrong.push(`am Eisloch ${at}`);
      if (near(portals, p, PLATFORM_HALF + 1)) wrong.push(`an einer Plattform ${at}`);
      if (pine) {
        const around = RING_2.map(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy));
        if (around.some((n) => n.deco === 'tree' || n.region !== 'eis')) wrong.push(`nicht einzeln ${at}`);
      } else {
        const h = w.cell(...p).h;
        if (h > 3) wrong.push(`zu hoch ${at}`);
        const sides = Object.values(DIRS).map(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy));
        if (sides.some((n) => n.h < h - 1)) wrong.push(`kein Block ${at}`); // abgesenkt, nur noch eine Eisfläche
      }
    }
    return wrong;
  }
  /** Ring um ein Feld bis zwei Felder weit, ohne das Feld selbst */
  const RING_2 = [-2, -1, 0, 1, 2]
    .flatMap((dy) => [-2, -1, 0, 1, 2].map((dx) => [dx, dy] as const))
    .filter(([dx, dy]) => dx || dy);

  it(`Winterlandschaft: Tannen, Eisblöcke und Hügel in drei Stufen; Bett, Spur, Kisten, Plattformen und Eislöcher bleiben frei (${VALLEY_SEEDS.length} Seeds)`, () => {
    let high = 0,
      ground = 0;
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed, ICE);
      const kessel = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const wrong = wildFaults(w, kessel);
      // jeder Kessel, nicht nur im Mittel: ein paar Tannen und Eisblöcke zum Klettern
      const count = (f: (c: Cell) => boolean) => kessel.filter(([x, y]) => f(w.cell(x, y))).length;
      const pines = count((c) => c.tree === 'snowpine');
      const blocks = count(isBlock);
      if (pines < KESSEL_WILDS.pines) wrong.push(`nur ${pines} Tannen`);
      if (blocks < KESSEL_WILDS.blocks) wrong.push(`nur ${blocks} Eisblöcke`);
      for (const [x, y] of kessel) {
        const h = standHeight(w, [], x, y);
        if (h === null) continue;
        ground++;
        if (h >= 2) high++;
        if (h > (isBerg(w.cell(x, y)) ? KESSEL.berg.top : onHill(w, x, y) ? HILL.top : 3))
          wrong.push(`zu hoch ${x},${y}`); // Hügel bis 3, Rodelberg bis 7
        const steps = Object.values(DIRS).map(([dx, dy]) => standHeight(w, [], x + dx, y + dy));
        if (steps.some((to) => to !== null && Math.abs(to - h) > 1)) wrong.push(`Stufe ${x},${y}`);
      }
      // Wohnplätze nie auf Tannen
      wrong.push(
        ...w
          .spotsOf('eis')
          .filter(([x, y]) => standHeight(w, [], x, y) === null)
          .map((p) => `Wohnplatz ${p.join(',')}`),
      );
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
    // gut 40 % des Bodens auf Höhe 2 oder 3
    expect(high / ground).toBeGreaterThan(0.38);
    expect(high / ground).toBeLessThan(0.52);
  });

  /** Was an Eiskristallen und Schneewehen im Kessel falsch ist */
  function frostFaults(w: World, kessel: readonly (readonly [number, number])[]) {
    const bed = w.homes.eis.bed;
    const pick = (f: (c: Cell) => boolean) => kessel.filter(([x, y]) => f(w.cell(x, y)));
    const near = (list: readonly (readonly [number, number])[], p: readonly [number, number], r: number) =>
      list.some((q) => chebOf(q, p) <= r);
    const slide = pick((c) => !!c.slide);
    const crates = pick((c) => c.deco === 'fishcrate');
    const water = pick((c) => c.ground === 'water');
    const portals = [...w.portals.values()].flatMap((p) => [p.gate, p.home]);
    const wrong: string[] = [];
    for (const p of pick((c) => c.deco === 'crystal')) {
      const c = w.cell(...p);
      const at = `Kristall ${p.join(',')}`;
      if (!c.solid || c.region !== 'eis' || c.biome !== 'eis') wrong.push(`nicht fest im Kessel ${at}`);
      if (!ICE_CRYSTALS.includes(c.color as (typeof ICE_CRYSTALS)[number])) wrong.push(`Farbe ${c.color} ${at}`);
      if (Math.hypot(p[0] - bed[0], p[1] - bed[1]) <= KESSEL.flat + 2) wrong.push(`am Bett ${at}`);
      if (near(slide, p, 2)) wrong.push(`an der Spur ${at}`);
      if (near(crates, p, 3) || near(water, p, 2)) wrong.push(`an Kiste oder Eisloch ${at}`);
      if (near(portals, p, PLATFORM_HALF + 2)) wrong.push(`am Plattform-Ring ${at}`);
      // nie an der Mündung: kein Feld des Gangs bis drei Felder weit
      const mouth = RING_3.some(([dx, dy]) => {
        const n = w.cell(p[0] + dx, p[1] + dy);
        return n.region !== 'eis' && n.region !== 'border';
      });
      if (mouth) wrong.push(`an der Mündung ${at}`);
      // mit Lücke: alle acht Nachbarn begehbar und gleich hoch, so geht man immer um ihn herum
      const ring = RING_1.filter(([dx, dy]) => dx || dy).map(([dx, dy]) => [p[0] + dx, p[1] + dy] as const);
      if (ring.some(([x, y]) => standHeight(w, ['eis'], x, y) !== c.h)) wrong.push(`ohne Lücke ${at}`);
    }
    for (const p of pick((c) => c.deco === 'snowdrift')) {
      const at = `Schneewehe ${p.join(',')}`;
      if (standHeight(w, ['eis'], ...p) === null) wrong.push(`nicht begehbar ${at}`);
      if (w.cell(...p).ground !== 'snow' || w.cell(...p).slide) wrong.push(`nicht auf Schnee ${at}`);
      // im Lee einer Tanne: Der Pustewind weht nach rechts (+x)
      if (![1, 2].some((d) => w.cell(p[0] - d, p[1]).tree === 'snowpine')) wrong.push(`nicht im Lee ${at}`);
    }
    return wrong;
  }
  const RING_3 = [-3, -2, -1, 0, 1, 2, 3].flatMap((dy) => [-3, -2, -1, 0, 1, 2, 3].map((dx) => [dx, dy] as const));

  it(`Eiskristalle in kleinen Gruppen an Klippenfuß und Kuppen, mit Lücke; Schneewehen im Lee der Tannen (${VALLEY_SEEDS.length} Seeds)`, () => {
    let special = 0,
      all = 0;
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed, ICE);
      const kessel = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const wrong = frostFaults(w, kessel);
      const crystals = kessel.filter(([x, y]) => w.cell(x, y).deco === 'crystal');
      const drifts = kessel.filter(([x, y]) => w.cell(x, y).deco === 'snowdrift');
      if (crystals.length < FROST.least) wrong.push(`nur ${crystals.length} Kristalle`);
      if (crystals.length > FROST.groups * FROST.size + FROST.least) wrong.push(`${crystals.length} Kristalle`);
      if (!drifts.length) wrong.push('keine Schneewehe');
      // in Gruppen: jeder Kristall hat einen zweiten höchstens zwei Felder weit
      for (const p of crystals)
        if (!crystals.some((q) => q !== p && chebOf(p, q) <= 2)) wrong.push(`allein ${p.join(',')}`);
      for (const p of crystals) {
        all++;
        const cliff = RING_3.some(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy).region === 'border');
        if (cliff || w.cell(...p).h === 3) special++;
      }
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
    expect(special / all).toBeGreaterThan(0.6); // meist am Klippenfuß oder auf einer Kuppe
  });

  /** Was an den Schneehaufen im Tal falsch ist (sie werden zu Schneemännern, fest in jeder Stufe) */
  function heapFaults(w: World, kessel: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const heaps = kessel.filter(([x, y]) => w.cell(x, y).deco === 'snowheap');
    const wrong: string[] = [];
    // gut ein Dutzend; gemessen über 100 Seeds immer alle `HEAPS.count` (14), weniger als 10 wäre zu karg
    if (heaps.length < 10 || heaps.length > HEAPS.count) wrong.push(`${heaps.length} Schneehaufen`);
    for (const p of heaps) {
      const c = w.cell(...p);
      const at = `Schneehaufen ${p.join(',')}`;
      if (!c.solid || c.region !== 'eis' || c.ground !== 'snow') wrong.push(`nicht fest auf Schnee ${at}`);
      if (heaps.some((q) => q !== p && Math.hypot(q[0] - p[0], q[1] - p[1]) < HEAPS.spacing)) wrong.push(`dicht ${at}`);
      // ringsum zwei Felder frei: nichts Festes, kein Wasser, keine Spur, keine Plattform, keine Wiese
      for (const [dx, dy] of RING_2) {
        const n = w.cell(p[0] + dx, p[1] + dy);
        if (n.solid || n.ground === 'water' || n.slide || n.portal || n.garden) wrong.push(`eng ${at}`);
      }
      // alle acht Nachbarn gleich hoch und vom Schneebett aus erreichbar: Man läuft immer um ihn herum
      for (const [dx, dy] of RING_1.filter(([dx, dy]) => dx || dy)) {
        if (standHeight(w, [], p[0] + dx, p[1] + dy) !== c.h) wrong.push(`ohne Lücke ${at}`);
        if (!reach.has(keyOf([p[0] + dx, p[1] + dy]))) wrong.push(`nicht erreichbar ${at}`);
      }
    }
    return wrong;
  }

  it(`Schneehaufen liegen einzeln und weit verstreut, ringsum frei und erreichbar; sie sperren nie etwas ab (${VALLEY_SEEDS.length} Seeds)`, () => {
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed, ICE);
      const kessel = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const reach = new Set(reachable(w, [], w.homes.eis.wake[0]!, 200000).map(keyOf));
      const wrong = heapFaults(w, kessel, reach);
      // ohne die Haufen wäre kein Feld mehr erreichbar: Jedes begehbare Feld des Tals ist es schon mit ihnen
      wrong.push(
        ...kessel
          .filter(([x, y]) => standHeight(w, [], x, y) !== null && !reach.has(`${x},${y}`))
          .map((p) => `abgesperrt ${p.join(',')}`),
      );
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
  });

  /** Eislöcher: zusammenhängende Wasserflächen im Tal (Nachbarn über Seiten) */
  function holesOf(w: World, floor: readonly (readonly [number, number])[]) {
    const water = new Set(floor.filter(([x, y]) => w.cell(x, y).ground === 'water').map(keyOf));
    const holes: (readonly [number, number])[][] = [];
    const seen = new Set<string>();
    for (const k of water) {
      if (seen.has(k)) continue;
      seen.add(k);
      const hole = [fromKey(k)];
      for (let i = 0; i < hole.length; i++)
        for (const [dx, dy] of Object.values(DIRS)) {
          const n = `${hole[i]![0] + dx},${hole[i]![1] + dy}`;
          if (!water.has(n) || seen.has(n)) continue;
          seen.add(n);
          hole.push(fromKey(n));
        }
      holes.push(hole);
    }
    return holes;
  }

  /**
   * Was an einem Eisloch falsch ist: zu klein, ohne weiße Scholle, Ufer (alles näher als `hole.r + shore` an der Mitte
   * des Lochs) nicht eben aus Eis oder nicht erreichbar
   */
  function holeFaults(w: World, hole: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const wrong: string[] = [];
    const at = hole[0]!.join(',');
    if (hole.length < 5) wrong.push(`Loch ${at} mit ${hole.length} Feldern`);
    const floes = hole.filter(([x, y]) => w.cell(x, y).deco === 'floe');
    if (!floes.length) wrong.push(`Loch ${at} ohne Scholle`);
    wrong.push(
      ...floes.filter(([x, y]) => w.cell(x, y).color !== KESSEL_COLORS.floe[1]).map((p) => `Scholle ${keyOf(p)}`),
    );
    const mx = hole.reduce((a, [x]) => a + x, 0) / hole.length;
    const my = hole.reduce((a, [, y]) => a + y, 0) / hole.length;
    const r = KESSEL.hole.r + KESSEL.hole.shore;
    const shore: (readonly [number, number])[] = [];
    for (let y = Math.floor(my - r); y <= Math.ceil(my + r); y++)
      for (let x = Math.floor(mx - r); x <= Math.ceil(mx + r); x++)
        if (Math.hypot(x - mx, y - my) < r && w.cell(x, y).ground !== 'water') shore.push([x, y]);
    if (shore.length < 16) wrong.push(`Loch ${at} mit ${shore.length} Feldern Ufer`);
    for (const [x, y] of shore)
      if (w.cell(x, y).ground !== 'ice' || standHeight(w, [], x, y) !== 1 || !reach.has(`${x},${y}`))
        wrong.push(`Ufer ${x},${y}`);
    return wrong;
  }

  /** Was an den Seen falsch ist: zu klein, nicht erreichbar, Spur, Kiste oder Plattform am Wasser, zu viel Eis */
  function lakeFaults(w: World, floor: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const wrong: string[] = [];
    const cell = ([x, y]: readonly [number, number]) => w.cell(x, y);
    const lake = floor.filter((p) => cell(p).ground === 'ice' && cell(p).h === 1 && !cell(p).slide);
    if (lake.length < 250) wrong.push(`nur ${lake.length} Felder Seen`);
    wrong.push(...lake.filter((p) => !reach.has(keyOf(p))).map((p) => `See ${keyOf(p)} nicht erreichbar`));
    // Spur, Kisten und Plattformen bleiben vom Wasser weg: Ihre Wege führen nie über ein Loch
    const marked = floor.filter((p) => cell(p).slide || cell(p).portal || cell(p).deco === 'fishcrate');
    for (const [x, y] of marked)
      if (RING_1.some(([dx, dy]) => w.cell(x + dx, y + dy).ground === 'water')) wrong.push(`am Wasser ${x},${y}`);
    const icy = floor.filter((p) => ['ice', 'water'].includes(cell(p).ground)).length;
    if (icy / floor.length > 0.15) wrong.push(`${((icy / floor.length) * 100).toFixed(1)} % Eis und Wasser`);
    return wrong;
  }

  it(`Zugefrorene Seen mit je einem Eisloch: Schollen darauf, Ufer eben und erreichbar, Eis und Wasser höchstens 15 % des Bodens, kein Weg abgeschnitten (${VALLEY_SEEDS.length} Seeds)`, () => {
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed, ICE);
      const floor = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const reach = new Set(reachable(w, [], w.homes.eis.wake[0]!, 200000).map(keyOf));
      // je See ein Loch (Wasser, Höhe 0), darauf mindestens eine weiße Scholle; ringsum ebenes Ufer aus Eis, erreichbar
      const holes = holesOf(w, floor);
      const wrong = holes.flatMap((hole) => holeFaults(w, hole, reach));
      if (holes.length !== KESSEL.lakes.length) wrong.push(`${holes.length} Eislöcher`);
      // Seen: glattes Eis auf Höhe 1, begehbar und vom Schneebett erreichbar (ein See schneidet keinen Weg ab)
      wrong.push(...lakeFaults(w, floor, reach));
      // Wohnplätze nur auf erreichbarem Boden (keine Inseln)
      wrong.push(
        ...w
          .spotsOf('eis')
          .filter((p) => !reach.has(keyOf(p)))
          .map((p) => `Wohnplatz ${keyOf(p)}`),
      );
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
  });

  /**
   * Was an der Wand des Eisfalls falsch ist: eine Klippe höher als der Fall, kein Becken aus erreichbarem Eis davor, zu
   * wenig Seiten zur Kamera (sie blickt von Süden: Wo der Fall nach Süden über das Feld davor ragt, zeigt sie seine Seite)
   */
  function fallWallFaults(
    w: World,
    cells: readonly (readonly [number, number])[],
    fall: readonly (readonly [number, number])[],
  ) {
    const wrong: string[] = [];
    const isFall = (x: number, y: number) => !!w.cell(x, y).color && w.cell(x, y).region === 'border';
    for (const [x, y] of cells)
      if (w.cell(x, y).region === 'border' && w.cell(x, y).h > KESSEL.fall.h) wrong.push(`Klippe ${x},${y}`);
    const reach = new Set(reachable(w, [], w.homes.eis.wake[0]!, 200000).map(keyOf));
    const foot = fall
      .flatMap(([x, y]) => RING_1.map(([dx, dy]) => [x + dx, y + dy] as const))
      .filter(([x, y]) => w.cell(x, y).region === 'eis');
    if (foot.length < 10) wrong.push(`nur ${foot.length} Felder am Fuß`);
    for (const [x, y] of foot)
      if (w.cell(x, y).ground !== 'ice' || w.cell(x, y).h !== 1 || !reach.has(`${x},${y}`)) wrong.push(`Fuß ${x},${y}`);
    const faces = fall.filter(([x, y]) => !isFall(x, y + 1) && w.cell(x, y + 1).h < KESSEL.fall.h).length;
    if (faces < 6) wrong.push(`nur ${faces} Seiten zur Kamera`);
    return wrong;
  }

  it(`Eisfall am Talende: glatte Wand aus gefrorenem Wasser in der Mitte des hinteren Endes, so hoch wie die höchsten Klippen, davor ein Becken aus Eis; von der Kamera (Süden) aus zu sehen, gleich wie das Tal läuft; in Sichtweite der Plattform des Eis-Portals (${VALLEY_SEEDS.length} Seeds)`, () => {
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed, ICE);
      const home = w.homes.eis;
      const { out } = w.gates.get('eis')!;
      const cells = kesselPlace(seed, EIS_PACK).cells;
      const along = ([x, y]: readonly number[]) => (x! - home.bed[0]) * out[0] + (y! - home.bed[1]) * out[1];
      const across = ([x, y]: readonly number[]) => (x! - home.bed[0]) * out[1] - (y! - home.bed[1]) * out[0];
      const fall = cells.filter(([x, y]) => w.cell(x, y).color && w.cell(x, y).region === 'border');
      const wrong: string[] = [];
      if (fall.length < 40) wrong.push(`nur ${fall.length} Felder Eisfall`);
      const end = Math.max(...w.spotsOf('eis').map(along)); // hinterster Wohnplatz im Tal
      for (const p of fall) {
        const c = w.cell(...p);
        if (c.color !== KESSEL_COLORS.fall || !c.solid || c.deco !== 'rock') wrong.push(`Eisfall ${keyOf(p)}`);
        if (c.h !== KESSEL.fall.h) wrong.push(`Eisfall ${keyOf(p)} mit Höhe ${c.h}`);
        if (along(p) < end - 5 || Math.abs(across(p)) > KESSEL.fall.half) wrong.push(`nicht am Talende ${keyOf(p)}`);
      }
      wrong.push(...fallWallFaults(w, cells, fall));
      // nur Klippen sind gefärbt (keine Bodenfelder außer Kristallen, Schollen und den Stufen des Eisbergs)
      for (const [x, y] of cells) {
        const c = w.cell(x, y);
        if (c.color && c.region !== 'border' && c.deco !== 'crystal' && c.deco !== 'floe' && !isBerg(c))
          wrong.push(`Farbe ${x},${y}`);
      }
      const gate = w.portals.get('eiskessel')!.gate;
      const near = Math.min(...fall.map((p) => Math.hypot(p[0] - gate[0], p[1] - gate[1])));
      if (near > 20) wrong.push(`Plattform ${near.toFixed(1)} Felder vom Eisfall`);
      expect(wrong, `Seed ${seed}`).toEqual([]);
    }
  });

  /** Fehler in der Höhe des Tals: absolute Höhe über 5 oder mehr als eine Stufe zwischen Nachbarn */
  function heightFaults(w: World, floor: readonly (readonly [number, number])[]) {
    const wrong: string[] = [];
    for (const [x, y] of floor) {
      const h = standHeight(w, [], x, y);
      if (h === null) continue;
      if (h > (onHill(w, x, y) ? HILL.top : KESSEL.berg.top)) wrong.push(`zu hoch ${x},${y}`);
      for (const [dx, dy] of Object.values(DIRS)) {
        const to = standHeight(w, [], x + dx, y + dy);
        if (to !== null && Math.abs(to - h) > 1) wrong.push(`Stufe ${x},${y} → ${x + dx},${y + dy}`);
      }
    }
    return wrong;
  }

  /**
   * Was an den Stufen des Eisbergs falsch ist: zu wenige, nicht aus begehbarem Eis auf Höhe 2 bis 5, nicht erreichbar,
   * eine Höhe fehlt, Tanne, Kristall, Eisblock oder Wasser bis zwei Felder daneben
   */
  function stepFaults(w: World, berg: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const wrong: string[] = [];
    if (berg.length < 60) wrong.push(`nur ${berg.length} Felder Eisberg`);
    for (const p of berg) {
      const c = w.cell(...p);
      if (c.ground !== 'ice' || c.solid || c.h < 2 || c.h > KESSEL.berg.top) wrong.push(`Stufe ${keyOf(p)} (${c.h})`);
      if (!reach.has(keyOf(p))) wrong.push(`Stufe ${keyOf(p)} nicht erreichbar`);
      for (const [dx, dy] of RING_2) {
        const n = w.cell(p[0] + dx, p[1] + dy);
        if (n.deco === 'tree' || n.deco === 'crystal' || isBlock(n) || n.ground === 'water')
          wrong.push(`${n.deco ?? n.ground} am Eisberg`);
      }
    }
    // jede Höhe von 2 bis 5 kommt vor: Stufe für Stufe hinauf
    for (let h = 2; h <= KESSEL.berg.top; h++) if (!berg.some((p) => w.cell(...p).h === h)) wrong.push(`keine ${h}`);
    return wrong;
  }

  /**
   * Was am Eisberg falsch ist: Stufen nicht aus begehbarem Eis, nicht erreichbar, eine Höhe fehlt, Gipfel nicht auf 5,
   * fern vom See oder vom Hauptweg (der Achse vom Schneebett zum Eis-Portal), kein Steg, etwas wächst darauf
   */
  function bergFaults(w: World, floor: readonly (readonly [number, number])[], reach: ReadonlySet<string>) {
    const bed = w.homes.eis.bed;
    const gate = w.portals.get('eiskessel')!.gate;
    const out = [Math.sign(gate[0] - bed[0]), Math.sign(gate[1] - bed[1])] as const;
    /** Abstand quer zur Achse des Tals */
    const across = ([x, y]: readonly number[]) => Math.abs(out[0] ? y! - bed[1] : x! - bed[0]);
    const berg = floor.filter(([x, y]) => isBerg(w.cell(x, y)));
    const wrong = stepFaults(w, berg, reach);
    // Gipfel auf Höhe 5, dort steht die Fahne
    const peak = bergPeak(w);
    if (!peak || w.cell(...peak).h !== KESSEL.berg.top || !isBerg(w.cell(...peak))) return [...wrong, 'kein Gipfel'];
    if (!reach.has(keyOf(peak))) wrong.push('Gipfel nicht erreichbar');
    // am See: offenes Wasser seines Eislochs nah
    const water = floor.filter(([x, y]) => w.cell(x, y).ground === 'water');
    const d = Math.min(...water.map((p) => Math.hypot(p[0] - peak[0], p[1] - peak[1])));
    if (d < 8 || d > 16) wrong.push(`Eisloch ${d.toFixed(1)} Felder vom Gipfel`);
    // in Sichtweite des Hauptwegs (3D zeigt etwa 40 Felder weit)
    if (across(peak) > 40) wrong.push(`Gipfel ${across(peak)} Felder neben der Achse`);
    // Steg: in der Reihe des Gipfels durchgehend glattes Eis auf Höhe 1, von `steg` Feldern neben der Achse bis an die
    // unterste Stufe (dazwischen das Eis ringsum)
    const { steg, plateau, top, step } = KESSEL.berg;
    const side = Math.sign(out[0] ? peak[1] - bed[1] : peak[0] - bed[0]);
    const foot = across(peak) - Math.ceil(plateau + (top - 2) * step); // letztes Feld vor der untersten Stufe
    for (let a = steg; a <= foot; a++) {
      const p: [number, number] = out[0] ? [peak[0], bed[1] + side * a] : [bed[0] + side * a, peak[1]];
      const c = w.cell(...p);
      if (c.region !== 'eis' || c.ground !== 'ice' || c.h !== 1 || c.solid) wrong.push(`Steg unterbrochen bei ${a}`);
    }
    return wrong;
  }

  it(`Eisberg am See: Stufe für Stufe bis Höhe 5 erreichbar, nie mehr als eine Stufe, Fahne auf dem Gipfel, Steg zur Mitte des Tals, in Sichtweite des Hauptwegs; Seeufer und Eislöcher bleiben erreichbar (${VALLEY_SEEDS.length} Seeds)`, () => {
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed, ICE);
      const floor = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const reach = new Set(reachable(w, [], w.homes.eis.wake[0]!, 200000).map(keyOf));
      const wrong = [...heightFaults(w, floor), ...bergFaults(w, floor, reach)];
      // Seeufer und Eislöcher bleiben erreichbar (auch der See am Eisberg)
      wrong.push(...holesOf(w, floor).flatMap((hole) => holeFaults(w, hole, reach)), ...lakeFaults(w, floor, reach));
      expect([...new Set(wrong)], `Seed ${seed}`).toEqual([]);
    }
  });

  it(`Eis-Portal: Plattform am Talende und im Ring um das Schneebett: 3 × 3, erreichbar, ringsum frei (${PORTAL_SEEDS.length} Seeds)`, () => {
    for (const seed of PORTAL_SEEDS) expect(icePortalFaults(worldOf(seed, ICE)), `Seed ${seed}`).toEqual([]);
  });

  it(`Gletschertal: Dichte etwa 10 Dinge je 100 Felder samt Fülle; Wege wie auf der Lichtung: Tor → Schneebett kurz, das fernste Feld weit (${VALLEY_SEEDS.length} Seeds)`, () => {
    let things = 0,
      walk = 0;
    for (const seed of VALLEY_SEEDS) {
      const w = worldOf(seed, ICE);
      const floor = kesselPlace(seed, EIS_PACK).cells.filter(([x, y]) => w.cell(x, y).region === 'eis');
      const open = floor.filter(([x, y]) => standHeight(w, ['eis'], x, y) !== null);
      // Dinge: Tannen, Eisblöcke, Kristalle, Schneewehen, Fischkisten und die Fülle im Schnee (nicht Bett, Wiese und
      // Plattformen)
      const n = floor.filter(([x, y]) => {
        const c = w.cell(x, y);
        return (!!c.deco && !c.garden && !c.portal) || isBlock(c);
      }).length;
      expect(n / open.length, `Seed ${seed}`).toBeGreaterThan(0.085);
      expect(n / open.length, `Seed ${seed}`).toBeLessThan(0.13);
      things += n;
      walk += open.length;
      // Laufwege (Schritte, Tor offen): vom ersten Feld hinter dem Tor zum Schneebett und vom Bett zum fernsten Feld
      const gate = w.gates.get('eis')!;
      const from = (start: readonly [number, number]) => {
        const dist = new Map([[keyOf(start), 0]]);
        const queue = [start];
        for (let i = 0; i < queue.length; i++) {
          const [x, y] = queue[i]!;
          for (const [dx, dy] of Object.values(DIRS)) {
            const k = `${x + dx},${y + dy}`;
            if (dist.has(k) || !canStep(w, ['eis'], x, y, x + dx, y + dy) || w.realm(x + dx, y + dy) !== 'eis')
              continue;
            dist.set(k, dist.get(keyOf([x, y]))! + 1);
            queue.push([x + dx, y + dy]);
          }
        }
        return dist;
      };
      const bed = from(w.homes.eis.wake[0]!);
      let t = 1;
      while (w.realm(gate.mid[0] + gate.out[0] * t, gate.mid[1] + gate.out[1] * t) !== 'eis') t++;
      const toBed = t + bed.get(keyOf([gate.mid[0] + gate.out[0] * t, gate.mid[1] + gate.out[1] * t]))!;
      // gemessen: im Tal selbst (ab dem ersten Feld hinter dem Gang) 40 bis 52 Schritte, mit dem Gang 52 bis 74
      expect(toBed - t, `Seed ${seed}: Mündung → Schneebett (Schritte)`).toBeGreaterThanOrEqual(38);
      expect(toBed - t, `Seed ${seed}: Mündung → Schneebett (Schritte)`).toBeLessThanOrEqual(56);
      expect(toBed, `Seed ${seed}: Tor → Schneebett`).toBeLessThanOrEqual(78);
      const far = Math.max(...bed.values());
      // gemessen 138 bis 141 (Lichtung 111 bis 124)
      expect(far, `Seed ${seed}: fernstes Feld`).toBeGreaterThanOrEqual(130);
      expect(far, `Seed ${seed}: fernstes Feld`).toBeLessThanOrEqual(150);
      // das Schneebett liegt nah an der Mündung: etwa 30 Felder hinter dem ersten Feld des Tals
      const mouth = Math.max(
        ...[...crossings(w)[0]!.entries]
          .filter(([, r]) => r === 'eis')
          .map(([k]) => {
            const [x, y] = k.split(',').map(Number) as [number, number];
            return chebOf([x, y], w.homes.eis.bed);
          }),
      );
      expect(mouth, `Seed ${seed}: Mündung → Schneebett`).toBeGreaterThanOrEqual(25);
      expect(mouth, `Seed ${seed}: Mündung → Schneebett`).toBeLessThanOrEqual(36);
    }
    expect(things / walk).toBeGreaterThan(0.095);
    expect(things / walk).toBeLessThan(0.115);
  });

  type HillOf = NonNullable<ReturnType<typeof hillOf>>;
  const chebTo = ([tx, ty]: readonly [number, number], [x, y]: readonly [number, number]) =>
    Math.max(Math.abs(x - tx), Math.abs(y - ty));

  /** Die Bahn: vom Gipfel Feld an Feld, nie bergauf, begehbar, als Strecke markiert, am Ende unten */
  function runFaults(w: World, hill: HillOf): string[] {
    const wrong: string[] = [];
    hill.run.forEach((p, i) => {
      const c = w.cell(...p);
      const before = hill.run[i - 1];
      if (c.ride !== 'rodel' || c.solid || c.deco || standHeight(w, ['eis'], ...p) === null)
        wrong.push(`Bahn ${p.join(',')}`);
      if (!before) return;
      if (Math.abs(p[0] - before[0]) + Math.abs(p[1] - before[1]) !== 1)
        wrong.push(`Lücke in der Bahn bei ${p.join(',')}`);
      if (c.h > w.cell(...before).h) wrong.push(`Bahn bergauf bei ${p.join(',')}`);
    });
    if (hill.run[0]!.join(',') !== hill.top.join(',')) wrong.push('Bahn beginnt nicht am Gipfel');
    if (w.cell(...hill.run.at(-1)!).h > 2) wrong.push('Bahn endet nicht unten');
    return wrong;
  }

  /** Die Treppe: zwei Felder je Stufe, westlich vom Gipfel, mindestens so hoch wie der Berg dort */
  function stairFaults(w: World, hill: HillOf): string[] {
    const wrong: string[] = [];
    if (hill.stairs.length !== 2 * HILL.rings) wrong.push(`${hill.stairs.length} Stufen`);
    for (const p of hill.stairs) {
      const c = w.cell(...p);
      if (c.deco !== 'hillstep' || c.solid || c.ride || p[0] >= hill.top[0]) wrong.push(`Stufe ${p.join(',')}`);
      // mindestens so hoch wie der Berg dort (am Fuß kann ein Hügel des Tals höher liegen), nie über dem Gipfel
      if (c.h < HILL.top - chebTo(hill.top, p) || c.h > HILL.top) wrong.push(`Stufe ${p.join(',')} auf Höhe ${c.h}`);
    }
    return wrong;
  }

  /** Nichts Geschütztes ist nah, der Berg liegt auf nichts, was frei bleibt, und jedes seiner Felder ist begehbar */
  function aroundFaults(w: World, hill: HillOf): string[] {
    const wrong: string[] = [];
    const [tx, ty] = hill.top;
    const kept = ['snowheap', 'crystal', 'fishcrate', 'icicle'];
    const r = HILL.rings + HILL.keep;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const c = w.cell(tx + dx, ty + dy);
        if (kept.includes(c.deco!)) wrong.push(`${c.deco} am Berg bei ${tx + dx},${ty + dy}`);
        if (c.slide || c.garden || c.portal || c.ride === 'schlitten')
          wrong.push('Berg auf Spur, Wiese, Plattform oder Strecke');
        const on = Math.max(Math.abs(dx), Math.abs(dy)) <= HILL.rings;
        if (on && standHeight(w, ['eis'], tx + dx, ty + dy) === null)
          wrong.push(`Berg nicht begehbar ${tx + dx},${ty + dy}`);
      }
    return wrong;
  }

  /** Kein Tier wohnt auf Berg, Auslauf oder Warteplätzen; die Warteplätze sind frei */
  function spotFaults(w: World, hill: HillOf): string[] {
    const wrong: string[] = [];
    const off = new Set([...hill.run, ...hill.foot].map(keyOf));
    for (const p of w.spotsOf('eis'))
      if (chebTo(hill.top, p) <= HILL.rings || off.has(keyOf(p))) wrong.push(`Wohnplatz am Berg ${p.join(',')}`);
    for (const p of hill.foot)
      if (standHeight(w, ['eis'], ...p) === null || w.cell(...p).ride) wrong.push(`Warteplatz ${p.join(',')}`);
    return wrong;
  }

  /** Was am Rodelberg eines Tals nicht stimmt (Issue 50) */
  function hillFaults(seed: number): string[] {
    const w = worldOf(seed, ICE);
    const hill = hillOf(w);
    if (!hill) return [`Seed ${seed}: kein Rodelberg`];
    const wrong: string[] = [];
    const [tx, ty] = hill.top;
    const bed = w.homes.eis.bed;
    const far = Math.hypot(tx - bed[0], ty - bed[1]);
    if (far < HILL.near[0] || far > HILL.near[1]) wrong.push(`Gipfel ${far.toFixed(0)} Felder vom Bett`);
    if (w.cell(tx, ty).h !== HILL.top || w.cell(tx, ty).stop !== 'rodel') wrong.push('Gipfel nicht auf Höhe 7');
    wrong.push(...runFaults(w, hill), ...stairFaults(w, hill), ...aroundFaults(w, hill), ...spotFaults(w, hill));
    return wrong.slice(0, 6).map((m) => `Seed ${seed}: ${m}`);
  }

  it(`Rodelberg: in jedem Tal einer, Gipfel auf Höhe 7, Treppe im Westen, Bahn nie bergauf, nichts Geschütztes weicht, kein Wohnplatz darauf (${VALLEY_SEEDS.length} Seeds)`, () => {
    expect(VALLEY_SEEDS.flatMap(hillFaults)).toEqual([]);
  });

  /** Was an den Spielorten eines Tals nicht stimmt (Issue 52): Zahlen-Fähnchen und Laternen-Tannen */
  function placeFaults(seed: number): string[] {
    const w = worldOf(seed, ICE);
    const cells = kesselPlace(seed, EIS_PACK).cells.map((p) => [p, w.cell(...p)] as const);
    const wrong: string[] = [];
    const bed = w.homes.eis.bed;
    const far = ([x, y]: readonly [number, number]) => Math.hypot(x - bed[0], y - bed[1]);
    const flags = cells.filter(([, c]) => c.deco === 'numflag').sort((a, b) => a[1].note! - b[1].note!);
    if (flags.map(([, c]) => c.note).join('') !== '123456789')
      wrong.push(`Fähnchen ${flags.map(([, c]) => c.note).join(' ')}`);
    flags.forEach(([p, c], i) => {
      if (c.solid || c.ground !== 'snow' || c.ride || c.slide || c.garden || c.portal || c.stop)
        wrong.push(`Fähnchen ${c.note} bei ${p.join(',')}`);
      if (standHeight(w, ['eis'], ...p) === null) wrong.push(`Fähnchen ${c.note} nicht begehbar`);
      const before = flags[i - 1];
      // vom Bett weg in Reihenfolge: jedes weiter als das davor, nie dicht beieinander
      if (before && far(p) <= far(before[0])) wrong.push(`Fähnchen ${c.note} näher am Bett als ${c.note! - 1}`);
      if (before && chebTo(before[0], p) < 4) wrong.push(`Fähnchen ${c.note} dicht an ${c.note! - 1}`);
      if (cells.some(([q, n]) => n.deco === 'icicle' && chebTo(p, q) <= 4))
        wrong.push(`Fähnchen ${c.note} am Glockenspiel`);
    });
    const lamps = cells.filter(([, c]) => c.lamp);
    if (lamps.length < 8 || lamps.length > 12) wrong.push(`${lamps.length} Laternen-Tannen`);
    for (const [p, c] of lamps) {
      if (c.tree !== 'snowpine' || !c.solid) wrong.push(`Laterne ohne Tanne bei ${p.join(',')}`);
      if (lamps.some(([q]) => q !== p && Math.hypot(q[0] - p[0], q[1] - p[1]) < 16))
        wrong.push(`Laternen dicht bei ${p.join(',')}`);
    }
    return wrong.slice(0, 5).map((m) => `Seed ${seed}: ${m}`);
  }

  it(`Spielorte: neun Zahlen-Fähnchen in Reihenfolge vom Bett weg auf blankem Schnee, acht bis zwölf Laternen-Tannen weit verteilt (${VALLEY_SEEDS.length} Seeds)`, () => {
    expect(VALLEY_SEEDS.flatMap(placeFaults)).toEqual([]);
  });
});
