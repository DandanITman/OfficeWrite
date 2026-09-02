import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Editor } from '@tiptap/core';
import { createTestEditor } from './testEditor';
import { trackChangesPlugin, trackChangesKey } from './trackChangesPlugin';
import {
  acceptAllTrackChanges,
  countTrackChanges,
  rejectAllTrackChanges,
} from '../utils/trackChanges';

let editor: Editor;

function enableTracking(on = true) {
  editor.registerPlugin(
    trackChangesPlugin(
      () => on,
      () => 'Tester',
    ),
  );
}

beforeEach(() => {
  editor = createTestEditor({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original text' }] }],
  });
});

afterEach(() => {
  editor.destroy();
});

describe('track changes', () => {
  it('marks inserted text', () => {
    enableTracking();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent(' added');

    expect(countTrackChanges(editor).insertions).toBeGreaterThan(0);
    expect(editor.getHTML()).toContain('data-track-insert');
  });

  // Previously impossible: only insertions were tracked, deletions really
  // removed the text, and rejecting could never bring it back.
  it('retains deleted text so it can be restored', () => {
    enableTracking();
    editor.commands.setTextSelection({ from: 1, to: 9 });
    editor.commands.deleteSelection();

    expect(countTrackChanges(editor).deletions).toBeGreaterThan(0);
    expect(editor.getText()).toContain('Original');
    expect(editor.getHTML()).toContain('data-track-delete');
  });

  it('rejecting a deletion restores the original text', () => {
    const before = editor.getText();
    enableTracking();
    editor.commands.setTextSelection({ from: 1, to: 9 });
    editor.commands.deleteSelection();

    rejectAllTrackChanges(editor);

    expect(editor.getText()).toBe(before);
    expect(editor.getHTML()).not.toContain('data-track-delete');
  });

  it('accepting a deletion removes the text for good', () => {
    enableTracking();
    editor.commands.setTextSelection({ from: 1, to: 10 });
    editor.commands.deleteSelection();

    acceptAllTrackChanges(editor);

    expect(editor.getText()).not.toContain('Original');
    expect(editor.getHTML()).not.toContain('data-track-delete');
  });

  it('accepting an insertion keeps the text and drops the mark', () => {
    enableTracking();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent(' appended');

    acceptAllTrackChanges(editor);

    expect(editor.getText()).toContain('appended');
    expect(editor.getHTML()).not.toContain('data-track-insert');
  });

  it('rejecting an insertion removes the text', () => {
    enableTracking();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent(' appended');

    rejectAllTrackChanges(editor);

    expect(editor.getText()).not.toContain('appended');
  });

  // The mark stores the time of the edit, so typing produces one mark instance
  // and one text node per keystroke. Counted raw, a single typed word reads as
  // a dozen separate changes.
  it('counts a run of typing as one insertion', () => {
    enableTracking();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    for (const char of ' appended') editor.commands.insertContent(char);

    expect(countTrackChanges(editor).insertions).toBe(1);
  });

  it('records nothing while tracking is off', () => {
    enableTracking(false);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent(' quiet');

    const counts = countTrackChanges(editor);
    expect(counts.insertions).toBe(0);
    expect(counts.deletions).toBe(0);
    editor.unregisterPlugin(trackChangesKey);
  });
});
