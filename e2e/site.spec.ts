// Die Seiten ohne Spiel (Projekt `site` in playwright.config.ts): Startseite (Weg ins Spiel, Aufbau, Handy-Breite),
// Rechtliches, 404, ohne JavaScript, Manifest und Barrierefreiheit. Jede Seite muss ohne Fehler in der Konsole laden
// (pageerror und console.error). Das Spiel selbst: e2e/smoke.spec.ts. Spec: docs/specs/mitwachsen.md („App“).
import { expect, test } from '@playwright/test';
import { gotoGame, violations, watchErrors } from './helpers';

type Manifest = { start_url: string; scope: string; display: string; orientation?: string; icons: { src: string }[] };

for (const path of ['/', '/datenschutz/'])
  test(`Seite ${path} lädt ohne Fehler`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

test('Startseite führt ins Spiel, oben und am Ende', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: 'Spiel starten' });
  await expect(cta).toHaveCount(2);
  for (const n of [0, 1]) await expect(cta.nth(n)).toHaveAttribute('href', '/spielen/');
  await cta.first().click();
  await expect(page).toHaveURL(/\/spielen\/$/);
  await expect(page.locator('larmic-mitwachsen')).toBeVisible();
});

test('Startseite: Aufbau, Bild, Footer mit Impressum und Datenschutz', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThanOrEqual(5);
  const shot = page.locator('.shot img');
  await shot.scrollIntoViewIfNeeded();
  await expect.poll(() => shot.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const footer = page.locator('footer.site-footer');
  // Impressum und Kontakt liegen auf larmic.de, das Impressum dort gilt auch für diese Seite
  await expect(footer.getByRole('link', { name: 'Impressum und Kontakt' })).toHaveAttribute(
    'href',
    'https://larmic.de/impressum/',
  );
  await expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz/');
  // „Mehr für Eltern“ springt zum ersten Abschnitt
  await page.getByRole('link', { name: 'Mehr für Eltern' }).click();
  await expect(page).toHaveURL(/#eltern$/);
});

for (const width of [320, 390, 1280])
  test(`Startseite bei ${width} px ohne seitliches Scrollen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole('link', { name: 'Spiel starten' }).first()).toBeInViewport();
  });

test('Unbekannte Adresse zeigt die 404-Seite', async ({ page }) => {
  const res = await page.goto('/gibt-es-nicht/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: /404/ })).toBeVisible();
});

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('Inhalte bleiben lesbar, das Spiel erklärt sich Eltern', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Mitwachsen' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Spiel starten' }).first()).toHaveAttribute('href', '/spielen/');
    // Der Text für Eltern steht im <noscript>-Block des Spiels (die Prüfung über textContent, weil Playwright
    // <noscript> nicht wie ein Browser ohne JavaScript als sichtbaren Text behandelt)
    await gotoGame(page);
    const text = await page.locator('larmic-mitwachsen noscript').textContent();
    expect(text).toContain('Dieses Spiel für Dreijährige braucht JavaScript');
    expect(text).toContain('Wie viel Bildschirm?');
  });
});

// Das Spiel als App: installierbar von der Startseite und vom Spiel aus, die Startseite meldet keinen Service Worker an.
// Installierbar laut Chromium: e2e/installable.spec.ts, ohne Netz: e2e/pwa.spec.ts, Updates: e2e/pwa-update.spec.ts
for (const path of ['/', '/spielen/'])
  test(`Seite ${path} verweist auf ein gültiges Manifest, das ins Spiel führt`, async ({ page, request }) => {
    await page.goto(path);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#[0-9a-f]{6}$/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
    const res = await request.get(href!);
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as Manifest;
    expect(manifest).toMatchObject({ start_url: '/spielen/', scope: '/', display: 'standalone' });
    expect(manifest.orientation).toBeUndefined();
    for (const icon of manifest.icons) {
      const img = await request.get(icon.src);
      expect(img.ok(), icon.src).toBe(true);
      expect(img.headers()['content-type']).toBe('image/png');
    }
  });

test('Startseite meldet keinen Service Worker an', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBe(0);
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
});

// Barrierefreiheit der ruhenden Seite (reduzierte Bewegung): Mitten im Einblenden misst axe Mischfarben als Kontrast.
// Das Spiel: e2e/a11y.spec.ts
test.describe('ruhende Seiten', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  for (const path of ['/', '/datenschutz/', '/gibt-es-nicht/'])
    test(`Barrierefrei: ${path}`, async ({ page }) => {
      await page.goto(path);
      expect(await violations(page)).toEqual([]);
    });

  test('Barrierefrei: Startseite auf dem Handy (320 px)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    expect(await violations(page)).toEqual([]);
  });
});
