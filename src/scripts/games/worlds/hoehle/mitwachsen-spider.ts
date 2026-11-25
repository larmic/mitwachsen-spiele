// Tupfspinnen der Kristallgrotte (Konzept „Höhle nach dem ersten Spielen“, Punkt 9, Schritt 12) – rein und
// deterministisch, im Welt-Paket der Höhlenwelt. Wo: Beim Bauen der Grotte wird aus drei bis vier Stalagmiten der
// Füllung je ein Netz (`'web'`, ein Ding auf einem Feld, fest wie der Stalagmit davor, `spinWebs`): mindestens 8 Felder
// von Bett, Bahnhof Fledermaus und allen Wegen (`GROTTE.web.away`), weit auseinander, mit mindestens einem freien
// Nachbarfeld, von dem aus man hineinläuft. Kein neues Hindernis, nichts versperrt. Jedes Netz leuchtet wie ein Kristall
// (`Cell.light` ringsum, nie Randschatten) und hat sein eigenes festes Lichtloch in der Dunkelmaske (mitwachsen-mask.ts):
// Die Spinne lebt nur im Licht. Spiel: Läuft das Kind gegen das Netz (Regel in mitwachsen-cave-rules.ts, Ereignis
// `web`), bleibt es stehen, ohne „boing“; die Perlen klingen von unten nach oben wie eine gezupfte Harfe, eine Oktave über
// den Säulen (C6 bis A6, `harpScore`), die Spinne seilt sich ein Stück ab, winkt mit zwei Beinen, macht leise „tipp-tipp“
// (`tippScore`) und klettert zurück (`spiderPose`). Sie läuft nie am Boden und nie auf das Kind zu, sie hängt immer über
// ihrem Netz. Bei reduzierter Bewegung kein Abseilen, nur ein Winken mit Ton. Abends und nachts schläft sie mit
// geschlossenen Augen, die Harfe klingt trotzdem. Bild und Ton merkt sich mitwachsen-spider-look.ts. Keine Art der
// Leiste, kein Spielstand, keine `CaveSpeciesId`.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Höhle nach dem ersten Spielen“, Tupfspinne)

import { hash } from '../../../../lib/games/rng';
import type { Point } from '../../../../data/games/mitwachsen';
import type { SpiderPose } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { Scored } from '../../sfx';
import { caveFrame, type Cave } from './mitwachsen-frame';

const W = GROTTE.web;
const { rx, ry } = GROTTE.shape;
const key = (x: number, y: number) => `${x},${y}`;
const NEIGHBOURS: readonly Point[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Töne der fünf Perlen von unten nach oben: C6, D6, E6, G6, A6 (Pentatonik, eine Oktave über den Säulen) */
export const HARP_SCALE = [1046.5, 1174.66, 1318.51, 1567.98, 1760] as const;
/** Harfe: je Perle so lang (s), so viel später als die vorige (s), so leise; Dreieck, gezupft (kurz, ohne Echo) */
export const HARP = { len: 0.28, step: 0.07, gain: 0.03 } as const;

/** Lage der Grotte, wie die Netze sie lesen: Feld zu (u, v) von ihrer Mitte */
type At = (u: number, v: number) => Point;

/**
 * Darf an (u, v) ein Netz hängen? Bis `GROTTE.web.away` Felder ringsum kein Weg (`path`: Mündung, Weg durch die Mitte,
 * Bett samt Wiese, Portalring, Bahnhof, Lokschuppen und Gleisspur) und das Bett mindestens so weit weg
 */
export function farFromPaths(u: number, v: number, path: (u: number, v: number) => boolean, bed: Point): boolean {
  if (Math.hypot(u - bed[0], v - bed[1]) < W.away) return false;
  for (let dv = -W.away; dv <= W.away; dv++)
    for (let du = -W.away; du <= W.away; du++) if (Math.hypot(du, dv) < W.away && path(u + du, v + dv)) return false;
  return true;
}

/** Ein Nachbarfeld (vier Richtungen), auf dem man steht und von dem aus man ins Feld der Höhe `h` läuft */
export const openBeside = (cell: (x: number, y: number) => Cell | undefined, x: number, y: number, h: number) =>
  NEIGHBOURS.some(([dx, dy]) => {
    const n = cell(x + dx, y + dy);
    return !!n && n.region === 'hoehle' && !n.solid && n.ground !== 'water' && Math.abs(n.h - h) <= 1;
  });

/**
 * Die Netze spinnen (`map`, nach Füllung und Erreichbarkeit, vor dem Licht): Stalagmiten der Füllung, die weit genug von
 * Wegen und Bett stehen (`farFromPaths`; `bed` in (u, v)) und ein freies Nachbarfeld haben, in der Reihe eines Wurfs je
 * Seed; davon höchstens `most`, je zwei mindestens `apart` Felder auseinander. Liefert ihre Felder. Geprüft wird erst in
 * der Reihe des Wurfs und nur, bis `most` Netze hängen, `path` je Feld höchstens einmal: Das Bauen jeder Welt mit
 * Grotte zahlt es, im Spiel wie in allen Tests über die Seeds
 */
export function spinWebs(
  seed: number,
  at: At,
  path: (u: number, v: number) => boolean,
  bed: Point,
  map: Map<string, Cell>,
): Point[] {
  const found: { p: Point; u: number; v: number; c: Cell; roll: number }[] = [];
  for (let v = -ry; v <= ry; v++)
    for (let u = -rx; u <= rx; u++) {
      const [x, y] = at(u, v);
      const c = map.get(key(x, y));
      if (c?.deco === 'stalagmite' && c.region === 'hoehle')
        found.push({ p: [x, y], u, v, c, roll: hash(seed, x, y, 150) });
    }
  found.sort((a, b) => a.roll - b.roll || a.p[0] - b.p[0] || a.p[1] - b.p[1]);
  const known = new Map<number, boolean>(); // path je Feld einmal (u, v liegen weit unter 1000)
  const onPath = (u: number, v: number) => {
    const k = (u + 1000) * 2000 + v + 1000;
    let on = known.get(k);
    if (on === undefined) known.set(k, (on = path(u, v)));
    return on;
  };
  const webs: Point[] = [];
  for (const { p, u, v, c } of found) {
    if (webs.length >= W.most) break;
    if (webs.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < W.apart)) continue;
    if (!openBeside((a, b) => map.get(key(a, b)), p[0], p[1], c.h) || !farFromPaths(u, v, onPath, bed)) continue;
    webs.push(p);
    const web: Cell = { ...c, deco: 'web', solid: true };
    delete web.note;
    delete web.color;
    map.set(key(...p), web);
  }
  return webs;
}

/** So lange (ms) dauert der Gruß der Spinne: abseilen, winken, zurückklettern; bei reduzierter Bewegung nur winken */
export const greetMs = (reduced: boolean) => (reduced ? W.wave : W.down + W.wave + W.up);

/** Haltung und Höhe der Spinne über dem Boden (Unterkante, Felder; in Stufen von 0,05) */
export type Hang = { pose: SpiderPose; lift: number };

/** Höhe in Stufen von 0,05 (so baut 3D nur wenige Modelle) */
const step = (lift: number) => Math.round(lift * 20) / 20;

/**
 * Wie die Spinne `ms` nach dem Beginn ihres Grußes hängt: in `down` ms ein Stück hinab (`drop`), `wave` ms winken (die
 * Beine wechseln alle `beat` ms), in `up` ms zurück; davor und danach still auf `rest`. Bei reduzierter Bewegung bleibt
 * sie oben und winkt nur. Schläft sie (`asleep`), hängt sie still mit geschlossenen Augen. Nie am Boden
 */
export function spiderPose(ms: number, reduced: boolean, asleep: boolean): Hang {
  const rest: Hang = { pose: asleep ? 'asleep' : 'rest', lift: W.rest };
  if (asleep || !(ms >= 0) || ms >= greetMs(reduced)) return rest;
  const wave = (t: number): SpiderPose => (Math.floor(t / W.beat) % 2 ? 'wave2' : 'wave1');
  if (reduced) return { pose: wave(ms), lift: W.rest };
  const low = W.rest - W.drop;
  if (ms < W.down) return { pose: 'rest', lift: step(W.rest - W.drop * (ms / W.down)) };
  if (ms < W.down + W.wave) return { pose: wave(ms - W.down), lift: step(low) };
  return { pose: 'rest', lift: step(low + W.drop * ((ms - W.down - W.wave) / W.up)) };
}

/** Die Harfe: die fünf Perlen von unten nach oben, gezupft (Dreieck, kurz, leise, ohne Echo) */
export function harpScore(): Scored[] {
  return HARP_SCALE.map((f, i): Scored => [f, HARP.len, 'triangle', HARP.gain, 1, i * HARP.step]);
}

/** So viele Sekunden nach der Harfe macht die Spinne „tipp-tipp“ (wenn sie winkt) */
export const TIPP_AT = 0.5;

/** „tipp-tipp“: zwei winzige, leise Tupfer auf E7 (Rechteck, sehr kurz), wie kleine Füße; nur, wenn sie wach ist */
export function tippScore(): Scored[] {
  return [
    [2637.02, 0.03, 'square', 0.012, 1, TIPP_AT],
    [2637.02, 0.03, 'square', 0.012, 1, TIPP_AT + 0.14],
  ];
}

/** Wie hell Perle `i` (0 unten … 4 oben) `ms` nach dem Zupfen leuchtet: mit ihrem Ton auf, in `flash` ms wieder aus */
export function beadFlash(ms: number, i: number): number {
  const t = ms - i * HARP.step * 1000;
  return t >= 0 && t < W.flash ? 1 - t / W.flash : 0;
}

/**
 * Glitzern der Perle `i` mit der Laterne um `now`: reihum je `twinkle` ms eine (bei reduzierter Bewegung alle ruhig
 * etwas heller, ohne Abfolge)
 */
export const beadTwinkle = (now: number, i: number, reduced: boolean) =>
  reduced ? 0.6 : Math.floor(now / W.twinkle) % HARP_SCALE.length === i ? 1 : 0;

const websOf = new WeakMap<object, Point[]>();
/**
 * Netze der Tupfspinnen in der Grotte (`'web'`), von West nach Ost, dann von Nord nach Süd; ohne
 * Grotte keine; je Welt einmal (für ihre festen Löcher in der Dunkelmaske und das Bild der Spinnen)
 */
export function webs(world: Cave): Point[] {
  const known = websOf.get(world);
  if (known) return known;
  const frame = caveFrame(world);
  const found = new Map<string, Point>();
  const { rx, ry } = GROTTE.shape;
  for (let o = 0; frame && o <= 2 * ry; o++)
    for (let u = -rx; u <= rx; u++) {
      const p = frame.at(u, o);
      if (world.cell(...p).deco === 'web') found.set(`${p[0]},${p[1]}`, p);
    }
  const out = [...found.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  websOf.set(world, out);
  return out;
}
