// Kleine Pixel-Zeichen über der Welt und in der Leiste (Herz, Note, Zzz, Fragezeichen) und Funken, die bei
// Begegnungen aufspringen. Gleich für 2D und die Ebene über 3D.

/** Funke: Bildschirmpunkt, Geschwindigkeit, Lebensdauer in Bildern (bei 60 Hz), Farbe und Größe */
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

export const HEART = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
export const NOTE = ['..kkkk', '..k..k', '..k..k', 'kkk.kk', 'kkk.kk'];
export const ZZZ = ['zzzz', '..z.', '.z..', 'zzzz'];
export const ASK = ['.qqq.', 'q...q', '...q.', '..q..', '.....', '..q..']; // Fragezeichen über verlorenen Tieren

/** Pixel-Zeichen zeichnen: unten mittig bei (cx, bottom), jedes Pixel `px` groß */
export function sprite(
  ctx: CanvasRenderingContext2D,
  grid: string[],
  color: string,
  cx: number,
  bottom: number,
  px: number,
) {
  ctx.fillStyle = color;
  const w = grid[0]?.length ?? 0;
  grid.forEach((row, r) => {
    for (let c = 0; c < w; c++)
      if (row[c] !== '.')
        ctx.fillRect(
          Math.round(cx + (c - w / 2) * px),
          Math.round(bottom + (r - grid.length) * px),
          Math.ceil(px),
          Math.ceil(px),
        );
  });
}

/** `n` Funken, die vom Bildschirmpunkt (sx, sy) in einem Bogen nach oben springen, in den Farben `colors` */
export function sparks([sx, sy]: readonly [number, number], colors: readonly string[], n: number, zoom: number) {
  return Array.from({ length: n }, (_, i): Particle => {
    const a = (i / n) * Math.PI * 2;
    const v = 1 + (i % 4) * 0.8;
    return {
      x: sx,
      y: sy,
      vx: Math.cos(a) * v,
      vy: -Math.abs(Math.sin(a)) * v * 1.4 - 1,
      life: 40 + (i % 5) * 6,
      color: colors[i % colors.length]!,
      size: (3 + (i % 3) * 2) * zoom,
    };
  });
}
