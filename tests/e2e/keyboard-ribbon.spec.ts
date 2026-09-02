import { test, expect } from '@playwright/test';
import { resetTestState, openBlankDocument, switchRibbonTab, acceptAppDialogs } from '../helpers/playwright';

/**
 * The ribbon markup claimed `role="tablist"` and `role="menu"` while
 * implementing neither keyboard contract: arrow keys did nothing on the tab
 * strip, and opening a menu left focus on the button, so a keyboard user could
 * Tab straight past every item into the next control. The whole menu layer -
 * bullets, numbering, styles, margins, breaks, wrap text - was mouse-only.
 */
test.describe('Ribbon keyboard access', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await openBlankDocument(page);
  });

  test('TC-KBD-001: arrow keys move along the tab strip', async ({ page }) => {
    await switchRibbonTab(page, 'home');
    await page.locator('.ribbon-tab[data-tab="home"]').focus();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Insert');

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Layout');

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Insert');

    await page.keyboard.press('Home');
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Home');
  });

  test('TC-KBD-002: only the active tab is a tab stop', async ({ page }) => {
    await switchRibbonTab(page, 'home');
    const stops = await page
      .locator('.ribbon-tab[role="tab"]')
      .evaluateAll((tabs) => tabs.filter((t) => t.getAttribute('tabindex') === '0').length);
    expect(stops).toBe(1);
  });

  test('TC-KBD-003: opening a menu moves focus into it and arrows walk the items', async ({
    page,
  }) => {
    await switchRibbonTab(page, 'home');
    await page.getByTestId('ribbon-more-styles').click();

    const menu = page.locator('.rb-menu');
    await expect(menu).toBeVisible();

    // Focus must land inside the menu, not stay on the button.
    await expect
      .poll(async () => menu.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);

    const first = await page.evaluate(() => document.activeElement?.textContent ?? '');
    await page.keyboard.press('ArrowDown');
    const second = await page.evaluate(() => document.activeElement?.textContent ?? '');
    expect(second).not.toBe(first);

    // Escape closes and returns focus to the button that opened it.
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId('ribbon-more-styles')).toBeFocused();
  });

  test('TC-KBD-004: a menu item runs from the keyboard', async ({ page }) => {
    await page.getByTestId('word-editor').click();
    await page.keyboard.type('heading me');

    await switchRibbonTab(page, 'home');
    await page.getByTestId('ribbon-more-styles').click();
    await page.getByTestId('style-menu-heading1').focus();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('word-editor').locator('h1')).toHaveCount(1);
  });
});
