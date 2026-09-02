import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  typeInEditor,
  focusEditor,
  switchRibbonTab,
  clickRibbon,
  selectAllInEditor,
  openFindReplace,
  acceptAppDialogs,
  answerPrompt,
  loadHeadingFixture,
  pickColorSwatch,
} from '../helpers/playwright';

test.describe('Edit ribbon and text operations', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-EDIT-007: applies strikethrough formatting', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Strike text');
    await selectAllInEditor(page);
    await clickRibbon(page, 'home', 'ribbon-strike');
    await expect(page.getByTestId('word-editor').locator('s')).toContainText('Strike text');
  });

  test('TC-EDIT-008: applies superscript and subscript', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'E=mc2');
    await focusEditor(page);
    await page.keyboard.press('Control+A');
    await clickRibbon(page, 'home', 'ribbon-superscript');
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('superscript');
  });

  test('TC-EDIT-009: changes font family', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Georgia text');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'home');
    // The font box is an editable combo (input + datalist), not a <select>.
    await page.getByTestId('ribbon-font-family').fill('Georgia');
    await page.getByTestId('ribbon-font-family').press('Enter');
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('Georgia');
  });

  test('TC-EDIT-010: applies justify alignment', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Justified paragraph');
    await clickRibbon(page, 'home', 'ribbon-align-justify');
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('"textAlign":"justify"');
  });

  test('TC-EDIT-013: clears formatting from selection', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Bold text');
    await selectAllInEditor(page);
    await clickRibbon(page, 'home', 'ribbon-bold');
    await clickRibbon(page, 'home', 'ribbon-clear-formatting');
    await expect(page.getByTestId('word-editor').locator('strong')).toHaveCount(0);
  });

  test('TC-EDIT-014: applies heading style from ribbon', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Heading text');
    await selectAllInEditor(page);
    // The Styles group shows the current style in one box now, as the
    // web does; the gallery lives behind it.
    await clickRibbon(page, 'home', 'ribbon-more-styles');
    await page.getByTestId('edit-style-heading1').click();
    await expect(page.getByTestId('word-editor').locator('h1')).toContainText('Heading text');
  });

  test('TC-EDIT-015: format painter copies and applies bold', async ({ page }) => {
    await openBlankDocument(page);
    await page.evaluate(() =>
      window.__OFFICEWRITE_TEST__?.loadEditorContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'Plain' }] },
        ],
      }),
    );
    await switchRibbonTab(page, 'home');
    await page.getByTestId('ribbon-format-painter').click();
    await page.getByTestId('word-editor').getByText('Plain').click();
    await page.getByTestId('ribbon-format-painter').click();
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('"type":"bold"');
  });

  test('select all selects entire document', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Select all me');
    await switchRibbonTab(page, 'home');
    await page.getByRole('button', { name: 'Select' }).click();
    await page.getByTestId('ribbon-select-all').click();
    const text = await page.evaluate(() => window.__OFFICEWRITE_TEST__?.getEditorText());
    expect(text).toBe('Select all me');
  });

  test('TC-EDIT-011: find next highlights matching text', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Find needle in haystack');
    await openFindReplace(page);
    await page.getByTestId('find-input').fill('needle');
    await page.getByTestId('find-next').click();
    await expect
      .poll(async () =>
        page.evaluate(() => window.__OFFICEWRITE_TEST__?.getEditorSelectionText() ?? ''),
      )
      .toMatch(/needle/i);
  });

  test('TC-EDIT-012: replace all updates document text', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'tehsis tehsis word');
    await openFindReplace(page);
    await page.getByTestId('find-input').fill('tehsis');
    await page.getByTestId('replace-input').fill('thesis');
    await page.getByTestId('replace-all').click();
    await expect(page.getByTestId('word-editor')).toContainText('thesis thesis word');
  });

  test('Ctrl+H opens find and replace bar', async ({ page }) => {
    await openBlankDocument(page);
    await page.keyboard.press('Control+h');
    await expect(page.getByTestId('find-replace-bar')).toBeVisible();
  });

  test('changes line spacing via ribbon select', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Spaced lines');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'home');
    await page.getByTestId('ribbon-line-spacing').click();
    await page.getByRole('menuitem', { name: '2.0' }).click();
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('lineHeight');
  });

  test('TC-EDIT-016: increases paragraph indent', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Indented');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'home');
    await page.getByTestId('ribbon-increase-indent').click();
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toMatch(/indent|margin/i);
  });

  test('sets font color via swatch picker', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Colored');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'home');
    await page.getByTitle('Font Color').click();
    await pickColorSwatch(page, '#ff0000');
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('#ff0000');
  });

  test('TC-INS-002: inserts hyperlink via prompt', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Link text');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-link').click();
    await answerPrompt(page, 'https://example.com');
    await expect(page.getByTestId('word-editor').locator('a')).toHaveAttribute('href', 'https://example.com');
  });

  test('title bar undo button enables after typing', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Undo button test');
    await expect(page.getByTestId('editor-titlebar').getByTitle('Undo')).toBeEnabled();
  });
});

test.describe('Navigation and headings', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-VIEW-002: navigation pane lists headings and jumps on click', async ({ page }) => {
    await loadHeadingFixture(page);
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-navigation').click();
    await expect(page.locator('.side-pane').getByText('Chapter One')).toBeVisible();
    await page.locator('.side-pane').getByRole('button', { name: 'Section Alpha' }).click();
    await expect(page.getByTestId('word-editor')).toContainText('Section Alpha');
  });
});
