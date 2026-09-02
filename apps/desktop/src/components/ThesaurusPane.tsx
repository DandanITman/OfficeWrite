import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { THESAURUS_WORD_COUNT, lookupThesaurus } from '@officewrite/core';

/**
 * Review > Thesaurus (Shift+F7).
 *
 * The word comes from the selection, or can be typed. Replacing keeps the
 * selection's capitalisation, so swapping the first word of a sentence does not
 * quietly lowercase it.
 */
export function ThesaurusPane({
  open,
  editor,
  selectionText,
  onClose,
}: {
  open: boolean;
  editor: Editor | null;
  selectionText: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const word = (query || selectionText).trim().split(/\s+/)[0] ?? '';
  const entry = useMemo(() => (word ? lookupThesaurus(word) : null), [word]);

  if (!open) return null;

  const replace = (replacement: string) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      editor.chain().focus().insertContent(replacement).run();
      return;
    }
    editor.chain().focus().insertContentAt({ from, to }, replacement).run();
  };

  return (
    <aside className="side-pane thesaurus-pane" data-testid="thesaurus-pane">
      <div className="side-pane-header">
        <strong>Thesaurus</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="side-pane-body">
        <label>
          Look up
          <input
            value={query || selectionText}
            aria-label="Look up a word"
            data-testid="thesaurus-input"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {!word ? (
          <p className="muted">Select a word in the document, or type one above.</p>
        ) : !entry ? (
          <p className="muted" data-testid="thesaurus-empty">
            No entry for “{word}”. The built-in thesaurus covers {THESAURUS_WORD_COUNT} common words
            and works offline.
          </p>
        ) : (
          <>
            {entry.senses.map((sense, index) => (
              <div key={index} className="thesaurus-sense">
                <h4>{sense.partOfSpeech}</h4>
                <div className="thesaurus-words">
                  {sense.synonyms.map((synonym) => (
                    <button
                      key={synonym}
                      className="icon-btn"
                      onClick={() => replace(synonym)}
                      data-testid={`thesaurus-synonym-${synonym}`}
                    >
                      {synonym}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {entry.antonyms.length > 0 && (
              <div className="thesaurus-sense">
                <h4>Antonyms</h4>
                <div className="thesaurus-words">
                  {entry.antonyms.map((antonym) => (
                    <button key={antonym} className="icon-btn" onClick={() => replace(antonym)}>
                      {antonym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
