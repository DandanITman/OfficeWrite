import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { CROSS_REFERENCE_LABELS, type CrossReferenceKind } from '@officewrite/core';
import { SYMBOL_SUBSETS } from '../../constants/symbols';
import { ALL_EMOJI, EMOJI_GROUPS } from '../../constants/emoji';
import { collectBookmarks, collectCaptions } from '../../utils/documentIndex';
import { extractHeadings } from '../../utils/headings';
import type { RibbonState } from '../../ribbon/useRibbonState';

/** Insert > Symbol > More Symbols. */
export function SymbolDialog({
  open,
  editor,
  onClose,
}: {
  open: boolean;
  editor: Editor | null;
  onClose: () => void;
}) {
  const [subset, setSubset] = useState(SYMBOL_SUBSETS[0].name);
  if (!open) return null;

  const active = SYMBOL_SUBSETS.find((entry) => entry.name === subset) ?? SYMBOL_SUBSETS[0];

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel-card dialog-wide"
        data-testid="symbol-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Symbol</h2>
        <label>
          Subset
          <select value={subset} onChange={(event) => setSubset(event.target.value)}>
            {SYMBOL_SUBSETS.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <div className="symbol-picker-grid">
          {active.symbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              className="symbol-picker-cell"
              title={symbol}
              onClick={() => editor?.chain().focus().insertContent(symbol).run()}
            >
              {symbol}
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Insert > Cross-reference. */
export function CrossReferenceDialog({
  open,
  editor,
  onClose,
}: {
  open: boolean;
  editor: Editor | null;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<CrossReferenceKind>('heading');

  const targets = useMemo(() => {
    if (!editor) return [] as Array<{ id: string; label: string; pos: number }>;
    if (kind === 'heading') {
      return extractHeadings(editor).map((heading) => ({
        id: `${heading.pos}`,
        label: `${'  '.repeat(Math.max(0, heading.level - 1))}${heading.text || '(empty heading)'}`,
        pos: heading.pos,
      }));
    }
    if (kind === 'bookmark') {
      return collectBookmarks(editor).map((bookmark) => ({
        id: bookmark.name,
        label: bookmark.name,
        pos: bookmark.from,
      }));
    }
    if (kind === 'figure' || kind === 'table') {
      const label = kind === 'figure' ? 'Figure' : 'Table';
      return collectCaptions(editor)
        .filter((caption) => caption.label === label)
        .map((caption) => ({ id: `${caption.pos}`, label: caption.text, pos: caption.pos }));
    }
    return [];
  }, [editor, kind, open]);

  if (!open || !editor) return null;

  const insert = (label: string) => {
    editor.chain().focus().insertContent(label.trim()).run();
    onClose();
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel-card"
        data-testid="cross-reference-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Cross-reference</h2>
        <label>
          Reference type
          <select
            value={kind}
            aria-label="Reference type"
            onChange={(event) => setKind(event.target.value as CrossReferenceKind)}
          >
            {(Object.keys(CROSS_REFERENCE_LABELS) as CrossReferenceKind[]).map((option) => (
              <option key={option} value={option}>
                {CROSS_REFERENCE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <div className="cross-reference-list" data-testid="cross-reference-targets">
          {targets.length === 0 ? (
            <p className="muted">Nothing of that kind in the document yet.</p>
          ) : (
            targets.map((target) => (
              <button
                key={`${target.id}-${target.pos}`}
                type="button"
                className="icon-btn"
                onClick={() => insert(target.label)}
              >
                {target.label}
              </button>
            ))
          )}
        </div>
        <div className="dialog-actions">
          <button className="icon-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Picture Format > Alt Text. */
export function AltTextDialog({
  open,
  editor,
  state,
  onClose,
}: {
  open: boolean;
  editor: Editor | null;
  state: RibbonState;
  onClose: () => void;
}) {
  if (!open || !editor) return null;

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel-card"
        data-testid="alt-text-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Alt Text</h2>
        <p className="muted">
          Describe the picture for anyone using a screen reader. One or two sentences is usually
          enough.
        </p>
        <label>
          Description
          <textarea
            rows={4}
            value={state.imageAltText}
            aria-label="Alt text"
            onChange={(event) =>
              editor.chain().focus().updateAttributes('image', { alt: event.target.value }).run()
            }
          />
        </label>
        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Picture Format > Size and Position. */
export function PictureLayoutDialog({
  open,
  editor,
  state,
  onClose,
}: {
  open: boolean;
  editor: Editor | null;
  state: RibbonState;
  onClose: () => void;
}) {
  if (!open || !editor) return null;
  const update = (attrs: Record<string, unknown>) =>
    editor.chain().focus().updateAttributes('image', attrs).run();

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel-card"
        data-testid="picture-layout-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Layout</h2>
        <div className="dialog-grid">
          <label>
            Width (px)
            <input
              type="number"
              min={16}
              value={state.imageWidth ?? 0}
              onChange={(event) => update({ width: Number(event.target.value) })}
            />
          </label>
          <label>
            Height (px)
            <input
              type="number"
              min={16}
              value={state.imageHeight ?? 0}
              onChange={(event) => update({ height: Number(event.target.value) })}
            />
          </label>
          <label>
            Rotation (degrees)
            <input
              type="number"
              min={0}
              max={359}
              value={state.imageRotation}
              onChange={(event) => update({ rotation: Number(event.target.value) })}
            />
          </label>
          <label>
            Horizontal offset (px)
            <input
              type="number"
              value={Number(editor.getAttributes('image').offsetX ?? 0)}
              onChange={(event) => update({ offsetX: Number(event.target.value) })}
            />
          </label>
          <label>
            Vertical offset (px)
            <input
              type="number"
              value={Number(editor.getAttributes('image').offsetY ?? 0)}
              onChange={(event) => update({ offsetY: Number(event.target.value) })}
            />
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(editor.getAttributes('image').lockAspect)}
            onChange={(event) => update({ lockAspect: event.target.checked })}
          />
          Lock aspect ratio
        </label>
        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Insert > Emojis.
 *
 * Search runs over the emoji names, so "smile" finds the smiling faces without
 * the user needing to know which group they are in. Recently used sits on top,
 * as a symbol picker should, and persists through the settings store.
 */
export function EmojiDialog({
  open,
  editor,
  recent,
  onUseEmoji,
  onClose,
}: {
  open: boolean;
  editor: Editor | null;
  recent: string[];
  onUseEmoji: (emoji: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return ALL_EMOJI.filter(
      (entry) => entry.name.includes(needle) || entry.group.toLowerCase().includes(needle),
    );
  }, [query]);

  if (!open) return null;

  const insert = (emoji: string) => {
    editor?.chain().focus().insertContent(emoji).run();
    onUseEmoji(emoji);
  };

  const cell = (char: string, name: string, key: string) => (
    <button
      key={key}
      type="button"
      className="symbol-picker-cell emoji-cell"
      title={name}
      aria-label={name}
      data-testid={`emoji-${char}`}
      onClick={() => insert(char)}
    >
      {char}
    </button>
  );

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel-card dialog-wide"
        data-testid="emoji-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Emoji</h2>
        <label>
          Search
          <input
            type="search"
            value={query}
            autoFocus
            placeholder="Search by name, e.g. smile"
            data-testid="emoji-search"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="emoji-scroll">
          {matches ? (
            matches.length ? (
              <div className="symbol-picker-grid">
                {matches.map((entry) => cell(entry.char, entry.name, entry.char))}
              </div>
            ) : (
              <p className="emoji-empty">No emoji match “{query}”.</p>
            )
          ) : (
            <>
              {recent.length > 0 && (
                <section data-testid="emoji-recent">
                  <h3>Recently used</h3>
                  <div className="symbol-picker-grid">
                    {recent.map((char) => cell(char, char, `recent-${char}`))}
                  </div>
                </section>
              )}
              {EMOJI_GROUPS.map((group) => (
                <section key={group.name}>
                  <h3>{group.name}</h3>
                  <div className="symbol-picker-grid">
                    {group.emoji.map((entry) => cell(entry.char, entry.name, entry.char))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
