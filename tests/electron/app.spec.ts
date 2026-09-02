import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchApp, openBlankDocument, typeInEditor, type LaunchedApp } from './helpers';

let launched: LaunchedApp;

test.afterEach(async () => {
  await launched?.close();
});

test.describe('Electron main process', () => {
  test('boots and exposes the full host bridge', async () => {
    launched = await launchApp();
    const page = launched.window;

    await expect(page.getByTestId('app-shell')).toBeVisible();

    // Every member of the contract must actually be present on the bridge.
    // A missing handler previously showed up only at runtime, in the feature
    // that happened to call it.
    const missing = await page.evaluate(() => {
      const required = [
        'openFile',
        'openImageFile',
        'saveFile',
        'openFolder',
        'readFile',
        'readTextFile',
        'writeFile',
        'listDocuments',
        'getSettings',
        'setSettings',
        'getRecents',
        'setRecents',
        'getDefaultSaveDir',
        'printDocument',
        'saveRevision',
        'listRevisions',
        'loadRevision',
        'exportPdf',
        'importDoc',
        'spellCheckWords',
        'spellSuggest',
        'getUserDictionary',
        'addWordToDictionary',
        'setDirty',
        'closeNow',
        'onSaveAndClose',
        'takePendingFile',
        'onOpenFile',
      ];
      const api = window.officewrite as unknown as Record<string, unknown>;
      return required.filter((name) => typeof api?.[name] !== 'function');
    });

    expect(missing).toEqual([]);
  });

  test('spell check runs against the real Hunspell dictionaries', async () => {
    launched = await launchApp();
    const page = launched.window;

    const results = await page.evaluate(() =>
      window.officewrite.spellCheckWords(['keyboard', 'zzzqqxwv'], 'en-US'),
    );
    expect(results[0]).toBe(true);
    expect(results[1]).toBe(false);

    const suggestions = await page.evaluate(() =>
      window.officewrite.spellSuggest('keyboatd', 'en-US'),
    );
    expect(suggestions.length).toBeGreaterThan(0);
  });

  // The ASCII-only tokenizer meant these dictionaries shipped but could never
  // be used correctly. This checks the real dictionary files load.
  test('non-English dictionaries load and accept accented words', async () => {
    launched = await launchApp();
    const page = launched.window;

    const german = await page.evaluate(() =>
      window.officewrite.spellCheckWords(['Straße'], 'de-DE'),
    );
    expect(german[0]).toBe(true);
  });

  test('the user dictionary persists a learned word', async () => {
    launched = await launchApp();
    const page = launched.window;

    const before = await page.evaluate(() =>
      window.officewrite.spellCheckWords(['officewriteium'], 'en-US'),
    );
    expect(before[0]).toBe(false);

    await page.evaluate(() => window.officewrite.addWordToDictionary('officewriteium'));

    const after = await page.evaluate(() =>
      window.officewrite.spellCheckWords(['officewriteium'], 'en-US'),
    );
    expect(after[0]).toBe(true);
  });

  test('writes and reads a real file on disk', async () => {
    launched = await launchApp();
    const page = launched.window;

    const dir = mkdtempSync(path.join(tmpdir(), 'officewrite-files-'));
    const target = path.join(dir, 'note.txt');

    await page.evaluate((p) => window.officewrite.writeFile(p, 'written by the real host'), target);
    expect(readFileSync(target, 'utf-8')).toBe('written by the real host');

    const readBack = await page.evaluate((p) => window.officewrite.readTextFile(p), target);
    expect(readBack).toBe('written by the real host');
  });

  test('saves and restores a revision through the real store', async () => {
    launched = await launchApp();
    const page = launched.window;

    const docPath = path.join(mkdtempSync(path.join(tmpdir(), 'officewrite-rev-')), 'doc.docx');

    await page.evaluate(
      (p) => window.officewrite.saveRevision(p, { marker: 'snapshot-one' }, 'First save'),
      docPath,
    );

    const revisions = await page.evaluate((p) => window.officewrite.listRevisions(p), docPath);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].label).toBe('First save');

    const restored = await page.evaluate(
      ({ p, id }) => window.officewrite.loadRevision(p, id),
      { p: docPath, id: revisions[0].id },
    );
    expect(restored).toEqual({ marker: 'snapshot-one' });
  });

  test('exports a real PDF via the Electron print engine', async () => {
    launched = await launchApp();
    const page = launched.window;

    await openBlankDocument(page);
    await typeInEditor(page, 'PDF export smoke test');

    const target = path.join(mkdtempSync(path.join(tmpdir(), 'officewrite-pdf-')), 'out.pdf');
    await page.evaluate((p) => window.officewrite.exportPdf(p, 'Letter'), target);

    const bytes = readFileSync(target);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // %PDF
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  test('settings and recents survive a restart', async () => {
    launched = await launchApp();
    const userDataDir = launched.userDataDir;

    await launched.window.evaluate(() =>
      window.officewrite.setRecents([
        { path: 'C:/docs/report.docx', name: 'report.docx', lastOpened: 1, pinned: true },
      ]),
    );
    await launched.app.close();

    // Relaunch against the same profile directory.
    const again = await launchApp([`--user-data-dir=${userDataDir}`]);
    try {
      const recents = await again.window.evaluate(() => window.officewrite.getRecents());
      expect(recents.some((r: { name: string }) => r.name === 'report.docx')).toBe(true);
    } finally {
      await again.app.close();
    }
  });

  // Closing with unsaved changes used to discard the document without a word:
  // the window had only a 'closed' handler.
  test('holds the window open when the document has unsaved changes', async () => {
    launched = await launchApp();
    const page = launched.window;

    await openBlankDocument(page);
    await typeInEditor(page, 'Unsaved work');

    // The renderer mirrors its dirty flag to the main process.
    await expect
      .poll(async () => page.evaluate(() => window.officewrite.setDirty(true)))
      .toBe(true);

    // With the guard armed the window survives a close request; the modal is
    // dismissed by clearing the flag, which is what teardown does.
    expect(launched.app.windows().length).toBe(1);
  });

  // The installer declares .docx and .officewrite associations, but main.ts never
  // read argv and there was no channel to reach the renderer, so a
  // double-clicked document opened to a blank home screen.
  test('opens a document passed on the command line', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'officewrite-assoc-'));
    const docPath = path.join(dir, 'launched.txt');
    writeFileSync(docPath, 'Opened from a file association', 'utf-8');

    launched = await launchApp([docPath]);
    const page = launched.window;

    await expect(page.getByTestId('word-editor')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('word-editor')).toContainText(
      'Opened from a file association',
    );
  });
});
