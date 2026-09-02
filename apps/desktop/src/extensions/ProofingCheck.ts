import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { checkGrammar, type ProofingIssueKind } from '@officewrite/core';

export const proofingKey = new PluginKey<DecorationSet>('proofing');

/**
 * Split text into candidate words.
 *
 * Uses Unicode letter classes rather than `[A-Za-z']+`. The ASCII-only pattern
 * split "Straße" into "Stra" + "e" and flagged both, which defeated the German,
 * Spanish and French dictionaries the app ships and loads.
 */
export function extractWords(text: string): Array<{ word: string; from: number; to: number }> {
  const results: Array<{ word: string; from: number; to: number }> = [];
  // Letters and combining marks, with internal apostrophes and hyphens.
  const re = /[\p{L}\p{M}](?:[\p{L}\p{M}'’-]*[\p{L}\p{M}])?/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    results.push({ word: match[0], from: match.index, to: match.index + match[0].length });
  }
  return results;
}

/** One problem the checker is reporting, in document coordinates. */
export interface DocumentProofingIssue {
  from: number;
  to: number;
  kind: ProofingIssueKind;
  text: string;
  message: string;
  suggestions: string[];
  rule: string;
}

export interface ProofingOptions {
  enabled: boolean;
  /** Flag grammar as well as spelling. */
  grammarEnabled: boolean;
  language: string;
  checkWords: (words: string[], language: string) => Promise<boolean[]>;
  /** Words the user chose to ignore; never flagged. */
  ignoredWords: string[];
  /** Called after every pass so the app can show the count and the pane. */
  onIssues?: (issues: DocumentProofingIssue[]) => void;
}

/** Every issue the last pass found, in document order. */
export function proofingIssues(state: EditorState): DocumentProofingIssue[] {
  const set = proofingKey.getState(state);
  if (!set) return [];
  return set
    .find()
    .map((decoration) => {
      const spec = decoration.spec as { issue?: DocumentProofingIssue };
      if (!spec.issue) return null;
      return { ...spec.issue, from: decoration.from, to: decoration.to };
    })
    .filter((issue): issue is DocumentProofingIssue => issue !== null)
    .sort((a, b) => a.from - b.from);
}

/**
 * The issue covering a document position, or null.
 *
 * Reading it back from the decoration set gives the exact range that was
 * flagged. The previous approach derived the range from `posAtDOM` plus the
 * word's string length, which mis-targeted the replacement whenever the word
 * sat inside nested inline marks.
 */
export function proofingIssueAt(state: EditorState, pos: number): DocumentProofingIssue | null {
  const set = proofingKey.getState(state);
  if (!set) return null;
  const found = set.find(pos, pos);
  if (!found.length) return null;
  const decoration = found[0];
  const spec = decoration.spec as { issue?: DocumentProofingIssue };
  if (!spec.issue) return { from: decoration.from, to: decoration.to, kind: 'spelling', text: '', message: 'Misspelled word', suggestions: [], rule: 'spelling' };
  return { ...spec.issue, from: decoration.from, to: decoration.to };
}

/** Kept for callers that only care about a misspelling's range. */
export function spellErrorAt(state: EditorState, pos: number): { from: number; to: number } | null {
  const issue = proofingIssueAt(state, pos);
  return issue ? { from: issue.from, to: issue.to } : null;
}

/**
 * Spelling and grammar checking.
 *
 * Spelling comes from the host's Hunspell dictionaries; grammar comes from the
 * rule set in @officewrite/core. Both run on the same debounce and land in one
 * decoration set, so a word cannot be underlined twice and the Editor pane can
 * walk the problems in document order.
 */
export const ProofingCheck = Extension.create<ProofingOptions>({
  name: 'proofingCheck',

  addOptions() {
    return {
      enabled: true,
      grammarEnabled: true,
      language: 'en-US',
      checkWords: async () => [],
      ignoredWords: [],
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    let generation = 0;

    return [
      new Plugin<DecorationSet>({
        key: proofingKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, set) {
            const meta = tr.getMeta(proofingKey);
            if (meta?.decorations) return meta.decorations as DecorationSet;
            return set.map(tr.mapping, tr.doc);
          },
        },
        view(view) {
          let timer: ReturnType<typeof setTimeout> | null = null;
          // Re-run when the language or enabled flags change, not only on edits.
          let lastSignature = '';

          const publish = (decorations: DecorationSet, issues: DocumentProofingIssue[]) => {
            view.dispatch(view.state.tr.setMeta(proofingKey, { decorations }));
            ext.options.onIssues?.(issues);
          };

          const runCheck = () => {
            const { enabled, grammarEnabled, language, checkWords, ignoredWords } = ext.options;
            if (!enabled) {
              publish(DecorationSet.empty, []);
              return;
            }

            const { doc } = view.state;
            const ignored = new Set(ignoredWords.map((word) => word.toLowerCase()));

            // Grammar reads whole blocks: sentence and phrase rules need the
            // surrounding words, which a per-text-node walk cannot give them.
            const grammarIssues: DocumentProofingIssue[] = [];
            if (grammarEnabled) {
              doc.descendants((node, pos) => {
                if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return;
                const text = node.textContent;
                if (!text.trim()) return;
                // +1 for the block's opening token, so offsets land on the text.
                for (const issue of checkGrammar(text)) {
                  grammarIssues.push({
                    from: pos + 1 + issue.from,
                    to: pos + 1 + issue.to,
                    kind: 'grammar',
                    text: issue.text,
                    message: issue.message,
                    suggestions: issue.suggestions,
                    rule: issue.rule,
                  });
                }
              });
            }

            const wordEntries: Array<{ word: string; from: number; to: number }> = [];
            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const entry of extractWords(node.text)) {
                wordEntries.push({ word: entry.word, from: pos + entry.from, to: pos + entry.to });
              }
            });

            const decorate = (issues: DocumentProofingIssue[]) => {
              // Spelling wins where the two overlap: a misspelling inside a
              // grammar span is the more specific and more actionable report.
              const spelling = issues.filter((issue) => issue.kind === 'spelling');
              const grammar = issues.filter(
                (issue) =>
                  issue.kind === 'grammar' &&
                  !spelling.some((s) => issue.from < s.to && s.from < issue.to),
              );
              return DecorationSet.create(
                view.state.doc,
                [...spelling, ...grammar].map((issue) =>
                  Decoration.inline(
                    issue.from,
                    issue.to,
                    {
                      class: issue.kind === 'spelling' ? 'spell-error' : 'grammar-error',
                      title: issue.message,
                    },
                    { issue },
                  ),
                ),
              );
            };

            if (!wordEntries.length) {
              publish(decorate(grammarIssues), grammarIssues);
              return;
            }

            const gen = ++generation;
            const uniqueWords = [...new Set(wordEntries.map((entry) => entry.word))];

            void checkWords(uniqueWords, language).then((results) => {
              // Discard a response that a newer run has already superseded.
              if (gen !== generation) return;
              const bad = new Set(uniqueWords.filter((_, index) => !results[index]));
              const spellingIssues: DocumentProofingIssue[] = wordEntries
                .filter((entry) => bad.has(entry.word) && !ignored.has(entry.word.toLowerCase()))
                .map((entry) => ({
                  from: entry.from,
                  to: entry.to,
                  kind: 'spelling' as const,
                  text: entry.word,
                  message: `"${entry.word}" is not in the dictionary.`,
                  suggestions: [],
                  rule: 'spelling',
                }));

              const all = [...spellingIssues, ...grammarIssues].sort((a, b) => a.from - b.from);
              publish(decorate(all), all);
            });
          };

          const schedule = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(runCheck, 400);
          };

          const signature = () =>
            [
              ext.options.enabled,
              ext.options.grammarEnabled,
              ext.options.language,
              ext.options.ignoredWords.join(','),
            ].join('|');

          lastSignature = signature();
          schedule();

          return {
            update(v, prevState) {
              const next = signature();
              if (next !== lastSignature) {
                lastSignature = next;
                schedule();
                return;
              }
              if (v.state.doc !== prevState.doc) schedule();
            },
            destroy() {
              if (timer) clearTimeout(timer);
            },
          };
        },
        props: {
          decorations(state) {
            return proofingKey.getState(state);
          },
        },
      }),
    ];
  },
});
