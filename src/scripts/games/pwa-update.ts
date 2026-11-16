// Neue Version der App an sicheren Stellen übernehmen – rein, ohne DOM und ohne Uhr, damit testbar.
// Installierte Apps (iPad, Android) werden meist nur angehalten, nicht beendet: Ein Tipp aufs Symbol setzt sie fort,
// ohne neu zu laden. Der Browser prüft dann weder auf eine neue Version, noch wird eine wartende aktiv. Darum übernimmt
// das Spiel eine wartende Version selbst, aber nur an zwei sicheren Stellen:
// 1. Gute Nacht: Die Figur ist ins Bett gegangen, das Schlaflied ist verklungen, der Spielstand gespeichert.
// 2. Zurück nach langer Pause (Seite lange verborgen), wenn das Spiel dann schläft oder noch nicht begonnen hat
//    (Hinweis für Eltern beim allerersten Öffnen).
// Nach einem Auslöser bleibt ein kurzes Fenster offen, damit eine Version, die erst jetzt geladen wird, noch zählt.
// Mitten im Spiel wird nie neu geladen. Spezifikation: docs/specs/mitwachsen.md („App“).

const MIN = 60_000;
export const LONG_PAUSE = 30 * MIN; // so lange verborgen, und beim Zurückkommen wird nach einer neuen Version gefragt
export const RITUAL_MS = 4_000; // Nacht blendet ein (1,5 s), Schlaflied klingt (gut 2,5 s): danach ist Ruhe
export const ARM_MS = 60_000; // so lange nach einem Auslöser darf eine (gerade erst geladene) Version übernommen werden
export const APPLY_GAP = 10 * MIN; // höchstens einmal in dieser Zeit neu laden – keine Schleife, falls etwas klemmt
export const SLEEP_EVENT = 'mitwachsen-sleep'; // so meldet das Spiel, dass die Figur eingeschlafen ist (steigt auf)

/** Was das Spiel gerade tut, soweit es fürs Neuladen zählt */
export type Moment = {
  sleeping: boolean; // die Figur liegt im Bett
  sleepingFor: number; // ms seit dem Einschlafen (Infinity, wenn sie seit dem Öffnen der Welt schläft)
  menuOpen: boolean; // Eltern sind im Menü
  infoOpen: boolean; // Hinweis für Eltern ist offen
  firstInfo: boolean; // … und zwar beim allerersten Öffnen, vor dem ersten Spiel (kommt nach dem Laden wieder)
  persistent: boolean; // der Spielstand liegt im localStorage und übersteht das Neuladen
  fullscreen: boolean; // Neuladen beendete das Vollbild
  visible: boolean;
};

/** Was das Spiel selbst beiträgt (larmic-mitwachsen.ts); den Rest weiß die Seite */
export type GameMoment = Pick<Moment, 'sleeping' | 'sleepingFor' | 'menuOpen' | 'infoOpen' | 'firstInfo'>;

/** Ist jetzt ein sicherer Moment? Nach dem Neuladen sieht das Kind dasselbe wie vorher */
export function safeMoment(m: Moment): boolean {
  if (!m.persistent || !m.visible || m.fullscreen || m.menuOpen) return false;
  if (m.infoOpen) return m.firstInfo;
  return m.sleeping && m.sleepingFor >= RITUAL_MS;
}

/** War die Seite lange genug verborgen? (`hiddenAt` 0: war sie nicht) */
export const longPause = (hiddenAt: number, now: number): boolean => hiddenAt > 0 && now - hiddenAt >= LONG_PAUSE;

export type Chance = {
  waiting: boolean; // eine neue Version wartet
  armedAt: number; // Zeitpunkt des letzten Auslösers (Gute Nacht, Rückkehr nach langer Pause), 0: keiner
  lastApplied: number; // wann zuletzt eine Version übernommen wurde (über das Neuladen hinweg), 0: nie
  now: number;
  safe: boolean; // safeMoment(…)
};

/** Jetzt übernehmen und neu laden? */
export function shouldApply(c: Chance): boolean {
  if (!c.waiting || !c.safe || c.armedAt <= 0) return false;
  if (c.now - c.armedAt > ARM_MS || c.now < c.armedAt) return false;
  return c.lastApplied <= 0 || c.now - c.lastApplied >= APPLY_GAP || c.now < c.lastApplied;
}

export type Takeover = {
  taken: boolean; // die neue Version steuert die Seite, auf Bitte der Seite (controllerchange nach skipWaiting)
  safe: boolean; // safeMoment(…), jetzt erneut geprüft
  armedAt: number; // Zeitpunkt des letzten Auslösers, 0: keiner
  now: number;
};

/**
 * Jetzt neu laden? Zwischen der Bitte um skipWaiting und der Übernahme vergeht Zeit (ein ruhender Service Worker
 * startet auf dem Tablet erst), und das Kind kann die Figur genau dann wecken. Darum gilt der sichere Moment noch
 * einmal: Ist er vorbei, lädt die Seite erst beim nächsten Auslöser in einem sicheren Moment neu. Bis dahin spielt
 * sie weiter, die neue Version liefert ihr die alten Dateien aus dem alten Cache (Aufräumen wartet auf offene Seiten).
 */
export function shouldReload(t: Takeover): boolean {
  if (!t.taken || !t.safe || t.armedAt <= 0) return false;
  return t.now >= t.armedAt && t.now - t.armedAt <= ARM_MS;
}

/**
 * Optionen der Anmeldung. `updateViaCache: 'none'`: Die Frage nach einer neuen Version geht immer am HTTP-Cache vorbei
 * ins Netz, für sw.js und alles, was er einmal importieren sollte. Nie 'all' – dann hielte der HTTP-Cache eine neue
 * Version zurück, und alle Mühe an den sicheren Stellen ginge ins Leere.
 */
export const registrationOptions = (scope: string): RegistrationOptions => ({ scope, updateViaCache: 'none' });
