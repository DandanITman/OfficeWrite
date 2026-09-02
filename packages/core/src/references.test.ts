import { describe, expect, it } from 'vitest';
import {
  formatBibliography,
  formatBibliographyEntry,
  formatCitation,
  suggestedTag,
  type CitationSource,
} from './references';

const knuth: CitationSource = {
  id: '1',
  type: 'book',
  author: 'Knuth, Donald',
  title: 'The Art of Computer Programming',
  year: '1986',
  publisher: 'Addison-Wesley',
  tag: 'Knu86',
};

const lovelace: CitationSource = {
  id: '2',
  type: 'journal',
  author: 'Lovelace, Ada',
  title: 'Notes on the Analytical Engine',
  year: '1843',
  container: 'Scientific Memoirs',
  volume: '3',
  pages: '666-731',
  tag: 'Lov43',
};

describe('citation tags', () => {
  it('builds short tags from the surname and year', () => {
    expect(suggestedTag('Knuth, Donald', '1986')).toBe('Knu86');
    expect(suggestedTag('Ada Lovelace', '1843')).toBe('Lov43');
  });
});

describe('in-text citations', () => {
  it('formats APA with the year', () => {
    expect(formatCitation(knuth, 'apa')).toBe('(Knuth, 1986)');
  });

  it('formats MLA with the page rather than the year', () => {
    expect(formatCitation(lovelace, 'mla')).toBe('(Lovelace 666-731)');
  });

  it('formats Chicago with year and page', () => {
    expect(formatCitation(lovelace, 'chicago')).toBe('(Lovelace 1843, 666-731)');
  });

  it('formats IEEE as the numeric tag', () => {
    expect(formatCitation(knuth, 'ieee')).toBe('[Knu86]');
  });
});

describe('bibliography entries', () => {
  it('formats an APA book entry', () => {
    expect(formatBibliographyEntry(knuth, 'apa')).toBe(
      'Knuth, D. (1986). The Art of Computer Programming. Addison-Wesley.',
    );
  });

  it('includes the journal, volume and pages for an article', () => {
    const entry = formatBibliographyEntry(lovelace, 'apa');
    expect(entry).toContain('Scientific Memoirs, 3,');
    expect(entry).toContain('666-731');
  });

  it('sorts alphabetically for the author-date styles', () => {
    const entries = formatBibliography([knuth, lovelace], 'apa');
    expect(entries[0]).toContain('Knuth');
    expect(entries[1]).toContain('Lovelace');
  });

  it('keeps the document order for IEEE, which numbers by first use', () => {
    const entries = formatBibliography([lovelace, knuth], 'ieee');
    expect(entries[0]).toContain('Lov43');
  });
});
