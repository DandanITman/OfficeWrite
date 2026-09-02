import type { Editor } from '@tiptap/react';
import type { DocumentComment } from '@officewrite/core';
import { findCommentAnchorPos, getCommentAnchorText, removeCommentAnchor } from '../utils/headings';
import { uiAlert, uiPrompt } from '../utils/uiPrompt';

interface CommentsPaneProps {
  open: boolean;
  editor: Editor | null;
  comments: DocumentComment[];
  onAdd: (text: string, anchorText?: string) => string | void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function CommentsPane({
  open,
  editor,
  comments,
  onAdd,
  onResolve,
  onDelete,
  onClose,
}: CommentsPaneProps) {
  if (!open) return null;

  const handleAddFromSelection = async () => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      await uiAlert('Select text to attach a comment.');
      return;
    }
    const text = await uiPrompt('Comment text');
    if (!text?.trim()) return;

    const anchorText = editor.state.doc.textBetween(from, to, ' ');
    const id = onAdd(text.trim(), anchorText);
    if (typeof id === 'string') {
      editor.chain().focus().setTextSelection({ from, to }).setMark('commentAnchor', { commentId: id }).run();
    }
  };

  const handleAddDocumentComment = async () => {
    const text = await uiPrompt('Comment text');
    if (text?.trim()) onAdd(text.trim());
  };

  const goToComment = async (id: string) => {
    if (!editor) return;
    const pos = findCommentAnchorPos(editor, id);
    if (pos === null) {
      await uiAlert('This comment is no longer anchored in the document.');
      return;
    }
    editor.chain().focus().setTextSelection(pos + 1).run();
  };

  return (
    <aside className="side-pane">
      <div className="side-pane-header">
        <strong>Comments</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" onClick={handleAddFromSelection} title="Comment on selection">
            + Selection
          </button>
          <button className="icon-btn" onClick={handleAddDocumentComment} title="Document comment">
            + Note
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
      </div>
      <div className="side-pane-body">
        {comments.length === 0 ? (
          <p className="muted">No comments yet. Select text and click + Selection to anchor a comment.</p>
        ) : (
          comments.map((c) => {
            const liveAnchor = editor ? getCommentAnchorText(editor, c.id) : '';
            const excerpt = liveAnchor || c.anchorText;
            return (
              <div key={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''}`}>
                <div className="comment-meta">
                  <strong>{c.author || 'You'}</strong>
                  <span>{new Date(c.created).toLocaleString()}</span>
                </div>
                {excerpt && (
                  <blockquote className="comment-excerpt">
                    “{excerpt.length > 80 ? `${excerpt.slice(0, 80)}…` : excerpt}”
                  </blockquote>
                )}
                <p>{c.text}</p>
                <div className="comment-actions">
                  {(liveAnchor || c.anchorText) && (
                    <button className="icon-btn" onClick={() => goToComment(c.id)}>
                      Go to
                    </button>
                  )}
                  {!c.resolved && (
                    <button className="icon-btn" onClick={() => onResolve(c.id)}>
                      Resolve
                    </button>
                  )}
                  <button
                    className="icon-btn"
                    onClick={() => {
                      if (editor) removeCommentAnchor(editor, c.id);
                      onDelete(c.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
