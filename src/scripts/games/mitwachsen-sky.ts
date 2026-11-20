// Leben in der Luft über der Welt, gleich für beide Ansichten (die 3D-Ansicht zeichnet die Ebene darüber mit ihrer
// eigenen Projektion): Leben der Richtungen zu den Toren. Das Wetter der Eis-Welt zeichnet mitwachsen-ice-sky.ts
// (erst geladen, wenn die Figur im Kessel ist). Nichts davon bei reduzierter Bewegung.
// Spezifikation: docs/specs/mitwachsen.md

import { cycle, hash } from '../../lib/games/rng';
import type { WeatherLook } from './mitwachsen-weather';
import type { Climate } from './mitwachsen-world';

/** Was die Luft von der Szene braucht (Teil von `Scene` in mitwachsen-render.ts; auch für mitwachsen-ice-sky.ts) */
export type SkyScene = {
  width: number;
  height: number;
  zoom: number;
  now: number;
  cam: { x: number; y: number };
  reduced: boolean;
  mood: Climate;
  wind: number;
  weather: WeatherLook;
  aurora: number; // 0 … 1: nachts im Schneebett leuchtet das Polarlicht
  explored: (x: number, y: number) => boolean;
};

export const wrap = (v: number, m: number) => ((v % m) + m) % m;

/**
 * Leben der Richtungen, je näher am Tor, desto mehr: Herbstblätter (Wald), Federwölkchen und Wolkenschatten
 * (Wolken), glimmende Funken (Lava), schwebende Sporen (Pilze), Glühwürmchen auch am Tag (Höhle).
 * Nichts davon bei reduzierter Bewegung.
 */
export function moodLife(ctx: CanvasRenderingContext2D, sc: SkyScene) {
  if (sc.reduced || sc.mood.strength <= 0) return;
  const t = sc.now / 1000;
  const s = sc.mood.strength * 0.5; // nur eine Ahnung der Welt hinter dem Tor
  const W = sc.width,
    H = sc.height,
    z = sc.zoom;
  switch (sc.mood.id) {
    case 'wald': {
      const colors = ['#e8823a', '#c8452e', '#f2b13a', '#a0522d'];
      const n = Math.round(30 * s);
      for (let i = 0; i < n; i++) {
        const fall = 18 + (hash(11, i) % 20);
        const y = wrap((hash(12, i) % 1000) * H * 0.001 + t * fall * z, H + 40) - 20;
        const x =
          wrap((hash(13, i) % 1000) * W * 0.001 + t * (30 + sc.wind * 60) * z, W + 40) -
          20 +
          Math.sin(t * 2 + i) * 10 * z;
        const flip = Math.sin(t * 4 + i) > 0;
        ctx.fillStyle = cycle(colors, i);
        ctx.fillRect(Math.round(x), Math.round(y), (flip ? 8 : 5) * z, (flip ? 5 : 8) * z);
      }
      break;
    }
    case 'wolken': {
      // ziehende Wolkenschatten auf dem Boden, darüber weiße Federwölkchen
      ctx.fillStyle = `rgba(40,52,72,${(0.1 * s).toFixed(3)})`;
      for (let i = 0; i < 3; i++) {
        const x = wrap(i * W * 0.45 + t * 22 * z, W + 400) - 200;
        const y = (0.25 + i * 0.27) * H;
        for (let k = -2; k <= 2; k++)
          ctx.fillRect(x + k * 30 * z, y - (3 - Math.abs(k)) * 14 * z, 60 * z, (3 - Math.abs(k)) * 28 * z);
      }
      ctx.fillStyle = `rgba(255,255,255,${(0.8 * s).toFixed(3)})`;
      for (let i = 0; i < Math.round(18 * s); i++) {
        const x = wrap((hash(14, i) % 1000) * W * 0.001 + t * (60 + (i % 5) * 15) * z, W + 60) - 30;
        const y = (hash(15, i) % 1000) * H * 0.001 + Math.sin(t + i) * 8 * z;
        ctx.fillRect(Math.round(x), Math.round(y), 10 * z, 2 * z);
      }
      break;
    }
    case 'lava':
      for (let i = 0; i < Math.round(22 * s); i++) {
        const life = wrap(t * 0.4 + (hash(16, i) % 100) / 100, 1);
        const x = (hash(17, i) % 1000) * W * 0.001 + Math.sin(t * 1.5 + i) * 6 * z;
        const y = H * (1 - life) - 10;
        ctx.fillStyle = `rgba(255,${150 + (i % 4) * 20},60,${((1 - life) * 0.9).toFixed(2)})`;
        ctx.fillRect(Math.round(x), Math.round(y), 4 * z, 4 * z);
      }
      break;
    case 'pilze':
      for (let i = 0; i < Math.round(28 * s); i++) {
        const y = wrap((hash(18, i) % 1000) * H * 0.001 - t * (8 + (i % 4) * 3) * z, H + 20) - 10;
        const x = (hash(19, i) % 1000) * W * 0.001 + Math.sin(t * 0.8 + i * 1.7) * 14 * z;
        ctx.fillStyle = i % 3 ? 'rgba(220,180,255,.75)' : 'rgba(255,255,255,.7)';
        ctx.fillRect(Math.round(x), Math.round(y), 3 * z, 3 * z);
      }
      break;
    case 'hoehle':
      for (let i = 0; i < Math.round(14 * s); i++) {
        const x = ((Math.sin(t * 0.19 + i * 1.9) + 1) / 2) * W;
        const y = (((Math.sin(t * 0.16 + i * 2.7) + 1) / 2) * 0.7 + 0.2) * H;
        const glow = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2.2 + i * 1.3));
        ctx.fillStyle = `rgba(255,236,120,${(glow * s).toFixed(2)})`;
        ctx.fillRect(x, y, 3 * z, 3 * z);
        ctx.fillStyle = `rgba(255,236,120,${(glow * 0.25 * s).toFixed(2)})`;
        ctx.fillRect(x - 3 * z, y - 3 * z, 9 * z, 9 * z);
      }
      break;
  }
}
