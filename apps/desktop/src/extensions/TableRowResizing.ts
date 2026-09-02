import TableRow from '@tiptap/extension-table-row';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

/**
 * Drag a row's bottom border to set its height, in the conventional way.
 *
 * prosemirror-tables ships column resizing but nothing for rows, so this is the
 * twin of that plugin: a `height` attribute on the row plus the pointer
 * handling to drive it.
 *
 * The drag itself only touches `style.height` on the row element. Committing a
 * transaction per mousemove would flood the history and make undo useless, so
 * the document is updated once, on release - one drag, one undo step.
 */

/** How close to the border counts as grabbing it. The target is similar. */
const GRAB = 6;
/** Never let a row collapse to nothing; a row must still hold a line of text. */
const MIN_HEIGHT = 20;
/**
 * The column handle owns the right edge of a cell. Inside this margin the
 * pointer is resizing a column, so the row handler keeps out of the way.
 */
const COLUMN_ZONE = 8;

const key = new PluginKey<number | null>('tableRowResizing');

interface Target {
  rowPos: number;
  rowDom: HTMLElement;
}

/** The row containing a cell element, as both a document position and DOM. */
function rowAt(view: EditorView, cell: HTMLElement, rowDom: HTMLElement): Target | null {
  let pos: number;
  try {
    pos = view.posAtDOM(cell, 0);
  } catch {
    return null;
  }
  const $pos = view.state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'tableRow') {
      return { rowPos: $pos.before(depth), rowDom };
    }
  }
  return null;
}

/**
 * The row whose bottom border the pointer is on, if any.
 *
 * Measured from the `<tr>`, not the cell: in a collapsed-border table a cell's
 * box need not reach the row's painted bottom edge, so testing the cell missed
 * the border the user was actually pointing at.
 */
function targetUnder(view: EditorView, event: MouseEvent): Target | null {
  const element = event.target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return null;

  let cell = element.closest('td, th') as HTMLElement | null;
  if (!cell) {
    /*
     * Right on the border the topmost element is often the table wrapper
     * rather than a cell, which is precisely where the user aims. Probe a few
     * pixels up to find the row that owns the border.
     */
    const doc = view.dom.ownerDocument;
    for (const dy of [2, 4, 6]) {
      const probe = doc.elementFromPoint(event.clientX, event.clientY - dy) as HTMLElement | null;
      cell = (probe?.closest?.('td, th') as HTMLElement | null) ?? null;
      if (cell) break;
    }
  }
  if (!cell || !view.dom.contains(cell)) return null;
  let rowDom = cell.closest('tr') as HTMLElement | null;
  if (!rowDom) return null;

  // Leave the corner to the column resizer.
  if (cell.getBoundingClientRect().right - event.clientX < COLUMN_ZONE) return null;

  const rowBox = rowDom.getBoundingClientRect();
  if (Math.abs(event.clientY - rowBox.bottom) > GRAB) {
    /*
     * Exactly on a border, the element under the pointer is the row *below* it.
     * That line belongs to the row above - dragging it is what a word processor treats as
     * resizing that row - so step back one row when the pointer is on this
     * row's top edge instead.
     */
    if (Math.abs(event.clientY - rowBox.top) > GRAB) return null;
    const previous = rowDom.previousElementSibling as HTMLElement | null;
    if (!previous || previous.tagName !== 'TR') return null;
    rowDom = previous;
    const previousCell = previous.querySelector('td, th') as HTMLElement | null;
    if (!previousCell) return null;
    return rowAt(view, previousCell, rowDom);
  }

  return rowAt(view, cell, rowDom);
}

export const TableRowResizing = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (element) => {
          const raw = (element as HTMLElement).style.height || element.getAttribute('height');
          const value = parseInt(raw ?? '', 10);
          return Number.isFinite(value) && value > 0 ? value : null;
        },
        renderHTML: (attributes) =>
          attributes.height ? { style: `height: ${attributes.height}px` } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    let dragging: { target: Target; startY: number; startHeight: number } | null = null;

    return [
      ...(this.parent?.() ?? []),
      new Plugin<number | null>({
        key,
        state: {
          init: () => null,
          apply(tr, value) {
            const next = tr.getMeta(key);
            return next === undefined ? value : next;
          },
        },
        props: {
          attributes(state): Record<string, string> {
            const rowPos = key.getState(state) ?? null;
            return rowPos === null ? {} : { class: 'row-resize-cursor' };
          },

          // Draw the bar on the border the pointer has hold of.
          decorations(state) {
            const rowPos = key.getState(state) ?? null;
            if (rowPos === null) return DecorationSet.empty;
            const row = state.doc.nodeAt(rowPos);
            if (!row) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            let cellPos = rowPos + 1;
            row.forEach((cell) => {
              decorations.push(
                Decoration.node(cellPos, cellPos + cell.nodeSize, { class: 'row-resize-target' }),
              );
              cellPos += cell.nodeSize;
            });
            return DecorationSet.create(state.doc, decorations);
          },

        },

        /*
         * Listeners are attached to the editor element directly rather than
         * through `handleDOMEvents`. ProseMirror runs those through `someProp`,
         * which stops at the first plugin that returns a truthy value - and
         * prosemirror-tables' own column resizer sits ahead of this one in the
         * chain, so the row handler never saw a mousemove at all.
         */
        view(view) {
          const dom = view.dom as HTMLElement;

          const onMouseMove = (event: MouseEvent) => {
            if (dragging) return;
            const target = targetUnder(view, event);
            const current = key.getState(view.state) ?? null;
            const next = target ? target.rowPos : null;
            if (next !== current) view.dispatch(view.state.tr.setMeta(key, next));
          };

          const onMouseLeave = () => {
            if (!dragging && (key.getState(view.state) ?? null) !== null) {
              view.dispatch(view.state.tr.setMeta(key, null));
            }
          };

          const onMouseDown = (event: MouseEvent) => {
            if (event.button !== 0 || dragging) return;
            const target = targetUnder(view, event);
            if (!target) return;

            // Claim the gesture before ProseMirror turns it into a selection.
            event.preventDefault();
            event.stopPropagation();
            dragging = {
              target,
              startY: event.clientY,
              startHeight: target.rowDom.getBoundingClientRect().height,
            };

            const onDragMove = (move: MouseEvent) => {
              if (!dragging) return;
              const height = Math.max(
                MIN_HEIGHT,
                Math.round(dragging.startHeight + (move.clientY - dragging.startY)),
              );
              // Preview on the element only - see the note at the top.
              dragging.target.rowDom.style.height = `${height}px`;
            };

            const onDragEnd = () => {
              window.removeEventListener('mousemove', onDragMove, true);
              window.removeEventListener('mouseup', onDragEnd, true);
              if (!dragging) return;

              const { target: dragged, startHeight } = dragging;
              dragging = null;

              const height = parseInt(dragged.rowDom.style.height || '', 10);
              // Clear the preview so the document, not the DOM, is the truth.
              dragged.rowDom.style.height = '';
              if (!Number.isFinite(height) || Math.round(startHeight) === height) return;

              const row = view.state.doc.nodeAt(dragged.rowPos);
              if (!row) return;
              view.dispatch(
                view.state.tr
                  .setNodeMarkup(dragged.rowPos, undefined, { ...row.attrs, height })
                  .setMeta(key, null),
              );
            };

            window.addEventListener('mousemove', onDragMove, true);
            window.addEventListener('mouseup', onDragEnd, true);
          };

          /*
           * On the document, in the capture phase. Listening on the editor
           * element was not enough: moves over the table itself never reached
           * the handler, while moves over blank page area did. Capturing at the
           * document is immune to whatever consumes them in between, and
           * `targetUnder` ignores anything outside this editor anyway.
           */
          const doc = dom.ownerDocument;
          doc.addEventListener('mousemove', onMouseMove, true);
          doc.addEventListener('mousedown', onMouseDown, true);
          dom.addEventListener('mouseleave', onMouseLeave, true);

          return {
            destroy() {
              doc.removeEventListener('mousemove', onMouseMove, true);
              doc.removeEventListener('mousedown', onMouseDown, true);
              dom.removeEventListener('mouseleave', onMouseLeave, true);
            },
          };
        },
      }),
    ];
  },
});
