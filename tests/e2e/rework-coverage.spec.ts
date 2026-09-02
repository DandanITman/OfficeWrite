import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  typeInEditor,
  focusEditor,
  selectAllInEditor,
  answerPrompt,
  switchRibbonTab,
  clickRibbon,
  openRibbonDialog,
  resolveAllChanges,
  acceptAppDialogs,
  saveToPath,
  insertShape,
  insertDefaultTable,
  openBackstage,
  PATHS,
} from '../helpers/playwright';

/**
 * Features added during the rework that shipped without coverage.
 *
 * Each of these replaced something that was dead, stubbed or silently wrong,
 * so they are exactly the ones a regression would go unnoticed in.
 */
test.describe('Reworked features', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-VIEW-005: the word count dialog reports real counts', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'one two three four five');

    // The View tab previously had no word count command at all.
    await clickRibbon(page, 'view', 'view-word-count');

    const dialog = page.getByTestId('word-count-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('word-count-words')).toHaveText('5');
    await expect(page.getByTestId('word-count-characters')).toHaveText('23');

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('TC-VIEW-006: web layout is a real mode, not a dead button', async ({ page }) => {
    await openBlankDocument(page);
    const scroll = page.locator('.editor-scroll');
    await expect(scroll).not.toHaveClass(/web-layout/);

    // This button called onViewModeChange('web') while App mapped anything not
    // 'focus' to print, so it could never activate.
    await page.getByTestId('status-bar').getByTitle('Web Layout').click();
    await expect(scroll).toHaveClass(/web-layout/);

    await page.getByTestId('status-bar').getByTitle('Print Layout').click();
    await expect(scroll).not.toHaveClass(/web-layout/);
  });

  test('TC-VIEW-007: the page indicator follows the caret', async ({ page }) => {
    await openBlankDocument(page);
    const indicator = page.getByTestId('status-page-indicator');
    await expect(indicator).toHaveText(/^Page 1 of/);

    // Seed a document long enough to paginate. The feature under test is the
    // indicator following the caret, so the content is fixture data.
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.loadEditorContent({
        type: 'doc',
        content: Array.from({ length: 80 }, (_, i) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: `Line ${i} of a document long enough to paginate.` }],
        })),
      });
    });

    await expect.poll(async () => indicator.textContent()).not.toMatch(/^Page 1 of 1$/);

    // At the end of a multi-page document the caret is past page one. Click the
    // paragraph itself rather than the middle of the editor: that lands on the
    // text for certain, so the caret really is where the assertion assumes.
    const paragraphs = page.getByTestId('word-editor').locator('> p');
    await paragraphs.last().click();
    await expect.poll(async () => indicator.textContent()).not.toMatch(/^Page 1 of/);

    await paragraphs.first().click();
    await expect.poll(async () => indicator.textContent()).toMatch(/^Page 1 of/);
  });

  test('TC-EDIT-023: find reports a live match count', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'alpha beta alpha gamma alpha');

    await page.keyboard.press('Control+f');
    await page.getByTestId('find-input').fill('alpha');

    // Previously a miss opened a blocking modal and there was no count at all.
    await expect(page.getByTestId('find-count')).toHaveText('1 of 3');

    await page.getByTestId('find-next').click();
    await expect(page.getByTestId('find-count')).toHaveText('2 of 3');

    await page.getByTestId('find-input').fill('nothinghere');
    await expect(page.getByTestId('find-count')).toHaveText('No results');
  });

  test('TC-EDIT-024: Ctrl+H focuses the replace field', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'replace me');

    // Ctrl+H used to be byte-identical to Ctrl+F, leaving focus in Find.
    await page.keyboard.press('Control+h');
    await expect(page.getByTestId('replace-input')).toBeFocused();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+f');
    await expect(page.getByTestId('find-input')).toBeFocused();
  });

  test('TC-LAY-006: the margin preset select reflects the active margins', async ({ page }) => {
    await openBlankDocument(page);
    await openRibbonDialog(page, 'pageLayout', 'Page Setup dialog');

    const preset = page.getByTestId('page-margin-preset');
    // Defaults are the Normal preset; the select had no `value` before, so it
    // always displayed "Custom".
    await expect(preset).toHaveValue('Normal');

    await preset.selectOption('Narrow');
    await expect(preset).toHaveValue('Narrow');
  });

  test('TC-EDIT-025: the style editor lists the built-in styles', async ({ page }) => {
    await openBlankDocument(page);
    await openRibbonDialog(page, 'home', 'Styles pane');

    // The list filtered out the five built-in ids, but a new document's
    // customStyles *is* those built-ins - so it was always empty.
    const list = page.getByTestId('style-list');
    await expect(list).toBeVisible();
    await expect(list.getByRole('button')).not.toHaveCount(0);
    await expect(list).toContainText('Normal');

    // Editing is a form now, not three chained modal prompts.
    await page.getByTestId('style-item-heading1').click();
    await page.getByTestId('style-font-family').selectOption('Georgia');
    await expect(list).toContainText('Georgia');
  });

  test('TC-HOME-001: About opens and recent entries can be removed', async ({ page }) => {
    await openBlankDocument(page);
    await saveToPath(page, PATHS.savedOfficewrite);

    await page.getByTestId('editor-titlebar').getByTitle('Home screen').first().click();
    await expect(page.getByTestId('home-screen')).toBeVisible();

    // "About" was permanently disabled.
    await page.getByTestId('home-about').click();
    await expect(page.getByTestId('about-dialog')).toBeVisible();
    await page.getByTestId('about-dialog').getByRole('button', { name: 'Close' }).click();

    // The recent-file "More" button had no onClick at all.
    const row = page.locator('.home-doc-actions').first();
    await expect(row).toBeVisible();
    await row.getByTitle('Remove from recent').click();
    await expect(page.locator('.home-doc-actions')).toHaveCount(0);
  });

  test('TC-REV-008: tracked deletions are kept and reject restores them', async ({ page }) => {
    await openBlankDocument(page);
    // AutoCorrect capitalises the first word of a sentence as you type, so the
    // assertions below expect what the user actually sees.
    await typeInEditor(page, 'keep this sentence');

    await clickRibbon(page, 'review', 'ribbon-track-changes');

    // Delete a word with track changes on.
    await focusEditor(page);
    await page.keyboard.press('Control+End');
    for (let i = 0; i < 9; i += 1) await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Backspace');

    // The text stays, struck through, rather than disappearing.
    await expect(page.locator('.track-delete')).toHaveCount(1);

    await resolveAllChanges(page, 'reject');
    await expect(page.getByTestId('word-editor')).toContainText('Keep this sentence');
    await expect(page.locator('.track-delete')).toHaveCount(0);
  });

  test('TC-REV-010: pending tracked changes are counted', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'original wording');
    await clickRibbon(page, 'review', 'ribbon-track-changes');

    // countTrackChanges existed but nothing in the UI called it, so there was
    // no way to see how much was waiting for a decision.
    await expect(page.getByTestId('ribbon-change-summary')).toHaveText('No pending changes');

    await focusEditor(page);
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' plus more');

    await switchRibbonTab(page, 'review');
    await expect(page.getByTestId('ribbon-pending-insertions')).toHaveText('1 inserted');
    await expect(page.getByTestId('status-pending-changes')).toHaveText('1 pending change');

    await resolveAllChanges(page, 'accept');
    await expect(page.getByTestId('ribbon-change-summary')).toHaveText('No pending changes');
    await expect(page.getByTestId('status-pending-changes')).toHaveCount(0);
  });

  test('TC-EDIT-026: Ctrl+K links the selection', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Officewrite site');
    await selectAllInEditor(page);

    // Insert > Link existed; the shortcut every word processor has did not.
    await page.keyboard.press('Control+k');
    await answerPrompt(page, 'https://example.com/docs');

    await expect(page.getByTestId('word-editor').locator('a')).toHaveAttribute(
      'href',
      'https://example.com/docs',
    );
  });

  test('TC-FILE-010: Ctrl+P prints and Ctrl+Shift+S saves under a new name', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'shortcut coverage');
    await saveToPath(page, PATHS.savedOfficewrite);

    await page.keyboard.press('Control+p');
    await expect
      .poll(async () => page.evaluate(() => window.__OFFICEWRITE_TEST__?.getPrintCallCount()))
      .toBe(1);

    // Ctrl+Shift+S must ask where to save rather than overwriting the open
    // file the way a plain Ctrl+S does.
    const copyPath = 'C:\\OfficewriteTest\\copy.officewrite';
    await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setSaveFileResult(p), copyPath);
    await page.keyboard.press('Control+Shift+S');

    await expect
      .poll(async () =>
        page.evaluate((p) => window.__OFFICEWRITE_TEST__?.readStoredFile(p), copyPath),
      )
      .not.toBeNull();
  });

  /**
   * Layout > Breaks > Column called insertPageBreak, so it silently gave the
   * user a page break instead. The two must produce different nodes.
   */
  test('TC-LAY-010: a column break is not a page break', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'before');

    await switchRibbonTab(page, 'pageLayout');
    await page.getByTestId('layout-breaks').click();
    await page.getByRole('menuitem', { name: 'Column' }).click();

    await expect(page.getByTestId('word-editor').locator('[data-column-break]')).toHaveCount(1);
    await expect(page.getByTestId('word-editor').locator('[data-page-break]')).toHaveCount(0);
  });

  /**
   * File > New and File > Open were one button each. Templates and recents
   * lived only on the start screen, so with a document open they were gone.
   */
  test('TC-FILE-011: the backstage New pane offers the templates', async ({ page }) => {
    await openBlankDocument(page);
    await openBackstage(page, 'new');

    await expect(page.getByTestId('backstage-template-blank')).toBeVisible();
    await expect(page.getByTestId('backstage-template-letter')).toBeVisible();
  });

  /** Shapes could be inserted and then never positioned. */
  test('TC-INS-010: Layout > Arrange wraps a selected shape', async ({ page }) => {
    await openBlankDocument(page);
    await insertShape(page, 'rect');

    await switchRibbonTab(page, 'pageLayout');
    await page.getByTestId('object-wrap-text').click();
    await page.getByTestId('object-wrap-square').click();

    await expect(page.getByTestId('word-editor').locator('.shape-block')).toHaveClass(
      /wrap-square/,
    );
  });

  /** A Navigation pane should be search-first; this one had no search at all. */
  test('TC-VIEW-011: the navigation pane searches the document', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'findme needle here');

    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-navigation').click();
    await page.getByTestId('nav-search').fill('needle');

    await expect(page.getByTestId('nav-results').locator('li')).toHaveCount(1);
  });

  /**
   * Clicking into a table used to force the ribbon onto Table Layout, pulling
   * Bold and the font boxes away mid-sentence. The tab should be revealed, leaving
   * the active one alone.
   */
  test('TC-RIB-008: entering a table reveals the tab without switching to it', async ({ page }) => {
    await openBlankDocument(page);
    await insertDefaultTable(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('word-editor').locator('td').first().click();

    await expect(page.getByTestId('ribbon-tab-tableLayout')).toBeVisible();
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Insert');
  });

  /** Leaving an object used to dump you on Home wherever you had come from. */
  test('TC-RIB-009: leaving a picture returns to the tab you came from', async ({ page }) => {
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.seedBinaryFile(
        'C:\OfficewriteTest\photo.png',
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      );
      window.__OFFICEWRITE_TEST__?.setOpenImageFileResult('C:\OfficewriteTest\photo.png');
    });
    await openBlankDocument(page);
    await switchRibbonTab(page, 'review');
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-pictures').click();
    await page.getByTestId('word-editor').locator('img').waitFor({ state: 'visible' });

    await page.locator('.image-block').click({ force: true });
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Picture Format');

    // Move the caret off the picture.
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Insert');
  });

  /**
   * Bring Forward wrote a `z` attribute the text box view never read, so the
   * button was enabled and silently did nothing.
   */
  test('TC-INS-011: Bring Forward actually stacks a text box', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-text-box').click();
    await page.getByRole('menuitem').first().click();
    await page.getByTestId('text-box').click();

    await switchRibbonTab(page, 'pageLayout');
    await page.getByTestId('object-bring-forward').click();

    await expect
      .poll(async () =>
        page.getByTestId('text-box').evaluate((el) => getComputedStyle(el).zIndex),
      )
      .not.toBe('auto');
  });

  /**
   * Clicking Table Layout by hand recorded no return tab, so leaving the table
   * dumped the user on Home rather than where they had been.
   */
  test('TC-RIB-010: leaving a table returns to the tab you came from', async ({ page }) => {
    await openBlankDocument(page);
    // A paragraph above the table, so Control+Home lands outside it.
    await typeInEditor(page, 'above the table');
    await page.keyboard.press('Enter');
    await insertDefaultTable(page);
    await switchRibbonTab(page, 'review');
    await page.getByTestId('word-editor').locator('td').first().click();

    await switchRibbonTab(page, 'tableLayout');
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Table Layout');

    // Click the paragraph above the table - focus is on the ribbon button
    // after switching tabs, so a keystroke would never reach the editor.
    await page.getByTestId('word-editor').locator('p').first().click();
    await expect(page.locator('.ribbon-tab.active')).toHaveText('Review');
  });

  /**
   * The Print pane was a heading and one button. Because the editor scrolls
   * continuously and never reflows pages on screen, it was the only place a
   * user could have seen where the pages actually break - so they could not.
   */
  test('TC-FILE-012: the print pane previews the document and carries settings', async ({
    page,
  }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'print me');
    await openBackstage(page, 'print');

    await expect(page.getByTestId('print-preview')).toBeVisible();
    await expect(page.getByTestId('print-preview').locator('iframe')).toBeVisible();

    await page.getByTestId('print-copies').fill('3');
    await page.getByTestId('print-range').fill('1-2');
    await page.getByTestId('print-confirm').click();

    await expect
      .poll(async () => page.evaluate(() => window.__OFFICEWRITE_TEST__?.getLastPrintOptions()))
      .toEqual({ copies: 3, pageRange: '1-2' });
  });

  /** Ctrl+G. There was no Go To command anywhere before. */
  test('TC-VIEW-010: Go To opens from the status bar page indicator', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTestId('status-page-indicator').click();

    await expect(page.getByTestId('go-to-dialog')).toBeVisible();
    await page.getByTestId('go-to-value').fill('1');
    await page.getByTestId('go-to-confirm').click();

    await expect(page.getByTestId('go-to-dialog')).toBeHidden();
  });

  test('TC-REV-009: add to dictionary stops a word being flagged', async ({ page }) => {
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.setSpellCheckResults([false]);
    });
    await openBlankDocument(page);
    await typeInEditor(page, 'officewriteium');

    await expect.poll(async () => page.locator('.spell-error').count()).toBeGreaterThan(0);
    await page.locator('.spell-error').click({ button: 'right' });

    // The menu previously offered only "Ignore", which closed it and did nothing.
    await page.getByRole('menuitem', { name: 'Add to dictionary' }).click();

    await expect
      .poll(async () => page.evaluate(() => window.officewrite.getUserDictionary()))
      .toContain('officewriteium');
  });
});
