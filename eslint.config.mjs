import js from '@eslint/js';
import globals from 'globals';

// Pliki gry to zwykłe skrypty (bez modułów) ładowane po kolei w index.html – współdzielą zmienne globalne,
// dlatego no-undef jest wyłączone, a no-unused-vars pilnuje tylko zmiennych lokalnych.
export default [
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    files: ['js/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } },
  },
  {
    files: ['tests/**/*.mjs', '*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    // kod wykonywany w przeglądarce przez page.evaluate – odwołuje się do zmiennych gry
    files: ['tests/**/*.spec.mjs'],
    rules: { 'no-undef': 'off' },
  },
];
