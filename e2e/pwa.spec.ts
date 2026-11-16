// Das Spiel als App: installierbar von der Startseite und vom Spiel aus, der Service Worker steuert nur das Spiel,
// und ohne Netz startet es trotzdem. Spec: docs/specs/mitwachsen.md („App“).
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

type Manifest = { start_url: string; scope: string; display: string; orientation?: string; icons: { src: string }[] };

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

test('Spiel: Service Worker steuert /spielen/, ohne Netz startet das Spiel trotzdem', async ({ page, context }) => {
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  // Bereit heißt: alles gespeichert (install) und aktiv; clients.claim() übernimmt die offene Seite
  const scope = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.scope));
  expect(new URL(scope).pathname).toBe('/spielen/');
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
    .toMatch(/\/spielen\/sw\.js$/);
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));

  await context.setOffline(true);
  const fromSw: string[] = [];
  page.on('response', (r) => {
    if (r.fromServiceWorker()) fromSw.push(new URL(r.url()).pathname);
  });
  await page.reload();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
  // Auch das nachträglich geladene Three.js kommt ohne Netz aus dem Speicher
  if (webgl) await expect(game).toHaveClass(/three/);
  expect(fromSw).toContain('/spielen/');
  const sleeping = () => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

// App-Updates: Der Test-Server (e2e/serve.ts) liefert mit dem Cookie `mw-sw` einen Service Worker mit neuer Version
type GameEl = { state: { sleeping: boolean }; apply(cmd: { type: string }): void };

/** Spiel öffnen, Hinweis schließen, warten, bis der Service Worker die Seite steuert */
async function openGame(page: Page, firstTime = true) {
  await page.goto('/spielen/');
  if (firstTime) await page.getByRole('button', { name: /Verstanden/ }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
    .toMatch(/\/spielen\/sw\.js$/);
  const game = page.locator('larmic-mitwachsen');
  const sleeping = () => game.evaluate((el) => (el as unknown as GameEl).state.sleeping);
  let loads = 0;
  page.on('load', () => loads++);
  return { game, sleeping, loads: () => loads };
}

const newVersion = (page: Page) =>
  page.context().addCookies([{ name: 'mw-sw', value: '2', url: 'http://localhost:4321' }]);
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

test('App-Update: nach dem Gute-Nacht-Ritual kommt die neue Version, das Spiel schläft weiter', async ({ page }) => {
  const errors = watchErrors(page);
  const { game, sleeping, loads } = await openGame(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await newVersion(page);
  // Ins Bett (wie Hineinlaufen): Schlaflied, Nacht, gespeichert – danach fragt das Spiel nach einer neuen Version
  await game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
  await expect.poll(sleeping).toBe(true);
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  await expect(game).toHaveClass(/ready/);
  expect(await sleeping()).toBe(true);
  await expect(page.locator('dialog.mw-info')).not.toHaveAttribute('open');
  // Neue Version aktiv, alte Caches weg (keine andere Spielseite offen)
  await expect.poll(() => cacheNames(page)).toEqual([expect.stringMatching(/^mitwachsen-.+-2$/)]);
  // Kein zweites Neuladen
  await page.waitForTimeout(6000);
  expect(loads()).toBe(1);
  expect(await sleeping()).toBe(true);
  expect(errors).toEqual([]);
});

test('App-Update: zurück nach langer Pause, das Spiel schläft noch – die neue Version kommt', async ({ page }) => {
  const errors = watchErrors(page);
  const { sleeping, loads } = await openGame(page);
  await newVersion(page);
  await page.waitForTimeout(4500); // die Figur schläft seit dem Laden länger als das Ritual
  // Seite verborgen, eine halbe Stunde vergeht, Seite wieder sichtbar
  await page.evaluate(() => {
    let state = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
    const real = Date.now.bind(Date);
    Date.now = () => real() + 31 * 60_000;
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  expect(await sleeping()).toBe(true);
  await expect.poll(() => cacheNames(page)).toEqual([expect.stringMatching(/-2$/)]);
  expect(errors).toEqual([]);
});

test('App-Update: mitten im Spiel wird nie neu geladen, die neue Version wartet', async ({ page }) => {
  const errors = watchErrors(page);
  const { sleeping, loads } = await openGame(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await newVersion(page);
  await page.evaluate(() => navigator.serviceWorker.getRegistration('/spielen/').then((r) => r?.update()));
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration('/spielen/').then((r) => !!r?.waiting)))
    .toBe(true);
  // Auslöser wie beim Einschlafen und nach langer Pause – aber die Figur ist wach
  await page.evaluate(() => {
    document.dispatchEvent(new Event('mitwachsen-sleep'));
    let state = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
    const real = Date.now.bind(Date);
    Date.now = () => real() + 31 * 60_000;
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(6000);
  expect(loads()).toBe(0);
  expect(await sleeping()).toBe(false);
  expect(
    await page.evaluate(() => navigator.serviceWorker.getRegistration('/spielen/').then((r) => !!r?.waiting)),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('App-Update: ein zweiter, alter Tab spielt ungestört weiter, seine Dateien bleiben bis zuletzt', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  const a = await openGame(page);
  const other = await context.newPage();
  const otherErrors = watchErrors(other);
  const b = await openGame(other, false);
  await other.keyboard.press('ArrowDown');
  await expect.poll(b.sleeping).toBe(false);
  await page.keyboard.press('ArrowDown');
  await expect.poll(a.sleeping).toBe(false);
  await newVersion(page);
  await a.game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
  await expect.poll(a.loads, { timeout: 30_000 }).toBe(1);
  // Der Tab, der schlafen ging, hat die neue Version; der andere spielt weiter und lädt nicht neu
  expect(b.loads()).toBe(0);
  expect(await b.sleeping()).toBe(false);
  // Der alte Cache bleibt, solange der andere Tab offen ist …
  expect((await cacheNames(page)).length).toBe(2);
  // … und geht, sobald eine Spielseite allein offen ist und sich meldet
  await other.close();
  await page.reload();
  await expect.poll(() => cacheNames(page)).toEqual([expect.stringMatching(/-2$/)]);
  expect([...errors, ...otherErrors]).toEqual([]);
});
