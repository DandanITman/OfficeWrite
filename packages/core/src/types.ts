export type ThemeMode = 'light' | 'dark';

export interface AppSettings {
  theme: ThemeMode;
  accentColor: string;
  defaultSaveLocation: string;
  defaultFontFamily: string;
  defaultFontSize: number;
  autoSaveIntervalMs: number;
  spellCheckEnabled: boolean;
  language: string;
  /** Attributed to comments and tracked changes. */
  authorName: string;
  /** Flag grammar and style problems as well as misspellings. */
  grammarCheckEnabled: boolean;
  /** Fix common typos and straighten quotes while typing. */
  autoCorrectEnabled: boolean;
  /** Show pilcrows, spaces and tabs, the usual ¶ toggle. */
  showFormattingMarks: boolean;
  /** Show the horizontal and vertical rulers. */
  showRuler: boolean;
  /** Insert > Emojis remembers what you picked, most recent first. */
  recentEmoji: string[];
}

export interface RecentFile {
  path: string;
  name: string;
  lastOpened: number;
  pinned: boolean;
}

export interface DocumentMetadata {
  title: string;
  author: string;
  created: string;
  modified: string;
  subject?: string;
  keywords?: string;
  company?: string;
}

export interface OfficewriteDocument {
  version: 1 | 2 | 3;
  metadata: DocumentMetadata;
  content: unknown;
  pageSetup?: import('./pageSetup').PageSetup;
  headerFooter?: import('./pageSetup').HeaderFooter;
  comments?: import('./pageSetup').DocumentComment[];
  trackChangesEnabled?: boolean;
  watermark?: import('./styles').Watermark;
  customStyles?: import('./styles').DocumentStyle[];
  footnotes?: import('./pageSetup').DocumentFootnote[];
  endnotes?: import('./pageSetup').DocumentFootnote[];
  /** Bibliography sources, in the order Manage Sources shows them. */
  sources?: import('./references').CitationSource[];
  citationStyle?: import('./references').CitationStyle;
  /** Read-only until the reviewer turns editing back on. */
  restrictEditing?: boolean;
  /** Design tab: which style set the document formatting came from. */
  styleSetId?: string;
}

/**
 * The nine tabs on the strip, followed by the three contextual ones that only
 * appear while the matching object is selected: `draw` with a drawing canvas,
 * `pictureFormat` with a picture, `tableLayout` inside a table.
 *
 * `file` is on the strip but has no panel - it opens a dropdown menu instead.
 */
export type RibbonTab =
  | 'file'
  | 'home'
  | 'insert'
  | 'pageLayout'
  | 'references'
  | 'mailings'
  | 'review'
  | 'view'
  | 'help'
  | 'draw'
  | 'pictureFormat'
  | 'tableLayout';

export type AppView = 'home' | 'editor';
