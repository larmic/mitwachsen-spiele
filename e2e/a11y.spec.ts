// Barrierefreiheit des Spiels: axe-core prüft die Spielseite nach WCAG 2.2 A/AA (die Seiten ohne Spiel: e2e/site.spec.ts).
// Das Gate fällt bei jedem Verstoß; die Liste nennt Regel, Wirkung und betroffene Elemente.
// Geprüft wird die ruhende Seite (reduzierte Bewegung): Mitten im Einblenden misst axe Mischfarben als Kontrast.
import { expect, test } from '@playwright/test';
import { gotoGame, openGame, openMenu, render, settled, ticks, violations } from './helpers';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('Barrierefrei: Spiel mit Hinweis für Eltern und danach', async ({ page }) => {
  await gotoGame(page);
  await settled(page);
  await expect(page.locator('dialog.mw-info')).toHaveJSProperty('open', true);
  expect(await violations(page)).toEqual([]);
  await page.getByRole('button', { name: /Verstanden/ }).click();
  await expect(page.locator('dialog.mw-info')).toHaveJSProperty('open', false);
  expect(await violations(page)).toEqual([]);
});

// Je Zustand des Schalters ein Test: Laden, Menü und zwei Prüfungen mit axe sprengten auf dem Runner die 30 s eines Tests
test('Barrierefrei: Menü für Eltern mit den Schaltern für Ton, Kamera und Höhle', async ({ page }) => {
  await openGame(page, { clock: true });
  const menu = await openMenu(page);
  await expect(menu.getByRole('button', { name: 'Kamera bewegen: an' })).toHaveAttribute('aria-pressed', 'true');
  await expect(menu.getByRole('button', { name: 'Höhle dunkel: an' })).toHaveAttribute('aria-pressed', 'true');
  expect(await violations(page)).toEqual([]);
});

test('Barrierefrei: Menü für Eltern, Schalter „Kamera bewegen“ und „Höhle dunkel“ umgelegt', async ({ page }) => {
  await openGame(page, { clock: true });
  const menu = await openMenu(page);
  await menu.getByRole('button', { name: 'Kamera bewegen: an' }).click();
  await expect(menu.getByRole('button', { name: 'Kamera bewegen: aus' })).toHaveAttribute('aria-pressed', 'false');
  await menu.getByRole('button', { name: 'Höhle dunkel: an' }).click();
  await expect(menu.getByRole('button', { name: 'Höhle dunkel: aus' })).toHaveAttribute('aria-pressed', 'false');
  expect(await violations(page)).toEqual([]);
});

test('Barrierefrei: „Noch nicht“ am Eistor sagt die Live-Region, was fehlt', async ({ page }) => {
  type Game = {
    world: { gates: Map<string, { mid: [number, number]; out: [number, number] }> };
    state: { player: { x: number; y: number; dir: string }; sleeping: boolean; still: number; garden: unknown[] };
    lift(): void;
  };
  const game = await openGame(page, { clock: true });
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
  });
  await ticks(page, 10);
  // Gezeigt wird je Bild, Bild und Ton kommen beim ersten Mal nach (mitwachsen-hint-look.ts)
  await expect
    .poll(async () => {
      await render(page);
      return say.textContent();
    })
    .toBe('Noch nicht. Es fehlt noch: Hase');
  expect(await violations(page)).toEqual([]);
});
