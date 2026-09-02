import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Resolved from the repo root: Playwright transpiles specs to CJS, where
// import.meta is unavailable.
export const desktopRoot = path.resolve(process.cwd(), 'apps/desktop');

export interface LaunchedApp {
  app: ElectronApplication;
  window: Page;
  userDataDir: string;
  close: () => Promise<void>;
}

/**
 * Launch the real packaged main process against a throwaway userData
 * directory, so settings, recents and revision history start clean and never
 * touch the developer's own profile.
 */
export async function launchApp(args: string[] = []): Promise<LaunchedApp> {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'officewrite-e2e-'));

  const app = await electron.launch({
    args: [path.join(desktopRoot, 'dist-electron/main.js'), `--user-data-dir=${userDataDir}`, ...args],
    cwd: desktopRoot,
    env: { ...process.env, NODE_ENV: 'production', ELECTRON_ENABLE_LOGGING: '1' },
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  // The bridge is what the whole suite exists to exercise.
  await window.waitForFunction(() => typeof (globalThis as { officewrite?: unknown }).officewrite === 'object');

  return {
    app,
    window,
    userDataDir,
    close: async () => {
      // Clear the dirty flag first: the close guard is working, and a modal
      // "Save changes?" box would block the main process during teardown.
      // The guard itself is covered by its own test below.
      await window
        .evaluate(() => (globalThis as { officewrite?: { setDirty(v: boolean): Promise<boolean> } }).officewrite?.setDirty(false))
        .catch(() => undefined);
      await app.close().catch(() => undefined);
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

/** Open a blank document from the home screen. */
export async function openBlankDocument(window: Page) {
  await window.getByTestId('home-blank-template').click();
  await window.getByTestId('word-editor').waitFor({ state: 'visible' });
}

export async function typeInEditor(window: Page, text: string) {
  const editor = window.getByTestId('word-editor');
  await editor.click();
  await editor.pressSequentially(text, { delay: 5 });
}
