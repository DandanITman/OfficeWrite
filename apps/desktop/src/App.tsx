import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  DEFAULT_SETTINGS,
  TEMPLATES,
  MARGIN_PRESETS,
  applyStyleSet,
  createDocumentEnvelope,
  builtinStylesWithDefaults,
  formatBibliography,
  formatCitation,
  type AppSettings,
  type AppView,
  type CaptionLabel,
  type CitationStyle,
  type RecentFile,
  type RibbonTab,
  type PageSetup,
  type DocumentComment,
  type DocumentRevision,
  type DocumentEnvelope,
  type AccessibilityIssue,
  checkAccessibility,
  ENVELOPE_PRESETS,
  LABEL_PRESETS,
  autoMatchFields,
  checkMergeErrors,
  collectMergePrompts,
  dataSourceFromText,
  executeMerge,
  includedRecipients,
  mergeFieldNames,
  usesCompositeFields,
  type FieldMapping,
  type MergeDataSource,
  type MergeFieldAttrs,
  type MergeProblem,
  type MergeRuleKind,
  type MergeType,
} from '@officewrite/core';
import {
  exportToDocx,
  importDocxEnvelope,
  exportToRtf,
  importFromRtf,
  exportToHtml,
  importFromHtml,
  importFromDocText,
  wrapOfficewriteFile,
  unwrapOfficewriteFile,
  type DocxExportOptions,
} from '@officewrite/openxml';
import { PanelLeft } from 'lucide-react';
import { applyPrintPageSetup } from './utils/printStyles';
import { StyleEditorDialog } from './components/StyleEditorDialog';
import { WatermarkDialog } from './components/WatermarkDialog';
import { WordCountDialog } from './components/WordCountDialog';
import { GoToDialog } from './components/GoToDialog';
import { HomeScreen } from './components/HomeScreen';
import { Ribbon } from './ribbon/Ribbon';
import { CommandPalette } from './components/CommandPalette';
import {
  DEFAULT_IMMERSIVE,
  ImmersiveReaderBar,
  type ImmersiveSettings,
} from './components/ImmersiveReaderBar';
import type {
  EditingMode,
  RibbonLayout,
  RibbonVisibility,
} from './components/RibbonStripActions';
import type {
  MailMergeFlags,
  MarkupOptions,
  MarkupView,
  MergeDestination,
  MergeRecordStep,
  RibbonActions,
  RibbonFlags,
  ViewMode,
} from './ribbon/types';
import { StatusBar } from './components/StatusBar';
import { Backstage, type BackstageSection } from './components/Backstage';
import { WordEditor, insertNote } from './components/WordEditor';
import { FindReplaceBar } from './components/FindReplaceBar';
import { NavigationPane } from './components/NavigationPane';
import { DocumentRulers } from './components/DocumentRulers';
import { EditorTitleBar } from './components/EditorTitleBar';
import { PageSetupDialog, HeaderFooterDialog } from './components/PageSetupDialog';
import { CommentsPane } from './components/CommentsPane';
import { UiPromptHost } from './components/UiPromptHost';
import { ProofingPane } from './components/ProofingPane';
import { ThesaurusPane } from './components/ThesaurusPane';
import { ReviewingPane } from './components/ReviewingPane';
import { AccessibilityPane } from './components/AccessibilityPane';
import { MiniToolbar } from './components/MiniToolbar';
import { EditorContextMenu, type ContextMenuState } from './components/EditorContextMenu';
import {
  BordersShadingDialog,
  ColumnsDialog,
  FontDialog,
  PageBordersDialog,
  ParagraphDialog,
  TablePropertiesDialog,
  ZoomDialog,
} from './components/dialogs/FormatDialogs';
import {
  AltTextDialog,
  CrossReferenceDialog,
  EmojiDialog,
  PictureLayoutDialog,
  SymbolDialog,
} from './components/dialogs/InsertDialogs';
import { SourcesDialog } from './components/dialogs/ReferenceDialogs';
import {
  AddressBlockDialog,
  CheckMergeErrorsDialog,
  EnvelopesLabelsDialog,
  FindRecipientDialog,
  FinishMergeDialog,
  GreetingLineDialog,
  InsertMergeFieldDialog,
  MailMergeWizard,
  MatchFieldsDialog,
  MergeRuleDialog,
  NewRecipientListDialog,
  RecipientListDialog,
} from './components/dialogs/MailingsDialogs';
import { KeyboardShortcutsDialog, WhatsNewDialog } from './components/dialogs/HelpDialogs';
import { useFormatPainter } from './hooks/useFormatPainter';
import { useDocumentStats } from './hooks/useDocumentStats';
import { useRibbonState } from './ribbon/useRibbonState';
import { uiAlert, uiConfirm, uiPrompt } from './utils/uiPrompt';
import { promptForLink } from './utils/hyperlink';
import { bytesToDataUrl, mimeForImageExt } from './utils/imageInsert';
import { pasteFromClipboard } from './utils/clipboard';
import { insertTableOfContents } from './utils/headings';
import { restyleDocument } from './utils/applyStyle';
import {
  collectCaptions,
  collectIndexEntries,
  commentAnchorPositions,
  nextCaptionNumber,
  sortParagraphs,
  trackedChangePositions,
  updateGeneratedBlocks,
} from './utils/documentIndex';
import { compareDocuments } from './utils/compareDocuments';
import { setMergePreview } from './extensions/MergeField';
import {
  insertEnvelope,
  insertMergeField as insertMergeFieldNode,
  replaceWithFixedLabels,
  replaceWithLabelSheet,
  updateLabels as updateLabelSheet,
} from './utils/mailMergeEditor';
import { COVER_PAGE_TEMPLATES } from './constants/coverPages';
import { MAX_RECENT_EMOJI } from './constants/emoji';
import type { DocumentProofingIssue } from './extensions/ProofingCheck';
import type { InkTool } from './extensions/InkDrawing';
import {
  getPlatform,
  isPlatformAvailable,
  joinPath,
  baseName as getFileName,
  extensionOf as extOf,
} from './platform';

/** How long after the last keystroke the React copy of the document catches up. */
const CONTENT_MIRROR_DELAY_MS = 300;

/** The only site the Help tab links to; the host re-checks this allowlist. */
const REPO_URL = 'https://github.com/DandanITman/OfficeWrite';

/**
 * Hand a project URL to the user's browser.
 *
 * The app itself still makes no network requests - this opens the OS browser
 * and nothing is loaded in a Officewrite window. A refusal means the main-process
 * allowlist rejected the URL, which is worth surfacing rather than swallowing.
 */
async function openProjectUrl(url: string) {
  if (!isPlatformAvailable()) {
    await uiAlert(`Open ${url} in your browser.`);
    return;
  }
  const opened = await getPlatform().openExternal(url);
  if (!opened) await uiAlert(`Officewrite would not open ${url}.`);
}

function suggestedSavePath(defaultDir: string, name: string, ext = 'docx') {
  const base = name.replace(/\.[^.]+$/, '') || 'Untitled';
  return joinPath(defaultDir, `${base}.${ext}`);
}

function newComment(text: string, author: string, anchorText?: string): DocumentComment {
  return {
    id: crypto.randomUUID(),
    text,
    author,
    created: new Date().toISOString(),
    resolved: false,
    anchorText,
  };
}

function docxExportOpts(envelope: DocumentEnvelope, title: string): DocxExportOptions {
  return {
    title,
    pageSetup: envelope.pageSetup,
    headerFooter: envelope.headerFooter,
    footnotes: envelope.footnotes,
    watermark: envelope.watermark,
    customStyles: envelope.customStyles,
    comments: envelope.comments,
  };
}

function pdfPageSize(pageSetup: PageSetup): string {
  if (pageSetup.size === 'a4') return 'A4';
  if (pageSetup.size === 'legal') return 'Legal';
  return 'Letter';
}

const DEFAULT_MARKUP_OPTIONS: MarkupOptions = {
  insertionsAndDeletions: true,
  formatting: true,
  comments: true,
};

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [envelope, setEnvelope] = useState<DocumentEnvelope>(() =>
    createDocumentEnvelope(TEMPLATES[0].content),
  );
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState('Untitled');
  const [isDirty, setIsDirty] = useState(false);
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('home');
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [ribbonLayout, setRibbonLayout] = useState<RibbonLayout>('classic');
  const [ribbonVisibility, setRibbonVisibility] = useState<RibbonVisibility>('alwaysShow');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [zoom, setZoom] = useState(100);
  const [backstageOpen, setBackstageOpen] = useState(false);
  const [backstageSection, setBackstageSection] = useState<BackstageSection>('info');
  const [findOpen, setFindOpen] = useState(false);
  const [findFocus, setFindFocus] = useState<'find' | 'replace'>('find');
  const [navOpen, setNavOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('print');
  const focusMode = viewMode === 'focus';
  const [immersive, setImmersive] = useState<ImmersiveSettings>(DEFAULT_IMMERSIVE);
  const [showGridlines, setShowGridlines] = useState(false);
  // View > Show. Header/footer and the notes areas are on by default.
  const [showHeaderFooter, setShowHeaderFooter] = useState(true);
  const [showFootnotes, setShowFootnotes] = useState(true);
  const [showEndnotes, setShowEndnotes] = useState(true);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibilityIssues, setAccessibilityIssues] = useState<AccessibilityIssue[]>([]);
  const [markupView, setMarkupView] = useState<MarkupView>('all');
  const [markupOptions, setMarkupOptions] = useState<MarkupOptions>(DEFAULT_MARKUP_OPTIONS);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [headerFooterOpen, setHeaderFooterOpen] = useState(false);
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [goToOpen, setGoToOpen] = useState(false);
  const [dialog, setDialog] = useState<
    | null
    | 'font'
    | 'paragraph'
    | 'columns'
    | 'borders'
    | 'pageBorders'
    | 'zoom'
    | 'symbol'
    | 'crossReference'
    | 'altText'
    | 'pictureLayout'
    | 'tableProperties'
    | 'sources'
    | 'emoji'
    | 'shortcuts'
    | 'whatsNew'
  >(null);
  const [editorSyncKey, setEditorSyncKey] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [userDictionary, setUserDictionary] = useState<string[]>([]);
  const [sessionIgnored, setSessionIgnored] = useState<string[]>([]);
  const [proofingIssues, setProofingIssues] = useState<DocumentProofingIssue[]>([]);
  const [proofingOpen, setProofingOpen] = useState(false);
  const [thesaurusOpen, setThesaurusOpen] = useState(false);
  const [reviewingPaneOpen, setReviewingPaneOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [ink, setInk] = useState<{ tool: InkTool; color: string; width: number }>({
    tool: 'pen',
    color: '#000000',
    width: 2,
  });

  /**
   * Mailings state.
   *
   * One object rather than eight `useState` calls, because the pieces only make
   * sense together: attaching a list has to reset the mapping, the record
   * pointer and the preview at the same instant, and three separate setters
   * would render an intermediate state where the preview points at a record from
   * the previous list.
   */
  const [mailMerge, setMailMerge] = useState<{
    type: MergeType;
    source: MergeDataSource | null;
    mapping: FieldMapping;
    previewActive: boolean;
    highlightFields: boolean;
    /** 1-based over the ticked recipients. */
    recordIndex: number;
    labelPresetId: string;
    envelopePresetId: string;
  }>({
    type: 'letters',
    source: null,
    mapping: {},
    previewActive: false,
    highlightFields: false,
    recordIndex: 1,
    labelPresetId: LABEL_PRESETS[0].id,
    envelopePresetId: ENVELOPE_PRESETS[0].id,
  });
  const [mailingsDialog, setMailingsDialog] = useState<
    | null
    | 'envelopes'
    | 'labels'
    | 'recipients'
    | 'newList'
    | 'addressBlock'
    | 'greetingLine'
    | 'insertField'
    | 'matchFields'
    | 'findRecipient'
    | 'checkErrors'
    | 'finishMerge'
  >(null);
  const [mergeRule, setMergeRule] = useState<MergeRuleKind | null>(null);
  const [mergeProblems, setMergeProblems] = useState<MergeProblem[]>([]);
  /**
   * Ask and Fill-in prompts, captured when Finish & Merge opens.
   *
   * Snapshotted rather than derived on every render. Deriving it meant reading
   * the live document, which hands back a fresh array each time and so gave the
   * dialog a new prop identity on every unrelated re-render.
   */
  const [mergePrompts, setMergePrompts] = useState<
    Array<{ rule: 'ask' | 'fillIn'; key: string; prompt: string; defaultText: string }>
  >([]);
  const [mergeDestination, setMergeDestination] = useState<MergeDestination>('documents');
  /** 0 closes the wizard; 1–6 are the wizard's steps. */
  const [mergeWizardStep, setMergeWizardStep] = useState(0);

  const autoSaveTimer = useRef<number | null>(null);
  const contentMirrorTimer = useRef<number | null>(null);
  const { active: formatPainterActive, copyFormat, applyFormat } = useFormatPainter(editor);

  const wordStats = useDocumentStats(editor, pageCount);
  const ribbonState = useRibbonState(editor);

  const ignoredWords = useMemo(
    () => [...userDictionary, ...sessionIgnored],
    [userDictionary, sessionIgnored],
  );

  // The ink pen is a property of the tool, not of each drawing, so the canvases
  // read it from here rather than from their own attributes.
  useEffect(() => {
    window.__OFFICEWRITE_INK__ = ink;
    window.dispatchEvent(new Event('officewrite:ink-settings'));
  }, [ink]);

  const mergeRecipients = useMemo(
    () => includedRecipients(mailMerge.source),
    [mailMerge.source],
  );

  /**
   * Publish the preview to the merge-field node views.
   *
   * Same reasoning as the ink pen above: Preview Results changes how fields
   * *draw*, not what the document contains, so pushing it through a ProseMirror
   * transaction would put one undo entry on the stack per press of Next Record.
   */
  useEffect(() => {
    const recipient = mailMerge.previewActive
      ? (mergeRecipients[mailMerge.recordIndex - 1] ?? null)
      : null;
    setMergePreview({
      active: mailMerge.previewActive && recipient !== null,
      highlight: mailMerge.highlightFields,
      context: {
        recipient,
        recordNumber: recipient?.id ?? 0,
        sequenceNumber: mailMerge.recordIndex,
        mapping: mailMerge.mapping,
        // Ask and Fill-in are answered at Finish & Merge, so the preview shows
        // their defaults rather than inventing an answer.
        bookmarks: {},
      },
    });
  }, [
    mailMerge.previewActive,
    mailMerge.highlightFields,
    mailMerge.recordIndex,
    mailMerge.mapping,
    mergeRecipients,
  ]);

  const cancelContentMirror = useCallback(() => {
    if (contentMirrorTimer.current !== null) {
      window.clearTimeout(contentMirrorTimer.current);
      contentMirrorTimer.current = null;
    }
  }, []);

  /**
   * Mirror the document into React state on a short debounce.
   *
   * This ran on every keystroke: each character replaced `envelope.content`,
   * re-rendering App and the whole editor chrome below it. Nothing needs the
   * mirror to be keystroke-exact - saving reads the editor directly (see
   * `writeDocumentTo`) and the panes only need to be current once the user
   * pauses.
   */
  const handleEditorUpdate = useCallback(
    (json: unknown) => {
      setIsDirty(true);
      cancelContentMirror();
      contentMirrorTimer.current = window.setTimeout(() => {
        contentMirrorTimer.current = null;
        setEnvelope((prev) => ({ ...prev, content: json }));
      }, CONTENT_MIRROR_DELAY_MS);
    },
    [cancelContentMirror],
  );

  useEffect(() => cancelContentMirror, [cancelContentMirror]);

  const updateEnvelope = useCallback((partial: Partial<DocumentEnvelope>) => {
    setEnvelope((prev) => ({ ...prev, ...partial }));
    setIsDirty(true);
  }, []);

  const updatePageSetup = useCallback(
    (partial: Partial<PageSetup>) => {
      setEnvelope((prev) => ({ ...prev, pageSetup: { ...prev.pageSetup, ...partial } }));
      setIsDirty(true);
    },
    [],
  );

  const loadRevisions = useCallback(async (path: string) => {
    const list = await getPlatform().listRevisions(path);
    setRevisions(list);
  }, []);

  useEffect(() => {
    applyPrintPageSetup(envelope.pageSetup, envelope.headerFooter);
  }, [envelope.pageSetup, envelope.headerFooter]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.style.setProperty('--accent', settings.accentColor);
    document.documentElement.style.setProperty(
      '--accent-hover',
      `color-mix(in srgb, ${settings.accentColor} 85%, black)`,
    );
    document.documentElement.style.setProperty('--font-doc', settings.defaultFontFamily);
    document.documentElement.style.setProperty('--font-doc-size', `${settings.defaultFontSize}pt`);
    getPlatform().setSettings(settings);
  }, [settings]);

  useEffect(() => {
    const initApp = async () => {
      const savedSettings = await getPlatform().getSettings();
      if (savedSettings) {
        setSettings((prev) => ({ ...prev, ...savedSettings }));
      }
      const savedRecents = await getPlatform().getRecents();
      if (savedRecents && savedRecents.length) {
        setRecents(savedRecents);
      }
      setUserDictionary(await getPlatform().getUserDictionary());
    };
    initApp();
  }, []);

  const persistRecents = useCallback(async (next: RecentFile[]) => {
    setRecents(next);
    await getPlatform().setRecents(next);
  }, []);

  const updateRecentFile = useCallback(async (path: string) => {
    const name = getFileName(path);
    const nextRecents = recents.filter((r) => r.path !== path);
    const existing = recents.find((r) => r.path === path);
    const updated = [
      { path, name, lastOpened: Date.now(), pinned: existing?.pinned ?? false },
      ...nextRecents,
    ].slice(0, 30);
    await persistRecents(updated);
  }, [persistRecents, recents]);

  const openDocumentEnvelope = useCallback(
    (env: DocumentEnvelope, path: string | null, name: string) => {
      // A pending mirror belongs to the document being replaced; letting it
      // fire would write the old content over the new one.
      cancelContentMirror();
      setEnvelope(env);
      setFilePath(path);
      setFileName(name);
      setBackstageOpen(false);
      setCommentsOpen(false);
      setNavOpen(false);
      setFindOpen(false);
      setProofingOpen(false);
      setThesaurusOpen(false);
      setReviewingPaneOpen(false);
      setView('editor');
      setEditorSyncKey((k) => k + 1);
    },
    [cancelContentMirror],
  );

  /** Read a document file into an envelope, for Open and for Compare. */
  const readDocumentAt = useCallback(async (path: string): Promise<DocumentEnvelope | null> => {
    const ext = extOf(path);
    if (ext === 'officewrite') {
      const raw = await getPlatform().readTextFile(path);
      try {
        return unwrapOfficewriteFile(JSON.parse(raw));
      } catch {
        await uiAlert('That .officewrite file is corrupted and could not be opened.');
        return null;
      }
    }
    if (ext === 'docx') {
      const buffer = await getPlatform().readFile(path);
      const arrayBuffer = (buffer.buffer as ArrayBuffer).slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
      return importDocxEnvelope(arrayBuffer);
    }
    if (ext === 'doc') {
      const res = await getPlatform().importDoc(path);
      if (res.format === 'docx') return importDocxEnvelope(res.data);
      // Not awaited: this reports how the file was converted, and awaiting it
      // held the document closed behind a modal until the user clicked OK.
      void uiAlert(res.warning);
      return createDocumentEnvelope(importFromDocText(res.data));
    }
    if (ext === 'rtf') {
      return createDocumentEnvelope(importFromRtf(await getPlatform().readTextFile(path)));
    }
    if (ext === 'html' || ext === 'htm') {
      return createDocumentEnvelope(importFromHtml(await getPlatform().readTextFile(path)));
    }
    if (ext === 'txt') {
      const raw = await getPlatform().readTextFile(path);
      const lines = raw.split(/\r?\n/).map((line) => ({
        type: 'paragraph' as const,
        content: line ? [{ type: 'text' as const, text: line }] : [],
      }));
      return createDocumentEnvelope({ type: 'doc', content: lines });
    }
    await uiAlert('Unsupported file type.');
    return null;
  }, []);

  const openDocumentAtPath = useCallback(
    async (path: string) => {
      const loaded = await readDocumentAt(path);
      if (!loaded) return;
      openDocumentEnvelope(loaded, path, getFileName(path));
      await updateRecentFile(path);
      await loadRevisions(path);
    },
    [readDocumentAt, openDocumentEnvelope, loadRevisions, updateRecentFile],
  );

  /**
   * Write the document to a path in the format its extension names.
   *
   * `adopt` controls whether this becomes the open document. Exports pass
   * false: every Backstage export used to call saveDocument(path), which
   * reassigned filePath and cleared the dirty flag, so after "Export as HTML"
   * the open document *was* the .html file and the next Ctrl+S overwrote it.
   */
  const writeDocumentTo = useCallback(
    async (targetPath: string, adopt: boolean) => {
      const ext = extOf(targetPath);

      // Read the document from the editor, not from `envelope.content`: the
      // mirror is debounced, so saving straight after a keystroke would
      // otherwise write the document as it was up to a third of a second ago.
      const doc: DocumentEnvelope = editor
        ? { ...envelope, content: editor.getJSON() }
        : envelope;

      if (ext === 'docx') {
        const docxBlob = await exportToDocx(doc.content, docxExportOpts(doc, fileName));
        const arrayBuffer = await docxBlob.arrayBuffer();
        await getPlatform().writeFile(targetPath, new Uint8Array(arrayBuffer));
      } else if (ext === 'txt') {
        await getPlatform().writeFile(targetPath, editor?.getText() ?? '');
      } else if (ext === 'rtf') {
        await getPlatform().writeFile(targetPath, exportToRtf(doc.content, fileName));
      } else if (ext === 'html' || ext === 'htm') {
        await getPlatform().writeFile(
          targetPath,
          exportToHtml(doc.content, doc.metadata.title || fileName, {
            author: doc.metadata.author,
            subject: doc.metadata.subject,
          }),
        );
      } else if (ext === 'officewrite') {
        const wrapped = wrapOfficewriteFile(doc.content, doc.metadata, {
          pageSetup: doc.pageSetup,
          headerFooter: doc.headerFooter,
          comments: doc.comments,
          trackChangesEnabled: doc.trackChangesEnabled,
          watermark: doc.watermark,
          customStyles: doc.customStyles,
          footnotes: doc.footnotes,
        });
        await getPlatform().writeFile(targetPath, JSON.stringify(wrapped, null, 2));
      } else {
        // Previously the fallback branch: typing "Report.pdf" in the save
        // dialog silently wrote a .officewrite JSON blob under that name.
        await uiAlert(
          `Cannot save as ".${ext || 'unknown'}". Choose .docx, .officewrite, .rtf, .html or .txt.`,
        );
        return false;
      }

      // A version snapshot for every format, not just .officewrite. Since .docx is
      // the default save format, Version History was empty for normal users.
      await getPlatform()
        .saveRevision(targetPath, doc, `Saved ${new Date().toLocaleString()}`)
        .catch(() => undefined);

      if (adopt) {
        setFilePath(targetPath);
        setFileName(getFileName(targetPath));
        setIsDirty(false);
        await loadRevisions(targetPath);
        await updateRecentFile(targetPath);
      }
      return true;
    },
    [editor, envelope, fileName, loadRevisions, updateRecentFile],
  );

  const saveDocument = useCallback(
    async (pathOverride?: string | null, forceDialog = false) => {
      let targetPath = pathOverride ?? filePath;
      if (!targetPath || forceDialog) {
        const defaultDir = await getPlatform().getDefaultSaveDir();
        const suggested = targetPath ?? suggestedSavePath(defaultDir, fileName, 'docx');
        targetPath = await getPlatform().saveFile(suggested);
        if (!targetPath) return false;
      }
      return writeDocumentTo(targetPath, true);
    },
    [fileName, filePath, writeDocumentTo],
  );

  /** Write a copy in another format without adopting it as the open document. */
  const exportDocumentAs = useCallback(
    async (ext: string) => {
      const defaultDir = await getPlatform().getDefaultSaveDir();
      const path = await getPlatform().saveFile(suggestedSavePath(defaultDir, fileName, ext));
      if (!path) return false;
      return writeDocumentTo(path, false);
    },
    [fileName, writeDocumentTo],
  );

  // Mirror the unsaved-changes flag to the host so it can prompt on close.
  useEffect(() => {
    void getPlatform().setDirty(isDirty);
  }, [isDirty]);

  // Electron adopts the page title for the native window frame, so the OS
  // title bar names the open document instead of just repeating the app name.
  useEffect(() => {
    document.title =
      view === 'editor' ? `${fileName}${isDirty ? ' *' : ''} - Officewrite` : 'Officewrite';
  }, [view, fileName, isDirty]);

  // The host paused a close so we could save; finish, then let it proceed.
  useEffect(() => {
    return getPlatform().onSaveAndClose(() => {
      void (async () => {
        const saved = await saveDocument().catch(() => false);
        await getPlatform().closeNow(!!saved);
      })();
    });
  }, [saveDocument]);

  // A document opened from Explorer, either at launch or while running.
  useEffect(() => {
    void (async () => {
      const pending = await getPlatform().takePendingFile();
      if (pending) await openDocumentAtPath(pending);
    })();
    return getPlatform().onOpenFile((incoming) => {
      void openDocumentAtPath(incoming);
    });
  }, [openDocumentAtPath]);

  useEffect(() => {
    if (!filePath || settings.autoSaveIntervalMs <= 0) return;
    autoSaveTimer.current && window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      saveDocument(filePath);
    }, settings.autoSaveIntervalMs);
    return () => {
      autoSaveTimer.current && window.clearTimeout(autoSaveTimer.current);
    };
  }, [envelope, filePath, saveDocument, settings.autoSaveIntervalMs]);

  const newFromTemplate = useCallback(
    (templateId: string) => {
      const tpl = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
      // The default font belongs in the document, not only in a CSS variable:
      // export reads the document's Normal style, so a new document has to
      // carry the preference for it to reach the .docx.
      const envelopeForTemplate = createDocumentEnvelope(tpl.content, {
        customStyles: builtinStylesWithDefaults(
          settings.defaultFontFamily,
          settings.defaultFontSize,
        ),
      });
      openDocumentEnvelope(envelopeForTemplate, null, 'Untitled');
      setEditorSyncKey((k) => k + 1);
      setIsDirty(false);
      setBackstageOpen(false);
    },
    [openDocumentEnvelope, settings.defaultFontFamily, settings.defaultFontSize],
  );

  const handleInsertImage = useCallback(async () => {
    const path = await getPlatform().openImageFile();
    if (!path || !editor) return;
    const ext = extOf(path);
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      await uiAlert('Please choose an image file.');
      return;
    }
    const bytes = await getPlatform().readFile(path);
    const dataUrl = bytesToDataUrl(bytes, mimeForImageExt(ext));
    editor.chain().focus().setImage({ src: dataUrl, alt: getFileName(path) }).run();
  }, [editor]);

  const handleInsertNote = useCallback(
    (kind: 'footnote' | 'endnote') => {
      if (!editor) return;
      // The editor mutation happens here, not inside the state updater: React
      // StrictMode double-invokes updaters, which inserted two references per
      // click in development.
      const existing = kind === 'endnote' ? envelope.endnotes : envelope.footnotes;
      const note = insertNote(editor, existing, kind);
      setEnvelope((prev) =>
        kind === 'endnote'
          ? { ...prev, endnotes: [...prev.endnotes, { id: note.id, text: '' }] }
          : { ...prev, footnotes: [...prev.footnotes, { id: note.id, text: '' }] },
      );
      setIsDirty(true);
      window.setTimeout(() => {
        const selector = kind === 'endnote' ? '.doc-endnotes' : '.doc-footnotes';
        const field = document.querySelector<HTMLElement>(
          `${selector} .doc-footnote-text:last-of-type`,
        );
        field?.focus();
      }, 0);
    },
    [editor, envelope.endnotes, envelope.footnotes],
  );

  const handleNoteChange = useCallback(
    (kind: 'footnote' | 'endnote') => (id: string, text: string) => {
      setEnvelope((prev) => {
        const list = kind === 'endnote' ? prev.endnotes : prev.footnotes;
        const next = list.map((note) => (note.id === id ? { ...note, text } : note));
        return kind === 'endnote' ? { ...prev, endnotes: next } : { ...prev, footnotes: next };
      });
      setIsDirty(true);
    },
    [],
  );

  const exportPdf = useCallback(async () => {
    const defaultDir = await getPlatform().getDefaultSaveDir();
    const suggested = fileName.replace(/\.[^.]+$/, '') || 'Document';
    const targetPath = await getPlatform().saveFile(joinPath(defaultDir, `${suggested}.pdf`));
    if (!targetPath) return;

    applyPrintPageSetup(envelope.pageSetup, envelope.headerFooter);

    // Reset zoom before rendering: the CSS transform would otherwise scale the
    // exported page. Waiting on two animation frames is tied to the browser
    // actually having painted, rather than the previous bare 200ms timeout.
    const originalZoom = zoom;
    setZoom(100);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    try {
      await getPlatform().exportPdf(targetPath, pdfPageSize(envelope.pageSetup));
    } finally {
      setZoom(originalZoom);
    }
  }, [envelope.headerFooter, envelope.pageSetup, fileName, zoom]);

  const togglePin = async (path: string) => {
    const next = recents.map((r) => (r.path === path ? { ...r, pinned: !r.pinned } : r));
    await persistRecents(next);
  };

  const restoreRevision = async (id: string) => {
    if (!filePath) return;
    const snapshot = (await getPlatform().loadRevision(filePath, id)) as Partial<DocumentEnvelope>;
    // Normalise through createDocumentEnvelope: a snapshot written by an older
    // build has none of the fields added since, and the ribbon reads them
    // directly (sources, endnotes…).
    const { content, ...rest } = snapshot;
    setEnvelope(createDocumentEnvelope(content, rest));
    setEditorSyncKey((k) => k + 1);
    setIsDirty(true);
    setBackstageOpen(false);
  };

  /** Home > Styles > Style set: restyle the paragraphs already in the document. */
  const applyDesign = useCallback(
    (styleSetId: string) => {
      const base = builtinStylesWithDefaults(settings.defaultFontFamily, settings.defaultFontSize);
      const styles = applyStyleSet(base, styleSetId);
      setEnvelope((prev) => ({ ...prev, customStyles: styles, styleSetId }));
      setIsDirty(true);
      if (editor) restyleDocument(editor, styles);
    },
    [editor, settings.defaultFontFamily, settings.defaultFontSize],
  );

  const goToNextIn = useCallback(
    (positions: number[], delta: number) => {
      if (!editor || !positions.length) return;
      const caret = editor.state.selection.from;
      const ordered = delta > 0 ? positions : [...positions].reverse();
      const next =
        ordered.find((pos) => (delta > 0 ? pos > caret : pos < caret)) ?? ordered[0];
      editor.chain().focus().setTextSelection(next).scrollIntoView().run();
    },
    [editor],
  );


  const addComment = useCallback(
    async () => {
      if (!editor) return;
      const { from, to, empty } = editor.state.selection;
      const text = await uiPrompt('Comment text');
      if (!text?.trim()) return;
      const anchorText = empty ? undefined : editor.state.doc.textBetween(from, to, ' ');
      const comment = newComment(text.trim(), settings.authorName || 'You', anchorText);
      setEnvelope((prev) => ({ ...prev, comments: [...prev.comments, comment] }));
      setIsDirty(true);
      setCommentsOpen(true);
      if (!empty) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .setMark('commentAnchor', { commentId: comment.id })
          .run();
      }
    },
    [editor, settings.authorName],
  );

  /** File > Rename: rename on disk, keeping the extension the document has. */
  const renameCurrentFile = useCallback(async () => {
    if (!filePath) return;
    const ext = extOf(filePath);
    const current = fileName.replace(/\.[^.]+$/, '');
    const entered = await uiPrompt('Rename document', current);
    const stem = entered?.trim().replace(/\.[^.]+$/, '');
    if (!stem || stem === current) return;

    const nextName = ext ? `${stem}.${ext}` : stem;
    const nextPath = await getPlatform().renameFile(filePath, nextName);
    if (!nextPath) {
      await uiAlert(`There is already a file called ${nextName} in that folder.`);
      return;
    }
    setFilePath(nextPath);
    setFileName(getFileName(nextPath));
    // The recents list still points at the old path, which no longer exists.
    void persistRecents(
      recents.map((entry) =>
        entry.path === filePath ? { ...entry, path: nextPath, name: getFileName(nextPath) } : entry,
      ),
    );
  }, [fileName, filePath, persistRecents, recents]);

  /** File > Create a Copy: duplicate on disk, leaving this document open. */
  const copyCurrentFile = useCallback(async () => {
    if (!filePath) return;
    // Save first, or the copy is of whatever was last written rather than of
    // what is on screen.
    if (isDirty) await saveDocument();
    const copyPath = await getPlatform().copyFile(filePath);
    if (!copyPath) {
      await uiAlert('Officewrite could not create a copy.');
      return;
    }
    await uiAlert(`Copied to ${getFileName(copyPath)}.`);
  }, [filePath, isDirty, saveDocument]);

  /** File > Delete: to the recycle bin, then back to the home screen. */
  const deleteCurrentFile = useCallback(async () => {
    if (!filePath) return;
    const confirmed = await uiConfirm(
      `Move ${fileName} to the recycle bin? The document will close.`,
    );
    if (!confirmed) return;

    await getPlatform().trashFile(filePath);
    void persistRecents(recents.filter((entry) => entry.path !== filePath));
    setIsDirty(false);
    setBackstageOpen(false);
    setView('home');
  }, [fileName, filePath, persistRecents, recents]);

  /** Review > Check Accessibility, run against the live document. */
  const runAccessibilityCheck = useCallback(
    () => (editor ? checkAccessibility(editor.getJSON(), envelope.pageSetup.pageColor) : []),
    [editor, envelope.pageSetup.pageColor],
  );

  /** Insert > Emojis keeps a most-recently-used row, persisted like settings. */
  const rememberEmoji = useCallback((emoji: string) => {
    setSettings((prev) => ({
      ...prev,
      recentEmoji: [emoji, ...(prev.recentEmoji ?? []).filter((entry) => entry !== emoji)].slice(
        0,
        MAX_RECENT_EMOJI,
      ),
    }));
  }, []);

  /**
   * The tab strip's Editing / Reviewing / Viewing picker.
   *
   * Derived rather than stored: read-only and track-changes are already real
   * document state that Review can change directly, so keeping a second copy
   * would let the two disagree.
   */
  const editingMode: EditingMode = envelope.restrictEditing
    ? 'viewing'
    : envelope.trackChangesEnabled
      ? 'reviewing'
      : 'editing';

  const applyEditingMode = useCallback((mode: EditingMode) => {
    updateEnvelope({
      restrictEditing: mode === 'viewing',
      trackChangesEnabled: mode === 'reviewing',
    });
  }, [updateEnvelope]);

  /* ---------------------------------------------------------------- *
   * Mailings
   * ---------------------------------------------------------------- */

  /**
   * Attach a recipient list.
   *
   * The mapping is guessed here rather than in the dialog, so a list attached
   * from the wizard, the ribbon menu or Type a New List all arrive matched.
   * Everything downstream - the pointer, the preview - resets with it, because a
   * record 7 from the previous list means nothing against the new one.
   */
  const attachDataSource = useCallback((source: MergeDataSource) => {
    setMailMerge((prev) => ({
      ...prev,
      source,
      mapping: autoMatchFields(source.fields),
      recordIndex: 1,
      previewActive: false,
    }));
  }, []);

  /** Select Recipients > Use an Existing List. */
  const pickExistingRecipientList = useCallback(async () => {
    const path = await getPlatform().openDataFile();
    if (!path) return;
    let text: string;
    try {
      text = await getPlatform().readTextFile(path);
    } catch {
      await uiAlert(`Officewrite could not read ${getFileName(path)}.`);
      return;
    }
    const source = dataSourceFromText(text, getFileName(path));
    if (source.fields.length === 0 || source.recipients.length === 0) {
      await uiAlert(
        `${getFileName(path)} has no rows Officewrite can read. It needs a header line and at least one row of data, separated by commas or tabs.`,
      );
      return;
    }
    attachDataSource(source);
  }, [attachDataSource]);

  /**
   * Move the preview pointer, clamped to the ticked rows.
   *
   * Turning the preview on as a side effect of stepping is deliberate: pressing
   * Next Record while previewing is off otherwise changes a number nobody can
   * see, which reads as a broken button.
   */
  const stepMergeRecord = useCallback(
    (step: MergeRecordStep) => {
      setMailMerge((prev) => {
        const count = includedRecipients(prev.source).length;
        if (count === 0) return prev;
        const current = Math.min(Math.max(1, prev.recordIndex), count);
        const next =
          step === 'first'
            ? 1
            : step === 'last'
              ? count
              : step === 'next'
                ? Math.min(count, current + 1)
                : Math.max(1, current - 1);
        return { ...prev, recordIndex: next, previewActive: true };
      });
    },
    [],
  );

  const goToMergeRecord = useCallback((index: number) => {
    setMailMerge((prev) => {
      const count = includedRecipients(prev.source).length;
      if (count === 0) return prev;
      return {
        ...prev,
        recordIndex: Math.min(count, Math.max(1, Math.round(index))),
        previewActive: true,
      };
    });
  }, []);

  /** Mailings > Check for Errors, run against the live document. */
  const runMergeCheck = useCallback(() => {
    const doc = editor?.getJSON() ?? envelope.content;
    setMergeProblems(
      checkMergeErrors(
        mergeFieldNames(doc),
        mailMerge.source,
        mailMerge.mapping,
        usesCompositeFields(doc),
      ),
    );
    setMailingsDialog('checkErrors');
  }, [editor, envelope.content, mailMerge.mapping, mailMerge.source]);

  /**
   * Finish & Merge.
   *
   * "Edit Individual Documents" opens the merged result as a new unsaved
   * document, as a merge is expected to - the main document with its fields stays
   * untouched, which is what lets you fix a typo and merge again.
   *
   * E-mail writes one file per recipient instead of sending anything. Officewrite
   * makes no network requests, so pretending to send mail would be a lie; the
   * dialog says so before the user commits.
   */
  const finishMerge = useCallback(
    async (request: { from: number; to: number; answers: Record<string, string> }) => {
      const doc = editor?.getJSON() ?? envelope.content;
      const result = executeMerge(doc, mailMerge.source, mailMerge.mapping, {
        type: mailMerge.type,
        from: request.from,
        to: request.to,
        answers: request.answers,
      });

      if (result.merged === 0) {
        await uiAlert(
          result.skipped > 0
            ? `Every record in that range was dropped by a Skip Record If rule (${result.skipped} skipped).`
            : 'There are no ticked recipients in that range, so there is nothing to merge.',
        );
        return;
      }

      if (mergeDestination === 'email') {
        const folder = await getPlatform().openFolder();
        if (!folder) return;

        // One document per recipient, so each file can be attached to its own
        // message. Merging them into one file would defeat the purpose.
        const recipients = mergeRecipients.slice(request.from - 1, request.to);
        let written = 0;
        for (let index = 0; index < recipients.length; index += 1) {
          const recipient = recipients[index];
          const single = executeMerge(doc, mailMerge.source, mailMerge.mapping, {
            type: mailMerge.type,
            from: request.from + index,
            to: request.from + index,
            answers: request.answers,
          });
          if (single.merged === 0) continue;

          // Named after whatever identifies the row, falling back to its number
          // so two nameless rows cannot overwrite each other.
          const label =
            mailMerge.mapping['E-mail Address'] && recipient.values[mailMerge.mapping['E-mail Address']!]
              ? recipient.values[mailMerge.mapping['E-mail Address']!]
              : `Recipient ${recipient.id}`;
          const safe = label.replace(/[^A-Za-z0-9._@-]+/g, '_').slice(0, 60);
          const target = joinPath(folder, `${safe}.docx`);
          const blob = await exportToDocx(
            single.content,
            docxExportOpts({ ...envelope, content: single.content }, safe),
          );
          await getPlatform().writeFile(target, new Uint8Array(await blob.arrayBuffer()));
          written += 1;
        }
        await uiAlert(
          `Wrote ${written} document(s) to ${folder}, one per recipient, ready to attach.`,
        );
        return;
      }

      const merged = createDocumentEnvelope(result.content, {
        pageSetup: envelope.pageSetup,
        headerFooter: envelope.headerFooter,
        customStyles: envelope.customStyles,
      });
      openDocumentEnvelope(merged, null, `${fileName.replace(/\.[^.]+$/, '')} (Merged)`);
      setEditorSyncKey((k) => k + 1);
      setIsDirty(true);
      // The merged copy has no fields left, so previewing it would be a no-op
      // control pointing at a list the document no longer references.
      setMailMerge((prev) => ({ ...prev, previewActive: false }));

      if (mergeDestination === 'print') {
        await getPlatform().printDocument();
        return;
      }
      const note = result.skipped > 0 ? ` ${result.skipped} record(s) were skipped by a rule.` : '';
      await uiAlert(`Merged ${result.merged} record(s) into a new document.${note}`);
    },
    [
      editor,
      envelope,
      fileName,
      mailMerge.mapping,
      mailMerge.source,
      mailMerge.type,
      mergeDestination,
      mergeRecipients,
      openDocumentEnvelope,
    ],
  );

  /** Rules with nothing to configure go straight in; the rest open the dialog. */
  const insertMergeRule = useCallback(
    (rule: MergeRuleKind) => {
      if (rule === 'mergeRecord' || rule === 'mergeSequence' || rule === 'nextRecord') {
        insertMergeFieldNode(editor, { kind: 'rule', rule });
        return;
      }
      setMergeRule(rule);
    },
    [editor],
  );

  const ribbonActions: RibbonActions = useMemo(
    () => ({
      onNew: () => newFromTemplate('blank'),
      onOpenFile: async () => {
        const path = await getPlatform().openFile();
        if (path) await openDocumentAtPath(path);
      },
      onSave: () => void saveDocument(),
      onSaveAs: () => void saveDocument(null, true),
      onOpenBackstage: () => {
        setBackstageOpen(true);
        setBackstageSection('export');
      },
      onOpenNewBackstage: () => {
        setBackstageOpen(true);
        setBackstageSection('new');
      },
      onOpenBackstageOpen: () => {
        setBackstageOpen(true);
        setBackstageSection('open');
      },
      onOpenInfo: () => {
        setBackstageOpen(true);
        setBackstageSection('info');
      },
      onOpenVersionHistory: () => {
        setBackstageOpen(true);
        setBackstageSection('history');
      },
      onRenameFile: () => void renameCurrentFile(),
      onCreateCopy: () => void copyCurrentFile(),
      onDeleteFile: () => void deleteCurrentFile(),
      onPrint: () => void getPlatform().printDocument(),
      onExportPdf: () => void exportPdf(),

      onPaste: (mode) => {
        if (editor) void pasteFromClipboard(editor, mode);
      },
      onFormatPainterCopy: copyFormat,
      onFormatPainterApply: applyFormat,
      onOpenStyleEditor: () => setStyleEditorOpen(true),
      onOpenFontDialog: () => setDialog('font'),
      onOpenParagraphDialog: () => setDialog('paragraph'),
      onOpenBordersDialog: () => setDialog('borders'),
      onSortParagraphs: (direction) => {
        if (editor) sortParagraphs(editor, direction);
      },
      onToggleFormattingMarks: () =>
        setSettings((prev) => ({ ...prev, showFormattingMarks: !prev.showFormattingMarks })),
      onToggleFindReplace: (field) => {
        setFindFocus(field ?? 'find');
        setFindOpen((open) => (field ? true : !open));
      },

      onInsertImage: () => void handleInsertImage(),
      onInsertShape: (type) => editor?.chain().focus().insertShape({ shapeType: type }).run(),
      onInsertTextBox: (style) => editor?.chain().focus().insertTextBox(style).run(),
      onInsertCoverPage: (id) => {
        const blocks = COVER_PAGE_TEMPLATES[id];
        if (!editor || !blocks) return;
        editor.chain().focus().setTextSelection(1).insertContentAt(0, blocks as never).run();
      },
      onInsertBlankPage: () =>
        editor?.chain().focus().insertPageBreak().insertContent({ type: 'paragraph' }).insertPageBreak().run(),
      onOpenHeaderFooter: () => setHeaderFooterOpen(true),
      onInsertPageNumbers: (show) =>
        updateEnvelope({ headerFooter: { ...envelope.headerFooter, showPageNumbers: show } }),
      onOpenSymbolPicker: () => setDialog('symbol'),
      onOpenEmojiPicker: () => setDialog('emoji'),
      onInsertBookmark: () => {
        if (!editor) return;
        void (async () => {
          // A bookmark is a mark, so it needs a range to attach to. The format allows
          // a collapsed bookmark; here the honest equivalent is to ask for the
          // text it should name rather than silently inserting the name.
          if (editor.state.selection.empty) {
            await uiAlert('Select the text you want to bookmark first.');
            return;
          }
          const name = await uiPrompt('Bookmark name', ribbonState.selectionText.slice(0, 40));
          if (!name?.trim()) return;
          editor.chain().focus().setBookmark(name.trim()).run();
        })();
      },
      onOpenCrossReference: () => setDialog('crossReference'),

      onInsertDrawingCanvas: () => editor?.chain().focus().insertDrawingCanvas().run(),
      onSetInkTool: (tool) => setInk((prev) => ({ ...prev, tool })),
      onSetInkColor: (color) => setInk((prev) => ({ ...prev, color, tool: prev.tool === 'eraser' ? 'pen' : prev.tool })),
      onSetInkWidth: (width) => setInk((prev) => ({ ...prev, width })),

      onApplyStyleSet: (id) => applyDesign(id),
      onOpenWatermark: () => setWatermarkOpen(true),
      onSetPageColor: (color) => updatePageSetup({ pageColor: color }),
      onOpenPageBorders: () => setDialog('pageBorders'),

      onOpenPageSetup: () => setPageSetupOpen(true),
      onApplyMarginPreset: (preset) => {
        const margins = MARGIN_PRESETS[preset];
        if (margins) updatePageSetup({ margins: { ...margins } });
      },
      onSetOrientation: (orientation) => updatePageSetup({ orientation }),
      onSetPageSize: (size) => updatePageSetup({ size }),
      onSetColumns: (count) =>
        updatePageSetup({ columns: { ...envelope.pageSetup.columns, count } }),
      onOpenColumnsDialog: () => setDialog('columns'),
      onSetLineNumbers: (mode) => updatePageSetup({ lineNumbers: mode }),
      onToggleHyphenation: () => updatePageSetup({ hyphenation: !envelope.pageSetup.hyphenation }),

      onInsertToc: () => {
        if (editor) void insertTableOfContents(editor);
      },
      onUpdateToc: () => {
        if (!editor) return;
        // The node view renders from the live document, so it is always current;
        // bumping the generation is what makes Update Table a real transaction
        // (and so undoable) rather than a silent no-op.
        if (!updateGeneratedBlocks(editor, 'tableOfContents', { generation: Date.now() })) {
          void uiAlert('This document has no table of contents yet.');
        }
      },
      onInsertFootnote: () => handleInsertNote('footnote'),
      onInsertEndnote: () => handleInsertNote('endnote'),
      onShowNotes: () => {
        const target = document.querySelector('.doc-footnotes, .doc-endnotes');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        else void uiAlert('This document has no footnotes or endnotes yet.');
      },
      onInsertCitation: (sourceId) => {
        const source = envelope.sources.find((entry) => entry.id === sourceId);
        if (!source || !editor) return;
        editor.chain().focus().insertContent(` ${formatCitation(source, envelope.citationStyle)}`).run();
      },
      onManageSources: () => setDialog('sources'),
      onSetCitationStyle: (style: CitationStyle) => updateEnvelope({ citationStyle: style }),
      onInsertBibliography: () => {
        if (!editor) return;
        const entries = formatBibliography(envelope.sources, envelope.citationStyle);
        if (updateGeneratedBlocks(editor, 'bibliography', { entries })) return;
        editor
          .chain()
          .focus()
          .insertContent([
            { type: 'bibliography', attrs: { title: 'Bibliography', entries } },
            { type: 'paragraph' },
          ] as never)
          .run();
      },
      onInsertCaption: (label: CaptionLabel) => {
        if (!editor) return;
        void (async () => {
          const number = nextCaptionNumber(editor, label);
          const text = await uiPrompt(`${label} ${number} caption text`, '');
          if (text === null) return;
          editor
            .chain()
            .focus()
            .insertContent({ type: 'paragraph', content: [{ type: 'text', text: `${label} ${number}. ${text}` }] })
            .markAsCaption(label)
            .run();
        })();
      },
      onInsertTableOfFigures: (label: CaptionLabel) => {
        if (!editor) return;
        const entries = collectCaptions(editor)
          .filter((caption) => caption.label === label)
          .map((caption) => caption.text);
        if (updateGeneratedBlocks(editor, 'tableOfFigures', { title: `Table of ${label}s`, entries })) return;
        editor
          .chain()
          .focus()
          .insertContent([
            { type: 'tableOfFigures', attrs: { title: `Table of ${label}s`, entries } },
            { type: 'paragraph' },
          ] as never)
          .run();
      },
      onMarkIndexEntry: () => {
        if (!editor || editor.state.selection.empty) {
          void uiAlert('Select the text to index first.');
          return;
        }
        const entry = ribbonState.selectionText.trim();
        editor.chain().focus().markIndexEntry(entry).run();
      },
      onInsertIndex: () => {
        if (!editor) return;
        const entries = collectIndexEntries(editor);
        if (updateGeneratedBlocks(editor, 'documentIndex', { entries })) return;
        editor
          .chain()
          .focus()
          .insertContent([
            { type: 'documentIndex', attrs: { title: 'Index', entries } },
            { type: 'paragraph' },
          ] as never)
          .run();
      },


      onOpenEnvelopes: () => setMailingsDialog('envelopes'),
      onOpenLabels: () => setMailingsDialog('labels'),
      onSetMergeType: (type) => {
        setMailMerge((prev) => ({ ...prev, type }));
        // Labels is the one type whose main document has a required shape, so
        // choosing it offers to build the sheet rather than leaving the user to
        // find Update Labels on a blank page.
        if (type === 'labels') setMailingsDialog('labels');
        if (type === 'envelopes') setMailingsDialog('envelopes');
      },
      onOpenMergeWizard: () => setMergeWizardStep(1),
      onNewRecipientList: () => setMailingsDialog('newList'),
      onUseExistingRecipientList: () => void pickExistingRecipientList(),
      onEditRecipientList: () => setMailingsDialog('recipients'),
      onToggleHighlightMergeFields: () =>
        setMailMerge((prev) => ({ ...prev, highlightFields: !prev.highlightFields })),
      onOpenAddressBlock: () => setMailingsDialog('addressBlock'),
      onOpenGreetingLine: () => setMailingsDialog('greetingLine'),
      onInsertMergeField: (field) => insertMergeFieldNode(editor, { kind: 'field', field }),
      onOpenInsertMergeField: () => setMailingsDialog('insertField'),
      onInsertMergeRule: insertMergeRule,
      onOpenMatchFields: () => setMailingsDialog('matchFields'),
      onUpdateLabels: () => {
        if (!updateLabelSheet(editor)) {
          void uiAlert(
            'Update Labels needs a label sheet. Use Mailings > Labels to build one first.',
          );
        }
      },
      onTogglePreviewResults: () =>
        setMailMerge((prev) => ({ ...prev, previewActive: !prev.previewActive })),
      onStepMergeRecord: stepMergeRecord,
      onGoToMergeRecord: goToMergeRecord,
      onOpenFindRecipient: () => setMailingsDialog('findRecipient'),
      onCheckMergeErrors: runMergeCheck,
      onFinishMerge: (destination) => {
        setMergeDestination(destination);
        setMergePrompts(collectMergePrompts(editor?.getJSON() ?? envelope.content));
        setMailingsDialog('finishMerge');
      },

      onOpenProofing: () => {
        setProofingOpen(true);
        setThesaurusOpen(false);
      },
      onOpenThesaurus: () => {
        setThesaurusOpen(true);
        setProofingOpen(false);
      },
      onOpenWordCount: () => setWordCountOpen(true),
      onOpenGoTo: () => setGoToOpen(true),
      onSetLanguage: (language) => setSettings((prev) => ({ ...prev, language })),
      onToggleSpellCheck: () =>
        setSettings((prev) => ({ ...prev, spellCheckEnabled: !prev.spellCheckEnabled })),
      onToggleGrammarCheck: () =>
        setSettings((prev) => ({ ...prev, grammarCheckEnabled: !prev.grammarCheckEnabled })),
      onNewComment: () => void addComment(),
      onDeleteComment: (scope) => {
        if (scope === 'all') {
          updateEnvelope({ comments: [] });
          return;
        }
        if (scope === 'resolved') {
          updateEnvelope({ comments: envelope.comments.filter((comment) => !comment.resolved) });
          return;
        }
        const last = envelope.comments[envelope.comments.length - 1];
        if (last) updateEnvelope({ comments: envelope.comments.filter((c) => c.id !== last.id) });
      },
      onGoToComment: (delta) => {
        if (!editor) return;
        setCommentsOpen(true);
        goToNextIn(
          commentAnchorPositions(editor).map((anchor) => anchor.pos),
          delta,
        );
      },
      onToggleComments: () => setCommentsOpen((open) => !open),
      onToggleTrackChanges: () =>
        updateEnvelope({ trackChangesEnabled: !envelope.trackChangesEnabled }),
      onSetMarkupView: setMarkupView,
      onToggleMarkupOption: (option) =>
        setMarkupOptions((prev) => ({ ...prev, [option]: !prev[option] })),
      onToggleReviewingPane: () => setReviewingPaneOpen((open) => !open),
      onGoToChange: (delta) => {
        if (editor) goToNextIn(trackedChangePositions(editor), delta);
      },
      onCompareDocuments: () => {
        void (async () => {
          if (!editor) return;
          const path = await getPlatform().openFile();
          if (!path) return;
          const other = await readDocumentAt(path);
          if (!other) return;
          const result = compareDocuments(editor.getJSON(), other.content, getFileName(path));
          if (!result.insertions && !result.deletions) {
            await uiAlert('The two documents have the same paragraphs.');
            return;
          }
          editor.commands.setContent(result.content as never);
          setMarkupView('all');
          setReviewingPaneOpen(true);
          setIsDirty(true);
          await uiAlert(
            `Compared against ${getFileName(path)}: ${result.insertions} added and ${result.deletions} removed paragraphs are marked as tracked changes.`,
          );
        })();
      },
      onToggleRestrictEditing: () => {
        void (async () => {
          if (!envelope.restrictEditing) {
            updateEnvelope({ restrictEditing: true });
            return;
          }
          const allow = await uiConfirm('Allow editing this document again?');
          if (allow) updateEnvelope({ restrictEditing: false });
        })();
      },

      onSetViewMode: setViewMode,
      onToggleFocusMode: () => setViewMode((mode) => (mode === 'focus' ? 'print' : 'focus')),
      onToggleRuler: () => setSettings((prev) => ({ ...prev, showRuler: !prev.showRuler })),
      onToggleGridlines: () => setShowGridlines((value) => !value),
      onToggleNavigation: () => setNavOpen((open) => !open),
      onSetZoom: setZoom,
      onOpenZoomDialog: () => setDialog('zoom'),
      onToggleShowHeaderFooter: () => setShowHeaderFooter((show) => !show),
      onToggleShowFootnotes: () => setShowFootnotes((show) => !show),
      onToggleShowEndnotes: () => setShowEndnotes((show) => !show),
      onToggleTheme: () =>
        setSettings((prev) => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' })),
      onToggleRibbonCollapsed: () => setRibbonCollapsed((collapsed) => !collapsed),
      onCheckAccessibility: () => {
        setAccessibilityIssues(runAccessibilityCheck());
        setAccessibilityOpen(true);
      },
      onZoomToFit: (fit) => {
        const workspace = document.querySelector('.editor-main');
        const available = (workspace?.clientWidth ?? 900) - 80;
        const dims = envelope.pageSetup;
        const pageWidth = dims.orientation === 'portrait' ? 816 : 1056;
        if (fit === 'pageWidth') setZoom(Math.max(50, Math.round((available / pageWidth) * 100)));
        else if (fit === 'onePage') setZoom(70);
        else setZoom(45);
      },

      onOpenHelp: () => void openProjectUrl(REPO_URL),
      onContactSupport: () => void openProjectUrl(`${REPO_URL}/issues`),
      onSendFeedback: () => void openProjectUrl(`${REPO_URL}/issues/new`),
      onOpenShortcuts: () => setDialog('shortcuts'),
      onOpenWhatsNew: () => setDialog('whatsNew'),

      onOpenAltText: () => setDialog('altText'),
      onOpenPictureLayout: () => setDialog('pictureLayout'),
      onResetPicture: () => editor?.chain().focus().resetImage().run(),
      onOpenTableProperties: () => setDialog('tableProperties'),
    }),
    [
      addComment,
      applyDesign,
      applyFormat,
      copyFormat,
      editor,
      envelope,
      exportPdf,
      goToNextIn,
      goToMergeRecord,
      handleInsertImage,
      handleInsertNote,
      insertMergeRule,
      newFromTemplate,
      openDocumentAtPath,
      pickExistingRecipientList,
      readDocumentAt,
      ribbonState.selectionText,
      runMergeCheck,
      saveDocument,
      stepMergeRecord,
      updateEnvelope,
      updatePageSetup,
    ],
  );

  // Standard keyboard shortcuts that are not editor commands.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+O and Ctrl+N make sense anywhere; the rest act on an open document.
      const editorOnly = view === 'editor';
      const key = e.key.toLowerCase();

      // Alt+Q opens the command search box.
      if (editorOnly && e.altKey && key === 'q') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (editorOnly && e.ctrlKey && key === 's') {
        e.preventDefault();
        // Ctrl+Shift+S is Save As, so it must force the dialog rather than
        // silently overwriting the open file.
        saveDocument(null, e.shiftKey);
      }
      // The conventional Save As key, alongside the Ctrl+Shift+S above.
      if (editorOnly && key === 'f12') {
        e.preventDefault();
        void saveDocument(null, true);
      }
      if (e.ctrlKey && key === 'o') {
        e.preventDefault();
        (async () => {
          const path = await getPlatform().openFile();
          if (path) await openDocumentAtPath(path);
        })();
      }
      if (e.ctrlKey && key === 'n') {
        e.preventDefault();
        newFromTemplate('blank');
      }
      if (editorOnly && e.ctrlKey && key === 'f') {
        e.preventDefault();
        setFindOpen(true);
        setFindFocus('find');
      }
      // Ctrl+G. Without it a long document had no way to jump to a page.
      if (editorOnly && e.ctrlKey && key === 'g') {
        e.preventDefault();
        setGoToOpen(true);
      }
      // Ctrl+H is Replace: it must land in the replace field, not repeat Ctrl+F.
      if (editorOnly && e.ctrlKey && key === 'h') {
        e.preventDefault();
        setFindOpen(true);
        setFindFocus('replace');
      }
      if (editorOnly && e.ctrlKey && key === 'p') {
        e.preventDefault();
        void getPlatform().printDocument();
      }
      // Ctrl+K runs the same command as Insert > Link.
      if (editorOnly && e.ctrlKey && key === 'k' && editor) {
        e.preventDefault();
        void promptForLink(editor);
      }
      if (editorOnly && e.key === 'F7') {
        e.preventDefault();
        if (e.shiftKey) {
          setThesaurusOpen(true);
          setProofingOpen(false);
        } else {
          setProofingOpen(true);
          setThesaurusOpen(false);
        }
      }
      if (e.ctrlKey && e.key === 'F1') {
        e.preventDefault();
        setRibbonCollapsed((collapsed) => !collapsed);
      }
      if (editorOnly && e.ctrlKey && e.shiftKey && key === 'e') {
        e.preventDefault();
        updateEnvelope({ trackChangesEnabled: !envelope.trackChangesEnabled });
      }
      if (editorOnly && e.ctrlKey && e.altKey && key === 'm') {
        e.preventDefault();
        void addComment();
      }
      if (editorOnly && e.ctrlKey && e.altKey && key === 'f') {
        e.preventDefault();
        handleInsertNote('footnote');
      }
      if (editorOnly && e.ctrlKey && e.altKey && key === 'd') {
        e.preventDefault();
        handleInsertNote('endnote');
      }
      if (editorOnly && e.ctrlKey && e.shiftKey && key === '8') {
        e.preventDefault();
        setSettings((prev) => ({ ...prev, showFormattingMarks: !prev.showFormattingMarks }));
      }
      if (editorOnly && e.ctrlKey && key === 'enter' && editor) {
        e.preventDefault();
        editor.chain().focus().insertPageBreak().run();
      }
      if (editorOnly && e.altKey && e.shiftKey && key === 'x' && editor) {
        e.preventDefault();
        if (!editor.state.selection.empty) {
          editor.chain().focus().markIndexEntry(ribbonState.selectionText.trim()).run();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    addComment,
    editor,
    envelope.trackChangesEnabled,
    handleInsertNote,
    newFromTemplate,
    openDocumentAtPath,
    ribbonState.selectionText,
    saveDocument,
    updateEnvelope,
    view,
  ]);

  const readOnly = envelope.restrictEditing;
  const showRulers = settings.showRuler && viewMode !== 'read' && viewMode !== 'focus';

  const ribbonFlags: RibbonFlags = {
          trackChangesEnabled: envelope.trackChangesEnabled,
          formatPainterActive,
          focusMode,
          customStyles: envelope.customStyles,
          pendingInsertions: wordStats.insertions,
          pendingDeletions: wordStats.deletions,
          viewMode,
          zoom,
          showFormattingMarks: settings.showFormattingMarks,
          showRuler: settings.showRuler,
          showGridlines,
          showHeaderFooter,
          showFootnotes,
          showEndnotes,
          theme: settings.theme,
          ribbonCollapsed,
          accessibilityOpen,
          accessibilityIssues: accessibilityIssues.length,
          navigationOpen: navOpen,
          commentsOpen,
          reviewingPaneOpen,
          markupView,
          markupOptions,
          restrictEditing: envelope.restrictEditing,
          language: settings.language,
          spellCheckEnabled: settings.spellCheckEnabled,
          grammarCheckEnabled: settings.grammarCheckEnabled,
          pageSetup: envelope.pageSetup,
          watermarkEnabled: envelope.watermark.enabled,
          showPageNumbers: envelope.headerFooter.showPageNumbers,
          styleSetId: envelope.styleSetId,
          citationStyle: envelope.citationStyle,
          sources: envelope.sources,
          commentCount: envelope.comments.length,
          unresolvedComments: envelope.comments.filter((comment) => !comment.resolved).length,
          ink,
          proofingIssues: proofingIssues.length,
          mailMerge: {
            type: mailMerge.type,
            source: mailMerge.source,
            mapping: mailMerge.mapping,
            previewActive: mailMerge.previewActive,
            highlightFields: mailMerge.highlightFields,
            // Clamped rather than stored clamped: unticking rows in the
            // recipient list can shrink the count under the pointer, and the
            // ribbon must not then offer to step to a record that is gone.
            recordIndex: mergeRecipients.length
              ? Math.min(mailMerge.recordIndex, mergeRecipients.length)
              : 0,
            recordCount: mergeRecipients.length,
          } satisfies MailMergeFlags,
  };

  return (
    <div className="app-shell" data-testid="app-shell">
      {view === 'editor' && !focusMode && viewMode !== 'read' && (
        <EditorTitleBar
          fileName={fileName}
          isDirty={isDirty}
          onSave={() => void saveDocument()}
          onUndo={() => editor?.chain().focus().undo().run()}
          onRedo={() => editor?.chain().focus().redo().run()}
          canUndo={!!editor?.can().undo()}
          canRedo={!!editor?.can().redo()}
          onHome={() => setView('home')}
          onRename={() => void renameCurrentFile()}
          canRename={Boolean(filePath)}
          onOpenSearch={() => setCommandPaletteOpen(true)}
          onOpenSettings={() => {
            setBackstageOpen(true);
            setBackstageSection('options');
          }}
        />
      )}

      {view === 'editor' && viewMode !== 'read' && (
        <Ribbon
          activeTab={ribbonTab}
          onTabChange={setRibbonTab}
          editor={editor}
          collapsed={ribbonCollapsed}
          onToggleCollapsed={() => setRibbonCollapsed((collapsed) => !collapsed)}
          hasFile={Boolean(filePath)}
          layout={ribbonLayout}
          onSetLayout={setRibbonLayout}
          visibility={ribbonVisibility}
          onSetVisibility={(next) => {
            setRibbonVisibility(next);
            setRibbonCollapsed(next === 'tabsOnly');
          }}
          editingMode={editingMode}
          onSetEditingMode={applyEditingMode}
          onToggleComments={() => setCommentsOpen((open) => !open)}
          actions={ribbonActions}
          flags={ribbonFlags}
        />
      )}

      {view === 'home' ? (
        <HomeScreen
          recents={recents}
          settings={settings}
          onNewFromTemplate={newFromTemplate}
          onOpenFile={async () => {
            const path = await getPlatform().openFile();
            if (path) await openDocumentAtPath(path);
          }}
          onOpenRecent={openDocumentAtPath}
          onBrowseFolder={async () => {
            const path = await getPlatform().openFolder();
            if (!path) return;
            const docs = await getPlatform().listDocuments(path);
            if (!docs.length) {
              await uiAlert('No documents found in that folder.');
              return;
            }
            await openDocumentAtPath(docs[0].path);
          }}
          onTogglePin={togglePin}
          onRemoveRecent={(path) => void persistRecents(recents.filter((r) => r.path !== path))}
          onOpenSettings={() => {
            setBackstageOpen(true);
            setBackstageSection('options');
          }}
          onToggleTheme={() =>
            setSettings((s) => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }))
          }
          onGoToEditor={() => setView('editor')}
        />
      ) : (
        <>
          <FindReplaceBar
            editor={editor}
            open={findOpen}
            focusField={findFocus}
            onClose={() => setFindOpen(false)}
          />
          {readOnly && (
            <div className="restrict-banner" data-testid="restrict-banner">
              This document is restricted to reading. Review &gt; Restrict Editing turns editing back
              on.
            </div>
          )}
          <div className="editor-workspace">
            {/* A thin rail down the left edge; its one
                button opens the navigation pane. */}
            <div className="pane-rail">
              <button
                className={`pane-rail-btn${navOpen ? ' is-active' : ''}`}
                onClick={() => setNavOpen((open) => !open)}
                title="Navigation pane"
                aria-label="Navigation pane"
                aria-pressed={navOpen}
                data-testid="pane-rail-navigation"
              >
                <PanelLeft size={17} />
              </button>
            </div>
            <NavigationPane editor={editor} open={navOpen} onClose={() => setNavOpen(false)} />
            <div className="editor-main">
              {focusMode && (
                <ImmersiveReaderBar
                  settings={immersive}
                  onChange={setImmersive}
                  onExit={() => setViewMode('print')}
                />
              )}
              <div
                className={`editor-scroll view-${viewMode}${focusMode ? ' focus-mode' : ''}${
                  viewMode === 'web' ? ' web-layout' : ''
                }`}
                data-immersive-width={focusMode ? immersive.width : undefined}
                data-immersive-spacing={focusMode ? immersive.spacing : undefined}
                data-immersive-page={focusMode ? immersive.page : undefined}
                data-immersive-line-focus={focusMode && immersive.lineFocus ? 'true' : undefined}
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
              >
                <DocumentRulers
                  pageSetup={envelope.pageSetup}
                  visible={showRulers}
                  onMarginsChange={(margins) => updatePageSetup({ margins })}
                >
                  <WordEditor
                    key={`${filePath ?? fileName}-${editorSyncKey}`}
                    content={envelope.content}
                    pageSetup={envelope.pageSetup}
                    headerFooter={envelope.headerFooter}
                    watermark={envelope.watermark}
                    footnotes={envelope.footnotes}
                    endnotes={envelope.endnotes}
                    spellCheckEnabled={settings.spellCheckEnabled}
                    grammarCheckEnabled={settings.grammarCheckEnabled}
                    autoCorrectEnabled={settings.autoCorrectEnabled}
                    showFormattingMarks={settings.showFormattingMarks}
                    showGridlines={showGridlines}
                    showHeaderFooter={showHeaderFooter}
                    showFootnotes={showFootnotes}
                    showEndnotes={showEndnotes}
                    markupView={markupOptions.insertionsAndDeletions ? markupView : 'none'}
                    readOnly={readOnly}
                    language={settings.language}
                    ignoredWords={ignoredWords}
                    trackChangesEnabled={envelope.trackChangesEnabled}
                    author={settings.authorName || 'You'}
                    onUpdate={handleEditorUpdate}
                    onReady={setEditor}
                    onPageCountChange={setPageCount}
                    onCurrentPageChange={setCurrentPage}
                    onFootnoteChange={handleNoteChange('footnote')}
                    onEndnoteChange={handleNoteChange('endnote')}
                    onProofingIssues={setProofingIssues}
                    onContextMenu={setContextMenu}
                  />
                </DocumentRulers>
              </div>
            </div>
            <ProofingPane
              open={proofingOpen}
              editor={editor}
              issues={proofingIssues}
              language={settings.language}
              onClose={() => setProofingOpen(false)}
              onAddToDictionary={(word) => {
                void getPlatform().addWordToDictionary(word).then(setUserDictionary);
              }}
              onIgnoreAll={(word) =>
                setSessionIgnored((prev) => (prev.includes(word) ? prev : [...prev, word]))
              }
            />
            <ThesaurusPane
              open={thesaurusOpen}
              editor={editor}
              selectionText={ribbonState.selectionText}
              onClose={() => setThesaurusOpen(false)}
            />
            <ReviewingPane
              open={reviewingPaneOpen}
              editor={editor}
              comments={markupOptions.comments ? envelope.comments : []}
              onClose={() => setReviewingPaneOpen(false)}
            />
            <AccessibilityPane
              open={accessibilityOpen}
              editor={editor}
              issues={accessibilityIssues}
              onClose={() => setAccessibilityOpen(false)}
              onRecheck={() => setAccessibilityIssues(runAccessibilityCheck())}
            />
            <CommentsPane
              open={commentsOpen}
              editor={editor}
              comments={envelope.comments}
              onAdd={(text, anchorText) => {
                const comment = newComment(text, settings.authorName || 'You', anchorText);
                updateEnvelope({ comments: [...envelope.comments, comment] });
                return comment.id;
              }}
              onResolve={(id) =>
                updateEnvelope({
                  comments: envelope.comments.map((c) =>
                    c.id === id ? { ...c, resolved: true } : c,
                  ),
                })
              }
              onDelete={(id) =>
                updateEnvelope({ comments: envelope.comments.filter((c) => c.id !== id) })
              }
              onClose={() => setCommentsOpen(false)}
            />
          </div>
          <StatusBar
            words={wordStats.words}
            pages={wordStats.pages}
            zoom={zoom}
            onZoomChange={setZoom}
            language={settings.language}
            trackChangesEnabled={envelope.trackChangesEnabled}
            pendingChanges={wordStats.insertions + wordStats.deletions}
            currentPage={currentPage}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            proofingIssues={proofingIssues.length}
            spellCheckEnabled={settings.spellCheckEnabled}
            readOnly={readOnly}
            onOpenProofing={() => setProofingOpen(true)}
            onOpenWordCount={() => setWordCountOpen(true)}
            onOpenGoTo={() => setGoToOpen(true)}
            onZoomToFit={ribbonActions.onZoomToFit}
          />
          <MiniToolbar
            editor={editor}
            state={ribbonState}
            // Suppressed while Find & Replace is open: every match is a
            // selection, so the toolbar popped up over the find bar and
            // swallowed clicks on Next and Previous.
            enabled={!readOnly && viewMode !== 'read' && !findOpen}
            onFormatPainter={() => (formatPainterActive ? applyFormat() : copyFormat())}
          />
          <EditorContextMenu
            state={contextMenu}
            editor={editor}
            onClose={() => setContextMenu(null)}
            onAddToDictionary={(word) => {
              void getPlatform().addWordToDictionary(word).then(setUserDictionary);
            }}
            onIgnoreAll={(word) =>
              setSessionIgnored((prev) => (prev.includes(word) ? prev : [...prev, word]))
            }
            onPaste={() => {
              if (editor) void pasteFromClipboard(editor);
            }}
            onOpenFontDialog={() => setDialog('font')}
            onOpenParagraphDialog={() => setDialog('paragraph')}
            onNewComment={() => void addComment()}
            onOpenProofing={() => setProofingOpen(true)}
            onOpenThesaurus={() => setThesaurusOpen(true)}
            onOpenAltText={() => setDialog('altText')}
          />
        </>
      )}

      <PageSetupDialog
        open={pageSetupOpen}
        pageSetup={envelope.pageSetup}
        onChange={(pageSetup: PageSetup) => updateEnvelope({ pageSetup })}
        onClose={() => setPageSetupOpen(false)}
      />
      <HeaderFooterDialog
        open={headerFooterOpen}
        value={envelope.headerFooter}
        onChange={(headerFooter) => updateEnvelope({ headerFooter })
        }
        onClose={() => setHeaderFooterOpen(false)}
      />

      <WatermarkDialog
        open={watermarkOpen}
        watermark={envelope.watermark}
        onChange={(watermark) => updateEnvelope({ watermark })}
        onClose={() => setWatermarkOpen(false)}
      />
      <KeyboardShortcutsDialog open={dialog === 'shortcuts'} onClose={() => setDialog(null)} />
      <WhatsNewDialog open={dialog === 'whatsNew'} onClose={() => setDialog(null)} />
      <WordCountDialog
        open={wordCountOpen}
        editor={editor}
        pages={wordStats.pages}
        onClose={() => setWordCountOpen(false)}
      />
      <GoToDialog
        open={goToOpen}
        editor={editor}
        pages={wordStats.pages}
        onClose={() => setGoToOpen(false)}
      />
      <StyleEditorDialog
        open={styleEditorOpen}
        styles={envelope.customStyles}
        onChange={(customStyles) => updateEnvelope({ customStyles })}
        onClose={() => setStyleEditorOpen(false)}
      />

      <FontDialog
        open={dialog === 'font'}
        editor={editor}
        state={ribbonState}
        onClose={() => setDialog(null)}
      />
      <ParagraphDialog
        open={dialog === 'paragraph'}
        editor={editor}
        state={ribbonState}
        onClose={() => setDialog(null)}
      />
      <ColumnsDialog
        open={dialog === 'columns'}
        pageSetup={envelope.pageSetup}
        onChange={(pageSetup) => updateEnvelope({ pageSetup })}
        onClose={() => setDialog(null)}
      />
      <BordersShadingDialog
        open={dialog === 'borders'}
        editor={editor}
        state={ribbonState}
        onClose={() => setDialog(null)}
      />
      <PageBordersDialog
        open={dialog === 'pageBorders'}
        pageSetup={envelope.pageSetup}
        onChange={(pageSetup) => updateEnvelope({ pageSetup })}
        onClose={() => setDialog(null)}
      />
      <ZoomDialog
        open={dialog === 'zoom'}
        zoom={zoom}
        onChange={setZoom}
        onFit={(fit) => ribbonActions.onZoomToFit(fit)}
        onClose={() => setDialog(null)}
      />
      <TablePropertiesDialog
        open={dialog === 'tableProperties'}
        editor={editor}
        state={ribbonState}
        onClose={() => setDialog(null)}
      />
      <SymbolDialog open={dialog === 'symbol'} editor={editor} onClose={() => setDialog(null)} />
      <EmojiDialog
        open={dialog === 'emoji'}
        editor={editor}
        recent={settings.recentEmoji ?? []}
        onUseEmoji={rememberEmoji}
        onClose={() => setDialog(null)}
      />
      <CrossReferenceDialog
        open={dialog === 'crossReference'}
        editor={editor}
        onClose={() => setDialog(null)}
      />
      <AltTextDialog
        open={dialog === 'altText'}
        editor={editor}
        state={ribbonState}
        onClose={() => setDialog(null)}
      />
      <PictureLayoutDialog
        open={dialog === 'pictureLayout'}
        editor={editor}
        state={ribbonState}
        onClose={() => setDialog(null)}
      />
      <SourcesDialog
        open={dialog === 'sources'}
        sources={envelope.sources}
        citationStyle={envelope.citationStyle}
        onChange={(sources) => updateEnvelope({ sources })}
        onClose={() => setDialog(null)}
      />

      {/* ---- Mailings ------------------------------------------------- */}

      <EnvelopesLabelsDialog
        open={mailingsDialog === 'envelopes' || mailingsDialog === 'labels'}
        initialTab={mailingsDialog === 'labels' ? 'labels' : 'envelopes'}
        source={mailMerge.source}
        defaultReturnAddress={settings.authorName}
        onInsertEnvelope={(request) => {
          setMailMerge((prev) => ({ ...prev, envelopePresetId: request.presetId, type: 'envelopes' }));
          insertEnvelope(
            editor,
            request.returnAddress,
            request.fromRecipients ? '' : request.deliveryAddress,
          );
          setIsDirty(true);
        }}
        onInsertLabels={(request) => {
          const preset =
            LABEL_PRESETS.find((entry) => entry.id === request.presetId) ?? LABEL_PRESETS[0];
          setMailMerge((prev) => ({ ...prev, labelPresetId: preset.id, type: 'labels' }));
          if (request.fromRecipients) replaceWithLabelSheet(editor, preset);
          else replaceWithFixedLabels(editor, preset, request.address);
          /**
           * No `setEditorSyncKey` here, deliberately.
           *
           * Bumping it remounts WordEditor, which re-initialises from
           * `envelope.content` - and that mirror is debounced, so it still holds
           * the pre-label document. The remount therefore threw the new sheet
           * away the instant it was built. The editor's own `setContent` has
           * already replaced the document; the mirror catches up on its own.
           */
          setIsDirty(true);
        }}
        onClose={() => setMailingsDialog(null)}
      />
      <RecipientListDialog
        open={mailingsDialog === 'recipients'}
        source={mailMerge.source}
        onApply={(source) => setMailMerge((prev) => ({ ...prev, source, recordIndex: 1 }))}
        onClose={() => setMailingsDialog(null)}
      />
      <NewRecipientListDialog
        open={mailingsDialog === 'newList'}
        onCreate={attachDataSource}
        onClose={() => setMailingsDialog(null)}
      />
      <InsertMergeFieldDialog
        open={mailingsDialog === 'insertField'}
        source={mailMerge.source}
        onInsert={(field) => insertMergeFieldNode(editor, { kind: 'field', field })}
        onClose={() => setMailingsDialog(null)}
      />
      <AddressBlockDialog
        open={mailingsDialog === 'addressBlock'}
        source={mailMerge.source}
        mapping={mailMerge.mapping}
        onInsert={(addressOptions) =>
          insertMergeFieldNode(editor, { kind: 'addressBlock', addressOptions })
        }
        onOpenMatchFields={() => setMailingsDialog('matchFields')}
        onClose={() => setMailingsDialog(null)}
      />
      <GreetingLineDialog
        open={mailingsDialog === 'greetingLine'}
        source={mailMerge.source}
        mapping={mailMerge.mapping}
        onInsert={(greetingOptions) =>
          insertMergeFieldNode(editor, { kind: 'greetingLine', greetingOptions })
        }
        onOpenMatchFields={() => setMailingsDialog('matchFields')}
        onClose={() => setMailingsDialog(null)}
      />
      <MatchFieldsDialog
        open={mailingsDialog === 'matchFields'}
        source={mailMerge.source}
        mapping={mailMerge.mapping}
        onApply={(mapping) => setMailMerge((prev) => ({ ...prev, mapping }))}
        onClose={() => setMailingsDialog(null)}
      />
      <MergeRuleDialog
        open={mergeRule !== null}
        rule={mergeRule}
        source={mailMerge.source}
        onInsert={(attrs: Partial<MergeFieldAttrs>) => insertMergeFieldNode(editor, attrs)}
        onClose={() => setMergeRule(null)}
      />
      <FindRecipientDialog
        open={mailingsDialog === 'findRecipient'}
        source={mailMerge.source}
        onGoTo={goToMergeRecord}
        onClose={() => setMailingsDialog(null)}
      />
      <CheckMergeErrorsDialog
        open={mailingsDialog === 'checkErrors'}
        problems={mergeProblems}
        onClose={() => setMailingsDialog(null)}
      />
      <FinishMergeDialog
        open={mailingsDialog === 'finishMerge'}
        destination={mergeDestination}
        recordCount={mergeRecipients.length}
        prompts={mergePrompts}
        onConfirm={(request) => {
          setMailingsDialog(null);
          void finishMerge(request);
        }}
        onClose={() => setMailingsDialog(null)}
      />
      <MailMergeWizard
        open={mergeWizardStep > 0}
        step={mergeWizardStep}
        mergeType={mailMerge.type}
        source={mailMerge.source}
        fieldCount={mergeFieldNames(editor?.getJSON() ?? envelope.content).length}
        recordCount={mergeRecipients.length}
        previewActive={mailMerge.previewActive}
        onSetStep={setMergeWizardStep}
        onSetMergeType={(type) => setMailMerge((prev) => ({ ...prev, type }))}
        onSelectRecipients={() => void pickExistingRecipientList()}
        onEditRecipients={() => setMailingsDialog('recipients')}
        onInsertAddressBlock={() => setMailingsDialog('addressBlock')}
        onInsertGreetingLine={() => setMailingsDialog('greetingLine')}
        onInsertMergeField={() => setMailingsDialog('insertField')}
        onTogglePreview={() =>
          setMailMerge((prev) => ({ ...prev, previewActive: !prev.previewActive }))
        }
        onStepRecord={stepMergeRecord}
        onFinish={() => {
          setMergeDestination('documents');
          setMergePrompts(collectMergePrompts(editor?.getJSON() ?? envelope.content));
          setMailingsDialog('finishMerge');
        }}
        onClose={() => setMergeWizardStep(0)}
      />

      {backstageOpen && (
        <Backstage
          section={backstageSection}
          onSectionChange={setBackstageSection}
          onClose={() => setBackstageOpen(false)}
          onNew={() => {
            newFromTemplate('blank');
            setBackstageOpen(false);
          }}
          onNewFromTemplate={(id) => {
            newFromTemplate(id as Parameters<typeof newFromTemplate>[0]);
            setBackstageOpen(false);
          }}
          recents={recents}
          onOpenRecent={async (path) => {
            await openDocumentAtPath(path);
            setBackstageOpen(false);
          }}
          onOpen={async () => {
            const path = await getPlatform().openFile();
            if (path) await openDocumentAtPath(path);
            setBackstageOpen(false);
          }}
          onSave={async () => {
            await saveDocument();
            setBackstageOpen(false);
          }}
          onSaveAs={async () => {
            await saveDocument(null, true);
            setBackstageOpen(false);
          }}
          onExportDocx={async () => {
            await exportDocumentAs('docx');
            setBackstageOpen(false);
          }}
          onExportOfficewrite={async () => {
            await exportDocumentAs('officewrite');
            setBackstageOpen(false);
          }}
          onExportPdf={() => {
            exportPdf();
            setBackstageOpen(false);
          }}
          onPrint={async (options) => {
            await getPlatform().printDocument(options);
            setBackstageOpen(false);
          }}
          onBuildPreview={() => getPlatform().exportPdf()}
          settings={settings}
          onSettingsChange={setSettings}
          fileName={fileName}
          filePath={filePath}
          revisions={revisions}
          onRestoreRevision={restoreRevision}
          metadata={envelope.metadata}
          onMetadataChange={(metadata) => updateEnvelope({ metadata })}
          onExportRtf={async () => {
            await exportDocumentAs('rtf');
            setBackstageOpen(false);
          }}
          onExportHtml={async () => {
            await exportDocumentAs('html');
            setBackstageOpen(false);
          }}
        />
      )}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        context={{
          editor,
          actions: ribbonActions,
          flags: ribbonFlags,
          state: ribbonState,
          goToTab: setRibbonTab,
        }}
      />
      <UiPromptHost />
    </div>
  );
}
