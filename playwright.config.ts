// Smoke-Test im Browser (Guard-Gate nach dem Build): Die fertige Seite aus dist/ wird ausgeliefert und in Chromium
// geöffnet. Prüft, was statische Gates nicht sehen: dass Seiten und Spiel laufen, ohne Fehler in der Konsole.
// Einmalig lokal: npx playwright install chromium
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Zweite Fassung der Seite für den Test der App-Updates, abgeleitet aus dist/ (e2e/versions.ts)
  globalSetup: './e2e/versions.ts',
  fullyParallel: true,
  // Immer 2 Worker, auch lokal: Der GitHub-Runner hat 4 vCPUs, das reale 3D-Spiel rendert dort per Software-WebGL –
  // mehr Worker teilen sich dieselben Kerne und reißen Wartezeiten. Fest statt aus os.cpus(), denn Container melden
  // alle Kerne des Wirts (18) statt ihrer Grenze, und im caige-Container stürzen mehr Worker an der Prozessgrenze ab.
  // So läuft lokal dieselbe Last wie in der Pipeline.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Notlösung, bis die Tests eine eigene Uhr haben (P1): In der Pipeline braucht das Spiel für denselben Schritt ein
  // Vielfaches. Diese Grenzen gelten auch in `npm run gates:ci` (setzt CI=1), dort aber auf 2 CPUs statt der 4 des
  // Runners – das ist der strenge Lauf: Was dort knapp wird, reißt in der Pipeline als Nächstes. Der native Lauf
  // (`npm run test:e2e`, Standard 5 s) sagt über den Runner nichts, fängt aber grobe Rückschritte auf schneller Hardware.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  // In der Pipeline zusätzlich JSON (wackelige Tests in die Zusammenfassung, scripts/flaky-summary.ts) und HTML
  // (als Artefakt hochgeladen, mit Traces der gescheiterten Versuche)
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'test-results/report.json' }], ['html', { open: 'never' }]]
    : 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node e2e/serve.ts', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
});
