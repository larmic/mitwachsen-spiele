// „Noch nicht“ am Eistor im Bild: leerer goldener Umriss dessen, was fehlt (aus dem Modell der Art gerastert), wie er
// pulsiert und wie die Flügel in 3D wackeln. Gezeichnet wird gegen ein aufzeichnendes Canvas (ohne DOM).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { REGIONS, SPECIES, type SpeciesId } from '../../data/games/mitwachsen';
import { TILE_W, projection } from '../../lib/games/front';
import { hintShake } from './mitwachsen-gate-motion-3d';
import {
  HINT_MS,
  HINT_PX,
  HINT_Y,
  SIL,
  hintGlow,
  hintOutline,
  notYet,
  showHint,
  silhouette,
} from './mitwachsen-hint-look';
import { worldOf } from './test-worlds'; // trägt auch die Modelle der Eis-Tiere ein (den Pinguin)

const LICHTUNG = REGIONS[0].animals.map((a) => a.species);
const ALL: SpeciesId[] = [...LICHTUNG, 'pinguin'];
/** Farben der Aktionsfarbe Gold aus tokens.css (die einzige, die „noch nicht“ zeigen darf) */
const TOKENS = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');
const token = (name: string) => TOKENS.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))?.[1];

/** Canvas, das jedes Rechteck mit Farbe und Deckkraft aufzeichnet */
function recorder() {
  const rects: { x: number; y: number; w: number; h: number; color: string; alpha: number }[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, color: this.fillStyle, alpha: this.globalAlpha });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, state: ctx };
}

describe('„Noch nicht“: Umriss dessen, was fehlt', () => {
  it('jede Art der Lichtung und der Pinguin: groß genug (16 Pixel lang oder hoch), mit Rand und Auge, alle verschieden', () => {
    const seen = new Set<string>();
    let eyed = 0;
    for (const sp of ALL) {
      const rows = silhouette(SPECIES[sp].parts);
      const cols = rows[0]!.length;
      expect(
        rows.every((r) => r.length === cols),
        sp,
      ).toBe(true);
      expect(Math.max(rows.length, cols), sp).toBe(SIL);
      expect(Math.min(rows.length, cols), sp).toBeGreaterThanOrEqual(5); // kein Strich
      // ein leerer Umriss: innen bleibt das meiste frei, aber nicht alles (die Augen sind golden, sonst läse man ein „O“)
      const gold = rows
        .join('')
        .split('')
        .filter((c) => c === 'o').length;
      expect(gold, sp).toBeGreaterThan(SIL);
      const plain = silhouette(SPECIES[sp].parts.filter((p) => p[8] !== 'r')); // ohne Augen der Seite
      const count = (rs: string[]) => rs.join('').split('o').length - 1;
      expect(count(rows), `${sp}: Auge`).toBeGreaterThanOrEqual(count(plain));
      if (count(rows) > count(plain)) eyed++; // das Auge sitzt innen (sonst liegt es auf dem Rand, wie beim Frosch)
      // Rand und Bild reichen bis an alle vier Seiten des Rasters (nichts abgeschnitten, nichts verschoben)
      expect(
        [rows[0], rows.at(-1)].every((r) => r!.includes('o')),
        sp,
      ).toBe(true);
      expect(
        [0, cols - 1].every((x) => rows.some((r) => r[x] === 'o')),
        sp,
      ).toBe(true);
      seen.add(rows.join('\n'));
    }
    expect(seen.size).toBe(ALL.length);
    expect(eyed).toBeGreaterThanOrEqual(ALL.length - 2);
  });

  it('der Hase hat Ohren: oben ragen zwei schmale Spitzen über den Kopf', () => {
    const rows = silhouette(SPECIES.hase.parts);
    const top = rows[0]!;
    expect(top.replace(/\./g, '').length).toBeLessThanOrEqual(4);
    expect(rows.at(-1)!.replace(/\./g, '').length).toBeGreaterThan(top.replace(/\./g, '').length);
  });

  it('pulsiert zweimal je 0,8 s über die Deckkraft, auch bei reduzierter Bewegung; die Flügel wackeln nur ohne', () => {
    expect([0, 400, 800, 1200, HINT_MS, -1].map((t) => +hintGlow(t).toFixed(3))).toEqual([0, 1, 0, 1, 0, 0]);
    expect(hintShake(150, false)).toBeCloseTo(1);
    expect(hintShake(950, false)).toBeCloseTo(1); // zweimal
    expect([0, 300, 500, 1100, HINT_MS].map((t) => +hintShake(t, false).toFixed(3))).toEqual([0, 0, 0, 0, 0]);
    expect([150, 950].map((t) => hintShake(t, true))).toEqual([0, 0]);
  });

  it('2D: im Zeichen der Tür, gold aus den Tokens (kein Rot), pixelgenau aus dem Umriss, nach 1,6 s nichts mehr', () => {
    const world = worldOf(1);
    const door = world.gates.get('eis')!;
    const [mx, my] = door.mid;
    const P = projection(mx + 0.5, my + 0.5, 400, 300, 1);
    const rows = silhouette(SPECIES.igel.parts);
    const gold = rows
      .join('')
      .split('')
      .filter((c) => c === 'o').length;
    const { ctx, rects, state } = recorder();
    hintOutline(ctx, world, P, 'eis', rows, 400);
    expect(state.globalAlpha).toBe(1); // danach wieder deckend
    expect(rects).toHaveLength(2 * gold); // je Pixel Schatten und Gold
    expect(new Set(rects.map((r) => r.color))).toEqual(new Set([token('gold-light'), token('gold-dark')]));
    expect(rects.map((r) => r.color)).not.toContain(token('error'));
    expect(rects.every((r) => r.alpha === 1)).toBe(true);
    const px = HINT_PX * TILE_W;
    for (const r of rects)
      expect([r.w, r.h].map((v) => +v.toFixed(6))).toEqual([+px.toFixed(6), +(HINT_PX * 40).toFixed(6)]);
    // Lage: mittig über der Tür, unten auf HINT_Y über dem Boden, so groß wie das Raster
    const golds = rects.filter((r) => r.color === token('gold-light'));
    const [left, right] = [Math.min(...golds.map((r) => r.x)), Math.max(...golds.map((r) => r.x + r.w))];
    expect(right - left).toBeCloseTo(rows[0]!.length * px);
    expect((left + right) / 2).toBeCloseTo(P(mx + 0.5, 0, 0)[0]);
    const bottom = Math.max(...golds.map((r) => r.y + r.h));
    const [, ground] = P(mx + 0.5, my + 0.5 - door.out[1] / 4, world.cell(mx, my).h + HINT_Y);
    expect(bottom).toBeCloseTo(ground);
    // jedes gezeichnete Pixel ist eins des Umrisses (Spalte, Zeile vom Rand aus)
    const top = Math.min(...golds.map((r) => r.y));
    const drawn = new Set(golds.map((r) => `${Math.round((r.x - left) / px)},${Math.round((r.y - top) / r.h)}`));
    const want = new Set(rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === 'o' ? [`${x},${y}`] : []))));
    expect(drawn).toEqual(want);
    // halb ausgeblendet, dann vorbei
    const half = recorder();
    hintOutline(half.ctx, world, P, 'eis', rows, 200);
    expect(half.rects[0]!.alpha).toBeCloseTo(Math.SQRT1_2);
    for (const t of [0, HINT_MS, 1e9]) {
      const none = recorder();
      hintOutline(none.ctx, world, P, 'eis', rows, t);
      expect(none.rects, `${t} ms`).toEqual([]);
    }
  });

  it('zeigen: einmal „hm-hm?“, die Live-Region sagt es (auch denselben Text wieder), dann zeichnet es den Umriss', () => {
    vi.useFakeTimers();
    const world = worldOf(1);
    const played: unknown[] = [];
    const say = { textContent: 'alt' };
    vi.stubGlobal('document', { querySelector: (q: string) => (q === '.mw-say' ? say : null) });
    const draw = showHint({ score: (n) => void played.push(n) }, 'igel', 1000);
    expect(played).toEqual([notYet('eis')]);
    expect(say.textContent).toBe(''); // erst leeren …
    vi.advanceTimersByTime(150);
    expect(say.textContent).toBe('Noch nicht. Es fehlt noch: Igel'); // … dann setzen
    showHint({ score: () => {} }, 'igel', 7000);
    expect(say.textContent).toBe(''); // derselbe Text: wieder erst leer, sonst schwiege der Screenreader
    vi.advanceTimersByTime(150);
    expect(say.textContent).toBe('Noch nicht. Es fehlt noch: Igel');
    vi.useRealTimers();
    vi.stubGlobal('document', { querySelector: () => null });
    showHint({ score: () => {} }, 'igel', 7000); // ohne Live-Region: nur Ton und Bild, kein Fehler
    vi.unstubAllGlobals();
    const P = projection(0, 0, 400, 300, 1);
    const at = (now: number) => {
      const r = recorder();
      draw(r.ctx, world, P, now);
      return r.rects.length;
    };
    expect([at(1000), at(1400) > 0, at(2600)]).toEqual([0, true, 0]);
  });
});
