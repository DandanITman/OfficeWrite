import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  typeInEditor,
  editorParagraph,
  switchRibbonTab,
  clickRibbon,
  expectRibbonActive,
  acceptAppDialogs,
} from '../helpers/playwright';

/**
 * The ribbon must reflect the formatting at the caret.
 *
 * This is the defect that made the app feel broken: ribbon state was computed
 * during App's render, and App re-rendered only when document *content*
 * changed. A selection-only transaction - moving the caret, clicking an image -
 * updated nothing, so Bold stayed lit after leaving bold text and the font
 * dropdowns showed whatever was true at the last edit.
 *
 * Every test here moves the caret with arrow keys and never edits, so it fails
 * if ribbon state stops tracking selection.
 */
test.describe('Ribbon tracks the caret', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await openBlankDocument(page);
  });

  test('TC-RIB-001: bold state follows the caret in and out of bold text', async ({ page }) => {
    // "plainbold" in one paragraph, the last four characters bold.
    await typeInEditor(page, 'plain');
    await clickRibbon(page, 'home', 'ribbon-bold');
    await typeInEditor(page, 'bold');
    await expectRibbonActive(page, 'ribbon-bold', true);

    // Walk back through the bold word, then into the plain word. No edits.
    // Each stop is strictly *inside* a run: on the boundary between them the
    // answer is genuinely ambiguous (the caret inherits the marks of the
    // character before it), so asserting there would test nothing.
    await editorParagraph(page, 0).click();
    await page.keyboard.press('End');
    for (let i = 0; i < 2; i += 1) await page.keyboard.press('ArrowLeft');
    await expectRibbonActive(page, 'ribbon-bold', true);

    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowLeft');
    await expectRibbonActive(page, 'ribbon-bold', false);

    // And forward again into the bold run.
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
    await expectRibbonActive(page, 'ribbon-bold', true);
  });

  test('TC-RIB-002: italic and underline states follow the caret', async ({ page }) => {
    await typeInEditor(page, 'normal ');
    await clickRibbon(page, 'home', 'ribbon-italic');
    await clickRibbon(page, 'home', 'ribbon-underline');
    await typeInEditor(page, 'fancy');

    await expectRibbonActive(page, 'ribbon-italic', true);
    await expectRibbonActive(page, 'ribbon-underline', true);

    await editorParagraph(page, 0).click();
    await page.keyboard.press('Home');
    await expectRibbonActive(page, 'ribbon-italic', false);
    await expectRibbonActive(page, 'ribbon-underline', false);
  });

  test('TC-RIB-003: alignment state follows the caret between paragraphs', async ({ page }) => {
    await typeInEditor(page, 'left aligned');
    await page.keyboard.press('Enter');
    await page.keyboard.type('centred');
    await clickRibbon(page, 'home', 'ribbon-align-center');
    await expectRibbonActive(page, 'ribbon-align-center', true);

    // Up into the first paragraph - selection only.
    await editorParagraph(page, 1).click();
    await page.keyboard.press('ArrowUp');
    await expectRibbonActive(page, 'ribbon-align-center', false);

    await page.keyboard.press('ArrowDown');
    await expectRibbonActive(page, 'ribbon-align-center', true);
  });

  test('TC-RIB-004: list state follows the caret', async ({ page }) => {
    await typeInEditor(page, 'plain line');
    await page.keyboard.press('Enter');
    await page.keyboard.type('bulleted line');
    await clickRibbon(page, 'home', 'ribbon-bullet-list');
    await expectRibbonActive(page, 'ribbon-bullet-list', true);

    // The bulleted line is now a list item, so it is no longer a top-level
    // paragraph - click it where it lives.
    await page.getByTestId('word-editor').locator('li p').first().click();
    await page.keyboard.press('ArrowUp');
    await expectRibbonActive(page, 'ribbon-bullet-list', false);
  });

  test('TC-RIB-005: the font size dropdown shows the size at the caret', async ({ page }) => {
    await typeInEditor(page, 'small');
    await page.keyboard.press('Enter');
    await page.keyboard.type('large');

    // Only the second line gets the larger size.
    await editorParagraph(page, 1).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Home');
    await switchRibbonTab(page, 'home');
    await page.getByTestId('ribbon-font-size').fill('24');
    await page.getByTestId('ribbon-font-size').press('Enter');

    await expect(page.getByTestId('ribbon-font-size')).toHaveValue('24');

    // Move up into the untouched line: the dropdown must fall back.
    await editorParagraph(page, 1).click();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('ribbon-font-size')).not.toHaveValue('24');
  });

  test('TC-RIB-006: picture tools appear when an image is selected', async ({ page }) => {
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.seedBinaryFile(
        'C:\\OfficewriteTest\\photo.png',
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      );
      window.__OFFICEWRITE_TEST__?.setOpenImageFileResult('C:\\OfficewriteTest\\photo.png');
    });

    await switchRibbonTab(page, 'insert');
    await expect(page.getByTestId('ribbon-tab-pictureFormat')).toHaveCount(0);

    await page.getByTestId('ribbon-pictures').click();
    await page.getByTestId('word-editor').locator('img').waitFor({ state: 'visible' });

    // Selecting an image changes no content, so this group never appeared
    // before ribbon state tracked every transaction.
    await page.locator('.image-block').click({ force: true });
    await expect(page.getByTestId('ribbon-tab-pictureFormat')).toBeVisible();
    await switchRibbonTab(page, 'pictureFormat');
    await expect(page.getByTestId('picture-align-center')).toBeVisible();
  });

  test('TC-RIB-007: undo and redo enablement follows the history', async ({ page }) => {
    await switchRibbonTab(page, 'home');
    await expect(page.getByTestId('ribbon-undo')).toBeDisabled();
    await expect(page.getByTestId('ribbon-redo')).toBeDisabled();

    await typeInEditor(page, 'something');
    await switchRibbonTab(page, 'home');
    await expect(page.getByTestId('ribbon-undo')).toBeEnabled();

    await page.getByTestId('ribbon-undo').click();
    await switchRibbonTab(page, 'home');
    await expect(page.getByTestId('ribbon-redo')).toBeEnabled();

    await page.getByTestId('ribbon-redo').click();
    await expect(page.getByTestId('word-editor')).toContainText('something');
  });
});
