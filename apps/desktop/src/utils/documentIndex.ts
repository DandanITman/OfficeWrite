import type { Editor } from '@tiptap/react';

/**
 * Reading the document back out: the lists the References tab, the
 * cross-reference dialog and the generated index blocks are built from.
 */

export interface BookmarkRef {
  name: string;
  from: number;
  to: number;
}

export function collectBookmarks(editor: Editor): BookmarkRef[] {
  const found: BookmarkRef[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === 'bookmark');
    if (!mark) return;
    const name = String(mark.attrs.name ?? '');
    if (!name || found.some((entry) => entry.name === name)) return;
    found.push({ name, from: pos, to: pos + node.nodeSize });
  });
  return found;
}

export interface CaptionRef {
  label: string;
  text: string;
  pos: number;
}

export function collectCaptions(editor: Editor): CaptionRef[] {
  const found: CaptionRef[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return;
    const label = node.attrs.caption as string | null;
    if (!label) return;
    found.push({ label, text: node.textContent, pos });
  });
  return found;
}

/** The next number for a caption label, so "Figure 3" follows "Figure 2". */
export function nextCaptionNumber(editor: Editor, label: string): number {
  return collectCaptions(editor).filter((caption) => caption.label === label).length + 1;
}

/** Index entries, deduplicated and alphabetised, as Insert Index produces. */
export function collectIndexEntries(editor: Editor): string[] {
  const entries = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === 'indexEntry');
    if (!mark) return;
    const entry = String(mark.attrs.entry ?? node.text ?? '').trim();
    if (entry) entries.add(entry);
  });
  return [...entries].sort((a, b) => a.localeCompare(b));
}

/** Replace the attributes of every node of a type - how the field blocks update. */
export function updateGeneratedBlocks(
  editor: Editor,
  nodeName: string,
  attrs: Record<string, unknown>,
): boolean {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === nodeName) positions.push(pos);
  });
  if (!positions.length) return false;

  const tr = editor.state.tr;
  for (const pos of positions) {
    const node = editor.state.doc.nodeAt(pos);
    if (!node) continue;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
  }
  editor.view.dispatch(tr);
  return true;
}

/**
 * Home > Sort.
 *
 * Sort orders the selected paragraphs, or the whole document when nothing is
 * selected. Sorting rewrites the paragraphs in place rather than replacing them
 * with plain text, so inline formatting survives the sort.
 */
export function sortParagraphs(editor: Editor, direction: 'asc' | 'desc'): boolean {
  const { from, to, empty } = editor.state.selection;
  const start = empty ? 0 : from;
  const end = empty ? editor.state.doc.content.size : to;

  const blocks: Array<{ from: number; to: number; text: string; json: unknown }> = [];
  editor.state.doc.nodesBetween(start, end, (node, pos) => {
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return;
    blocks.push({ from: pos, to: pos + node.nodeSize, text: node.textContent, json: node.toJSON() });
    return false;
  });

  if (blocks.length < 2) return false;

  const sorted = [...blocks].sort((a, b) =>
    direction === 'asc' ? a.text.localeCompare(b.text) : b.text.localeCompare(a.text),
  );
  if (sorted.every((block, index) => block.from === blocks[index].from)) return false;

  editor
    .chain()
    .focus()
    .insertContentAt(
      { from: blocks[0].from, to: blocks[blocks.length - 1].to },
      sorted.map((block) => block.json) as never,
    )
    .run();
  return true;
}

/** Positions of every tracked change, for the Previous/Next buttons. */
export function trackedChangePositions(editor: Editor): number[] {
  const positions: number[] = [];
  let previousEnd = -1;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const tracked = node.marks.some(
      (mark) => mark.type.name === 'trackInsert' || mark.type.name === 'trackDelete',
    );
    if (!tracked) return;
    // One entry per contiguous run: every keystroke makes its own mark
    // instance, so raw nodes would make a ten-letter word ten "changes".
    if (pos !== previousEnd) positions.push(pos);
    previousEnd = pos + node.nodeSize;
  });
  return positions;
}

/** Positions of every comment anchor, for the comment navigation buttons. */
export function commentAnchorPositions(editor: Editor): Array<{ id: string; pos: number }> {
  const anchors: Array<{ id: string; pos: number }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === 'commentAnchor');
    if (!mark) return;
    const id = String(mark.attrs.commentId ?? '');
    if (!id || anchors.some((anchor) => anchor.id === id)) return;
    anchors.push({ id, pos });
  });
  return anchors;
}
