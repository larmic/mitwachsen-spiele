// Smoke-Test der fertigen Seite: Startseite, Rechtliches, 404 und das Spiel.
// Jede Seite muss ohne Fehler in der Konsole laden (pageerror und console.error).
import { expect, test, type Page } from '@playwright/test';

/** Sammelt Fehler der Seite; am Ende des Tests muss die Liste leer sein */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

for (const path of ['/', '/impressum/', '/datenschutz/'])
  test(`Seite ${path} lädt ohne Fehler`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

test('Startseite führt ins Spiel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Spiel starten' }).first().click();
  await expect(page).toHaveURL(/\/spielen\/$/);
});

test('Unbekannte Adresse zeigt die 404-Seite', async ({ page }) => {
  const res = await page.goto('/gibt-es-nicht/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: /404/ })).toBeVisible();
});

test('Spiel: Hinweis für Eltern beim ersten Mal, eine Pfeiltaste weckt die Figur', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  const info = page.locator('dialog.mw-info');
  await expect(info).toHaveJSProperty('open', true);
  await page.getByRole('button', { name: /Verstanden/ }).click();
  await expect(info).toHaveJSProperty('open', false);
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
  const sleeping = () => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping);
  expect(await sleeping()).toBe(true);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('Inhalte bleiben lesbar, das Spiel erklärt sich Eltern', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Mitwachsen' })).toBeVisible();
    // Der Text für Eltern steht im <noscript>-Block des Spiels (die Prüfung über textContent, weil Playwright
    // <noscript> nicht wie ein Browser ohne JavaScript als sichtbaren Text behandelt)
    await page.goto('/spielen/');
    const text = await page.locator('larmic-mitwachsen noscript').textContent();
    expect(text).toContain('Dieses Spiel für Dreijährige braucht JavaScript');
    expect(text).toContain('Wie viel Bildschirm?');
  });
});
