// Der verlaufene Pinguin wartet in der Bucht vor dem Eistor – rein, ohne DOM: Er stellt sich neben die Torplatte (u +2,
// Reihe 2), schaut sie an und hüpft still alle 2 s; so zeigt er dem Kind, wohin es treten soll. Stehen Figur und
// Pinguin 8 s in der Bucht, die Figur aber nicht auf der Platte, hüpft er selbst auf die Platte, schaut zur Figur und
// winkt (Sicherheitsnetz: kein Kind bleibt hängen). Teil des Führens (mitwachsen-lead.ts) im Welt-Paket der Eis-Welt;
// das Tor öffnet mitwachsen-ritual.ts (`opens`). Wo Bucht, Plattenreihe und sein Platz liegen, gilt für jedes Tor
// gleich und steht außerhalb des Pakets (../../mitwachsen-bay.ts).
// Spezifikation: docs/specs/mitwachsen.md („Der Pinguin holt dich ab“, Regel 8a)

import { BESIDE, inBay, plateRow } from '../../mitwachsen-bay';
import { dirTo, occupied } from '../../mitwachsen-free';
import { GUIDE_GATE, type GuideEvents as Events, type Guided } from '../../mitwachsen-guide';
import type { World } from '../../mitwachsen-world';

type Walker = Guided['animals'][number];

export const BOB_EVERY = 20; // neben der Platte hüpft er alle 2 s still
export const NET = 80; // so viele Takte (8 s) in der Bucht neben der Platte, dann hüpft er selbst darauf

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
