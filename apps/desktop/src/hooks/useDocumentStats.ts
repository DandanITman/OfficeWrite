import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { countTrackChanges } from '../utils/trackChanges';

export interface DocumentStats {
  words: number;
  characters: number;
  pages: number;
  /** Pending tracked insertions and deletions, for the Review tab. */
  insertions: number;
  deletions: number;
}

const EMPTY: Omit<DocumentStats, 'pages'> = {
  words: 0,
  characters: 0,
  insertions: 0,
  deletions: 0,
};

/** Long enough to skip the work while typing, short enough to feel live. */
const RECOUNT_DELAY_MS = 250;

function measure(editor: Editor): Omit<DocumentStats, 'pages'> {
  const text = editor.getText();
  const { insertions, deletions } = countTrackChanges(editor);
  return {
    words: text.trim() ? text.trim().split(/\s+/).length : 0,
    characters: text.length,
    insertions,
    deletions,
  };
}

/**
 * Document statistics for the status bar and the Review tab.
 *
 * These were computed as `getWordCount(editor, pageCount)` in App's render
 * body, so every render - including ones caused by opening a menu or moving a
 * dialog - walked the whole document to build a plain-text copy of it. Counting
 * on a debounce after the document actually changes does the same work once per
 * pause instead of once per render.
 */
export function useDocumentStats(editor: Editor | null, pages: number): DocumentStats {
  const [stats, setStats] = useState(EMPTY);

  useEffect(() => {
    if (!editor) {
      setStats(EMPTY);
      return;
    }

    let timer: number | null = null;
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        setStats(measure(editor));
      }, RECOUNT_DELAY_MS);
    };

    setStats(measure(editor));
    editor.on('update', schedule);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [editor]);

  return { ...stats, pages };
}
