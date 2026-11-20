// Liste der Welten im Menü für Eltern (DOM): je Welt ein Knopf zum Wechseln mit Welt- und Figurname und ein Knopf zum
// Löschen. Die Klicks fängt die Web Component (larmic-mitwachsen.ts) über `data-world` und `data-delete`. Dazu der Name
// der Figur im Kopf und neue Welten (Seed und Kennung aus dem Zufall des Browsers).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Menü)

import {
  DEFAULT_FIGURE,
  loadIndex,
  loadWorld,
  newWorld,
  type Index,
  type SavedWorld,
  type Store,
  worldCode,
} from './mitwachsen-save';

export const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
export const randomId = () => randomSeed().toString(36) + Date.now().toString(36);

/** Spielstand einer Welt; fehlt sie im Index (gelöscht, kaputt), entsteht sie neu unter derselben Kennung und mit ihren Namen */
export function savedOrNew(store: Store, id: string | null): SavedWorld {
  const loaded = id ? loadWorld(store, id) : null;
  const entry = id ? loadIndex(store).worlds.find((w) => w.id === id) : undefined;
  return (
    loaded ??
    newWorld(id ?? randomId(), randomSeed(), entry?.worldName ?? 'Meine Welt', entry?.figureName ?? DEFAULT_FIGURE)
  );
}

/** Name der Figur im Kopf: Buchstabe für Buchstabe (jeder hüpft für sich), für Vorleseprogramme als Ganzes */
export function showName(tag: Element | null, name: string) {
  if (!tag) return;
  tag.replaceChildren(
    ...[...name.toUpperCase()]
      .filter((ch) => ch.trim())
      .map((ch) => {
        const s = document.createElement('span');
        s.textContent = ch;
        return s;
      }),
  );
  tag.setAttribute('aria-label', name);
}

/** Menü füllen: Liste der Welten (die gespielte markiert), Namen, Welt-Code und Knopf für den Ton */
export function renderMenu(menu: HTMLElement, index: Index, saved: SavedWorld, muted: boolean) {
  menu.querySelector('.mw-worlds')!.replaceChildren(...index.worlds.map((w) => worldItem(w, w.id === saved.id)));
  (menu.querySelector('#mw-world-name') as HTMLInputElement).value = saved.worldName;
  (menu.querySelector('#mw-figure-name') as HTMLInputElement).value = saved.figureName;
  menu.querySelector('.mw-code')!.textContent = worldCode(saved.seed);
  const sound = menu.querySelector('[data-act="sound"]')!;
  sound.setAttribute('aria-pressed', String(!muted));
  sound.textContent = muted ? 'Ton ist aus' : 'Ton ist an';
}

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
