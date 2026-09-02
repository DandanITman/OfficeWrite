import { Mark, mergeAttributes } from '@tiptap/core';

export const TrackInsert = Mark.create({
  name: 'trackInsert',
  addAttributes() {
    return {
      author: { default: 'You' },
      at: { default: () => new Date().toISOString() },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-track-insert]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-track-insert': 'true',
        class: 'track-insert',
      }),
      0,
    ];
  },
});
