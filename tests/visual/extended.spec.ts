import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  loadRegressionFixture,
  loadHeadingFixture,
  openFindReplace,
  switchRibbonTab,
  openBackstage,
  visualMaskLocators,
  attachRecipientList,
  insertMergeFieldFor,
} from '../helpers/playwright';

test.describe('Extended visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState(page);
  });

  // 'file' is a dropdown, not a panel, so it has no ribbon screenshot.
  for (const tab of [
    'home',
    'insert',
    'pageLayout',
    'references',
    'mailings',
    'review',
    'view',
    'help',
  ] as const) {
    test(`TC-VIS-004: ribbon ${tab} tab`, async ({ page }) => {
      await openBlankDocument(page);
      await page.getByTestId(`ribbon-tab-${tab}`).click();
      await expect(page.getByTestId('ribbon')).toHaveScreenshot(`ribbon-${tab}.png`, {
        mask: visualMaskLocators(page),
      });
    });
  }

  /**
   * Mailings with a list attached.
   *
   * The greyed-out tab is already covered by the loop above, and that is the
   * state a user sees for about ten seconds. This is the one they work in: every
   * control live, and the record navigator counting.
   */
  test('mailings tab with a recipient list attached', async ({ page }) => {
    await openBlankDocument(page);
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'First Name');
    await page.getByTestId('mailings-preview-results').click();
    await expect(page.getByTestId('ribbon')).toHaveScreenshot('ribbon-mailings-active.png', {
      mask: visualMaskLocators(page),
    });
  });

  /**
   * The template gallery, which is the page the previews exist for. Guards the
   * card grid as well as the previews: the cards had to grow to fit readable
   * text, and a regression to the old width would show up here first.
   */
  test('template gallery', async ({ page }) => {
    await page.getByTestId('home-nav-new').click();
    await expect(page.getByTestId('template-gallery')).toBeVisible();
    await expect(page.getByTestId('home-screen')).toHaveScreenshot('template-gallery.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('template preview dialog', async ({ page }) => {
    await page.getByTestId('home-template-preview-invoice').click();
    await expect(page.getByTestId('template-preview-dialog')).toHaveScreenshot(
      'template-preview-dialog.png',
      { mask: visualMaskLocators(page) },
    );
  });

  test('backstage new pane', async ({ page }) => {
    await openBlankDocument(page);
    await openBackstage(page, 'new');
    await expect(page.getByTestId('backstage')).toHaveScreenshot('backstage-new.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('find and replace bar open', async ({ page }) => {
    await openBlankDocument(page);
    await openFindReplace(page);
    await expect(page.getByTestId('app-shell')).toHaveScreenshot('find-replace-bar.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('editor dark theme', async ({ page }) => {
    await openBlankDocument(page);
    // The theme toggle moved off the header into View > Dark Mode.
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-dark-mode').click();
    await switchRibbonTab(page, 'home');
    await expect(page.getByTestId('app-shell')).toHaveScreenshot('editor-dark.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('TC-VIEW-003: Immersive Reader layout', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-immersive-reader').click();
    await expect(page.getByTestId('app-shell')).toHaveScreenshot('immersive-reader.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('navigation pane with headings', async ({ page }) => {
    await loadHeadingFixture(page);
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-navigation').click();
    await expect(page.getByTestId('app-shell')).toHaveScreenshot('navigation-pane.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('comments pane open', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'review');
    await page.getByTestId('ribbon-comments').click();
    await expect(page.getByTestId('app-shell')).toHaveScreenshot('comments-pane.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('document with table and formatted content', async ({ page }) => {
    await loadRegressionFixture(page);
    await page.getByTestId('ribbon-tab-insert').click();
    await page.getByTestId('ribbon-table').click();
    await expect(page.getByTestId('document-canvas')).toHaveScreenshot('editor-table-content.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('backstage export section', async ({ page }) => {
    await openBlankDocument(page);
    await openBackstage(page, 'export');
    await expect(page.getByTestId('backstage')).toHaveScreenshot('backstage-export.png', {
      mask: visualMaskLocators(page),
    });
  });
});
