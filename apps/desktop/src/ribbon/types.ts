import type { Editor } from '@tiptap/react';
import type {
  CitationSource,
  CitationStyle,
  DocumentStyle,
  PageSetup,
  PageSizePreset,
  PageOrientation,
  LineNumberMode,
  CaptionLabel,
  FieldMapping,
  MergeDataSource,
  MergeRuleKind,
  MergeType,
} from '@officewrite/core';
import type { ShapeType } from '../extensions/DocShape';
import type { InkTool } from '../extensions/InkDrawing';
import type { RibbonState } from './useRibbonState';

/** View tab / status bar document views, as expected's set. */
export type ViewMode = 'read' | 'print' | 'web' | 'outline' | 'draft' | 'focus';

/** Review > Display for Review. */
export type MarkupView = 'simple' | 'all' | 'none' | 'original';

/** Review > Show Markup checkboxes. */
export interface MarkupOptions {
  insertionsAndDeletions: boolean;
  formatting: boolean;
  comments: boolean;
}

export type PasteMode = 'default' | 'text' | 'match';

/** Where a Finish & Merge lands. */
export type MergeDestination = 'documents' | 'print' | 'email';

/** Mailings > Preview Results record stepping. */
export type MergeRecordStep = 'first' | 'previous' | 'next' | 'last';

/**
 * Everything the Mailings tab needs to draw itself.
 *
 * Grouped rather than spread across `RibbonFlags` because the whole tab is one
 * feature with one lifecycle - attach a list, insert fields, preview, finish -
 * and half of it is disabled until a list exists.
 */
export interface MailMergeFlags {
  type: MergeType;
  source: MergeDataSource | null;
  mapping: FieldMapping;
  /** Preview Results is on, so fields draw the current record's values. */
  previewActive: boolean;
  highlightFields: boolean;
  /** 1-based position among the ticked recipients; 0 when there are none. */
  recordIndex: number;
  /** Ticked recipients, which is what the record navigator counts. */
  recordCount: number;
}

/** Every command the ribbon can invoke on the surrounding app. */
export interface RibbonActions {
  // File and Quick Access
  onNew: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  /** Backstage on the Export section - File > Export. */
  onOpenBackstage: () => void;
  /** Backstage on the New section, for the templates. */
  onOpenNewBackstage: () => void;
  /** Backstage on the Open section, for recents and Browse. */
  onOpenBackstageOpen: () => void;
  onOpenInfo: () => void;
  onOpenVersionHistory: () => void;
  onRenameFile: () => void;
  onCreateCopy: () => void;
  onDeleteFile: () => void;
  onPrint: () => void;
  onExportPdf: () => void;

  // Home
  onPaste: (mode: PasteMode) => void;
  onFormatPainterCopy: () => void;
  onFormatPainterApply: () => void;
  onOpenStyleEditor: () => void;
  onOpenFontDialog: () => void;
  onOpenParagraphDialog: () => void;
  onOpenBordersDialog: () => void;
  onSortParagraphs: (direction: 'asc' | 'desc') => void;
  onToggleFormattingMarks: () => void;
  onToggleFindReplace: (field?: 'find' | 'replace') => void;

  // Insert
  onInsertImage: () => void;
  onInsertShape: (type: ShapeType) => void;
  onInsertTextBox: (style: 'simple' | 'sidebar' | 'quote') => void;
  onInsertCoverPage: (id: string) => void;
  onInsertBlankPage: () => void;
  onOpenHeaderFooter: () => void;
  onInsertPageNumbers: (show: boolean) => void;
  onOpenSymbolPicker: () => void;
  onOpenEmojiPicker: () => void;
  onInsertBookmark: () => void;
  onOpenCrossReference: () => void;

  // Draw
  onInsertDrawingCanvas: () => void;
  onSetInkTool: (tool: InkTool) => void;
  onSetInkColor: (color: string) => void;
  onSetInkWidth: (width: number) => void;

  // Design
  onApplyStyleSet: (id: string) => void;
  onOpenWatermark: () => void;
  onSetPageColor: (color: string | null) => void;
  onOpenPageBorders: () => void;

  // Layout
  onOpenPageSetup: () => void;
  onApplyMarginPreset: (preset: string) => void;
  onSetOrientation: (orientation: PageOrientation) => void;
  onSetPageSize: (size: PageSizePreset) => void;
  onSetColumns: (count: number) => void;
  onOpenColumnsDialog: () => void;
  onSetLineNumbers: (mode: LineNumberMode) => void;
  onToggleHyphenation: () => void;

  // References
  onInsertToc: () => void;
  onUpdateToc: () => void;
  onInsertFootnote: () => void;
  onInsertEndnote: () => void;
  onShowNotes: () => void;
  onInsertCitation: (sourceId: string) => void;
  onManageSources: () => void;
  onSetCitationStyle: (style: CitationStyle) => void;
  onInsertBibliography: () => void;
  onInsertCaption: (label: CaptionLabel) => void;
  onInsertTableOfFigures: (label: CaptionLabel) => void;
  onMarkIndexEntry: () => void;
  onInsertIndex: () => void;

  // Mailings
  /** Create group, which works with or without a recipient list. */
  onOpenEnvelopes: () => void;
  onOpenLabels: () => void;
  onSetMergeType: (type: MergeType) => void;
  onOpenMergeWizard: () => void;
  /** Select Recipients > Type a New List / Use an Existing List. */
  onNewRecipientList: () => void;
  onUseExistingRecipientList: () => void;
  onEditRecipientList: () => void;
  onToggleHighlightMergeFields: () => void;
  onOpenAddressBlock: () => void;
  onOpenGreetingLine: () => void;
  onInsertMergeField: (field: string) => void;
  onOpenInsertMergeField: () => void;
  /** Rules. The four that need no configuration insert straight away. */
  onInsertMergeRule: (rule: MergeRuleKind) => void;
  onOpenMatchFields: () => void;
  onUpdateLabels: () => void;
  onTogglePreviewResults: () => void;
  onStepMergeRecord: (step: MergeRecordStep) => void;
  onGoToMergeRecord: (index: number) => void;
  onOpenFindRecipient: () => void;
  onCheckMergeErrors: () => void;
  onFinishMerge: (destination: MergeDestination) => void;

  // Review
  onOpenProofing: () => void;
  onOpenThesaurus: () => void;
  onOpenWordCount: () => void;
  /** Ctrl+G - jump to a page, line or bookmark. */
  onOpenGoTo: () => void;
  onSetLanguage: (language: string) => void;
  onToggleSpellCheck: () => void;
  onToggleGrammarCheck: () => void;
  onNewComment: () => void;
  onDeleteComment: (scope: 'current' | 'all' | 'resolved') => void;
  onGoToComment: (delta: number) => void;
  onToggleComments: () => void;
  onToggleTrackChanges: () => void;
  onSetMarkupView: (view: MarkupView) => void;
  onToggleMarkupOption: (option: keyof MarkupOptions) => void;
  onToggleReviewingPane: () => void;
  onGoToChange: (delta: number) => void;
  onCompareDocuments: () => void;
  onCheckAccessibility: () => void;
  onToggleRestrictEditing: () => void;

  // View
  onSetViewMode: (mode: ViewMode) => void;
  onToggleFocusMode: () => void;
  onToggleRuler: () => void;
  onToggleGridlines: () => void;
  onToggleNavigation: () => void;
  onSetZoom: (zoom: number) => void;
  onOpenZoomDialog: () => void;
  onZoomToFit: (fit: 'pageWidth' | 'onePage' | 'multiplePages') => void;
  onToggleShowHeaderFooter: () => void;
  onToggleShowFootnotes: () => void;
  onToggleShowEndnotes: () => void;
  onToggleTheme: () => void;
  onToggleRibbonCollapsed: () => void;

  // Help
  onOpenHelp: () => void;
  onContactSupport: () => void;
  onSendFeedback: () => void;
  onOpenShortcuts: () => void;
  onOpenWhatsNew: () => void;

  // Picture and table tools
  onOpenAltText: () => void;
  onOpenPictureLayout: () => void;
  onResetPicture: () => void;
  onOpenTableProperties: () => void;
}

export interface RibbonFlags {
  trackChangesEnabled: boolean;
  formatPainterActive: boolean;
  focusMode: boolean;
  customStyles: DocumentStyle[];
  /** Tracked changes awaiting a decision, shown on the Review tab. */
  pendingInsertions: number;
  pendingDeletions: number;
  viewMode: ViewMode;
  zoom: number;
  showFormattingMarks: boolean;
  showRuler: boolean;
  showGridlines: boolean;
  showHeaderFooter: boolean;
  showFootnotes: boolean;
  showEndnotes: boolean;
  theme: 'light' | 'dark';
  ribbonCollapsed: boolean;
  accessibilityOpen: boolean;
  accessibilityIssues: number;
  navigationOpen: boolean;
  commentsOpen: boolean;
  reviewingPaneOpen: boolean;
  markupView: MarkupView;
  markupOptions: MarkupOptions;
  restrictEditing: boolean;
  language: string;
  spellCheckEnabled: boolean;
  grammarCheckEnabled: boolean;
  pageSetup: PageSetup;
  watermarkEnabled: boolean;
  showPageNumbers: boolean;
  styleSetId: string;
  citationStyle: CitationStyle;
  sources: CitationSource[];
  commentCount: number;
  unresolvedComments: number;
  ink: { tool: InkTool; color: string; width: number };
  /** Spelling and grammar problems the checker currently reports. */
  proofingIssues: number;
  mailMerge: MailMergeFlags;
}

export interface RibbonTabProps {
  editor: Editor | null;
  state: RibbonState;
  actions: RibbonActions;
  /** Flags owned by the app rather than by the editor. */
  flags: RibbonFlags;
}
