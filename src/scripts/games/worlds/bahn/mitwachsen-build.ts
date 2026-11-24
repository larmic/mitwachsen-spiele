// Bau 1 – rein, ohne DOM: Läuft die Figur in den wachen Tok, solange noch nichts gebaut ist und er an seinem Platz am
// künftigen Bahnsteig steht (in einer Welt, in der Bahnhof Bär Platz hat; mitwachsen-tok.ts), baut er Bahnhof Bär und
// das Gleis bis vor das Höhlentor, etwa 8 s lang (`BUILD.ticks`): Seine Hacke klopft pink-pink-pink, Bahnhof Bär ploppt
// auf, eine Gleiswelle läuft bis zur Bucht durch das Tunnelportal, der Zug rollt aus dem Tunnel ein, „Ding-Dong“, die
// Tür geht mit „pff“ auf, und Tok, der inzwischen über den Bahnsteig an den hinteren Wagen gehüpft ist, steigt ein
// (`BUILD`, Bruchteile des Baus; Bild in mitwachsen-station-look.ts und mitwachsen-rail-look.ts, Töne in
// mitwachsen-tok-look.ts). Solange lässt jeder Pfeil die Figur nur hüpfen. Gleich zu Beginn steht der Ausbau auf 1
// (`packs.bahn.built`, steigt nur) und Toks Stufe auf `bereit` (Tok getroffen, der Zug steht da), gespeichert wird
// sofort; zum Augenblick `pop` wird die Welt mit Bahnhof und Gleis neu gebaut (`relay`, `World.relay`). Wie weit der
// Bau ist, steht nur im Zustand (`State.work`, nicht gespeichert): Wer mitten im Bau neu lädt, findet ihn fertig.
// Teil des Pakets der Bahn (Regeln von Tok, mitwachsen-tok.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 1)

import { BUILD } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { HeraldEvents as Events, Heralded } from '../../mitwachsen-herald';
import { dirTo } from '../../mitwachsen-free';
import { builtOf, withBuilt } from './mitwachsen-built';
import { tokOf, withTok } from '../../mitwachsen-ride-save';

/** Takt eines Augenblicks im Bau, der um `from` begann */
export const beatTick = (from: number, beat: number) => from + Math.round(beat * BUILD.ticks);

type Walker = Heralded['animals'][number];

/** Gibt es einen nächsten Bau, den Tok beginnt, wenn die Figur in ihn hineinläuft? Bau 1: noch nichts gebaut, er kam schon */
export const canBuild = (s: Pick<Heralded, 'packs' | 'work'>): boolean =>
  !s.work && builtOf(s.packs) === 0 && tokOf(s.packs) !== undefined;

/**
 * Bau 1 beginnt: Ausbau 1 und Stufe `bereit` (sofort gespeichert; die Welt wird erst zum Augenblick `pop` neu gebaut),
 * Tok schaut zur Figur und baut `BUILD.ticks` Takte lang
 */
export function startBuild(s: Heralded, t: Walker, events: Events) {
  s.packs = withBuilt(withTok(s.packs, { stage: 'bereit' }), 1);
  s.work = { from: s.tick, to: s.tick + BUILD.ticks };
  s.heraldDue = -1;
  t.dir = dirTo(s.player.x - t.x, s.player.y - t.y);
  events.push({ type: 'herald', what: 'build', id: t.id, x: t.x, y: t.y, persist: true });
}

/** Baut Tok gerade (die Figur hüpft dann auf jeden Pfeil nur)? */
export const building = (s: Pick<Heralded, 'tick' | 'work'>): boolean => !!s.work && s.tick < s.work.to;

/**
 * Nach jedem Befehl, solange gebaut wird: Zum Augenblick `pop` ploppt Bahnhof Bär auf (die Welt wird mit Bahnhof und
 * Gleis neu gebaut, `relay`), zum Augenblick `board` steigt Tok in den hinteren Wagen (er ist kein Wesen auf der Lichtung
 * mehr, der Zug trägt ihn), am Ende ist der Bau fertig (`State.work` fällt weg)
 */
export function buildStep(s: Heralded, id: string, events: Events) {
  if (!s.work) return;
  const t = s.animals.find((a) => a.id === id);
  if (!s.work.laid && s.tick >= beatTick(s.work.from, BUILD.pop)) {
    s.work = { ...s.work, laid: true };
    events.push({ type: 'herald', what: 'pop', id, x: t?.x ?? s.player.x, y: t?.y ?? s.player.y, relay: true });
  }
  if (t && s.tick >= beatTick(s.work.from, BUILD.board)) {
    s.animals = s.animals.filter((a) => a !== t);
    events.push({ type: 'herald', what: 'board', id, x: t.x, y: t.y });
  }
  if (s.tick >= s.work.to) delete s.work;
}
