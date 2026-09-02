import { describe, expect, it } from 'vitest';
import { exportToRtf } from './rtf';
import { importFromRtf } from './rtfImport';
import type { TipTapNode } from './rtfImport';

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

describe('RTF import', () => {
  // The previous importer ran a regex strip over the whole file, so every one
  // of these assertions would have failed: RTF opened as unformatted text.
  it('preserves bold, italic and underline', () => {
    const rtf = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Calibri;}}\f0\fs22 {\b bolded} {\i slanted} {\ul lined}\par}`;
    const doc = importFromRtf(rtf);

    expect(marksOn(doc, 'bolded')).toContain('bold');
    expect(marksOn(doc, 'slanted')).toContain('italic');
    expect(marksOn(doc, 'lined')).toContain('underline');
  });

  it('does not leak control words into the text', () => {
    const doc = importFromRtf(String.raw`{\rtf1\ansi\deff0\fs22 Plain body text\par}`);
    const text = textOf(doc);
    expect(text).toContain('Plain body text');
    expect(text).not.toContain('rtf1');
    expect(text).not.toContain('ansi');
    expect(text).not.toContain('fs22');
  });

  it('splits paragraphs on \\par', () => {
    const doc = importFromRtf(String.raw`{\rtf1\ansi First\par Second\par Third\par}`);
    const paragraphs = collect(doc, 'paragraph');
    expect(paragraphs).toHaveLength(3);
    expect(textOf(paragraphs[0])).toContain('First');
    expect(textOf(paragraphs[2])).toContain('Third');
  });

  it('preserves alignment', () => {
    const doc = importFromRtf(String.raw`{\rtf1\ansi\qc Centred\par\qr Right\par}`);
    const paragraphs = collect(doc, 'paragraph');
    expect(paragraphs[0]?.attrs?.textAlign).toBe('center');
    expect(paragraphs[1]?.attrs?.textAlign).toBe('right');
  });

  it('preserves font size and colour', () => {
    const rtf = String.raw`{\rtf1\ansi{\colortbl;\red255\green0\blue0;}\fs36\cf1 Big red\par}`;
    const doc = importFromRtf(rtf);
    const style = collect(doc, 'text')
      .find((t) => (t.text ?? '').includes('Big red'))
      ?.marks?.find((m) => m.type === 'textStyle');

    expect(style?.attrs?.fontSize).toBe('18pt');
    expect(style?.attrs?.color).toBe('#ff0000');
  });

  it('skips metadata groups rather than emitting them as text', () => {
    const rtf = String.raw`{\rtf1\ansi{\fonttbl{\f0 Calibri;}}{\info{\title Secret Title}}Visible\par}`;
    const text = textOf(importFromRtf(rtf));
    expect(text).toContain('Visible');
    expect(text).not.toContain('Secret Title');
    expect(text).not.toContain('Calibri');
  });

  it('decodes escaped characters and unicode', () => {
    // \'e9 is a code-page byte (é); 舒 is an em dash with '-' as the
    // single-character fallback that \uc1 says to skip.
    const rtf = "{\\rtf1\\ansi caf\\'e9 and \\u8212 -\\par}";
    const text = textOf(importFromRtf(rtf));
    expect(text).toContain('café');
    expect(text).toContain('—');
  });

  it('treats \\page as a page break', () => {
    const doc = importFromRtf(String.raw`{\rtf1\ansi Before\par\page After\par}`);
    expect(collect(doc, 'pageBreak')).toHaveLength(1);
  });

  it('round-trips this project’s own RTF export', () => {
    const rtf = exportToRtf(
      {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Report' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'emphasised', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' and plain' },
            ],
          },
        ],
      },
      'Report',
    );

    const doc = importFromRtf(rtf);
    expect(textOf(doc)).toContain('Report');
    expect(textOf(doc)).toContain('and plain');
    expect(marksOn(doc, 'emphasised')).toContain('bold');
  });
});
