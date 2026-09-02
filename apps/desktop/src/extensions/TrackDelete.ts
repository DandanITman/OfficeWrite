import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * Text the author deleted while track changes was on.
 *
 * A word processor keeps deleted text in the document so a reviewer can reject the change
 * and get it back. Officewrite previously had no equivalent: only insertions were
 * marked, deletions really removed the text, and "Reject" could never restore
 * anything. This mark lets a deletion be shown struck through and either
 * removed for good (accept) or unmarked (reject).
 */
export const TrackDelete = Mark.create({
  name: 'trackDelete',
  // Restored text is a deletion, not an insertion. Declaring the exclusion
  // keeps a run from carrying both marks, which would otherwise produce two
  // conflicting accept/reject decisions for the same text.
  excludes: 'trackDelete trackInsert',

  addAttributes() {
    return {
      author: { default: 'You' },
      at: { default: () => new Date().toISOString() },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-track-delete]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-track-delete': 'true',
        class: 'track-delete',
      }),
      0,
    ];
  },
});
