// Unit-Tests für die reine Logik (Würfel-Grafik, Spielregeln, Bundle- und Seiten-Gate). Kein DOM, kein Astro nötig.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // Der Runner der Pipeline ist mit Abdeckung gut dreimal langsamer als ein Entwickler-Rechner; die Simulationen
    // (tausende Takte, ganze Welten) brauchen dort mehr als die üblichen 5 s. Langsame Tests trotzdem billig halten.
    testTimeout: 15_000,
    // Abdeckung nur für die reinen Module – Web Components, Canvas und Three.js prüft der Browser-Test (e2e/)
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**/*.ts',
        'src/data/games/*.ts',
        'src/scripts/games/{input-pace,pwa-update}.ts',
        'src/scripts/games/mitwachsen-{fog,gait,growth,home,kessel,portal,save,spawns,state,tired,weather,world}.ts',
        'scripts/{bundles,dist,pwa}.ts',
      ],
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
