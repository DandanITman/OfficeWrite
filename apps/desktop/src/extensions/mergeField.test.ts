import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '@tiptap/core';
import {
  DEFAULT_ADDRESS_BLOCK,
  autoMatchFields,
  buildLabelSheet,
  collectMergeFields,
  dataSourceFromText,
  executeMerge,
  type DocNode,
} from '@officewrite/core';
import { createTestEditor } from '../editor/testEditor';
import {
  addressParagraphs,
  insertEnvelope,
  insertMergeField,
  replaceWithFixedLabels,
  replaceWithLabelSheet,
  updateLabels,
} from '../utils/mailMergeEditor';
import { setMergePreview } from './MergeField';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  setMergePreview({
    active: false,
    highlight: false,
    context: {
      recipient: null,
      recordNumber: 0,
      sequenceNumber: 0,
      mapping: {},
      bookmarks: {},
    },
  });
});

const CSV = ['First Name,Last Name,City', 'Ada,Lovelace,Cambridge', 'Grace,Hopper,Arlington'].join(
  '\n',
);

/** Every merge field the document currently holds. */
function fieldsIn(instance: Editor) {
  return collectMergeFields(instance.getJSON());
}

describe('the merge field node', () => {
  it('survives being placed in the production schema', () => {
    editor = createTestEditor();
    insertMergeField(editor, { kind: 'field', field: 'First Name' });
    expect(fieldsIn(editor)).toEqual([
      expect.objectContaining({ kind: 'field', field: 'First Name' }),
    ]);
  });

  it('is inline, so it sits inside a paragraph beside ordinary text', () => {
    editor = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dear ' }] }],
    });
    editor.commands.focus('end');
    insertMergeField(editor, { kind: 'field', field: 'Last Name' });

    const paragraph = (editor.getJSON().content as DocNode[])[0];
    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.content?.map((node) => node.type)).toEqual(['text', 'mergeField']);
  });

  it('renders as chevrons in the document text', () => {
    editor = createTestEditor();
    insertMergeField(editor, { kind: 'field', field: 'City' });
    expect(editor.getText()).toContain('«City»');
  });

  it('keeps its configuration through an HTML round-trip', () => {
    editor = createTestEditor();
    insertMergeField(editor, {
      kind: 'rule',
      rule: 'ifThenElse',
      compareField: 'City',
      comparison: 'equal',
      compareTo: 'Cambridge',
      trueText: 'Local',
      falseText: 'Away',
    });
    const html = editor.getHTML();

    const reopened = createTestEditor();
    reopened.commands.setContent(html);
    const fields = fieldsIn(reopened);
    reopened.destroy();

    expect(fields[0]).toMatchObject({
      kind: 'rule',
      rule: 'ifThenElse',
      compareField: 'City',
      trueText: 'Local',
      falseText: 'Away',
    });
  });

  it('opens as a plain field when the stored config is corrupt', () => {
    // A hand-edited or truncated file must still open. Losing the rule is
    // acceptable; refusing to load the document is not.
    editor = createTestEditor();
    editor.commands.setContent(
      '<p><span data-merge-field="City" data-merge-config="{not json">«City»</span></p>',
    );
    expect(fieldsIn(editor)).toEqual([expect.objectContaining({ kind: 'field', field: 'City' })]);
  });

  it('deletes as one unit, because it is an atom', () => {
    editor = createTestEditor();
    insertMergeField(editor, { kind: 'field', field: 'City' });
    expect(fieldsIn(editor)).toHaveLength(1);

    editor.commands.selectAll();
    editor.commands.deleteSelection();
    expect(fieldsIn(editor)).toHaveLength(0);
  });

  it('carries the address block options with it', () => {
    editor = createTestEditor();
    insertMergeField(editor, {
      kind: 'addressBlock',
      addressOptions: { ...DEFAULT_ADDRESS_BLOCK, includeCompany: false },
    });
    expect(fieldsIn(editor)[0].addressOptions?.includeCompany).toBe(false);
  });
});

describe('label and envelope layouts', () => {
  it('replaces the document with a merge-ready label sheet', () => {
    editor = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old letter' }] }],
    });
    replaceWithLabelSheet(editor, {
      id: 'test',
      name: 'Test',
      columns: 2,
      rows: 3,
      width: 4,
      height: 1,
    });

    const json = editor.getJSON() as DocNode;
    const table = json.content?.find((node) => node.type === 'table');
    expect(table?.content).toHaveLength(3);
    expect(editor.getText()).not.toContain('Old letter');
    // One address block per cell, and a Next Record in all but the first.
    const fields = fieldsIn(editor);
    expect(fields.filter((f) => f.kind === 'addressBlock')).toHaveLength(6);
    expect(fields.filter((f) => f.rule === 'nextRecord')).toHaveLength(5);
  });

  it('repeats a typed address when there is no recipient list', () => {
    editor = createTestEditor();
    replaceWithFixedLabels(
      editor,
      { id: 'x', name: 'X', columns: 2, rows: 2, width: 4, height: 1 },
      'Officewrite\n1 Example Street',
    );
    expect(fieldsIn(editor)).toHaveLength(0);
    // Four cells, each holding both lines.
    expect(editor.getText().match(/Officewrite/g)).toHaveLength(4);
  });

  it('puts an envelope above the existing document rather than replacing it', () => {
    editor = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Letter body' }] }],
    });
    insertEnvelope(editor, 'From Me\n1 Sender Road', '');

    const text = editor.getText();
    expect(text).toContain('From Me');
    expect(text).toContain('«AddressBlock»');
    expect(text).toContain('Letter body');
    expect(text.indexOf('From Me')).toBeLessThan(text.indexOf('Letter body'));
  });

  it('keeps a typed delivery address instead of inserting a field', () => {
    editor = createTestEditor();
    insertEnvelope(editor, 'From Me', 'To You\n2 Recipient Way');
    expect(editor.getText()).toContain('To You');
    expect(fieldsIn(editor)).toHaveLength(0);
  });

  it('turns a blank line in an address into an empty paragraph', () => {
    expect(addressParagraphs('A\n\nB')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'A' }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
    ]);
  });
});

describe('Update Labels', () => {
  /** A 2×2 sheet whose first cell has been edited by hand. */
  function sheetWithCustomFirstCell() {
    const sheet = buildLabelSheet(2, 2) as DocNode;
    const firstCell = sheet.content![0].content![0];
    firstCell.content = [
      { type: 'paragraph', content: [{ type: 'text', text: 'ATTN: ' }] },
      { type: 'paragraph', content: [{ type: 'mergeField', attrs: { kind: 'addressBlock' } }] },
    ];
    return { type: 'doc', content: [sheet] };
  }

  it('copies the first label across the sheet', () => {
    editor = createTestEditor(sheetWithCustomFirstCell());
    expect(updateLabels(editor)).toBe(true);
    // The hand-edited prefix now appears in all four cells.
    expect(editor.getText().match(/ATTN:/g)).toHaveLength(4);
  });

  it('gives every cell but the first exactly one Next Record', () => {
    editor = createTestEditor(sheetWithCustomFirstCell());
    updateLabels(editor);
    expect(fieldsIn(editor).filter((f) => f.rule === 'nextRecord')).toHaveLength(3);
  });

  /* The bug this guards: a second press used to double the rules, so the sheet
     began skipping every other recipient. */
  it('is idempotent, so pressing it twice does not double the rules', () => {
    editor = createTestEditor(sheetWithCustomFirstCell());
    updateLabels(editor);
    updateLabels(editor);
    expect(fieldsIn(editor).filter((f) => f.rule === 'nextRecord')).toHaveLength(3);
  });

  it('still walks the list one sheet at a time after updating', () => {
    editor = createTestEditor(sheetWithCustomFirstCell());
    updateLabels(editor);

    const data = dataSourceFromText(CSV, 'c.csv');
    const result = executeMerge(editor.getJSON(), data, autoMatchFields(data.fields), {
      type: 'labels',
    });
    // Four cells swallow both recipients, so one sheet is the whole merge.
    expect(result.merged).toBe(1);
    expect(result.content.content.length).toBeGreaterThan(0);
  });

  it('reports failure on a document with no label table', () => {
    editor = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Just a letter' }] }],
    });
    expect(updateLabels(editor)).toBe(false);
  });

  it('reports failure with no editor at all', () => {
    expect(updateLabels(null)).toBe(false);
  });
});

describe('preview state', () => {
  it('is published for the node views to read', () => {
    const data = dataSourceFromText(CSV, 'c.csv');
    setMergePreview({
      active: true,
      highlight: true,
      context: {
        recipient: data.recipients[0],
        recordNumber: 1,
        sequenceNumber: 1,
        mapping: autoMatchFields(data.fields),
        bookmarks: {},
      },
    });
    expect(window.__OFFICEWRITE_MERGE__?.active).toBe(true);
    expect(window.__OFFICEWRITE_MERGE__?.context.recipient?.values['First Name']).toBe('Ada');
  });
});
