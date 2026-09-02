import { describe, expect, it, afterEach } from 'vitest';
import { createTestEditor } from '../editor/testEditor';
import { wrapOfficewriteFile, unwrapOfficewriteFile } from '@officewrite/openxml';
import {
  buildRegressionDocumentContent,
  REGRESSION_BOLD,
  REGRESSION_DOC_TITLE,
  REGRESSION_ITALIC,
  REGRESSION_UNDERLINE,
} from '@tests/fixtures/regressionDocument';

describe('editor formatting behavior', () => {
  let editor = createTestEditor();

  afterEach(() => {
    editor.destroy();
    editor = createTestEditor();
  });

  it('starts from a blank paragraph', () => {
    expect(editor.getText()).toBe('');
    const json = editor.getJSON() as { type: string; content: Array<{ type: string }> };
    expect(json.type).toBe('doc');
    expect(json.content).toHaveLength(1);
    expect(json.content[0]?.type).toBe('paragraph');
  });

  it('types text into the editor', () => {
    editor.commands.insertContent('Hello Officewrite');
    expect(editor.getText()).toBe('Hello Officewrite');
  });

  it('applies bold, italic, and underline marks', () => {
    editor.commands.insertContent(REGRESSION_BOLD);
    editor.commands.selectAll();
    editor.commands.toggleBold();
    expect(editor.isActive('bold')).toBe(true);

    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size });
    editor.commands.clearContent();
    editor.commands.insertContent(REGRESSION_ITALIC);
    editor.commands.selectAll();
    editor.commands.toggleItalic();
    expect(editor.isActive('italic')).toBe(true);

    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size });
    editor.commands.clearContent();
    editor.commands.insertContent(REGRESSION_UNDERLINE);
    editor.commands.selectAll();
    editor.commands.toggleUnderline();
    expect(editor.isActive('underline')).toBe(true);
  });

  it('changes font size through textStyle mark', () => {
    editor.commands.insertContent('Sized text');
    editor.commands.selectAll();
    editor.commands.setMark('textStyle', { fontSize: '18pt' });
    expect(editor.getAttributes('textStyle').fontSize).toBe('18pt');
  });

  it('changes paragraph alignment', () => {
    editor.commands.insertContent('Aligned text');
    editor.commands.setTextAlign('center');
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
    editor.commands.setTextAlign('right');
    expect(editor.isActive({ textAlign: 'right' })).toBe(true);
  });

  it('creates bullet and numbered lists', () => {
    editor.commands.insertContent('Item one');
    editor.commands.toggleBulletList();
    expect(editor.isActive('bulletList')).toBe(true);

    editor.commands.clearContent();
    editor.commands.insertContent('Number one');
    editor.commands.toggleOrderedList();
    expect(editor.isActive('orderedList')).toBe(true);
  });

  it('TC-UNIT-003: supports undo and redo', () => {
    editor.commands.insertContent('Hello');
    expect(editor.getText()).toBe('Hello');
    expect(editor.can().undo()).toBe(true);
    editor.commands.undo();
    expect(editor.getText()).toBe('');
    expect(editor.can().redo()).toBe(true);
    editor.commands.redo();
    expect(editor.getText()).toBe('Hello');
  });

  it('round-trips formatted content through officewrite file format', () => {
    const content = buildRegressionDocumentContent();
    editor.commands.setContent(content as object);
    const json = editor.getJSON();

    const wrapped = wrapOfficewriteFile(json, { title: REGRESSION_DOC_TITLE, author: 'Tester' });
    const restored = unwrapOfficewriteFile(wrapped);

    expect(restored.metadata.title).toBe(REGRESSION_DOC_TITLE);
    expect(restored.content).toEqual(json);
  });
});
