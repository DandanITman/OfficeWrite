import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { exportToDocx } from './docxExport';
import { DEFAULT_PAGE_SETUP } from '@officewrite/core';

const sampleWithRichContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'See note', marks: [{ type: 'footnoteRef', attrs: { id: 'fn-1', number: 1 } }] },
      ],
    },
    {
      type: 'image',
      attrs: {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        width: 120,
        height: 90,
        align: 'left',
      },
    },
    {
      type: 'docShape',
      attrs: { shapeType: 'rect', width: 100, height: 60, fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2 },
    },
    { type: 'pageBreak' },
    { type: 'paragraph', content: [{ type: 'text', text: 'Page two' }] },
  ],
};

/** Read a part out of the exported package as text. */
async function partOf(blob: Blob, name: string): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const file = zip.file(name);
  if (!file) throw new Error(`Missing part: ${name}`);
  return file.async('string');
}

async function entriesOf(blob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return Object.keys(zip.files);
}

describe('docxExport', () => {
  // This used to assert `blob.size > 500` and nothing else, while being the
  // only coverage of images, shapes, footnotes and multi-column layout.
  it('TC-UNIT-002: writes footnotes, images, shapes and page breaks into the package', async () => {
    const blob = await exportToDocx(sampleWithRichContent, {
      title: 'Rich',
      pageSetup: { ...DEFAULT_PAGE_SETUP, columns: { count: 2, gap: 48, line: false } },
      footnotes: [{ id: 'fn-1', text: 'Footnote body' }],
    });

    const entries = await entriesOf(blob);
    expect(entries).toContain('word/document.xml');
    expect(entries).toContain('word/footnotes.xml');
    // Both the image and the shape's SVG land in the media folder.
    expect(entries.filter((e) => e.startsWith('word/media/')).length).toBeGreaterThanOrEqual(2);

    const document = await partOf(blob, 'word/document.xml');
    expect(document).toContain('<w:drawing>');
    expect(document).toContain('w:footnoteReference');
    expect(document).toContain('w:type="page"');

    const footnotes = await partOf(blob, 'word/footnotes.xml');
    expect(footnotes).toContain('Footnote body');
  });

  it('writes the requested column layout into the section properties', async () => {
    const blob = await exportToDocx(sampleWithRichContent, {
      pageSetup: { ...DEFAULT_PAGE_SETUP, columns: { count: 3, gap: 24, line: false } },
    });

    const document = await partOf(blob, 'word/document.xml');
    expect(document).toMatch(/<w:cols[^>]*w:num="3"/);
  });

  it('writes an image at the size it was given, not a forced 4:3 box', async () => {
    const blob = await exportToDocx(sampleWithRichContent, {});
    const document = await partOf(blob, 'word/document.xml');

    // 120x90 px at 9525 EMU per pixel.
    expect(document).toContain(`cx="${120 * 9525}"`);
    expect(document).toContain(`cy="${90 * 9525}"`);
  });

  it('produces a real zip package', async () => {
    const blob = await exportToDocx(sampleWithRichContent, {});
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // PK\x03\x04
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("writes the document's Normal style as the package default font", async () => {
    // The app's default font used to set a CSS variable and nothing else, so a
    // document written in Georgia 13 exported as Word's Calibri 11.
    const blob = await exportToDocx(sampleWithRichContent, {
      customStyles: [{ id: 'normal', name: 'Normal', fontFamily: 'Georgia', fontSize: '13pt' }],
    });
    const styles = await partOf(blob, 'word/styles.xml');

    const defaults = styles.slice(0, styles.indexOf('</w:docDefaults>'));
    expect(defaults).toContain('Georgia');
    // 13pt in half-points.
    expect(defaults).toContain('w:val="26"');
  });

  it('writes comment content into the comments part', async () => {
    const blob = await exportToDocx(sampleWithRichContent, {
      comments: [
        {
          id: 'c1',
          text: 'Needs a source.',
          author: 'Reviewer',
          created: '2026-01-15T12:00:00.000Z',
          resolved: false,
        },
      ],
    });
    expect(await partOf(blob, 'word/comments.xml')).toContain('Needs a source.');
  });
  it('writes real column widths into the table grid', async () => {
    // A table whose first two columns were resized; the third is untouched.
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', attrs: { colwidth: [192] }, content: [] },
                { type: 'tableCell', attrs: { colwidth: [96] }, content: [] },
                { type: 'tableCell', attrs: { colwidth: null }, content: [] },
              ],
            },
          ],
        },
      ],
    };

    const xml = await partOf(await exportToDocx(doc, {}), 'word/document.xml');
    // 192px and 96px are 2in and 1in, so 2880 and 1440 twips.
    expect(xml).toContain('<w:gridCol w:w="2880"/>');
    expect(xml).toContain('<w:gridCol w:w="1440"/>');
    // The unsized column takes what is left of the 6.5in text width.
    expect(xml).toContain('<w:gridCol w:w="5040"/>');
    // The old writer emitted a flat 100 twips for every column.
    expect(xml).not.toContain('<w:gridCol w:w="100"/>');
  });
  it('carries a dragged row height into the row properties', async () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              attrs: { height: 48 },
              content: [{ type: 'tableCell', attrs: {}, content: [] }],
            },
            {
              type: 'tableRow',
              attrs: {},
              content: [{ type: 'tableCell', attrs: {}, content: [] }],
            },
          ],
        },
      ],
    };

    const xml = await partOf(await exportToDocx(doc, {}), 'word/document.xml');
    // 48px is half an inch: 720 twips. "atLeast" so text is never clipped.
    expect(xml).toContain('w:val="720"');
    expect(xml).toContain('w:hRule="atLeast"');
    // The untouched row must not gain a height.
    expect(xml.match(/<w:trHeight/g)).toHaveLength(1);
  });

  // taskList had no case in the exporter, so it fell through to the branch that
  // recurses into children: the item text was written but the checkbox - the
  // only thing that makes it a checklist - was silently dropped.
  it('keeps checkbox state when exporting a task list', async () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Packed' }] }],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Still to do' }] }],
            },
          ],
        },
      ],
    };

    const xml = await partOf(await exportToDocx(doc, {}), 'word/document.xml');
    expect(xml).toContain('☒ ');
    expect(xml).toContain('☐ ');
    expect(xml).toContain('Packed');
    expect(xml).toContain('Still to do');
  });
});
