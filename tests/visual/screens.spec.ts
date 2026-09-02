import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  loadRegressionFixture,
  openBackstage,
  visualMaskLocators,
} from '../helpers/playwright';

test.describe('Officewrite visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState(page);
  });

  test('TC-VIS-001: home screen', async ({ page }) => {
    await expect(page.getByTestId('home-screen')).toHaveScreenshot('home-screen.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('TC-VIS-003: empty editor screen', async ({ page }) => {
    await openBlankDocument(page);
    await expect(page.getByTestId('app-shell')).toHaveScreenshot('empty-editor.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('editor with formatted regression content', async ({ page }) => {
    await loadRegressionFixture(page);
    await expect(page.getByTestId('document-canvas')).toHaveScreenshot(
      'formatted-document.png',
      {
        mask: visualMaskLocators(page),
      },
    );
  });

  test('TC-VIS-004: ribbon home tab', async ({ page }) => {
    await openBlankDocument(page);
    await page.locator('.ribbon-tab[data-tab="home"]').click();
    await expect(page.getByTestId('ribbon')).toHaveScreenshot('ribbon-home.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('document page canvas', async ({ page }) => {
    await loadRegressionFixture(page);
    await expect(page.getByTestId('document-canvas')).toHaveScreenshot('document-canvas.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('save backstage panel', async ({ page }) => {
    await openBlankDocument(page);
    await openBackstage(page, 'save');
    await expect(page.getByTestId('backstage')).toHaveScreenshot('backstage-save.png', {
      mask: visualMaskLocators(page),
    });
  });

  test('TC-VIS-002: home screen dark theme', async ({ page }) => {
    await resetTestState(page);
    await page.locator('.home-sidebar-nav.secondary button').filter({ hasText: 'Dark mode' }).click();
    await expect(page.getByTestId('home-screen')).toHaveScreenshot('home-screen-dark.png', {
      mask: visualMaskLocators(page),
    });
  });
});
