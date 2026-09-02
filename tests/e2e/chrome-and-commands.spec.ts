import { test, expect } from '@playwright/test';
import {
  acceptAppDialogs,
  answerConfirm,
  answerPrompt,
  dismissAlert,
  fileMenu,
  focusEditor,
  openBlankDocument,
  resetTestState,
  runCommand,
  saveToPath,
  selectAllInEditor,
  switchRibbonTab,
  typeInEditor,
} from '../helpers/playwright';
import { PATHS } from '../fixtures/fileFixtures';

const editorJson = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.stringify(window.__OFFICEWRITE_TEST__?.getEditorJson()));

test.describe('Ribbon tab strip', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-TAB-001: shows exactly the nine tabs, in the expected order', async ({ page }) => {
    await openBlankDocument(page);
    await expect(page.locator('.ribbon-tab:not(.is-contextual)')).toHaveText([
      'File',
      'Home',
      'Insert',
      'Layout',
      'References',
      'Mailings',
      'Review',
      'View',
      'Help',
    ]);
  });

  test('TC-TAB-002: Draw appears only while a drawing is selected', async ({ page }) => {
    await openBlankDocument(page);
    await expect(page.getByTestId('ribbon-tab-draw')).toHaveCount(0);

    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-drawing').click();
    await expect(page.getByTestId('ribbon-tab-draw')).toBeVisible();
    await expect(page.getByTestId('ribbon-tab-draw')).toHaveClass(/active/);

    // Clicking into the text deselects the canvas, so the tab retires.
    await focusEditor(page);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('ribbon-tab-draw')).toHaveCount(0);
  });

  test('TC-TAB-003: File opens a dropdown rather than a panel', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTestId('ribbon-tab-file').click();
    await expect(page.getByTestId('file-menu')).toBeVisible();
    // Rename, Create a Copy and Delete need a file on disk.
    await expect(page.getByTestId('file-menu-rename')).toBeDisabled();
    await expect(page.getByTestId('file-menu-delete')).toBeDisabled();
  });
});

test.describe('File operations', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-FILE-010: renames the document on disk', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Rename me');
    await saveToPath(page, PATHS.savedDocx);

    await fileMenu(page, 'rename');
    await answerPrompt(page, 'Renamed');

    await expect(page.getByTestId('editor-filename')).toContainText('Renamed.docx');
    const stored = await page.evaluate(
      () => Object.keys(JSON.parse(localStorage.getItem('officewrite-test-fs') ?? '{}')),
    );
    expect(stored.some((path) => path.endsWith('Renamed.docx'))).toBe(true);
    expect(stored.some((path) => path.endsWith('saved.docx'))).toBe(false);
  });

  test('TC-FILE-011: copies the document beside itself', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Copy me');
    await saveToPath(page, PATHS.savedDocx);

    await fileMenu(page, 'copy');
    await dismissAlert(page, /Copied to/i);

    const stored = await page.evaluate(
      () => Object.keys(JSON.parse(localStorage.getItem('officewrite-test-fs') ?? '{}')),
    );
    expect(stored.some((path) => path.endsWith('saved (1).docx'))).toBe(true);
    // The original stays open and on disk.
    expect(stored.some((path) => path.endsWith('saved.docx'))).toBe(true);
  });

  test('TC-FILE-012: deletes the document and returns to the home screen', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Delete me');
    await saveToPath(page, PATHS.savedDocx);

    await fileMenu(page, 'delete');
    await answerConfirm(page, true);

    await expect(page.getByTestId('home-screen')).toBeVisible();
    const stored = await page.evaluate(
      () => Object.keys(JSON.parse(localStorage.getItem('officewrite-test-fs') ?? '{}')),
    );
    expect(stored.some((path) => path.endsWith('saved.docx'))).toBe(false);
  });

  test('TC-FILE-013: cancelling delete leaves the document alone', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Keep me');
    await saveToPath(page, PATHS.savedDocx);

    await fileMenu(page, 'delete');
    await answerConfirm(page, false);

    await expect(page.getByTestId('word-editor')).toBeVisible();
    const stored = await page.evaluate(
      () => Object.keys(JSON.parse(localStorage.getItem('officewrite-test-fs') ?? '{}')),
    );
    expect(stored.some((path) => path.endsWith('saved.docx'))).toBe(true);
  });
});

test.describe('Command search (Alt+Q)', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-CMD-001: runs a formatting command against the selection', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Palette target');
    await selectAllInEditor(page);

    await runCommand(page, 'bold');
    expect(await editorJson(page)).toContain('"bold"');
  });

  test('TC-CMD-002: opens from the header search box, and Escape closes it', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTestId('titlebar-search').click();
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toBeHidden();
  });

  test('TC-CMD-003: offers tab navigation as well as commands', async ({ page }) => {
    await openBlankDocument(page);
    await page.keyboard.press('Alt+q');
    await page.getByTestId('command-input').fill('references');
    await page.getByTestId('command-result-goto.references').click();
    await expect(page.getByTestId('ribbon-tab-references')).toHaveClass(/active/);
  });
});

test.describe('Ribbon layout and editing mode', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-RIB-001: switches to the single line ribbon and back', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTestId('ribbon-collapse').click();
    await page.getByTestId('ribbon-layout-single').click();
    await expect(page.getByTestId('ribbon')).toHaveClass(/is-single-line/);

    await page.getByTestId('ribbon-collapse').click();
    await page.getByTestId('ribbon-layout-classic').click();
    await expect(page.getByTestId('ribbon')).not.toHaveClass(/is-single-line/);
  });

  test('TC-RIB-002: Show tabs only hides the ribbon panel', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTestId('ribbon-collapse').click();
    await page.getByTestId('ribbon-show-tabs-only').click();
    await expect(page.locator('.ribbon-panel')).toHaveCount(0);

    await page.getByTestId('ribbon-collapse').click();
    await page.getByTestId('ribbon-show-always').click();
    await expect(page.locator('.ribbon-panel')).toBeVisible();
  });

  test('TC-RIB-003: Viewing mode makes the document read-only', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTestId('strip-editing-mode').click();
    await page.getByTestId('editing-mode-viewing').click();

    await expect(page.getByTestId('status-read-only')).toBeVisible();
    await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');

    await page.getByTestId('strip-editing-mode').click();
    await page.getByTestId('editing-mode-editing').click();
    await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'true');
  });

  test('TC-RIB-004: Reviewing mode records typing as a tracked change', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTestId('strip-editing-mode').click();
    await page.getByTestId('editing-mode-reviewing').click();

    await typeInEditor(page, 'tracked');
    expect(await editorJson(page)).toContain('trackInsert');
  });

  test('TC-RIB-005: the pane rail toggles the navigation pane', async ({ page }) => {
    await openBlankDocument(page);
    await page.getByTestId('pane-rail-navigation').click();
    await expect(page.locator('.side-pane').filter({ hasText: 'Navigation' })).toBeVisible();
    await page.getByTestId('pane-rail-navigation').click();
    await expect(page.locator('.side-pane').filter({ hasText: 'Navigation' })).toHaveCount(0);
  });
});

test.describe('Help tab', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-HELP-001: opens the project on GitHub in the browser', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'help');
    await page.getByTestId('help-support').click();

    const opened = await page.evaluate(
      () => window.__OFFICEWRITE_TEST__?.getOpenedExternalUrls() ?? [],
    );
    expect(opened).toContain('https://github.com/DandanITman/OfficeWrite/issues');
  });

  test('TC-HELP-002: shows the keyboard shortcuts', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'help');
    await page.getByTestId('help-shortcuts').click();
    await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
    await expect(page.getByTestId('shortcuts-dialog')).toContainText('Ctrl+S');
  });

  test('TC-HELP-003: shows the changelog', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'help');
    await page.getByTestId('help-whats-new').click();
    await expect(page.getByTestId('whats-new-dialog')).toBeVisible();
    await expect(page.getByTestId('whats-new-dialog')).toContainText('Unreleased');
  });
});

test.describe('New editor features', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('TC-NEW-001: inserts an emoji and remembers it', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-emoji').click();
    await page.getByTestId('emoji-search').fill('rocket');
    await page.getByTestId('emoji-🚀').click();

    await expect(page.getByTestId('word-editor')).toContainText('🚀');
    await page.getByTestId('emoji-search').fill('');
    await expect(page.getByTestId('emoji-recent')).toBeVisible();
  });

  test('TC-NEW-002: turns a paragraph into a checklist', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Buy milk');
    await page.getByTestId('ribbon-checklist').click();
    await expect(page.locator('ul[data-type="taskList"]')).toBeVisible();
    expect(await editorJson(page)).toContain('taskList');
  });

  test('TC-NEW-003: sets right-to-left text direction', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'bidi');
    await page.getByTestId('ribbon-direction-rtl').click();
    await expect(page.locator('.ProseMirror p[dir="rtl"]')).toBeVisible();

    await page.getByTestId('ribbon-direction-ltr').click();
    await expect(page.locator('.ProseMirror p[dir="rtl"]')).toHaveCount(0);
  });

  test('TC-NEW-004: reports accessibility problems and selects the offender', async ({ page }) => {
    await openBlankDocument(page);
    await page.evaluate(() =>
      window.__OFFICEWRITE_TEST__?.loadEditorContent({
        type: 'doc',
        content: [
          { type: 'paragraph' },
          { type: 'image', attrs: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: '' } },
        ],
      }),
    );

    await switchRibbonTab(page, 'review');
    await page.getByTestId('review-check-accessibility').click();
    await expect(page.getByTestId('accessibility-pane')).toBeVisible();
    await expect(page.getByTestId('a11y-issue-image-alt')).toBeVisible();
  });

  test('TC-NEW-005: hides the header and footer from View > Show', async ({ page }) => {
    await openBlankDocument(page);
    // Give the page a footer to hide.
    await switchRibbonTab(page, 'insert');
    await page.getByTestId('ribbon-page-number').click();
    await page.getByRole('menuitem', { name: 'Bottom of Page' }).click();
    await expect(page.locator('.doc-footer-pages')).toBeVisible();

    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-header-footer').click();
    await expect(page.locator('.doc-footer-pages')).toHaveCount(0);
  });

  test('TC-NEW-006: Immersive Reader applies its reading settings', async ({ page }) => {
    await openBlankDocument(page);
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-immersive-reader').click();

    await expect(page.getByTestId('immersive-bar')).toBeVisible();
    await page.getByTestId('reader-column-width-narrow').click();
    await expect(page.locator('.editor-scroll')).toHaveAttribute('data-immersive-width', 'narrow');

    await page.getByTestId('reader-exit').click();
    await expect(page.getByTestId('immersive-bar')).toHaveCount(0);
  });

  test('TC-NEW-007: the status bar names the language and the checker', async ({ page }) => {
    await openBlankDocument(page);
    await expect(page.getByTestId('status-language')).toHaveText('English (U.S.)');
    await expect(page.getByTestId('status-proofing')).toContainText('Spelling');
    await expect(page.getByTestId('status-bar')).not.toContainText('Editor');
  });
});
