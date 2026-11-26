// Antippen (Teil der Web Component larmic-mitwachsen.ts), die einzige Ausnahme von „die Maus nur fürs Menü“: Ein Finger
// oder Klick auf ein Fahrzeug (Schlitten mit Zugtier und Laternenpfahl, Zug) oder auf Tok, den Boten der Höhlenwelt, ist wie
// ein neuer Druck zu ihm hin (`tap`), wirkt also wie Hineinlaufen: einsteigen, Tok baut oder schnarcht, wenn die Figur
// nah genug ist; gelaufen wird per Antippen nie. Getroffen wird in 2D und 3D gleich, über die Projektion der Ansicht
// (`tapRide` in mitwachsen-ride-view.ts, Treffer höchstens `TAP_MAX`). Der Listener hängt am AbortSignal der Komponente.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“, Steuerung; „Tok und die Bahn“, Antippen)

import type { Projection } from '../../lib/games/front';
import type { MoveCmd } from './mitwachsen-rider';
import { tapCmd, tapRide, type Tap } from './mitwachsen-ride-view';

/** Was das Antippen gerade sieht (Körper der Fahrzeuge und der Bote); null: nichts antippbar (Menü offen, nichts da) */
export type TapScene = { rides: readonly Tap[]; project: Projection; player: { x: number; y: number } } | null;

/** Antippen auf der Spielfläche `canvas` anschließen: `move` bekommt den Befehl, wenn etwas Antippbares getroffen ist */
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
