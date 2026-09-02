import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { PageSetup } from '@officewrite/core';
import { PAGE_DIMENSIONS } from '@officewrite/core';
import { extractHeadings } from '../utils/headings';
import { findAllInEditor } from '../utils/findInEditor';

interface NavigationPaneProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

/**
 * The Navigation pane is search-first: a box at the top with Headings and
 * Results. This was a flat heading list and nothing else, so the pane could not
 * do the one thing people open it for.
 */
export function NavigationPane({ editor, open, onClose }: NavigationPaneProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'headings' | 'results'>('headings');

  if (!open) return null;

  const headings = editor ? extractHeadings(editor) : [];
  const trimmed = query.trim();
  const filteredHeadings = trimmed
    ? headings.filter((h) => h.text.toLowerCase().includes(trimmed.toLowerCase()))
    : headings;

  const results =
    editor && trimmed
      ? findAllInEditor(editor, trimmed).slice(0, 100).map((match) => ({
          ...match,
          text: editor.state.doc.textBetween(
            Math.max(0, match.from - 24),
            Math.min(editor.state.doc.content.size, match.to + 24),
            ' ',
          ),
        }))
      : [];

  const goTo = (pos: number) => editor?.chain().focus().setTextSelection(pos).scrollIntoView().run();

  return (
    <aside className="side-pane">
      <div className="side-pane-header">
        <strong>Navigation</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="nav-search">
        <input
          type="search"
          value={query}
          placeholder="Search document"
          aria-label="Search document"
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim()) setTab('results');
          }}
          data-testid="nav-search"
        />
      </div>
      <div className="nav-tabs">
        <button
          className={tab === 'headings' ? 'active' : ''}
          onClick={() => setTab('headings')}
          data-testid="nav-tab-headings"
        >
          Headings
        </button>
        <button
          className={tab === 'results' ? 'active' : ''}
          onClick={() => setTab('results')}
          data-testid="nav-tab-results"
        >
          Results{trimmed ? ` (${results.length})` : ''}
        </button>
      </div>
      <div className="side-pane-body">
        {tab === 'headings' ? (
          filteredHeadings.length === 0 ? (
            <p className="muted">
              {trimmed ? 'No headings match that search.' : 'No headings in this document.'}
            </p>
          ) : (
            <ul className="nav-list" data-testid="nav-headings">
              {filteredHeadings.map((h, i) => (
                <li key={`${h.pos}-${i}`} style={{ paddingLeft: (h.level - 1) * 12 }}>
                  <button onClick={() => goTo(h.pos + 1)}>{h.text || '(empty heading)'}</button>
                </li>
              ))}
            </ul>
          )
        ) : !trimmed ? (
          <p className="muted">Type in the box above to search the document.</p>
        ) : results.length === 0 ? (
          <p className="muted">No matches.</p>
        ) : (
          <ul className="nav-list nav-results" data-testid="nav-results">
            {results.map((result, i) => (
              <li key={`${result.from}-${i}`}>
                <button onClick={() => goTo(result.from)}>…{result.text}…</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

interface RulerProps {
  pageSetup: PageSetup;
}

export function Ruler({ pageSetup }: RulerProps) {
  const dims = PAGE_DIMENSIONS[pageSetup.size];
  const width = pageSetup.orientation === 'portrait' ? dims.width : dims.height;

  return (
    <div className="ruler" style={{ width }}>
      {Array.from({ length: Math.floor(width / 96) + 1 }, (_, i) => (
        <span key={i} className="ruler-mark" style={{ left: i * 96 }}>
          {i}
        </span>
      ))}
    </div>
  );
}
