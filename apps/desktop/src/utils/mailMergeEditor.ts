import type { Editor } from '@tiptap/react';
import {
  buildEnvelopeDocument,
  buildLabelSheet,
  type DocNode,
  type LabelPreset,
  type MergeFieldAttrs,
} from '@officewrite/core';

/**
 * The editor half of mail merge: the operations that put fields and generated
 * layouts into the document.
 *
 * Everything here is a thin wrapper over a TipTap chain. It exists so App.tsx
 * does not carry seven more `insertContentAt` calls, and so the label and
 * envelope layouts are built by `@officewrite/core` - the same builders the unit
 * tests exercise - rather than being assembled inline in a click handler.
 */

/** Insert one merge field, of any kind, at the caret. */
export function insertMergeField(editor: Editor | null, attrs: Partial<MergeFieldAttrs>): void {
  editor?.chain().focus().insertMergeField(attrs).run();
}

/**
 * Replace the document with a label sheet.
 *
 * A label merge is not an insertion: the sheet *is* the main document, and
 * putting a second table under an existing letter would produce a file that
 * merges to nonsense. The caller confirms first.
 */
export function replaceWithLabelSheet(editor: Editor | null, preset: LabelPreset): void {
  if (!editor) return;
  const sheet = buildLabelSheet(preset.columns, preset.rows);
  editor
    .chain()
    .focus()
    .setContent({ type: 'doc', content: [sheet, { type: 'paragraph' }] } as never)
    .run();
}

/** Put an envelope layout at the top of the document, above whatever is there. */
export function insertEnvelope(
  editor: Editor | null,
  returnAddress: string,
  deliveryAddress: string,
): void {
  if (!editor) return;
  const blocks = buildEnvelopeDocument(returnAddress, deliveryAddress);
  editor
    .chain()
    .focus()
    .insertContentAt(0, [...blocks, { type: 'pageBreak' }] as never)
    .run();
}

/** Plain address lines, for the label and envelope dialogs' typed addresses. */
export function addressParagraphs(address: string): DocNode[] {
  return address.split('\n').map((line) => ({
    type: 'paragraph',
    ...(line ? { content: [{ type: 'text', text: line }] } : {}),
  }));
}

/**
 * A label sheet whose cells all repeat one typed address, rather than merging.
 *
 * The Labels tab offers this for the "thirty copies of my own return address"
 * case, which has no recipient list at all.
 */
export function replaceWithFixedLabels(
  editor: Editor | null,
  preset: LabelPreset,
  address: string,
): void {
  if (!editor) return;
  const cell = (): DocNode => ({ type: 'tableCell', content: addressParagraphs(address) });
  const rows: DocNode[] = [];
  for (let row = 0; row < preset.rows; row += 1) {
    rows.push({
      type: 'tableRow',
      content: Array.from({ length: preset.columns }, () => cell()),
    });
  }
  editor
    .chain()
    .focus()
    .setContent({
      type: 'doc',
      content: [{ type: 'table', content: rows }, { type: 'paragraph' }],
    } as never)
    .run();
}

/**
 * Update Labels: copy the first cell across the sheet, giving every later
 * cell a Next Record rule so one sheet walks the list.
 *
 * Reads the first cell from the live document rather than regenerating a stock
 * sheet, which is the point of the command - you format the first label how you
 * want it, then propagate that.
 */
export function updateLabels(editor: Editor | null): boolean {
  if (!editor) return false;

  const json = editor.getJSON() as DocNode;
  const table = (json.content ?? []).find((node) => node.type === 'table');
  const firstRow = table?.content?.[0];
  const firstCell = firstRow?.content?.[0];
  if (!table || !firstCell) return false;

  const columns = firstRow?.content?.length ?? 1;
  const rows = table.content?.length ?? 1;

  /**
   * Strip any Next Record already in the template cell before copying it.
   *
   * Without this, running Update Labels twice doubles the rules and the sheet
   * starts skipping every other recipient - a bug that only shows up on the
   * second press, which is exactly when nobody is looking for it.
   */
  const stripped = stripNextRecord(firstCell);
  const withNext = prependNextRecord(stripped);

  const nextRows: DocNode[] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    const cells: DocNode[] = [];
    for (let column = 0; column < columns; column += 1) {
      cells.push(structuredClone(index === 0 ? stripped : withNext));
      index += 1;
    }
    nextRows.push({ type: 'tableRow', content: cells });
  }

  const content = (json.content ?? []).map((node) =>
    node === table ? { ...table, content: nextRows } : node,
  );
  editor.chain().focus().setContent({ type: 'doc', content } as never).run();
  return true;
}

function stripNextRecord(cell: DocNode): DocNode {
  const clean = (node: DocNode): DocNode => {
    if (!node.content) return node;
    const content = node.content
      .filter(
        (child) =>
          !(child.type === 'mergeField' && (child.attrs as { rule?: string })?.rule === 'nextRecord'),
      )
      .map(clean);
    return { ...node, content };
  };
  return clean(cell);
}

function prependNextRecord(cell: DocNode): DocNode {
  const content = [...(cell.content ?? [])];
  const first = content[0];
  const rule: DocNode = { type: 'mergeField', attrs: { kind: 'rule', rule: 'nextRecord' } };

  if (first?.type === 'paragraph') {
    content[0] = { ...first, content: [rule, ...(first.content ?? [])] };
  } else {
    content.unshift({ type: 'paragraph', content: [rule] });
  }
  return { ...cell, content };
}
