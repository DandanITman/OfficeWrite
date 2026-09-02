import { useState } from 'react';
import {
  SOURCE_TYPE_LABELS,
  formatBibliographyEntry,
  suggestedTag,
  type CitationSource,
  type CitationStyle,
  type SourceType,
} from '@officewrite/core';

/** References > Manage Sources: the source list plus the Create Source form. */
export function SourcesDialog({
  open,
  sources,
  citationStyle,
  onChange,
  onClose,
}: {
  open: boolean;
  sources: CitationSource[];
  citationStyle: CitationStyle;
  onChange: (sources: CitationSource[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Partial<CitationSource>>({ type: 'book' });
  if (!open) return null;

  const add = () => {
    const author = (draft.author ?? '').trim();
    const title = (draft.title ?? '').trim();
    if (!author && !title) return;
    const year = (draft.year ?? '').trim() || String(new Date().getFullYear());
    const source: CitationSource = {
      id: crypto.randomUUID(),
      type: (draft.type as SourceType) ?? 'book',
      author,
      title: title || 'Untitled',
      year,
      publisher: draft.publisher?.trim() || undefined,
      container: draft.container?.trim() || undefined,
      volume: draft.volume?.trim() || undefined,
      issue: draft.issue?.trim() || undefined,
      pages: draft.pages?.trim() || undefined,
      url: draft.url?.trim() || undefined,
      tag: suggestedTag(author, year),
    };
    onChange([...sources, source]);
    setDraft({ type: source.type });
  };

  const field = (
    key: keyof CitationSource,
    label: string,
    type: 'text' | 'url' = 'text',
  ) => (
    <label>
      {label}
      <input
        type={type}
        value={String(draft[key] ?? '')}
        aria-label={label}
        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
      />
    </label>
  );

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel-card dialog-wide"
        data-testid="sources-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Source Manager</h2>
        <div className="source-list" data-testid="source-list">
          {sources.length === 0 ? (
            <p className="muted">No sources yet. Fill in the form below to create one.</p>
          ) : (
            sources.map((source) => (
              <div key={source.id} className="source-row">
                <div>
                  <strong>{source.tag}</strong>
                  <span className="muted"> {SOURCE_TYPE_LABELS[source.type]}</span>
                  <div className="source-preview">{formatBibliographyEntry(source, citationStyle)}</div>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => onChange(sources.filter((entry) => entry.id !== source.id))}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <h3>Create source</h3>
        <div className="dialog-grid">
          <label>
            Type of source
            <select
              value={String(draft.type ?? 'book')}
              aria-label="Type of source"
              onChange={(event) =>
                setDraft((current) => ({ ...current, type: event.target.value as SourceType }))
              }
            >
              {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map((type) => (
                <option key={type} value={type}>
                  {SOURCE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          {field('author', 'Author')}
          {field('title', 'Title')}
          {field('year', 'Year')}
          {field('publisher', 'Publisher')}
          {field('container', 'Journal or site')}
          {field('volume', 'Volume')}
          {field('issue', 'Issue')}
          {field('pages', 'Pages')}
          {field('url', 'URL', 'url')}
        </div>
        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={add} data-testid="source-add">
            Add source
          </button>
          <button className="icon-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
