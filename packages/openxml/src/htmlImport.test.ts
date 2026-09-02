// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { exportToHtml } from './html';
import { importFromHtml } from './htmlImport';
import type { TipTapNode } from './htmlImport';

function collect(node: TipTapNode | undefined, type: string, out: TipTapNode[] = []): TipTapNode[] {
  if (!node) return out;
  if (node.type === type) out.push(node);
  for (const child of node.content ?? []) collect(child, type, out);
  return out;
}

function textOf(node: TipTapNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(textOf).join('');
}

function marksOn(doc: TipTapNode, word: string): string[] {
  return collect(doc, 'text')
    .filter((t) => (t.text ?? '').includes(word))
    .flatMap((t) => (t.marks ?? []).map((m) => m.type));
}

describe('HTML import', () => {
  it('imports headings and paragraphs', () => {
    const doc = importFromHtml('<h1>Title</h1><p>Body</p>');
    const headings = collect(doc, 'heading');
    expect(headings).toHaveLength(1);
    expect(textOf(headings[0])).toBe('Title');
    expect(textOf(doc)).toContain('Body');
  });

  it('imports inline formatting', () => {
    const doc = importFromHtml('<p><strong>bolded</strong><em>slanted</em><u>lined</u><s>struck</s></p>');
    expect(marksOn(doc, 'bolded')).toContain('bold');
    expect(marksOn(doc, 'slanted')).toContain('italic');
    expect(marksOn(doc, 'lined')).toContain('underline');
    expect(marksOn(doc, 'struck')).toContain('strike');
  });

  it('imports hyperlinks with their href', () => {
    const doc = importFromHtml('<p><a href="https://example.com/a">link text</a></p>');
    const link = collect(doc, 'text')
      .find((t) => (t.text ?? '').includes('link text'))
      ?.marks?.find((m) => m.type === 'link');
    expect(link?.attrs?.href).toBe('https://example.com/a');
  });

  it('imports tables with header cells', () => {
    const doc = importFromHtml(
      '<table><tr><th>H1</th><th>H2</th></tr><tr><td>a</td><td>b</td></tr></table>',
    );
    const tables = collect(doc, 'table');
    expect(tables).toHaveLength(1);
    expect(collect(tables[0], 'tableRow')).toHaveLength(2);
    expect(collect(tables[0], 'tableHeader')).toHaveLength(2);
    expect(textOf(tables[0])).toContain('b');
  });

  it('imports ordered and bullet lists distinctly', () => {
    const doc = importFromHtml('<ol><li>one</li></ol><ul><li>dot</li></ul>');
    expect(collect(doc, 'orderedList')).toHaveLength(1);
    expect(collect(doc, 'bulletList')).toHaveLength(1);
  });

  it('imports nested lists', () => {
    const doc = importFromHtml('<ul><li>outer<ul><li>inner</li></ul></li></ul>');
    const lists = collect(doc, 'bulletList');
    expect(lists.length).toBe(2);
    expect(textOf(doc)).toContain('inner');
  });

  it('imports images with their dimensions', () => {
    const doc = importFromHtml('<p><img src="data:image/png;base64,AAA" alt="pic" width="200" /></p>');
    const images = collect(doc, 'image');
    expect(images).toHaveLength(1);
    expect(images[0].attrs?.alt).toBe('pic');
    expect(images[0].attrs?.width).toBe(200);
  });

  it('imports alignment from inline styles', () => {
    const doc = importFromHtml('<p style="text-align:center">centred</p>');
    const paragraph = collect(doc, 'paragraph').find((p) => textOf(p) === 'centred');
    expect(paragraph?.attrs?.textAlign).toBe('center');
  });

  it('ignores script and style elements', () => {
    const doc = importFromHtml('<style>p{color:red}</style><script>alert(1)</script><p>real</p>');
    const text = textOf(doc);
    expect(text).toContain('real');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
  });

  // exportToHtml has always existed and the project site advertises HTML as an
  // "open & save" format, but there was no import path at all until now.
  it('round-trips this project’s own HTML export', () => {
    const html = exportToHtml(
      {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Agenda' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'important', marks: [{ type: 'bold' }] }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
      'Agenda',
    );

    const doc = importFromHtml(html);
    expect(textOf(doc)).toContain('Agenda');
    expect(marksOn(doc, 'important')).toContain('bold');
    expect(collect(doc, 'table')).toHaveLength(1);
    expect(textOf(doc)).toContain('cell');
  });
  /**
   * The HTML round-trip is a real path: the app opens and saves `.html`. A merge
   * field is an inline atom, so the importer's generic branch read its visible
   * text and turned every field into the literal characters «FirstName» - which
   * opens without complaint and then merges to nothing.
   */
  it('restores merge fields, with their configuration, from exported HTML', () => {
    const html = exportToHtml(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Dear ' },
              { type: 'mergeField', attrs: { kind: 'field', field: 'First Name' } },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'mergeField',
                attrs: {
                  kind: 'rule',
                  rule: 'ifThenElse',
                  compareField: 'Balance',
                  comparison: 'greaterThan',
                  compareTo: '100',
                  trueText: 'Overdue',
                  falseText: 'Thanks',
                },
              },
            ],
          },
        ],
      },
      'Merge',
    );

    const doc = importFromHtml(html);
    const fields = collect(doc, 'mergeField');
    expect(fields).toHaveLength(2);
    expect(fields[0].attrs?.field).toBe('First Name');
    expect(fields[1].attrs?.rule).toBe('ifThenElse');
    expect(fields[1].attrs?.trueText).toBe('Overdue');
    // The ordinary text around them is untouched.
    expect(textOf(doc)).toContain('Dear ');
  });

  it('degrades a corrupt merge-field attribute to a plain named field', () => {
    const doc = importFromHtml(
      '<p><span data-merge-field="City" data-merge-config="{not json">«City»</span></p>',
    );
    const fields = collect(doc, 'mergeField');
    expect(fields).toHaveLength(1);
    expect(fields[0].attrs).toMatchObject({ kind: 'field', field: 'City' });
  });
});