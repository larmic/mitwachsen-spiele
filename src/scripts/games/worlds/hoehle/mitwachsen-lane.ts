// Schleife der Grubenbahn Funkel in der Kristallgrotte (Schritt 14 der Rückmeldung zur Höhle) – rein und deterministisch,
// keine Suche: Die Form steht in den Daten (`GROTTE.grube`), gerechnet als Abstand zum echten, leicht gewellten Rand der
// Grotte. Halt neben dem Höhlenbett, offener Hinweg an der Wand entlang nach hinten, in der Reihe `turn` hinüber an die
// Wand und zurück durch den Glitzergang direkt an der Wand (zur Höhle hin die Zaunkristalle), zuletzt quer zum Halt; der
// Gang endet `open` Felder vor ihm. Die Schleife liegt auf der Seite des Bahnhofs (u+), gespiegelt auf u−, wenn u+ zur
// Kamera zeigt (`laneSide`): Sonst verdeckten die Klippen vorn Bähnchen und Gang. Die Grotte hält alles frei und baut den
// Gang bis zum Graben als Fels (mitwachsen-grotte.ts); Gleis, Tore und Bähnchen bringt das Paket der Grubenbahn.
// Teil des Welt-Pakets der Höhlenwelt (index.ts), nachgeladen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“, Schleife der Grubenbahn)

import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Lane } from '../../mitwachsen-cell';
import type { Site } from './mitwachsen-site';

const { ry } = GROTTE.shape;

/**
 * Seite der Schleife: +1 auf u+ (die Seite des Bahnhofs), −1 gespiegelt auf u−, wenn u+ zur Kamera zeigt (in Ruhe im
 * Süden, +y, mitwachsen-camera.ts). Hängt nur von der Lage der Grotte ab, nicht vom Seed
 */
export function laneSide(site: Pick<Site, 'at'>): 1 | -1 {
  const [, y0] = site.at(0, 0);
  const [, y1] = site.at(1, 0);
  return y1 > y0 ? -1 : 1;
}

/**
 * Plan der Schleife in [quer, vom Tor weg] von der Mündung aus, quer gemessen auf ihrer Seite (positiv zur Wand hin;
 * u = `side` × quer): Gleis in Reihe ab dem ersten Feld des Halts in Fahrtrichtung (`track`, geschlossen: das letzte Feld
 * liegt neben dem ersten), im Glitzergang von `track[gang[0]]` bis `track[gang[1]]`; Nachbarn des Gangs (`sides`, ein
 * Feld ringsum, auch schräg), Zaunkristalle (`fence`, zwei Felder vom Gang), Bahnsteig des Halts (`platform`)
 */
export type LanePlan = {
  side: 1 | -1;
  track: Point[];
  gang: readonly [number, number];
  sides: Point[];
  fence: Point[];
  platform: Point[];
};

const key = (a: number, o: number) => `${a},${o}`;
const uvKey = (u: number, v: number) => `${u},${v}`;

/** Markierungen der Schleife je Feld als "u,v" von der Mitte (`Cell.lane`), Bahnsteig, was frei bleibt */
export type LaneMarks = { at: Map<string, Lane>; platform: Set<string>; keep: Set<string> };

/**
 * Von `path.at(-1)` in Schritten zu je einem Feld (quer oder vom Tor weg, nie schräg) nach `to`; an jeder Ecke das Feld
 * weiter innen (`inner`: kleineres quer) oder weiter an der Wand, nie zurück auf das Feld davor (eine Welle des Rands
 * über nur eine Reihe)
 */
function walk(path: Point[], to: Point, inner: boolean) {
  for (;;) {
    const [a, o] = path.at(-1)!; // der Weg beginnt nie leer
    if (a === to[0] && o === to[1]) return;
    const da = Math.sign(to[0] - a);
    const dO = Math.sign(to[1] - o);
    // erst quer, wenn das an der Ecke auf die gewünschte Seite führt (oder nur noch quer fehlt)
    let across = dO === 0 || (da !== 0 && da < 0 === inner);
    const back = path.at(-2);
    if (back && da !== 0 && dO !== 0 && back[0] === (across ? a + da : a) && back[1] === (across ? o : o + dO))
      across = !across;
    path.push(across ? [a + da, o] : [a, o + dO]);
  }
}

/**
 * Der Rand je Reihe vom Tor weg: das äußerste Feld Boden auf der Seite `side` (`floorAt(u, v)` von der Mitte), geglättet:
 * nie weiter außen als der Rand zwei Reihen davor oder danach, und auf zwei Reihen ändert er sich um höchstens ein Feld.
 * So hält das Gleis seinen Abstand auch zur nächsten Welle, und Hinweg und Gang laufen gleich
 */
function edgeOf(side: 1 | -1, floorAt: (u: number, v: number) => boolean, from: number, to: number) {
  const raw = new Map<number, number>();
  for (let o = from - 2; o <= to + 2; o++) {
    let a = 0;
    while (a < GROTTE.shape.rx && floorAt(side * (a + 1), o - ry)) a++;
    raw.set(o, a);
  }
  const edge = new Map<number, number>();
  for (let o = from; o <= to; o++) edge.set(o, Math.min(...[-2, -1, 0, 1, 2].map((k) => raw.get(o + k)!)));
  const at = (o: number) => edge.get(o) ?? Infinity;
  for (let changed = true; changed;) {
    changed = false;
    for (let o = from; o <= to; o++) {
      const e = Math.min(at(o), ...[-2, -1, 1, 2].map((k) => at(o + k) + 1));
      if (e < at(o)) {
        edge.set(o, e);
        changed = true;
      }
    }
  }
  return at;
}

/**
 * Die Schleife der Grubenbahn auf der Seite `side`, gerechnet aus dem echten Rand (`floorAt(u, v)`: Boden der Grotte bei
 * (u, v) von der Mitte, vor allem anderen). Nur Rechnen über die Reihen zwischen `near` und `turn`
 */
export function lanePlan(side: 1 | -1, floorAt: (u: number, v: number) => boolean): LanePlan {
  const { stop, leg, gang, turn, near, open } = GROTTE.grube;
  const edge = edgeOf(side, floorAt, near, turn);
  /** Feld, dessen Mitte `d` Felder innerhalb des Rands liegt (der Rand liegt eine halbe Breite hinter dem äußersten Feld) */
  const inset = (o: number, d: number) => Math.round(edge(o) + 0.5 - d);
  const track: Point[] = [];
  for (let o = stop.out; o < stop.out + stop.long; o++) track.push([stop.across, o]);
  const from = stop.out + stop.long - 1;
  walk(track, [inset(from, leg), from], false); // in der letzten Reihe des Halts quer hinüber an den Hinweg
  for (let o = from + 1; o < turn; o++) walk(track, [inset(o, leg), o], true);
  walk(track, [track.at(-1)![0], turn], true);
  // in der Reihe `turn` hinüber an die Wand: hier beginnt der Gang, nie weiter außen als in der Reihe davor (sonst läge
  // sein erstes Feld nach dem Tor neben dem offenen Gleis)
  walk(track, [Math.min(inset(turn, gang), inset(turn - 1, gang)), turn], true);
  const start = track.length - 1;
  for (let o = turn - 1; o >= near; o--) walk(track, [inset(o, gang), o], false);
  walk(track, [stop.across, near], false); // quer zum Halt
  walk(track, [stop.across, stop.out - 1], false);
  const end = track.length - 1 - open;
  const inGang = track.slice(start, end + 1);
  const onTrack = new Set(track.map(([a, o]) => key(a, o)));
  const ring = (r: number) => {
    const out = new Map<string, Point>();
    for (const [a, o] of inGang)
      for (let dO = -r; dO <= r; dO++)
        for (let da = -r; da <= r; da++)
          if (!onTrack.has(key(a + da, o + dO))) out.set(key(a + da, o + dO), [a + da, o + dO]);
    return out;
  };
  const sides = ring(1);
  // die Zaunkristalle zwei Felder vom Gang, also `GROTTE.grube.fence` (3,5) Felder innerhalb des Rands
  const fenceCells = [...ring(2)].filter(([k]) => !sides.has(k)).map(([, p]) => p);
  const platform: Point[] = [];
  for (let o = stop.out; o < stop.out + stop.long; o++)
    for (let w = 1; w <= stop.wide; w++) platform.push([stop.across - w, o]);
  return { side, track, gang: [start, end], sides: [...sides.values()], fence: fenceCells, platform };
}

/**
 * Felder der Schleife der Grubenbahn (`LanePlan`) als (u, v) von der Mitte: Markierung je Feld (`Cell.lane`), der
 * Bahnsteig des Halts (`Cell.stop` `'grube'`) und was frei bleibt (`keep`: alles davon samt einem Feld neben dem offenen
 * Gleis)
 */
export function laneMarks(plan: LanePlan): LaneMarks {
  const k = ([a, o]: Point) => uvKey(...uvOfLane(plan.side, a, o));
  const at = new Map<string, Lane>();
  const mark = (p: Point, part: Lane['part'], i?: number) =>
    at.set(k(p), { ride: 'grube', part, ...(i !== undefined && { at: i }) });
  for (const p of plan.fence) mark(p, 'fence');
  for (const p of plan.sides) mark(p, 'side');
  plan.track.forEach((p, i) => mark(p, i >= plan.gang[0] && i <= plan.gang[1] ? 'gang' : 'open', i));
  const platform = new Set(plan.platform.map(k));
  const keep = new Set([...at.keys(), ...platform]);
  plan.track.forEach(([a, o], i) => {
    if (i >= plan.gang[0] && i <= plan.gang[1]) return;
    for (let dO = -1; dO <= 1; dO++) for (let da = -1; da <= 1; da++) keep.add(k([a + da, o + dO]));
  });
  return { at, platform, keep };
}

/**
 * Lage des Lehmhangs des Dachses [quer, vom Tor weg] (Innenkante, Mitte) bei einer Schleife auf der Seite `side`: wie in
 * den Daten links neben dem Pilzgarten; liegt die Schleife gespiegelt dort, auf derselben Seite hinter ihrer Umkehr
 * (`GROTTE.clay.mirrored`), nie auf der Seite zur Kamera
 */
export function clayOf(side: 1 | -1): { across: number; out: number } {
  const { across, out, mirrored } = GROTTE.clay;
  return side === 1 ? { across, out } : mirrored;
}

/** Ein Punkt [quer, vom Tor weg] am Lehmhang der Daten, mitgerückt an den Lehmhang bei einer Schleife auf der Seite `side` */
export function onClay([a, o]: readonly [number, number], side: 1 | -1): Point {
  const { across, out } = clayOf(side);
  return [a + across - GROTTE.clay.across, o + out - GROTTE.clay.out];
}

/** (u, v) von der Mitte für [quer, vom Tor weg] einer Schleife auf der Seite `side` */
const uvOfLane = (side: 1 | -1, a: number, o: number): Point => [side * a, o - ry];
