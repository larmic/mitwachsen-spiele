/**
 * Nie dunkler als die Dämmerung: Eine Gegend mit `Region.night` (die Grotte) wird nachts höchstens so dunkel wie die
 * Lichtung in der Dämmerung (Tageslicht 0,4). Rein, für die Szene (larmic-mitwachsen.ts) und die 3D-Ansicht.
 */
import { REGIONS, type RegionId } from '../../data/games/mitwachsen';

/** Tageslicht der Lichtung in der Dämmerung: so dunkel wird es in einer Gegend mit `Region.night` höchstens */
export const DUSK_DAY = 0.4;

/** Nacht der Dämmerung: bei ihr ist das Tageslicht `DUSK_DAY` (0,8) */
export const DUSK_NIGHT = (1 - DUSK_DAY) / 0.75;

/**
 * Himmel der Lichtung in der Dämmerung als Farbe: Himmel `#9fd6f0` zu 80 % zum Nachthimmel `#141a3a` gemischt (in
 * sRGB). Dunkler als das werden Höhlenhimmel und Nebel-Maske der Grotte nachts nie (`nightMix`, Test)
 */
export const DUSK_SKY = '#30405e';

/** höchste Dunkelheit der Nacht in einer Gegend (1: ganz Nacht) */
const capOf = (realm: RegionId) => REGIONS.find((r) => r.id === realm)?.night ?? 1;

/** Nacht in der Szene: in der Grotte gedeckelt (`Region.night`), sonst wie sie ist */
export function nightIn(realm: RegionId, night: number): number {
  return Math.min(night, capOf(realm));
}

/** Tageslicht der 3D-Ansicht zu einer Nacht (1 Tag … 0,25 tiefe Nacht) */
export const dayOf = (night: number) => 1 - night * 0.75;

/**
 * Stärke der Sonne (ohne Wolken) aus Nacht und Stimmung (`bright` der Richtung, schon gewichtet): in einer Gegend mit
 * `Region.night` nie unter `DUSK_DAY`, auch wenn die Stimmung dämpft; sonst Tageslicht mal Stimmung
 */
export function sunLevel(realm: RegionId, night: number, bright: number): number {
  const lit = dayOf(night) * bright;
  return capOf(realm) < 1 ? Math.max(DUSK_DAY, lit) : lit;
}

/** Farbe als drei Anteile (im selben Farbraum wie die Rechnung, in 3D linear) */
export type Rgb = readonly [number, number, number];

const lum = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Wie weit eine Farbe zum Nachthimmel gemischt wird (0 … `night`): in einer Gegend mit `Region.night` nur so weit, dass
 * sie nicht dunkler wird als `dusk` (der Himmel der Lichtung in der Dämmerung); sonst `night`. Ist die Farbe selbst
 * schon dunkler, wird sie gar nicht gemischt
 */
export function nightMix(realm: RegionId, night: number, color: Rgb, nightSky: Rgb, dusk: Rgb): number {
  if (capOf(realm) >= 1) return night;
  const [c, n, d] = [lum(color), lum(nightSky), lum(dusk)];
  if (c <= d || c <= n) return 0;
  return Math.max(0, Math.min(night, (c - d) / (c - n)));
}

/** So viel Licht bleibt im Tunnel (Tunnelportal, Einschnitt, Gang), wenn der Zug hindurchfährt */
export const TUNNEL_LIGHT = 0.7;

/**
 * Nacht der Szene, wenn das Licht auf `dim` gedimmt ist (der Zug im Tunnel, `View2D.dim`): Tageslicht mal `dim`, aber
 * nie dunkler als die Dämmerung (`DUSK_DAY`); ist es schon dunkler (Abend, Nacht), dimmt nichts weiter. `dim` 1: wie sie ist
 */
export function tunnelNight(night: number, dim: number): number {
  const day = dayOf(night);
  if (dim >= 1 || day <= DUSK_DAY) return night;
  return (1 - Math.max(DUSK_DAY, day * dim)) / 0.75;
}
