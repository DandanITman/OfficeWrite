/**
 * Insert > Cover Page.
 *
 * Each entry is the block content the built-in cover pages lay down: a title,
 * a subtitle and an author line, followed by a page break so the document body
 * starts on page two.
 */

interface CoverBlock {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> }>;
}

function heading(text: string, level: 1 | 2, attrs: Record<string, unknown> = {}): CoverBlock {
  return {
    type: 'heading',
    attrs: { level, ...attrs },
    content: [{ type: 'text', text }],
  };
}

function paragraph(text: string, attrs: Record<string, unknown> = {}): CoverBlock {
  return {
    type: 'paragraph',
    attrs,
    content: text ? [{ type: 'text', text }] : undefined,
  };
}

export const COVER_PAGE_TEMPLATES: Record<string, CoverBlock[]> = {
  banded: [
    paragraph('', { shading: '#2f5496', spaceAfter: 24 }),
    heading('[Document title]', 1, { textAlign: 'left', styleId: 'title' }),
    paragraph('[Subtitle]', { textAlign: 'left', spaceAfter: 48 }),
    paragraph('[Author name]', { textAlign: 'left' }),
    paragraph('[Date]', { textAlign: 'left' }),
    { type: 'pageBreak' },
  ],
  facet: [
    heading('[Document title]', 1, { textAlign: 'left', styleId: 'title' }),
    paragraph('', { borderColor: '#2f5496', borderSides: 'top', spaceAfter: 18 }),
    paragraph('[Subtitle]', { textAlign: 'left' }),
    paragraph('[Author name] · [Date]', { textAlign: 'left', spaceBefore: 96 }),
    { type: 'pageBreak' },
  ],
  motion: [
    paragraph('[Date]', { textAlign: 'right' }),
    heading('[Document title]', 1, { textAlign: 'right', styleId: 'title' }),
    heading('[Subtitle]', 2, { textAlign: 'right' }),
    paragraph('[Author name]', { textAlign: 'right', spaceBefore: 120 }),
    { type: 'pageBreak' },
  ],
  plain: [
    paragraph('', { spaceAfter: 144 }),
    heading('[Document title]', 1, { textAlign: 'center', styleId: 'title' }),
    paragraph('[Subtitle]', { textAlign: 'center' }),
    paragraph('[Author name]', { textAlign: 'center', spaceBefore: 48 }),
    paragraph('[Date]', { textAlign: 'center' }),
    { type: 'pageBreak' },
  ],
};
