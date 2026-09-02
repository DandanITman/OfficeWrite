import { describe, expect, it, afterEach } from 'vitest';
import type { Editor } from '@tiptap/core';
import { createTestEditor } from './testEditor';
import { extractWords } from '../extensions/ProofingCheck';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('editor schema', () => {
  // The test editor used to register six extensions while the app registered
  // twenty-five, so none of these could be checked at all.
  it('registers every extension the app uses', () => {
    editor = createTestEditor();
    const names = new Set(editor.extensionManager.extensions.map((e) => e.name));

    for (const required of [
      'highlight',
      'textStyle',
      'color',
      'fontFamily',
      'link',
      'image',
      'table',
      'pageBreak',
      'docShape',
      'footnoteRef',
      'tableOfContents',
      'commentAnchor',
      'trackInsert',
      'trackDelete',
      'superscript',
      'subscript',
      'paragraphFormatting',
    ]) {
      expect(names, `missing extension: ${required}`).toContain(required);
    }
  });

  // The mark's renderHTML returned the number as a text child instead of
  // ProseMirror's content hole, so the marked text was appended to a <sup>
  // that already contained it and markers rendered as "11", "22", "33".
  it('renders a footnote marker exactly once', () => {
    editor = createTestEditor({
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
    });

    const html = editor.getHTML();
    const marker = html.match(/<sup[^>]*class="footnote-ref"[^>]*>([\s\S]*?)<\/sup>/);
    expect(marker).not.toBeNull();
    expect(marker![1]).toBe('1');
    expect(editor.getText()).toBe('Claim1');
  });

  it('emits paragraph border and shading rules only once', () => {
    editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { borderColor: '#ff0000', shading: '#eeeeee', indentLevel: 1 },
          content: [{ type: 'text', text: 'styled' }],
        },
      ],
    });

    const html = editor.getHTML();
    expect(html.match(/border-left/g) ?? []).toHaveLength(1);
    expect(html.match(/background-color/g) ?? []).toHaveLength(1);
  });

  it('does not emit paragraph attributes as bare HTML attributes', () => {
    editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { lineHeight: '1.5', spaceBefore: 12, spaceAfter: 8 },
          content: [{ type: 'text', text: 'spaced' }],
        },
      ],
    });

    const html = editor.getHTML();
    expect(html).not.toMatch(/\slineheight=/i);
    expect(html).not.toMatch(/\sspacebefore=/i);
    expect(html).not.toMatch(/\sspaceafter=/i);
    expect(html).toContain('line-height: 1.5');
  });
});

describe('spell-check tokenizer', () => {
  // The ASCII-only /[A-Za-z']+/ pattern split accented words apart, defeating
  // the German, Spanish and French dictionaries the app ships.
  it('keeps accented words whole', () => {
    expect(extractWords('Straße').map((w) => w.word)).toEqual(['Straße']);
    expect(extractWords('mañana').map((w) => w.word)).toEqual(['mañana']);
    expect(extractWords('déjà vu').map((w) => w.word)).toEqual(['déjà', 'vu']);
  });

  it('keeps internal apostrophes and hyphens but not trailing ones', () => {
    expect(extractWords("don't").map((w) => w.word)).toEqual(["don't"]);
    expect(extractWords('well-known').map((w) => w.word)).toEqual(['well-known']);
    expect(extractWords("'quoted'").map((w) => w.word)).toEqual(['quoted']);
  });

  it('reports positions that match the source text', () => {
    const [second] = extractWords('one two').slice(1);
    expect('one two'.slice(second.from, second.to)).toBe('two');
  });

  it('ignores digits and punctuation', () => {
    expect(extractWords('123 -- !!').map((w) => w.word)).toEqual([]);
  });
});
