// Das Spiel als App: installierbar von der Startseite und vom Spiel aus, der Service Worker steuert nur das Spiel,
// und ohne Netz startet es trotzdem. Installierbar laut Chromium: e2e/installable.spec.ts, Updates: e2e/pwa-update.spec.ts. Spec: docs/specs/mitwachsen.md („App“).
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
  const reg = await page.evaluate(() =>
    navigator.serviceWorker.ready.then((r) => ({ scope: r.scope, updateViaCache: r.updateViaCache })),
  );
  expect(new URL(reg.scope).pathname).toBe('/spielen/');
  // Die Frage nach einer neuen Version geht am HTTP-Cache vorbei, nie 'all'
  expect(['none', 'imports']).toContain(reg.updateViaCache);
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
  // Auch das Welt-Paket der Eis-Welt kommt ohne Netz aus dem Speicher: Der Kessel steht samt Eis-Portal
  expect(
    fromSw.some((p) => /\/welt-eis\.[\w-]+\.js$/.test(p)),
    fromSw.join(', '),
  ).toBe(true);
  const portals = () =>
    game.evaluate((el) => [...(el as unknown as { world: { portals: Map<string, unknown> } }).world.portals.keys()]);
  expect(await portals()).toContain('eiskessel');
  const sleeping = () => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
