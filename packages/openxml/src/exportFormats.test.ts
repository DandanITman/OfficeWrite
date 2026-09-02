import { describe, expect, it } from 'vitest';
import { exportToDocx, exportToHtml, exportToRtf, wrapOfficewriteFile, unwrapOfficewriteFile } from './index';

const sampleDoc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Test' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world', marks: [{ type: 'bold' }] }],
    },
  ],
};

describe('openxml export formats', () => {
  it('exports DOCX blob', async () => {
    const blob = await exportToDocx(sampleDoc, 'Test');
    expect(blob.size).toBeGreaterThan(100);
  });

  it('exports RTF string', () => {
    const rtf = exportToRtf(sampleDoc, 'Test');
    expect(rtf).toContain('\\rtf1');
    expect(rtf).toContain('Hello world');
  });

  it('exports HTML document', () => {
    const html = exportToHtml(sampleDoc, 'Test', { author: 'Tester' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<h1>Test</h1>');
    expect(html).toContain('<strong>Hello world</strong>');
  });

  it('round-trips officewrite envelope', () => {
    const wrapped = wrapOfficewriteFile(sampleDoc, { title: 'T', author: 'A' });
    const parsed = unwrapOfficewriteFile(wrapped);
    expect(parsed.metadata.title).toBe('T');
    expect(parsed.content).toEqual(sampleDoc);
  });
});
