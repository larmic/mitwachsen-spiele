// Zwei Spielorte im Gletschertal (Issue 52) – rein und deterministisch. Zahlen-Fähnchen: neun Fähnchen mit den Ziffern
// 1 bis 9 am Hauptweg vom Schneebett zum Eisfall (`'numflag'`, flach und begehbar, `note`: die Zahl); kommt die Figur
// in die Nähe eines Fähnchens (bis ein Feld, auch schräg), bimmelt es (`numflag`), höher mit der Zahl, und sie läuft
// weiter. Laternen-Tannen: einige der Tannen tragen eine Kristall-Laterne ohne Flamme (`Cell.lamp`); läuft die Figur in
// eine hinein, leuchtet sie (`treelamp`) und bleibt an (gespeichert in `packs.eis.lit`, wie die Schneemänner): So
// leuchtet das Tal dort, wo das Kind schon war. Beide werden nach allem Gewürfelten gesetzt (mitwachsen-kessel.ts), es
// weicht nichts: Fähnchen stehen nur auf blankem Schnee, Laternen hängen an Tannen, die schon da sind.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Spielorte im Eis“)

import { hash } from '../../../../lib/games/rng';
import type { Point } from '../../../../data/games/mitwachsen';
import { PLACES } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell } from '../../mitwachsen-cell';
import type { WorldRules } from '../../mitwachsen-pack-types';
import { key } from './mitwachsen-flood';

/** Blanker Schnee für ein Fähnchen: nichts darauf, keine Strecke, Spur, Wiese, Plattform, kein Halt */
const bare = (c: Cell | undefined): c is Cell =>
  !!c &&
  c.region === 'eis' &&
  !c.solid &&
  !c.deco &&
  c.ground === 'snow' &&
  !c.slide &&
  !c.garden &&
  !c.portal &&
  !c.ride &&
  !c.stop;

/**
 * Plätze der Fähnchen am Hauptweg, vom Bett weg (`PLACES.flags`); `at`: Feld für eine Lage (quer, vom Tor weg) vom
 * Schneebett aus
 */
export const flagSpots = (at: (across: number, out: number) => Point): Point[] =>
  Array.from({ length: PLACES.flags.count }, (_, i) => at(PLACES.flags.across, PLACES.flags.every * (i + 1)));

/** Kein Eiszapfen des Glockenspiels bis `PLACES.flags.apart` Felder (Schachbrett): Dort klingt schon etwas */
function apart([x, y]: Point, map: ReadonlyMap<string, Cell>): boolean {
  const r = PLACES.flags.apart;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) if (map.get(key(x + dx, y + dy))?.deco === 'icicle') return false;
  return true;
}

/**
 * Die Fähnchen setzen: Nummer i am Platz `spots[i − 1]` (Hauptweg, vom Bett weg), dort auf dem nächsten blanken Feld
 * bis `PLACES.flags.reach` weit (nie auf `shut`: Rodelberg, Strecke des Schlittens; nie nah am Glockenspiel). Wo kein Feld frei ist, fehlt die
 * Nummer
 */
export function placeFlags(spots: readonly Point[], map: Map<string, Cell>, shut: ReadonlySet<string>) {
  const { reach } = PLACES.flags;
  spots.forEach(([sx, sy], i) => {
    let best: { p: Point; d: number } | undefined;
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const p: Point = [sx + dx, sy + dy];
        const d = Math.hypot(dx, dy);
        if ((!best || d < best.d) && !shut.has(key(...p)) && bare(map.get(key(...p))) && apart(p, map)) best = { p, d };
      }
    if (best) map.set(key(...best.p), { ...map.get(key(...best.p))!, deco: 'numflag', note: i + 1 });
  });
}

/**
 * Laternen an Tannen hängen: von den Tannen auf den Feldern `cells` höchstens `PLACES.lamps.count`, in gewürfelter
 * Reihenfolge, je zwei mindestens `PLACES.lamps.spacing` Felder auseinander (so verteilen sie sich über das ganze Tal)
 */
export function hangLamps(seed: number, cells: readonly Point[], map: Map<string, Cell>) {
  const { count, spacing } = PLACES.lamps;
  const pines = cells.filter((p) => map.get(key(...p))?.tree === 'snowpine');
  const roll = ([x, y]: Point) => hash(seed, x, y, 160);
  const hung: Point[] = [];
  for (const p of pines.sort((a, b) => roll(a) - roll(b))) {
    if (hung.length >= count) break;
    if (!hung.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= spacing)) continue;
    map.set(key(...p), { ...map.get(key(...p))!, lamp: true });
    hung.push(p);
  }
}

const NONE: ReadonlySet<string> = new Set();
const FIELD = /^-?\d+,-?\d+$/;
const clean = new WeakMap<object, ReadonlySet<string>>();
/**
 * Angezündete Laternen ("x,y") aus dem gespeicherten Zustand der Eis-Welt (`packs.eis.lit`); ältere Stände ohne Eintrag
 * und kaputte Einträge ergeben keine
 */
export function litOf(packs: Readonly<Record<string, unknown>>): ReadonlySet<string> {
  const raw = packs.eis;
  if (typeof raw !== 'object' || raw === null) return NONE;
  let lit = clean.get(raw);
  if (!lit) {
    const list = (raw as { lit?: unknown }).lit;
    lit = new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string' && FIELD.test(k)) : []);
    clean.set(raw, lit);
  }
  return lit;
}

/** Das Fähnchen bis ein Feld (auch schräg) um (x, y), sonst undefined */
function flagNear(cell: (x: number, y: number) => Cell, x: number, y: number): [number, number, number] | undefined {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const c = cell(x + dx, y + dy);
      if (c.deco === 'numflag' && c.note) return [x + dx, y + dy, c.note];
    }
  return undefined;
}

/**
 * Die Figur läuft in eine Laternen-Tanne: Ihre Laterne geht an (`treelamp`, gespeichert), die Figur bleibt stehen, ohne
 * anzustoßen; brennt sie schon, stößt sie an wie an jeder Tanne. Die Figur kommt in die Nähe eines Fähnchens (ihr
 * nächster Schritt geht, und das Feld davor lag noch nicht an diesem Fähnchen): Es bimmelt (`numflag`), sie läuft weiter
 */
const bump: WorldRules['bump'] = (s, c, x, y, events, { walks, cell }) => {
  if (c.lamp && c.tree === 'snowpine') {
    const lit = litOf(s.packs);
    if (lit.has(key(x, y))) return false;
    const eis = typeof s.packs.eis === 'object' && s.packs.eis !== null ? s.packs.eis : { v: 1, snow: {} };
    s.packs = { ...s.packs, eis: { ...eis, lit: [...lit, key(x, y)] } };
    events.push({ type: 'treelamp', x, y });
    return true;
  }
  if (!walks) return false;
  const flag = flagNear(cell, x, y);
  const was = flag && flagNear(cell, s.player.x, s.player.y);
  if (flag && !(was && was[0] === flag[0] && was[1] === flag[1]))
    events.push({ type: 'numflag', x: flag[0], y: flag[1], n: flag[2] });
  return false;
};

export const rules: WorldRules = { bump };
