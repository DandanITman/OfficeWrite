import { contextBridge, ipcRenderer } from 'electron';
import type { DocumentRevision } from '@officewrite/core';

const OPEN_FILE_CHANNEL = 'officewrite:open-file';
const SAVE_AND_CLOSE_CHANNEL = 'officewrite:save-and-close';

/**
 * Subscribe to a main-process push, returning an unsubscribe function.
 * The listener is wrapped so the renderer never receives the IpcRendererEvent.
 */
function subscribe<T extends unknown[]>(channel: string, callback: (...args: T) => void) {
  const handler = (_event: unknown, ...args: unknown[]) => callback(...(args as T));
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld('officewrite', {
  openFile: () => ipcRenderer.invoke('dialog:openFile') as Promise<string | null>,
  openImageFile: () => ipcRenderer.invoke('dialog:openImageFile') as Promise<string | null>,
  openDataFile: () => ipcRenderer.invoke('dialog:openDataFile') as Promise<string | null>,
  saveFile: (defaultPath?: string) =>
    ipcRenderer.invoke('dialog:saveFile', defaultPath) as Promise<string | null>,
  openFolder: () => ipcRenderer.invoke('dialog:openFolder') as Promise<string | null>,
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath) as Promise<Uint8Array>,
  readTextFile: (filePath: string) =>
    ipcRenderer.invoke('fs:readTextFile', filePath) as Promise<string>,
  writeFile: (filePath: string, data: Uint8Array | string) =>
    ipcRenderer.invoke('fs:writeFile', filePath, data) as Promise<boolean>,
  renameFile: (filePath: string, newName: string) =>
    ipcRenderer.invoke('fs:renameFile', filePath, newName) as Promise<string | null>,
  copyFile: (filePath: string) => ipcRenderer.invoke('fs:copyFile', filePath) as Promise<string | null>,
  trashFile: (filePath: string) => ipcRenderer.invoke('fs:trashFile', filePath) as Promise<boolean>,
  listDocuments: (folderPath: string) =>
    ipcRenderer.invoke('fs:listDocuments', folderPath) as Promise<
      Array<{ path: string; name: string; modified: number; size: number }>
    >,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: unknown) => ipcRenderer.invoke('settings:set', settings),
  getRecents: () => ipcRenderer.invoke('recents:get'),
  setRecents: (recents: unknown) => ipcRenderer.invoke('recents:set', recents),
  getDefaultSaveDir: () => ipcRenderer.invoke('app:getDefaultSaveDir') as Promise<string>,
  printDocument: (options?: { copies?: number; pageRange?: string }) =>
    ipcRenderer.invoke('print:document', options) as Promise<boolean>,
  saveRevision: (docPath: string, snapshot: unknown, label: string) =>
    ipcRenderer.invoke('revisions:save', docPath, snapshot, label) as Promise<DocumentRevision>,
  listRevisions: (docPath: string) =>
    ipcRenderer.invoke('revisions:list', docPath) as Promise<DocumentRevision[]>,
  loadRevision: (docPath: string, id: string) =>
    ipcRenderer.invoke('revisions:load', docPath, id) as Promise<unknown>,
  exportPdf: (savePath?: string, pageSize?: string) =>
    ipcRenderer.invoke('export:pdf', savePath, pageSize) as Promise<Uint8Array | null>,
  importDoc: (filePath: string) =>
    ipcRenderer.invoke('import:doc', filePath) as Promise<
      | { format: 'docx'; data: ArrayBuffer; source: 'libreoffice' }
      | { format: 'text'; data: string; source: 'extractor'; warning: string }
    >,
  spellCheckWords: (words: string[], language?: string) =>
    ipcRenderer.invoke('spell:checkWords', words, language) as Promise<boolean[]>,
  spellSuggest: (word: string, language?: string) =>
    ipcRenderer.invoke('spell:suggest', word, language) as Promise<string[]>,
  getUserDictionary: () => ipcRenderer.invoke('spell:getUserDictionary') as Promise<string[]>,
  addWordToDictionary: (word: string) =>
    ipcRenderer.invoke('spell:addWord', word) as Promise<string[]>,

  // Help tab: the main process re-checks the URL against its allowlist.
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<boolean>,

  // Unsaved-changes guard: the renderer mirrors its dirty flag to the main
  // process, which prompts on close and asks the renderer to save.
  setDirty: (dirty: boolean) => ipcRenderer.invoke('window:setDirty', dirty) as Promise<boolean>,
  closeNow: (proceed: boolean) => ipcRenderer.invoke('window:closeNow', proceed) as Promise<boolean>,
  onSaveAndClose: (callback: () => void) => subscribe(SAVE_AND_CLOSE_CHANNEL, callback),

  // File associations: a path captured at launch, plus pushes while running.
  takePendingFile: () => ipcRenderer.invoke('app:takePendingFile') as Promise<string | null>,
  onOpenFile: (callback: (filePath: string) => void) =>
    subscribe<[string]>(OPEN_FILE_CHANNEL, callback),
});
