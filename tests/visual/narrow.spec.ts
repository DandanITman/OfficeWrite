import { test, expect } from '@playwright/test';
import { resetTestState, openBlankDocument, visualMaskLocators } from '../helpers/playwright';

test.describe('Officewrite narrow viewport', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState(page);
  });

  test('editor layout at narrow width', async ({ page }) => {
    await openBlankDocument(page);
    await expect(page.getByTestId('app-shell')).toHaveScreenshot('narrow-editor.png', {
      mask: visualMaskLocators(page),
    });
  });
});
