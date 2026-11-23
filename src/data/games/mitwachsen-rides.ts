// Fahrzeuge von Mitwachsen („Reisewege“): je Welt eines, das zwischen einem Halt nahe ihrem Bett und einem Halt auf der
// Lichtung pendelt. Heute nur der Schlitten der Eis-Welt; jedes weitere Fahrzeug kommt als Eintrag in `RIDES` dazu.
// Regeln und Strecke liefert das Welt-Paket (worlds/eis/mitwachsen-ride*.ts, mitwachsen-sled*.ts); der Kern kennt nur
// die Typen (`RideId`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import type { GateId } from './mitwachsen';

export type RideId = 'schlitten';
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
