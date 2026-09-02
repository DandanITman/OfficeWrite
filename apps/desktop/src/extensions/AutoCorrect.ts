import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
  AUTOFORMAT_SYMBOLS,
  autoCorrectWord,
  fixLoneI,
  fixTwoInitialCapitals,
  smartQuote,
} from '@officewrite/core';

export const autoCorrectKey = new PluginKey('autoCorrect');

/** Text just before a position, for the smart-quote decision. */
function charBefore(doc: import('@tiptap/pm/model').Node, pos: number): string {
  if (pos <= 1) return '';
  return doc.textBetween(Math.max(0, pos - 1), pos, '', '');
}

/**
 * AutoCorrect and AutoFormat As You Type.
 *
 * A word processor fixes a word the moment you finish it - by typing a space, a newline or
 * punctuation - never mid-word. This handles the same trigger points:
 *
 *  - the replacement table ("teh" → "the")
 *  - TWo INitial CApitals
 *  - a lone lowercase "i"
 *  - the first letter of a sentence
 *  - straight quotes → curly quotes, and the -- / ... / (c) symbol shortcuts
 *
 * Every correction goes through a normal transaction, so Ctrl+Z reverses it and
 * tracked changes record it.
 */
export const AutoCorrect = Extension.create<{ enabled: boolean }>({
  name: 'autoCorrect',

  addOptions() {
    return { enabled: true };
  },

  addProseMirrorPlugins() {
    const ext = this;

    return [
      new Plugin({
        key: autoCorrectKey,
        props: {
          handleTextInput(view, from, to, text) {
            if (!ext.options.enabled) return false;

            const { state } = view;

            // Curly quotes: replace as the quote is typed, since the decision
            // only depends on the character already to the left.
            if (text === '"' || text === "'") {
              const replacement = smartQuote(text, charBefore(state.doc, from));
              view.dispatch(state.tr.insertText(replacement, from, to));
              return true;
            }

            const finishesWord = /[\s.,;:!?)\]}"'”’]/.test(text);
            if (!finishesWord) return false;

            // The word that just ended, read straight out of the text block.
            const $from = state.doc.resolve(from);
            const blockStart = $from.start();
            const before = state.doc.textBetween(blockStart, from, '\n', '￼');

            const symbol = AUTOFORMAT_SYMBOLS.find((entry) => before.endsWith(entry.from));
            if (symbol) {
              const start = from - symbol.from.length;
              view.dispatch(state.tr.insertText(symbol.to + text, start, to));
              return true;
            }

            const match = /([\p{L}\p{M}'’]+)$/u.exec(before);
            if (!match) return false;

            const word = match[1];
            const wordStart = from - word.length;

            const corrected =
              autoCorrectWord(word) ??
              fixTwoInitialCapitals(word) ??
              fixLoneI(word) ??
              capitaliseSentenceStart(before, word);

            if (!corrected || corrected === word) return false;

            view.dispatch(state.tr.insertText(corrected + text, wordStart, to));
            return true;
          },
        },
      }),
    ];
  },
});

/**
 * Capitalise the first word of a sentence.
 *
 * `before` is the block text up to the caret, so the sentence boundary is
 * whatever precedes the word: nothing at all, or a full stop and a space.
 */
function capitaliseSentenceStart(before: string, word: string): string | null {
  if (word[0] !== word[0].toLowerCase() || !/\p{L}/u.test(word[0])) return null;
  const preceding = before.slice(0, before.length - word.length);
  const atSentenceStart = preceding.trim() === '' || /[.!?]["'”’)]?\s+$/.test(preceding);
  if (!atSentenceStart) return null;
  // Leave deliberately lowercase terms alone; a single letter is a false
  // positive risk ("a", "b") only when it is not "i", which fixLoneI handles.
  if (word.length === 1) return null;
  return word[0].toUpperCase() + word.slice(1);
}
