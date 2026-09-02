import { app, type BrowserWindow } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';

const SUPPORTED = new Set(['.officewrite', '.docx', '.doc', '.rtf', '.txt', '.html', '.htm']);

/** Channel the main process uses to hand a file path to the renderer. */
export const OPEN_FILE_CHANNEL = 'officewrite:open-file';

let pending: string | null = null;
let targetWindow: BrowserWindow | null = null;

function isSupportedDocument(candidate: string): boolean {
  if (!candidate || candidate.startsWith('-')) return false;
  if (!SUPPORTED.has(path.extname(candidate).toLowerCase())) return false;
  return existsSync(candidate);
}

/**
 * Pull a document path out of a process argv vector.
 *
 * The installer registers .docx and .officewrite file associations, but nothing
 * ever read argv, so double-clicking an associated document opened Officewrite
 * to a blank home screen.
 */
export function documentFromArgv(argv: string[]): string | null {
  // In a packaged app argv[0] is the executable; in dev, argv[1] is the app path.
  const start = app.isPackaged ? 1 : 2;
  for (const candidate of argv.slice(start)) {
    if (isSupportedDocument(candidate)) return path.resolve(candidate);
  }
  return null;
}

/** Route a path to the renderer, holding it until a window is listening. */
export function queueFileOpen(filePath: string | null) {
  if (!filePath || !isSupportedDocument(filePath)) return;
  if (targetWindow && !targetWindow.isDestroyed()) {
    if (targetWindow.isMinimized()) targetWindow.restore();
    targetWindow.focus();
    targetWindow.webContents.send(OPEN_FILE_CHANNEL, filePath);
    return;
  }
  pending = filePath;
}

/** Called once the renderer has mounted and can receive pushes. */
export function attachWindow(win: BrowserWindow) {
  targetWindow = win;
}

/**
 * Hand over any path captured before the renderer was ready. Consumed once so
 * a reload does not reopen the same file over the user's current document.
 */
export function takePendingFile(): string | null {
  const value = pending;
  pending = null;
  return value;
}
