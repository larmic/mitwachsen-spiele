// Antippen eines Fahrzeugs (Teil der Web Component larmic-mitwachsen.ts): Ein Finger oder Klick auf das Fahrzeug, sein
// Zugtier oder seinen Schuppen ist wie ein neuer Druck zu ihm hin (`tap`: steigt ein, wenn die Figur nah genug ist;
// gelaufen wird per Antippen nie). Getroffen wird in 2D und 3D gleich, über die Projektion der Ansicht
// (`tapRide` in mitwachsen-ride-view.ts). Der Listener hängt am AbortSignal der Komponente.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“, Steuerung)

import type { Projection } from '../../lib/games/front';
import type { MoveCmd } from './mitwachsen-rider';
import { tapCmd, tapRide, type RideBody } from './mitwachsen-ride-view';

/** Was das Antippen gerade sieht; null: nichts antippbar (Menü offen, kein Fahrzeug) */
export type TapScene = { rides: readonly RideBody[]; project: Projection; player: { x: number; y: number } } | null;

/** Antippen auf der Spielfläche `canvas` anschließen: `move` bekommt den Befehl, wenn ein Fahrzeug getroffen ist */
export function listenTap(
  canvas: HTMLElement,
  signal: AbortSignal,
  scene: () => TapScene,
  move: (cmd: MoveCmd) => void,
) {
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      const s = scene();
      if (!s) return;
      const box = canvas.getBoundingClientRect();
      const hit = tapRide(s.rides, s.project, e.clientX - box.left, e.clientY - box.top);
      if (hit) move(tapCmd(hit, s.player));
    },
    { signal },
  );
}
