import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir } from '../store';

const DOCUMENT_EXTENSIONS = ['docx', 'officewrite', 'doc', 'txt', 'rtf', 'html', 'htm'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
/** Mail-merge recipient lists. Delimited text only; the parser sniffs which. */
const DATA_EXTENSIONS = ['csv', 'tsv', 'txt'];

export function registerFileIpc(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('dialog:openFile', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: DOCUMENT_EXTENSIONS },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('dialog:openImageFile', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: IMAGE_EXTENSIONS },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('dialog:openDataFile', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Recipient lists', extensions: DATA_EXTENSIONS },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('dialog:saveFile', async (_e, defaultPath?: string) => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultPath ?? 'Untitled.docx',
      filters: [
        { name: 'DOCX Document', extensions: ['docx'] },
        { name: 'Officewrite Native (.officewrite)', extensions: ['officewrite'] },
        { name: 'Rich Text', extensions: ['rtf'] },
        { name: 'HTML', extensions: ['html', 'htm'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Plain Text', extensions: ['txt'] },
      ],
    });
    return result.canceled ? null : (result.filePath ?? null);
  });

  ipcMain.handle('dialog:openFolder', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('fs:readFile', async (_e, filePath: string) => fs.readFile(filePath));

  ipcMain.handle('fs:readTextFile', async (_e, filePath: string) =>
    fs.readFile(filePath, 'utf-8'),
  );

  ipcMain.handle('fs:writeFile', async (_e, filePath: string, data: Uint8Array | string) => {
    ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, data);
    return true;
  });

  /**
   * File > Rename. Keeps the file in place and refuses to clobber a neighbour,
   * so a careless name cannot silently destroy another document.
   */
  ipcMain.handle('fs:renameFile', async (_e, filePath: string, newName: string) => {
    const target = path.join(path.dirname(filePath), path.basename(newName));
    if (target === filePath) return filePath;
    try {
      await fs.access(target);
      return null;
    } catch {
      // Nothing there, which is what we want.
    }
    await fs.rename(filePath, target);
    return target;
  });

  /** File > Create a Copy. Numbers the suffix up rather than overwriting. */
  ipcMain.handle('fs:copyFile', async (_e, filePath: string) => {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const stem = path.basename(filePath, ext);
    for (let n = 1; n < 100; n += 1) {
      const target = path.join(dir, `${stem} (${n})${ext}`);
      try {
        await fs.access(target);
      } catch {
        await fs.copyFile(filePath, target);
        return target;
      }
    }
    return null;
  });

  /**
   * File > Delete.
   *
   * Deliberately the recycle bin rather than fs.unlink: this sits one click deep
   * in a dropdown, and an unrecoverable delete there is a data-loss bug.
   */
  ipcMain.handle('fs:trashFile', async (_e, filePath: string) => {
    await shell.trashItem(filePath);
    return true;
  });

  ipcMain.handle('fs:listDocuments', async (_e, folderPath: string) => {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      const docs = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (!DOCUMENT_EXTENSIONS.includes(ext)) continue;
        const fullPath = path.join(folderPath, entry.name);
        const stat = await fs.stat(fullPath);
        docs.push({ path: fullPath, name: entry.name, modified: stat.mtimeMs, size: stat.size });
      }
      return docs.sort((a, b) => b.modified - a.modified);
    } catch {
      return [];
    }
  });
}
