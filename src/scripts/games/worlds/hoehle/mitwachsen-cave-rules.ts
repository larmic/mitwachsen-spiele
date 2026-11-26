// Regeln der Kristallgrotte – rein, im Welt-Paket der Höhlenwelt, ohne Spielstand. Säulen-Glockenspiel: Läuft die
// Figur gegen eine der fünf Kristallsäulen in der Kristallhalle (`'column'`, fest), klingt ihr Ton (Ereignis `column`
// mit `note` 0 = C5 … 4 = A5, Pentatonik: eine falsche Melodie gibt es nicht), und sie bleibt stehen, ohne anzustoßen.
// Das Ereignis nennt den nächsten Sitzplatz im Kristallbogen, an dem gerade eine Fledermaus hängt (`perch`): Sie ist
// die verschlafene Fledermaus, die nach je vier Tönen eine Runde dreht; hängt keine mehr, fliegt keine.
// Stiller See: Betritt sie das Ende des Holzstegs (`'jetty'` mit `note` 1, an der Kristallinsel), taucht der
// Grottenolm daneben auf (Ereignis `olm`), und sie läuft weiter. Läuft sie gegen das Netz einer Tupfspinne (`'web'`), klingt
// es wie eine Harfe (Ereignis `web`), und sie bleibt stehen, ohne anzustoßen (mitwachsen-spider.ts). Was man sieht und hört (Leuchten, Echo, die
// Fledermaus nach je vier Tönen, „blubb“), steht in mitwachsen-chime-look.ts und mitwachsen-olm-look.ts. Dazu nimmt die
// Figur die Kristall-Laterne von ihrem Sockel am Bett (`takeLantern`, mitwachsen-lantern.ts). Die Regel
// bekommt `step` als `pack.rules` (index.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Schmuck der Grotte“)

import type { Point } from '../../../../data/games/mitwachsen';
import { jettyEnd } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { Ruled, WorldRules } from '../../mitwachsen-pack-types';
import { roostAt } from '../../mitwachsen-roost';
import { takeLantern } from './mitwachsen-lantern';
import { bumpPlace } from './mitwachsen-cave-places';

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

const bump: WorldRules['bump'] = (s, c, x, y, events, { here, walks, cell }) => {
  if (c.region !== 'hoehle') return false;
  if (takeLantern(s, c, x, y, events)) return true; // Kristall-Laterne am Bett (mitwachsen-lantern.ts)
  if (c.deco === 'column' && c.note !== undefined) {
    const perch = sleeperNear(s, cell, x, y);
    events.push({ type: 'column', x, y, note: c.note, ...(perch && { perch }) });
    return true; // sie bleibt stehen, kein „boing“
  }
  if (c.deco === 'web') {
    events.push({ type: 'web', x, y });
    return true; // Netz der Tupfspinne: die Harfe klingt, sie bleibt stehen, kein „boing“; es hält sie nie fest
  }
  if (c.deco === 'jetty' && jettyEnd(c) && walks) events.push({ type: 'olm', x, y });
  return bumpPlace(s, c, x, y, events, { here, walks, cell }); // Leuchtpilz, Kristalltürmchen, Zahlen-Kristall, Echo-Wand
};

export const rules: WorldRules = { bump };
