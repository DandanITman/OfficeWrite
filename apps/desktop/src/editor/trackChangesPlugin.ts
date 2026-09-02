import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { ReplaceStep, ReplaceAroundStep } from '@tiptap/pm/transform';
import type { Node as ProseMirrorNode, Slice } from '@tiptap/pm/model';

export const trackChangesKey = new PluginKey('trackChanges');

/**
 * Transactions carrying this meta are not authored edits and must not be
 * tracked: the plugin's own restorations, and the accept/reject commands.
 * Without it, accepting a deletion issues a delete that the plugin promptly
 * tracks and restores again.
 */
export const TRACK_CHANGES_INTERNAL = 'trackChangesInternal';

interface DeletedRange {
  /** Position in the *new* document where the deleted content should reappear. */
  at: number;
  slice: Slice;
}

/**
 * Text removed under an active track-changes session, gathered from the steps
 * of a transaction before they are applied.
 */
function deletionsFrom(transaction: Transaction, before: ProseMirrorNode): DeletedRange[] {
  const out: DeletedRange[] = [];

  for (const step of transaction.steps) {
    if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep)) continue;

    const { from, to } = step as unknown as { from: number; to: number };
    if (to <= from) continue;

    const removed = before.slice(from, to);
    if (removed.size === 0) continue;

    // Where this content lands once the step's own mapping is applied.
    out.push({ at: step.getMap().map(from, -1), slice: removed });
  }

  return out;
}

/**
 * Track changes.
 *
 * Insertions are marked `trackInsert`. Deletions are re-inserted in place and
 * marked `trackDelete` instead of being dropped, so rejecting a change can
 * actually restore the text.
 */
export function trackChangesPlugin(enabled: () => boolean, author: () => string) {
  return new Plugin({
    key: trackChangesKey,

    appendTransaction(transactions, _oldState: EditorState, newState: EditorState) {
      if (!enabled()) return null;

      const insertMark = newState.schema.marks.trackInsert;
      const deleteMark = newState.schema.marks.trackDelete;
      if (!insertMark && !deleteMark) return null;

      const tr = newState.tr;
      let modified = false;
      const now = new Date().toISOString();
      const who = author();

      for (const transaction of transactions) {
        if (!transaction.docChanged) continue;
        if (transaction.getMeta(TRACK_CHANGES_INTERNAL)) continue;

        // Mark genuinely new content as an insertion.
        if (insertMark) {
          transaction.steps.forEach((step) => {
            step.getMap().forEach((_oldStart, _oldEnd, newStart, newEnd) => {
              if (newEnd <= newStart) return;
              const from = tr.mapping.map(newStart);
              const to = tr.mapping.map(newEnd);
              if (to > from) {
                tr.addMark(from, to, insertMark.create({ author: who, at: now }));
                modified = true;
              }
            });
          });
        }
        // Restore deleted content, struck through, rather than losing it.
        if (deleteMark) {
          const deletions = deletionsFrom(transaction, transaction.before);
          for (const deletion of deletions.reverse()) {
            const at = tr.mapping.map(deletion.at);
            const insertedAt = tr.doc.content.size >= at ? at : tr.doc.content.size;
            tr.replace(insertedAt, insertedAt, deletion.slice);
            tr.addMark(
              insertedAt,
              Math.min(insertedAt + deletion.slice.size, tr.doc.content.size),
              deleteMark.create({ author: who, at: now }),
            );
            modified = true;
          }
        }

      }

      if (!modified) return null;
      return tr.setMeta(TRACK_CHANGES_INTERNAL, true).setMeta('addToHistory', false);
    },
  });
}
