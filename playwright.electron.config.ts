import { defineConfig } from '@playwright/test';

/**
 * Real Electron process tests.
 *
 * The browser suite runs against a localStorage mock of the host, so nothing
 * ever executed main.ts, preload.ts, spell.ts or docImport.ts - the entire
 * Electron layer shipped with zero test coverage, and the one file that
 * claimed to cover it held three skipped `expect(true).toBe(true)` bodies.
 */
export default defineConfig({
  testDir: './tests/electron',
  fullyParallel: false,
  // Electron shares one userData directory; parallel runs would fight over it.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [['list']],
});
