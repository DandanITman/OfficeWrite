import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Search, Replace, ChevronUp, ChevronDown, X } from 'lucide-react';
import { findAllInEditor, replaceInEditor } from '../utils/findInEditor';

interface FindReplaceBarProps {
  editor: Editor | null;
  open: boolean;
  /** Which field to focus when the bar opens (Ctrl+F vs Ctrl+H). */
  focusField?: 'find' | 'replace';
  onClose: () => void;
}

export function FindReplaceBar({ editor, open, focusField = 'find', onClose }: FindReplaceBarProps) {
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => ({ matchCase, wholeWord }), [matchCase, wholeWord]);

  // Recomputed so the count follows edits, query changes and the options.
  const matches = useMemo(
    () => (editor && findQuery ? findAllInEditor(editor, findQuery, options) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, findQuery, open, status, options],
  );

  useEffect(() => {
    if (!open) return;
    // Ctrl+H opened the bar but left focus in the find field, so Replace was
    // reachable only by clicking; the two shortcuts were byte-identical.
    const target = focusField === 'replace' ? replaceRef.current : findRef.current;
    target?.focus();
    target?.select();
  }, [open, focusField]);

  useEffect(() => {
    setActiveIndex(0);
  }, [findQuery, matchCase, wholeWord]);

  if (!open) return null;

  const goTo = (index: number) => {
    if (!editor || !matches.length) return;
    const wrapped = ((index % matches.length) + matches.length) % matches.length;
    setActiveIndex(wrapped);
    editor.chain().focus().setTextSelection(matches[wrapped]).scrollIntoView().run();
  };

  const findNext = () => goTo(activeIndex + 1);
  const findPrev = () => goTo(activeIndex - 1);

  const replaceOne = () => {
    if (!editor) return;
    const count = replaceInEditor(editor, findQuery, replaceQuery, false, options);
    setStatus(count ? 'Replaced 1' : 'No matches');
  };

  const replaceAll = () => {
    if (!editor) return;
    const count = replaceInEditor(editor, findQuery, replaceQuery, true, options);
    setStatus(count ? `Replaced ${count} occurrence${count === 1 ? '' : 's'}` : 'No matches');
  };

  // An inline count, rather than a blocking modal on every miss.
  const countLabel = !findQuery
    ? ''
    : matches.length === 0
      ? 'No results'
      : `${Math.min(activeIndex + 1, matches.length)} of ${matches.length}`;

  return (
    <div className="find-replace-bar" data-testid="find-replace-bar">
      <div className="find-field">
        <Search size={14} />
        <input
          ref={findRef}
          data-testid="find-input"
          value={findQuery}
          onChange={(e) => {
            setFindQuery(e.target.value);
            setStatus('');
          }}
          placeholder="Find"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) findPrev();
              else findNext();
            }
            if (e.key === 'Escape') onClose();
          }}
        />
        <span className="find-count" data-testid="find-count">
          {countLabel}
        </span>
      </div>
      <div className="find-field">
        <Replace size={14} />
        <input
          ref={replaceRef}
          data-testid="replace-input"
          value={replaceQuery}
          onChange={(e) => setReplaceQuery(e.target.value)}
          placeholder="Replace with"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              replaceOne();
            }
            if (e.key === 'Escape') onClose();
          }}
        />
      </div>
      <div className="find-actions">
        <button
          className="icon-btn"
          onClick={findPrev}
          disabled={!matches.length}
          title="Previous match"
          data-testid="find-prev"
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="icon-btn"
          onClick={findNext}
          disabled={!matches.length}
          title="Next match"
          data-testid="find-next"
        >
          <ChevronDown size={14} />
        </button>
        <button className="icon-btn" onClick={replaceOne} disabled={!matches.length}>
          Replace
        </button>
        <button
          className="icon-btn"
          onClick={replaceAll}
          disabled={!matches.length}
          data-testid="replace-all"
        >
          Replace All
        </button>
        {/* "Match case" and "Find whole words only". */}
        <button
          className={`icon-btn find-toggle${matchCase ? ' is-active' : ''}`}
          onClick={() => setMatchCase((on) => !on)}
          title="Match case"
          aria-pressed={matchCase}
          data-testid="find-match-case"
        >
          Aa
        </button>
        <button
          className={`icon-btn find-toggle${wholeWord ? ' is-active' : ''}`}
          onClick={() => setWholeWord((on) => !on)}
          title="Find whole words only"
          aria-pressed={wholeWord}
          data-testid="find-whole-word"
        >
          ab
        </button>
        {status && (
          <span className="find-status" data-testid="find-status">
            {status}
          </span>
        )}
        <button className="icon-btn ghost-muted" onClick={onClose} aria-label="Close find bar">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
