import { beforeAll, describe, expect, it } from 'vitest';
import { createTestEditor } from './testEditor';

beforeAll(() => {
  // prosemirror-tables' own column resizer probes this on every mousemove and
  // jsdom does not implement it; without the stub it throws past our handler.
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
});

/**
 * Row height dragging.
 *
 * jsdom has no layout, so every rect the plugin reads is stubbed here. That is
 * enough to cover what actually broke: which element the pointer is measured
 * against, and whether a drag lands a height on the row.
 */

const TABLE_DOC = {
  type: 'doc',
  content: [
    {
      type: 'table',
      content: [1, 2].map(() => ({
        type: 'tableRow',
        content: [1, 2].map(() => ({
          type: 'tableCell',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
        })),
      })),
    },
  ],
};

/**
 * Lay the table out: each row 40px tall, each cell 100px wide.
 *
 * Also attaches the editor to the document - the plugin captures at the
 * document, so a detached editor would never see the events.
 */
function stubLayout(dom: HTMLElement) {
  document.body.appendChild(dom);
  const rows = Array.from(dom.querySelectorAll('tr'));
  rows.forEach((row, index) => {
    const top = index * 40;
    row.getBoundingClientRect = () =>
      ({ top, bottom: top + 40, left: 0, right: 200, width: 200, height: 40 }) as DOMRect;
    Array.from(row.querySelectorAll('td, th')).forEach((cell, column) => {
      (cell as HTMLElement).getBoundingClientRect = () =>
        ({
          top,
          bottom: top + 40,
          left: column * 100,
          right: column * 100 + 100,
          width: 100,
          height: 40,
        }) as DOMRect;
    });
  });
  return rows;
}

function mouse(type: string, clientX: number, clientY: number) {
  return new MouseEvent(type, { clientX, clientY, bubbles: true, button: 0 });
}

describe('table row resizing', () => {
  it('marks the row when the pointer is on its bottom border', () => {
    const editor = createTestEditor(TABLE_DOC);
    const rows = stubLayout(editor.view.dom as HTMLElement);
    const cell = rows[0].querySelector('td') as HTMLElement;

    // Mid-cell: nothing to grab.
    cell.dispatchEvent(mouse('mousemove', 50, 20));
    expect((editor.view.dom as HTMLElement).className).not.toContain('row-resize-cursor');

    // On row 1's bottom edge.
    cell.dispatchEvent(mouse('mousemove', 50, 40));
    expect((editor.view.dom as HTMLElement).className).toContain('row-resize-cursor');

    editor.destroy();
  });

  it('keeps clear of the column handle at the cell corner', () => {
    const editor = createTestEditor(TABLE_DOC);
    const rows = stubLayout(editor.view.dom as HTMLElement);
    const cell = rows[0].querySelector('td') as HTMLElement;

    // Bottom edge, but hard against the right border: that is a column drag.
    cell.dispatchEvent(mouse('mousemove', 99, 40));
    expect((editor.view.dom as HTMLElement).className).not.toContain('row-resize-cursor');

    editor.destroy();
  });

  it('writes the dragged height onto the row, once', () => {
    const editor = createTestEditor(TABLE_DOC);
    const rows = stubLayout(editor.view.dom as HTMLElement);
    const cell = rows[0].querySelector('td') as HTMLElement;

    cell.dispatchEvent(mouse('mousemove', 50, 40));
    cell.dispatchEvent(mouse('mousedown', 50, 40));
    window.dispatchEvent(mouse('mousemove', 50, 70));
    window.dispatchEvent(mouse('mouseup', 50, 70));

    const row = editor.state.doc.firstChild?.firstChild;
    expect(row?.attrs.height).toBe(70);
    // The preview style is handed back to the document, not left on the DOM.
    expect(rows[0].style.height).toBe('');
    // Untouched rows stay unset.
    expect(editor.state.doc.firstChild?.child(1).attrs.height).toBeNull();

    editor.destroy();
  });

  it('will not collapse a row below a usable height', () => {
    const editor = createTestEditor(TABLE_DOC);
    const rows = stubLayout(editor.view.dom as HTMLElement);
    const cell = rows[0].querySelector('td') as HTMLElement;

    cell.dispatchEvent(mouse('mousemove', 50, 40));
    cell.dispatchEvent(mouse('mousedown', 50, 40));
    window.dispatchEvent(mouse('mousemove', 50, -200));
    window.dispatchEvent(mouse('mouseup', 50, -200));

    expect(editor.state.doc.firstChild?.firstChild?.attrs.height).toBe(20);

    editor.destroy();
  });

  it('round-trips the height through HTML', () => {
    const editor = createTestEditor(TABLE_DOC);
    const rows = stubLayout(editor.view.dom as HTMLElement);
    const cell = rows[0].querySelector('td') as HTMLElement;

    cell.dispatchEvent(mouse('mousemove', 50, 40));
    cell.dispatchEvent(mouse('mousedown', 50, 40));
    window.dispatchEvent(mouse('mousemove', 50, 85));
    window.dispatchEvent(mouse('mouseup', 50, 85));

    expect(editor.getHTML()).toContain('height: 85px');

    const reopened = createTestEditor({ type: 'doc', content: [] });
    reopened.commands.setContent(editor.getHTML());
    expect(reopened.state.doc.firstChild?.firstChild?.attrs.height).toBe(85);

    editor.destroy();
    reopened.destroy();
  });
  it('grabs the row above when the border is approached from the row below', () => {
    const editor = createTestEditor(TABLE_DOC);
    const rows = stubLayout(editor.view.dom as HTMLElement);
    // Row 2's own top edge is the same line as row 1's bottom, and that is the
    // element the pointer actually lands on. Dragging it must size row 1.
    const lowerCell = rows[1].querySelector('td') as HTMLElement;

    lowerCell.dispatchEvent(mouse('mousemove', 50, 40));
    lowerCell.dispatchEvent(mouse('mousedown', 50, 40));
    window.dispatchEvent(mouse('mousemove', 50, 90));
    window.dispatchEvent(mouse('mouseup', 50, 90));

    expect(editor.state.doc.firstChild?.firstChild?.attrs.height).toBe(90);
    expect(editor.state.doc.firstChild?.child(1).attrs.height).toBeNull();

    editor.destroy();
  });
});
