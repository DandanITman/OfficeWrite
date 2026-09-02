import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  openTemplate,
  typeInEditor,
  focusEditor,
  selectAllInEditor,
  switchRibbonTab,
  insertDefaultTable,
  insertShape,
  openRibbonDialog,
  resolveAllChanges,
  clickRibbon,
  goHome,
  openBackstage,
  saveToPath,
  acceptAppDialogs,
  answerPrompt,
  grantClipboard,
  insertMockImage,
  PATHS,
  pickColorSwatch,
} from '../helpers/playwright';

test.describe('Clipboard and editing depth', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await grantClipboard(page);
    await resetTestState(page);
    await openBlankDocument(page);
  });

  /*
   * These drive the ribbon Cut/Copy/Paste buttons rather than Ctrl+C/X/V.
   *
   * The keyboard path is Chromium's own clipboard handling, and a
   * script-triggered Ctrl+V does not reliably deliver a system-clipboard paste
   * headlessly - so the old version of these tests was flaky for reasons that
   * had nothing to do with Officewrite. The buttons run our `utils/clipboard.ts`,
   * which is the code that was actually broken: Paste used
   * `document.execCommand('paste')`, which Chromium blocks outright, so the
   * button was a silent no-op.
   */
  test('TC-EDIT-017: copies and pastes text with the ribbon clipboard buttons', async ({ page }) => {
    await typeInEditor(page, 'Clipboard sample');
    await selectAllInEditor(page);
    await clickRibbon(page, 'home', 'ribbon-copy');
    await expect
      .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('Clipboard sample');

    await focusEditor(page);
    await page.keyboard.press('Control+End');
    await clickRibbon(page, 'home', 'ribbon-paste');
    await expect(page.getByTestId('word-editor')).toContainText('Clipboard sampleClipboard sample');
  });

  test('TC-EDIT-018: cuts and pastes text with the ribbon clipboard buttons', async ({ page }) => {
    await typeInEditor(page, 'Cut target');
    await selectAllInEditor(page);
    await clickRibbon(page, 'home', 'ribbon-cut');

    // Cut removes the selection and leaves the text on the clipboard.
    await expect(page.getByTestId('word-editor')).not.toContainText('Cut target');
    await expect
      .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('Cut target');

    await clickRibbon(page, 'home', 'ribbon-paste');
    await expect(page.getByTestId('word-editor')).toContainText('Cut target');
  });

  test('TC-EDIT-019: applies paragraph border color via swatch picker', async ({ page }) => {
    await typeInEditor(page, 'Bordered paragraph');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'home');
    await page.getByTitle('Border Color').click();
    await pickColorSwatch(page, '#334155');
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('borderColor');
  });

  test('TC-EDIT-020: applies paragraph shading via swatch picker', async ({ page }) => {
    await typeInEditor(page, 'Shaded paragraph');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'home');
    await page.getByTitle('Shading', { exact: true }).click();
    await pickColorSwatch(page, '#fef08a');
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('shading');
  });

  test('TC-EDIT-021: adds a custom style from the style editor dialog', async ({ page }) => {
    await openRibbonDialog(page, 'home', 'Styles pane');
    await expect(page.getByTestId('style-editor')).toBeVisible();
    await page.getByTestId('style-add').click();
    await page.getByTestId('style-name').fill('Report Body');
    await expect(page.getByTestId('style-list')).toContainText('Report Body');
  });

  test('TC-EDIT-022: find previous moves to earlier match', async ({ page }) => {
    await typeInEditor(page, 'alpha beta alpha');
    await page.keyboard.press('Control+f');
    await page.getByTestId('find-input').fill('alpha');
    await page.getByTestId('find-next').click();
    await page.getByTestId('find-next').click();
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => window.__OFFICEWRITE_TEST__?.getEditorSelectionText() ?? ''),
      )
      .toMatch(/alpha/i);
  });
});

test.describe('Insert depth', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await openBlankDocument(page);
  });

  test('TC-INS-008: edits text inside a table cell', async ({ page }) => {
    await insertDefaultTable(page);
    await page.getByTestId('word-editor').locator('td').first().click();
    await page.keyboard.type('Cell A1');
    await expect(page.getByTestId('word-editor').locator('td').first()).toContainText('Cell A1');
  });

  test('TC-INS-009: aligns and wraps an inserted image from the ribbon', async ({ page }) => {
    await insertMockImage(page);
    await page.locator('.image-block').click({ force: true });
    // Selecting a picture activates the contextual Picture Format tab.
    await switchRibbonTab(page, 'pictureFormat');
    await page.getByTestId('picture-align-center').click();
    await page.getByTestId('picture-wrap-text').click();
    await page.getByTestId('picture-wrap-inline').click();
    await expect(page.getByTestId('word-editor').locator('.image-block')).toHaveAttribute(
      'data-wrap',
      'inline',
    );
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('"align":"center"');
  });

  test('TC-INS-010: inserts oval, line, and arrow shapes', async ({ page }) => {
    for (const shape of ['circle', 'line', 'arrow'] as const) {
      await insertShape(page, shape);
      await focusEditor(page);
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
    }
    await expect(page.getByTestId('word-editor').locator('.shape-block')).toHaveCount(3);
    const json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('"shapeType":"circle"');
    expect(json).toContain('"shapeType":"line"');
    expect(json).toContain('"shapeType":"arrow"');
  });

});

test.describe('Review and track changes depth', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await openBlankDocument(page);
  });

  test('TC-REV-004: accepts all tracked changes', async ({ page }) => {
    await switchRibbonTab(page, 'review');
    await page.getByTestId('ribbon-track-changes').click();
    await typeInEditor(page, 'Accepted change');
    let json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).toContain('trackInsert');
    await resolveAllChanges(page, 'accept');
    json = await page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));
    expect(json).not.toContain('trackInsert');
    await expect(page.getByTestId('word-editor')).toContainText('Accepted change');
  });

  test('TC-REV-005: rejects all tracked changes', async ({ page }) => {
    await switchRibbonTab(page, 'review');
    await page.getByTestId('ribbon-track-changes').click();
    await typeInEditor(page, 'Rejected change');
    await resolveAllChanges(page, 'reject');
    await expect(page.getByTestId('word-editor')).not.toContainText('Rejected change');
  });

  test('TC-REV-006: applies spell suggestion from context menu', async ({ page }) => {
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.setSpellCheckResults([false]);
      window.__OFFICEWRITE_TEST__?.setSpellSuggestions(['correctword']);
    });
    await typeInEditor(page, 'misspeled');
    await expect.poll(async () => page.locator('.spell-error').count()).toBeGreaterThan(0);
    await page.locator('.spell-error').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'correctword' }).click();
    await expect(page.getByTestId('word-editor')).toContainText('correctword');
    await expect(page.getByTestId('word-editor')).not.toContainText('misspeled');
  });

  test('TC-REV-007: persists comments after save and reopen', async ({ page }) => {
    await typeInEditor(page, 'Comment persistence target');
    await selectAllInEditor(page);
    await switchRibbonTab(page, 'review');
    await page.getByTestId('ribbon-comments').click();
    await page.getByRole('button', { name: '+ Selection' }).click();
    await answerPrompt(page, 'Reopen me');
    await expect(page.locator('.comment-card p')).toContainText('Reopen me');
    await saveToPath(page, PATHS.savedOfficewrite);
    const saved = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredFile(path),
      PATHS.savedOfficewrite,
    );
    expect(saved).toContain('Reopen me');
    await goHome(page);
    await page.evaluate(
      ({ path, content }) => {
        window.__OFFICEWRITE_TEST__?.seedFile(path, content!);
      },
      { path: PATHS.savedOfficewrite, content: saved },
    );
    await page.getByTestId('home-recent-row').first().click();
    await switchRibbonTab(page, 'review');
    await page.getByTestId('ribbon-comments').click();
    await expect(page.locator('.comment-card')).toHaveCount(1);
    await expect(page.locator('.comment-card p')).toContainText('Reopen me');
  });
});

test.describe('Layout, settings, and workflows', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-LAY-005: shows page numbers when enabled in header and footer dialog', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-footer').click();
    await page.getByTestId('footer-center').fill('Footer note');
    await page.getByTestId('hf-page-numbers').check();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.doc-page-shell-label').first()).toContainText('Page 1 of');
    await expect(page.getByText('Footer note')).toBeVisible();
  });

  test('TC-SET-001: stores accent color and proofing language in settings', async ({ page }) => {
    await openBlankDocument(page);
    await openBackstage(page, 'options');
    await page.getByLabel('Accent color').fill('#ff5500');
    await page.getByLabel('Proofing language').selectOption('de-DE');
    await page.getByRole('button', { name: /Back to document/i }).click();
    const settings = await page.evaluate(async () => window.officewrite.getSettings());
    expect(settings).not.toBeNull();
    expect(settings!.accentColor).toBe('#ff5500');
    expect(settings!.language).toBe('de-DE');
  });

  test('TC-FILE-022: writes letter template edits to DOCX and reopens through UI', async ({ page }) => {
    await openTemplate(page, 'letter');
    await typeInEditor(page, ' Client addition.');
    await saveToPath(page, PATHS.savedDocx);
    const savedB64 = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path),
      PATHS.savedDocx,
    );
    expect(savedB64?.length).toBeGreaterThan(100);
    await goHome(page);
    await page.evaluate(
      ({ path, b64 }) => {
        window.__OFFICEWRITE_TEST__?.seedBinaryFile(path, b64!);
        window.__OFFICEWRITE_TEST__?.setOpenFileResult(path);
      },
      { path: PATHS.savedDocx, b64: savedB64 },
    );
    await page.getByTestId('home-recent-row').first().click();
    await expect(page.getByTestId('word-editor')).toContainText('Client addition');
  });

  test('TC-FILE-021: keeps recent documents after a full page reload', async ({ page }) => {
    await openBlankDocument(page);
    await saveToPath(page, PATHS.recentDoc);
    await goHome(page);
    await expect(page.getByTestId('home-recent-row')).toContainText('recent.docx');
    await page.reload();
    await page.getByTestId('home-screen').waitFor({ state: 'visible' });
    await expect(page.getByTestId('home-recent-row')).toContainText('recent.docx');
  });
});
