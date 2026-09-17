import { test, expect } from '@playwright/test';
import { version } from '../../apps/desktop/package.json';
import { launchApp, type LaunchedApp } from './helpers';

const API_URL = 'https://api.github.com/repos/DandanITman/OfficeWrite/releases/latest';
const REPO_URL = 'https://github.com/DandanITman/OfficeWrite';
let launched: LaunchedApp;

function release(tag = `v${version}`) {
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: [{
      name: 'Officewrite.Setup.exe',
      state: 'uploaded',
      browser_download_url: `${REPO_URL}/releases/download/${tag}/Officewrite.Setup.exe`,
    }],
  };
}

interface ServiceOptions {
  online?: boolean;
  body?: unknown;
  status?: number;
  failure?: 'network' | 'timeout';
  delay?: number;
}

interface ServiceState {
  requests: string[];
  links: string[];
  aborted: boolean;
}

/** Replace the remote service only; clicks still traverse React, preload and IPC. */
async function installService(options: ServiceOptions = {}) {
  await launched.app.evaluate(({ net, shell }, config) => {
    const state: ServiceState = { requests: [], links: [], aborted: false };
    (globalThis as unknown as { updateService: ServiceState }).updateService = state;
    net.isOnline = () => config.online ?? true;
    net.fetch = async (input, init) => {
      state.requests.push(String(input));
      if (config.failure === 'network') throw new Error('Connection unavailable');
      if (config.failure === 'timeout') {
        return new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            state.aborted = true;
            reject(new Error('Request aborted'));
          }, { once: true });
        });
      }
      if (config.delay) await new Promise(resolve => setTimeout(resolve, config.delay));
      return new Response(JSON.stringify(config.body), {
        status: config.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    shell.openExternal = async url => { state.links.push(url); };
  }, { body: release(), ...options });
}

async function serviceState() {
  return launched.app.evaluate(() => (globalThis as unknown as { updateService: ServiceState }).updateService);
}

test.beforeEach(async () => {
  launched = await launchApp();
});

test.afterEach(async () => {
  await launched?.close();
});

test('About has a readable white card in both themes and checks only on request', async ({}, testInfo) => {
  await installService();
  const page = launched.window;
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await page.getByTestId('home-about').click();
    const about = page.getByTestId('about-dialog');
    await expect(about).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(about).toHaveCSS('color', 'rgb(55, 65, 81)');
    await expect(about).toContainText(`Version ${version}`);
    await expect(page.getByTestId('about-check-updates')).toBeEnabled();
    await expect(about).toBeInViewport();
    await about.screenshot({ path: testInfo.outputPath(`about-${theme}.png`) });
    await page.keyboard.press('Escape');
    await expect(about).toBeHidden();
  }
  expect((await serviceState()).requests).toEqual([]);
});

test('a newer release spins the arrows, offers its trusted page and reuses a recent check', async () => {
  // 0.10.0 must compare newer than 0.6.3 numerically, not alphabetically.
  const [major, minor] = version.split('.').map(Number);
  const newerVersion = `${major}.${Math.max(10, minor + 1)}.0`;
  await installService({ body: { ...release(`v${newerVersion}`), html_url: 'https://untrusted.invalid' }, delay: 500 });
  const page = launched.window;
  await page.getByTestId('home-about').click();
  const check = page.getByTestId('about-check-updates');
  await check.click();
  await expect(check).toBeDisabled();
  await expect(check.locator('svg')).toHaveClass(/about-update-spinning/);
  await expect(page.getByTestId('about-update-status')).toHaveText(`Officewrite ${newerVersion} is available.`);
  await expect(check).toBeEnabled();
  await expect(check.locator('svg')).not.toHaveClass(/about-update-spinning/);
  await page.getByTestId('about-view-release').click();
  await expect.poll(async () => (await serviceState()).links).toEqual([`${REPO_URL}/releases/tag/v${newerVersion}`]);
  await check.click();
  await expect(page.getByTestId('about-update-status')).toContainText('is available');
  expect((await serviceState()).requests).toEqual([API_URL]);
});

for (const tag of [`v${version}`, 'v0.0.0']) {
  test(`release ${tag} does not offer an unnecessary update`, async () => {
    await installService({ body: release(tag) });
    const page = launched.window;
    await page.getByTestId('home-about').click();
    await page.getByTestId('about-check-updates').click();
    await expect(page.getByTestId('about-update-status')).toHaveText('You have the latest available version.');
    await expect(page.getByTestId('about-view-release')).toHaveCount(0);
  });
}

test('offline renderer disables the check, reconnects without checking, and permits a manual retry', async ({}, testInfo) => {
  await installService();
  const page = launched.window;
  await page.getByTestId('home-about').click();
  await page.context().setOffline(true);
  await expect(page.getByTestId('about-check-updates')).toBeDisabled();
  await expect(page.getByTestId('about-update-status')).toContainText("You're offline");
  await page.getByTestId('about-dialog').screenshot({ path: testInfo.outputPath('about-offline.png') });
  expect((await serviceState()).requests).toEqual([]);
  await page.context().setOffline(false);
  await expect(page.getByTestId('about-check-updates')).toBeEnabled();
  expect((await serviceState()).requests).toEqual([]);
  await page.getByTestId('about-check-updates').click();
  await expect(page.getByTestId('about-update-status')).toContainText('latest available version');
});

test('the main process skips the request when Windows reports offline', async () => {
  await installService({ online: false });
  const page = launched.window;
  await page.getByTestId('home-about').click();
  await page.getByTestId('about-check-updates').click();
  await expect(page.getByTestId('about-update-status')).toContainText("You're offline");
  expect((await serviceState()).requests).toEqual([]);
});

test('connection failures can be retried without blocking the app', async () => {
  await installService({ failure: 'network' });
  const page = launched.window;
  await page.getByTestId('home-about').click();
  await page.getByTestId('about-check-updates').click();
  await expect(page.getByTestId('about-update-status')).toContainText("Couldn't reach the update service");
  await expect(page.getByTestId('about-check-updates')).toBeEnabled();
  await installService();
  await page.getByTestId('about-check-updates').click();
  await expect(page.getByTestId('about-update-status')).toContainText('latest available version');
});

test('unresponsive requests are aborted after the timeout and the button recovers', async () => {
  await installService({ failure: 'timeout' });
  const page = launched.window;
  await page.getByTestId('home-about').click();
  await page.getByTestId('about-check-updates').click();
  await expect(page.getByTestId('about-update-status')).toContainText('Checking for updates');
  await expect(page.getByTestId('about-update-status')).toContainText("Couldn't reach the update service", { timeout: 12_000 });
  await expect(page.getByTestId('about-check-updates')).toBeEnabled();
  expect((await serviceState()).aborted).toBe(true);
});

test('rate limits and incomplete or prerelease metadata never report an available update', async () => {
  const page = launched.window;
  await page.getByTestId('home-about').click();
  await installService({ status: 429 });
  await page.getByTestId('about-check-updates').click();
  await expect(page.getByTestId('about-update-status')).toContainText('too many update checks');
  for (const body of [
    { ...release('v99.0.0'), draft: true },
    { ...release('v99.0.0'), prerelease: true },
    { ...release('v99.0.0'), assets: [] },
    { ...release('v99.0.0'), tag_name: 'not-a-version' },
  ]) {
    await installService({ body });
    await page.getByTestId('about-check-updates').click();
    await expect(page.getByTestId('about-update-status')).toContainText("Couldn't reach the update service");
    await expect(page.getByTestId('about-view-release')).toHaveCount(0);
  }
});
