import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { PageSetup, PageBorderStyle } from '@officewrite/core';
import { Dialog } from './Dialog';
import { availableFonts } from '../../constants/fonts';
import { FONT_SIZES, TEXT_EFFECTS, UNDERLINE_STYLES } from '../../extensions/CharacterFormatting';
import type { RibbonState } from '../../ribbon/useRibbonState';

/**
 * The dialogs behind the corner dialog launchers.
 *
 * Each one edits the live document as you change a control, the way such
 * dialogs preview, and closes with Done - there is no separate Apply step to
 * forget.
 */

const FONT_FAMILIES = availableFonts();

export function FontDialog({
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
  const chain = () => editor.chain().focus();

  return (
    <Dialog title="Font" onClose={onClose} testId="font-dialog">
      <div className="dialog-grid">
        <label>
          Font
          <select
            value={state.fontFamily}
            onChange={(event) => chain().setFontFamily(event.target.value).run()}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </label>
        <label>
          Size
          <select
            value={state.fontSize}
            onChange={(event) => chain().setFontSize(`${event.target.value}pt`).run()}
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <label>
          Font colour
          <input
            type="color"
            value={state.color ?? '#000000'}
            onChange={(event) => chain().setColor(event.target.value).run()}
          />
        </label>
        <label>
          Underline style
          <select
            value={state.underlineStyle}
            onChange={(event) =>
              chain().setUnderlineStyle(event.target.value as (typeof UNDERLINE_STYLES)[number]['id']).run()
            }
          >
            {UNDERLINE_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Text effect
          <select
            value={state.textEffect || 'none'}
            onChange={(event) =>
              chain().setTextEffect(event.target.value as (typeof TEXT_EFFECTS)[number]['id']).run()
            }
          >
            {TEXT_EFFECTS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="dialog-row">
        {(
          [
            ['Bold', state.bold, () => chain().toggleBold().run()],
            ['Italic', state.italic, () => chain().toggleItalic().run()],
            ['Underline', state.underline, () => chain().toggleUnderline().run()],
            ['Strikethrough', state.strike, () => chain().toggleStrike().run()],
            ['Superscript', state.superscript, () => chain().toggleSuperscript().run()],
            ['Subscript', state.subscript, () => chain().toggleSubscript().run()],
            ['Small caps', state.smallCaps, () => chain().setCaps(state.smallCaps ? 'none' : 'small').run()],
            ['All caps', state.allCaps, () => chain().setCaps(state.allCaps ? 'none' : 'all').run()],
          ] as const
        ).map(([label, active, run]) => (
          <label key={label} className="checkbox-row">
            <input type="checkbox" checked={active} onChange={run} />
            {label}
          </label>
        ))}
      </div>
      <div
        className="dialog-preview"
        style={{
          fontFamily: state.fontFamily,
          fontSize: `${state.fontSize}pt`,
          color: state.color ?? undefined,
          fontWeight: state.bold ? 700 : 400,
          fontStyle: state.italic ? 'italic' : 'normal',
          textDecoration: state.underline ? 'underline' : state.strike ? 'line-through' : 'none',
        }}
      >
        The quick brown fox jumps over the lazy dog
      </div>
    </Dialog>
  );
}

export function ParagraphDialog({
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
  const chain = () => editor.chain().focus();

  return (
    <Dialog title="Paragraph" onClose={onClose} testId="paragraph-dialog">
      <div className="dialog-grid">
        <label>
          Alignment
          <select
            value={state.align ?? 'left'}
            onChange={(event) =>
              chain().setTextAlign(event.target.value as 'left' | 'center' | 'right' | 'justify').run()
            }
          >
            <option value="left">Left</option>
            <option value="center">Centred</option>
            <option value="right">Right</option>
            <option value="justify">Justified</option>
          </select>
        </label>
        <label>
          Line spacing
          <select
            value={state.lineHeight || '1.15'}
            onChange={(event) => chain().setLineSpacing(event.target.value).run()}
          >
            {['1', '1.15', '1.5', '2', '2.5', '3'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Indent left (levels)
          <input
            type="number"
            min={0}
            max={8}
            value={state.indentLevel}
            onChange={(event) => {
              const target = Math.max(0, Math.min(8, Number(event.target.value)));
              const delta = target - state.indentLevel;
              const run = chain();
              for (let step = 0; step < Math.abs(delta); step += 1) {
                if (delta > 0) run.increaseParagraphIndent();
                else run.decreaseParagraphIndent();
              }
              run.run();
            }}
          />
        </label>
        <label>
          Indent right (px)
          <input
            type="number"
            min={0}
            value={state.indentRight}
            onChange={(event) => chain().setRightIndent(Number(event.target.value)).run()}
          />
        </label>
        <label>
          First line indent (px)
          <input
            type="number"
            min={0}
            defaultValue={0}
            onChange={(event) => chain().setFirstLineIndent(Number(event.target.value)).run()}
          />
        </label>
        <label>
          Space before (px)
          <input
            type="number"
            min={0}
            value={state.spaceBefore}
            onChange={(event) =>
              chain().setParagraphSpacing(Number(event.target.value), state.spaceAfter).run()
            }
          />
        </label>
        <label>
          Space after (px)
          <input
            type="number"
            min={0}
            value={state.spaceAfter}
            onChange={(event) =>
              chain().setParagraphSpacing(state.spaceBefore, Number(event.target.value)).run()
            }
          />
        </label>
      </div>
    </Dialog>
  );
}

export function ColumnsDialog({
  open,
  pageSetup,
  onChange,
  onClose,
}: {
  open: boolean;
  pageSetup: PageSetup;
  onChange: (setup: PageSetup) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <Dialog title="Columns" onClose={onClose} testId="columns-dialog">
      <div className="dialog-grid">
        <label>
          Number of columns
          <input
            type="number"
            min={1}
            max={4}
            value={pageSetup.columns.count}
            onChange={(event) =>
              onChange({
                ...pageSetup,
                columns: {
                  ...pageSetup.columns,
                  count: Math.max(1, Math.min(4, Number(event.target.value))),
                },
              })
            }
          />
        </label>
        <label>
          Spacing (px)
          <input
            type="number"
            min={12}
            value={pageSetup.columns.gap}
            onChange={(event) =>
              onChange({
                ...pageSetup,
                columns: { ...pageSetup.columns, gap: Number(event.target.value) },
              })
            }
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={pageSetup.columns.line}
          onChange={(event) =>
            onChange({
              ...pageSetup,
              columns: { ...pageSetup.columns, line: event.target.checked },
            })
          }
        />
        Line between columns
      </label>
    </Dialog>
  );
}

export function BordersShadingDialog({
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
  const chain = () => editor.chain().focus();

  return (
    <Dialog title="Borders and Shading" onClose={onClose} testId="borders-dialog">
      <div className="dialog-grid">
        <label>
          Border colour
          <input
            type="color"
            value={state.borderColor ?? '#64748b'}
            onChange={(event) => chain().setParagraphBorder(event.target.value).run()}
          />
        </label>
        <label>
          Border sides
          <select defaultValue="left" onChange={(event) =>
            chain().setParagraphBorder(state.borderColor ?? '#64748b', event.target.value).run()
          }>
            <option value="left">Left</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="all">Box (all sides)</option>
          </select>
        </label>
        <label>
          Shading
          <input
            type="color"
            value={state.shading ?? '#ffffff'}
            onChange={(event) => chain().setParagraphShading(event.target.value).run()}
          />
        </label>
      </div>
      <div className="dialog-row">
        <button className="icon-btn" onClick={() => chain().setParagraphBorder(null).run()}>
          Remove border
        </button>
        <button className="icon-btn" onClick={() => chain().setParagraphShading(null).run()}>
          Remove shading
        </button>
      </div>
    </Dialog>
  );
}

export function PageBordersDialog({
  open,
  pageSetup,
  onChange,
  onClose,
}: {
  open: boolean;
  pageSetup: PageSetup;
  onChange: (setup: PageSetup) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const { border } = pageSetup;

  return (
    <Dialog title="Page Borders" onClose={onClose} testId="page-borders-dialog">
      <div className="dialog-grid">
        <label>
          Style
          <select
            value={border.style}
            aria-label="Page border style"
            onChange={(event) =>
              onChange({
                ...pageSetup,
                border: { ...border, style: event.target.value as PageBorderStyle },
              })
            }
          >
            <option value="none">None</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="double">Double</option>
          </select>
        </label>
        <label>
          Colour
          <input
            type="color"
            value={border.color}
            onChange={(event) =>
              onChange({ ...pageSetup, border: { ...border, color: event.target.value } })
            }
          />
        </label>
        <label>
          Width (px)
          <input
            type="number"
            min={1}
            max={12}
            value={border.width}
            onChange={(event) =>
              onChange({
                ...pageSetup,
                border: { ...border, width: Math.max(1, Number(event.target.value)) },
              })
            }
          />
        </label>
      </div>
    </Dialog>
  );
}

export function ZoomDialog({
  open,
  zoom,
  onChange,
  onFit,
  onClose,
}: {
  open: boolean;
  zoom: number;
  onChange: (zoom: number) => void;
  onFit: (fit: 'pageWidth' | 'onePage' | 'multiplePages') => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(zoom);
  if (!open) return null;

  return (
    <Dialog title="Zoom" onClose={onClose} testId="zoom-dialog">
      <div className="dialog-row">
        {[50, 75, 100, 150, 200].map((level) => (
          <button
            key={level}
            className={`icon-btn${zoom === level ? ' primary' : ''}`}
            onClick={() => onChange(level)}
          >
            {level}%
          </button>
        ))}
      </div>
      <label>
        Percent
        <input
          type="number"
          min={10}
          max={500}
          value={draft}
          onChange={(event) => setDraft(Number(event.target.value))}
          onBlur={() => onChange(Math.max(10, Math.min(500, draft)))}
        />
      </label>
      <div className="dialog-row">
        <button className="icon-btn" onClick={() => onFit('pageWidth')}>
          Page width
        </button>
        <button className="icon-btn" onClick={() => onFit('onePage')}>
          Whole page
        </button>
        <button className="icon-btn" onClick={() => onFit('multiplePages')}>
          Many pages
        </button>
      </div>
    </Dialog>
  );
}

export function TablePropertiesDialog({
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
  const chain = () => editor.chain().focus();

  return (
    <Dialog title="Table Properties" onClose={onClose} testId="table-properties-dialog">
      <div className="dialog-grid">
        <label>
          Cell shading
          <input
            type="color"
            value={'#ffffff'}
            onChange={(event) => chain().setCellShading(event.target.value).run()}
          />
        </label>
        <label>
          Cell text alignment
          <select
            value={state.align ?? 'left'}
            onChange={(event) =>
              chain().setTextAlign(event.target.value as 'left' | 'center' | 'right').run()
            }
          >
            <option value="left">Left</option>
            <option value="center">Centre</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>
      <div className="dialog-row">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={state.tableHeaderRow}
            onChange={() => chain().toggleHeaderRow().run()}
          />
          Header row
        </label>
        <button className="icon-btn" onClick={() => chain().fixTables().run()}>
          Reset column widths
        </button>
        <button className="icon-btn" onClick={() => chain().setCellShading(null).run()}>
          Clear cell shading
        </button>
      </div>
    </Dialog>
  );
}
