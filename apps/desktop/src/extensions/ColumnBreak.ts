import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Layout > Breaks > Column used to call insertPageBreak, so it silently gave
 * the user a page break. The document body lays its columns out with real CSS
 * multi-column, so `break-before: column` is all a genuine column break needs.
 */
export const ColumnBreak = Node.create({
  name: 'columnBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-column-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-column-break': 'true', class: 'column-break-node' }),
    ];
  },

  addCommands() {
    return {
      insertColumnBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columnBreak: {
      insertColumnBreak: () => ReturnType;
    };
  }
}
