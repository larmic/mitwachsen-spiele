// Postkarte der Torfront oben im Bild (Canvas `mw-card` in MitwachsenGame.astro, nur Bild): Ist die Figur eine Sekunde
// auf einer Torplatte (`postcard` in mitwachsen-plate.ts, im Kern), blendet sie ein, beim Verlassen aus (250 ms im
// CSS). Nachgeladen mit der ersten Postkarte. In 3D rendert die 3D-Ansicht die Front als Standbild
// (`World3D.postcard`): beim Betreten und noch einmal, wenn das Tor ganz offen ist. In 2D zeichnet sie
// mitwachsen-postcard.ts, nur wenn sich etwas ändert (Tor öffnet, Pinguin führt). Gleich bei reduzierter Bewegung.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Postkarte der Torfront)

import type { GateId } from '../../data/games/mitwachsen';
import type { World3D } from './mitwachsen-3d';
import { drawPostcard } from './mitwachsen-postcard';
import type { State } from './mitwachsen-state';
import type { View2D } from './mitwachsen-view';
import type { World } from './mitwachsen-world';

/**
 * Postkarte auf `canvas`: liefert eine Funktion für jedes Bild, vor dem Bild der 3D-Ansicht (`r3d`, sonst 2D): `id`
 * das Tor, dessen Front sie zeigt (oder null), `open` wie weit jedes Tor offen ist, `view` die Zeichenteile der
 * Eis-Welt (mit ihnen der Pinguin am Tor: in 2D sein Umriss auf der Tür; in 3D steht er schon im Bild)
 */
export function postcardView(canvas: HTMLCanvasElement) {
  let shown: GateId | null = null; // Tor, dessen Front sie gerade zeigt
  let drawn: unknown[] = []; // womit sie zuletzt gezeichnet wurde; leer: neu zeichnen
  let last = 0; // wie weit das Tor im letzten Bild offen war (so steht es in der 3D-Szene)
  return (
    id: GateId | null,
    world: World,
    state: State,
    r3d: Pick<World3D, 'postcard'> | null,
    open: ReadonlyMap<string, number>,
    view: View2D | null,
  ) => {
    const o = (id && open.get(id)) ?? 0;
    if (id !== shown) {
      shown = id;
      canvas.classList.toggle('on', !!id);
      [drawn, last] = [[], o];
    }
    if (!id) return;
    const guest = r3d ? null : (view?.sky.guestAt(world, state) ?? null);
    // 3D: beim Betreten, dann erst wieder, wenn das Tor in der Szene ganz offen steht (kein Dauer-Rendern)
    const now = r3d ? [last >= 1] : [o, guest];
    last = o;
    if (now.length === drawn.length && now.every((v, i) => v === drawn[i])) return;
    drawn = now;
    if (r3d) r3d.postcard(world, id, canvas);
    else drawPostcard(canvas, id, o, guest);
  };
}
