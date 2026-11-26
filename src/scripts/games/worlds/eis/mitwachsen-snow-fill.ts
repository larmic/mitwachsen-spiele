// Fülle im Schnee des Gletschertals – rein und deterministisch: flache, begehbare Zierde auf blankem Schnee (Eisblumen,
// Eisflecken, Kiesel, Tundra-Büschel). Sie kommt ganz zuletzt, nach Strecke und Platz des Schlittens, nach Wohnplätzen
// und Wohnorten der Tiere (mitwachsen-kessel.ts): So würfelt sie nichts neu, und nichts weicht ihr. Nichts davon ist
// fest, nichts liegt auf Strecke, Rutschspur, Wiese, Plattform, Eis oder Wasser. Die Fülle trägt kein `Cell.color`:
// Die Karte zeigt dort Schnee, die Farbe kommt beim Zeichnen aus der Deko-Art (mitwachsen-snow-fill-look.ts).
// Verteilt wird über ein Raster (`SNOW_FILL.every`): je Kästchen höchstens eine Stelle an zufälligem Platz darin, so
// bleibt kein großes Stück Tal leer und doch liegt nichts in Reihen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Gletscherkessel (Eis-Welt)“, Fülle im Schnee)

import { hash, rand01 } from '../../../../lib/games/rng';
import { SNOW_FILL } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell, Deco } from '../../mitwachsen-cell';
import { key } from './mitwachsen-flood';

type Point = readonly [number, number];
/** Die Sorten der Fülle (ohne die Schneewehen, die mitwachsen-frost.ts im Lee der Tannen setzt) */
export const SNOW_FILLS: readonly Deco[] = ['iceflower', 'iceglint', 'pebbles', 'tundra'];

/** Blanker Schnee, auf dem Fülle liegen darf: nichts darauf, keine Strecke, Spur, Wiese oder Plattform */
const bare = (c: Cell | undefined): c is Cell =>
  !!c &&
  c.region === 'eis' &&
  !c.solid &&
  !c.deco &&
  c.ground === 'snow' &&
  !c.slide &&
  !c.garden &&
  !c.portal &&
  !c.ride;

const RING = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const)).filter(([dx, dy]) => dx || dy);
const KINDS = Object.entries(SNOW_FILL.kinds) as [Deco, number][];
const WEIGHT = KINDS.reduce((sum, [, w]) => sum + w, 0);

/**
 * Fülle auf die Felder `cells` des Kessels setzen (in die fertige Karte `map`); `shut`: Felder, die frei bleiben
 * (Strecke und Platz des Schlittens, als "x,y")
 */
export function adornKessel(seed: number, cells: readonly Point[], map: Map<string, Cell>, shut: ReadonlySet<string>) {
  const { every, none, flowers, twin, green } = SNOW_FILL;
  const open = (x: number, y: number) => {
    const c = map.get(key(x, y));
    return bare(c) && !shut.has(key(x, y)) ? c : null;
  };
  const put = (x: number, y: number, deco: Deco, note: number) => {
    const c = open(x, y);
    if (c) map.set(key(x, y), { ...c, deco, note });
    return !!c;
  };
  /** Nah an Tanne oder Schneewiese: Dort wächst Tundra */
  const mossy = (x: number, y: number) => {
    for (let dy = -green.near; dy <= green.near; dy++)
      for (let dx = -green.near; dx <= green.near; dx++) {
        const n = map.get(key(x + dx, y + dy));
        if (n?.tree === 'snowpine' || n?.garden) return true;
      }
    return false;
  };
  /** Nachbarn von (x, y) in gewürfelter Reihenfolge, nur freie auf gleicher Höhe */
  const beside = (x: number, y: number, h: number) =>
    [...RING]
      .sort((a, b) => hash(seed, x + a[0], y + a[1], 154) - hash(seed, x + b[0], y + b[1], 154))
      .filter(([dx, dy]) => open(x + dx, y + dy)?.h === h)
      .map(([dx, dy]): Point => [x + dx, y + dy]);
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const floor = (n: number) => Math.floor(n / every) * every;
  for (let gy = floor(Math.min(...ys)); gy <= Math.max(...ys); gy += every)
    for (let gx = floor(Math.min(...xs)); gx <= Math.max(...xs); gx += every) {
      const x = gx + (hash(seed, gx, gy, 150) % every);
      const y = gy + (hash(seed, gx, gy, 151) % every);
      const c = open(x, y);
      if (!c || rand01(seed, x, y, 152) < none) continue;
      const roll = hash(seed, x, y, 153);
      if (mossy(x, y) && rand01(seed, x, y, 155) < green.chance) {
        put(x, y, 'tundra', roll % 2);
        continue;
      }
      let pick = roll % WEIGHT;
      const kind = KINDS.find(([, w]) => (pick -= w) < 0)![0]; // die Gewichte decken jeden Wurf
      if (kind === 'pebbles') put(x, y, kind, roll % 3 ? 0 : 1);
      else if (kind === 'iceglint') {
        put(x, y, kind, 0);
        const next = beside(x, y, c.h)[0];
        if (next && rand01(seed, x, y, 156) < twin) put(...next, kind, 1);
      } else {
        // Eisblumen: ein kleines Feld in einer Farbe, die Mitte dichter (`note` ab 2)
        const color = (roll >> 3) % 2;
        const more = flowers[0] - 1 + (hash(seed, x, y, 157) % (flowers[1] - flowers[0] + 1));
        put(x, y, kind, color + 2);
        for (const p of beside(x, y, c.h).slice(0, more)) put(...p, kind, color);
      }
    }
}
