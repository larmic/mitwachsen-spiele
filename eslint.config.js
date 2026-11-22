// Lint-Gate: empfohlene Regeln für JavaScript, TypeScript und Astro. Formatierung übernimmt Prettier.
// TypeScript-Dateien laufen mit Typinformation (typbewusste Regeln, z. B. nicht abgewartete Promises,
// überflüssige Casts). Dazu Grenzen für Größe und Verschachtelung: für neuen Code die Vorgaben unten, für die großen
// Dateien von heute eigene Grenzen mit gut 5 % Luft.
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default defineConfig(
  { ignores: ['dist/', '.e2e/', '.astro/', 'node_modules/', 'test-results/', 'playwright-report/', 'coverage/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
  // Grenzen für Größe und Verschachtelung (Tests ausgenommen bei der Länge): neuer Code bleibt klein und flach
  {
    files: ['**/*.ts'],
    rules: {
      complexity: ['error', 20],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ['**/*.test.ts', 'e2e/**'], rules: { 'max-lines': 'off', 'max-lines-per-function': 'off' } },
  // Grenzen für die großen Dateien von heute: gemessen + gut 5 % (gerundet), damit nicht jede Zeile erst Platz machen
  // muss. Sie werden nicht bei jedem Schrumpfen von Hand gesenkt; angehoben wird erst, wenn weniger als 3 % Luft
  // bleiben, dann wieder auf gemessen + 5 %, mit einem Satz Begründung in der Commit-Nachricht. Was unter die Vorgabe
  // fällt, verliert seine Zeile.
  {
    files: ['src/data/games/mitwachsen.ts'],
    rules: { 'max-lines': ['error', { max: 510, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['src/scripts/games/larmic-mitwachsen.ts'],
    rules: {
      complexity: ['error', 32],
      'max-lines': ['error', { max: 792, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 90, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/scripts/games/mitwachsen-3d.ts'],
    rules: {
      complexity: ['error', 38],
      'max-lines': ['error', { max: 857, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 140, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/scripts/games/mitwachsen-map.ts'],
    rules: { 'max-lines-per-function': ['error', { max: 88, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['src/scripts/games/mitwachsen-render.ts'],
    rules: {
      complexity: ['error', 53],
      'max-lines': ['error', { max: 899, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 153, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ['src/scripts/games/mitwachsen-save.ts'], rules: { complexity: ['error', 22] } },
  {
    files: ['src/scripts/games/mitwachsen-state.ts'],
    rules: {
      complexity: ['error', 24],
      'max-lines': ['error', { max: 474, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/scripts/games/mitwachsen-world.ts'],
    rules: {
      complexity: ['error', 68],
      'max-lines': ['error', { max: 592, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 128, skipBlankLines: true, skipComments: true }],
    },
  },
  // Konfigurationsdateien laufen in Node
  { files: ['*.{js,mjs}'], languageOptions: { globals: { URL: 'readonly', process: 'readonly' } } },
  {
    files: ['*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly' } },
  },
);
