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
    if (process.env.OFFICEWRITE_ELECTRON_EXECUTABLE) {
      expect(await launched.app.evaluate(({ app }) => app.isPackaged)).toBe(true);
    }

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
        'checkForUpdates',
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

  test('copies and renames files without overwriting an existing document', async () => {
    launched = await launchApp();
    const target = path.join(launched.userDataDir, 'documents', 'note.txt');
    const result = await launched.window.evaluate(async (filePath) => {
      await window.officewrite.writeFile(filePath, 'Original document');
      const firstCopy = await window.officewrite.copyFile(filePath);
      const secondCopy = await window.officewrite.copyFile(filePath);
      const collision = await window.officewrite.renameFile(filePath, 'note (1).txt');
      const renamed = await window.officewrite.renameFile(filePath, 'renamed.txt');
      return { firstCopy, secondCopy, collision, renamed };
    }, target);
    expect(result.collision).toBeNull();
    expect(result.firstCopy).toBe(path.join(path.dirname(target), 'note (1).txt'));
    expect(result.secondCopy).toBe(path.join(path.dirname(target), 'note (2).txt'));
    expect(result.renamed).toBe(path.join(path.dirname(target), 'renamed.txt'));
    for (const file of [result.firstCopy, result.secondCopy, result.renamed]) {
      expect(readFileSync(file!, 'utf-8')).toBe('Original document');
    }
    const listed = await launched.window.evaluate((folder) => window.officewrite.listDocuments(folder), path.dirname(target));
    expect(listed.map((file) => file.name).sort()).toEqual(['note (1).txt', 'note (2).txt', 'renamed.txt']);
  });

  test('concurrent copies reserve different filenames', async () => {
    launched = await launchApp();
    const source = path.join(launched.userDataDir, 'documents', 'original.txt');
    const copies = await launched.window.evaluate(async (filePath) => {
      await window.officewrite.writeFile(filePath, 'original content');
      return Promise.all([window.officewrite.copyFile(filePath), window.officewrite.copyFile(filePath)]);
    }, source);
    expect(copies.every(Boolean)).toBe(true);
    expect(new Set(copies).size).toBe(2);
    for (const copy of copies) expect(readFileSync(copy!, 'utf8')).toBe('original content');
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

  test('holds the window open when the document has unsaved changes', async () => {
    launched = await launchApp();
    const page = launched.window;

    await openBlankDocument(page);
    await typeInEditor(page, 'Unsaved work');

    // The renderer mirrors its dirty flag to the main process.
    await expect
      .poll(async () => page.evaluate(() => window.officewrite.setDirty(true)))
      .toBe(true);

    const result = await launched.app.evaluate(({ BrowserWindow, dialog }) => {
      const original = dialog.showMessageBoxSync;
      let prompted = false;
      dialog.showMessageBoxSync = () => { prompted = true; return 2; };
      try {
        const win = BrowserWindow.getAllWindows()[0];
        win.close();
        return { prompted, destroyed: win.isDestroyed() };
      } finally {
        dialog.showMessageBoxSync = original;
      }
    });
    expect(result).toEqual({ prompted: true, destroyed: false });
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

  test('keeps revisions separate for documents sharing a long directory path', async () => {
    launched = await launchApp();
    const paths = ['first.docx', 'second.docx'].map((name) =>
      path.join(launched.userDataDir, 'documents-with-a-long-shared-directory-prefix', name),
    );
    const result = await launched.window.evaluate(async ([first, second]) => {
      const saved = await Promise.all([
        window.officewrite.saveRevision(first, { text: 'first' }, 'First'),
        window.officewrite.saveRevision(first, { text: 'another' }, 'Another'),
        window.officewrite.saveRevision(second, { text: 'second' }, 'Second'),
      ]);
      return {
        ids: saved.map((revision) => revision.id),
        first: await window.officewrite.listRevisions(first),
        second: await window.officewrite.listRevisions(second),
        restored: await window.officewrite.loadRevision(second, saved[2].id),
      };
    }, paths);
    expect(new Set(result.ids).size).toBe(3);
    expect(result.first).toHaveLength(2);
    expect(result.second).toHaveLength(1);
    expect(result.restored).toEqual({ text: 'second' });
  });

  test('printing converts page numbers and waits for the native result', async () => {
    launched = await launchApp();
    await launched.app.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      contents.print = (options, callback) => {
        if (JSON.stringify(options?.pageRanges) !== JSON.stringify([{ from: 0, to: 2 }, { from: 4, to: 4 }])) {
          throw new Error('Incorrect native page ranges');
        }
        setTimeout(() => callback?.(false, 'Print job canceled'), 100);
      };
    });
    const result = await launched.window.evaluate(() =>
      window.officewrite.printDocument({ copies: 2, pageRange: '1-3, 5' }),
    );
    expect(result).toBe(false);

    await launched.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.print = (_options, callback) => {
        callback?.(false, 'Printer is unavailable');
      };
    });
    await expect(launched.window.evaluate(() => window.officewrite.printDocument()))
      .rejects.toThrow('Printer is unavailable');
    await expect(launched.window.evaluate(() => window.officewrite.printDocument({ pageRange: '3-1' })))
      .rejects.toThrow('Enter a valid page range');
  });
});
