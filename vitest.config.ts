// Unit-Tests für die reine Logik (Würfel-Grafik, Spielregeln, Bundle- und Seiten-Gate). Kein DOM, kein Astro nötig.
import { defineConfig } from 'vitest/config';
import { budgetMs, calibrate } from './scripts/test-budget.ts';

// Zeitbudget je Test (scripts/test-budget.ts): Die Pipeline ist bis gut 4-mal langsamer als ein Entwickler-Rechner
// (gemessen 11/2026). Eine feste Grenze für beide fiel lokal nie auf und riss in der Pipeline bei jedem Push einen
// anderen Test. Darum gilt die enge Grenze lokal (npm test, pre-commit): 4 s auf dem Bezugsrechner, relativ zur
// Geschwindigkeit dieses Rechners, ohne Abdeckung entsprechend weniger. 4 s × 4 ≈ 16 s; die Grenze der Pipeline (60 s)
// lässt mehr als das Dreifache Luft und fängt nur noch Hänger ab. Hooks (Welten vorab bauen) bekommen lokal das
// Zehnfache des Budgets, ohne eigene Frist im Test. Wird ein Test zu langsam: in Abschnitte teilen (`it.each` über Seed-Bereiche), Welten über
// `worldOf`/`bareOf` (test-worlds.ts), kein `expect` in Schleifen je Takt oder Feld.
const CI = !!process.env.CI;
const coverage = process.argv.includes('--coverage');
const calib = calibrate();
const budget = budgetMs(calib, coverage);
// in der Pipeline sichtbar: Stimmt der Faktor zum Bezugsrechner (REF in scripts/test-budget.ts)?
if (CI) console.log(`::notice title=Zeitbudget::Kalibrierung ${calib.toFixed(0)} ms, Budget lokal wäre ${budget} ms`);

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    testTimeout: CI ? 60_000 : budget,
    hookTimeout: CI ? 120_000 : 10 * budget,
    // Tests, die sich dem Budget nähern, markiert der Bericht
    slowTestThreshold: CI ? 15_000 : Math.round(budget / 2),
    // Lokal die Hälfte der Kerne: weniger Rauschen durch viele Worker (und Effizienzkerne)
    maxWorkers: CI ? undefined : '50%',
    // Abdeckung nur für die reinen Module – Web Components, Canvas und Three.js prüft der Browser-Test (e2e/)
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**/*.ts',
        'src/data/games/**/*.ts',
        'src/scripts/games/{input-pace,pwa-update}.ts',
        'src/scripts/games/mitwachsen-{air,behind,border,chores,fog,free,gait,growth,guide,home,meadow,pack,packs,portal,save,scatter,spawns,state,tired,travel,view,view-3d,weather,wild,world}.ts',
        'src/scripts/games/worlds/*/*.ts',
        'scripts/{bundles,dist,pwa,test-budget}.ts',
      ],
      // Zeichnen auf dem Canvas in den Welt-Paketen (Wetter, Bild der Weltgrenze) prüft der Browser-Test
      exclude: ['src/scripts/games/worlds/*/mitwachsen-{ice-sky,border-view}.ts'],
      reporter: [['text', { skipFull: true }], 'text-summary'],
      // Knapp unter dem gemessenen Stand: Sinkt die Abdeckung, fällt das Gate. Steigt sie, die Schwellen mitziehen.
      thresholds: {
        statements: 92,
        branches: 89,
        functions: 91,
        lines: 92,
        // Die Spielregeln enger
        'src/scripts/**/*.ts': { statements: 95, branches: 86, functions: 95, lines: 95 },
      },
    },
  },
});
