// Regeln der Kristallgrotte – rein, im Welt-Paket der Höhlenwelt, ohne Spielstand. Säulen-Glockenspiel: Läuft die
// Figur gegen eine der fünf Kristallsäulen in der Kristallhalle (`'column'`, fest), klingt ihr Ton (Ereignis `column`
// mit `note` 0 = C5 … 4 = A5, Pentatonik: eine falsche Melodie gibt es nicht), und sie bleibt stehen, ohne anzustoßen.
// Das Ereignis nennt den nächsten Sitzplatz im Kristallbogen, an dem gerade eine Fledermaus hängt (`perch`): Sie ist
// die verschlafene Fledermaus, die nach je vier Tönen eine Runde dreht; hängt keine mehr, fliegt keine.
// Stiller See: Betritt sie das Ende des Holzstegs (`'jetty'` mit `note` 1, an der Kristallinsel), taucht der
// Grottenolm daneben auf (Ereignis `olm`), und sie läuft weiter. Was man sieht und hört (Leuchten, Echo, die
// Fledermaus nach je vier Tönen, „blubb“), steht in mitwachsen-chime-look.ts und mitwachsen-olm-look.ts. Die Regel
// bekommt `step` als `pack.rules` (index.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Schmuck der Grotte“)

import type { Point } from '../../../../data/games/mitwachsen';
import type { Cell } from '../../mitwachsen-cell';
import type { Ruled, WorldRules } from '../../mitwachsen-pack-types';
import { roostAt } from '../../mitwachsen-roost';

/** So weit (Felder, ringsum) von der Säule sucht das Glockenspiel eine hängende Fledermaus */
export const PERCH_REACH = 12;

/** Sitzplatz nahe (x, y), an dem gerade ein Tier hängt (das nächste; bei Gleichstand das erste); keiner: undefined */
export function sleeperNear(s: Pick<Ruled, 'animals'>, cell: (x: number, y: number) => Cell, x: number, y: number) {
  let best: Point | undefined,
    bestD = Infinity;
  for (const a of s.animals) {
    const d = Math.max(Math.abs(a.x - x), Math.abs(a.y - y));
    if (d > PERCH_REACH || d >= bestD || roostAt(a, cell(a.x, a.y)) === undefined) continue;
    [best, bestD] = [[a.x, a.y], d];
  }
  return best;
}

const bump: WorldRules['bump'] = (s, c, x, y, events, { walks, cell }) => {
  if (c.region !== 'hoehle') return false;
  if (c.deco === 'column' && c.note !== undefined) {
    const perch = sleeperNear(s, cell, x, y);
    events.push({ type: 'column', x, y, note: c.note, ...(perch && { perch }) });
    return true; // sie bleibt stehen, kein „boing“
  }
  if (c.deco === 'jetty' && c.note === 1 && walks) events.push({ type: 'olm', x, y });
  return false;
};

export const rules: WorldRules = { bump };
