// Leiste unten: die Tiere der Gegend, in der die Figur steht. Ist das Eistor offen (es gibt dann zwei Gegenden), steht
// links ihr Zeichen, und beim Wechsel an der Gangmitte klappt die Leiste um; beides kommt mit dem Bild der Weltgrenze
// (worlds/eis/mitwachsen-border-view.ts) aus dem Welt-Paket der Eis-Welt. Führt der verlaufene Pinguin die Figur zum Eistor,
// hat er auf der Lichtung einen Gast-Platz mit Schneeflocke. Gleich für 2D und die Ebene über 3D.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“, Leiste unten)

import { TILE_W, drawModel, projection } from '../../lib/games/front';
import { GAME_COLORS, REGIONS, SPECIES, speciesOf, type RegionId, type SpeciesId } from '../../data/games/mitwachsen';
import { ASK, HEART, sprite } from './mitwachsen-glyphs';
import { guideGate, leader } from './mitwachsen-guide';
import type { State } from './mitwachsen-state';
import type { Sky, Turn } from './mitwachsen-view';

/** Was die Leiste vom Bild wissen muss */
export type Bar = { width: number; height: number; zoom: number; now: number; reduced: boolean; bottomInset: number };
/** Bild der Weltgrenze (aus dem Welt-Paket nachgeladen): Zeichen der Gegend und Umklappen */
export type Signs = Pick<Sky, 'turnAlbum' | 'realmSign'>;
type Slot = { species: SpeciesId; met: boolean; home: boolean; follows: boolean; guest?: boolean };

export class Album {
  private turn: Turn = {}; // Umklappen beim Wechsel der Gegend

  /**
   * Ein Platz je Art der Gegend `realm` (eine Art gilt als gefunden, sobald eines ihrer Tiere gefunden ist), auf der
   * Lichtung dahinter Tiere der Landschaft, die im Garten wohnen. Umriss mit Fragezeichen = noch verloren, in Farbe =
   * gefunden, grüner Grund = zu Hause im Garten, Herz = folgt gerade. Ist das Eistor offen (`signs` geladen), steht
   * links das Zeichen der Gegend, und wechselt sie, klappt die Leiste um. Ein Gast (der führende Pinguin) hat ganz
   * rechts einen eigenen Platz mit dem Zeichen seiner Gegend, der Schneeflocke.
   */
  draw(ctx: CanvasRenderingContext2D, state: State, sc: Bar, realm: RegionId, signs: Signs | null) {
    // Zwei Gegenden gibt es erst, wenn das Eistor offen ist: erst dann steht das Zeichen der Gegend davor
    const signed = !!signs && REGIONS.some((r) => r.behind && state.openGates.includes(r.behind));
    const [shown, fold] = signed ? signs.turnAlbum(this.turn, realm, sc.now, sc.reduced) : [realm, 1];
    if (fold <= 0) return;
    const groups = slots(state, shown);
    const count = groups.reduce((n, g) => n + g.length, 0) + (signed ? 1 : 0);
    const gap = 6,
      groupGap = 18;
    const breaks = groups.length - (signed ? 0 : 1);
    const room = sc.width - 24 - (count - 1) * gap - breaks * (groupGap - gap);
    const size = Math.floor(Math.max(26, Math.min(52, 44 * sc.zoom, room / count)));
    const total = count * size + (count - 1) * gap + breaks * (groupGap - gap);
    let x = Math.round((sc.width - total) / 2);
    const y = Math.round(sc.height - size - 14 - sc.bottomInset);
    ctx.save();
    ctx.translate(0, y + size / 2);
    ctx.scale(1, fold); // beim Umklappen flach, sonst ganz offen
    ctx.translate(0, -y - size / 2);
    if (signed) {
      signs.realmSign(ctx, shown, x + size / 2, y + size * 0.82, size * 0.7);
      x += size + groupGap;
    }
    for (const group of groups) {
      for (const a of group) {
        slot(ctx, a, x, y, size);
        if (a.guest) signs?.realmSign(ctx, 'eis', x + size * 0.2, y + size * 0.36, size * 0.3);
        x += size + gap;
      }
      x += groupGap - gap;
    }
    ctx.restore();
  }
}

/** Je Gegend ein Platz pro Art (mehrere Tiere je Art: eines gefunden heißt die Art gefunden), dahinter die Landschaft */
function slots(state: State, realm: RegionId): Slot[][] {
  const of = (ids: readonly string[], region: string, species: string) =>
    ids.some((id) => id.startsWith(`${region}:`) && speciesOf(id) === species);
  const garden = state.garden.map((p) => p.id);
  const groups: Slot[][] = REGIONS.filter((r) => r.id === realm).map((r) =>
    r.animals.map(({ species }) => ({
      species,
      met: of(state.met, r.id, species) || of(garden, r.id, species),
      home: of(garden, r.id, species),
      follows: of(state.followers, r.id, species),
    })),
  );
  // Tiere der Landschaft gehören zur Lichtung
  const wild = realm === 'lichtung' ? state.garden.filter((p) => p.id.startsWith('wild:')).slice(0, 10) : [];
  if (wild.length)
    groups.push(
      wild.map((p) => ({ species: p.species, met: true, home: true, follows: state.followers.includes(p.id) })),
    );
  // Gast: der verlaufene Pinguin, solange er die Figur zum Eistor führt (er gehört in die Eis-Welt; nach dem Öffnen nicht)
  const guest = realm === 'lichtung' && guideGate(state) ? leader(state) : undefined;
  if (guest)
    groups.push([
      { species: guest.species, met: state.met.includes(guest.id), home: false, follows: false, guest: true },
    ]);
  return groups;
}

/** Ein Platz der Leiste: Grund, Pixel-Rahmen ohne Eckpixel wie auf der Seite, das Tier, Fragezeichen bzw. Herz */
function slot(ctx: CanvasRenderingContext2D, a: Slot, x: number, y: number, size: number) {
  ctx.fillStyle = a.home ? GAME_COLORS.slotHome : a.met ? GAME_COLORS.slotMet : GAME_COLORS.slotEmpty;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = GAME_COLORS.ink;
  ctx.fillRect(x, y - 3, size, 3);
  ctx.fillRect(x, y + size, size, 3);
  ctx.fillRect(x - 3, y, 3, size);
  ctx.fillRect(x + size, y, 3, size);
  const sp = SPECIES[a.species];
  const s = (size * 1.15) / (0.9 * TILE_W * sp.scale); // Tier füllt den Platz gut zu drei Vierteln
  const P = projection(0.5, 0.5, x + size / 2, y + size * 0.86, s);
  drawModel(ctx, P, sp.parts, 0.5, 0.5, 0, 'e', sp.scale, a.met ? undefined : GAME_COLORS.silhouette);
  if (!a.met) sprite(ctx, ASK, GAME_COLORS.lost, x + size - 7, y + 13, Math.max(1.5, size / 26));
  if (a.follows) sprite(ctx, HEART, GAME_COLORS.heart, x + size - 6, y + 12, Math.max(1.5, size / 22));
}
