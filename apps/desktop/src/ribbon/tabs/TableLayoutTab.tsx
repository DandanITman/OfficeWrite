import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  Combine,
  Columns3,
  Grid3x3,
  Rows3,
  Settings2,
  Split,
  Table2,
  Trash2,
} from 'lucide-react';
import { CellSelection, selectedRect } from '@tiptap/pm/tables';
import {
  cellSize,
  clearWidths,
  distributeColumns,
  distributeRows,
  inToPx,
  pxToIn,
  setColumnWidth,
  setRowHeight,
} from '../../utils/tableSizing';
import { ColorPickerButton } from '../../components/ColorPickerButton';
import { SHADING_COLORS } from '../../constants/colorSwatches';
import { TABLE_STYLES } from '../../extensions/TableFormatting';
import {
  RibbonButton,
  RibbonGroup,
  RibbonLine,
  RibbonMenuButton,
  RibbonMenuItem,
  RibbonMenuSeparator,
  RibbonSpin,
  RibbonStack,
} from '../RibbonKit';
import type { RibbonTabProps } from '../types';

/**
 * A word processor splits table tools across "Table Design" and "Table Layout". Both fit in
 * one contextual tab here, in the group order, so the whole set is reachable
 * without a second tab switch.
 */
export function TableLayoutTab({ editor, state, actions }: RibbonTabProps) {
  const chain = () => editor?.chain().focus();

  /**
   * The Select menu scopes to the table part, never the document. Going
   * through prosemirror-tables' own rect keeps "Select Table" from becoming
   * Select All, which would let the next keystroke wipe the document.
   */
  const selectTablePart = (part: 'row' | 'column' | 'table') => {
    if (!editor) return;
    const { state: pmState } = editor.view;
    // selectedRect throws outside a table rather than returning null.
    let rect;
    try {
      rect = selectedRect(pmState);
    } catch {
      return;
    }
    const anchorCell =
      part === 'row' ? rect.map.map[rect.top * rect.map.width]
      : part === 'column' ? rect.map.map[rect.left]
      : rect.map.map[0];
    const headCell =
      part === 'row' ? rect.map.map[rect.top * rect.map.width + rect.map.width - 1]
      : part === 'column' ? rect.map.map[(rect.map.height - 1) * rect.map.width + rect.left]
      : rect.map.map[rect.map.width * rect.map.height - 1];
    const tr = pmState.tr.setSelection(
      CellSelection.create(pmState.doc, rect.tableStart + anchorCell, rect.tableStart + headCell),
    );
    editor.view.dispatch(tr);
    editor.view.focus();
  };

  const cell = cellSize(editor);

  return (
    <>
      <RibbonGroup label="Table">
        <RibbonStack>
          <RibbonMenuButton
            icon={<Table2 size={14} />}
            label="Select"
            title="Select part of the table"
            testId="table-select"
          >
            <RibbonMenuItem label="Select Cell" onClick={() => chain()?.selectParentNode().run()} />
            <RibbonMenuItem label="Select Column" onClick={() => selectTablePart('column')} />
            <RibbonMenuItem label="Select Row" onClick={() => selectTablePart('row')} />
            <RibbonMenuItem label="Select Table" onClick={() => selectTablePart('table')} />
          </RibbonMenuButton>
          <RibbonButton
            icon={<Settings2 size={14} />}
            label="Properties"
            title="Table properties"
            onClick={actions.onOpenTableProperties}
            testId="table-properties"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Rows &amp; Columns">
        <RibbonStack>
          <RibbonLine>
            <RibbonButton
              icon={<Rows3 size={14} />}
              label="Insert Above"
              title="Insert a row above"
              onClick={() => chain()?.addRowBefore().run()}
              testId="table-add-row-before"
            />
            <RibbonButton
              icon={<Rows3 size={14} />}
              label="Insert Below"
              title="Insert a row below"
              onClick={() => chain()?.addRowAfter().run()}
              testId="table-add-row-after"
            />
          </RibbonLine>
          <RibbonLine>
            <RibbonButton
              icon={<Columns3 size={14} />}
              label="Insert Left"
              title="Insert a column to the left"
              onClick={() => chain()?.addColumnBefore().run()}
              testId="table-add-col-before"
            />
            <RibbonButton
              icon={<Columns3 size={14} />}
              label="Insert Right"
              title="Insert a column to the right"
              onClick={() => chain()?.addColumnAfter().run()}
              testId="table-add-col-after"
            />
          </RibbonLine>
        </RibbonStack>
        <RibbonStack>
          <RibbonMenuButton
            icon={<Trash2 size={20} />}
            label="Delete"
            title="Delete rows, columns or the whole table"
            size="large"
            testId="table-delete-menu"
          >
            <RibbonMenuItem
              label="Delete Row"
              onClick={() => chain()?.deleteRow().run()}
              testId="table-delete-row"
            />
            <RibbonMenuItem
              label="Delete Column"
              onClick={() => chain()?.deleteColumn().run()}
              testId="table-delete-col"
            />
            <RibbonMenuSeparator />
            <RibbonMenuItem
              label="Delete Table"
              onClick={() => chain()?.deleteTable().run()}
              testId="table-delete"
            />
          </RibbonMenuButton>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Merge">
        <RibbonStack>
          <RibbonButton
            icon={<Combine size={14} />}
            label="Merge Cells"
            title="Merge the selected cells"
            onClick={() => chain()?.mergeCells().run()}
            testId="table-merge-cells"
          />
          <RibbonButton
            icon={<Split size={14} />}
            label="Split Cells"
            title="Split the current cell"
            onClick={() => chain()?.splitCell().run()}
            testId="table-split-cell"
          />
        </RibbonStack>
      </RibbonGroup>

      {/* The Cell Size group. There was no way to give a column a specific
          width at all - only "Fix Columns", which resets them. Widths and
          heights are the attributes the drag resizers already write, so the
          boxes and the drag agree. */}
      <RibbonGroup label="Cell Size">
        <RibbonStack>
          <RibbonSpin
            label="Row height"
            value={pxToIn(cell.height)}
            step={0.1}
            min={0}
            max={22}
            suffix='"'
            testId="table-row-height"
            onChange={(value) => setRowHeight(editor, inToPx(value))}
          />
          <RibbonSpin
            label="Column width"
            value={pxToIn(cell.width)}
            step={0.1}
            min={0}
            max={22}
            suffix='"'
            testId="table-column-width"
            onChange={(value) => setColumnWidth(editor, inToPx(value))}
          />
        </RibbonStack>
        <RibbonStack>
          <RibbonButton
            icon={<Columns3 size={14} />}
            label="Distribute Columns"
            title="Give every column the same width"
            onClick={() => distributeColumns(editor)}
            testId="table-distribute-columns"
          />
          <RibbonButton
            icon={<Rows3 size={14} />}
            label="Distribute Rows"
            title="Give every row the same height"
            onClick={() => distributeRows(editor)}
            testId="table-distribute-rows"
          />
          <RibbonMenuButton
            icon={<Grid3x3 size={14} />}
            label="AutoFit"
            title="Fit the table to its contents or the window"
            testId="table-autofit"
          >
            <RibbonMenuItem
              label="AutoFit Contents"
              onClick={() => {
                clearWidths(editor);
                chain()?.fixTables().run();
              }}
              testId="table-autofit-contents"
            />
            <RibbonMenuItem
              label="AutoFit Window"
              onClick={() => distributeColumns(editor)}
              testId="table-autofit-window"
            />
            <RibbonMenuItem
              label="Fixed Column Width"
              onClick={() => setColumnWidth(editor, cell.width || 120)}
              testId="table-autofit-fixed"
            />
          </RibbonMenuButton>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Alignment">
        <RibbonStack>
          <RibbonLine>
            {(
              [
                ['left', AlignLeft, 'Align cell text left'],
                ['center', AlignCenter, 'Centre cell text'],
                ['right', AlignRight, 'Align cell text right'],
              ] as const
            ).map(([value, Icon, title]) => (
              <RibbonButton
                key={value}
                icon={<Icon size={15} />}
                title={title}
                size="icon"
                active={state.align === value}
                onClick={() => chain()?.setTextAlign(value).run()}
                testId={`table-align-${value}`}
              />
            ))}
          </RibbonLine>
          <RibbonButton
            icon={<Table2 size={14} />}
            label="Header Row"
            title="Toggle the header row"
            active={state.tableHeaderRow}
            onClick={() => chain()?.toggleHeaderRow().run()}
            testId="table-toggle-header"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Data">
        <RibbonStack>
          <RibbonMenuButton
            icon={<ArrowDownAZ size={14} />}
            label="Sort"
            title="Sort the paragraphs or rows"
            testId="table-sort"
          >
            <RibbonMenuItem label="Ascending (A to Z)" onClick={() => actions.onSortParagraphs('asc')} />
            <RibbonMenuItem label="Descending (Z to A)" onClick={() => actions.onSortParagraphs('desc')} />
          </RibbonMenuButton>
          <RibbonButton
            icon={<Grid3x3 size={14} />}
            label="Fix Columns"
            title="Reset the column widths"
            onClick={() => chain()?.fixTables().run()}
            testId="table-fix-columns"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Table Styles">
        <RibbonLine>
          {TABLE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`rb-table-style-tile style-${style.id}${
                state.tableStyle === style.id ? ' is-active' : ''
              }`}
              title={style.label}
              aria-label={style.label}
              data-testid={`table-style-${style.id}`}
              onClick={() => chain()?.setTableStyle(style.id).run()}
            >
              <span />
              <span />
              <span />
            </button>
          ))}
          <ColorPickerButton
            title="Cell Shading"
            colors={SHADING_COLORS}
            className="rb-btn rb-btn--small"
            onSelect={(color) => chain()?.setCellShading(color).run()}
          >
            <span className="rb-glyph">▨</span>
            <span className="rb-btn-label">Shading</span>
          </ColorPickerButton>
        </RibbonLine>
      </RibbonGroup>
    </>
  );
}
