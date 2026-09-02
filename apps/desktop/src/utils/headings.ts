import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { uiAlert } from './uiPrompt';

export interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

export function extractHeadingsFromDoc(doc: ProseMirrorNode): HeadingItem[] {
  const headings: HeadingItem[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        level: node.attrs.level as number,
        text: node.textContent,
        pos,
      });
    }
  });
  return headings;
}

export function extractHeadings(editor: Editor): HeadingItem[] {
  return extractHeadingsFromDoc(editor.state.doc);
}

export async function insertTableOfContents(editor: Editor) {
  const headings = extractHeadings(editor);
  if (!headings.length) {
    await uiAlert('Add headings to your document first.');
    return;
  }

  editor
    .chain()
    .focus()
    .insertContent([
      { type: 'tableOfContents' },
      { type: 'paragraph' },
    ])
    .run();
}

export function findCommentAnchorPos(editor: Editor, commentId: string): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === 'commentAnchor' && m.attrs.commentId === commentId);
    if (mark) {
      found = pos;
      return false;
    }
  });
  return found;
}

export function getCommentAnchorText(editor: Editor, commentId: string): string {
  const { state } = editor;
  let text = '';
  state.doc.descendants((node) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === 'commentAnchor' && m.attrs.commentId === commentId);
    if (mark) text += node.text;
  });
  return text.trim();
}

export function removeCommentAnchor(editor: Editor, commentId: string) {
  const { state } = editor;
  let tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === 'commentAnchor' && m.attrs.commentId === commentId);
    if (mark) {
      tr = tr.removeMark(pos, pos + node.nodeSize, mark.type);
    }
  });
  editor.view.dispatch(tr);
}
