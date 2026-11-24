// Menü für Eltern, nachgeladen: Inhalt (Liste der Welten mit je einem Knopf zum Wechseln mit Welt- und Figurname und
// einem zum Löschen, Namen, Welt-Code, Ton, Kamera bewegen, Höhle dunkel) und die seltenen Handgriffe: Welt löschen mit Rückfrage im Menü selbst (kein
// Dialog des Browsers) und Welt-Code kopieren. Die Klicks fängt die Web Component (larmic-mitwachsen.ts) über
// `data-world` und `data-delete`; sie lädt dieses Modul erst, wenn sie das Menü füllt oder ein Handgriff kommt.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Menü)

import { loadIndex, worldCode, type Index, type SavedWorld, type Store } from './mitwachsen-save';

const ARMED_MS = 4000; // so lange wartet der Knopf auf den zweiten Klick
/** Elternschalter „Kamera bewegen“: '1' heißt aus (Postkarte statt Drehung); fehlt der Eintrag, ist er an */
export const CALM_KEY = 'larmic.games.calm';

/** Ist der Elternschalter „Kamera bewegen“ aus? */
export const calm = (store: Store) => store.getItem(CALM_KEY) === '1';

/**
 * Elternschalter „Kamera bewegen“ umlegen und merken (geht das nicht, bleibt er, wie er war). Aus: Die 3D-Ansicht dreht
 * auf der Torplatte nicht zur Front, die Postkarte kommt stattdessen (wie in 2D und bei reduzierter Bewegung)
 */
export function toggleCalm(store: Store) {
  try {
    store.setItem(CALM_KEY, calm(store) ? '0' : '1');
  } catch {
    /* Speicher voll oder gesperrt */
  }
}

/** Elternschalter „Höhle dunkel“: '1' heißt aus („Höhle hell“, Maske 0,3); fehlt der Eintrag, ist er an (dunkel) */
export const CAVE_KEY = 'larmic.games.cave';

/** Ist der Elternschalter „Höhle dunkel“ aus, die Grotte also hell? */
export const caveBright = (store: Store) => store.getItem(CAVE_KEY) === '1';

/**
 * Elternschalter „Höhle dunkel“ umlegen und merken (geht das nicht, bleibt er, wie er war). Aus („Höhle hell“): Die
 * Dunkelmaske der Grotte deckt abseits der Figur nur mit 0,3 statt mit voller Stärke (worlds/hoehle/mitwachsen-mask.ts)
 */
export function toggleCave(store: Store) {
  try {
    store.setItem(CAVE_KEY, caveBright(store) ? '0' : '1');
  } catch {
    /* Speicher voll oder gesperrt */
  }
}

/** Welchen Elternschalter ein Klick vor dem Füllen umlegt */
export type Flip = 'motion' | 'cave';

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

/**
 * Menü füllen: Liste der Welten aus `store` (die gespielte markiert), Namen, Welt-Code und die Schalter für den Ton,
 * „Kamera bewegen“ und „Höhle dunkel“; `flip`: diesen Elternschalter vorher umlegen (geklickt)
 */
export function renderMenu(menu: HTMLElement, store: Store, saved: SavedWorld, muted: boolean, flip?: Flip) {
  if (flip === 'motion') toggleCalm(store);
  if (flip === 'cave') toggleCave(store);
  const index = loadIndex(store);
  menu.querySelector('.mw-worlds')!.replaceChildren(...index.worlds.map((w) => worldItem(w, w.id === saved.id)));
  (menu.querySelector('#mw-world-name') as HTMLInputElement).value = saved.worldName;
  (menu.querySelector('#mw-figure-name') as HTMLInputElement).value = saved.figureName;
  menu.querySelector('.mw-code')!.textContent = worldCode(saved.seed);
  toggle(menu, 'sound', !muted, muted ? 'Ton ist aus' : 'Ton ist an');
  const off = calm(store);
  toggle(menu, 'motion', !off, `Kamera bewegen: ${off ? 'aus' : 'an'}`);
  const bright = caveBright(store);
  toggle(menu, 'cave', !bright, `Höhle dunkel: ${bright ? 'aus' : 'an'}`);
  // an der Spielfläche für die 3D-Ansicht (mitwachsen-turn-3d.ts) und die Dunkelmaske der Grotte (mitwachsen-mask.ts),
  // auch wenn der Speicher gesperrt ist
  const host = menu.closest<HTMLElement>('.mw');
  host?.setAttribute('data-calm', off ? '1' : '0');
  host?.setAttribute('data-cave', bright ? '1' : '0');
}

/** Schalter im Menü (`data-act`): gedrückt heißt an, das Etikett sagt es auch */
function toggle(menu: HTMLElement, act: string, on: boolean, text: string) {
  const b = menu.querySelector(`[data-act="${act}"]`)!;
  b.setAttribute('aria-pressed', String(on));
  b.textContent = text;
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
