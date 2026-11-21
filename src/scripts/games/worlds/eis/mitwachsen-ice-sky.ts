// Wetter der Eis-Welt in der Luft, gleich für beide Ansichten (die 3D-Ansicht zeichnet die Ebene darüber mit ihrer
// eigenen Projektion): leiser Schneefall, Pustewind mit Flockenwellen, Schneewirbeln und Pulverfahnen an den Klippen,
// Glitzerluft danach, der Wimpel auf dem Iglu und nachts im Schneebett das Polarlicht, zu dem die Eiskristalle sanft
// leuchten (über der Nacht gezeichnet, damit man es sieht). Alles, was sich bewegt, nur
// ohne reduzierte Bewegung. Teil des Welt-Pakets der Eis-Welt (über view-2d.ts); die Ansicht zeichnet es, wenn die
// Figur im Kessel, das Eistor offen oder der verlaufene Pinguin da ist. view-2d.ts legt es mit dem Bild der Weltgrenze
// und dem Pinguin am Tor in die Form `Sky` des Kerns (mitwachsen-view.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Wetter und Unterstand“)

import type { Projection } from '../../../../lib/games/front';
import { hash } from '../../../../lib/games/rng';
import { IGLOO_H } from '../../../../data/games/mitwachsen-eis';
import { crystalGlow } from './mitwachsen-ice-look';
import { wrap, type SkyScene } from '../../mitwachsen-sky';
import type { World } from '../../mitwachsen-world';

const NEAR = 24; // Dinge in der Welt (Wirbel, Fahnen, Wimpel) nur so nah an der Kamera zeichnen
const PENNANT = ['#e8504a', '#ffffff', '#3f8fd8', '#6dbd47']; // bunter Wimpel (kein Gold: das ist die Aktionsfarbe)
const AURORA = ['#5ee0a0', '#4fd1c5', '#8a7be8']; // Polarlicht: Grün, Türkis, Violett

/**
 * Wetter der Eis-Welt in der Luft: leiser Schneefall (senkrecht, langsam), beim Pustewind Flockenwellen waagerecht
 * über das Bild (bei einer Böe dichter und schneller), kleine Schneewirbel auf der Ebene und Pulverfahnen an den
 * Kanten der Eisklippen; nach dem Wind Glitzerluft. Der Wimpel auf dem Iglu flattert im Wind (bei reduzierter Bewegung
 * steht er still waagerecht, bei Windstille hängt er).
 */
export function iceWeather(ctx: CanvasRenderingContext2D, world: World, sc: SkyScene, P: Projection) {
  const { snow, wind, gust, sparkle } = sc.weather;
  const home = world.homes.eis;
  const near = (x: number, y: number) =>
    Math.abs(x - sc.cam.x) + Math.abs(y - sc.cam.y) < NEAR && sc.explored(Math.round(x), Math.round(y));
  if (near(...home.shelterStem)) pennant(ctx, world, sc, P);
  if (sc.reduced) return;
  const { width: W, height: H, zoom: z, now } = sc;
  if (snow > 0) {
    const size = Math.max(3, Math.round(3.5 * z));
    for (let i = 0; i < Math.round(110 * snow); i++) {
      const y = wrap((hash(40, i) % 1000) * 0.001 * (H + 40) + now * (0.025 + (hash(41, i) % 20) / 1000), H + 40) - 20;
      const x = (hash(42, i) % 1000) * 0.001 * W + Math.sin(now / 1400 + i) * 6 * z;
      flake(ctx, x, y, size, size, 0.85 * snow);
    }
  }
  if (wind > 0) {
    // Flockenwellen: waagerecht nach rechts, in sanften Wellen
    const speed = (0.12 + gust * 0.14) * z;
    for (let i = 0; i < Math.round((50 + 70 * gust) * wind); i++) {
      const x = wrap((hash(43, i) % 1000) * 0.001 * (W + 80) + now * speed * (1 + (i % 3) * 0.3), W + 80) - 40;
      const y = (hash(44, i) % 1000) * 0.001 * H + Math.sin(x / (90 * z) + i) * 14 * z;
      flake(ctx, x, y, Math.round((3 + gust * 5) * z), Math.max(2, Math.round(2 * z)), 0.8 * wind);
    }
    for (const [x, y, h] of rims(world)) if (near(x, y)) plume(ctx, P, sc, x, y, h, i32(x, y));
    for (let i = 0; i < 2; i++) {
      const t = now / 1000;
      const wx = home.bed[0] + 0.5 + Math.cos(t * 0.05 + i * 3) * 8,
        wy = home.bed[1] + 0.5 + Math.sin(t * 0.07 + i * 3) * 6;
      if (near(wx, wy)) whirl(ctx, P, sc, wx, wy, world.cell(Math.floor(wx), Math.floor(wy)).h);
    }
  }
  if (sparkle > 0) {
    // Glitzerluft: funkelnder Diamantstaub
    for (let i = 0; i < Math.round(60 * sparkle); i++) {
      const glow = Math.sin(now / 260 + i * 1.7);
      if (glow < 0.4) continue;
      const x = (hash(45, i) % 1000) * 0.001 * W + Math.sin(now / 3000 + i) * 10 * z;
      const y = (hash(46, i) % 1000) * 0.001 * H * 0.85;
      const s = Math.max(1, Math.round(2 * z));
      ctx.fillStyle = `rgba(${i % 3 ? '255,255,255' : '190,230,255'},${((glow - 0.4) * 1.6 * sparkle).toFixed(3)})`;
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
      if (glow > 0.85) {
        ctx.fillRect(Math.round(x - 2 * s), Math.round(y), 5 * s, s / 2 + 0.5);
        ctx.fillRect(Math.round(x), Math.round(y - 2 * s), s / 2 + 0.5, 5 * s);
      }
    }
  }
}

const i32 = (x: number, y: number) => hash(47, x, y) % 1000;

/** Pulverschnee weht in feinen Fahnen von der Kante einer Klippe (nach rechts, mit dem Wind) */
function plume(ctx: CanvasRenderingContext2D, P: Projection, sc: SkyScene, x: number, y: number, h: number, k: number) {
  const s = Math.max(2, Math.round(2.5 * sc.zoom));
  for (let j = 0; j < 7; j++) {
    const p = wrap(sc.now / 900 + j / 7 + k / 1000, 1);
    const [px, py] = P(x + 0.5 + p * 2.4, y + 0.5, h + 0.1 + p * 0.7 + Math.sin(p * 9 + k) * 0.1);
    flake(ctx, px, py, s, s, (1 - p) * 0.75 * sc.weather.wind);
  }
}

/** Kleiner, runder Schneewirbel: Flocken kreisen eng um eine senkrechte Achse */
function whirl(ctx: CanvasRenderingContext2D, P: Projection, sc: SkyScene, x: number, y: number, h: number) {
  const s = Math.max(2, Math.round(2.5 * sc.zoom));
  for (let k = 0; k < 14; k++) {
    const a = sc.now / 160 + k * 0.9;
    const r = 0.12 + k * 0.025;
    const [px, py] = P(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, h + k * 0.07);
    flake(ctx, px, py, s, s, 0.8 * sc.weather.wind);
  }
}

/** Eine Flocke: weiß mit einem Hauch Blaugrau darunter, damit man sie auch vor dem Schnee sieht */
function flake(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number) {
  const [px, py] = [Math.round(x), Math.round(y)];
  ctx.fillStyle = `rgba(96,128,166,${(0.5 * alpha).toFixed(3)})`;
  ctx.fillRect(px + 1, py + 1, w, h);
  ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
  ctx.fillRect(px, py, w, h);
}

/** Kanten der Eisklippen rund um den Kessel: Von dort wehen beim Pustewind die Pulverfahnen (je Welt einmal gesucht) */
const rimCache = new WeakMap<World, [number, number, number][]>();
function rims(world: World): [number, number, number][] {
  let out = rimCache.get(world);
  if (out) return out;
  out = [];
  const [bx, by] = world.homes.eis.bed;
  for (let k = 0; k < 16; k++) {
    const [dx, dy] = [Math.cos((k / 16) * Math.PI * 2), Math.sin((k / 16) * Math.PI * 2)];
    for (let r = 8; r < 40; r++) {
      const [x, y] = [Math.round(bx + dx * r), Math.round(by + dy * r)];
      const c = world.cell(x, y);
      if (c.region !== 'border') continue;
      if (c.biome === 'eis') out.push([x, y, c.h]);
      break;
    }
  }
  rimCache.set(world, out);
  return out;
}

/** Bunter Wimpel oben auf dem Iglu, an einer kleinen Stange */
function pennant(ctx: CanvasRenderingContext2D, world: World, sc: SkyScene, P: Projection) {
  const [sx, sy] = world.homes.eis.shelterStem;
  const top = world.cell(sx, sy).h + IGLOO_H;
  const [bx, by] = P(sx + 0.5, sy + 2, top - 0.1);
  const [, ty] = P(sx + 0.5, sy + 2, top + 1.2);
  const z = sc.zoom;
  const pole = Math.max(2, Math.round(3 * z));
  ctx.fillStyle = '#6b4a36';
  ctx.fillRect(Math.round(bx - pole / 2), Math.round(ty), pole, Math.round(by - ty));
  const blowing = sc.weather.wind > 0.1;
  const seg = Math.round(9 * z);
  PENNANT.forEach((color, k) => {
    ctx.fillStyle = color;
    const size = Math.round((4 - k) * 4 * z); // spitz zulaufend
    if (!blowing) {
      ctx.fillRect(Math.round(bx + pole / 2), Math.round(ty + k * seg), size / 1.5, seg); // hängt an der Stange herunter
      return;
    }
    const wave = sc.reduced ? 0 : Math.sin(sc.now / (110 - sc.weather.gust * 40) - k * 0.9) * k * 2.5 * z;
    ctx.fillRect(Math.round(bx + pole / 2 + k * seg), Math.round(ty + wave + (16 * z - size) / 2), seg, size);
  });
}

/**
 * Polarlicht: grüne, türkise und violette Schleier oben am Nachthimmel (bei reduzierter Bewegung still); dazu leuchten
 * die Eiskristalle, die die 2D-Ansicht gerade zeigt
 */
export function aurora(ctx: CanvasRenderingContext2D, sc: SkyScene, P: Projection) {
  const { width: W, height: H, zoom: z } = sc;
  const t = sc.reduced ? 0 : sc.now / 1000;
  const step = Math.max(4, Math.round(6 * z));
  AURORA.forEach((color, band) => {
    ctx.fillStyle = color;
    for (let x = 0; x < W; x += step) {
      const u = x / W;
      const y = H * (0.08 + band * 0.07) + Math.sin(u * 5 + t * 0.4 + band * 1.3) * H * 0.05;
      const len = H * (0.1 + 0.06 * Math.sin(u * 9 - t * 0.6 + band));
      ctx.globalAlpha = sc.aurora * 0.22 * (0.55 + 0.45 * Math.sin(u * 13 + t * 0.9 + band * 2));
      ctx.fillRect(x, Math.round(y), step, Math.round(len));
    }
  });
  ctx.globalAlpha = 1;
  glows(ctx, sc, P);
}

/**
 * Eiskristalle, die die 2D-Ansicht in diesem Bild gezeichnet hat (also sichtbar, ohne Nebel): Lage, Höhe, Farbe, Bild
 * (`now`). Der Haken der 2D-Ansicht trägt sie ein (`shine`, view-2d.ts); die 3D-Ansicht nutzt ihn nicht, dort leuchtet
 * das Material selbst (`View3D.glow`). Höchstens ein Eintrag je Kristall.
 */
const shown = new Map<string, readonly [number, number, number, string, number]>();

/** Der Haken der 2D-Ansicht zeichnet gerade den Eiskristall bei (x, y) */
export function shine(x: number, y: number, h: number, color: string, now: number) {
  shown.set(`${x},${y}`, [x, y, h, color, now]);
}

/**
 * Schein um die Eiskristalle beim Polarlicht (nur 2D, über der Nacht): ein kleiner Hof in ihrer Farbe, innen weiß,
 * kaum breiter als der Kristall. Hell, so wie `crystalGlow` sagt (je Kristall versetzt pulsierend, bei reduzierter
 * Bewegung ruhig).
 */
function glows(ctx: CanvasRenderingContext2D, sc: SkyScene, P: Projection) {
  const z = sc.zoom;
  for (const [x, y, h, color, now] of shown.values()) {
    if (now !== sc.now) continue; // nicht in diesem Bild gezeichnet (außer Sicht, im Nebel oder in 3D)
    const g = crystalGlow(sc.aurora, sc.reduced, now, (hash(48, x, y) % 628) / 100);
    const [px, py] = P(x + 0.5, y + 0.5, h + 0.55);
    for (const [r, a, c] of [
      [6, 0.3, color],
      [2.5, 0.6, '#ffffff'],
    ] as const) {
      ctx.globalAlpha = g * a;
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(px - r * z), Math.round(py - r * z), Math.round(2 * r * z), Math.round(2 * r * z));
    }
  }
  ctx.globalAlpha = 1;
}
