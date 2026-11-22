// Zeitbudget der Unit-Tests (vitest.config.ts): Kein Test darf auf dem Entwickler-Rechner länger brauchen als das
// Budget. Gemessen wird relativ: `calibrate` misst vor den Tests eine kleine, reine JS-Last (so ähnlich wie die Tests:
// Rauschen, Map mit Zahl- und Text-Schlüsseln, Breitensuche, Sortieren). Ist der Rechner langsamer (ausgelastet,
// Stromsparen, Abdeckung), braucht auch sie länger, und das Budget wächst im selben Verhältnis.
//
// Herleitung: Die Pipeline (GitHub-Runner ubuntu-latest, 4 vCPUs, mit Abdeckung) war bis gut 4-mal langsamer als der
// Rechner, an dem `REF` gemessen ist (gemessen 11/2026). 4 s Budget × 4 ≈ 16 s; die Grenze der Pipeline (60 s) lässt
// mehr als das Dreifache Luft.
import { performance } from 'node:perf_hooks';

/** Bezug: Kalibrierung (Minimum aus 5 Läufen) auf dem Rechner, für den das Budget gilt, und das Budget dort */
export const REF = { calibMs: 56, budgetMs: 4000 } as const;
/** Mit Abdeckung (v8) laufen die Tests etwa so viel langsamer, die Kalibrierung (ohne Abdeckung geladen) nicht */
export const COVERAGE_FACTOR = 1.7;
/** Grenzen des Budgets: nicht so knapp, dass Rauschen zählt, nicht so weit, dass ein Test die Pipeline sprengt */
export const BUDGET_RANGE = [1500, 8000] as const;

/** Budget je Test in ms aus der Kalibrierung dieses Rechners; `coverage`: läuft mit Abdeckung */
export function budgetMs(calibMs: number, coverage: boolean): number {
  const raw = (REF.budgetMs * calibMs) / REF.calibMs / (coverage ? 1 : COVERAGE_FACTOR);
  return Math.round(Math.min(BUDGET_RANGE[1], Math.max(BUDGET_RANGE[0], raw)));
}

/** Pseudo-Zufall 0 … 1 aus Feld und Seed, wie das Rauschen der Welt */
function hash(x: number, y: number, seed: number) {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Eine Runde der Last; das Ergebnis wird zurückgegeben, damit nichts wegoptimiert wird */
function work(): number {
  const W = 160;
  const cells = new Map<number, { x: number; y: number; h: number; wall: boolean }>();
  for (let y = -W; y < W; y++)
    for (let x = -W; x < W; x++)
      cells.set(x * 4096 + y, { x, y, h: Math.floor(hash(x, y, 7) * 4), wall: hash(x, y, 3) < 0.25 });
  const seen = new Set(['0,0']);
  const queue: [number, number][] = [[0, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const c = cells.get((x + dx) * 4096 + y + dy);
      const k = `${x + dx},${y + dy}`;
      if (!c || c.wall || seen.has(k)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  const pts = [...cells.values()]
    .filter((c) => !c.wall)
    .map((c) => ({ ...c, d: Math.hypot(c.x, c.y) }))
    .sort((a, b) => a.d - b.d);
  let h = 0;
  for (const p of pts) h += p.h;
  return h + seen.size;
}

/** Kalibrierung dieses Rechners in ms: das Minimum aus `runs` Läufen der Last (das Minimum rauscht am wenigsten) */
export function calibrate(runs = 5): number {
  let best = Infinity;
  for (let r = 0; r < runs; r++) {
    const t = performance.now();
    work();
    best = Math.min(best, performance.now() - t);
  }
  return best;
}
