// Postkarte der Torfront in 2D: Jedes Tor erscheint von vorn, gleich wo es in der Welt liegt (Norden, Osten, Süden,
// Westen): Die Zeichnung bekommt die Lage gar nicht. Geprüft wird darum je Lage ein Tor, das in einer Welt dort liegt.
// Gezeichnet wird gegen ein aufzeichnendes Canvas (ohne DOM).
import { describe, expect, it, vi } from 'vitest';
import { GAME_COLORS, THEME_COLORS, type GateId } from '../../data/games/mitwachsen';
import type { Guest } from './mitwachsen-guest-look';
import { CARD_CELLS, drawFront } from './mitwachsen-postcard';
import { gatePlaces } from './mitwachsen-world';

const DOOR = '#6b4423'; // Vorderseite der Tür (mitwachsen-gate-look.ts)
const [W, H] = [440, 330]; // eine Postkarte im Format 4 : 3
const CELL = W / CARD_CELLS; // so breit ist ein Feld auf der Postkarte

type Rect = { x: number; y: number; w: number; h: number; color: string };
/** Canvas, das jedes Rechteck mit Farbe aufzeichnet */
function recorder() {
  const rects: Rect[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    clearRect() {
      rects.length = 0;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, color: this.fillStyle });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

const draw = (id: GateId, open = 0, guest: Guest | null = null) => {
  const { ctx, rects } = recorder();
  drawFront(ctx, W, H, id, open, guest);
  return rects;
};
/** Zeichen mitten auf der Tür (in der Farbe des Portals; die Kappen der Türme haben sie auch, stehen aber außen) */
const signed = (rs: Rect[], id: GateId) =>
  rs.some((q) => q.color === THEME_COLORS[id].portal && Math.abs(q.x + q.w / 2 - W / 2) < 1);
const span = (rs: Rect[]) => [Math.min(...rs.map((r) => r.x)), Math.max(...rs.map((r) => r.x + r.w))] as const;

/** Je Lage ein Tor (Seeds 1 … 40): Richtung nach außen (`out`) → Kennung */
function gatesByLage() {
  const found = new Map<string, GateId>();
  for (let seed = 1; seed <= 40 && found.size < 4; seed++)
    for (const g of gatePlaces(seed).values()) found.set(g.out.join(), found.get(g.out.join()) ?? g.id);
  return found;
}

describe('Postkarte der Torfront (2D)', () => {
  const lagen = gatesByLage();

  it('es gibt Tore in allen vier Lagen', () => {
    expect([...lagen.keys()].sort()).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
  });

  for (const [out, id] of gatesByLage())
    it(`Tor ${id} (liegt in einer Welt nach außen ${out}): von vorn, Tür fünf Felder breit in der Mitte, Türme links und rechts, alles im Bild`, () => {
      const rects = draw(id);
      const door = rects.filter((r) => r.color === DOOR);
      const [l, r] = span(door);
      expect(l).toBeCloseTo(W / 2 - 2.5 * CELL, 5); // die ganze Tür von vorn, nicht von der Seite
      expect(r).toBeCloseTo(W / 2 + 2.5 * CELL, 5);
      const theme = THEME_COLORS[id];
      const towers = rects.filter((q) => q.color === theme.side && (q.x + q.w <= l + 1e-6 || q.x >= r - 1e-6));
      expect(towers.some((q) => q.x < l)).toBe(true);
      expect(towers.some((q) => q.x >= r - 1e-6)).toBe(true);
      expect(signed(rects, id)).toBe(true);
      const top = Math.min(...rects.map((q) => q.y));
      expect(top).toBeGreaterThan(0.05 * H); // Turmspitzen im Bild, mit Himmel darüber
      expect(top).toBeLessThan(0.25 * H); // das Tor füllt die Postkarte
    });

  it('die Lage bekommt die Zeichnung gar nicht: jedes Tor in den Farben seiner Welt, sonst gleich', () => {
    expect(drawFront.length).toBe(6); // Canvas, Breite, Höhe, Tor, wie offen, Pinguin; keine Lage
    const [eis, lava] = [draw('eis'), draw('lava')];
    expect(eis).not.toEqual(lava);
    expect(eis.map((r) => [r.x, r.y, r.w, r.h])).toEqual(lava.map((r) => [r.x, r.y, r.w, r.h])); // gleiche Form
  });

  it('offen: die Flügel stehen an den Angeln, in der Mitte der dunkle Gang', () => {
    const rects = draw('eis', 1);
    expect(rects.filter((r) => r.color === DOOR && Math.abs(r.x + r.w / 2 - W / 2) < CELL)).toEqual([]);
    expect(rects.some((r) => r.color === GAME_COLORS.ink && r.x < W / 2 && r.x + r.w > W / 2)).toBe(true);
    expect(signed(rects, 'eis')).toBe(false); // kein Zeichen auf offener Tür
  });

  it('führt der Pinguin zu diesem Tor, steht sein Umriss mitten auf der Tür (statt des Zeichens); an anderen nicht', () => {
    const outline = vi.fn();
    const guest: Guest = { gate: 'eis', outline, rim: () => 0 };
    const rects = draw('eis', 0, guest);
    expect(outline).toHaveBeenCalledOnce();
    expect(outline.mock.calls[0]?.[2]).toBe(0.5); // mitten auf der Tür
    expect(signed(rects, 'eis')).toBe(false);
    draw('sand', 0, guest);
    expect(outline).toHaveBeenCalledOnce();
  });
});
