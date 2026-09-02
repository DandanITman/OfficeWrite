import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { DocumentProofingIssue } from '../extensions/ProofingCheck';
import { getPlatform } from '../platform';

interface ProofingPaneProps {
  open: boolean;
  editor: Editor | null;
  issues: DocumentProofingIssue[];
  language: string;
  onClose: () => void;
  onAddToDictionary: (word: string) => void;
  onIgnoreAll: (word: string) => void;
}

/**
 * Review > Spelling & Grammar (F7).
 *
 * The pane walks the issue list the checker already produced rather than
 * re-scanning: the underline, the right-click menu and this pane therefore
 * always agree about what is wrong and where.
 */
export function ProofingPane({
  open,
  editor,
  issues,
  language,
  onClose,
  onAddToDictionary,
  onIgnoreAll,
}: ProofingPaneProps) {
  const [index, setIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const current = issues[Math.min(index, Math.max(0, issues.length - 1))] ?? null;
  const spelling = issues.filter((issue) => issue.kind === 'spelling').length;
  const grammar = issues.length - spelling;

  // Keep the index inside the list as issues are fixed underneath the pane.
  useEffect(() => {
    if (index >= issues.length) setIndex(Math.max(0, issues.length - 1));
  }, [issues.length, index]);

  // Move the selection to the issue being reviewed, highlighting it.
  useEffect(() => {
    if (!open || !editor || !current) return;
    editor.chain().setTextSelection({ from: current.from, to: current.to }).scrollIntoView().run();
  }, [open, editor, current?.from, current?.to]);

  useEffect(() => {
    if (!open || !current) {
      setSuggestions([]);
      return;
    }
    if (current.kind === 'grammar') {
      setSuggestions(current.suggestions);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getPlatform()
      .spellSuggest(current.text, language)
      .then((words) => {
        if (cancelled) return;
        setSuggestions(words);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, current?.text, current?.kind, language]);

  const replaceWith = (replacement: string, all: boolean) => {
    if (!editor || !current) return;
    if (!all) {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: current.from, to: current.to })
        .insertContent(replacement)
        .run();
      return;
    }

    // Change All: rewrite every identical occurrence, back to front so the
    // earlier positions stay valid while the transaction is built.
    const target = current.text;
    const matches: Array<{ from: number; to: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      let at = node.text.indexOf(target);
      while (at !== -1) {
        matches.push({ from: pos + at, to: pos + at + target.length });
        at = node.text.indexOf(target, at + target.length);
      }
    });
    const tr = editor.state.tr;
    for (const match of matches.reverse()) {
      tr.insertText(replacement, match.from, match.to);
    }
    if (tr.steps.length) editor.view.dispatch(tr);
  };

  const summary = useMemo(() => {
    if (!issues.length) return 'No spelling or grammar problems found.';
    return `${spelling} spelling · ${grammar} grammar`;
  }, [issues.length, spelling, grammar]);

  if (!open) return null;

  return (
    <aside className="side-pane proofing-pane" data-testid="proofing-pane">
      <div className="side-pane-header">
        <strong>Spelling &amp; Grammar</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="side-pane-body">
        <p className="proofing-summary" data-testid="proofing-summary">
          {summary}
        </p>

        {!current ? (
          <p className="muted">
            Nothing to correct. Keep typing and anything doubtful will appear here.
          </p>
        ) : (
          <>
            <div className={`proofing-issue kind-${current.kind}`}>
              <span className="proofing-kind">
                {current.kind === 'spelling' ? 'Spelling' : 'Grammar'}
              </span>
              <p className="proofing-word" data-testid="proofing-word">
                {current.text}
              </p>
              <p className="proofing-message">{current.message}</p>
            </div>

            <div className="proofing-suggestions" data-testid="proofing-suggestions">
              {loading ? (
                <p className="muted">Looking for suggestions…</p>
              ) : suggestions.length === 0 ? (
                <p className="muted">No suggestions.</p>
              ) : (
                suggestions.map((suggestion) => (
                  <div key={suggestion} className="proofing-suggestion-row">
                    <button
                      className="icon-btn primary"
                      onClick={() => replaceWith(suggestion, false)}
                      data-testid={`proofing-change-${suggestion}`}
                    >
                      {suggestion}
                    </button>
                    <button className="icon-btn" onClick={() => replaceWith(suggestion, true)}>
                      Change All
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="proofing-actions">
              <button
                className="icon-btn"
                onClick={() => setIndex((value) => Math.min(issues.length - 1, value + 1))}
                data-testid="proofing-ignore-once"
              >
                Ignore Once
              </button>
              <button
                className="icon-btn"
                onClick={() => onIgnoreAll(current.text)}
                data-testid="proofing-ignore-all"
              >
                Ignore All
              </button>
              {current.kind === 'spelling' && (
                <button
                  className="icon-btn"
                  onClick={() => onAddToDictionary(current.text)}
                  data-testid="proofing-add-to-dictionary"
                >
                  Add to Dictionary
                </button>
              )}
            </div>

            <div className="proofing-nav">
              <button
                className="icon-btn"
                disabled={index === 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                Previous
              </button>
              <span data-testid="proofing-position">
                {Math.min(index + 1, issues.length)} of {issues.length}
              </span>
              <button
                className="icon-btn"
                disabled={index >= issues.length - 1}
                onClick={() => setIndex((value) => Math.min(issues.length - 1, value + 1))}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
