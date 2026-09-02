import type { AppSettings, RecentFile, DocumentRevision } from '@officewrite/core';

export interface ListedDocument {
  path: string;
  name: string;
  modified: number;
  size: number;
}

export type ImportDocResult =
  | { format: 'docx'; data: ArrayBuffer; source: 'libreoffice' }
  | { format: 'text'; data: string; source: 'extractor'; warning: string };

/**
 * The complete contract between the renderer and the host process.
 *
 * Every member here must have a matching `ipcMain.handle` in `electron/` and a
 * matching stub in the test harness. Nothing in `src/` may reach for
 * `window.officewrite` directly - go through `platform` in ./index.ts so the
 * missing-bridge case stays handled in exactly one place.
 */
export interface OfficewriteAPI {
  openFile: () => Promise<string | null>;
  openImageFile: () => Promise<string | null>;
  /**
   * Mailings > Select Recipients. A separate picker rather than `openFile`
   * because the merge wants a CSV and the document picker filters those out -
   * users would have had to switch the filter to "All Files" to find their own
   * mailing list.
   */
  openDataFile: () => Promise<string | null>;
  saveFile: (defaultPath?: string) => Promise<string | null>;
  openFolder: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<Uint8Array>;
  readTextFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, data: Uint8Array | string) => Promise<boolean>;
  /** File > Rename: resolves the new path, or null if the name is taken. */
  renameFile: (filePath: string, newName: string) => Promise<string | null>;
  /** File > Create a Copy: resolves the path of the numbered duplicate. */
  copyFile: (filePath: string) => Promise<string | null>;
  /** File > Delete: sends the file to the recycle bin, never an unlink. */
  trashFile: (filePath: string) => Promise<boolean>;
  listDocuments: (folderPath: string) => Promise<ListedDocument[]>;
  getSettings: () => Promise<AppSettings | null>;
  setSettings: (settings: AppSettings) => Promise<boolean>;
  getRecents: () => Promise<RecentFile[]>;
  setRecents: (recents: RecentFile[]) => Promise<boolean>;
  getDefaultSaveDir: () => Promise<string>;
  printDocument: (options?: { copies?: number; pageRange?: string }) => Promise<boolean>;
  saveRevision: (docPath: string, snapshot: unknown, label: string) => Promise<DocumentRevision>;
  listRevisions: (docPath: string) => Promise<DocumentRevision[]>;
  loadRevision: (docPath: string, id: string) => Promise<unknown>;
  exportPdf: (savePath?: string, pageSize?: string) => Promise<Uint8Array | null>;
  importDoc: (filePath: string) => Promise<ImportDocResult>;
  spellCheckWords: (words: string[], language?: string) => Promise<boolean[]>;
  spellSuggest: (word: string, language?: string) => Promise<string[]>;
  /** Words the user added via "Add to dictionary". */
  getUserDictionary: () => Promise<string[]>;
  /** Teach the checker a word; resolves with the updated dictionary. */
  addWordToDictionary: (word: string) => Promise<string[]>;

  /**
   * Help tab: open a project URL in the user's browser. Resolves false when the
   * host rejects it - the allowlist lives in the main process, not here.
   */
  openExternal: (url: string) => Promise<boolean>;

  /** Mirror the unsaved-changes flag so the host can prompt before closing. */
  setDirty: (dirty: boolean) => Promise<boolean>;
  /** Resume (or abandon) a close the host paused to let the renderer save. */
  closeNow: (proceed: boolean) => Promise<boolean>;
  /** Called when the host wants the document saved before the window closes. */
  onSaveAndClose: (callback: () => void) => () => void;

  /** A document path captured at launch from a file association; consumed once. */
  takePendingFile: () => Promise<string | null>;
  /** A document opened while the app was already running. */
  onOpenFile: (callback: (filePath: string) => void) => () => void;
}
