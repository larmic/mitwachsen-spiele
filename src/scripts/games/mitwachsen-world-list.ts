// Liste der Welten im Menü für Eltern (DOM): je Welt ein Knopf zum Wechseln mit Welt- und Figurname und ein Knopf zum
// Löschen. Die Klicks fängt die Web Component (larmic-mitwachsen.ts) über `data-world` und `data-delete`.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Menü)

import type { Index } from './mitwachsen-save';

/** Ein Eintrag der Liste; die gespielte Welt (`current`) ist markiert */
export function worldItem(w: Index['worlds'][number], current: boolean): HTMLLIElement {
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
