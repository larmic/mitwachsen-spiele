// Seltene Handgriffe im Menü für Eltern: Welt löschen mit Rückfrage im Menü selbst (kein Dialog des Browsers) und
// Welt-Code kopieren. Die Web Component (larmic-mitwachsen.ts) lädt sie erst beim ersten Klick nach.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Menü)

const ARMED_MS = 4000; // so lange wartet der Knopf auf den zweiten Klick

/**
 * Löschen-Knopf geklickt: Der erste Klick fragt („Wirklich löschen?“, auch im Etikett für Screenreader), der zweite
 * innerhalb von 4 Sekunden bestätigt. Liefert true, wenn gelöscht werden soll.
 */
export function confirmDelete(button: HTMLElement): boolean {
  if (button.dataset.armed === '1') return true;
  button.dataset.armed = '1';
  button.textContent = 'Wirklich löschen?';
  button.setAttribute(
    'aria-label',
    `${button.getAttribute('aria-label')?.replace(/ löschen$/, '') ?? 'Welt'} wirklich löschen?`,
  );
  setTimeout(() => {
    if (!button.isConnected) return;
    button.dataset.armed = '';
    button.textContent = 'Löschen';
    button.setAttribute('aria-label', button.getAttribute('aria-label')!.replace(/ wirklich löschen\?$/, ' löschen'));
  }, ARMED_MS);
  return false;
}

/**
 * Welt-Code in die Zwischenablage: `written` hat die Komponente noch im Klick begonnen (sonst verfällt in Safari die
 * Geste); ging das nicht, wird der Code im Menü markiert. Der Knopf sagt kurz, was geschah
 */
export async function copyCode(button: HTMLElement, written: Promise<void>, menu: HTMLElement) {
  const done = (text: string) => {
    button.textContent = text;
    setTimeout(() => (button.textContent = 'Kopieren'), 1600);
  };
  try {
    await written;
    done('Kopiert');
  } catch {
    const range = document.createRange();
    range.selectNodeContents(menu.querySelector('.mw-code')!);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    done('Markiert');
  }
}
