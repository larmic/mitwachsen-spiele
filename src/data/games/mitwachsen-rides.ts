// Fahrzeuge von Mitwachsen („Reisewege“): je Welt eines, das zwischen einem Halt nahe ihrem Bett und einem Halt auf der
// Lichtung pendelt. Heute der Schlitten der Eis-Welt und die Höhlenbahn; jedes weitere Fahrzeug kommt als Eintrag in
// `RIDES` dazu. Ausnahme (Rückmeldung zur Höhle, 24.11.2026): ein zweites Fahrzeug innerhalb einer Welt, das eine
// Schleife fährt (`loop`, das Grubenbähnchen Funkel `'grube'` in der Grotte, Paket worlds/grube/): Start und Ziel sind
// derselbe Halt, es hält nie auf der Lichtung, hat keinen Wimpel und kein Fest. Die Fahrregeln aller Fahrzeuge bringt das Paket der Fahrzeuge mit (worlds/fahrt/), Strecke und Bild das
// Paket des Fahrzeugs (Schlitten: worlds/eis/mitwachsen-sled*.ts; Zug: worlds/bahn/mitwachsen-train*.ts; Funkel:
// worlds/grube/mitwachsen-funkel*.ts). Die Liste steht
// hier, weil die Pakete einander nicht importieren und jedes seinen Eintrag braucht; der Kern kennt nur die Typen
// (`RideId`). Die Höhlenbahn (`'hoehle'`, Paket worlds/bahn/) kommt mit Tok nach der ersten Heimfahrt mit dem
// Schlitten (Bau 1).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Der Schlitten“ und „Tok und die Bahn“)

import type { GateId } from './mitwachsen';

/**
 * Fahrzeuge: der Schlitten der Eis-Welt, die Höhlenbahn (`'hoehle'`, das Gleis von der Lichtung in die Grotte), die
 * Grubenbahn Funkel (`'grube'`, eine Schleife in der Grotte)
 */
export type RideId = 'schlitten' | 'hoehle' | 'grube';

/**
 * Vorladen am Halt (`RIDE_PRELOAD`, Konzept „Reisewege“): Steht die Figur höchstens so viele Felder (Schachbrett) vor
 * einem Halt eines Fahrzeugs, holt das Spiel die Pakete, die es zum Fahren braucht (Fahr-Engine, Ziel-Gegend). Fehlt
 * eines noch, schläft das Fahrzeug freundlich (mitwachsen-preload.ts)
 */
export const RIDE_PRELOAD = 6;
/** Zeichen auf dem Wimpel nach der Festfahrt (Schlitten: Schneeflocke; Zug: Kristall, kommt mit der Laternenfahrt) */
export type Pennant = 'flocke' | 'kristall';

/** Was jedes Fahrzeug hat */
type RideBase = {
  id: RideId;
  gate: GateId; // Tor der Welt, zu der das Fahrzeug gehört
  ticks: readonly [min: number, max: number]; // Dauer einer Fahrt in Takten zu 100 ms (15–20 s)
  /**
   * Höchsttempo in Feldern je Takt (Zug: 0,8 = 8 Felder je Sekunde, Konzept; die Messung in 3D entscheidet, Rückfall 6):
   * Die Fahrt dauert dann Länge / Tempo Takte, in `ticks` gehalten (eine kurze Strecke, etwa bis zum Prellbock in der
   * Bucht, fährt langsamer, damit auch sie 15 s dauert). Ohne Tempo dauert sie Länge × 1,5 Takte, ebenso gehalten
   * (Schlitten)
   */
  pace?: number;
  signal: readonly number[]; // eigenes Signal aus 2 bis 3 Tönen der C-Pentatonik (Hz)
  color: string; // Grundfarbe des Fahrzeugs (auch die Tür nach der ersten Fahrt)
};

/** Ein Fahrzeug, das zwischen dem Halt in seiner Welt und dem Halt auf der Lichtung pendelt (Schlitten, Zug) */
export type ShuttleSpec = RideBase & {
  loop?: undefined;
  pennant: Pennant;
  /**
   * Ab welcher Stufe das Fahrzeug am Halt auf der Lichtung steht: der Schlitten erst nach der ersten Heimfahrt (`fest`,
   * sie ist sein Fest), der Zug gleich nach Bau 1 (`bereit`: Bahnhof Bär liegt auf der Lichtung)
   */
  out: 'bereit' | 'fest';
};

/**
 * Ein Fahrzeug, das in seiner Welt eine Schleife fährt (`loop`, die Grubenbahn): Start und Ziel sind derselbe Halt, es
 * fährt immer vorwärts. Es hält nie auf der Lichtung (kein `out`), hat keinen Wimpel (kein `pennant`), keine Festfahrt
 * und kein „Gute Nacht“ (es steht nie in Sichtweite des Lichtungsbetts); seine Strecke trägt `RideRoute.loop`
 */
export type LoopSpec = RideBase & { loop: true; pennant?: undefined; out?: undefined };

export type RideSpec = ShuttleSpec | LoopSpec;

export const RIDES: readonly [RideSpec, ...RideSpec[]] = [
  // Himmelblauer Holzschlitten mit Schlittenrentier; Schellen D6–A5
  {
    id: 'schlitten',
    gate: 'eis',
    ticks: [150, 200],
    signal: [1174.66, 880],
    color: '#78b8e8',
    pennant: 'flocke',
    out: 'fest',
  },
  // Höhlenbahn: kleine Lok mit zwei Wagen in Lila und Silber; Pfiff A5 → C6 (Ding-Dong E5–C5 an den Türen)
  {
    id: 'hoehle',
    gate: 'hoehle',
    ticks: [150, 200],
    pace: 0.8,
    signal: [880, 1046.5],
    color: '#a07cff',
    pennant: 'kristall',
    out: 'bereit',
  },
  // Grubenbähnchen Funkel: kastenförmige Lok in Petrol mit großer runder Lampe, zwei geschlossene Bankwagen mit Cremedach;
  // eine Schleife in der Grotte (gut 160 Felder, mit 8 Feldern je s höchstens 20 s); Signal D5 → A5 (über 500 Hz, nicht
  // G4 wie „Uh-uh“, Toks Zzz und die Torplatte der Höhle)
  {
    id: 'grube',
    gate: 'hoehle',
    ticks: [150, 200],
    pace: 0.8,
    signal: [587.33, 880],
    color: '#2f8f83',
    loop: true,
  },
];
