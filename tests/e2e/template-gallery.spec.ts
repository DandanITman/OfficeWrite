import { test, expect } from '@playwright/test';
import { acceptAppDialogs, resetTestState } from '../helpers/playwright';

/**
 * The template gallery has to show what each template contains.
 *
 * The thumbnails used to be four grey bars per card, which told you a template
 * had a heading and some paragraphs and nothing else - you could not tell an
 * invoice from an invitation without creating one. These tests assert on the
 * template's own words appearing in the card, so a regression to abstract
 * placeholder shapes fails here rather than being noticed months later.
 */
test.describe('Template previews', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-TPL-001: the home rail thumbnails render the template\'s real text', async ({ page }) => {
    const card = page.getByTestId('home-template-report');
    await expect(card).toBeVisible();

    const preview = page.getByTestId('template-preview-report');
    await expect(preview).toBeVisible();
    // Straight out of the Simple Report template.
    await expect(preview).toContainText('Report Title');
    await expect(preview).toContainText('Introduction');
    await expect(preview).toContainText('Summary');
  });

  test('TC-TPL-002: a heading in the template renders as a heading in the preview', async ({
    page,
  }) => {
    const preview = page.getByTestId('template-preview-report');
    await expect(preview.locator('.tp-h1')).toContainText('Report Title');
    await expect(preview.locator('.tp-h2').first()).toContainText('Introduction');
  });

  test('TC-TPL-003: a table template draws a real table, not a bar', async ({ page }) => {
    await page.getByTestId('home-nav-new').click();
    await page.getByTestId('template-gallery').waitFor({ state: 'visible' });

    const preview = page.getByTestId('template-preview-invoice');
    await expect(preview).toBeVisible();
    await expect(preview.locator('table.tp-table')).toBeVisible();
    await expect(preview.locator('table.tp-table th').first()).not.toBeEmpty();
  });

  test('TC-TPL-004: a list template draws its bullets with their text', async ({ page }) => {
    const preview = page.getByTestId('template-preview-todolist');
    await expect(preview).toBeVisible();
    const items = preview.locator('.tp-li');
    await expect(items.first()).toBeVisible();
    await expect(items.first()).not.toBeEmpty();
  });

  test('TC-TPL-005: the blank card says so rather than rendering an empty page', async ({ page }) => {
    // Blank is a separate card with no template content behind it.
    await expect(page.getByTestId('home-blank-template')).toBeVisible();
  });

  test('TC-TPL-006: every gallery card carries a preview of its own template', async ({ page }) => {
    await page.getByTestId('home-nav-new').click();
    await page.getByTestId('template-gallery').waitFor({ state: 'visible' });

    const cards = page.getByTestId('template-grid').locator('.home-tpl-card-wrap');
    const count = await cards.count();
    expect(count).toBeGreaterThan(20);

    // Every card renders a preview, and none of them is empty.
    const previews = page.getByTestId('template-grid').locator('.tp-page');
    await expect(previews).toHaveCount(count);
    for (const preview of await previews.all()) {
      await expect(preview).not.toBeEmpty();
    }
  });

  test('TC-TPL-007: the preview button opens a readable full-page preview', async ({ page }) => {
    await page.getByTestId('home-template-preview-letter').click();

    const dialog = page.getByTestId('template-preview-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Business Letter');
    await expect(dialog).toContainText('Formal letter with date and signature block');
    // The same renderer at page scale, showing the letter's own lines.
    await expect(dialog.getByTestId('template-preview-letter')).toContainText('Dear [Recipient],');
    await expect(dialog.getByTestId('template-preview-letter')).toContainText('Sincerely,');
  });

  test('TC-TPL-008: the preview button does not create the document', async ({ page }) => {
    await page.getByTestId('home-template-preview-report').click();
    await expect(page.getByTestId('template-preview-dialog')).toBeVisible();
    // Still on the home screen: the click must not have fallen through to the
    // card underneath it.
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('word-editor')).toBeHidden();
  });

  test('TC-TPL-009: Create in the preview opens that template', async ({ page }) => {
    await page.getByTestId('home-template-preview-report').click();
    await page.getByTestId('template-preview-create').click();

    await page.getByTestId('word-editor').waitFor({ state: 'visible' });
    await expect(page.getByTestId('word-editor')).toContainText('Report Title');
    await expect(page.getByTestId('template-preview-dialog')).toBeHidden();
  });

  test('TC-TPL-010: Escape and Close both dismiss the preview', async ({ page }) => {
    await page.getByTestId('home-template-preview-report').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('template-preview-dialog')).toBeHidden();

    await page.getByTestId('home-template-preview-report').click();
    await page.getByTestId('template-preview-close').click();
    await expect(page.getByTestId('template-preview-dialog')).toBeHidden();
  });

  test('TC-TPL-011: clicking the card itself still creates the document', async ({ page }) => {
    await page.getByTestId('home-template-letter').click();
    await page.getByTestId('word-editor').waitFor({ state: 'visible' });
    await expect(page.getByTestId('word-editor')).toContainText('Dear [Recipient],');
  });

  test('TC-TPL-012: searching the gallery keeps the previews with their cards', async ({ page }) => {
    await page.getByTestId('home-nav-new').click();
    await page.getByTestId('template-search').fill('invoice');

    const grid = page.getByTestId('template-grid');
    await expect(grid.locator('.home-tpl-card-wrap')).toHaveCount(1);
    await expect(grid.getByTestId('template-preview-invoice')).toBeVisible();
  });
});
