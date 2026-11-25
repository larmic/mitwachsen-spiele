// Kleine Lichtgeister in der Kristallhalle (Konzept „Höhle nach dem ersten Spielen“, Punkt 9, Schritt 11) – reine Regel,
// im Welt-Paket der Höhlenwelt, ohne Spielstand: Die Geister wohnen in Verstecken seitlich an den fünf Kristallsäulen
// (`hideoutsOf`: östlich oder westlich einer Säule, nie nördlich, denn da verdeckte die Säule sie; nur auf freiem Boden).
// Zu sehen sind sie nur im Licht: in der Laterne der Figur (später auch in den Lampen von Funkel), das entscheidet ein
// Helfer (`lightsOf`, `inLight`). Im Licht blendet ein Geist in `GROTTE.ghost.fade` ms ein, sonst ebenso aus; abends
// und nachts schläft er (dann blendet er aus). Verstecken: Kommt die Figur einem sichtbaren Geist auf `near` Felder
// nahe, schwebt er in `float` ms zum nächsten Versteck, das höchstens `hop` Felder von ihr liegt, also immer im
// Lichtkreis (`nextHideout`; am Ende der Säulenreihe notfalls bis an den Rand des Lichtkreises; keins frei: er bleibt). Er ist nie weg, nur ein Stück weiter. Nach `after`
// Verstecken dreht er eine Freudenrunde (`joy` ms) mit Sternenkranz. Gekichert wird leise und pentatonisch („hi-hi“,
// `giggleScore`), wenn ein Geist sichtbar wird und wenn er weiterschwebt, höchstens alle `gap` ms; die Freudenrunde
// klingt mit einem eigenen kleinen Glitzerlauf (`joyScore`). Ohne Laterne sieht man an seinem Platz nur drei ruhige
// Glimmerpünktchen (Bild in mitwachsen-ghost-look.ts). Keine Art der Leiste, kein Spielstand, keine `CaveSpeciesId`.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Höhle nach dem ersten Spielen“, Lichtgeister)

import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { caveFrame } from './mitwachsen-mask';

const G = GROTTE.ghost;

/** Ein Versteck: Mitte des Geists (Felder, Mitte eines Felds bei +0,5), Seite der Säule, die Säule selbst */
export type Hideout = { x: number; y: number; z: number; side: 'e' | 'w'; column: Point };

/** Ein Licht, in dem man Geister sieht: Mitte (Felder) und Radius */
export type Light = { x: number; y: number; r: number };

/**
 * Ein Geist: sein Versteck (`at`, Index in den Verstecken), woher er gerade schwebt (`from`) und seit wann (`moved`),
 * wie viele Verstecke seit der letzten Freudenrunde (`hops`), seit wann seine Freudenrunde läuft (`joy`), wie sichtbar
 * er ist (`alpha` 0 … 1), ob er gerade im Licht ist (`lit`), und wann er zuletzt bedacht wurde (`t`, ms)
 */
export type Ghost = {
  at: number;
  from?: number;
  moved: number;
  hops: number;
  joy?: number;
  alpha: number;
  lit: boolean;
  t: number;
};

/** Alle Geister der Grotte und wann zuletzt einer kicherte */
export type Ghosts = { list: Ghost[]; giggled: number };

/** Was ein Takt der Geister wissen muss */
export type GhostInput = {
  now: number;
  player: { x: number; y: number };
  lights: readonly Light[];
  awake: boolean;
};

const hideouts = new WeakMap<object, Hideout[]>();
type Cave = Pick<World, 'homes' | 'portals' | 'cell' | 'realm'>;

/** So weit (Felder, ringsum) um die Mitte der Säulenreihe sucht `hideoutsOf` die Säulen */
const SEARCH = 8;

/**
 * Verstecke der Geister: je Kristallsäule der Halle östlich und westlich daneben (nie nördlich oder südlich), wenn das
 * Feld daneben freier Boden der Grotte ist; nach Lage von West nach Ost, dann von Nord nach Süd. Ohne Grotte keine; je
 * Welt einmal
 */
export function hideoutsOf(world: Cave): Hideout[] {
  const known = hideouts.get(world);
  if (known) return known;
  const frame = caveFrame(world);
  const found: Hideout[] = [];
  const [hx, hy] = frame ? frame.at(GROTTE.hall.across, GROTTE.hall.out - 3) : [0, 0];
  for (let y = hy - SEARCH; frame && y <= hy + SEARCH; y++)
    for (let x = hx - SEARCH; x <= hx + SEARCH; x++) found.push(...besideColumn(world, x, y));
  found.sort((a, b) => a.x - b.x || a.y - b.y);
  hideouts.set(world, found);
  return found;
}

/** Verstecke an der Säule auf (x, y): westlich und östlich, wo daneben freier Boden der Grotte ist; keine Säule: keine */
function besideColumn(world: Cave, x: number, y: number): Hideout[] {
  const c = world.cell(x, y);
  if (c.deco !== 'column' || c.region !== 'hoehle') return [];
  return (['w', 'e'] as const).flatMap((side): Hideout[] => {
    const dx = side === 'e' ? 1 : -1;
    const n = world.cell(x + dx, y);
    if (n.solid || n.ground === 'water' || world.realm(x + dx, y) !== 'hoehle') return [];
    return [{ x: x + 0.5 + dx * G.side, y: y + 0.5 - G.back, z: c.h, side, column: [x, y] }];
  });
}

/**
 * Lichter, in denen man Geister sieht: die Kristall-Laterne in der Hand der Figur (wach, zu Fuß, in der Grotte), Radius
 * des Lichtkreises mit Laterne; ohne Laterne keins. (Die Lampen von Funkel kommen mit ihm dazu.)
 */
export function lightsOf(
  world: Pick<World, 'realm'>,
  s: { player: { x: number; y: number }; lamp?: unknown; sleeping?: boolean; ride?: unknown },
): Light[] {
  if (!s.lamp || s.sleeping || s.ride || world.realm(s.player.x, s.player.y) !== 'hoehle') return [];
  return [{ x: s.player.x + 0.5, y: s.player.y + 0.5, r: GROTTE.circle.lantern }];
}

/** Liegt (x, y) in einem der Lichter? */
export const inLight = (lights: readonly Light[], x: number, y: number) =>
  lights.some((l) => Math.hypot(x - l.x, y - l.y) <= l.r);

/** Abstand eines Verstecks von der Figur (Felder, von der Mitte ihres Felds) */
const away = (h: { x: number; y: number }, p: { x: number; y: number }) => Math.hypot(h.x - p.x - 0.5, h.y - p.y - 0.5);

/**
 * Das nächste Versteck für einen Geist, dem die Figur auf (px, py) zu nahe kommt: nicht sein jetziges, keins, das ein
 * anderer Geist hat (`taken`), weiter als `near` und höchstens `hop` Felder von ihr; davon das fernste (bei Gleichstand
 * das erste). Gibt es dort keins (die Figur steht am Ende der Säulenreihe), das nächste bis zum Rand des Lichtkreises
 * der Laterne: Er bleibt immer im Licht. Keins: undefined (er bleibt)
 */
export function nextHideout(
  hs: readonly Hideout[],
  current: number,
  player: { x: number; y: number },
  taken: ReadonlySet<number> = new Set(),
): number | undefined {
  const free = hs.flatMap((h, i) => (i === current || taken.has(i) ? [] : [{ i, d: away(h, player) }]));
  const hop = free.filter(({ d }) => d > G.near && d <= G.hop).sort((a, b) => b.d - a.d || a.i - b.i);
  const rim = free.filter(({ d }) => d > G.hop && d <= GROTTE.circle.lantern).sort((a, b) => a.d - b.d || a.i - b.i);
  return (hop[0] ?? rim[0])?.i;
}

/** Die Geister am Anfang: höchstens `GROTTE.ghost.count`, verteilt auf die äußeren Verstecke (das erste und das letzte) */
export function startGhosts(hs: readonly Hideout[], now = 0): Ghosts {
  const at = [...new Set([0, hs.length - 1])].filter((i) => i >= 0 && i < hs.length).slice(0, G.count);
  return {
    list: at.map((i) => ({ at: i, moved: -Infinity, hops: 0, alpha: 0, lit: false, t: now })),
    giggled: -Infinity,
  };
}

/** Schwebt der Geist gerade (seit `moved`, `float` ms lang)? */
export const floating = (g: Ghost, now: number) => g.from !== undefined && now - g.moved < G.float;
/** Läuft seine Freudenrunde gerade? */
export const joyful = (g: Ghost, now: number) => g.joy !== undefined && now - g.joy < G.joy;

/**
 * Wo ein Geist gerade ist (Felder, Mitte; z: Unterkante über dem Boden) und wie weit er sichtbar ist (`fade` 0 … 1,
 * beim Wechsel mit reduzierter Bewegung): im Versteck, beim Schweben auf einem kleinen Bogen hinüber (bei reduzierter
 * Bewegung blendet er im ersten halben Wechsel aus und im zweiten am neuen Versteck ein, ohne Schweben), in der
 * Freudenrunde auf einem kleinen Kreis (bei reduzierter Bewegung still). Er wiegt sich langsam (nicht bei reduzierter
 * Bewegung)
 */
export function ghostAt(g: Ghost, hs: readonly Hideout[], now: number, reduced: boolean, phase = 0) {
  const to = hs[g.at];
  if (!to) return null;
  const sway = reduced ? 0 : 0.04 * Math.sin(now / 650 + phase);
  const from = g.from === undefined ? undefined : hs[g.from];
  if (from && floating(g, now)) {
    const p = (now - g.moved) / G.float;
    if (reduced) {
      const h = p < 0.5 ? from : to;
      return { x: h.x, y: h.y, z: h.z + 0.12, fade: Math.abs(1 - 2 * p), side: h.side };
    }
    const e = p * p * (3 - 2 * p);
    const z = from.z + (to.z - from.z) * e + 0.12 + 0.3 * Math.sin(Math.PI * p);
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: z + sway, fade: 1, side: to.side };
  }
  if (g.joy !== undefined && joyful(g, now) && !reduced) {
    const a = ((now - g.joy) / G.joy) * 2 * Math.PI;
    return {
      x: to.x + 0.3 * Math.sin(a),
      y: to.y - 0.3 * (1 - Math.cos(a)),
      z: to.z + 0.12 + 0.15 * Math.sin(a / 2),
      fade: 1,
      side: to.side,
    };
  }
  return { x: to.x, y: to.y, z: to.z + 0.12 + sway, fade: 1, side: to.side };
}

/** Kichern „hi-hi“: zweimal A6, Dreieck, kurz und leicht nach unten gleitend, leiser als jedes Tier (C-Pentatonik) */
export function giggleScore(): Scored[] {
  return [
    [1760, 0.06, 'triangle', 0.03, 0.92, 0],
    [1760, 0.06, 'triangle', 0.03, 0.92, 0.13],
  ];
}

/** Freudenrunde: ein kleiner Glitzerlauf hinauf (A5, D6, A6, D7; Sinus, ganz leise), dazu das Kichern */
export function joyScore(): Scored[] {
  return [
    ...[880, 1174.66, 1760, 2349.32].map((f, i): Scored => [f, 0.08, 'sine', 0.025, 1, i * 0.07]),
    ...giggleScore().map(([f, len, w, g, s, d]): Scored => [f, len, w, g, s, d + 0.35]),
  ];
}

/**
 * Ein Takt aller Geister um `now` (rein): Jeder blendet im Licht ein, sonst aus (abends und nachts schlafen sie);
 * kommt ihm die Figur nahe, während er zu sehen ist, nicht schwebt und keine Freudenrunde dreht, schwebt er zum
 * nächsten Versteck; ist er nach dem `after`-ten Versteck angekommen, beginnt die Freudenrunde. Liefert die Geister
 * danach und die Töne dazu (Kichern höchstens alle `gap` ms)
 */
export function stepGhosts(gs: Ghosts, hs: readonly Hideout[], input: GhostInput): { ghosts: Ghosts; tones: Scored[] } {
  const { now, player, lights, awake } = input;
  let giggled = gs.giggled;
  const tones: Scored[] = [];
  const giggle = () => {
    if (now - giggled < G.gap) return;
    giggled = now;
    tones.push(...giggleScore());
  };
  const list = gs.list.map((g) => ({ ...g }));
  list.forEach((g, i) => {
    const dt = Math.max(0, Math.min(G.fade, now - g.t));
    g.t = now;
    if (g.from !== undefined && !floating(g, now)) {
      delete g.from; // angekommen
      if (g.hops >= G.after) {
        [g.joy, g.hops] = [now, 0];
        tones.push(...joyScore());
        giggled = now;
      }
    }
    if (g.joy !== undefined && !joyful(g, now)) delete g.joy;
    const h = hs[g.at];
    const lit = !!h && awake && inLight(lights, h.x, h.y);
    g.alpha = Math.max(0, Math.min(1, g.alpha + ((lit ? 1 : -1) * dt) / G.fade));
    if (lit && !g.lit) giggle(); // er ist im Licht zu sehen: „hi-hi“
    g.lit = lit;
    if (!h || !lit || g.alpha <= 0 || g.from !== undefined || g.joy !== undefined || away(h, player) > G.near) return;
    const taken = new Set(list.flatMap((o, j) => (j === i ? [] : [o.at, ...(o.from === undefined ? [] : [o.from])])));
    const next = nextHideout(hs, g.at, player, taken);
    if (next === undefined) return; // keins frei: er bleibt, bis die Figur weitergeht
    Object.assign(g, { from: g.at, at: next, moved: now, hops: g.hops + 1 });
    giggle();
  });
  return { ghosts: { list, giggled }, tones };
}
