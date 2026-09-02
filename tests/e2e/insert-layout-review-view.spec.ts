import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  openBackstage,
  typeInEditor,
  focusEditor,
  switchRibbonTab,
  insertDefaultTable,
  insertShape,
  openRibbonDialog,
  selectAllInEditor,
  acceptAppDialogs,
  answerPrompt,
  loadHeadingFixture,
  saveToPath,
  PATHS,
} from '../helpers/playwright';
import { TINY_PNG_BASE64 } from '../fixtures/fileFixtures';

test.describe('Insert tab', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-INS-001: inserts 3x3 table with header row', async ({ page }) => {
    await openBlankDocument(page);
    await insertDefaultTable(page);
    await expect(page.getByTestId('word-editor').locator('table')).toBeVisible();
    await expect(page.getByTestId('word-editor').locator('th')).toHaveCount(3);
  });

  test('TC-INS-003: inserts page break', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-page-break').click();
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('pageBreak');
  });

  test('TC-INS-005: inserts footnote and editable note area', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Text with note');
    await switchRibbonTab(page, 'references');
    await page.getByTestId('ribbon-footnote').click();
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('footnoteRef');
    const footnoteText = page.getByTestId('doc-footnotes').locator('.doc-footnote-text');
    await expect(footnoteText).toBeVisible();
    await footnoteText.click();
    await footnoteText.focus();
    await page.keyboard.type('Footnote body');
    await expect(footnoteText).toContainText('Footnote body');
  });

  test('TC-INS-004: inserts rectangle shape', async ({ page }) => {
    await openBlankDocument(page);
    await insertShape(page, 'rect');
    await expect(page.getByTestId('word-editor').locator('.shape-block')).toBeVisible();
  });

  test('TC-INS-006: inserts image from mock file picker', async ({ page }) => {
    await page.evaluate((b64) => {
      window.__OFFICEWRITE_TEST__?.seedBinaryFile('C:\\OfficewriteTest\\photo.png', b64);
    }, TINY_PNG_BASE64);
    await openBlankDocument(page);
    await page.evaluate(() =>
      window.__OFFICEWRITE_TEST__?.setOpenImageFileResult('C:\\OfficewriteTest\\photo.png'),
    );
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-pictures').click();
    await expect(page.getByTestId('word-editor').locator('img')).toBeVisible();
  });

  test('TC-INS-007: inserts table of contents from headings', async ({ page }) => {
    await loadHeadingFixture(page);
    await switchRibbonTab(page, 'references');
    await page.getByTestId('ribbon-toc').click();
    await page.getByTestId('ribbon-insert-toc').click();
    await expect(page.getByTestId('word-editor')).toContainText('Chapter One');
  });

  test('inserts current date', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-date').click();
    await page.getByRole('menuitem').first().click();
    const text = await page.evaluate(() => window.__OFFICEWRITE_TEST__?.getEditorText() ?? '');
    expect(text.length).toBeGreaterThan(5);
  });
});

test.describe('Layout, review, and view', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('opens page setup dialog', async ({ page }) => {
    await openBlankDocument(page);
    await openRibbonDialog(page, 'pageLayout', 'Page Setup dialog');
    await expect(page.getByRole('heading', { name: /Page Setup/i })).toBeVisible();
  });

  test('TC-LAY-001: changes page size from letter to A4', async ({ page }) => {
    await openBlankDocument(page);
    await openRibbonDialog(page, 'pageLayout', 'Page Setup dialog');
    await page.getByLabel('Page size').selectOption('a4');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.doc-page-shell').first()).toHaveCSS('width', '794px');
  });

  test('TC-LAY-004: applies multi-column layout from page setup', async ({ page }) => {
    await openBlankDocument(page);
    await openRibbonDialog(page, 'pageLayout', 'Page Setup dialog');
    await page.getByLabel('Columns').selectOption('2');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.doc-body-columns')).toBeVisible();
    await expect(page.locator('.doc-body')).toHaveCSS('column-count', '2');
  });

  test('TC-LAY-002: sets header and footer text', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-header').click();
    // The header and footer are three zones now; the centre is where a single
    // string used to render.
    await page.getByTestId('header-center').fill('Confidential');
    await page.getByTestId('footer-center').fill('Draft copy');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.doc-header')).toContainText('Confidential');
    await expect(page.locator('.doc-footer')).toContainText('Draft copy');
  });

  /**
   * A title on the left with a page number on the right is the commonest
   * header there is, and it could not be expressed at all when the header was
   * a single string.
   */
  test('TC-LAY-011: header and footer zones render left, centre and right', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-header').click();
    await page.getByTestId('header-left').fill('Quarterly report');
    await page.getByTestId('header-right').fill('Confidential');
    await page.getByTestId('footer-left').fill('Acme Ltd');
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.locator('.doc-header .doc-hf-left')).toHaveText('Quarterly report');
    await expect(page.locator('.doc-header .doc-hf-right')).toHaveText('Confidential');
    await expect(page.locator('.doc-footer .doc-hf-left')).toHaveText('Acme Ltd');
  });

  test('opens header and footer dialog', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-footer').click();
    await expect(page.getByTestId('header-footer-dialog')).toBeVisible();
    await expect(page.getByTestId('header-left')).toBeVisible();
  });

  test('TC-LAY-003: enables watermark text on document', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'pageLayout');
    await page.getByTestId('layout-watermark').click();
    await page.getByLabel('Show watermark').check();
    await page.getByLabel('Watermark text').fill('DRAFT');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.doc-watermark')).toContainText('DRAFT');
  });

  test('opens watermark dialog', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'pageLayout');
    await page.getByTestId('layout-watermark').click();
    await expect(page.getByRole('heading', { name: /Watermark/i })).toBeVisible();
  });

  test('TC-REV-001: toggles track changes from review tab', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'review');
    await page.getByTestId('ribbon-track-changes').click();
    await expect(page.getByTestId('status-bar').locator('.status-track')).toBeVisible();
    await typeInEditor(page, 'Tracked edit');
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('trackInsert');
  });

  test('TC-REV-002: adds and resolves comment on selection', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Comment target text');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'review');
    await page.getByTestId('ribbon-comments').click();
    await page.getByRole('button', { name: '+ Selection' }).click();
    await answerPrompt(page, 'Needs review');
    await expect(page.getByText('Needs review')).toBeVisible();
    await page.getByRole('button', { name: 'Resolve' }).click();
    // The original test stopped at the click and asserted nothing at all.
    await expect(page.locator('.comment-card.resolved')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Resolve' })).toHaveCount(0);
  });

  test('TC-VIEW-003: toggles focus mode from view tab', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-immersive-reader').click();
    await expect(page.locator('.editor-scroll')).toHaveClass(/focus-mode/);
  });

  test('TC-VIEW-001: changes zoom from status bar', async ({ page }) => {
    await openBlankDocument(page);
    await page.locator('.status-zoom-btn').last().click();
    await expect(page.getByTestId('status-zoom-pct')).not.toHaveText('100%');
  });

  test('TC-VIEW-004: updates word count while typing', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'one two three four');
    await expect(page.getByTestId('status-word-count')).toContainText('4 words');
  });

  test('switches status bar view modes', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTitle('Web Layout').click();
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-immersive-reader').click();
    await expect(page.locator('.editor-scroll.focus-mode')).toBeVisible();
  });

  test('stores settings in mock persistence layer', async ({ page }) => {
    const settings = await page.evaluate(async () => {
      window.__OFFICEWRITE_TEST__?.setSettings({ theme: 'dark', spellCheckEnabled: false });
      return window.officewrite.getSettings();
    });
    expect(settings).not.toBeNull();
    expect(settings!.theme).toBe('dark');
    expect(settings!.spellCheckEnabled).toBe(false);
  });
});

test.describe('Settings and options', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await openBlankDocument(page);
  });

  test('TC-REV-003: underlines misspelled words when spell check is enabled', async ({ page }) => {
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.setSpellCheckResults([false]);
    });
    await typeInEditor(page, 'asdfgh');
    await expect.poll(async () => page.locator('.spell-error').count()).toBeGreaterThan(0);
    await expect(page.locator('.spell-error')).toContainText('asdfgh');
  });

  test('disabling spell check stores setting', async ({ page }) => {
    await openBackstage(page, 'options');
    await page.getByLabel(/Enable spell check/i).uncheck();
    const enabled = await page.evaluate(async () => (await window.officewrite.getSettings())?.spellCheckEnabled);
    expect(enabled).toBe(false);
  });

  test('auto-save interval zero disables auto-save', async ({ page }) => {
    await page.evaluate(() =>
      window.__OFFICEWRITE_TEST__?.setSettings({ autoSaveIntervalMs: 0 }),
    );
    await saveToPath(page, PATHS.savedDocx);
    const baseline = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path),
      PATHS.savedDocx,
    );
    expect(baseline).not.toBeNull();
    await typeInEditor(page, ' no autosave');
    await expect
      .poll(
        async () =>
          page.evaluate(
            (path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path),
            PATHS.savedDocx,
          ),
        { timeout: 3000 },
      )
      .toBe(baseline);
  });
});
