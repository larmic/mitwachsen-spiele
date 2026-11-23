// Fahrzeuge von Mitwachsen („Reisewege“): je Welt eines, das zwischen einem Halt nahe ihrem Bett und einem Halt auf der
// Lichtung pendelt. Heute fährt nur der Schlitten der Eis-Welt; jedes weitere Fahrzeug kommt als Eintrag in `RIDES` dazu.
// Regeln und Strecke liefert das Welt-Paket (worlds/eis/mitwachsen-ride*.ts, mitwachsen-sled*.ts); der Kern kennt nur
// die Typen (`RideId`). Die Höhlenbahn (`'hoehle'`, Paket worlds/bahn/) liegt bisher nur als Gleis, und nur hinter dem
// Schalter `BAHN_LIVE`: Bis zum Freischalten sieht das Kind nichts von ihr, nur der Entwickler-Schalter zeigt sie.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Der Schlitten“ und „Tok und die Bahn“)

import type { GateId } from './mitwachsen';

/** Fahrzeuge: der Schlitten der Eis-Welt, die Höhlenbahn (`'hoehle'`, das Gleis von der Lichtung in die Grotte) */
export type RideId = 'schlitten' | 'hoehle';

/**
 * Freigabe der Bahn-Phase (Tok, Gleis, Zug, Hau-ruck am Höhlentor): Solange false, lädt das Spiel das Paket der Bahn
 * nie von selbst (`bahnWanted` in mitwachsen-pack.ts), das Kind sieht nichts davon und das Höhlentor bleibt zu; nur der
 * Entwickler-Schalter (`?entwickler=bahn`, mitwachsen-dev.ts) zeigt sie. Der letzte Schritt („Freischalten“) setzt ihn
 * auf true
 */
export const BAHN_LIVE: boolean = false;
/** Zeichen auf dem Wimpel nach der ersten Heimfahrt (Festfahrt) */
export type Pennant = 'flocke';

export type RideSpec = {
  id: RideId;
  gate: GateId; // Tor der Welt, zu der das Fahrzeug gehört (es gibt es nur, wenn dieses Tor offen ist)
  ticks: readonly [min: number, max: number]; // Dauer einer Fahrt in Takten zu 100 ms (15–20 s)
  signal: readonly number[]; // eigenes Signal aus 2 bis 3 Tönen der C-Pentatonik (Hz)
  color: string; // Grundfarbe des Fahrzeugs (auch die Tür nach der ersten Fahrt)
  pennant: Pennant;
};

export const RIDES: readonly [RideSpec, ...RideSpec[]] = [
  // Himmelblauer Holzschlitten mit Schlittenrentier; Schellen D6–A5
  { id: 'schlitten', gate: 'eis', ticks: [150, 200], signal: [1174.66, 880], color: '#78b8e8', pennant: 'flocke' },
];
