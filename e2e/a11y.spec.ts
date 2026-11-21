// Barrierefreiheit der fertigen Seite: axe-core prüft jede Seite nach WCAG 2.2 A/AA.
// Das Gate fällt bei jedem Verstoß; die Liste nennt Regel, Wirkung und betroffene Elemente.
// Geprüft wird die ruhende Seite (reduzierte Bewegung): Mitten im Einblenden misst axe Mischfarben als Kontrast.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return result.violations.map(
    (v) => `${v.impact}: ${v.id} – ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}

for (const path of ['/', '/datenschutz/', '/gibt-es-nicht/'])
  test(`Barrierefrei: ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(await violations(page)).toEqual([]);
  });

test('Barrierefrei: Spiel mit Hinweis für Eltern und danach', async ({ page }) => {
  await page.goto('/spielen/');
  await expect(page.locator('dialog.mw-info')).toHaveJSProperty('open', true);
  expect(await violations(page)).toEqual([]);
  await page.getByRole('button', { name: /Verstanden/ }).click();
  await expect(page.locator('larmic-mitwachsen')).toHaveClass(/ready/);
  expect(await violations(page)).toEqual([]);
});

test('Barrierefrei: Menü für Eltern mit den Schaltern für Ton und Kamera', async ({ page }) => {
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  await expect(page.locator('larmic-mitwachsen')).toHaveClass(/ready/);
  await page.getByRole('button', { name: 'Menü für Eltern' }).click();
  const menu = page.locator('dialog.mw-settings');
  await expect(menu).toHaveJSProperty('open', true);
  await expect(menu.getByRole('button', { name: 'Kamera bewegen: an' })).toHaveAttribute('aria-pressed', 'true');
  expect(await violations(page)).toEqual([]);
  await menu.getByRole('button', { name: 'Kamera bewegen: an' }).click();
  await expect(menu.getByRole('button', { name: 'Kamera bewegen: aus' })).toHaveAttribute('aria-pressed', 'false');
  expect(await violations(page)).toEqual([]);
});

test('Barrierefrei: Startseite auf dem Handy (320 px)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  expect(await violations(page)).toEqual([]);
});

test('Barrierefrei: „Noch nicht“ am Eistor sagt die Live-Region, was fehlt', async ({ page }) => {
  type Game = {
    world: { gates: Map<string, { mid: [number, number]; out: [number, number] }> };
    state: { player: { x: number; y: number; dir: string }; sleeping: boolean; still: number; garden: unknown[] };
    apply(cmd: { type: 'tick' }): void;
    lift(): void;
  };
  await page.goto('/spielen/');
  await page.getByRole('button', { name: /Verstanden/ }).click();
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
  const say = page.locator('.mw-say');
  await expect(say).toHaveAttribute('role', 'status');
  await expect(say).toHaveText('');
  // Die Figur steht wach mitten auf der Torplatte des Eistors, auf der Wiese wohnt noch niemand: nach 1 s Stehen
  await game.evaluate((node) => {
    const el = node as unknown as Game;
    const { mid, out } = el.world.gates.get('eis')!;
    const player = { x: mid[0] - 2 * out[0], y: mid[1] - 2 * out[1], dir: 'n' };
    el.state = { ...el.state, player, sleeping: false, still: 0, garden: [] };
    el.lift();
    for (let i = 0; i < 10; i++) el.apply({ type: 'tick' });
  });
  await expect(say).toHaveText('Noch nicht. Es fehlt noch: Hase');
  expect(await violations(page)).toEqual([]);
});
