// Unit-Tests für die reine Logik (Würfel-Grafik, Spielregeln, Bundle- und Seiten-Gate). Kein DOM, kein Astro nötig.
import { defineConfig } from 'vitest/config';
import { budgetMs, calibrate } from './scripts/test-budget.ts';

// Fristen: 60 s je Test und 120 s je Hook, lokal wie in der Pipeline. Sie fangen nur Hänger ab und sind kein Maß für
// Geschwindigkeit: Eine an den Rechner kalibrierte Grenze als Fehler riss bei jeder neuen Welt einen anderen Test, je
// nach Last des Rechners. Langsam wird darum nur gemeldet: Tests über dem Budget (scripts/test-budget.ts: 4 s auf dem
// Bezugsrechner mit Abdeckung, relativ zur Geschwindigkeit dieses Rechners) markiert der Bericht. Damit die Laufzeit
// nicht mit jeder Welt wächst, laufen Eigenschafts-Tests über SAMPLE_SEEDS und REGRESSION_SEEDS (`seedsFor` in
// test-worlds.ts), die vollen Seed-Bereiche im tiefen Lauf (`npm run test:deep`, MITWACHSEN_DEEP=1, Job static der
// Pipeline und gates:ci).
// Welten kommen über `worldOf`/`bareOf` (test-worlds.ts), kein `expect` in Schleifen je Takt oder Feld.
const CI = !!process.env.CI;
const coverage = process.argv.includes('--coverage');
const calib = calibrate();
const budget = budgetMs(calib, coverage);
// in der Pipeline sichtbar: Stimmt der Faktor zum Bezugsrechner (REF in scripts/test-budget.ts)?
if (CI) console.log(`::notice title=Zeitbudget::Kalibrierung ${calib.toFixed(0)} ms, langsam ab ${budget} ms`);

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Tests über dem Budget markiert der Bericht (nur Warnung); kalibriert, also auch auf dem langsameren Runner passend
    slowTestThreshold: budget,
    // Lokal die Hälfte der Kerne: weniger Rauschen durch viele Worker (und Effizienzkerne)
    maxWorkers: CI ? undefined : '50%',
    // Abdeckung nur für die reinen Module – Web Components, Canvas und Three.js prüft der Browser-Test (e2e/)
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**/*.ts',
        'src/data/games/**/*.ts',
        'src/scripts/games/{input-pace,pwa-update}.ts',
        'src/scripts/games/mitwachsen-{air,behind,border,camera,chores,dev,dusk,fog,free,gait,growth,guide,herald,hint-look,home,meadow,pack,packs,plate,plate-toy,portal,postcard,ride-view,save,scatter,spawns,state,tired,travel,turn,turn-pace,view,view-3d,weather,wild,world}.ts',
        'src/scripts/games/worlds/*/*.ts',
        'scripts/{bundles,dist,flaky,pwa,test-budget}.ts',
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
