import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { exportToDocx, exportToHtml, exportToRtf } from './index';

/**
 * Merge fields have to survive every export.
 *
 * They are inline atoms with no `.text`, and all three exporters walked inline
 * content by looking for text nodes or recursing into children - so a merge
 * field matched neither branch and vanished. Saving a merge main document as
 * `.docx`, `.rtf` or HTML therefore lost every field in it, silently, which is
 * the worst shape a data-loss bug can take: the file opens and looks fine.
 */

const docWithFields = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Dear ' },
        { type: 'mergeField', attrs: { kind: 'field', field: 'First Name' } },
        { type: 'text', text: ', your balance is ' },
        { type: 'mergeField', attrs: { kind: 'field', field: 'Balance' } },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'paragraph',
      content: [{ type: 'mergeField', attrs: { kind: 'addressBlock' } }],
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
};

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('Missing word/document.xml');
  return file.async('string');
}

describe('exporting merge fields', () => {
  it('writes each field into the .docx as its own «FieldName» text', async () => {
    const xml = await documentXml(await exportToDocx(docWithFields, { title: 'Merge' }));
    expect(xml).toContain('«First Name»');
    expect(xml).toContain('«Balance»');
    expect(xml).toContain('«AddressBlock»');
    expect(xml).toContain('«If…Then…Else»');
    // The surrounding sentence must still be intact around them.
    expect(xml).toContain('Dear ');
    expect(xml).toContain(', your balance is ');
  });

  it('writes each field into the RTF', () => {
    const rtf = exportToRtf(docWithFields, 'Merge');
    expect(rtf).toContain('«First Name»');
    expect(rtf).toContain('«AddressBlock»');
    expect(rtf).toContain('Dear ');
  });

  it('writes each field into the HTML, carrying its configuration', () => {
    const html = exportToHtml(docWithFields, 'Merge');
    expect(html).toContain('«First Name»');
    expect(html).toContain('data-merge-field="First Name"');
    expect(html).toContain('doc-merge-field');
    // The rule's whole configuration rides along, so reopening restores it.
    expect(html).toContain('ifThenElse');
  });

});
