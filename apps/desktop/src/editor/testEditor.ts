import { Editor } from '@tiptap/core';
import { createExtensions } from './extensions';

/**
 * An editor for unit tests, built from the *production* extension list.
 *
 * This previously registered only six extensions, so nothing under test could
 * exercise Highlight, Color, Link, Image, Table, PageBreak, DocShape,
 * FootnoteRef, TableOfContents, CommentAnchor, TrackInsert or Hunspell. That
 * gap is what let the FootnoteRef content-hole bug ship: footnote markers
 * rendered as "11" in the app while the tests used a schema without the mark.
 */
export function createTestEditor(content?: object) {
  return new Editor({
    extensions: createExtensions({
      // Spell check is asynchronous and host-backed; keep it out of unit tests.
      spellCheckEnabled: false,
    }),
    content,
  });
}
