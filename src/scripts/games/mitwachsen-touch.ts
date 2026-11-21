// Touch-Steuerung von Mitwachsen: Das Steuerkreuz läuft über denselben ruhigen Takt wie die Tastatur (input-pace.ts).
// Nach der ersten Berührung erscheint die Steuerung auch auf Geräten mit Maus (z. B. Laptop mit Touchscreen). Teil der
// Web Component (larmic-mitwachsen.ts); alle Listener hängen an ihrem AbortSignal.
// Spezifikation: docs/specs/mitwachsen.md (Steuerung)

import type { Dir } from '../../lib/games/front';
import type { InputPace } from './input-pace';
import type { Sfx } from './sfx';

/**
 * Steuerkreuz und Berührungen der Spielfläche `root` anschließen: `move` bekommt jeden Schritt, den der Takt erlaubt
 * (gehaltene Tasten laufen über `pace` im Bild weiter)
 */
export function listenTouch(
  root: HTMLElement,
  signal: AbortSignal,
  pace: InputPace,
  sfx: Pick<Sfx, 'unlock'>,
  move: (dir: Dir) => void,
) {
  document.addEventListener('touchstart', () => root.classList.add('touch'), { signal, passive: true, once: true });
  // iPad/iPhone erlauben Ton erst bei einer aktivierenden Geste (Loslassen), nicht schon beim Antippen
  const unlock = () => sfx.unlock();
  document.addEventListener('pointerup', unlock, { signal });
  document.addEventListener('touchend', unlock, { signal, passive: true });
  // iPad/iPhone: Langes Drücken öffnet sonst Lupe, Textauswahl oder ein Menü. Pointer-Ereignisse kommen trotzdem an.
  const quiet = (e: Event) => e.preventDefault();
  for (const el of root.querySelectorAll<HTMLElement>('.mw-touch, .mw-canvas')) {
    el.addEventListener('touchstart', quiet, { signal, passive: false });
    el.addEventListener('contextmenu', quiet, { signal });
  }
  for (const key of root.querySelectorAll<HTMLElement>('.mw-key')) {
    const dir = key.dataset.dir as Dir;
    const held = new Set<number>(); // mehrere Finger auf derselben Taste: erst der letzte lässt los
    const up = (e: Event) => {
      held.delete((e as PointerEvent).pointerId);
      if (held.size) return;
      key.classList.remove('down');
      pace.release(dir);
    };
    key.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        key.setPointerCapture(e.pointerId);
        held.add(e.pointerId);
        key.classList.add('down');
        sfx.unlock();
        const go = pace.press(dir, performance.now());
        if (go) move(go);
      },
      { signal },
    );
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) key.addEventListener(type, up, { signal });
  }
}
