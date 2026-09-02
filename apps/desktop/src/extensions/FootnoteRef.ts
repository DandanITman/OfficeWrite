import { Mark, mergeAttributes } from '@tiptap/core';

export const FootnoteRef = Mark.create({
  name: 'footnoteRef',

  addAttributes() {
    return {
      id: { default: null },
      number: { default: 1 },
      /** Footnotes collect per page; endnotes collect at the end of the document. */
      kind: { default: 'footnote' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'sup.footnote-ref',
        getAttrs: (el) => {
          const element = el as HTMLElement;
          const parsed = Number(element.textContent);
          return {
            id: element.dataset.footnoteId,
            number: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
            kind: element.dataset.noteKind ?? 'footnote',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { number: _number, id, kind, ...rest } = HTMLAttributes;
    // The third element must be ProseMirror's content hole (0), not the number.
    // A mark spec without a hole has its marked text appended to the rendered
    // element instead - and since the marked text *is* the number, footnote
    // markers rendered as "11", "22", "33".
    return [
      'sup',
      mergeAttributes(rest, {
        class: `footnote-ref${kind === 'endnote' ? ' endnote-ref' : ''}`,
        'data-footnote-id': id,
        'data-note-kind': kind ?? 'footnote',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setFootnoteRef:
        (attrs: { id: string; number: number; kind?: 'footnote' | 'endnote' }) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetFootnoteRef:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnoteRef: {
      setFootnoteRef: (attrs: { id: string; number: number; kind?: 'footnote' | 'endnote' }) => ReturnType;
      unsetFootnoteRef: () => ReturnType;
    };
  }
}
