import type { Editor } from '@tiptap/react';
import type { AppSettings, DocumentRevision, RecentFile } from '@officewrite/core';
import { DEFAULT_SETTINGS } from '@officewrite/core';

const FS_KEY = 'officewrite-test-fs';
const SETTINGS_KEY = 'officewrite-test-settings';
const RECENTS_KEY = 'officewrite-test-recents';
const REVISIONS_KEY = 'officewrite-test-revisions';
const BINARY_PREFIX = '__B64__:';

export type ImportDocResult =
  | { format: 'docx'; data: ArrayBuffer; source: 'libreoffice' }
  | { format: 'text'; data: string; source: 'extractor'; warning: string };

export interface OfficewriteTestHarness {
  reset: () => void;
  setOpenFileResult: (path: string | null) => void;
  setOpenImageFileResult: (path: string | null) => void;
  /** Mailings > Select Recipients picks through its own dialog. */
  setOpenDataFileResult: (path: string | null) => void;
  setSaveFileResult: (path: string | null) => void;
  setImportDocResult: (result: ImportDocResult) => void;
  setSpellCheckResults: (results: boolean[]) => void;
  setSpellSuggestions: (words: string[]) => void;
  readStoredFile: (path: string) => string | null;
  readStoredBinaryBase64: (path: string) => string | null;
  listStoredFiles: () => string[];
  seedFile: (path: string, content: string) => void;
  seedBinaryFile: (path: string, base64: string) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  setRecents: (recents: RecentFile[]) => void;
  getRecents: () => RecentFile[];
  setEditor: (editor: Editor | null) => void;
  loadEditorContent: (content: unknown) => void;
  getEditorJson: () => unknown;
  getEditorText: () => string;
  getEditorSelectionText: () => string;
  isDirty: () => boolean;
  setPendingFile: (path: string | null) => void;
  emitOpenFile: (path: string) => void;
  emitSaveAndClose: () => void;
  getExportPdfCallCount: () => number;
  getPrintCallCount: () => number;
  getLastPrintOptions: () => { copies?: number; pageRange?: string } | null;
  /** URLs Help handed to the host, so tests can assert without a real browser. */
  getOpenedExternalUrls: () => string[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

function normalizePath(filePath: string) {
  return filePath.replace(/\//g, '\\');
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function installMockOfficewrite(target: Window & typeof globalThis): OfficewriteTestHarness {
  let nextOpenFile: string | null = null;
  let nextOpenImageFile: string | null = null;
  let nextOpenDataFile: string | null = null;
  let nextSaveFile: string | null | undefined = undefined;
  let nextImportDoc: ImportDocResult | null = null;
  let spellResults: boolean[] | null = null;
  let spellSuggestions: string[] = ['suggestion'];
  let exportPdfCalls = 0;
  let lastPrintOptions: { copies?: number; pageRange?: string } | null = null;
  let printCalls = 0;
  let openedExternalUrls: string[] = [];
  let editorRef: Editor | null = null;
  let dirty = false;
  const userDictionary = new Set<string>();
  let pendingFile: string | null = null;
  const saveAndCloseListeners = new Set<() => void>();
  const openFileListeners = new Set<(filePath: string) => void>();

  const getFs = (): Record<string, string> => readJson(FS_KEY, {});
  const setFs = (fs: Record<string, string>) => writeJson(FS_KEY, fs);

  const getRevisions = (): Record<string, DocumentRevision[]> => readJson(REVISIONS_KEY, {});
  const setRevisions = (data: Record<string, DocumentRevision[]>) => writeJson(REVISIONS_KEY, data);

  const defaultImportDoc = (): ImportDocResult => ({
    format: 'text',
    data: 'Legacy doc text fallback',
    source: 'extractor',
    warning: 'Test mock import',
  });

  const api = {
    openFile: async () => {
      const path = nextOpenFile;
      nextOpenFile = null;
      return path;
    },
    openImageFile: async () => {
      const path = nextOpenImageFile ?? nextOpenFile;
      nextOpenImageFile = null;
      nextOpenFile = null;
      return path;
    },
    openDataFile: async () => {
      // Falls back to the generic open result so a test that only needs "the
      // user picked a file" does not have to know which picker was used.
      const path = nextOpenDataFile ?? nextOpenFile;
      nextOpenDataFile = null;
      nextOpenFile = null;
      return path;
    },
    saveFile: async (defaultPath?: string) => {
      if (nextSaveFile === null) {
        nextSaveFile = undefined;
        return null;
      }
      const path = nextSaveFile ?? defaultPath ?? 'C:\\OfficewriteTest\\Untitled.docx';
      nextSaveFile = undefined;
      return normalizePath(path);
    },
    openFolder: async () => 'C:\\OfficewriteTest\\folder',
    readFile: async (filePath: string) => {
      const content = getFs()[normalizePath(filePath)];
      if (content == null) throw new Error(`Missing test file: ${filePath}`);
      if (content.startsWith(BINARY_PREFIX)) {
        return base64ToBytes(content.slice(BINARY_PREFIX.length));
      }
      return new TextEncoder().encode(content);
    },
    readTextFile: async (filePath: string) => {
      const content = getFs()[normalizePath(filePath)];
      if (content == null) throw new Error(`Missing test file: ${filePath}`);
      if (content.startsWith(BINARY_PREFIX)) {
        return new TextDecoder().decode(base64ToBytes(content.slice(BINARY_PREFIX.length)));
      }
      return content;
    },
    writeFile: async (filePath: string, data: Uint8Array | string) => {
      const fs = getFs();
      const key = normalizePath(filePath);
      if (typeof data === 'string') {
        fs[key] = data;
      } else {
        fs[key] = `${BINARY_PREFIX}${bytesToBase64(data)}`;
      }
      setFs(fs);
      return true;
    },
    renameFile: async (filePath: string, newName: string) => {
      const fs = getFs();
      const key = normalizePath(filePath);
      const dir = key.slice(0, key.lastIndexOf('\\') + 1);
      const target = `${dir}${newName.split(/[\\/]/).pop()}`;
      if (target === key) return key;
      if (fs[target] !== undefined) return null;
      fs[target] = fs[key];
      delete fs[key];
      setFs(fs);
      return target;
    },
    copyFile: async (filePath: string) => {
      const fs = getFs();
      const key = normalizePath(filePath);
      const dot = key.lastIndexOf('.');
      const stem = dot > 0 ? key.slice(0, dot) : key;
      const ext = dot > 0 ? key.slice(dot) : '';
      for (let n = 1; n < 100; n += 1) {
        const target = `${stem} (${n})${ext}`;
        if (fs[target] === undefined) {
          fs[target] = fs[key];
          setFs(fs);
          return target;
        }
      }
      return null;
    },
    trashFile: async (filePath: string) => {
      const fs = getFs();
      delete fs[normalizePath(filePath)];
      setFs(fs);
      return true;
    },
    listDocuments: async (folderPath: string) => {
      const prefix = normalizePath(folderPath);
      return Object.keys(getFs())
        .filter((p) => p.startsWith(prefix))
        .map((p) => ({
          path: p,
          name: p.split('\\').pop() ?? p,
          modified: Date.parse('2026-01-15T12:00:00.000Z'),
          size: getFs()[p]?.length ?? 0,
        }));
    },
    getSettings: async () =>
      ({
        ...DEFAULT_SETTINGS,
        autoSaveIntervalMs: 0,
        ...readJson<Partial<AppSettings> | null>(SETTINGS_KEY, null),
      }) as AppSettings,
    setSettings: async (settings: AppSettings) => {
      writeJson(SETTINGS_KEY, settings);
      return true;
    },
    getRecents: async () => readJson<RecentFile[]>(RECENTS_KEY, []),
    setRecents: async (recents: RecentFile[]) => {
      writeJson(RECENTS_KEY, recents);
      return true;
    },
    getDefaultSaveDir: async () => 'C:\\OfficewriteTest',
    printDocument: async (options?: { copies?: number; pageRange?: string }) => {
      printCalls += 1;
      lastPrintOptions = options ?? null;
      return true;
    },
    // Mirrors the main process's allowlist so a test cannot pass here and fail
    // in the real app; the authoritative copy is electron/ipc/external.ts.
    openExternal: async (url: string) => {
      if (!/^https:\/\/github\.com\/DandanITman\/Officewrite(\/|$)/.test(url)) return false;
      openedExternalUrls.push(url);
      return true;
    },
    saveRevision: async (docPath: string, snapshot: unknown, label: string) => {
      const all = getRevisions();
      const key = normalizePath(docPath);
      const revision = {
        id: `rev-${(all[key]?.length ?? 0) + 1}`,
        label,
        timestamp: Date.now(),
        filePath: docPath,
        snapshot,
      } as DocumentRevision & { snapshot: unknown };
      all[key] = [...(all[key] ?? []), revision];
      setRevisions(all);
      return revision;
    },
    listRevisions: async (docPath: string) => getRevisions()[normalizePath(docPath)] ?? [],
    loadRevision: async (docPath: string, id: string) => {
      const match = (getRevisions()[normalizePath(docPath)] ?? []).find((r) => r.id === id) as
        | (DocumentRevision & { snapshot?: unknown })
        | undefined;
      if (!match?.snapshot) throw new Error(`Missing revision ${id}`);
      return match.snapshot;
    },
    exportPdf: async () => {
      exportPdfCalls += 1;
      return new Uint8Array([37, 80, 68, 70]);
    },
    importDoc: async () => {
      const result = nextImportDoc ?? defaultImportDoc();
      nextImportDoc = null;
      return result;
    },
    spellCheckWords: async (words: string[]) => {
      if (spellResults) return spellResults.slice(0, words.length);
      return words.map((w) => w.toLowerCase() !== 'teh');
    },
    spellSuggest: async () => spellSuggestions,
    getUserDictionary: async () => [...userDictionary],
    addWordToDictionary: async (word: string) => {
      userDictionary.add(word.toLowerCase());
      return [...userDictionary];
    },
    setDirty: async (value: boolean) => {
      dirty = value;
      return true;
    },
    closeNow: async () => true,
    onSaveAndClose: (callback: () => void) => {
      saveAndCloseListeners.add(callback);
      return () => saveAndCloseListeners.delete(callback);
    },
    takePendingFile: async () => {
      const value = pendingFile;
      pendingFile = null;
      return value;
    },
    onOpenFile: (callback: (filePath: string) => void) => {
      openFileListeners.add(callback);
      return () => openFileListeners.delete(callback);
    },
  };

  const harness: OfficewriteTestHarness = {
    reset: () => {
      nextOpenFile = null;
      nextOpenImageFile = null;
      nextOpenDataFile = null;
      nextSaveFile = undefined;
      nextImportDoc = null;
      spellResults = null;
      spellSuggestions = ['suggestion'];
      exportPdfCalls = 0;
      printCalls = 0;
      lastPrintOptions = null;
      openedExternalUrls = [];
      editorRef = null;
      dirty = false;
      userDictionary.clear();
      pendingFile = null;
      saveAndCloseListeners.clear();
      openFileListeners.clear();
      localStorage.removeItem(FS_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(RECENTS_KEY);
      localStorage.removeItem(REVISIONS_KEY);
    },
    setOpenFileResult: (path) => {
      nextOpenFile = path ? normalizePath(path) : null;
    },
    setOpenImageFileResult: (path) => {
      nextOpenImageFile = path ? normalizePath(path) : null;
    },
    setOpenDataFileResult: (path) => {
      nextOpenDataFile = path ? normalizePath(path) : null;
    },
    setSaveFileResult: (path) => {
      nextSaveFile = path ? normalizePath(path) : null;
    },
    setImportDocResult: (result) => {
      nextImportDoc = result;
    },
    setSpellCheckResults: (results) => {
      spellResults = results;
    },
    setSpellSuggestions: (words) => {
      spellSuggestions = words;
    },
    readStoredFile: (path) => {
      const content = getFs()[normalizePath(path)];
      if (!content || content.startsWith(BINARY_PREFIX)) return null;
      return content;
    },
    readStoredBinaryBase64: (path) => {
      const content = getFs()[normalizePath(path)];
      if (!content?.startsWith(BINARY_PREFIX)) return null;
      return content.slice(BINARY_PREFIX.length);
    },
    listStoredFiles: () => Object.keys(getFs()),
    seedFile: (path, content) => {
      const fs = getFs();
      fs[normalizePath(path)] = content;
      setFs(fs);
    },
    seedBinaryFile: (path, base64) => {
      const fs = getFs();
      fs[normalizePath(path)] = `${BINARY_PREFIX}${base64}`;
      setFs(fs);
    },
    setSettings: (settings) => {
      const current = readJson<Partial<AppSettings> | null>(SETTINGS_KEY, null) ?? {};
      writeJson(SETTINGS_KEY, { ...current, ...settings });
    },
    setRecents: (recents) => writeJson(RECENTS_KEY, recents),
    getRecents: () => readJson<RecentFile[]>(RECENTS_KEY, []),
    setEditor: (editor) => {
      editorRef = editor;
    },
    loadEditorContent: (content) => {
      editorRef?.commands.setContent(content as object);
    },
    getEditorJson: () => editorRef?.getJSON() ?? null,
    getEditorText: () => editorRef?.getText() ?? '',
    getEditorSelectionText: () => {
      if (!editorRef) return '';
      const { from, to } = editorRef.state.selection;
      return editorRef.state.doc.textBetween(from, to, ' ');
    },
    isDirty: () => dirty,
    setPendingFile: (path: string | null) => {
      pendingFile = path ? normalizePath(path) : null;
    },
    emitOpenFile: (path: string) => {
      openFileListeners.forEach((cb) => cb(normalizePath(path)));
    },
    emitSaveAndClose: () => {
      saveAndCloseListeners.forEach((cb) => cb());
    },
    getExportPdfCallCount: () => exportPdfCalls,
    getPrintCallCount: () => printCalls,
    getLastPrintOptions: () => lastPrintOptions,
    getOpenedExternalUrls: () => [...openedExternalUrls],
  };

  target.officewrite = api as Window['officewrite'];
  target.__OFFICEWRITE_TEST__ = harness;
  return harness;
}
