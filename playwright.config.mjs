import { defineConfig } from '@playwright/test';

const port = Number(process.env.TEST_PORT || 8766);

export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    // gra wybiera język z ustawień przeglądarki – testy domyślnie po polsku (angielskie mają własne ustawienie)
    locale: 'pl-PL',
    // PW_CHROMIUM – ścieżka do własnej przeglądarki (gdy zainstalowana wersja Playwrighta jest inna)
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: `PORT=${port} node tests/server.mjs`, port, reuseExistingServer: true },
});
