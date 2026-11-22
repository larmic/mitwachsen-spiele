// Gemeinsame Helfer der Browser-Tests: Spiel öffnen und neu laden, bis es steht (`settled`), Fehler der Seite sammeln.
// Nie auf Uhrzeit oder eine Zahl von Bildern warten, sondern auf einen Zustand: Die Pipeline zeichnet WebGL ohne
// Grafikkarte, dort dauert alles ein Vielfaches.
import { expect, type Page } from '@playwright/test';

/**
 * So lange darf das Spiel zum Stehen brauchen: Laden samt Three.js und erstem 3D-Bild, in der Pipeline und in
 * `gates:ci` (CI=1) per Software-WebGL auf wenigen Kernen und parallel zu einem zweiten Test. Nativ reichen 10 s:
 * Braucht das Laden dort länger, ist es selbst langsamer geworden und soll auffallen, statt in 30 s unterzugehen
 */
const SETTLE_MS = process.env.CI ? 30_000 : 10_000;

/** Sammelt Fehler der Seite; am Ende des Tests muss die Liste leer sein */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/**
 * Warten, bis das Spiel steht (`settled` an der Komponente): Welt offen, Tasten und Klicks kommen an, die endgültige
 * Ansicht (3D, ohne WebGL 2D) hat ihr erstes Bild gezeichnet. Davor kann ein Druck verloren gehen
 */
export const settled = (page: Page) =>
  expect(page.locator('larmic-mitwachsen')).toHaveClass(/\bsettled\b/, { timeout: SETTLE_MS });

/**
 * Spiel öffnen, bis es steht, und den Hinweis für Eltern schließen. `info: false`: Er kommt nicht (schon gesehen,
 * etwa im zweiten Tab desselben Kontexts)
 */
export async function openGame(page: Page, { info = true } = {}) {
  await page.goto('/spielen/');
  await settled(page);
  if (info) await page.getByRole('button', { name: /Verstanden/ }).click();
  return page.locator('larmic-mitwachsen');
}

/** Seite neu laden und warten, bis das Spiel wieder steht (der Hinweis kommt nicht wieder) */
export async function reloadGame(page: Page) {
  await page.reload();
  await settled(page);
}

/**
 * Menü für Eltern über das Zahnrad öffnen. Offen heißt gefüllt: Das Spiel füllt das nachgeladene Menü erst und zeigt es
 * dann (`openMenu` in larmic-mitwachsen.ts)
 */
export async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Menü für Eltern' }).click();
  const menu = page.locator('dialog.mw-settings');
  await expect(menu).toHaveJSProperty('open', true);
  return menu;
}

/**
 * Ein gezeichnetes Bild abwarten: Der nächste rAF der Seite läuft nach dem Bild des Spiels, das seinen eigenen früher
 * angemeldet hat; der zweite stellt sicher, dass dieses Bild ganz durch ist
 */
export const drawn = (page: Page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
