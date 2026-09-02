import type { Editor } from '@tiptap/react';

/** The Find options. Both default off. */
export interface FindOptions {
  matchCase?: boolean;
  wholeWord?: boolean;
}

export interface FindMatch {
  from: number;
  to: number;
}

/** Letters, digits and underscore count as word characters. */
const WORD = /[\p{L}\p{N}_]/u;

function isWholeWord(text: string, index: number, length: number): boolean {
  const before = index > 0 ? text[index - 1] : '';
  const after = index + length < text.length ? text[index + length] : '';
  return !(before && WORD.test(before)) && !(after && WORD.test(after));
}

/** Every match in one text node, honouring the options. */
function matchesIn(text: string, query: string, options: FindOptions): number[] {
  const haystack = options.matchCase ? text : text.toLowerCase();
  const needle = options.matchCase ? query : query.toLowerCase();
  const hits: number[] = [];

  let start = 0;
  while (start <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, start);
    if (index === -1) break;
    if (!options.wholeWord || isWholeWord(text, index, needle.length)) hits.push(index);
    // Step past the whole match: overlapping hits would let Replace All
    // rewrite text it had already replaced.
    start = index + needle.length;
  }
  return hits;
}

export function findInEditor(
  editor: Editor,
  query: string,
  startFrom = 0,
  options: FindOptions = {},
): FindMatch | null {
  if (!query) return null;
  let found: FindMatch | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return;
    for (const index of matchesIn(node.text, query, options)) {
      if (pos + index >= startFrom) {
        found = { from: pos + index, to: pos + index + query.length };
        return;
      }
    }
  });

  return found;
}

export function findAllInEditor(
  editor: Editor,
  query: string,
  options: FindOptions = {},
): FindMatch[] {
  if (!query) return [];
  const matches: FindMatch[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const index of matchesIn(node.text, query, options)) {
      matches.push({ from: pos + index, to: pos + index + query.length });
    }
  });

  return matches;
}

export function replaceInEditor(
  editor: Editor,
  query: string,
  replacement: string,
  all = false,
  options: FindOptions = {},
) {
  const matches = findAllInEditor(editor, query, options);
  if (!matches.length) return 0;

  if (all) {
    let tr = editor.state.tr;
    // Back to front, so each edit leaves the earlier positions valid.
    for (let i = matches.length - 1; i >= 0; i--) {
      tr = tr.insertText(replacement, matches[i].from, matches[i].to);
    }
    editor.view.dispatch(tr);
    return matches.length;
  }

  const sel = editor.state.selection.to;
  const next =
    findInEditor(editor, query, sel, options) ?? findInEditor(editor, query, 0, options);
  if (!next) return 0;
  editor.chain().focus().insertContentAt({ from: next.from, to: next.to }, replacement).run();
  return 1;
}
