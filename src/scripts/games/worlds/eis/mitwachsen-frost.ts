// Eiskristalle, Schneewehen und Schneehaufen im Gletscherkessel – rein und deterministisch, nach Tannen und Eisblöcken
// gesetzt (mitwachsen-kessel.ts). Kristalle stehen in kleinen Gruppen am Fuß der Eisklippen und oben auf den Kuppen
// (Höhe 3), fest wie ein Stein, jeder mit einem Feld Lücke ringsum; Schneewehen liegen begehbar im Lee der Tannen (der
// Pustewind weht nach rechts, also rechts daneben); Schneehaufen, aus denen das Kind Schneemänner baut
// (mitwachsen-snowman.ts), liegen einzeln und weit verstreut, fest, mit zwei Feldern freiem, ebenem Schnee ringsum. Das
// Leuchten der Kristalle beim Polarlicht (`crystalGlow`) zeichnen die Ansichten des Welt-Pakets: 2D in
// mitwachsen-ice-sky.ts, 3D in view-3d.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Gletscherkessel“ und „Wetter und Unterstand“)

import { cycle, hash, rand01 } from '../../../../lib/games/rng';
import { ICE_CRYSTALS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import type { Cell } from '../../mitwachsen-cell';
import { key } from './mitwachsen-flood';

/**
 * Kristalle im Kessel: so viele Gruppen (höchstens), mindestens so viele Felder zwischen ihren Mitten, je Gruppe 2 bis
 * `size` Kristalle (zwei Felder auseinander, dazwischen eine Lücke); jeder Kessel hat mindestens `least` Kristalle.
 * Schneewehen: Jede Tanne hat eine direkt im Lee (wo Platz ist), Anteil `second` ein zweites Häufchen dahinter.
 */
export const FROST = { groups: 24, spacing: 9, size: 4, least: 12, second: 0.4 } as const;
/** Schneehaufen: so viele (höchstens) je Tal, mindestens so viele Felder zwischen zweien */
export const HEAPS = { count: 14, spacing: 14 } as const;

/** Ein Feld des Kessels, auf dem Tannen, Eisblöcke, Kristalle und Wehen wachsen dürfen (nicht dort, wo er frei bleibt) */
export type Wild = { readonly x: number; readonly y: number };

/** Kristall-Nachbarn einer Gruppe: zwei Felder weit, so bleibt zwischen zweien immer ein Feld Lücke */
const STEPS = [-2, -1, 0, 1, 2]
  .flatMap((dy) => [-2, -1, 0, 1, 2].map((dx) => [dx, dy] as const))
  .filter(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy)) === 2);

/** Kristalle und Schneewehen auf die Felder `wild` setzen (in die Karte `map`, nach dem Ebnen und nach `winter`) */
export function frost(seed: number, wild: readonly Wild[], map: Map<string, Cell>) {
  crystals(seed, wild, map);
  drifts(seed, wild, map);
  heaps(seed, wild, map);
}

/** Schnee ohne alles darauf: dort darf ein Kristall oder eine Wehe hin */
const bare = (c: Cell | undefined): c is Cell =>
  !!c && c.region === 'eis' && !c.solid && !c.deco && c.ground === 'snow' && !c.slide && !c.garden && !c.portal;

/**
 * Kristalle in kleinen Gruppen: Mitten am Fuß der Eisklippen (eine Reihe Schnee dazwischen) oder auf einer Kuppe (Höhe
 * 3). Jeder Kristall steht auf ebenem Schnee: alle acht Nachbarn begehbar und genau so hoch, keine Spur bis zwei Felder
 * weit; so läuft man immer um ihn herum, und nichts wird eingesperrt. Erst die Mitten (gewürfelt, mit Abstand), dann
 * reihum ihre Nachbarn; reicht es nicht für `FROST.least`, kommen weitere Mitten hinzu, auch ohne Klippe oder Kuppe.
 */
function crystals(seed: number, wild: readonly Wild[], map: Map<string, Cell>) {
  const at = (x: number, y: number) => map.get(key(x, y));
  const inWild = new Set(wild.map(({ x, y }) => key(x, y)));
  const around = (x: number, y: number, r: number, f: (c: Cell | undefined) => boolean) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if ((dx || dy) && f(at(x + dx, y + dy))) return true;
    return false;
  };
  const fits = (x: number, y: number) => {
    const c = at(x, y);
    if (!inWild.has(key(x, y)) || !bare(c)) return false;
    if (around(x, y, 1, (n) => !n || n.region !== 'eis' || n.solid || n.ground === 'water' || n.h !== c.h))
      return false;
    return !around(x, y, 2, (n) => !!n?.slide || !!n?.portal);
  };
  /** Am Fuß der Klippe (sie beginnt zwei Felder weiter) oder oben auf einer Kuppe */
  const special = (x: number, y: number) => at(x, y)?.h === 3 || around(x, y, 2, (n) => n?.region === 'border');
  const set = (x: number, y: number) => {
    const c = at(x, y)!; // `fits` hat das Feld geprüft
    map.set(key(x, y), { ...c, deco: 'crystal', solid: true, color: cycle(ICE_CRYSTALS, hash(seed, x, y, 70)) });
  };
  const roll = (x: number, y: number) => hash(seed, x, y, 69);
  const order = [...wild].sort((a, b) => roll(a.x, a.y) - roll(b.x, b.y));
  const centres: Wild[] = [];
  let count = 0;
  /** Eine Gruppe um (x, y): nur, wenn mindestens ein zweiter Kristall daneben Platz hat (keiner steht allein) */
  const group = ({ x, y }: Wild) => {
    if (!STEPS.some(([dx, dy]) => fits(x + dx, y + dy))) return;
    set(x, y);
    centres.push({ x, y });
    count++;
    const size = 2 + (hash(seed, x, y, 71) % (FROST.size - 1));
    const steps = [...STEPS].sort((a, b) => hash(seed, x + a[0], y + a[1], 72) - hash(seed, x + b[0], y + b[1], 72));
    let n = 1;
    for (const [dx, dy] of steps) {
      if (n >= size) break;
      if (!fits(x + dx, y + dy)) continue;
      set(x + dx, y + dy);
      n++;
      count++;
    }
  };
  const spaced = ({ x, y }: Wild) => centres.every((c) => Math.hypot(c.x - x, c.y - y) >= FROST.spacing);
  for (const w of order) {
    if (centres.length >= FROST.groups) break;
    if (special(w.x, w.y) && spaced(w) && fits(w.x, w.y)) group(w);
  }
  for (const w of order) {
    if (count >= FROST.least) break;
    if (spaced(w) && fits(w.x, w.y)) group(w);
  }
}

/**
 * Schneewehen: kleine weiße Häufchen (`'cloudpuff'`, begehbar, nur Bild) im Lee jeder Tanne, also rechts daneben
 * (dorthin weht der Pustewind), manchmal ein zweites dahinter
 */
function drifts(seed: number, wild: readonly Wild[], map: Map<string, Cell>) {
  const inWild = new Set(wild.map(({ x, y }) => key(x, y)));
  const drift = (x: number, y: number) => {
    const c = map.get(key(x, y));
    if (!inWild.has(key(x, y)) || !bare(c)) return false;
    map.set(key(x, y), { ...c, deco: 'cloudpuff' });
    return true;
  };
  for (const { x, y } of wild) {
    if (map.get(key(x, y))?.tree !== 'snowpine') continue;
    if (drift(x + 1, y) && rand01(seed, x, y, 74) < FROST.second) drift(x + 2, y);
  }
}

/**
 * Schneehaufen (`'snowheap'`, fest): einzeln und weit verstreut (`HEAPS`), nie auf Wegen, Spur, Plattformen oder Wiese
 * (nur auf `wild`, auf blankem Schnee). Ringsum zwei Felder ebener, freier Schnee: kein Wasser, nichts Festes, keine
 * Spur, keine Plattform, keine Wiese, alle acht Nachbarn gleich hoch. So läuft man immer um ihn (und den Schneemann
 * daraus) herum, und er sperrt nie etwas ab.
 */
function heaps(seed: number, wild: readonly Wild[], map: Map<string, Cell>) {
  const at = (x: number, y: number) => map.get(key(x, y));
  const inWild = new Set(wild.map(({ x, y }) => key(x, y)));
  const open = (n: Cell | undefined, h: number, near: boolean) =>
    !!n &&
    n.region === 'eis' &&
    !n.solid &&
    n.ground !== 'water' &&
    !n.slide &&
    !n.portal &&
    !n.garden &&
    (!near || n.h === h);
  const fits = (x: number, y: number) => {
    const c = at(x, y);
    if (!inWild.has(key(x, y)) || !bare(c)) return false;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (!(dx || dy)) continue;
        if (!open(at(x + dx, y + dy), c.h, Math.abs(dx) <= 1 && Math.abs(dy) <= 1)) return false;
      }
    return true;
  };
  const placed: Wild[] = [];
  const roll = (x: number, y: number) => hash(seed, x, y, 75);
  for (const w of [...wild].sort((a, b) => roll(a.x, a.y) - roll(b.x, b.y))) {
    if (placed.length >= HEAPS.count) break;
    if (!placed.every((p) => Math.hypot(p.x - w.x, p.y - w.y) >= HEAPS.spacing) || !fits(w.x, w.y)) continue;
    map.set(key(w.x, w.y), { ...at(w.x, w.y)!, deco: 'snowheap', solid: true }); // `fits` hat das Feld geprüft
    placed.push(w);
  }
}
