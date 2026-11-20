// Smoke-Test der fertigen Seite: Startseite (Weg ins Spiel, Aufbau, Handy-Breite), Rechtliches, 404 und das Spiel.
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

test('Spiel: Portal-Plattform erwacht beim Herangehen, die Mitte bringt zum Bett, runter und wieder rauf zurück', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(() => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping))
    .toBe(false);
  // Über die Felder der Komponente (wie die Regeln sie sehen): Figur auf den freien Ring vor die Plattform am
  // Tor stellen (dort erwacht sie im nächsten Takt), dann Schritt für Schritt wie mit den Pfeiltasten
  type Game = {
    world: {
      portals: Map<string, { gate: [number, number]; home: [number, number] }>;
      gates: Map<string, { out: [number, number] }>;
    };
    state: { player: { x: number; y: number; dir: string }; portals: string[]; arrived: [number, number] | null };
    apply(cmd: { type: 'move'; dir: string } | { type: 'tick' }): void;
    lift(): void; // Nebel um die Figur lichten
  };
  const r = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [id, p] = [...el.world.portals][0]!;
    const out = el.world.gates.get(id)!.out;
    const dir = (v: readonly number[]) => (v[0]! > 0 ? 'e' : v[0]! < 0 ? 'w' : v[1]! > 0 ? 's' : 'n');
    const [gx, gy] = p.gate;
    el.state = { ...el.state, player: { x: gx - out[0] * 2, y: gy - out[1] * 2, dir: 's' }, portals: [] };
    const walk = (n: number) => {
      for (let i = 0; i < n; i++) el.apply({ type: 'move', dir: dir(out) });
    };
    el.lift(); // wie nach jedem Schritt: Um die Figur lichtet sich der Nebel
    el.apply({ type: 'tick' }); // die Figur ist nah: Die Plattform erwacht
    const woke = el.state.portals.includes(id);
    walk(2); // über den Rand auf die Mitte: Reise zum Bett
    const home = [el.state.player.x, el.state.player.y].join() === p.home.join();
    const arrived = el.state.arrived?.join() === p.home.join();
    // erst runter (zurück in Richtung Tor), dann wieder rauf: zurück zum Tor
    el.apply({ type: 'move', dir: dir(out) });
    el.apply({ type: 'move', dir: dir([-out[0], -out[1]]) });
    return { woke, home, arrived, back: [el.state.player.x, el.state.player.y].join() === p.gate.join() };
  });
  expect(r).toEqual({ woke: true, home: true, arrived: true, back: true });
  expect(errors).toEqual([]);
});

test('Spiel: Gletscherkessel hinter dem Eistor wird gezeichnet (Tor im Test offen), ohne Fehler', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  if (webgl) await expect(game).toHaveClass(/three/); // gezeichnet wird in 3D
  type Game = {
    world: { homes: { eis: { bed: [number, number]; wake: [number, number][] } }; realm(x: number, y: number): string };
    state: { player: { x: number; y: number; dir: string }; openGates: string[]; sleeping: boolean; wokeAt: number };
    apply(cmd: { type: 'move'; dir: string } | { type: 'tick' }): void;
    lift(): void;
  };
  /** Einige Bilder abwarten */
  const frames = (n: number) =>
    page.evaluate(
      (count) =>
        new Promise<void>((done) => {
          let left = count;
          const next = () => (--left <= 0 ? done() : requestAnimationFrame(next));
          requestAnimationFrame(next);
        }),
      n,
    );
  // Über die Komponente (wie die Regeln es sehen): Tor offen, die Figur steht wach neben dem Schneebett
  const realm = await game.evaluate((node) => {
    const el = node as unknown as Game;
    const [x, y] = el.world.homes.eis.wake[0]!;
    el.state = { ...el.state, openGates: ['eis'], sleeping: false, wokeAt: -100, player: { x, y, dir: 'n' } };
    el.lift();
    return el.world.realm(x, y);
  });
  expect(realm).toBe('eis');
  await frames(30);
  // ein paar Schritte durch den Kessel, dann ins Schneebett (der Schläfer liegt jetzt dort)
  await game.evaluate((node) => {
    const el = node as unknown as Game;
    for (const dir of ['s', 's', 'e', 'n', 'n', 'w']) el.apply({ type: 'move', dir });
    const [bx, by] = el.world.homes.eis.bed;
    el.state = { ...el.state, player: { x: bx + 1, y: by, dir: 'w' }, wokeAt: -100 };
    el.apply({ type: 'move', dir: 'w' });
  });
  await frames(30);
  expect(await game.evaluate((el) => (el as unknown as Game).state.sleeping)).toBe(true);
  expect(errors).toEqual([]);
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
    await page.goto('/spielen/');
    const text = await page.locator('larmic-mitwachsen noscript').textContent();
    expect(text).toContain('Dieses Spiel für Dreijährige braucht JavaScript');
    expect(text).toContain('Wie viel Bildschirm?');
  });
});
