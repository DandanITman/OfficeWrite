/**
 * References tab data: bibliography sources, citation formatting, captions and
 * cross-reference labels.
 */

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee';

export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  apa: 'APA',
  mla: 'MLA',
  chicago: 'Chicago',
  ieee: 'IEEE',
};

export type SourceType = 'book' | 'journal' | 'website' | 'report' | 'conference';

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  book: 'Book',
  journal: 'Journal Article',
  website: 'Web site',
  report: 'Report',
  conference: 'Conference Proceedings',
};

export interface CitationSource {
  id: string;
  type: SourceType;
  /** "Surname, First" or an organisation name. */
  author: string;
  title: string;
  year: string;
  publisher?: string;
  /** Journal, book or site name the work appeared in. */
  container?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  accessed?: string;
  /** The short tag placed in the document, e.g. "Knu86". */
  tag: string;
}

function surname(author: string): string {
  const trimmed = author.trim();
  if (!trimmed) return 'Anon';
  if (trimmed.includes(',')) return trimmed.split(',')[0].trim();
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

function initials(author: string): string {
  const trimmed = author.trim();
  if (!trimmed) return '';
  const given = trimmed.includes(',') ? trimmed.split(',')[1] ?? '' : trimmed.split(/\s+/).slice(0, -1).join(' ');
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ');
}

/** The tag generated for a new source: first three letters plus the year. */
export function suggestedTag(author: string, year: string): string {
  const base = surname(author).replace(/[^\p{L}]/gu, '').slice(0, 3) || 'Src';
  const capitalised = base[0].toUpperCase() + base.slice(1).toLowerCase();
  return `${capitalised}${year.replace(/[^0-9]/g, '').slice(-2)}`;
}

/** The in-text citation, as Insert Citation puts it in the document. */
export function formatCitation(source: CitationSource, style: CitationStyle): string {
  const name = surname(source.author);
  switch (style) {
    case 'mla':
      return source.pages ? `(${name} ${source.pages})` : `(${name})`;
    case 'chicago':
      return `(${name} ${source.year}${source.pages ? `, ${source.pages}` : ''})`;
    case 'ieee':
      return `[${source.tag}]`;
    case 'apa':
    default:
      return `(${name}, ${source.year}${source.pages ? `, p. ${source.pages}` : ''})`;
  }
}

/** One bibliography entry. */
export function formatBibliographyEntry(source: CitationSource, style: CitationStyle): string {
  const name = surname(source.author);
  const given = initials(source.author);
  const container = source.container ?? '';
  const publisher = source.publisher ?? '';

  switch (style) {
    case 'mla': {
      const parts = [`${name}, ${given || ''}`.trim().replace(/,$/, ''), `"${source.title}."`];
      if (container) parts.push(`${container},`);
      if (source.volume) parts.push(`vol. ${source.volume},`);
      if (source.issue) parts.push(`no. ${source.issue},`);
      parts.push(`${source.year},`);
      if (source.pages) parts.push(`pp. ${source.pages}.`);
      if (publisher) parts.push(`${publisher}.`);
      if (source.url) parts.push(source.url);
      return parts.join(' ').replace(/,\s*$/, '.');
    }
    case 'chicago': {
      const parts = [`${name}, ${given}`.trim(), `${source.title}.`];
      if (container) parts.push(`${container}.`);
      if (publisher) parts.push(`${publisher},`);
      parts.push(`${source.year}.`);
      if (source.url) parts.push(source.url);
      return parts.join(' ');
    }
    case 'ieee': {
      const parts = [`[${source.tag}]`, `${given} ${name},`, `"${source.title},"`];
      if (container) parts.push(`${container},`);
      if (source.volume) parts.push(`vol. ${source.volume},`);
      if (source.issue) parts.push(`no. ${source.issue},`);
      if (source.pages) parts.push(`pp. ${source.pages},`);
      parts.push(`${source.year}.`);
      return parts.join(' ');
    }
    case 'apa':
    default: {
      const parts = [`${name}, ${given}`.trim().replace(/,$/, ''), `(${source.year}).`, `${source.title}.`];
      if (container) parts.push(source.volume ? `${container}, ${source.volume}${source.issue ? `(${source.issue})` : ''},` : `${container}.`);
      if (source.pages) parts.push(`${source.pages}.`);
      if (publisher) parts.push(`${publisher}.`);
      if (source.url) parts.push(source.url);
      return parts.join(' ');
    }
  }
}

/** The whole bibliography, sorted the way the chosen style requires. */
export function formatBibliography(sources: CitationSource[], style: CitationStyle): string[] {
  const ordered =
    style === 'ieee'
      ? [...sources]
      : [...sources].sort((a, b) => surname(a.author).localeCompare(surname(b.author)));
  return ordered.map((source) => formatBibliographyEntry(source, style));
}

/** Insert Caption's label choices. */
export type CaptionLabel = 'Figure' | 'Table' | 'Equation';

export const CAPTION_LABELS: CaptionLabel[] = ['Figure', 'Table', 'Equation'];

/** Cross-reference targets offered. */
export type CrossReferenceKind = 'heading' | 'bookmark' | 'figure' | 'table' | 'footnote';

export const CROSS_REFERENCE_LABELS: Record<CrossReferenceKind, string> = {
  heading: 'Heading',
  bookmark: 'Bookmark',
  figure: 'Figure',
  table: 'Table',
  footnote: 'Footnote',
};
