// Ruhiger Takt für die Eingabe – rein, ohne DOM und ohne Timer, damit testbar.
// Höchstens ein Schritt je STEP_MS, ob getippt oder gehalten. Ein Druck ist genau ein Schritt, auch wenn kleine
// Finger etwas länger auf dem Pfeil liegen: Erst wer HOLD_MS lang hält, läuft weiter, dann gleichmäßig im Takt.
// Ein Tipp während eines Schritts wird gemerkt und kommt im Takt dran, aber nie mehr als einer. So lohnt hektisches
// Drücken nicht (schneller als Halten ist es höchstens um den einen Schritt der Wartezeit).
// Spezifikation: docs/specs/mitwachsen.md (Eingabe)

import type { Dir } from '../../lib/games/front';
import type { RideEvent } from './mitwachsen-pack-types';
import type { GameEvent } from './mitwachsen-state';

export const STEP_MS = 260; // gut 4 Schritte pro Sekunde
export const HOLD_MS = 450; // so lange halten, bis die Figur weiterläuft (erster Spieltest am Tablet)
export const ACTION_MS = 350; // Leertaste: höchstens knapp 3 Aktionen pro Sekunde

/** Pfeiltasten und ihre Richtung; Tasten, die das Spiel nicht nimmt (der Browser und Hilfsmittel brauchen sie) */
export const KEYS: Record<string, Dir> = { ArrowUp: 'n', ArrowDown: 's', ArrowLeft: 'w', ArrowRight: 'e' };
export const FREE_KEYS = new Set([
  'Tab',
  'Escape',
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'OS',
  'CapsLock',
  'ContextMenu',
]);

/**
 * Begegnungen: Tier gefunden oder angestoßen, Beeren gepflückt, Fische gefangen, Futter oder Wasser gebracht, Wasser
 * geschöpft, Plattform erwacht, gereist, Klangstein, das Eistor geht auf (und jeder Hüpfer, solange es aufgeht), ein
 * Schneehaufen wächst um eine Kugel (Eis-Welt), die Kristall-Laterne genommen (Grotte), ins Bett gegangen. Danach bleibt die Figur kurz stehen (`pause`, so
 * lange wie die Wartezeit am Anfang, damit man Herz und Noten sieht) und läuft mit gehaltenem Pfeil weiter. Nur aus dem
 * Bett muss der Pfeil neu gedrückt werden (`AGAIN`). Kein Halt am Eiszapfen-Glockenspiel (`icicle`, Eis-Welt): Wer die
 * Reihe entlangläuft, spielt eine Melodie im Takt der Schritte. Fahrzeuge (`ride`, Schlüssel `ride:<what>`): kurz
 * stehen nach dem Aussteigen (gleich wieder, `leave`, oder am Ziel, `alight`) und nach dem Fest (`feast`); Winken,
 * Anstoßen, Halten unterwegs und der Wechsel der Gegend halten nicht an.
 */
export const ENCOUNTERS: ReadonlySet<Key> = new Set<Key>([
  'sing',
  'follow',
  'pick',
  'catch',
  'gather',
  'fill',
  'feed',
  'pour',
  'portal',
  'teleport',
  'story',
  'gate',
  'hop',
  'snowman',
  'lantern',
  'sleep',
  'ride:leave',
  'ride:alight',
  'ride:feast',
]);
/**
 * Danach erst nach neuem Druck weiter: sonst weckte der noch gehaltene Pfeil sie gleich wieder, und sie liefe zurück ins
 * Bett; ebenso nach dem Einsteigen (`ride:board`), sonst stiege sie mit dem gehaltenen Pfeil gleich wieder aus
 */
const AGAIN: ReadonlySet<Key> = new Set<Key>(['sleep', 'ride:board']);
/** Schlüssel eines Ereignisses für `stops`: sein Typ, bei Fahrzeugen mit Unterart (`ride:board`) */
type Key = GameEvent['type'] | `ride:${RideEvent['what']}`;
const keyOf = (e: GameEvent): Key => (e.type === 'ride' ? `ride:${e.what}` : e.type);

/** Wie eine Begegnung die Figur anhält: kurz (`pause`), bis zum nächsten Druck (`clear`) oder gar nicht */
export type Stop = 'pause' | 'clear' | null;

/**
 * Hält dieser Zug die Figur an (Begegnung)? Nicht, wenn nur das führende Tier singt: Der Pinguin, der zum Tor führt,
 * hüpft dabei voraus oder tauscht den Platz, er blockiert nie (docs/specs/mitwachsen.md, „Der Pinguin holt dich ab“).
 */
export function stops(events: readonly GameEvent[], leader?: string): Stop {
  if (events.some((e) => AGAIN.has(keyOf(e)))) return 'clear';
  return events.some((e) => ENCOUNTERS.has(keyOf(e)) && !(e.type === 'sing' && e.id === leader)) ? 'pause' : null;
}

export class InputPace {
  private down: Dir[] = []; // gehaltene Pfeile, zuletzt gedrückter hinten
  private pending: Dir | null = null;
  private lastStep = -Infinity;
  private since = -Infinity; // wann der zuletzt gedrückte Pfeil gedrückt wurde
  private lastAction = -Infinity;
  private fresh = false; // nach clear: Wiederholungen zählen erst nach einem neuen Druck wieder
  /**
   * Kam der zuletzt gelieferte Schritt aus einem neuen Druck (sofort oder als gemerkter Tipp) statt aus einem gehaltenen
   * Pfeil? Nur ein neuer Druck steigt in ein Fahrzeug (`Cmd.move.fresh`), ein gehaltener stößt nur sanft an.
   */
  lastFresh = false;

  /** Pfeil gedrückt (keine Wiederholungen des Systems): liefert den Schritt, falls er sofort dran ist */
  press(dir: Dir, now: number): Dir | null {
    this.down = [...this.down.filter((d) => d !== dir), dir];
    this.since = now;
    this.fresh = false;
    if (now - this.lastStep >= STEP_MS) {
      this.lastStep = now;
      this.pending = null;
      this.lastFresh = true;
      return dir;
    }
    this.pending = dir;
    return null;
  }

  release(dir: Dir) {
    this.down = this.down.filter((d) => d !== dir);
  }

  /**
   * Wiederholung des Systems: Der Pfeil ist noch gedrückt. Chrome auf dem Mac meldet manchmal kurz nach dem Druck ein
   * Loslassen, obwohl die Taste weiter gehalten wird; dann nimmt die Wiederholung sie wieder auf (die Wartezeit zählt
   * ab dem Druck). Nach `clear` (Bett, Fokus weg, Menü) nicht: Da braucht es einen neuen Druck.
   */
  repeat(dir: Dir) {
    if (!this.fresh && !this.down.includes(dir)) this.down = [...this.down, dir];
  }

  /** In jedem Bild aufrufen: liefert den nächsten Schritt im Takt (gemerkter Tipp, sonst gehaltener Pfeil) */
  poll(now: number): Dir | null {
    if (now - this.lastStep < STEP_MS) return null;
    const held = now - this.since >= HOLD_MS ? this.down.at(-1) : undefined; // gehalten erst nach der Wartezeit
    const dir = this.pending ?? held ?? null;
    if (dir) {
      this.lastFresh = this.pending !== null;
      this.pending = null;
      this.lastStep = now;
    }
    return dir;
  }

  /**
   * Ein Pfeil ist gedrückt: Die Figur läuft gleich weiter, sie steht nicht (Torplatte). Ein gemerkter Tipp zählt nicht
   * extra: Er kam keinen Schritt-Takt (260 ms) nach dem letzten Schritt, so kurz reicht nie zum Öffnen (0,4 s)
   */
  held(): boolean {
    return !!this.down.length;
  }

  /** Aktion (Leertaste o. a.): true, wenn sie zählt */
  action(now: number): boolean {
    if (now - this.lastAction < ACTION_MS) return false;
    this.lastAction = now;
    return true;
  }

  /** Begegnung (`stops`): kurz stehen bleiben, dann läuft ein gehaltener Pfeil weiter; oder alles vergessen */
  halt(stop: Stop, now: number) {
    if (stop === 'clear') this.clear();
    else if (stop === 'pause') {
      this.pending = null;
      this.since = now; // die Wartezeit wie nach einem frischen Druck
    }
  }

  /**
   * Alles vergessen, z. B. wenn das Menü aufgeht oder die Seite den Fokus verliert, und nach dem Schlafengehen: Die Figur
   * bleibt stehen, bis der Pfeil neu gedrückt wird.
   */
  clear() {
    this.down = [];
    this.pending = null;
    this.fresh = true;
  }
}
