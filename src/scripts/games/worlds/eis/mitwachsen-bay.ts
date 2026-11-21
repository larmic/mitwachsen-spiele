// Der verlaufene Pinguin wartet in der Bucht vor dem Eistor – rein, ohne DOM: Er stellt sich neben die Torplatte (u +2,
// Reihe 2), schaut sie an und hüpft still alle 2 s; so zeigt er dem Kind, wohin es treten soll. Stehen Figur und
// Pinguin 8 s in der Bucht, die Figur aber nicht auf der Platte, hüpft er selbst auf die Platte, schaut zur Figur und
// winkt (Sicherheitsnetz: kein Kind bleibt hängen). Teil des Führens (mitwachsen-lead.ts) im Welt-Paket der Eis-Welt;
// das Tor öffnet mitwachsen-ritual.ts (`opens`).
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“, Regel 8a)

import type { Point } from '../../../../data/games/mitwachsen';
import { dirTo, occupied } from '../../mitwachsen-free';
import { GUIDE_GATE, type GuideEvents as Events, type Guided } from '../../mitwachsen-guide';
import { PLATE_HALF, PLATE_ROW } from '../../mitwachsen-plate';
import type { GatePlace, World } from '../../mitwachsen-world';

type Walker = Guided['animals'][number];
type Door = Pick<GatePlace, 'cells' | 'mid' | 'out'>;

export const BOB_EVERY = 20; // neben der Platte hüpft er alle 2 s still
export const NET = 80; // so viele Takte (8 s) in der Bucht neben der Platte, dann hüpft er selbst darauf
const BAY_DEPTH = 3; // die Bucht reicht so viele Reihen vor die Tür

/** Bucht vor der Tür eines Tors: so breit wie die Tür, `BAY_DEPTH` Reihen davor, die vorderste Reihe zuerst */
export function bay(g: Pick<GatePlace, 'cells' | 'out'>): Point[] {
  const out: Point[] = [];
  for (let t = 1; t <= BAY_DEPTH; t++) for (const [x, y] of g.cells) out.push([x - g.out[0] * t, y - g.out[1] * t]);
  return out;
}

/** Feld in der Reihe der Torplatte (`PLATE_ROW`), quer zum Tor bei u (u wächst nach [−out.y, out.x]; die Platte: −1 … 1) */
export const plateRow = (g: Pick<GatePlace, 'mid' | 'out'>, u: number): Point => [
  g.mid[0] - g.out[0] * PLATE_ROW - g.out[1] * u,
  g.mid[1] - g.out[1] * PLATE_ROW + g.out[0] * u,
];
/** Sein Platz neben der Torplatte (`plateRow(g, BESIDE)`): u = +2 */
export const BESIDE = PLATE_HALF + 1;
/** Liegt (x, y) in der Bucht vor der Tür? */
export const inBay = (g: Door, x: number, y: number) => bay(g).some(([a, b]) => a === x && b === y);

/**
 * Ein Takt, während er führt: Stehen Figur und Pinguin beide in der Bucht, wartet er an der Platte und zählt mit, wie
 * lange die Figur nicht auf ihr steht (`wait`). Steht er neben ihr (oder schon auf ihr), schaut er sie an (bzw. von der
 * Platte aus die Figur) und hüpft still alle `BOB_EVERY` Takte. Nach `NET` Takten hüpft er auf ein freies Feld der
 * Platte (das neben seinem Platz zuerst), schaut zur Figur und winkt (`arrive`: Hüpfer und Herz). Liefert true, wenn
 * er an der Platte wartet; false, wenn er wie sonst führt (die Figur ist nicht in der Bucht, dann beginnt `wait` neu,
 * oder er muss erst noch neben die Platte: Das tut das Führen, `wait` zählt dabei schon).
 */
export function atPlate(s: Guided, world: World, g: Walker, events: Events): boolean {
  const door = world.gates.get(GUIDE_GATE);
  const p = s.player;
  if (!door || !inBay(door, p.x, p.y) || !inBay(door, g.x, g.y)) {
    g.wait = 0;
    return false;
  }
  const on = (x: number, y: number) => world.cell(x, y).plate === GUIDE_GATE;
  const ready = on(g.x, g.y); // schon auf der Platte (Sicherheitsnetz)
  const wait = (g.wait = (g.wait ?? 0) + (on(p.x, p.y) ? 0 : 1)); // zählt nur, solange sie nicht auf der Platte steht
  if (wait >= NET && !ready) {
    const spot = [1, 0, -1].map((u) => plateRow(door, u)).find(([x, y]) => !occupied(s, x, y, g.id));
    if (spot) {
      [g.x, g.y] = spot;
      g.dir = dirTo(p.x - g.x, p.y - g.y);
      events.push({ type: 'arrive', id: g.id, species: g.species });
    }
    return true; // alles besetzt: im nächsten Takt noch einmal
  }
  const [bx, by] = plateRow(door, BESIDE);
  if (!ready && (g.x !== bx || g.y !== by)) return false; // erst noch neben die Platte
  const [tx, ty] = ready ? [p.x, p.y] : plateRow(door, 0);
  g.dir = dirTo(tx - g.x, ty - g.y);
  if (s.tick % BOB_EVERY === 0) events.push({ type: 'bob', id: g.id });
  return true;
}
