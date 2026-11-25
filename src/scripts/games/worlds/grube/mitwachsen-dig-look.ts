// Bild und Ton, wenn der Maulwurf den Glitzergang gräbt (Rückmeldung zur Höhle, Schritt 17), gleich für 2D und 3D (Haken
// `View2D.bodies` und `heraldFx`) – rein, ohne DOM und Three.js. Die Erdwelle ist ein kleiner Erdhügel mit zwei
// Kristallkrümeln, der einmal die künftige Runde entlangläuft, vom Grubenhalt bis zurück zum Halt (unter dem Fels des
// Gangs auf seiner Oberkante); er glimmt ein wenig (`beacon`: kleines Loch der Dunkelmaske mitten auf ihm, ohne
// Grenze der Entfernung zur Figur), damit man ihn im Dunkel sieht. Bei
// reduzierter Bewegung steht er in drei festen Bildern, statt zu gleiten. Töne, alle in der C-Pentatonik und über C5:
// Der Maulwurf klopft dreimal leise, die Erde brummelt dreimal weich hinab, der Gang geht auf und seine Klingeltore singen
// hinauf wie beim Durchfahren, Funkel kommt an seinem Halt an (sein Signal abwärts). Funkel rollt dabei aus dem Gang an
// den Halt (`funkelAt` in mitwachsen-funkel-look.ts).
// Spezifikation: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“, Der Maulwurf gräbt)

import { DIG, DIG_CRUMBS, MOUND_PARTS } from '../../../../data/games/worlds/grube/mitwachsen-dig-model';
import type { HeraldEvent } from '../../mitwachsen-herald';
import type { RideAt, RideBody, RideFx } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { RULE_TICK_MS } from '../../mitwachsen-turn-pace';
import type { Scored } from '../../sfx';
import { laneOf } from './mitwachsen-funkel';
import { gateScore } from './mitwachsen-gang-look';
import { digAt } from './mitwachsen-dig';

/** Kennung des Erdhügels der Erdwelle (ein Körper, nie antippbar: Antippen trifft nur `ride:`) */
export const MOUND_ID = 'grube-erde';
/** Feste Bilder der Erdwelle bei reduzierter Bewegung */
export const MOUND_STAGES = 3;

/**
 * Wo die Erdwelle bei Fortschritt `w` (0 … 1) des Grabens auf der künftigen Runde der Länge `n` ist, als Index (vom
 * ersten Feld des Halts an); undefined vor und nach ihr. Bei reduzierter Bewegung die Mitte einer von drei Stufen
 */
export function moundAt(w: number, n: number, reduced: boolean): number | undefined {
  const [from, to] = DIG.wave;
  if (w < from || w >= to || n < 2) return undefined;
  const f = (w - from) / (to - from);
  if (!reduced) return f * n;
  const k = Math.min(MOUND_STAGES - 1, Math.floor(f * MOUND_STAGES));
  return ((k + 0.5) / MOUND_STAGES) * n;
}

/** Körper je Bild, solange gegraben wird: der Erdhügel der Erdwelle auf der künftigen Runde (sonst nichts) */
export function digBodies(state: State, world: World, at: Pick<RideAt, 'frac' | 'reduced'>): readonly RideBody[] {
  const w = digAt(state, at.frac);
  if (w === undefined) return [];
  const lane = laneOf(world);
  const i = moundAt(w, lane.length, at.reduced);
  if (i === undefined) return [];
  const [a, b] = [lane[Math.floor(i) % lane.length]!, lane[(Math.floor(i) + 1) % lane.length]!];
  const f = i - Math.floor(i);
  const [ha, hb] = [world.cell(...a).h, world.cell(...b).h];
  return [
    {
      id: MOUND_ID,
      key: MOUND_ID,
      x: a[0] + (b[0] - a[0]) * f,
      y: a[1] + (b[1] - a[1]) * f,
      z: Math.max(ha, hb),
      dir: 's',
      parts: MOUND_PARTS,
      beacon: true, // die Kristallkrümel glimmen: ein kleines Loch der Dunkelmaske mitten auf ihm, wie weit die Figur auch weg ist
    },
  ];
}

/** Sekunden ab dem Beginn des Grabens bis zu einem seiner Augenblicke (`DIG`) */
const sec = (beat: number) => (beat * DIG.ticks * RULE_TICK_MS) / 1000;
const [C5, D5, E5, A5] = [523.25, 587.33, 659.25, 880];

/**
 * Töne des ganzen Grabens, eingeplant, wenn der Maulwurf zu klopfen beginnt: dreimal leise „tapp“ (A5), dreimal weich
 * brummelt die Erde hinab, während die Welle läuft (E5, D5, C5), zum Augenblick `pop` singen die Klingeltore hinauf
 * (D5 E5 G5 A5 C6 mit Nachhall, wie beim Durchfahren), am Ende kommt Funkel an (A5 → D5). Alles höchstens 0,05 laut
 */
export function digScore(): Scored[] {
  const [w0, w1] = DIG.wave;
  const tap = (at: number): Scored => [A5, 0.06, 'triangle', 0.045, 1, at];
  const hum = (f: number, at: number): Scored => [f, 0.3, 'sine', 0.035, 1, at];
  return [
    ...Array.from({ length: DIG.taps }, (_, i) => tap(0.05 + i * 0.22)),
    ...[E5, D5, C5].map((f, k) => hum(f, sec(w0 + (k * (w1 - w0)) / 3))),
    ...gateScore(true).map(([f, len, wave, gain, slide, at]): Scored => [f, len, wave, gain, slide, at + sec(DIG.pop)]),
    [A5, 0.14, 'triangle', 0.05, 1, sec(DIG.roll[1])],
    [D5, 0.3, 'triangle', 0.05, 1, sec(DIG.roll[1]) + 0.16],
  ];
}

/**
 * Bild und Ton zu einem Ereignis des Maulwurfs (eines anderen Boten, Tok: undefined): Er beginnt zu graben (alle Töne
 * des Grabens, er hüpft, Erdkrümel stieben), der Gang ist gegraben (Erdkrümel und Glitzern am Halt; die Töne laufen
 * schon), Funkel ist angekommen (still, sein Signal ist eingeplant)
 */
export function digFx(e: HeraldEvent): RideFx | undefined {
  switch (e.what) {
    case 'dig':
      return { score: digScore(), who: e.id, burst: DIG_CRUMBS };
    case 'dug':
      return { score: [], burst: DIG_CRUMBS };
    case 'rolled':
      return { score: [] };
    default:
      return undefined;
  }
}
