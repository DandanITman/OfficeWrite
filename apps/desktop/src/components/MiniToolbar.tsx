import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Paintbrush,
  Underline,
} from 'lucide-react';
import type { RibbonState } from '../ribbon/useRibbonState';

/**
 * The mini toolbar: the small formatting bar that fades in just above a
 * selection so the common commands are under the pointer instead of up in the
 * ribbon.
 */
export function MiniToolbar({
  editor,
  state,
  enabled,
  onFormatPainter,
}: {
  editor: Editor | null;
  state: RibbonState;
  enabled: boolean;
  onFormatPainter: () => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!editor || !enabled || !state.hasSelection) {
      setPosition(null);
      return;
    }
    // Position from the selection's own rectangle, so the bar tracks a selection
    // made by dragging, double-clicking or Shift+arrow alike.
    try {
      const { from, to } = editor.state.selection;
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const left = Math.min(start.left, end.left);
      const top = Math.min(start.top, end.top);
      setPosition({ top: Math.max(8, top - 46), left: Math.max(8, left) });
    } catch {
      // coordsAtPos throws while the view is detached; the next update retries.
      setPosition(null);
    }
  }, [editor, enabled, state.hasSelection, state.selectionText]);

  if (!editor || !position) return null;

  const chain = () => editor.chain().focus();

  const button = (
    key: string,
    icon: React.ReactNode,
    title: string,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      key={key}
      type="button"
      className={`mini-toolbar-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  return createPortal(
    <div
      className="mini-toolbar"
      style={{ top: position.top, left: position.left }}
      data-testid="mini-toolbar"
      role="toolbar"
      aria-label="Formatting"
    >
      {button('bold', <Bold size={14} />, 'Bold', state.bold, () => chain().toggleBold().run())}
      {button('italic', <Italic size={14} />, 'Italic', state.italic, () => chain().toggleItalic().run())}
      {button('underline', <Underline size={14} />, 'Underline', state.underline, () =>
        chain().toggleUnderline().run(),
      )}
      {button('highlight', <Highlighter size={14} />, 'Highlight', Boolean(state.highlight), () =>
        state.highlight
          ? chain().unsetHighlight().run()
          : chain().setHighlight({ color: '#fef08a' }).run(),
      )}
      <span className="mini-toolbar-sep" />
      {button('left', <AlignLeft size={14} />, 'Align left', state.align === 'left', () =>
        chain().setTextAlign('left').run(),
      )}
      {button('center', <AlignCenter size={14} />, 'Centre', state.align === 'center', () =>
        chain().setTextAlign('center').run(),
      )}
      {button('right', <AlignRight size={14} />, 'Align right', state.align === 'right', () =>
        chain().setTextAlign('right').run(),
      )}
      <span className="mini-toolbar-sep" />
      {button('bullets', <List size={14} />, 'Bullets', state.bulletList, () =>
        chain().toggleBulletList().run(),
      )}
      {button('numbers', <ListOrdered size={14} />, 'Numbering', state.orderedList, () =>
        chain().toggleOrderedList().run(),
      )}
      {button('painter', <Paintbrush size={14} />, 'Format painter', false, onFormatPainter)}
    </div>,
    document.body,
  );
}
