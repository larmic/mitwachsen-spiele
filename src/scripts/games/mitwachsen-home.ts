// Zuhause je Gegend – rein und ohne DOM: Bett, Wiese, Tröge und Unterstand jeder Gegend, an ihr Bett gelegt.
// Die Lagen relativ zum Bett stehen in HOMES (src/data/games/mitwachsen-homes.ts); wo das Bett steht, weiß die Welt.
// Spezifikation: docs/specs/mitwachsen.md (Begriffe „Gegend“ und „Zuhause“)

import {
  REGIONS,
  REGION_IDS,
  type GateId,
  type Point,
  type Rect,
  type Region,
  type RegionId,
} from '../../data/games/mitwachsen';
import { HOMES, type HomePlan } from '../../data/games/mitwachsen-homes';

/** Zuhause einer Gegend in Feldern: Bett, Plätze zum Aufwachen, Wiese, Tröge und Unterstand (`HOMES`, ans Bett gelegt) */
export type Homestead = Omit<HomePlan, 'wake' | 'food' | 'water' | 'shelter' | 'shelterStem' | 'lee'> & {
  realm: RegionId;
  bed: Point;
  wake: readonly Point[];
  food: Point;
  water: Point;
  shelter: Rect;
  shelterStem: Point;
  lee?: Point;
};

/** Was eine Welt über ihre Gegenden weiß (Teil von `World`) */
export type Realms = {
  /** Gegend, zu der ein Feld gehört (Lichtung oder eine Welt hinter einem Tor); die Landschaft draußen gehört zur Lichtung */
  realm(x: number, y: number): RegionId;
  /** Zuhause je Gegend: jede hat ihr eigenes Bett, ihre Wiese, Tröge und ihren Unterstand */
  readonly homes: Readonly<Record<RegionId, Homestead>>;
  /**
   * Gegenden hinter einem Tor, hinter deren Gang die Welt etwas gebaut hat (ihre Welt aus dem Paket oder eine Klippe):
   * Nur dort gibt es eine Weltgrenze (mitwachsen-border.ts)
   */
  readonly worlds: readonly RegionId[];
};

/** Zuhause einer Gegend an ihr Bett legen: alle Lagen aus `HOMES` sind relativ zum Bett */
export function placeHome(realm: RegionId, bed: Point): Homestead {
  const plan = HOMES[realm];
  const at = ([x, y]: Point): Point => [bed[0] + x, bed[1] + y];
  const { x0, y0, x1, y1 } = plan.shelter;
  return {
    ...plan,
    realm,
    bed,
    wake: plan.wake.map(at),
    food: at(plan.food),
    water: at(plan.water),
    shelter: { x0: bed[0] + x0, y0: bed[1] + y0, x1: bed[0] + x1, y1: bed[1] + y1 },
    shelterStem: at(plan.shelterStem),
    ...(plan.lee && { lee: at(plan.lee) }),
  };
}

/** Zuhause der Lichtung: Ihr Bett steht in ihrer Mitte */
export const LICHTUNG_HOME = placeHome('lichtung', [0, 0]);

/**
 * Bett und Plätze zum Aufwachen je Gegend, die ein Zuhause hat: die Lichtung und jede Welt aus einem Paket (`inner`: je
 * Gegend hinter einem Tor ihr Bett und ihre Felder; ohne Felder keine Welt). Für Pakete, die in die Welten etwas legen
 * (`WorldPack.lay`)
 */
export const bedsOf = (inner: ReadonlyMap<RegionId, { bed: Point; realm: ReadonlySet<string> }>) =>
  new Map<RegionId, { bed: Point; wake: readonly Point[] }>([
    ['lichtung', LICHTUNG_HOME],
    ...[...inner].flatMap(([id, b]) => (b.realm.size ? [[id, placeHome(id, b.bed)] as const] : [])),
  ]);

/**
 * Gegenden einer Welt: die Lichtung (dazu die Landschaft draußen) und je Tor die Gegend dahinter (`inner`: Felder als
 * "x,y" und Bett, wie sie die Welt gebaut hat; bei der Eis-Welt Gletscherkessel und Gang ab seiner Mitte,
 * worlds/eis/mitwachsen-kessel.ts). Eine Gegend, die fehlt, hat ihr Bett vorerst am Bett der Lichtung.
 */
export function realmsOf(
  inner: ReadonlyMap<RegionId, { bed: Point; realm: ReadonlySet<string>; built?: boolean }>,
): Realms {
  const homes = { lichtung: LICHTUNG_HOME } as Record<RegionId, Homestead>;
  for (const id of REGION_IDS)
    if (id !== 'lichtung') homes[id] = placeHome(id, inner.get(id)?.bed ?? LICHTUNG_HOME.bed);
  const fields = [...inner].filter(([, r]) => r.realm.size); // nur Gegenden mit Feldern fragen
  return {
    realm: (x, y) => {
      const k = `${x},${y}`;
      for (const [id, r] of fields) if (r.realm.has(k)) return id;
      return 'lichtung';
    },
    homes,
    worlds: [...inner].filter(([, r]) => r.built ?? true).map(([id]) => id),
  };
}

/** Zuhause der Gegend, in der ein Feld liegt (Bett, Wiese, Unterstand dort, wo die Figur gerade ist) */
export const homeAt = (world: Realms, x: number, y: number): Homestead => world.homes[world.realm(x, y)];

/** So weit ragt der Hut des Riesenpilzes über seinen Unterstand (Felder; bis Issue 38 waren es 0,6 und 0,8) */
export const PILZ_OVER = 0.2;
/** So weit über die Wiese hinaus wird das Dach des Unterstands wieder dicht (Felder) */
export const ROOF_FADE = 2;
/**
 * So viel vom Dach bleibt, wenn es offen ist: in 3D jeder zweite Bildpunkt im Schachbrett (beim Ein- und Ausblenden drei
 * von vier), in 2D diese Deckkraft
 */
export const ROOF_LEFT = 0.5;
/** Offenes Dach: Mitte des Unterstands (Felder, Mitte bei +0,5), Radius um ihn und wie weit es offen ist (0 dicht … 1) */
export type OpenRoof = { x: number; y: number; r: number; open: number };
/**
 * Das Dach des Unterstands wird durchscheinend, solange die Figur zu Hause ist (Issue 38, Review vom 25.11.2026,
 * Punkt 1: Unter dem Dach sah man die Tiere nicht): ganz offen bis zum Rand der Wiese ihrer Gegend (`meadow` Felder vom
 * Bett), darüber hinaus in `ROOF_FADE` Feldern wieder dicht. Gilt für Riesenpilz, Iglu und das Dach am Höhlenbett; nur
 * Bild, keine Regel ändert sich
 */
export function openRoof(world: Realms, px: number, py: number): OpenRoof {
  const home = homeAt(world, px, py);
  const far = Math.hypot(px - home.bed[0], py - home.bed[1]);
  const { x0, y0, x1, y1 } = home.shelter;
  return {
    x: (x0 + x1 + 1) / 2,
    y: (y0 + y1 + 1) / 2,
    r: Math.hypot(x1 - x0 + 1, y1 - y0 + 1) / 2 + 1.5,
    open: Math.min(1, Math.max(0, (home.meadow + ROOF_FADE - far) / ROOF_FADE)),
  };
}

/**
 * Gegend, in deren Bett die Figur aufwacht: die der gespeicherten Position. Fehlt sie, ist sie kaputt oder liegt sie
 * hinter einem Tor, das zu ist, ist es die Lichtung.
 */
export function startRealm(
  world: Realms,
  open: readonly GateId[],
  position?: readonly [number, number],
  regions: readonly [Region, ...Region[]] = REGIONS, // für Tests mit eigenen Gegenden
): RegionId {
  const lichtung = regions[0].id;
  if (!position || !position.every(Number.isInteger)) return lichtung;
  const realm = world.realm(position[0], position[1]);
  const behind = regions.find((r) => r.id === realm)?.behind;
  return behind && !open.includes(behind) ? lichtung : realm;
}

/** Ergebnis je Welt und Gegend nur einmal berechnen (Plätze auf der Wiese, unter dem Unterstand) */
export function perRealm<W extends object, T>(f: (world: W, realm: RegionId) => T): (world: W, realm: RegionId) => T {
  const cache = new WeakMap<W, Map<RegionId, T>>();
  return (world, realm) => {
    let byRealm = cache.get(world);
    if (!byRealm) cache.set(world, (byRealm = new Map<RegionId, T>()));
    let out = byRealm.get(realm);
    if (out === undefined) byRealm.set(realm, (out = f(world, realm)));
    return out;
  };
}
