// Vier Spielorte in der Kristallgrotte (Issue 56) – rein und deterministisch. Schlafende Leuchtpilze (`'sleepshroom'`,
// fest): Läuft die Figur in einen hinein, wacht er auf, leuchtet und bleibt an. Kristallhaufen (`'crystalheap'`, fest):
// Jedes Hineinlaufen lässt ihn um eine Stufe wachsen, bis ein Türmchen steht (wie die Schneemänner im Eis). Zahlen-
// Kristalle (`'numstone'`, flach und begehbar, `note` 1 bis 9) am Hauptweg vom Höhlenbett zum stillen See: Kommt die
// Figur in die Nähe, klingt der Stein, höher mit seiner Zahl. Die Echo-Wand (`'echostone'`, fest): Hineinlaufen lässt
// einen Ton leiser zurückkommen. Geweckte Pilze und Stufen der Türme merkt der Zustand der Höhlenwelt (`packs.hoehle`,
// gleich gespeichert). Gesetzt wird alles nach der Füllung und den Fackeln (mitwachsen-grotte.ts): Feste Dinge stehen
// frei wie eine Fackel (ringsum acht begehbare Felder auf gleicher Höhe, man läuft immer herum), nie auf Wegen, an der
// Schleife der Grubenbahn, am Bahnsteig, auf Wiese oder Plattform; es weicht nur flache Zierde.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Spielorte in der Grotte“)

import { hash } from '../../../../lib/games/rng';
import type { Point } from '../../../../data/games/mitwachsen';
import { CAVE_PLACES, GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { WorldRules } from '../../mitwachsen-pack-types';
import { fits } from './mitwachsen-torch';

const key = (x: number, y: number) => `${x},${y}`;
/** Stufen bis zum fertigen Türmchen */
export const TOWER = CAVE_PLACES.full;

/** Freier Grottenboden für einen Zahlen-Kristall: begehbar, ohne Merkmal, ohne Zierde */
const flat = (c: Cell | undefined): c is Cell =>
  !!c &&
  c.region === 'hoehle' &&
  !c.solid &&
  !c.deco &&
  c.ground === 'grotto' &&
  !c.lane &&
  !c.stop &&
  !c.garden &&
  !c.portal;

/**
 * Wo kein Spielort stehen darf, als Frage je Feld (x, y): im Gang durch den Felsring und im Lampengang (auch sie gehören
 * zur Gegend; `uv`: Lage quer und längs von der Mitte der Grotte), auf Wegen (`way`) und wo die Füllung frei hält (`free`)
 */
export const caveKeep =
  (
    site: { uv(x: number, y: number): Point },
    way: (u: number, v: number) => boolean,
    free: (u: number, v: number) => boolean,
  ) =>
  (x: number, y: number) => {
    const [u, v] = site.uv(x, y);
    return v + GROTTE.shape.ry <= GROTTE.lamps.to + 2 || way(u, v) || free(u, v);
  };

/**
 * Die Spielorte in die fertige Karte der Grotte setzen. `realm`: ihre Felder ("x,y"); `at`: Feld für eine Lage [quer,
 * vom Tor weg]; `keep`: Felder, die frei bleiben (Wege, Bett samt Wiese, Bahnhof, was die Füllung frei hält)
 */
export function placeCave(
  seed: number,
  realm: Iterable<string>,
  map: Map<string, Cell>,
  at: (p: readonly [number, number]) => Point,
  keep: (x: number, y: number) => boolean,
) {
  const solid: Point[] = [];
  const put = (p: Point, more: Partial<Cell>) =>
    map.set(key(...p), { ...map.get(key(...p))!, tufts: undefined, ...more });
  const room = ([x, y]: Point) => !keep(x, y) && fits(map, [x, y]);
  const far = (p: Point) => solid.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= CAVE_PLACES.apart);
  // die Echo-Wand: der freie Platz, der ihrem Wunschplatz am nächsten liegt
  const [ex, ey] = at(CAVE_PLACES.echo.at);
  let echo: { p: Point; d: number } | undefined;
  const r = CAVE_PLACES.echo.reach;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if ((!echo || d < echo.d) && room([ex + dx, ey + dy])) echo = { p: [ex + dx, ey + dy], d };
    }
  if (echo) {
    put(echo.p, { deco: 'echostone', solid: true });
    solid.push(echo.p);
  }
  // Pilze und Haufen: über die ganze Grotte gewürfelt, weit auseinander
  const cells = [...realm].map((k) => k.split(',').map(Number) as unknown as Point);
  const scatter = (deco: 'sleepshroom' | 'crystalheap', count: number, salt: number) => {
    const roll = ([x, y]: Point) => hash(seed, x, y, salt);
    let n = 0;
    for (const p of [...cells].sort((a, b) => roll(a) - roll(b) || a[0] - b[0] || a[1] - b[1])) {
      if (n >= count) break;
      if (!far(p) || !room(p)) continue;
      put(p, { deco, solid: true });
      solid.push(p);
      n++;
    }
  };
  scatter('sleepshroom', CAVE_PLACES.shrooms, 170);
  scatter('crystalheap', CAVE_PLACES.towers, 171);
  // Zahlen-Kristalle am Hauptweg, vom Bett zum See: jeder auf dem nächsten freien Feld
  const { count, from, every, across, reach } = CAVE_PLACES.stones;
  for (let i = 0; i < count; i++) {
    const [sx, sy] = at([across, from + every * i]);
    let best: { p: Point; d: number } | undefined;
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy);
        if ((!best || d < best.d) && flat(map.get(key(sx + dx, sy + dy)))) best = { p: [sx + dx, sy + dy], d };
      }
    if (best) put(best.p, { deco: 'numstone', note: i + 1 });
  }
}

/** Gespeicherter Zustand der Höhlenwelt (`packs.hoehle`): geweckte Pilze ("x,y") und Stufe je Kristallhaufen (1 … `TOWER`) */
export type CaveSave = { v: 1; lit: string[]; towers: Record<string, number> };
const FIELD = /^-?\d+,-?\d+$/;
const EMPTY: Readonly<CaveSave> = Object.freeze({ v: 1, lit: [], towers: {} });
const clean = new WeakMap<object, Readonly<CaveSave>>();

/**
 * Zustand der Spielorte aus dem gespeicherten Zustand der Pakete; ältere Stände ohne Eintrag und kaputte Einträge
 * ergeben schlafende Pilze und bloße Haufen, unbekannte Felder und Stufen außerhalb 1 … `TOWER` fallen weg
 */
export function caveOf(packs: Readonly<Record<string, unknown>>): Readonly<CaveSave> {
  const raw = packs.hoehle;
  if (typeof raw !== 'object' || raw === null) return EMPTY;
  let save = clean.get(raw);
  if (!save) {
    const { lit, towers } = raw as { lit?: unknown; towers?: unknown };
    save = {
      v: 1,
      lit: Array.isArray(lit) ? lit.filter((k): k is string => typeof k === 'string' && FIELD.test(k)) : [],
      towers: Object.fromEntries(
        Object.entries(typeof towers === 'object' && towers !== null ? towers : {}).filter(
          ([k, n]) => FIELD.test(k) && Number.isInteger(n) && (n as number) >= 1 && (n as number) <= TOWER,
        ) as [string, number][],
      ),
    };
    clean.set(raw, save);
  }
  return save;
}
/** Ist der Leuchtpilz auf (x, y) wach? */
export const awake = (packs: Readonly<Record<string, unknown>>, x: number, y: number) =>
  caveOf(packs).lit.includes(key(x, y));
/** Stufe des Kristallhaufens auf (x, y): 0 Haufen … `TOWER` fertiges Türmchen */
export const towerAt = (packs: Readonly<Record<string, unknown>>, x: number, y: number) =>
  caveOf(packs).towers[key(x, y)] ?? 0;

/** Der Zahlen-Kristall bis ein Feld (auch schräg) um (x, y), sonst undefined */
function stoneNear(cell: (x: number, y: number) => Cell, x: number, y: number): [number, number, number] | undefined {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const c = cell(x + dx, y + dy);
      if (c.deco === 'numstone' && c.note) return [x + dx, y + dy, c.note];
    }
  return undefined;
}

/**
 * Die Figur läuft in einen Spielort (`WorldRules.bump`, nach den anderen Regeln der Grotte). Schlafender Pilz: Er wacht
 * auf (`caveshroom`); ist er schon wach, stößt sie an wie an jedem Stein. Kristallhaufen: Er wächst um eine Stufe
 * (`cavetower` mit der neuen Stufe), am fertigen Türmchen stößt sie an. Echo-Wand: Sie antwortet (`echo`). In allen
 * drei Fällen bleibt die Figur stehen, ohne „boing“. Kommt sie in die Nähe eines Zahlen-Kristalls (ihr Schritt geht,
 * und das Feld davor lag noch nicht an diesem Stein), klingt er (`numstone`), und sie läuft weiter
 */
export const bumpPlace: WorldRules['bump'] = (s, c, x, y, events, { walks, cell }) => {
  const save = caveOf(s.packs);
  if (c.deco === 'sleepshroom') {
    if (save.lit.includes(key(x, y))) return false;
    s.packs = { ...s.packs, hoehle: { ...save, lit: [...save.lit, key(x, y)] } };
    events.push({ type: 'caveshroom', x, y });
    return true;
  }
  if (c.deco === 'crystalheap') {
    const stage = (save.towers[key(x, y)] ?? 0) + 1;
    if (stage > TOWER) return false;
    s.packs = { ...s.packs, hoehle: { ...save, towers: { ...save.towers, [key(x, y)]: stage } } };
    events.push({ type: 'cavetower', x, y, stage });
    return true;
  }
  if (c.deco === 'echostone') {
    events.push({ type: 'echo', x, y });
    return true;
  }
  if (!walks) return false;
  const stone = stoneNear(cell, x, y);
  const was = stone && stoneNear(cell, s.player.x, s.player.y);
  if (stone && !(was && was[0] === stone[0] && was[1] === stone[1]))
    events.push({ type: 'numstone', x: stone[0], y: stone[1], n: stone[2] });
  return false;
};
