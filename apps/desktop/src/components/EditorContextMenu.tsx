import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import type { DocumentProofingIssue } from '../extensions/ProofingCheck';
import { copySelection, cutSelection } from '../utils/clipboard';
import { promptForLink } from '../utils/hyperlink';

export interface ContextMenuState {
  x: number;
  y: number;
  /** The proofing problem under the pointer, when there is one. */
  issue: DocumentProofingIssue | null;
  suggestions: string[];
  /** Whether the click landed on a picture. */
  onImage: boolean;
  hasSelection: boolean;
}

interface EditorContextMenuProps {
  state: ContextMenuState | null;
  editor: Editor | null;
  onClose: () => void;
  onAddToDictionary: (word: string) => void;
  onIgnoreAll: (word: string) => void;
  onPaste: () => void;
  onOpenFontDialog: () => void;
  onOpenParagraphDialog: () => void;
  onNewComment: () => void;
  onOpenProofing: () => void;
  onOpenThesaurus: () => void;
  onOpenAltText: () => void;
}

/**
 * The document right-click menu.
 *
 * The context menu leads with the spelling suggestions when the click landed
 * on a flagged word, then the clipboard commands, then the formatting dialogs.
 * The same menu handles pictures, so right-clicking a picture reaches Alt Text
 * and wrapping without a trip to the ribbon.
 */
export function EditorContextMenu({
  state,
  editor,
  onClose,
  onAddToDictionary,
  onIgnoreAll,
  onPaste,
  onOpenFontDialog,
  onOpenParagraphDialog,
  onNewComment,
  onOpenProofing,
  onOpenThesaurus,
  onOpenAltText,
}: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [state, onClose]);

  if (!state || !editor) return null;

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  const replace = (replacement: string) => {
    if (!state.issue) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: state.issue.from, to: state.issue.to })
      .insertContent(replacement)
      .run();
  };

  const Item = ({
    label,
    hint,
    onSelect,
    disabled,
    testId,
  }: {
    label: string;
    hint?: string;
    onSelect: () => void;
    disabled?: boolean;
    testId?: string;
  }) => (
    <button
      type="button"
      role="menuitem"
      className="ctx-item"
      disabled={disabled}
      data-testid={testId}
      onClick={run(onSelect)}
    >
      <span>{label}</span>
      {hint && <span className="ctx-hint">{hint}</span>}
    </button>
  );

  return createPortal(
    <div
      ref={menuRef}
      className="editor-context-menu"
      role="menu"
      aria-label="Document actions"
      data-testid="editor-context-menu"
      style={{ top: state.y, left: state.x }}
    >
      {state.issue && (
        <>
          <div className="ctx-header">
            {state.issue.kind === 'spelling' ? state.issue.text : state.issue.message}
          </div>
          {(state.issue.kind === 'spelling' ? state.suggestions : state.issue.suggestions).map(
            (suggestion) => (
              <Item
                key={suggestion}
                label={suggestion}
                onSelect={() => replace(suggestion)}
                testId={`ctx-suggestion-${suggestion}`}
              />
            ),
          )}
          {(state.issue.kind === 'spelling' ? state.suggestions : state.issue.suggestions).length ===
            0 && <div className="ctx-empty">No suggestions</div>}
          <div className="ctx-sep" />
          <Item label="Ignore All" onSelect={() => onIgnoreAll(state.issue!.text)} />
          {state.issue.kind === 'spelling' && (
            <Item
              label="Add to Dictionary"
              onSelect={() => onAddToDictionary(state.issue!.text)}
              testId="ctx-add-to-dictionary"
            />
          )}
          <Item label="Spelling and Grammar…" onSelect={onOpenProofing} />
          <div className="ctx-sep" />
        </>
      )}

      {state.onImage ? (
        <>
          <Item label="Cut" onSelect={() => void cutSelection(editor)} hint="Ctrl+X" />
          <Item label="Copy" onSelect={() => void copySelection(editor)} hint="Ctrl+C" />
          <div className="ctx-sep" />
          <Item label="Wrap Text: Square" onSelect={() => editor.chain().focus().setImageWrap('square').run()} />
          <Item label="Wrap Text: In Line" onSelect={() => editor.chain().focus().setImageWrap('inline').run()} />
          <Item label="Rotate Right 90°" onSelect={() => editor.chain().focus().rotateImage(90).run()} />
          <div className="ctx-sep" />
          <Item label="Edit Alt Text…" onSelect={onOpenAltText} testId="ctx-alt-text" />
          <Item label="Delete Picture" onSelect={() => editor.chain().focus().deleteSelection().run()} />
        </>
      ) : (
        <>
          <Item
            label="Cut"
            hint="Ctrl+X"
            disabled={!state.hasSelection}
            onSelect={() => void cutSelection(editor)}
          />
          <Item
            label="Copy"
            hint="Ctrl+C"
            disabled={!state.hasSelection}
            onSelect={() => void copySelection(editor)}
          />
          <Item label="Paste" hint="Ctrl+V" onSelect={onPaste} />
          <div className="ctx-sep" />
          <Item label="Font…" onSelect={onOpenFontDialog} />
          <Item label="Paragraph…" onSelect={onOpenParagraphDialog} />
          <div className="ctx-sep" />
          <Item label="Link…" hint="Ctrl+K" onSelect={() => void promptForLink(editor)} />
          <Item
            label="New Comment"
            disabled={!state.hasSelection}
            onSelect={onNewComment}
            testId="ctx-new-comment"
          />
          <Item
            label="Synonyms…"
            disabled={!state.hasSelection}
            onSelect={onOpenThesaurus}
            testId="ctx-synonyms"
          />
        </>
      )}
    </div>,
    document.body,
  );
}
