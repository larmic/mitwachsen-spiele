// Die acht Zugänge in 3D: je Welt ein eigener Bauplan (mitwachsen-gate-<welt>.ts) aus dem Baukasten
// (mitwachsen-gate-kit.ts). Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore)

import type { GateTheme } from '../../data/games/mitwachsen';
import type { GateBuild, GateLook, GateMotion, Parts, Wing } from './mitwachsen-gate-kit';
import { build as eis } from './mitwachsen-gate-eis';
import { build as sand } from './mitwachsen-gate-sand';
import { build as wasser, motion as wasserMotion } from './mitwachsen-gate-wasser';
import { build as lava, motion as lavaMotion } from './mitwachsen-gate-lava';
import { build as hoehle } from './mitwachsen-gate-hoehle';
import { build as wald } from './mitwachsen-gate-wald';
import { build as wolken } from './mitwachsen-gate-wolken';
import { build as pilze, motion as pilzeMotion } from './mitwachsen-gate-pilze';

const BUILD: Record<GateTheme, GateBuild> = { eis, sand, wasser, lava, hoehle, wald, wolken, pilze };
// Zugänge mit bewegten Teilen: die fließende Wasserwand, die Glutkaskade, die wiegenden Pilzranken
const MOTION: Partial<Record<GateTheme, GateMotion>> = { wasser: wasserMotion, lava: lavaMotion, pilze: pilzeMotion };

/**
 * Ein Zugang: Geometrie in `p`, dazu seine Türflügel (nur das Eistor hat welche). `open` 0 zu … 1 offen, `outline` der
 * Umriss des verlaufenen Tiers, `lit` wie weit dessen Ritual leuchtet, `cam` die Richtung zur Kamera in
 * Torhaus-Koordinaten (x, z): Danach richtet jeder Zugang sein Schild aus. `look`: was das Welt-Paket hinter dem Tor
 * beiträgt (Eis-Welt: Tür, Eiszapfen), solange es lädt nichts. `all`: alle Flächen, auch die von der Kamera weg
 * (Zugang vor der Torplatte, solange die Kamera zur Front dreht)
 */
export function gate(
  p: Parts,
  theme: GateTheme,
  open = 0,
  outline = false,
  lit = 0,
  cam: readonly [number, number] = [0, 1],
  look?: GateLook,
  all = false,
): Wing[] {
  return BUILD[theme](p, { open, outline, lit, cam, look, all });
}

/** Ob ein Zugang bewegte Teile hat (dann zeichnet `motion` sie je Takt) */
export const moves = (theme: GateTheme) => theme in MOTION;

/** Bewegte Teile eines Zugangs im Takt `beat` in `p` (gleiche Bedeutung von `open`, `cam` und `all` wie bei `gate`) */
export function motion(
  p: Parts,
  theme: GateTheme,
  beat: number,
  open = 0,
  cam: readonly [number, number] = [0, 1],
  all = false,
) {
  MOTION[theme]?.(p, { open, outline: false, lit: 0, cam, all }, beat);
}
