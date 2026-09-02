import { Mark, mergeAttributes } from '@tiptap/core';

export const CommentAnchor = Mark.create({
  name: 'commentAnchor',
  inclusive: false,
  addAttributes() {
    return {
      commentId: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
        getAttrs: (el) => ({
          commentId: (el as HTMLElement).getAttribute('data-comment-id'),
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-comment-id': HTMLAttributes.commentId,
        class: 'comment-anchor',
      }),
      0,
    ];
  },
});
