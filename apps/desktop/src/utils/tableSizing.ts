import type { Editor } from '@tiptap/react';
import { selectedRect } from '@tiptap/pm/tables';

/**
 * `selectedRect` throws - not returns null - when the selection is not inside
 * a table, because prosemirror-tables' `selectionCell` raises "no cell found".
 *
 * The Table Layout panel renders for a frame after the caret leaves the table,
 * and the Cell Size group measures on every render, so an unguarded call took
 * the whole app down to a blank screen. Every entry point here goes through
 * this.
 */
function rectOf(editor: Editor | null) {
  if (!editor) return null;
  try {
    return selectedRect(editor.view.state);
  } catch {
    return null;
  }
}

/**
 * The Cell Size commands, shared by the Table Layout tab and the Alt+Q
 * command registry.
 *
 * These live outside the tab component so the command palette can run them.
 * When they were inline, the ribbon buttons worked and searching for "column
 * width" or "distribute" found nothing at all.
 *
 * Every one of them writes the same attributes the drag resizers maintain -
 * `colwidth` on cells, `height` on rows - so dragging a border and typing a
 * number cannot disagree.
 */

/** CSS px are 1/96in, and the boxes read in inches. */
export const PPI = 96;
export const pxToIn = (px: number) => Math.round((px / PPI) * 100) / 100;
export const inToPx = (inches: number) => Math.round(inches * PPI);

/**
 * The caret's own table element.
 *
 * Scoped to the caret rather than `querySelector('table')`: in a document with
 * two tables, sizing the second one from the first one's width wrote widths
 * the table could not hold, and the damage persisted through save.
 */
export function currentTableEl(editor: Editor | null): HTMLTableElement | null {
  const rect = rectOf(editor);
  if (!editor || !rect) return null;
  const node = editor.view.domAtPos(rect.tableStart).node as HTMLElement | null;
  const el = node?.nodeType === 1 ? node : (node?.parentElement ?? null);
  return el?.closest('table') ?? null;
}

/**
 * The caret's cell size, measured off the rendered table rather than the
 * attributes: a column that has never been resized carries no `colwidth`, and
 * the real width is still reported.
 */
export function cellSize(editor: Editor | null): { width: number; height: number } {
  if (!editor) return { width: 0, height: 0 };
  const table = currentTableEl(editor);
  const selected = table?.querySelector('td.selectedCell, th.selectedCell');
  const cell =
    selected ??
    (() => {
      const { from } = editor.state.selection;
      const dom = editor.view.domAtPos(from).node as HTMLElement | null;
      return dom?.nodeType === 1
        ? dom.closest('td, th')
        : (dom?.parentElement?.closest('td, th') ?? null);
    })();
  const box = (cell as HTMLElement | null)?.getBoundingClientRect();
  const row = (cell as HTMLElement | null)?.closest('tr')?.getBoundingClientRect();
  return { width: box?.width ?? 0, height: row?.height ?? 0 };
}

/** Applies a width to every cell in the caret's column. */
export function setColumnWidth(editor: Editor | null, px: number) {
  const rect = rectOf(editor);
  if (!editor || !rect) return;
  const { tr } = editor.view.state;
  for (let row = 0; row < rect.map.height; row += 1) {
    const pos = rect.tableStart + rect.map.map[row * rect.map.width + rect.left];
    const node = tr.doc.nodeAt(pos);
    if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, colwidth: [px] });
  }
  editor.view.dispatch(tr);
}

/** Applies a height to the caret's row. */
export function setRowHeight(editor: Editor | null, px: number) {
  const rect = rectOf(editor);
  if (!editor || !rect) return;
  const { tr } = editor.view.state;
  const rowPos = rect.tableStart + rect.map.map[rect.top * rect.map.width] - 1;
  const row = tr.doc.nodeAt(rowPos);
  if (row?.type.name === 'tableRow') {
    tr.setNodeMarkup(rowPos, undefined, { ...row.attrs, height: px || null });
    editor.view.dispatch(tr);
  }
}

/** Strips explicit widths so the browser lays the table out on its content. */
export function clearWidths(editor: Editor | null) {
  const rect = rectOf(editor);
  if (!editor || !rect) return;
  const { tr } = editor.view.state;
  for (const cellPos of rect.map.map) {
    const pos = rect.tableStart + cellPos;
    const node = tr.doc.nodeAt(pos);
    if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, colwidth: null });
  }
  editor.view.dispatch(tr);
}

export function distributeColumns(editor: Editor | null) {
  const rect = rectOf(editor);
  if (!editor || !rect) return;
  const total = currentTableEl(editor)?.getBoundingClientRect().width ?? 0;
  if (!total) return;
  const each = Math.floor(total / rect.map.width);
  const { tr } = editor.view.state;
  for (const cellPos of rect.map.map) {
    const pos = rect.tableStart + cellPos;
    const node = tr.doc.nodeAt(pos);
    if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, colwidth: [each] });
  }
  editor.view.dispatch(tr);
}

export function distributeRows(editor: Editor | null) {
  const rect = rectOf(editor);
  if (!editor || !rect) return;
  const rows = currentTableEl(editor)?.querySelectorAll('tr') ?? [];
  const tallest = Math.max(
    0,
    ...[...rows].map((row) => (row as HTMLElement).getBoundingClientRect().height),
  );
  if (!tallest) return;
  const { tr } = editor.view.state;
  const seen = new Set<number>();
  for (let row = 0; row < rect.map.height; row += 1) {
    const rowPos = rect.tableStart + rect.map.map[row * rect.map.width] - 1;
    if (seen.has(rowPos)) continue;
    seen.add(rowPos);
    const node = tr.doc.nodeAt(rowPos);
    if (node?.type.name === 'tableRow') {
      tr.setNodeMarkup(rowPos, undefined, { ...node.attrs, height: Math.round(tallest) });
    }
  }
  editor.view.dispatch(tr);
}
