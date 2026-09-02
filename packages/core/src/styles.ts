export interface Watermark {
  text: string;
  enabled: boolean;
  opacity: number;
}

/**
 * A style in the Styles gallery.
 *
 * `kind` follows the usual distinction: a paragraph style owns the whole
 * paragraph (including its heading level and spacing), a character style only
 * decorates the selected run.
 */
export interface DocumentStyle {
  id: string;
  name: string;
  kind?: 'paragraph' | 'character';
  fontFamily?: string;
  fontSize?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  headingLevel?: 1 | 2 | 3;
  /** Space above the paragraph, in pixels. */
  spaceBefore?: number;
  /** Space below the paragraph, in pixels. */
  spaceAfter?: number;
  lineHeight?: string;
  /** Renders as a quote block, plain or emphasised. */
  quote?: boolean;
  /** Left accent border colour, used by the Quote and reference styles. */
  borderColor?: string;
  /** Paragraph shading. */
  shading?: string;
  /** Small-caps-like presentation for the reference styles. */
  uppercase?: boolean;
}

export const DEFAULT_WATERMARK: Watermark = {
  text: 'DRAFT',
  enabled: false,
  opacity: 0.12,
};

/**
 * the default Styles gallery.
 *
 * The order is: Normal, No Spacing, the headings, Title, Subtitle, then
 * the character styles and quote styles. Anything the ribbon shows in its
 * three-wide quick gallery comes from the front of this list.
 */
export const BUILTIN_STYLES: DocumentStyle[] = [
  { id: 'normal', name: 'Normal', kind: 'paragraph', fontFamily: 'Calibri', fontSize: '11pt', spaceAfter: 12, lineHeight: '1.15' },
  { id: 'noSpacing', name: 'No Spacing', kind: 'paragraph', fontFamily: 'Calibri', fontSize: '11pt', spaceBefore: 0, spaceAfter: 0, lineHeight: '1' },
  { id: 'heading1', name: 'Heading 1', kind: 'paragraph', fontFamily: 'Calibri Light', fontSize: '16pt', color: '#2f5496', headingLevel: 1, spaceBefore: 16, spaceAfter: 4 },
  { id: 'heading2', name: 'Heading 2', kind: 'paragraph', fontFamily: 'Calibri Light', fontSize: '13pt', color: '#2f5496', headingLevel: 2, spaceBefore: 12, spaceAfter: 4 },
  { id: 'heading3', name: 'Heading 3', kind: 'paragraph', fontFamily: 'Calibri Light', fontSize: '12pt', color: '#1f3763', headingLevel: 3, spaceBefore: 10, spaceAfter: 4 },
  { id: 'title', name: 'Title', kind: 'paragraph', fontFamily: 'Calibri Light', fontSize: '28pt', color: '#000000', spaceAfter: 6 },
  { id: 'subtitle', name: 'Subtitle', kind: 'paragraph', fontFamily: 'Calibri Light', fontSize: '14pt', color: '#5a5a5a', italic: true, spaceAfter: 12 },
  { id: 'quote', name: 'Quote', kind: 'paragraph', fontFamily: 'Calibri', fontSize: '11pt', italic: true, color: '#404040', quote: true, borderColor: '#d0d0d0', spaceBefore: 10, spaceAfter: 10 },
  { id: 'intenseQuote', name: 'Intense Quote', kind: 'paragraph', fontFamily: 'Calibri', fontSize: '11pt', italic: true, color: '#2f5496', quote: true, borderColor: '#2f5496', spaceBefore: 12, spaceAfter: 12 },
  { id: 'listParagraph', name: 'List Paragraph', kind: 'paragraph', fontFamily: 'Calibri', fontSize: '11pt', spaceAfter: 0 },
  { id: 'emphasis', name: 'Emphasis', kind: 'character', italic: true },
  { id: 'strong', name: 'Strong', kind: 'character', bold: true },
  { id: 'subtleEmphasis', name: 'Subtle Emphasis', kind: 'character', italic: true, color: '#404040' },
  { id: 'intenseEmphasis', name: 'Intense Emphasis', kind: 'character', italic: true, bold: true, color: '#2f5496' },
  { id: 'subtleReference', name: 'Subtle Reference', kind: 'character', underline: true, color: '#5a5a5a' },
  { id: 'intenseReference', name: 'Intense Reference', kind: 'character', bold: true, underline: true, color: '#2f5496', uppercase: true },
  { id: 'bookTitle', name: 'Book Title', kind: 'character', bold: true, italic: true },
];

/**
 * The built-in styles with the user's default font applied.
 *
 * `defaultFontFamily` and `defaultFontSize` only set CSS variables, so they
 * changed what was on screen and nothing else: the document itself still said
 * Calibri 11, and that is what export wrote. New documents start from these
 * instead, which puts the preference in the document where export can see it.
 *
 * The size applies to the body styles only - headings define their own, exactly
 * as changing the body font leaves heading sizes alone.
 */
export function builtinStylesWithDefaults(
  fontFamily: string,
  fontSize: number,
): DocumentStyle[] {
  const bodyStyles = new Set(['normal', 'noSpacing', 'listParagraph', 'quote', 'intenseQuote']);
  return BUILTIN_STYLES.map((style) => ({
    ...style,
    fontFamily: style.fontFamily ? fontFamily || style.fontFamily : undefined,
    fontSize: bodyStyles.has(style.id) && fontSize > 0 ? `${fontSize}pt` : style.fontSize,
  }));
}

/**
 * Home > Styles > Style set: the gallery that restyles the whole document.
 *
 * Each set only overrides the pieces a style set changes â€” heading fonts, sizes,
 * colour and paragraph spacing â€” so the user's default body font survives.
 */
export interface StyleSet {
  id: string;
  name: string;
  overrides: Partial<Record<string, Partial<DocumentStyle>>>;
}

export const STYLE_SETS: StyleSet[] = [
  { id: 'default', name: 'Default', overrides: {} },
  {
    id: 'noSpacing',
    name: 'No Spacing',
    overrides: {
      normal: { spaceBefore: 0, spaceAfter: 0, lineHeight: '1' },
      heading1: { spaceBefore: 8, spaceAfter: 2 },
      heading2: { spaceBefore: 6, spaceAfter: 2 },
      heading3: { spaceBefore: 6, spaceAfter: 2 },
    },
  },
  {
    id: 'compact',
    name: 'Compact',
    overrides: {
      normal: { fontSize: '10pt', spaceAfter: 6, lineHeight: '1' },
      heading1: { fontSize: '14pt', spaceBefore: 10, spaceAfter: 2 },
      heading2: { fontSize: '12pt', spaceBefore: 8, spaceAfter: 2 },
      heading3: { fontSize: '11pt', spaceBefore: 8, spaceAfter: 2 },
      title: { fontSize: '22pt' },
    },
  },
  {
    id: 'casual',
    name: 'Casual',
    overrides: {
      normal: { fontFamily: 'Trebuchet MS' },
      heading1: { fontFamily: 'Trebuchet MS', color: '#e36c0a', fontSize: '17pt' },
      heading2: { fontFamily: 'Trebuchet MS', color: '#e36c0a', fontSize: '14pt' },
      heading3: { fontFamily: 'Trebuchet MS', color: '#c0561f', fontSize: '12pt' },
      title: { fontFamily: 'Trebuchet MS', color: '#e36c0a' },
      subtitle: { fontFamily: 'Trebuchet MS' },
    },
  },
  {
    id: 'elegant',
    name: 'Elegant',
    overrides: {
      normal: { fontFamily: 'Garamond', fontSize: '12pt', lineHeight: '1.5' },
      heading1: { fontFamily: 'Garamond', fontSize: '18pt', color: '#000000', uppercase: true },
      heading2: { fontFamily: 'Garamond', fontSize: '14pt', color: '#000000', italic: true },
      heading3: { fontFamily: 'Garamond', fontSize: '12pt', color: '#333333', italic: true },
      title: { fontFamily: 'Garamond', fontSize: '30pt', uppercase: true },
      subtitle: { fontFamily: 'Garamond', italic: true },
    },
  },
  {
    id: 'formal',
    name: 'Formal',
    overrides: {
      normal: { fontFamily: 'Times New Roman', fontSize: '12pt', lineHeight: '2' },
      heading1: { fontFamily: 'Times New Roman', fontSize: '16pt', color: '#1f3763', bold: true },
      heading2: { fontFamily: 'Times New Roman', fontSize: '14pt', color: '#1f3763', bold: true },
      heading3: { fontFamily: 'Times New Roman', fontSize: '12pt', color: '#1f3763', bold: true },
      title: { fontFamily: 'Times New Roman', fontSize: '26pt', bold: true },
      subtitle: { fontFamily: 'Times New Roman' },
    },
  },
  {
    id: 'lines',
    name: 'Lines',
    overrides: {
      heading1: { borderColor: '#2f5496', spaceAfter: 8 },
      heading2: { borderColor: '#8faadc', spaceAfter: 6 },
      heading3: { borderColor: '#b4c7e7', spaceAfter: 6 },
    },
  },
  {
    id: 'shaded',
    name: 'Shaded',
    overrides: {
      heading1: { shading: '#dae3f3', color: '#1f3763' },
      heading2: { shading: '#e9eef8', color: '#1f3763' },
      heading3: { shading: '#f2f5fb', color: '#1f3763' },
    },
  },
];

/** Apply a style set to a style list, restyling the whole document. */
export function applyStyleSet(styles: DocumentStyle[], styleSetId: string): DocumentStyle[] {
  const set = STYLE_SETS.find((s) => s.id === styleSetId) ?? STYLE_SETS[0];
  return styles.map((style) => ({ ...style, ...(set.overrides[style.id] ?? {}) }));
}
