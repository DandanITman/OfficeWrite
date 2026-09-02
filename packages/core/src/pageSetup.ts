export type PageSizePreset = 'letter' | 'a4' | 'legal' | 'a5' | 'executive' | 'tabloid';
export type PageOrientation = 'portrait' | 'landscape';

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** The Layout > Line Numbers choices. */
export type LineNumberMode = 'none' | 'continuous' | 'restartEachPage';

export type PageBorderStyle = 'none' | 'solid' | 'dashed' | 'dotted' | 'double';

export interface PageBorder {
  style: PageBorderStyle;
  color: string;
  width: number;
}

export interface PageSetup {
  size: PageSizePreset;
  orientation: PageOrientation;
  margins: PageMargins;
  columns: ColumnLayout;
  /** Design > Page Color. Null means the paper stays white. */
  pageColor: string | null;
  /** Design > Page Borders. */
  border: PageBorder;
  /** Layout > Line Numbers. */
  lineNumbers: LineNumberMode;
  /** Layout > Hyphenation. */
  hyphenation: boolean;
}

export interface ColumnLayout {
  count: number;
  gap: number;
  /** Layout > Columns > "Line between". */
  line: boolean;
}

export interface DocumentFootnote {
  id: string;
  text: string;
}

/**
 * A header and footer are laid out in three zones against tab stops - title
 * on the left, page number on the right is the commonest arrangement of all.
 */
export interface HeaderFooterZones {
  left: string;
  center: string;
  right: string;
}

export interface HeaderFooter {
  /**
   * The centre zone, kept as a plain string so documents written before the
   * zones existed still load. `headerZones` wins when it is present.
   */
  header: string;
  footer: string;
  showPageNumbers: boolean;
  headerZones?: HeaderFooterZones;
  footerZones?: HeaderFooterZones;
  /** "Different First Page": suppresses both on page one. */
  differentFirstPage?: boolean;
}

const EMPTY_ZONES: HeaderFooterZones = { left: '', center: '', right: '' };

/**
 * The zones for a header or footer, whichever way the document stores them.
 *
 * Documents saved before zones existed carry only `header`/`footer`; those
 * read back as the centre zone, which is where a single string was rendered.
 */
export function headerZonesOf(headerFooter: HeaderFooter | undefined): HeaderFooterZones {
  if (headerFooter?.headerZones) return headerFooter.headerZones;
  return { ...EMPTY_ZONES, center: headerFooter?.header ?? '' };
}

export function footerZonesOf(headerFooter: HeaderFooter | undefined): HeaderFooterZones {
  if (headerFooter?.footerZones) return headerFooter.footerZones;
  return { ...EMPTY_ZONES, center: headerFooter?.footer ?? '' };
}

/** True when nothing in any zone would render. */
export function zonesEmpty(zones: HeaderFooterZones): boolean {
  return !zones.left.trim() && !zones.center.trim() && !zones.right.trim();
}

export interface DocumentComment {
  id: string;
  text: string;
  author: string;
  created: string;
  resolved: boolean;
  anchorText?: string;
  /** Threaded replies. */
  replies?: CommentReply[];
}

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  created: string;
}

export interface DocumentRevision {
  id: string;
  timestamp: number;
  label: string;
  filePath: string;
}

/** Portrait dimensions at 96 CSS pixels per inch. */
export const PAGE_DIMENSIONS: Record<PageSizePreset, { width: number; height: number }> = {
  letter: { width: 816, height: 1056 },
  a4: { width: 794, height: 1123 },
  legal: { width: 816, height: 1344 },
  a5: { width: 559, height: 794 },
  executive: { width: 696, height: 1008 },
  tabloid: { width: 1056, height: 1632 },
};

export const PAGE_SIZE_LABELS: Record<PageSizePreset, string> = {
  letter: 'Letter (8.5" × 11")',
  a4: 'A4 (21 × 29.7 cm)',
  legal: 'Legal (8.5" × 14")',
  a5: 'A5 (14.8 × 21 cm)',
  executive: 'Executive (7.25" × 10.5")',
  tabloid: 'Tabloid (11" × 17")',
};

export const NO_PAGE_BORDER: PageBorder = { style: 'none', color: '#000000', width: 1 };

export const DEFAULT_PAGE_SETUP: PageSetup = {
  size: 'letter',
  orientation: 'portrait',
  margins: { top: 96, bottom: 96, left: 96, right: 96 },
  columns: { count: 1, gap: 48, line: false },
  pageColor: null,
  border: { ...NO_PAGE_BORDER },
  lineNumbers: 'none',
  hyphenation: false,
};

export const DEFAULT_HEADER_FOOTER: HeaderFooter = {
  header: '',
  footer: '',
  showPageNumbers: false,
};

/**
 * The Margins gallery.
 * Mirrored uses a wider inside margin, which one-sided rendering shows on the
 * left, where the binding edge of the first page is.
 */
export const MARGIN_PRESETS: Record<string, PageMargins> = {
  Normal: { top: 96, bottom: 96, left: 96, right: 96 },
  Narrow: { top: 48, bottom: 48, left: 48, right: 48 },
  Moderate: { top: 96, bottom: 96, left: 72, right: 72 },
  Wide: { top: 96, bottom: 96, left: 192, right: 192 },
  Mirrored: { top: 96, bottom: 96, left: 120, right: 96 },
};

export const MARGIN_PRESET_HINTS: Record<string, string> = {
  Normal: 'Top 1"  Bottom 1"\nLeft 1"  Right 1"',
  Narrow: 'Top 0.5"  Bottom 0.5"\nLeft 0.5"  Right 0.5"',
  Moderate: 'Top 1"  Bottom 1"\nLeft 0.75"  Right 0.75"',
  Wide: 'Top 1"  Bottom 1"\nLeft 2"  Right 2"',
  Mirrored: 'Top 1"  Bottom 1"\nInside 1.25"  Outside 1"',
};

/** Layout > Columns presets. */
export const COLUMN_PRESETS: Record<string, ColumnLayout> = {
  One: { count: 1, gap: 48, line: false },
  Two: { count: 2, gap: 48, line: false },
  Three: { count: 3, gap: 36, line: false },
};

/** The page area a page of body text can fill, in pixels. */
export function contentWidth(pageSetup: PageSetup): number {
  const dims = PAGE_DIMENSIONS[pageSetup.size];
  const width = pageSetup.orientation === 'portrait' ? dims.width : dims.height;
  return width - pageSetup.margins.left - pageSetup.margins.right;
}

/** Normalise a partially-specified page setup, e.g. one read from an old file. */
export function completePageSetup(partial?: Partial<PageSetup> | null): PageSetup {
  return {
    ...DEFAULT_PAGE_SETUP,
    ...partial,
    margins: { ...DEFAULT_PAGE_SETUP.margins, ...partial?.margins },
    columns: { ...DEFAULT_PAGE_SETUP.columns, ...partial?.columns },
    border: { ...NO_PAGE_BORDER, ...partial?.border },
    pageColor: partial?.pageColor ?? null,
  };
}
