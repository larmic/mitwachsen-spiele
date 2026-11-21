// Welten des Spiels im Browser (DOM): Spielstand einer Welt oder eine neue (Seed und Kennung aus dem Zufall des
// Browsers) und der Name der Figur im Kopf. Die Liste der Welten im Menü füllt mitwachsen-menu.ts (nachgeladen).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Menü)

import { DEFAULT_FIGURE, loadIndex, loadWorld, newWorld, type SavedWorld, type Store } from './mitwachsen-save';

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
