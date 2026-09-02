import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  typeInEditor,
  focusEditor,
  switchRibbonTab,
  seedAllSampleFiles,
  openSeededFile,
  saveToPath,
  goHome,
  openBackstage,
  fileMenu,
  acceptAppDialogs,
  dismissAlert,
  answerPrompt,
  setAutoSaveInterval,
  PATHS,
} from '../helpers/playwright';
import { getSampleDocxBase64, getSampleOfficewrite } from '../fixtures/fileFixtures';

test.describe('File and document lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await seedAllSampleFiles(page);
  });

  test('TC-FILE-003: opens .docx through Ctrl+O', async ({ page }) => {
    await openSeededFile(page, PATHS.docx);
    await expect(page.getByTestId('word-editor')).toContainText('Imported sample paragraph');
  });

  test('TC-FILE-005: opens .txt file', async ({ page }) => {
    await openSeededFile(page, PATHS.txt);
    await expect(page.getByTestId('word-editor')).toContainText('Plain text line one');
  });

  test('TC-FILE-006: opens .rtf file', async ({ page }) => {
    await openSeededFile(page, PATHS.rtf);
    await expect(page.getByTestId('word-editor')).toContainText('Imported sample paragraph');
  });

  test('opens .officewrite native file', async ({ page }) => {
    await openSeededFile(page, PATHS.officewrite);
    await expect(page.getByTestId('word-editor')).toContainText('Imported sample paragraph');
  });

  test('TC-FILE-008: opens legacy .doc with text fallback', async ({ page }) => {
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.seedFile('C:\\OfficewriteTest\\legacy.doc', 'placeholder');
      window.__OFFICEWRITE_TEST__?.setImportDocResult({
        format: 'text',
        data: 'Legacy extracted text',
        source: 'extractor',
        warning: 'LibreOffice not installed',
      });
    });
    await openSeededFile(page, PATHS.doc);
    await expect(page.getByTestId('word-editor')).toContainText('Legacy extracted text');
  });

  test('opens legacy .doc via LibreOffice DOCX conversion mock', async ({ page }) => {
    const docxB64 = await getSampleDocxBase64();
    await page.evaluate(
      ({ b64 }) => {
        window.__OFFICEWRITE_TEST__?.seedFile('C:\\OfficewriteTest\\legacy.doc', 'placeholder');
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        window.__OFFICEWRITE_TEST__?.setImportDocResult({
          format: 'docx',
          data: bytes.buffer,
          source: 'libreoffice',
        });
      },
      { b64: docxB64 },
    );
    await openSeededFile(page, PATHS.doc);
    await expect(page.getByTestId('word-editor')).toContainText('Imported sample paragraph');
  });

  test('saves as .docx by default', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'DOCX save test');
    await saveToPath(page, PATHS.savedDocx);
    const b64 = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path),
      PATHS.savedDocx,
    );
    expect(b64).toBeTruthy();
    expect(b64!.startsWith('UEsDB')).toBe(true);
  });

  test('saves as plain .txt stripping formatting', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Plain only');
    await focusEditor(page);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+b');
    await saveToPath(page, PATHS.savedTxt);
    const saved = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredFile(path),
      PATHS.savedTxt,
    );
    expect(saved).toBe('Plain only');
    expect(saved).not.toContain('bold');
  });

  test('saves as .rtf', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'RTF export');
    await saveToPath(page, PATHS.savedRtf);
    const saved = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredFile(path),
      PATHS.savedRtf,
    );
    expect(saved).toContain('RTF export');
    expect(saved).toContain('\\rtf');
  });

  test('TC-FILE-007: saves as .html', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'HTML export');
    await saveToPath(page, PATHS.savedHtml);
    const saved = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredFile(path),
      PATHS.savedHtml,
    );
    expect(saved).toContain('HTML export');
    expect(saved!.toLowerCase()).toContain('<html');
  });

  test('saves as native .officewrite with revision history', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Native format');
    await saveToPath(page, PATHS.savedOfficewrite);
    const saved = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredFile(path),
      PATHS.savedOfficewrite,
    );
    expect(saved).toContain('Native format');
    expect(saved).toContain('"version"');
    await typeInEditor(page, ' updated');
    await saveToPath(page, PATHS.savedOfficewrite);
    const revisions = await page.evaluate(
      (path) => window.officewrite.listRevisions(path),
      PATHS.savedOfficewrite,
    );
    expect(revisions.length).toBeGreaterThanOrEqual(1);
  });

  test('TC-FILE-004: exports DOCX from backstage', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Backstage export');
    await openBackstage(page, 'export');
    await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setSaveFileResult(p), PATHS.savedDocx);
    await page.getByTestId('export-docx').click();
    await expect
      .poll(async () =>
        page.evaluate(
          (path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path),
          PATHS.savedDocx,
        ),
      )
      .not.toBeNull();
  });

  test('TC-FILE-012: shows dirty asterisk then clears after save', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Dirty doc');
    await expect(page.getByTestId('editor-filename')).toContainText('*');
    await saveToPath(page, PATHS.savedDocx);
    await expect(page.getByTestId('editor-filename')).not.toContainText('*');
  });

  test('TC-FILE-020: Ctrl+S saves document', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Keyboard save');
    await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setSaveFileResult(p), PATHS.savedDocx);
    await page.keyboard.press('Control+s');
    await expect
      .poll(async () =>
        page.evaluate((path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path), PATHS.savedDocx),
      )
      .not.toBeNull();
  });

  test('Ctrl+N creates new blank document', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Old doc');
    await page.keyboard.press('Control+n');
    await expect(page.getByTestId('word-editor')).not.toContainText('Old doc');
  });

  test('Ctrl+O opens seeded file', async ({ page }) => {
    await openBlankDocument(page);
    await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setOpenFileResult(p), PATHS.txt);
    await page.keyboard.press('Control+o');
    await expect(page.getByTestId('word-editor')).toContainText('Plain text line one');
  });

  test('TC-FILE-011: auto-saves after interval when file has path', async ({ page }) => {
    await openBlankDocument(page);
    await saveToPath(page, PATHS.savedDocx);
    await setAutoSaveInterval(page, 400);
    await typeInEditor(page, ' auto');
    await expect
      .poll(
        async () => {
          const b64 = await page.evaluate(
            (path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path),
            PATHS.savedDocx,
          );
          return b64?.length ?? 0;
        },
        { timeout: 5000 },
      )
      .toBeGreaterThan(100);
  });

  test('TC-FILE-013: adds saved file to recent documents on home', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Recent me');
    await saveToPath(page, PATHS.recentDoc);
    await goHome(page);
    await expect(page.getByTestId('home-recent-row')).toContainText('recent.docx');
  });

  test('TC-FILE-014: pins document to favorites tab', async ({ page }) => {
    await openBlankDocument(page);
    await saveToPath(page, PATHS.pinnedDoc);
    await goHome(page);
    await page.getByTestId('home-recent-row').getByTitle('Pin to favorites').click();
    await page.getByTestId('home-tab-favorites').click();
    await expect(page.getByTestId('home-recent-row')).toContainText('pinned.officewrite');
  });

  test('browse folder opens first document', async ({ page }) => {
    await page.getByRole('button', { name: /Browse folder/i }).click();
    await expect(page.getByTestId('word-editor')).toContainText('Folder doc one');
  });

  test('TC-FILE-015: restores version from backstage history', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Version one');
    await saveToPath(page, PATHS.savedOfficewrite);
    await page.evaluate(() =>
      window.__OFFICEWRITE_TEST__?.loadEditorContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version two' }] }],
      }),
    );
    await saveToPath(page, PATHS.savedOfficewrite);
    await openBackstage(page, 'history');
    await page.getByRole('button', { name: 'Restore' }).first().click();
    await expect(page.getByTestId('word-editor')).toContainText('Version one');
  });

  test('TC-FILE-019: edits metadata in backstage Info and persists in .officewrite save', async ({ page }) => {
    await openBlankDocument(page);
    await openBackstage(page, 'info');
    await page.getByLabel('Title').fill('My Title');
    await page.getByLabel('Author').fill('Test Author');
    await page.getByRole('button', { name: /Back to document/i }).click();
    await saveToPath(page, PATHS.savedOfficewrite);
    const saved = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredFile(path),
      PATHS.savedOfficewrite,
    );
    expect(saved).toContain('My Title');
    expect(saved).toContain('Test Author');
  });

  test('navigates all backstage sections', async ({ page }) => {
    await openBlankDocument(page);
    await openBackstage(page);
    for (const section of ['info', 'new', 'open', 'save', 'export', 'print', 'history', 'options']) {
      await page.getByTestId(`backstage-nav-${section}`).click();
      await expect(page.getByTestId('backstage')).toBeVisible();
    }
  });

  test('mock PDF export records Electron call', async ({ page }) => {
    await openBlankDocument(page);
    await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setSaveFileResult(p), PATHS.pdf);
    // File > Export opens the backstage, where the formats live.
    await openBackstage(page, 'export');
    await page.getByTestId('export-pdf').click();
    await expect
      .poll(async () => page.evaluate(() => window.__OFFICEWRITE_TEST__?.getExportPdfCallCount()))
      .toBe(1);
  });

  test('mock print records Electron call', async ({ page }) => {
    await openBlankDocument(page);
    await fileMenu(page, 'print');
    await expect
      .poll(async () => page.evaluate(() => window.__OFFICEWRITE_TEST__?.getPrintCallCount()))
      .toBe(1);
  });

  test('cancels first save dialog without writing file', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Cancel save');
    await page.evaluate(() => window.__OFFICEWRITE_TEST__?.setSaveFileResult(null));
    await page.keyboard.press('Control+s');
    const files = await page.evaluate(() => window.__OFFICEWRITE_TEST__?.listStoredFiles() ?? []);
    expect(files.filter((f) => f.includes('Cancel'))).toHaveLength(0);
  });

  test('TC-FILE-016: loads business letter template', async ({ page }) => {
    await page.getByTestId('home-template-letter').click();
    await expect(page.getByTestId('word-editor')).toContainText('Dear [Recipient]');
  });

  test('TC-FILE-017: loads report template with headings', async ({ page }) => {
    await page.getByTestId('home-template-report').click();
    await expect(page.getByTestId('word-editor')).toContainText('Report Title');
    await expect(page.getByTestId('word-editor')).toContainText('Introduction');
  });

  test('TC-FILE-018: loads resume template', async ({ page }) => {
    await page.getByTestId('home-template-resume').click();
    await expect(page.getByTestId('word-editor')).toContainText('Experience');
    await expect(page.getByTestId('word-editor')).toContainText('Education');
  });
});

test.describe('File dialog alerts', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState(page);
  });

  test('alerts on unsupported file type', async ({ page }) => {
    await openBlankDocument(page);
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.seedFile('C:/OfficewriteTest/bad.xyz', 'data');
      window.__OFFICEWRITE_TEST__?.setOpenFileResult('C:/OfficewriteTest/bad.xyz');
    });
    await page.keyboard.press('Control+o');
    // The in-app dialog, not window.alert: uiPrompt no longer has a test-mode
    // branch, so tests and users now travel the same path.
    await dismissAlert(page, /Unsupported file type/i);
  });

  test('TC-FILE-023: reports a corrupted .officewrite file instead of failing silently', async ({ page }) => {
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.seedFile('C:/OfficewriteTest/bad.officewrite', '{not json');
      window.__OFFICEWRITE_TEST__?.setOpenFileResult('C:/OfficewriteTest/bad.officewrite');
    });
    await page.locator('.home-sidebar-nav').getByRole('button', { name: 'Open' }).click();
    // Previously this asserted only that the home screen was still visible --
    // which it was because JSON.parse threw an unhandled rejection. The app now
    // reports the problem.
    await dismissAlert(page, /corrupted/i);
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });
});
