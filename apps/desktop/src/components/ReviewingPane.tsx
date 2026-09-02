import { useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import type { DocumentComment } from '@officewrite/core';

interface Revision {
  kind: 'insert' | 'delete';
  author: string;
  text: string;
  pos: number;
}

/**
 * Review > Reviewing Pane.
 *
 * The vertical reviewing pane lists every revision and comment with its
 * author, and clicking an entry jumps to it. The list is read from the tracked
 * marks, so it cannot drift from what the document actually contains.
 */
export function ReviewingPane({
  open,
  editor,
  comments,
  onClose,
}: {
  open: boolean;
  editor: Editor | null;
  comments: DocumentComment[];
  onClose: () => void;
}) {
  const revisions = useMemo(() => {
    if (!editor) return [] as Revision[];
    const found: Revision[] = [];
    let previousEnd = -1;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const mark = node.marks.find(
        (entry) => entry.type.name === 'trackInsert' || entry.type.name === 'trackDelete',
      );
      if (!mark) return;
      const kind = mark.type.name === 'trackInsert' ? 'insert' : 'delete';
      const author = String(mark.attrs.author ?? 'Unknown');
      // Merge a contiguous run into one entry, as Word counts one revision per
      // run rather than one per keystroke.
      const previous = found[found.length - 1];
      if (previous && pos === previousEnd && previous.kind === kind && previous.author === author) {
        previous.text += node.text;
      } else {
        found.push({ kind, author, text: node.text, pos });
      }
      previousEnd = pos + node.nodeSize;
    });
    return found;
    // The document reference changes on every transaction, which is exactly when
    // this list needs recomputing.
  }, [editor, editor?.state.doc]);

  if (!open) return null;

  const goTo = (pos: number) => {
    editor?.chain().focus().setTextSelection(pos).scrollIntoView().run();
  };

  return (
    <aside className="side-pane reviewing-pane" data-testid="reviewing-pane">
      <div className="side-pane-header">
        <strong>Revisions</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="side-pane-body">
        <p className="muted" data-testid="reviewing-summary">
          {revisions.length} {revisions.length === 1 ? 'revision' : 'revisions'} ·{' '}
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </p>

        {revisions.map((revision, index) => (
          <button
            key={`${revision.pos}-${index}`}
            className={`reviewing-entry kind-${revision.kind}`}
            onClick={() => goTo(revision.pos)}
          >
            <span className="reviewing-entry-meta">
              {revision.author} · {revision.kind === 'insert' ? 'Inserted' : 'Deleted'}
            </span>
            <span className="reviewing-entry-text">{revision.text}</span>
          </button>
        ))}

        {comments.map((comment) => (
          <div key={comment.id} className={`reviewing-entry kind-comment${comment.resolved ? ' is-resolved' : ''}`}>
            <span className="reviewing-entry-meta">
              {comment.author || 'You'} · Commented{comment.resolved ? ' · Resolved' : ''}
            </span>
            <span className="reviewing-entry-text">{comment.text}</span>
          </div>
        ))}

        {revisions.length === 0 && comments.length === 0 && (
          <p className="muted">No revisions or comments yet.</p>
        )}
      </div>
    </aside>
  );
}
