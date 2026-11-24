import { describe, expect, it } from 'vitest';
import { TILE_W, projection } from '../../lib/games/front';
import {
  CM,
  TAP_MAX,
  TAP_RADIUS,
  byRow,
  seatOf,
  tapCmd,
  tapRide,
  withHop,
  type RideBody,
} from './mitwachsen-ride-view';
import type { Box } from './mitwachsen-view';

const body = (id: string, x: number, y: number, more: Partial<RideBody> = {}): RideBody => ({
  id,
  key: id,
  x,
  y,
  z: 1,
  dir: 'e',
  parts: [],
  ...more,
});
const SLED = body('ride:schlitten', 10, 5, { seat: true });
const DEER = body('ride:schlitten:rentier', 11, 5);
const SHED = body('ride:schlitten:schuppen', 8.5, 5.5);

describe('Haken der Ansicht für Fahrzeuge (mitwachsen-ride-view.ts)', () => {
  it('die Figur sitzt im Körper mit `seat`; hüpft sie, hüpft nur er mit', () => {
    expect(seatOf([SHED, SLED, DEER])).toBe(SLED);
    expect(seatOf([SHED, DEER])).toBeUndefined();
    const rides = [SHED, SLED, DEER];
    expect(withHop(rides, 0)).toBe(rides); // ohne Hüpfer dieselbe Liste
    const hopped = withHop(rides, 0.2);
    expect(hopped.map((r) => r.z)).toEqual([1, 1.2, 1]);
    expect(SLED.z).toBe(1); // das Original bleibt
  });

  it('Marken kommen in der Reihe ihrer Vorderkante dran (wie die Eis-Dinge)', () => {
    const a: Box = [3, 4, 1, 1, 0.12, 0.01, 'a', 'a'];
    const b: Box = [3, 4.26, 1, 1, 0.12, 0.01, 'b', 'b'];
    const c: Box = [3.26, 4, 1, 0.12, 1, 0.01, 'c', 'c'];
    const d: Box = [3, 5, 1, 1, 1, 0.01, 'd', 'd'];
    const rows = byRow([a, b, c, d]);
    expect(rows.get(4)).toEqual([a, b, c]);
    expect(rows.get(5)).toEqual([d]);
  });

  it('Antippen trifft den nächsten Körper unter dem Finger (in Feldbreiten der Ansicht), sonst nichts', () => {
    const P = projection(10, 5, 400, 300, 1);
    const [sx, sy] = P(10.5, 5.5, 1.4); // Mitte des Schlittens
    expect(tapRide([SHED, SLED, DEER], P, sx, sy)).toBe(SLED);
    expect(tapRide([SHED, SLED, DEER], P, sx + TILE_W * 0.7, sy)).toBe(DEER); // näher am Rentier
    expect(tapRide([SHED, SLED, DEER], P, sx, sy + TILE_W * 2)).toBeUndefined();
    expect(tapRide([body('player', 10, 5)], P, sx, sy)).toBeUndefined(); // nur Körper `ride:*`
    // klein gezoomt: der Radius schrumpft mit (0,8 Feldbreiten, hier gut 25 px)
    const S = projection(10, 5, 400, 300, 0.5);
    const [kx, ky] = S(10.5, 5.5, 1.4);
    expect(tapRide([SLED], S, kx + TILE_W * 0.5 * (TAP_RADIUS - 0.05), ky)).toBe(SLED);
    expect(tapRide([SLED], S, kx + TILE_W * 0.5 * (TAP_RADIUS + 0.05), ky)).toBeUndefined();
  });

  it('nah oder groß gezoomt trifft ein Finger höchstens max(38 px, 1 cm) weit (Konzept Schritt 14)', () => {
    expect(TAP_MAX).toBe(Math.max(38, CM));
    expect(CM).toBeCloseTo(37.8, 1);
    for (const zoom of [1, 1.25, 2]) {
      const Z = projection(10, 5, 400, 300, zoom);
      expect(TILE_W * zoom * TAP_RADIUS).toBeGreaterThan(TAP_MAX); // 0,8 Feldbreiten wären mehr
      const [zx, zy] = Z(10.5, 5.5, 1.4);
      expect(tapRide([SLED], Z, zx + TAP_MAX - 1, zy)).toBe(SLED);
      expect(tapRide([SLED], Z, zx + TAP_MAX + 1, zy)).toBeUndefined();
      expect(tapRide([SLED], Z, zx, zy - TAP_MAX - 1)).toBeUndefined();
    }
    // eine nahe 3D-Kamera (große Felder auf dem Schirm): ebenso höchstens TAP_MAX
    const near = (x: number, y: number, z: number): [number, number] => [x * 200, y * 120 - z * 90];
    const [nx, ny] = near(10.5, 5.5, 1.4);
    expect(tapRide([SLED], near, nx + TAP_MAX - 1, ny)).toBe(SLED);
    expect(tapRide([SLED], near, nx + TAP_MAX + 1, ny)).toBeUndefined();
  });

  it('Tok (ein Bote, `being`) ist antippbar wie ein Fahrzeug, der nächste zuerst; andere Körper nie', () => {
    const P = projection(10, 5, 400, 300, 1);
    const tok = { id: 'hoehle:tok', x: 12, y: 5, z: 1, being: true as const };
    const [tx, ty] = P(12.5, 5.5, 1.4);
    expect(tapRide([SLED, DEER, tok], P, tx, ty)).toBe(tok);
    expect(tapRide([{ ...tok, being: undefined }], P, tx, ty)).toBeUndefined(); // ohne `being` nur Körper `ride:*`
    expect(tapRide([SLED, DEER, tok], P, tx - TILE_W * 0.6, ty)).toBe(DEER); // näher am Rentier
  });

  it('angetippt ist ein neuer Druck in seine Richtung, nur zum Einsteigen', () => {
    expect(tapCmd(SLED, { x: 10, y: 9 })).toEqual({
      type: 'move',
      dir: 'n',
      fresh: true,
      tap: true,
      ride: 'schlitten',
    });
    expect(tapCmd(SHED, { x: 2, y: 5 })).toMatchObject({ dir: 'e', tap: true });
    expect(tapCmd(DEER, { x: 11, y: 5 }).dir).toBe('w'); // auf demselben Feld: irgendeine Richtung, das Fahrzeug entscheidet
    // Tok: ein Druck zu ihm hin mit seiner Kennung, keinem Fahrzeug
    expect(tapCmd({ id: 'hoehle:tok', x: 12, y: 5, being: true }, { x: 10, y: 5 })).toEqual({
      type: 'move',
      dir: 'e',
      fresh: true,
      tap: true,
      who: 'hoehle:tok',
    });
  });
});
