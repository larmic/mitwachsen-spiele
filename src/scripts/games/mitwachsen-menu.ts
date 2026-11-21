// Menü für Eltern, nachgeladen: Inhalt (Liste der Welten mit je einem Knopf zum Wechseln mit Welt- und Figurname und
// einem zum Löschen, Namen, Welt-Code, Ton) und die seltenen Handgriffe: Welt löschen mit Rückfrage im Menü selbst (kein
// Dialog des Browsers) und Welt-Code kopieren. Die Klicks fängt die Web Component (larmic-mitwachsen.ts) über
// `data-world` und `data-delete`; sie lädt dieses Modul erst, wenn sie das Menü füllt oder ein Handgriff kommt.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Menü)

import { loadIndex, worldCode, type Index, type SavedWorld, type Store } from './mitwachsen-save';

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

/** Menü füllen: Liste der Welten aus `store` (die gespielte markiert), Namen, Welt-Code und Knopf für den Ton */
export function renderMenu(menu: HTMLElement, store: Store, saved: SavedWorld, muted: boolean) {
  const index = loadIndex(store);
  menu.querySelector('.mw-worlds')!.replaceChildren(...index.worlds.map((w) => worldItem(w, w.id === saved.id)));
  (menu.querySelector('#mw-world-name') as HTMLInputElement).value = saved.worldName;
  (menu.querySelector('#mw-figure-name') as HTMLInputElement).value = saved.figureName;
  menu.querySelector('.mw-code')!.textContent = worldCode(saved.seed);
  const sound = menu.querySelector('[data-act="sound"]')!;
  sound.setAttribute('aria-pressed', String(!muted));
  sound.textContent = muted ? 'Ton ist aus' : 'Ton ist an';
}

/** Ein Eintrag der Liste; die gespielte Welt (`current`) ist markiert */
function worldItem(w: Index['worlds'][number], current: boolean): HTMLLIElement {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mw-world';
  b.dataset.world = w.id;
  if (current) b.setAttribute('aria-current', 'true');
  const name = document.createElement('strong');
  name.textContent = w.worldName;
  const fig = document.createElement('span');
  fig.textContent = w.figureName;
  b.append(name, fig);
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'mw-link mw-delete';
  del.dataset.delete = w.id;
  del.textContent = 'Löschen';
  del.setAttribute('aria-label', `Welt „${w.worldName}“ löschen`);
  li.append(b, del);
  return li;
}
