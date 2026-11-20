// Wetter von Mitwachsen – rein, ohne DOM, damit testbar. Es wechselt alle 5 Minuten Spielzeit. Auf der Lichtung gibt
// es Sonne, Wolken und sanften Regen; nach dem Regen steht manchmal ein Regenbogen am Himmel. In der Eis-Welt gibt es
// Sonne, leisen Schneefall und Pustewind mit Böen, nie Regen; nach dem Wind glitzert die Luft. Kein Gewitter, nichts
// Unheimliches. Gleicher Seed, gleicher Tag, gleiche Spielzeit, gleiche Gegend: gleiches Wetter. Jeder Tag beginnt mit
// Sonne. Die Regeln fragen nur, ob die Tiere der Wiese Schutz suchen (Regen bzw. Pustewind); alles andere ist Bild.
// Spezifikation: docs/specs/mitwachsen.md

import { hash } from '../../lib/games/rng';
import type { RegionId } from '../../data/games/mitwachsen';
import type { Climate } from './mitwachsen-world';

export type WeatherKind = 'sun' | 'clouds' | 'rain' | 'snow' | 'wind';
export const BLOCK = 3000; // Takte je Wetter (5 Minuten)
export const FADE = 200; // Takte für den Übergang (20 Sekunden)
export const RAINBOW = 900; // so lange steht der Regenbogen nach dem Regen (1,5 Minuten)
export const SPARKLE = 900; // so lange glitzert die Luft nach dem Pustewind (1,5 Minuten)
export const GUST = 300; // Takte je Böen-Fenster (30 s): in jedem genau eine Böe

/**
 * Wetter eines Abschnitts in einer Gegend; der erste jedes Tages ist sonnig. Lichtung: Sonne 50 %, Wolken 25 %,
 * Regen 25 %. Eis-Welt (eigene Reihe): Sonne 50 %, leiser Schneefall 25 %, Pustewind 25 %, nie Regen. Pustewind gibt
 * es erst, wenn der Pinguin auf der Schneewiese wohnt (`windOk`); vorher scheint an seiner Stelle die Sonne.
 */
export function kindOf(
  seed: number,
  day: number,
  block: number,
  realm: RegionId = 'lichtung',
  windOk = true,
): WeatherKind {
  if (block <= 0) return 'sun';
  if (realm === 'eis') {
    const roll = hash(seed, day, block, 53) % 4;
    return roll < 2 ? 'sun' : roll === 2 ? 'snow' : windOk ? 'wind' : 'sun';
  }
  const roll = hash(seed, day, block, 31) % 4;
  return roll < 2 ? 'sun' : roll === 2 ? 'clouds' : 'rain';
}

const kindAt = (seed: number, day: number, tick: number, realm: RegionId, windOk: boolean) =>
  kindOf(seed, day, Math.floor(tick / BLOCK), realm, windOk);

/** Regnet es gerade auf der Lichtung? */
export const raining = (seed: number, day: number, tick: number) =>
  kindAt(seed, day, tick, 'lichtung', true) === 'rain';

/** Weht in der Eis-Welt gerade der Pustewind? */
export const windy = (seed: number, day: number, tick: number, windOk = true) =>
  kindAt(seed, day, tick, 'eis', windOk) === 'wind';

/**
 * Suchen die Tiere der Wiese einer Gegend gerade Schutz unter ihrem Unterstand? Auf der Lichtung bei Regen (unter dem
 * Riesenpilz), in der Eis-Welt bei Pustewind (im Iglu). Jede Wiese folgt nur dem Wetter ihrer Gegend.
 */
export function sheltering(seed: number, day: number, tick: number, realm: RegionId, windOk = true): boolean {
  const kind = kindAt(seed, day, tick, realm, windOk);
  return kind === 'rain' || kind === 'wind';
}

/**
 * Böe im Fenster eines Takts: Jedes Fenster (`GUST`) hat genau eine, sie beginnt 0 bis 5 s nach seinem Anfang und
 * dauert 6 bis 10 s. So kommt etwa alle 25 bis 35 s eine Böe. Gleicher Seed, Tag und Takt: gleiche Böe.
 */
export function gustOf(seed: number, day: number, tick: number): { start: number; len: number } {
  const w = Math.floor(tick / GUST);
  return { start: w * GUST + (hash(seed, day, w, 72) % 51), len: 60 + (hash(seed, day, w, 71) % 41) };
}

/** Wie stark die Böe gerade bläst (0 … 1, weich an- und abschwellend), unabhängig vom Wetter */
export function gustAt(seed: number, day: number, tick: number): number {
  const { start, len } = gustOf(seed, day, tick);
  const into = tick - start;
  return into < 0 || into >= len ? 0 : Math.sin((Math.PI * into) / len);
}

/** Wie das Wetter aussieht, je 0 … 1; Schneefall, Pustewind, Böe und Glitzerluft gibt es nur in der Eis-Welt */
export type WeatherLook = {
  cloud: number;
  rain: number;
  rainbow: number;
  snow: number; // leiser Schneefall
  wind: number; // Pustewind: eine leichte Brise, die Böen kommen dazu
  gust: number; // Böe gerade
  sparkle: number; // Glitzerluft nach dem Pustewind
};

/** Wolken, Regen, Schneefall und Wind je Wetter; Schnee und Wind lassen den Himmel hell (höchstens leicht milchig) */
const LOOKS: Record<WeatherKind, readonly [number, number, number, number]> = {
  sun: [0, 0, 0, 0],
  clouds: [0.7, 0, 0, 0],
  rain: [1, 1, 0, 0],
  snow: [0.15, 0, 1, 0],
  wind: [0.2, 0, 0, 1],
};

/** Nach einem Wetter eine Weile Regenbogen bzw. Glitzerluft, weich ein- und ausgeblendet */
const after = (into: number, last: number) => Math.min(1, into / FADE) * Math.min(1, Math.max(0, (last - into) / FADE));

/** Wie das Wetter einer Gegend gerade aussieht, mit weichem Übergang am Anfang jedes Abschnitts */
export function weatherLook(
  seed: number,
  day: number,
  tick: number,
  realm: RegionId = 'lichtung',
  windOk = true,
): WeatherLook {
  const block = Math.floor(tick / BLOCK);
  const into = tick - block * BLOCK;
  const now = kindOf(seed, day, block, realm, windOk);
  const before = kindOf(seed, day, block - 1, realm, windOk);
  const t = Math.min(1, into / FADE);
  const mix = (i: 0 | 1 | 2 | 3) => LOOKS[before][i] + (LOOKS[now][i] - LOOKS[before][i]) * t;
  const wind = mix(3);
  const rainbow = now === 'sun' && before === 'rain' && block > 0 ? after(into, RAINBOW) : 0;
  const sparkle = now !== 'wind' && before === 'wind' && block > 0 ? after(into, SPARKLE) : 0;
  return { cloud: mix(0), rain: mix(1), rainbow, snow: mix(2), wind, gust: wind * gustAt(seed, day, tick), sparkle };
}

/**
 * Wind: überall eine leichte Brise, stärker Richtung Wolken und Wald, bei Wolken und Regen und am stärksten beim
 * Pustewind mit seinen Böen (0 … 1)
 */
export function windAt(mood: Climate, look: WeatherLook): number {
  const dir = mood.id === 'wolken' ? 0.4 : mood.id === 'wald' ? 0.25 : 0;
  return Math.min(
    1,
    0.15 + dir * mood.strength + look.cloud * 0.15 + look.rain * 0.25 + look.wind * 0.5 + look.gust * 0.3,
  );
}
