// Haken der 2D-Ansicht für die Welten hinter den Toren: Was nur eine Welt zeigt (Eis-Welt: Iglu, Eisschale, Eistrog,
// Fischkiste, Rutschspur, Wetter, Bild der Weltgrenze), zeichnet ihr Welt-Paket (worlds/<welt>/view-2d.ts, mit dem Paket
// nachgeladen). Der Kern kennt nur die Haken: je Deko-Art eine Zeichnung (`drawDeco`), solange das Paket lädt ein
// einfacher Block in Kartenfarbe. Gleich für 2D und die Ebene über 3D (dort nur Wetter und Leiste).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { box, type Projection } from '../../lib/games/front';
import type { RegionId } from '../../data/games/mitwachsen';
import type { Deco } from './mitwachsen-cell';
import type { PackEvent } from './mitwachsen-pack-types';
import type { Guest } from './mitwachsen-guest-look';
import { mapColor } from './mitwachsen-map';
import type { SkyScene } from './mitwachsen-sky';
import type { State } from './mitwachsen-state';
import type { Cell, World } from './mitwachsen-world';
import type { Scored, Sfx } from './sfx';
import type { Hint } from './mitwachsen-guide';
import type { PlateLook } from './mitwachsen-plate';

/**
 * Quader: x (rechts), y (nach vorn), z (Höhe), Breite, Tiefe, Höhe, Farbe der Seiten und oben, Art in 3D: `see` wird
 * vor der Figur durchsichtig (wie Laub und der Hut des Riesenpilzes), `sway` wiegt sich im Wind (wie die Grasbüschel),
 * `glow` leuchtet aus sich selbst, so hell, wie das Paket sagt (`View3D.glow`; Eiskristalle beim Polarlicht)
 */
export type Box = readonly [number, number, number, number, number, number, string, string, ('see' | 'sway' | 'glow')?];

/** Einen Quader von vorn zeichnen (nichts, wenn keiner da ist) */
export function drawBox(ctx: CanvasRenderingContext2D, P: Projection, b: Box | null | undefined) {
  if (b) box(ctx, P, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]);
}

/**
 * Was eine Zeichnung vom Bild weiß: Zeit, reduzierte Bewegung, geleerte Büsche und Fischkisten ("x,y"), Zustand der
 * Welt-Pakete (`State.packs`, Eis-Welt: wie weit jeder Schneemann gewachsen ist)
 */
export type DecoAt = {
  now: number;
  reduced: boolean;
  picked: Readonly<Record<string, number>>;
  packs: Readonly<Record<string, unknown>>;
};

/** Zeichnung einer Deko-Art: Quader, die in der Reihe ihrer Vorderkante drankommen; null: wie sonst zeichnen */
export type DrawDeco = (world: World, c: Cell, x: number, y: number, at: DecoAt) => readonly Box[] | null;

/** Was sich die Leiste über das Umklappen merkt: welche Gegend sie zeigt, welche davor und seit wann */
export type Turn = { shown?: RegionId; from?: RegionId; at?: number };

/**
 * Wetter und Bild der Weltgrenze einer Welt: was Ansicht, Leiste und Töne beim Öffnen ihres Tors vom Paket brauchen.
 * Der Kern kennt nur diese Form, jede Welt füllt sie in ihrem Paket (Eis-Welt: worlds/eis/view-2d.ts).
 */
export type Sky = {
  /** Wetter in der Luft (die Ansicht ruft es, sobald die Welt Plätze hat) */
  weather(ctx: CanvasRenderingContext2D, world: World, sc: SkyScene, P: Projection): void;
  /** Licht am Nachthimmel (Eis-Welt: Polarlicht über dem Schneebett, dazu leuchten in 2D die Eiskristalle) */
  aurora(ctx: CanvasRenderingContext2D, sc: SkyScene, P: Projection): void;
  /** Pfeil zum Tor über einem wartenden Tier (bei hx, hy) */
  waitArrow(
    ctx: CanvasRenderingContext2D,
    world: World,
    P: Projection,
    a: { x: number; y: number; realm: RegionId },
    b: { x: number; y: number; z: number },
    head: readonly [number, number],
    px: number,
  ): void;
  /** Zeichen der Gegend in der Leiste, unten mittig bei (cx, bottom), `size` breit */
  realmSign(ctx: CanvasRenderingContext2D, realm: RegionId, cx: number, bottom: number, size: number): void;
  /** Umklappen der Leiste beim Wechsel der Gegend: gezeigte Gegend und wie weit die Leiste offen ist (0 … 1) */
  turnAlbum(t: Turn, realm: RegionId, now: number, reduced: boolean): [RegionId, number];
  /** Gast am Tor der Welt (der führende Pinguin), sonst null */
  guestAt(world: World, state: State): Guest | null;
  /** Töne beim Öffnen des Tors */
  gateScore(): Scored[];
};

/**
 * Spuren am Boden einer Welt (Eis-Welt: Fußspuren im Schnee), nur Bild: `step` je Bild (in beiden Ansichten), `draw`
 * in 2D je Reihe nach ihrem Boden
 */
export type Trail = {
  step(world: World, state: State, sc: SkyScene): void;
  draw(ctx: CanvasRenderingContext2D, world: World, P: Projection, y: number): void;
};

/** Zeichenteile einer Welt aus ihrem Paket */
export type View2D = {
  /** je Deko-Art, die nur diese Welt hat, ihre Zeichnung */
  decos: Partial<Record<Deco, DrawDeco>>;
  /** flach auf dem Boden eines Felds (Rutschspur, glänzt bei offenem Tor der Welt), sonst null */
  ground(c: Cell, x: number, y: number, open: boolean): Box | null;
  sky: Sky;
  trail?: Trail;
  /** Töne zu Ereignissen der Regeln dieser Welt (Eis-Welt: Ploppen, wenn ein Schneemann wächst) */
  score?(e: PackEvent): Scored[];
  /** Klang der Torplatte vor dem Tor dieser Welt statt des Klonks (Eis-Welt: Klirren; `plateTones` in sfx.ts) */
  clink?: readonly Scored[];
  /** Schmuck der Torplatte vor dem Tor dieser Welt (Eis-Welt: Scholle mit Schneeflocke; wie `GateLook.plate` in 3D) */
  plate?: PlateLook;
  /**
   * „Noch nicht“ am Tor dieser Welt, je Bild gefragt (Eis-Welt: worlds/eis/mitwachsen-plate-hint.ts): Steht die Figur
   * auf seiner Torplatte und fehlt noch etwas, zeigt es das in Bild und Ton (`now` ms, reduzierte Bewegung) und lichtet
   * den Nebel im Gang bis zur Mündung (`lift(true)`); liefert, was das Bild zeigt
   */
  hint?(
    state: State,
    world: World,
    now: number,
    reduced: boolean,
    sfx: Pick<Sfx, 'score'>,
    lift: (peek: true) => void,
  ): Hint;
};

/** Deko-Arten, die nur ein Welt-Paket zeichnet: Ohne seine Zeichnung steht dort ein einfacher Block */
const PACKED: ReadonlySet<Deco> = new Set<Deco>(['igloo', 'icebowl', 'fishcrate', 'snowheap']);

/**
 * Quader eines Dings, das ein Welt-Paket zeichnet (`view`, null solange es lädt): seine Zeichnung je Deko-Art, ohne sie
 * ein einfacher Block in der Farbe der Karte. null: kein Ding eines Pakets, die Ansicht zeichnet wie sonst. Gleich für
 * 2D und 3D (dort mit den Zeichnungen aus dem 3D-Teil des Pakets, `View3D.decos`).
 */
export function drawDeco(
  view: Pick<View2D, 'decos'> | null,
  world: World,
  c: Cell,
  x: number,
  y: number,
  at: DecoAt,
): readonly Box[] | null {
  if (!c.deco) return null;
  const draw = view?.decos[c.deco];
  if (draw) return draw(world, c, x, y, at);
  if (!PACKED.has(c.deco)) return null;
  const color = mapColor(c);
  return [[x + 0.15, y + 0.15, c.h, 0.7, 0.7, 0.5, color, color]];
}
