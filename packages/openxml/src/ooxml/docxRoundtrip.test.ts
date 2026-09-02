import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SETUP } from '@officewrite/core';
import { exportToDocx } from '../docxExport';
import { importDocx, type TipTapNode } from './docxImport';

async function roundTrip(content: unknown, options: Parameters<typeof exportToDocx>[1] = {}) {
  const blob = await exportToDocx(content, options);
  return importDocx(await blob.arrayBuffer());
}

/** Collect every node of a given type, depth-first. */
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

function marksOn(node: TipTapNode, word: string): string[] {
  const texts = collect(node, 'text').filter((t) => (t.text ?? '').includes(word));
  return texts.flatMap((t) => (t.marks ?? []).map((m) => m.type));
}

describe('DOCX round trip', () => {
  it('preserves headings and paragraph text', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
      ],
    });

    const headings = collect(result.content, 'heading');
    expect(headings).toHaveLength(1);
    expect(textOf(headings[0])).toBe('Title');
    expect(textOf(result.content)).toContain('Body text');
  });

  it('preserves character formatting', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bolded', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'italicised', marks: [{ type: 'italic' }] },
            { type: 'text', text: 'underlined', marks: [{ type: 'underline' }] },
            { type: 'text', text: 'struck', marks: [{ type: 'strike' }] },
          ],
        },
      ],
    });

    expect(marksOn(result.content, 'bolded')).toContain('bold');
    expect(marksOn(result.content, 'italicised')).toContain('italic');
    expect(marksOn(result.content, 'underlined')).toContain('underline');
    expect(marksOn(result.content, 'struck')).toContain('strike');
  });

  it('preserves font colour, family and size', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'styled',
              marks: [
                {
                  type: 'textStyle',
                  attrs: { color: '#ff0000', fontFamily: 'Georgia', fontSize: '18pt' },
                },
              ],
            },
          ],
        },
      ],
    });

    const styled = collect(result.content, 'text').find((t) => t.text === 'styled');
    const textStyle = styled?.marks?.find((m) => m.type === 'textStyle');
    expect(textStyle?.attrs?.color?.toString().toLowerCase()).toBe('#ff0000');
    expect(textStyle?.attrs?.fontFamily).toBe('Georgia');
    expect(textStyle?.attrs?.fontSize).toBe('18pt');
  });

  // Previously: mammoth -> HTML -> a walker with no TABLE branch, so tables
  // were unwrapped into loose paragraphs and the structure was lost.
  it('preserves tables as tables', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'r1c1' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'r1c2' }] }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'r2c1' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'r2c2' }] }] },
              ],
            },
          ],
        },
      ],
    });

    const tables = collect(result.content, 'table');
    expect(tables).toHaveLength(1);
    const rows = collect(tables[0], 'tableRow');
    expect(rows).toHaveLength(2);
    expect(collect(rows[0], 'tableCell')).toHaveLength(2);
    expect(textOf(tables[0])).toContain('r2c2');
  });

  // Previously: the `link` mark was never written on export, and the importer
  // had no A branch, so the href was lost in both directions.
  it('preserves hyperlinks with their href', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Officewrite site',
              marks: [{ type: 'link', attrs: { href: 'https://example.com/docs' } }],
            },
          ],
        },
      ],
    });

    const linked = collect(result.content, 'text').find((t) => (t.text ?? '').includes('Officewrite site'));
    const link = linked?.marks?.find((m) => m.type === 'link');
    expect(link).toBeDefined();
    expect(link?.attrs?.href).toBe('https://example.com/docs');
  });

  // Previously: both list types exported as `bullet: { level: 0 }`, so numbered
  // lists came back as bullets and inline marks inside items were dropped.
  it('keeps ordered lists ordered and preserves item formatting', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'first', marks: [{ type: 'bold' }] }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'second' }] }],
            },
          ],
        },
      ],
    });

    expect(collect(result.content, 'orderedList')).toHaveLength(1);
    expect(collect(result.content, 'bulletList')).toHaveLength(0);
    expect(marksOn(result.content, 'first')).toContain('bold');
  });

  it('keeps bullet lists as bullet lists', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'point' }] }],
            },
          ],
        },
      ],
    });

    expect(collect(result.content, 'bulletList')).toHaveLength(1);
    expect(collect(result.content, 'orderedList')).toHaveLength(0);
  });

  // Previously: page setup was never read back, so an A4 landscape document
  // always reopened as US Letter portrait.
  it('preserves page size, orientation and margins', async () => {
    const pageSetup = {
      ...DEFAULT_PAGE_SETUP,
      size: 'a4' as const,
      orientation: 'landscape' as const,
      margins: { top: 48, bottom: 48, left: 144, right: 144 },
      columns: { count: 2, gap: 48, line: false },
    };

    const result = await roundTrip(
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
      { pageSetup },
    );

    expect(result.pageSetup.size).toBe('a4');
    expect(result.pageSetup.orientation).toBe('landscape');
    expect(result.pageSetup.margins.left).toBe(144);
    expect(result.pageSetup.margins.top).toBe(48);
    expect(result.pageSetup.columns.count).toBe(2);
  });

  it('preserves headers, footers and the page-number flag', async () => {
    const result = await roundTrip(
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
      {
        headerFooter: { header: 'Quarterly Report', footer: 'Confidential', showPageNumbers: true },
      },
    );

    expect(result.headerFooter.header).toContain('Quarterly Report');
    expect(result.headerFooter.footer).toContain('Confidential');
    expect(result.headerFooter.showPageNumbers).toBe(true);
  });

  it('preserves footnotes and their references', async () => {
    const result = await roundTrip(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Claim' },
              {
                type: 'text',
                text: '1',
                marks: [{ type: 'footnoteRef', attrs: { id: 'fn-a', number: 1 } }],
              },
            ],
          },
        ],
      },
      { footnotes: [{ id: 'fn-a', text: 'Supporting detail.' }] },
    );

    expect(result.footnotes).toHaveLength(1);
    expect(result.footnotes[0].text).toContain('Supporting detail.');
    const refs = collect(result.content, 'text').filter((t) =>
      (t.marks ?? []).some((m) => m.type === 'footnoteRef'),
    );
    expect(refs.length).toBeGreaterThan(0);
  });

  it('preserves paragraph alignment and indentation', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center', indentLevel: 2 },
          content: [{ type: 'text', text: 'centred' }],
        },
      ],
    });

    const paragraphs = collect(result.content, 'paragraph').filter((p) => textOf(p) === 'centred');
    expect(paragraphs[0]?.attrs?.textAlign).toBe('center');
    expect(paragraphs[0]?.attrs?.indentLevel).toBe(2);
  });

  it('preserves page breaks', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
        { type: 'pageBreak' },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    });

    expect(collect(result.content, 'pageBreak').length).toBeGreaterThan(0);
  });

  // Previously: images landed inside a paragraph while ResizableImage is a
  // block node, making the result schema-invalid, and the height was always
  // forced to width * 0.75 on export.
  it('preserves images at their real aspect ratio', async () => {
    const onePixelPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const result = await roundTrip({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: onePixelPng, width: 300, height: 100, alt: 'wide' } }],
    });

    const images = collect(result.content, 'image');
    expect(images).toHaveLength(1);
    expect(String(images[0].attrs?.src)).toMatch(/^data:image\/png;base64,/);
    expect(images[0].attrs?.width).toBe(300);
    expect(images[0].attrs?.height).toBe(100);
  });

  it('places images as block nodes, never inside a paragraph', async () => {
    const onePixelPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const result = await roundTrip({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: onePixelPng, width: 120, height: 120 } }],
    });

    // An image must be a direct child of the doc, not nested in a paragraph.
    const topLevel = result.content.content ?? [];
    expect(topLevel.some((n) => n.type === 'image')).toBe(true);
  });
});

describe('DOCX round trip: review and structure', () => {
  // Previously: nothing read word/comments.xml and nothing wrote it, so a
  // reviewed document lost every comment in both directions.
  it('preserves comments and their anchors', async () => {
    const result = await roundTrip(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Plain start. ' },
              {
                type: 'text',
                text: 'flagged phrase',
                marks: [{ type: 'commentAnchor', attrs: { commentId: 'c1' } }],
              },
              { type: 'text', text: ' plain end.' },
            ],
          },
        ],
      },
      {
        comments: [
          {
            id: 'c1',
            text: 'Please reword this.',
            author: 'Reviewer',
            created: '2026-01-15T12:00:00.000Z',
            resolved: false,
          },
        ],
      },
    );

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].text).toContain('Please reword this.');
    expect(result.comments[0].author).toBe('Reviewer');

    // The comment must come back attached to the same words.
    const anchored = collect(result.content, 'text').filter((t) =>
      (t.marks ?? []).some((m) => m.type === 'commentAnchor'),
    );
    expect(anchored.map((t) => t.text).join('')).toContain('flagged phrase');
  });

  // Previously: the trackInsert/trackDelete marks were never written, and
  // w:ins/w:del were never read, so pending changes vanished on export.
  it('preserves tracked insertions and deletions', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'kept ' },
            {
              type: 'text',
              text: 'added words',
              marks: [{ type: 'trackInsert', attrs: { author: 'Ann', at: '2026-01-15T12:00:00Z' } }],
            },
            {
              type: 'text',
              text: 'removed words',
              marks: [{ type: 'trackDelete', attrs: { author: 'Bob', at: '2026-01-15T12:00:00Z' } }],
            },
          ],
        },
      ],
    });

    expect(marksOn(result.content, 'added words')).toContain('trackInsert');
    expect(marksOn(result.content, 'removed words')).toContain('trackDelete');

    const inserted = collect(result.content, 'text').find((t) => t.text === 'added words');
    const mark = inserted?.marks?.find((m) => m.type === 'trackInsert');
    expect(mark?.attrs?.author).toBe('Ann');
  });

  // Previously: w:ilvl was read only to choose bullet vs ordered and every
  // item went into one buffer, so a three-level list came back flat.
  it('preserves nested list structure', async () => {
    const nested = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'level one' }] },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'level two' }] },
                        {
                          type: 'bulletList',
                          content: [
                            {
                              type: 'listItem',
                              content: [
                                {
                                  type: 'paragraph',
                                  content: [{ type: 'text', text: 'level three' }],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await roundTrip(nested);

    // Three distinct lists, not one flat list of three items.
    expect(collect(result.content, 'bulletList')).toHaveLength(3);

    const outer = collect(result.content, 'bulletList')[0];
    expect((outer.content ?? []).length).toBe(1);
    expect(textOf(result.content)).toContain('level three');

    // The deepest item must actually be nested two levels down.
    const depthOf = (node: TipTapNode | undefined, needle: string, depth = 0): number => {
      if (!node) return -1;
      if (node.type === 'text' && (node.text ?? '').includes(needle)) return depth;
      for (const child of node.content ?? []) {
        const found = depthOf(child, needle, child.type === 'bulletList' ? depth + 1 : depth);
        if (found >= 0) return found;
      }
      return -1;
    };
    expect(depthOf(result.content, 'level three')).toBe(3);
    expect(depthOf(result.content, 'level one')).toBe(1);
  });

  it('keeps sibling list items at the same level', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: ['first', 'second', 'third'].map((text) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
          })),
        },
      ],
    });

    const lists = collect(result.content, 'orderedList');
    expect(lists).toHaveLength(1);
    expect((lists[0].content ?? []).length).toBe(3);
  });

  // Previously: shapes exported as SVG with a 1x1 PNG fallback, and the
  // importer read only the fallback, so every shape returned as one pixel.
  it('preserves shapes as shapes', async () => {
    const result = await roundTrip({
      type: 'doc',
      content: [
        {
          type: 'docShape',
          attrs: {
            shapeType: 'circle',
            width: 180,
            height: 120,
            fill: '#3b82f6',
            stroke: '#1e40af',
            strokeWidth: 2,
          },
        },
      ],
    });

    const shapes = collect(result.content, 'docShape');
    expect(shapes).toHaveLength(1);
    expect(shapes[0].attrs?.shapeType).toBe('circle');
    expect(shapes[0].attrs?.width).toBe(180);
    expect(shapes[0].attrs?.height).toBe(120);
    expect(shapes[0].attrs?.fill).toBe('#3b82f6');
    // It must not have degraded into the raster fallback.
    expect(collect(result.content, 'image')).toHaveLength(0);
  });
});
