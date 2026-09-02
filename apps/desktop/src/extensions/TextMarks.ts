import { Mark, mergeAttributes } from '@tiptap/core';

export const SuperscriptMark = Mark.create({
  name: 'superscript',
  excludes: 'subscript',

  parseHTML() {
    return [
      { tag: 'sup' },
      { style: 'vertical-align=super' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, { class: 'text-superscript' }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleSuperscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

export const SubscriptMark = Mark.create({
  name: 'subscript',
  excludes: 'superscript',

  parseHTML() {
    return [
      { tag: 'sub' },
      { style: 'vertical-align=sub' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sub',
      mergeAttributes(HTMLAttributes, { class: 'text-subscript' }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleSubscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    superscript: {
      toggleSuperscript: () => ReturnType;
    };
    subscript: {
      toggleSubscript: () => ReturnType;
    };
  }
}
