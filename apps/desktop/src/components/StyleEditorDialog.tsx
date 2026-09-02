import { useEffect, useState } from 'react';
import type { DocumentStyle } from '@officewrite/core';
import { BUILTIN_STYLES } from '@officewrite/core';
import { availableFonts } from '../constants/fonts';

interface StyleEditorDialogProps {
  open: boolean;
  styles: DocumentStyle[];
  onChange: (styles: DocumentStyle[]) => void;
  onClose: () => void;
}

const FONT_FAMILIES = availableFonts();
const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt'];

const BUILTIN_IDS = new Set(BUILTIN_STYLES.map((s) => s.id));

/**
 * Edit the document's style set.
 *
 * Previously this filtered the built-in ids out of `styles` - but a new
 * document's `customStyles` *is* exactly those built-ins, so the list was
 * always empty. Editing also ran three sequential modal prompts (family, then
 * size, then a Bold confirm) instead of showing a form.
 */
export function StyleEditorDialog({ open, styles, onChange, onClose }: StyleEditorDialogProps) {
  const list = styles.length ? styles : BUILTIN_STYLES;
  const [selectedId, setSelectedId] = useState<string>(list[0]?.id ?? '');

  useEffect(() => {
    if (open && !list.some((s) => s.id === selectedId)) setSelectedId(list[0]?.id ?? '');
  }, [open, list, selectedId]);

  if (!open) return null;

  const selected = list.find((s) => s.id === selectedId) ?? list[0];

  const update = (patch: Partial<DocumentStyle>) => {
    if (!selected) return;
    onChange(list.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));
  };

  const addStyle = () => {
    const id = crypto.randomUUID();
    onChange([
      ...list,
      { id, name: `Style ${list.length + 1}`, fontFamily: 'Calibri', fontSize: '11pt' },
    ]);
    setSelectedId(id);
  };

  const removeStyle = () => {
    if (!selected || BUILTIN_IDS.has(selected.id)) return;
    onChange(list.filter((s) => s.id !== selected.id));
    setSelectedId(list[0]?.id ?? '');
  };

  const isBuiltin = selected ? BUILTIN_IDS.has(selected.id) : false;

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog panel-card" onClick={(e) => e.stopPropagation()} data-testid="style-editor">
        <h2>Styles</h2>
        <p className="muted">Edit a style to change every paragraph that uses it.</p>

        <div className="style-editor-body">
          <ul className="style-list" data-testid="style-list">
            {list.map((style) => (
              <li key={style.id}>
                <button
                  className={`style-list-item ${style.id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(style.id)}
                  data-testid={`style-item-${style.id}`}
                >
                  <strong>{style.name}</strong>
                  <span className="muted">
                    {' '}
                    , {style.fontFamily} {style.fontSize}
                    {style.bold ? ' bold' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="dialog-grid style-editor-form">
              <label>
                Name
                <input
                  value={selected.name}
                  disabled={isBuiltin}
                  onChange={(e) => update({ name: e.target.value })}
                  data-testid="style-name"
                />
              </label>
              <label>
                Font
                <select
                  value={selected.fontFamily ?? 'Calibri'}
                  onChange={(e) => update({ fontFamily: e.target.value })}
                  data-testid="style-font-family"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Size
                <select
                  value={selected.fontSize ?? '11pt'}
                  onChange={(e) => update({ fontSize: e.target.value })}
                  data-testid="style-font-size"
                >
                  {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Colour
                <input
                  type="color"
                  value={selected.color ?? '#111827'}
                  onChange={(e) => update({ color: e.target.value })}
                  data-testid="style-color"
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!selected.bold}
                  onChange={(e) => update({ bold: e.target.checked })}
                  data-testid="style-bold"
                />
                Bold
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!selected.italic}
                  onChange={(e) => update({ italic: e.target.checked })}
                  data-testid="style-italic"
                />
                Italic
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!selected.underline}
                  onChange={(e) => update({ underline: e.target.checked })}
                  data-testid="style-underline"
                />
                Underline
              </label>
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button className="icon-btn" onClick={addStyle} data-testid="style-add">
            Add Style
          </button>
          <button
            className="icon-btn"
            onClick={removeStyle}
            disabled={isBuiltin}
            title={isBuiltin ? 'Built-in styles cannot be deleted' : 'Delete this style'}
            data-testid="style-delete"
          >
            Delete
          </button>
          <button className="icon-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
