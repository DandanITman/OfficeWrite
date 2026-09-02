import { describe, expect, it } from 'vitest';
import { compareDocuments } from './compareDocuments';

function doc(...paragraphs: string[]) {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  };
}

function marksIn(content: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    for (const mark of (record.marks as Array<{ type: string }> | undefined) ?? []) {
      found.push(mark.type);
    }
    if (record.content) walk(record.content);
  };
  walk((content as { content?: unknown }).content);
  return found;
}

describe('compareDocuments', () => {
  it('marks a replaced paragraph as one deletion and one insertion', () => {
    const result = compareDocuments(doc('Shared', 'Original'), doc('Shared', 'Revised'));
    expect(result.deletions).toBe(1);
    expect(result.insertions).toBe(1);

    const marks = marksIn(result.content);
    expect(marks).toContain('trackDelete');
    expect(marks).toContain('trackInsert');
  });

  it('leaves identical documents unmarked', () => {
    const result = compareDocuments(doc('One', 'Two'), doc('One', 'Two'));
    expect(result).toMatchObject({ insertions: 0, deletions: 0 });
    expect(marksIn(result.content)).toEqual([]);
  });

  it('records an added paragraph as an insertion only', () => {
    const result = compareDocuments(doc('One'), doc('One', 'Two'));
    expect(result).toMatchObject({ insertions: 1, deletions: 0 });
  });

  it('records a removed paragraph as a deletion only', () => {
    const result = compareDocuments(doc('One', 'Two'), doc('One'));
    expect(result).toMatchObject({ insertions: 0, deletions: 1 });
  });

  it('attributes the revisions to the named reviewer', () => {
    const result = compareDocuments(doc('A'), doc('B'), 'Reviewer.docx');
    expect(JSON.stringify(result.content)).toContain('"author":"Reviewer.docx"');
  });

  it('keeps the shared paragraphs in order around the changes', () => {
    const result = compareDocuments(doc('A', 'B', 'C'), doc('A', 'X', 'C'));
    const text = JSON.stringify(result.content);
    expect(text.indexOf('"A"')).toBeLessThan(text.indexOf('"B"'));
    expect(text.indexOf('"X"')).toBeLessThan(text.indexOf('"C"'));
  });

  it('survives an empty document on either side', () => {
    expect(compareDocuments({ type: 'doc', content: [] }, doc('New')).insertions).toBe(1);
    expect(compareDocuments(doc('Old'), { type: 'doc', content: [] }).deletions).toBe(1);
  });
});
