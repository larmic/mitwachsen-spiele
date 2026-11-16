// Smoke-Test im Browser (Guard-Gate nach dem Build): Die fertige Seite aus dist/ wird ausgeliefert und in Chromium
// geöffnet. Prüft, was statische Gates nicht sehen: dass Seiten und Spiel laufen, ohne Fehler in der Konsole.
// Einmalig lokal: npx playwright install chromium
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Zweite Fassung der Seite für den Test der App-Updates, abgeleitet aus dist/ (e2e/versions.ts)
  globalSetup: './e2e/versions.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node e2e/serve.ts', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
});
