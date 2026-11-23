// Der Schlitten der Eis-Welt – rein, ohne DOM: wann er erscheint (`ready`) und seine Regeln (`sled`, `WorldRules.ride`
// aus dem Welt-Paket). Sind alle Eis-Tiere zu Hause (Leiste der Eis-Welt voll) und steht die Figur wach am Schneebett,
// trabt der Schlitten mit dem Schlittenrentier gut 2 s später aus den Tannen herbei. Strecke und Halte:
// mitwachsen-sled-route.ts; Fahrregeln (allgemein, für jedes Fahrzeug): mitwachsen-ride.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import { REGIONS } from '../../../../data/games/mitwachsen';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import { full } from '../../mitwachsen-guide';
import type { Rider } from '../../mitwachsen-rider';
import type { World } from '../../mitwachsen-world';
import { CHEER, rideRules, type Fan } from './mitwachsen-ride';
import { stageOf } from './mitwachsen-ride-save';
import { sledRoute } from './mitwachsen-sled-route';
import { SNOWMAN, stageAt } from './mitwachsen-snowman';

export const SLED = RIDES[0];
const ICE = REGIONS.find((r) => r.behind === SLED.gate)!; // die Eis-Welt

/**
 * Soll der Schlitten erscheinen? Noch nicht da, Figur wach, Eistor offen, Leiste der Eis-Welt voll (`full`, der Pinguin
 * zählt mit) und die Figur in der Eis-Welt höchstens so weit vom Schneebett, wie die Schneewiese reicht
 */
export function ready(s: Rider, world: World): boolean {
  if (s.sleeping || !s.openGates.includes(SLED.gate) || stageOf(s.packs, SLED.id) || !full(s, ICE)) return false;
  const { x, y } = s.player;
  const home = world.homes[ICE.id];
  return world.realm(x, y) === ICE.id && Math.max(Math.abs(x - home.bed[0]), Math.abs(y - home.bed[1])) <= home.meadow;
}

/** Fertige Schneemänner in der Nähe der Figur winken auf der Festfahrt mit */
export function snowmen(s: Rider, world: World): Fan[] {
  const out: Fan[] = [];
  for (let y = s.player.y - CHEER; y <= s.player.y + CHEER; y++)
    for (let x = s.player.x - CHEER; x <= s.player.x + CHEER; x++)
      if (world.cell(x, y).deco === 'snowheap' && stageAt(s.packs, x, y) === SNOWMAN)
        out.push({ who: `schneemann:${x},${y}`, x, y });
  return out;
}

/** Regeln des Schlittens (für `pack.rules.ride`) */
export const sled = rideRules(SLED, sledRoute, ready, snowmen);
