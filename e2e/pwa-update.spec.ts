// App-Updates mit zwei echten Fassungen der Seite: Fassung 1 ist der Build (dist/), Fassung 2 leitet e2e/versions.ts
// daraus ab (neues Three.js unter neuem Namen, neuer Service Worker). Mit dem Cookie `mw-version=2` geht für einen
// Browser-Kontext Fassung 2 „live“ (e2e/serve.ts). Spec: docs/specs/mitwachsen.md („App“, „Updates an sicheren Stellen“).
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseServiceWorker } from '../scripts/pwa.ts';
import { CHUNK, VERSIONS } from './versions-dirs.ts';

// Diese Tests warten echte Abläufe ab (Ritual, Installation einer Fassung, Neuladen mit 3D) und brauchen schon allein
// auf einem Runner mit 2 CPUs gut 20 s; parallel zu anderen Tests reichen die üblichen 30 s nicht
test.describe.configure({ timeout: 120_000 });

/** Sammelt Fehler der Seite; am Ende des Tests muss die Liste leer sein */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Cache-Name und 3D-Datei (Pfad, Größe) einer Fassung, aus ihrem Service Worker gelesen */
function version(n: '1' | '2') {
  const dir = VERSIONS[n]!;
  const sw = parseServiceWorker(readFileSync(join(dir, 'spielen/sw.js'), 'utf8'));
  const chunk = sw?.files.find((f) => CHUNK.test(f));
  if (!sw || !chunk) throw new Error(`Fassung ${n}: Service Worker ohne 3D-Datei`);
  return { cache: sw.cache, chunk, chunkBytes: statSync(join(dir, chunk)).size };
}

type GameEl = { state: { sleeping: boolean }; apply(cmd: { type: string }): void };

/** Spiel öffnen, Hinweis schließen, warten, bis der Service Worker die Seite steuert */
async function openGame(page: Page, firstTime = true) {
  await page.goto('/spielen/');
  if (firstTime) await page.getByRole('button', { name: /Verstanden/ }).click();
  // Angemeldet wird erst nach dem Laden (samt 3D); auf langsamen Runnern dauert das
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), { timeout: 30_000 })
    .toMatch(/\/spielen\/sw\.js$/);
  const game = page.locator('larmic-mitwachsen');
  const sleeping = () => game.evaluate((el) => (el as unknown as GameEl).state.sleeping);
  let loads = 0;
  page.on('load', () => loads++);
  return { game, sleeping, loads: () => loads };
}

/** Fassung 2 geht für diesen Browser-Kontext live */
const goLive = (context: BrowserContext) =>
  context.addCookies([{ name: 'mw-version', value: '2', url: 'http://localhost:4321' }]);
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());
const registration = (page: Page) =>
  page.evaluate(() =>
    navigator.serviceWorker.getRegistration('/spielen/').then((r) => ({
      waiting: r?.waiting?.state ?? null,
      active: r?.active?.state ?? null,
    })),
  );
/** Wie der Browser von sich aus: nach einer neuen Version fragen */
const askForUpdate = (page: Page) =>
  page.evaluate(() =>
    navigator.serviceWorker.getRegistration('/spielen/').then((r) => r?.update().then(() => undefined)),
  );
/** Größe einer Datei, wie die Seite sie bekommt (über den Service Worker), sonst minus Status */
const fetchBytes = (page: Page, url: string) =>
  page.evaluate(
    (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.arrayBuffer().then((b) => b.byteLength) : -r.status)),
    url,
  );
/** Seite lange verborgen, dann wieder sichtbar (Uhr eine halbe Stunde vor) */
const longPause = (page: Page) =>
  page.evaluate(() => {
    let state = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
    const real = Date.now.bind(Date);
    Date.now = () => real() + 31 * 60_000;
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });

test('Zwei Fassungen: die offene alte Seite läuft weiter, die neue wartet und gilt ab dem nächsten Start', async ({
  page,
  context,
}) => {
  const [v1, v2] = [version('1'), version('2')];
  expect(v2.cache).not.toBe(v1.cache);
  expect(v2.chunk).not.toBe(v1.chunk);
  const errors = watchErrors(page);
  // (a) Fassung 1 steuert die Seite
  const a = await openGame(page);
  await expect.poll(() => cacheNames(page)).toEqual([v1.cache]);
  await page.evaluate(() => {
    (window as unknown as { first: unknown }).first = navigator.serviceWorker.controller;
  });
  // (b) Fassung 2 geht live: Die alte 3D-Datei gibt es auf dem Server nicht mehr
  await goLive(context);
  expect((await page.request.get(v1.chunk)).status()).toBe(404);
  await askForUpdate(page);
  // (c) Fassung 2 ist geladen und wartet, Fassung 1 bleibt aktiv und steuert die Seite
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller === (window as unknown as { first: unknown }).first),
  ).toBe(true);
  expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
  // Die alte Seite spielt weiter, und auch ohne Netz bekommt sie ihr altes Three.js
  await page.keyboard.press('ArrowDown');
  await expect.poll(a.sleeping).toBe(false);
  await context.setOffline(true);
  expect(await fetchBytes(page, v1.chunk)).toBe(v1.chunkBytes);
  await context.setOffline(false);
  expect(a.loads()).toBe(0);
  expect(errors).toEqual([]);
  // (d) Alle Spielseiten zu, neu öffnen: Fassung 2 ist aktiv, der alte Cache ist weg
  await page.close();
  const next = await context.newPage();
  const nextErrors = watchErrors(next);
  await openGame(next, false);
  await expect.poll(() => registration(next)).toEqual({ waiting: null, active: 'activated' });
  await expect.poll(() => cacheNames(next)).toEqual([v2.cache]);
  expect(await fetchBytes(next, v2.chunk)).toBe(v2.chunkBytes);
  expect(nextErrors).toEqual([]);
});

test('App-Update: nach dem Gute-Nacht-Ritual kommt die wartende Fassung, einmal neu geladen, das Spiel schläft weiter', async ({
  page,
  context,
}) => {
  const v2 = version('2');
  const errors = watchErrors(page);
  const { game, sleeping, loads } = await openGame(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  expect(loads()).toBe(0); // eine wartende Fassung allein lädt nichts neu
  // Ins Bett (wie Hineinlaufen): Schlaflied, Nacht, gespeichert – danach übernimmt das Spiel die wartende Fassung
  await game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
  await expect.poll(sleeping).toBe(true);
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  await expect(game).toHaveClass(/ready/);
  expect(await sleeping()).toBe(true);
  await expect(page.locator('dialog.mw-info')).not.toHaveAttribute('open');
  // Fassung 2 aktiv, alter Cache weg (keine andere Spielseite offen)
  await expect.poll(() => registration(page)).toEqual({ waiting: null, active: 'activated' });
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  // Kein zweites Neuladen
  await page.waitForTimeout(6000);
  expect(loads()).toBe(1);
  expect(await sleeping()).toBe(true);
  expect(errors).toEqual([]);
});

test('App-Update: weckt das Kind die Figur zwischen Bitte und Übernahme, wird erst beim nächsten Schlafen neu geladen', async ({
  page,
  context,
}) => {
  // Die Bitte um skipWaiting wird angehalten, bis der Test sie freigibt: So weckt das Kind die Figur sicher genau
  // zwischen Bitte und Übernahme, auch wenn der Rechner langsam ist
  await page.addInitScript(() => {
    const post = Object.getOwnPropertyDescriptor(ServiceWorker.prototype, 'postMessage')!.value as (
      this: ServiceWorker,
      ...args: unknown[]
    ) => void;
    const w = window as unknown as { skipAsked?: boolean; releaseSkip?: () => void };
    ServiceWorker.prototype.postMessage = function (this: ServiceWorker, ...args: unknown[]) {
      if ((args[0] as { type?: string } | null)?.type !== 'skip-waiting') return post.apply(this, args);
      w.skipAsked = true;
      w.releaseSkip = () => post.apply(this, args);
    } as ServiceWorker['postMessage'];
  });
  const [v1, v2] = [version('1'), version('2')];
  const errors = watchErrors(page);
  const { game, sleeping, loads } = await openGame(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  await game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
  await expect.poll(sleeping).toBe(true);
  // Nach dem Ritual: Bitte, das Kind weckt die Figur, dann übernimmt Fassung 2 – aber die Seite lädt nicht neu
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { skipAsked?: boolean }).skipAsked === true), {
      timeout: 30_000,
    })
    .toBe(true);
  // Kurz nach dem Einschlafen weckt Drücken noch nicht (SLEEP_LOCK zählt Spiel-Takte, die auf langsamen Rechnern
  // länger dauern): drücken, bis die Figur wach ist
  await expect
    .poll(
      async () => {
        await page.keyboard.press('ArrowDown');
        return sleeping();
      },
      { timeout: 30_000 },
    )
    .toBe(false);
  await page.evaluate(() => (window as unknown as { releaseSkip: () => void }).releaseSkip());
  await expect.poll(() => registration(page)).toEqual({ waiting: null, active: 'activated' });
  await page.waitForTimeout(3000);
  expect(loads()).toBe(0);
  expect(await sleeping()).toBe(false);
  // Die Seite läuft noch mit Fassung 1: Ihr alter Cache bleibt, ihr altes Three.js kommt auch ohne Netz
  expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
  await context.setOffline(true);
  expect(await fetchBytes(page, v1.chunk)).toBe(v1.chunkBytes);
  await context.setOffline(false);
  // Wieder ins Bett: nach dem Ritual einmal neu geladen, in die Nacht
  await game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
  await expect.poll(sleeping).toBe(true);
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  await expect(game).toHaveClass(/ready/);
  expect(await sleeping()).toBe(true);
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  await page.waitForTimeout(6000);
  expect(loads()).toBe(1);
  expect(errors).toEqual([]);
});

test('App-Update: zurück nach langer Pause, das Spiel schläft noch – die neue Fassung kommt', async ({
  page,
  context,
}) => {
  const v2 = version('2');
  const errors = watchErrors(page);
  const { sleeping, loads } = await openGame(page);
  await goLive(context);
  await page.waitForTimeout(4500); // die Figur schläft seit dem Laden länger als das Ritual
  await longPause(page);
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  expect(await sleeping()).toBe(true);
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  expect(errors).toEqual([]);
});

test('App-Update: neu laden von Hand (Cmd+R, Strg+R, F5) bringt die wartende Fassung, das Spiel schläft', async ({
  page,
  context,
}) => {
  const v2 = version('2');
  const errors = watchErrors(page);
  const { sleeping, loads } = await openGame(page);
  await page.keyboard.press('ArrowDown'); // gespielt …
  await expect.poll(sleeping).toBe(false);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  await page.reload(); // … dann von Hand neu geladen: Die Seite übernimmt die wartende Fassung und lädt einmal neu
  await expect.poll(loads, { timeout: 30_000 }).toBe(2);
  await expect.poll(() => registration(page)).toEqual({ waiting: null, active: 'activated' });
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  expect(await sleeping()).toBe(true);
  expect(errors).toEqual([]);
});

test('App-Update: mitten im Spiel wird nie neu geladen, die neue Fassung wartet', async ({ page, context }) => {
  const errors = watchErrors(page);
  const { sleeping, loads } = await openGame(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  // Auslöser wie beim Einschlafen und nach langer Pause – aber die Figur ist wach
  await page.evaluate(() => document.dispatchEvent(new Event('mitwachsen-sleep')));
  await longPause(page);
  await page.waitForTimeout(6000);
  expect(loads()).toBe(0);
  expect(await sleeping()).toBe(false);
  expect(await registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  expect(errors).toEqual([]);
});

test('App-Update: ein zweiter, alter Tab spielt ungestört weiter und bekommt sein altes Three.js bis zuletzt', async ({
  page,
  context,
}) => {
  const [v1, v2] = [version('1'), version('2')];
  const errors = watchErrors(page);
  const a = await openGame(page);
  const other = await context.newPage();
  const otherErrors = watchErrors(other);
  const b = await openGame(other, false);
  await other.keyboard.press('ArrowDown');
  await expect.poll(b.sleeping).toBe(false);
  await page.keyboard.press('ArrowDown');
  await expect.poll(a.sleeping).toBe(false);
  await goLive(context);
  await a.game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
  await expect.poll(a.loads, { timeout: 30_000 }).toBe(1);
  // Der Tab, der schlafen ging, hat die neue Fassung; der andere spielt weiter und lädt nicht neu
  expect(b.loads()).toBe(0);
  expect(await b.sleeping()).toBe(false);
  // Der alte Cache bleibt, solange der andere Tab offen ist: Er holt sein altes Three.js auch ohne Netz,
  // obwohl Fassung 2 ihn jetzt steuert und der Server die Datei nicht mehr hat
  expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
  await context.setOffline(true);
  expect(await fetchBytes(other, v1.chunk)).toBe(v1.chunkBytes);
  await context.setOffline(false);
  // … und geht, sobald eine Spielseite allein offen ist und sich meldet
  await other.close();
  await page.reload();
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  expect([...errors, ...otherErrors]).toEqual([]);
});
