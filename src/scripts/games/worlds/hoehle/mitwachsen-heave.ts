// Hau-ruck am Höhlentor – rein, ohne DOM: das Ritual, mit dem Tok und die Figur den Rollstein in seine Nische schieben
// (Konzept „Gleisbauer und Höhlen-Welt“, Tor-Ritual). Teil des Welt-Pakets der Höhlenwelt (`rules.ritual`, Form der
// Regeln eines Boten, mitwachsen-herald.ts); Tok selbst kommt aus dem Paket der Bahn, hier zählt nur, dass er als Bote
// (`mode: 'herald'`, wach) in der Bucht vor dem Höhlentor steht. Auslöser wie am Eistor: Die wache Figur steht seit 0,4 s
// still auf der Torplatte (`still`, nur Stehen zählt), das Tor ist zu und hat seinen Schlüssel (`keyOf`: erst mit der
// Bahn-Phase, `bahnOn`). Dann das Vorspiel, in dem die Kamera zur Front dreht (`leadTicks` je Torlage; in 2D und bei
// reduzierter Bewegung kommt die Postkarte), danach gibt jeder Pfeil einen Stoß (mindestens `PUSH_GAP` Takte
// dazwischen); ohne Druck stößt Tok nach je `TOK_ALONE` Takten allein, niemand bleibt hängen, es gibt keine Zeitgrenze
// und keinen Fehlerton. Drei Stöße: Der Stein rollt in Dritteln, beim dritten kommt das Tor zu den offenen (Ereignis
// `gate`, sofort gespeichert) und Toks Stufe auf mindestens `offen`. Noch `HEAVE_END` Takte (3 s): Der Stein rollt in die
// Nische, die Lampen gehen an, eine Fledermaus fliegt heraus, Glühwürmchen strömen hinein, am Ende hüpft Tok mit Herz
// („Ju-hu“); so lange lässt jeder Pfeil die Figur nur hüpfen. Gespeichert wird das Hau-ruck nie (`State.heave`): Ein
// halb geschobener Stein ist nach dem Laden wieder zu. Bild und Ton in mitwachsen-heave-look.ts.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Hau-ruck am Höhlentor)

import { keyOf, type GateId, type Point } from '../../../../data/games/mitwachsen';
import type { RideId } from '../../../../data/games/mitwachsen-rides';
import { inBay } from '../../mitwachsen-bay';
import { dirTo } from '../../mitwachsen-free';
import { HEAVE_END } from '../../mitwachsen-guide';
import { heraldOf, type HeraldEvents as Events, type HeraldRules, type Heralded } from '../../mitwachsen-herald';
import { rank, stageOf, withRide } from '../../mitwachsen-ride-save';
import { lageOf, leadTicks } from '../../mitwachsen-turn-pace';
import type { World } from '../../mitwachsen-world';

/** Das Tor des Hau-rucks: das Höhlentor */
export const GATE: GateId = 'hoehle';
/** So lange (0,4 s) steht die Figur still auf der Torplatte, dann beginnt das Hau-ruck (wie am Eistor) */
export const OPEN_TICKS = 4;
/** Toks Bahn im Spielstand der Fahrzeuge (`packs.fahrt.hoehle`): ihre Stufe wird mit dem Hau-ruck `offen` */
const TRAIN: RideId = 'hoehle';
/** Mindestens so viele Takte zwischen zwei Stößen */
export const PUSH_GAP = 6;
/** Ohne Druck stößt Tok nach so vielen Takten allein (1,5 s) */
export const TOK_ALONE = 15;
/** So viele Stöße, dann ist das Tor offen */
export const PUSHES = 3;

type Walker = Heralded['animals'][number];
const front = (door: { mid: Point; out: Point }, a: { x: number; y: number }) =>
  dirTo(door.mid[0] - a.x, door.mid[1] - a.y);

/** Tok, wenn er wach als Bote in der Bucht vor dem Tor steht (nicht auf der Platte) */
function tokAtBay(s: Heralded, world: World): Walker | undefined {
  const door = world.gates.get(GATE);
  const t = heraldOf(s);
  return door && t && !t.nap && inBay(door, t.x, t.y) && !world.cell(t.x, t.y).plate ? t : undefined;
}

/**
 * Nach jedem Befehl: Beginn (Takt, Figur still auf der Platte, Tok in der Bucht, Tor zu mit Schlüssel), Toks Stoß allein
 * nach `TOK_ALONE` Takten, nach dem dritten Stoß das Ende mit Toks Freude
 */
export function heaveStep(s: Heralded, world: World, cmd: 'move' | 'action' | 'tick', events: Events) {
  const door = world.gates.get(GATE);
  const h = s.heave;
  if (!door || cmd !== 'tick') return;
  if (h) {
    if (h.n < PUSHES) {
      if (s.tick >= h.at + TOK_ALONE) push(s, world, events); // ohne Druck: Tok stößt allein
    } else if (s.tick >= h.at + HEAVE_END) {
      delete s.heave;
      const t = heraldOf(s);
      if (t) events.push({ type: 'herald', what: 'arrive', id: t.id, x: t.x, y: t.y }); // hüpft, Herz, „Ju-hu“
    }
    return;
  }
  const p = s.player;
  if (s.sleeping || s.openGates.includes(GATE) || keyOf(GATE) !== 'tok') return;
  if (world.cell(p.x, p.y).plate !== GATE || s.still < OPEN_TICKS) return;
  const t = tokAtBay(s, world);
  if (!t) return;
  s.heave = { gate: GATE, n: 0, at: s.tick + leadTicks(lageOf(door.out)) };
  p.dir = dirTo(door.out[0], door.out[1]); // beide schauen zum Stein
  t.dir = front(door, t);
  events.push({ type: 'heave', x: door.mid[0], y: door.mid[1], n: 0, who: t.id });
}

/**
 * Ein Stoß: Der Stein rollt ein Drittel weiter (Ereignis `heave` mit der Zahl der Stöße); beim dritten ist das Tor
 * offen (zu den offenen Toren, Ereignis `gate`: sofort gespeichert) und Toks Stufe mindestens `offen` (`gefahren` bleibt)
 */
function push(s: Heralded, world: World, events: Events) {
  const door = world.gates.get(GATE);
  const h = s.heave;
  if (!door || !h) return;
  const n = h.n + 1;
  s.heave = { ...h, n, at: s.tick };
  const t = heraldOf(s);
  if (t) t.dir = front(door, t);
  events.push({ type: 'heave', x: door.mid[0], y: door.mid[1], n, ...(t && { who: t.id }) });
  if (n < PUSHES) return;
  if (!s.openGates.includes(GATE)) s.openGates.push(GATE);
  if (rank(stageOf(s.packs, TRAIN)) < rank('offen')) s.packs = withRide(s.packs, TRAIN, 'offen');
  events.push({ type: 'gate', id: GATE, at: 0 });
}

/**
 * Vor dem Schritt der Figur, solange das Hau-ruck läuft: Sie bleibt auf der Platte. Nach dem Vorspiel gibt jeder Pfeil
 * einen Stoß (der erste sofort, danach mindestens `PUSH_GAP` Takte nach dem letzten), sonst hüpft sie nur (im Vorspiel,
 * zu früh, und nach dem dritten Stoß bis zum Ende). true: Der Zug ist damit erledigt
 */
export function heaveMeet(s: Heralded, world: World, _cmd: unknown, events: Events): boolean {
  const h = s.heave;
  if (!h) return false;
  const ready = h.n < PUSHES && s.tick >= h.at && (h.n === 0 || s.tick - h.at >= PUSH_GAP);
  if (ready) push(s, world, events);
  else events.push({ type: 'hop' });
  return true;
}

/** Das Hau-ruck für `step` (`WorldRules.ritual`) */
export const HEAVE: HeraldRules = { step: heaveStep, meet: heaveMeet };
