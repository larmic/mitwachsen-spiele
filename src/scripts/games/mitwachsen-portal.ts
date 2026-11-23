// Portal-Plattformen von Mitwachsen – rein, ohne DOM, damit testbar: wo sie stehen, wann sie erwachen, wann gereist
// wird. Je Tor eine flache Plattform aus 3 × 3 Feldern neben dem Tor und ihr Gegenstück im Kreis um das Bett; im
// Gletscherkessel eine gleich hinter der Gangmündung und ihr Gegenstück im Kreis um das Schneebett (Eis-Portal).
// Die Welt (mitwachsen-world.ts) baut sie ein, die Regeln (mitwachsen-state.ts) fragen hier nach.
// Spezifikation: docs/specs/mitwachsen.md

import { THEME_COLORS, type Point } from '../../data/games/mitwachsen';
import { CENTRE_TOP, PORTALS, SOCKET_TOP, type PortalId } from '../../data/games/mitwachsen-portals';

export type { PortalId };

/**
 * Ein Portal: Mittelfelder der Plattform am Tor und ihres Gegenstücks am Bett (dort kommt man an). Mit `bed` (das
 * Eis-Portal) erwacht es nicht durch Nähe, sondern sobald die Figur an diesem Bett ankommt. Mit `later` (das Portal am
 * stillen See der Grotte) erwacht es noch gar nicht: Es wartet auf eine Regel, die erst später kommt (der Maulwurf).
 */
export type Portal = { gate: Point; home: Point; bed?: Point; later?: true };
/** Teil einer Plattform: Mittelfeld, Seitenmitte oder Eckfeld (beide begehbarer Rand; in den Ecken steht Zierde) */
export type PlatformPart = 'centre' | 'edge' | 'corner';
/** Was auf einem Feld einer Plattform liegt */
export type PlatformSpot = { id: PortalId; side: 'gate' | 'home'; at: PlatformPart };

/** Eine Plattform reicht so weit um ihr Mittelfeld (3 × 3 Felder) */
export const PLATFORM_HALF = 1;
/** So nah (in Feldern bis zur Plattform, auch schräg) muss die Figur kommen, damit eine Plattform erwacht */
export const PORTAL_WAKE = 2;
/** So nah (in Feldern, auch schräg) ist die Figur am Bett angekommen: Dort erwacht ein Portal mit `bed` */
export const BED_ARRIVAL = 2;
/** Plattformen im Kreis berühren sich nie: Ihre Mittelfelder liegen mindestens so weit auseinander (in jeder Richtung) */
export const RING_GAP = 2 * PLATFORM_HALF + 2;

const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Die neun Felder einer Plattform um ihr Mittelfeld, mit ihrem Teil */
export function platformCells([cx, cy]: Point): { x: number; y: number; at: PlatformPart }[] {
  const out: { x: number; y: number; at: PlatformPart }[] = [];
  for (let dy = -PLATFORM_HALF; dy <= PLATFORM_HALF; dy++)
    for (let dx = -PLATFORM_HALF; dx <= PLATFORM_HALF; dx++) {
      const at = dx === 0 && dy === 0 ? 'centre' : dx === 0 || dy === 0 ? 'edge' : 'corner';
      out.push({ x: cx + dx, y: cy + dy, at });
    }
  return out;
}

/** Farbe eines Portals nach seinem Thema (Funken beim Erwachen und Reisen, Karte) */
export const portalColor = (id: PortalId): string => THEME_COLORS[PORTALS[id].theme].portal;

/** So viel höher steht man auf einer Plattform (nur fürs Bild; die Regeln rechnen in ganzen Ebenen) */
export const platformLift = (c: { portal?: { at: PlatformPart } }): number =>
  !c.portal ? 0 : c.portal.at === 'centre' ? CENTRE_TOP : SOCKET_TOP;

/**
 * Plätze im Kreis mit Radius `r` um `centre`, je Winkel einer, auf ganze Felder gerundet. Gerundet wird zum nächsten
 * Feld; berührte die Plattform dort eine schon gesetzte (Winkel im Uhrzeigersinn), nimmt sie die nächste andere Rundung.
 */
export function ringSpots(angles: readonly number[], r: number, centre: Point): Point[] {
  const out: Point[] = angles.map(() => centre);
  const placed: Point[] = [];
  const turn = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const order = angles.map((a, i) => ({ a: turn(a), i })).sort((p, q) => p.a - q.a);
  for (const { a, i } of order) {
    const [ex, ey] = [Math.cos(a) * r, Math.sin(a) * r];
    const near: Point[] = [];
    for (const x of [Math.floor(ex), Math.ceil(ex)]) for (const y of [Math.floor(ey), Math.ceil(ey)]) near.push([x, y]);
    near.sort((p, q) => Math.hypot(p[0] - ex, p[1] - ey) - Math.hypot(q[0] - ex, q[1] - ey));
    const free = (c: Point) => placed.every((p) => cheb(c[0], c[1], p[0], p[1]) >= RING_GAP);
    const spot = near.find((c) => free(c) && Math.hypot(c[0], c[1]) >= r - 0.6) ?? near[0]!;
    placed.push(spot);
    out[i] = [centre[0] + spot[0], centre[1] + spot[1]];
  }
  return out;
}

/** Die Felder und ihre vier Nachbarn, als Schlüssel "x,y" */
export const withNeighbours = (points: readonly Point[]): string[] =>
  points.flatMap(([x, y]) => [`${x},${y}`, `${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]);

/** Felder aller Plattformen und ihre Nachbarn: Dort bleibt kein Tier stehen, die Zugänge bleiben frei */
export const platformArea = (portals: ReadonlyMap<PortalId, Portal>): string[] =>
  withNeighbours(
    [...portals.values()].flatMap((p) =>
      [p.gate, p.home].flatMap((c) => platformCells(c).map((f): Point => [f.x, f.y])),
    ),
  );

/**
 * Plattformen am Tor, die jetzt erwachen: noch schlafend, die Figur bei (x, y) höchstens PORTAL_WAKE Felder davon
 * entfernt (auch schräg), und ihr Mittelfeld schon erkundet (im Nebel leuchtet nichts auf). Die Gegenstücke am Bett
 * wecken nichts: Sie erwachen mit ihrer Plattform am Tor und verraten vorher nicht, wohin sie führen. Ein Portal mit
 * `bed` erwacht stattdessen, sobald die Figur höchstens BED_ARRIVAL Felder vor diesem Bett steht (und es erkundet ist),
 * eines mit `later` noch nie.
 */
export function platformsToWake(
  portals: ReadonlyMap<PortalId, Portal>,
  awake: readonly PortalId[],
  x: number,
  y: number,
  explored: (x: number, y: number) => boolean,
): PortalId[] {
  const near = ({ gate, bed }: Portal) =>
    bed ? cheb(x, y, bed[0], bed[1]) <= BED_ARRIVAL : cheb(x, y, gate[0], gate[1]) <= PLATFORM_HALF + PORTAL_WAKE;
  return [...portals]
    .filter(([id, p]) => !awake.includes(id) && !p.later && near(p))
    .filter(([, { gate, bed = gate }]) => explored(bed[0], bed[1]))
    .map(([id]) => id);
}

/**
 * Die Figur hat (x, y) betreten. War sie auf einem anderen Mittelfeld angekommen (`arrived`), ist dessen Plattform
 * wieder bereit (`ready`). Ist (x, y) das Mittelfeld einer wachen Plattform und nicht das, auf dem sie gerade
 * angekommen ist, reist sie zum Mittelfeld des Gegenstücks (`travel`). Der Rand löst nichts aus. Eine Sperrzeit gibt
 * es nicht: Runter und wieder rauf genügt.
 */
export function stepOn(
  portals: ReadonlyMap<PortalId, Portal>,
  spotAt: (x: number, y: number) => PlatformSpot | undefined,
  awake: readonly PortalId[],
  arrived: Point | null,
  x: number,
  y: number,
): { arrived: Point | null; ready: PortalId | null; travel: { id: PortalId; to: 'gate' | 'home'; at: Point } | null } {
  const left = arrived && (arrived[0] !== x || arrived[1] !== y) ? arrived : null;
  const still = left ? null : arrived;
  const ready = left ? (spotAt(left[0], left[1])?.id ?? null) : null;
  const here = spotAt(x, y);
  const pair = here && portals.get(here.id);
  if (!here || !pair || here.at !== 'centre' || still || !awake.includes(here.id))
    return { arrived: still, ready, travel: null };
  const to = here.side === 'gate' ? 'home' : 'gate';
  const at = to === 'home' ? pair.home : pair.gate;
  return { arrived: at, ready, travel: { id: here.id, to, at } };
}
