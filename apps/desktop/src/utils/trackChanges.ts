import type { Editor } from '@tiptap/react';
import type { MarkType } from '@tiptap/pm/model';
import { uiAlert } from './uiPrompt';
import { TRACK_CHANGES_INTERNAL } from '../editor/trackChangesPlugin';

export type TrackMarkName = 'trackInsert' | 'trackDelete';

interface TrackedRange {
  from: number;
  to: number;
  mark: TrackMarkName;
}

/**
 * Every tracked range in the document (or a slice of it), in document order.
 *
 * One entry per text node, never one per mark: a node that briefly carries both
 * marks would otherwise yield two overlapping ranges covering the same text,
 * and resolving them would apply two conflicting edits at the same position.
 * A deletion wins, since it is the destructive-versus-restore decision.
 */
function trackedRanges(editor: Editor, from?: number, to?: number): TrackedRange[] {
  const ranges: TrackedRange[] = [];
  const start = from ?? 0;
  const end = to ?? editor.state.doc.content.size;

  editor.state.doc.nodesBetween(start, end, (node, pos) => {
    if (!node.isText) return;
    const names = node.marks.map((m) => m.type.name);
    const mark: TrackMarkName | undefined = names.includes('trackDelete')
      ? 'trackDelete'
      : names.includes('trackInsert')
        ? 'trackInsert'
        : undefined;
    if (mark) ranges.push({ from: pos, to: pos + node.nodeSize, mark });
  });

  return ranges;
}

/** The tracked ranges the selection covers, or the run the caret sits inside. */
function selectedTrackedRanges(editor: Editor): TrackedRange[] {
  const { from, to, empty } = editor.state.selection;

  if (!empty) {
    const covered = trackedRanges(editor, from, to);
    if (covered.length) return covered;
  }

  const active = editor.state.doc
    .resolve(from)
    .marks()
    .find((m) => m.type.name === 'trackInsert' || m.type.name === 'trackDelete');
  if (!active) return [];

  return trackedRanges(editor).filter(
    (range) => range.mark === active.type.name && from >= range.from && from <= range.to,
  );
}

function markType(editor: Editor, name: TrackMarkName): MarkType | undefined {
  return editor.state.schema.marks[name];
}

/**
 * Apply an accept/reject outcome to a set of tracked ranges.
 *
 * Accepting keeps insertions (dropping the mark) and removes deletions.
 * Rejecting removes insertions and restores deletions (dropping the mark).
 * Ranges are processed back to front so earlier positions stay valid.
 */
function resolve(editor: Editor, ranges: TrackedRange[], accept: boolean) {
  if (!ranges.length) return;

  const insertType = markType(editor, 'trackInsert');
  const deleteType = markType(editor, 'trackDelete');
  const tr = editor.state.tr;

  for (const range of [...ranges].sort((a, b) => b.from - a.from)) {
    const keep = accept ? range.mark === 'trackInsert' : range.mark === 'trackDelete';

    // Map through the edits already staged in this transaction: back-to-front
    // ordering alone is not enough once a range has been removed.
    const from = tr.mapping.map(range.from, 1);
    const to = tr.mapping.map(range.to, -1);
    if (to <= from) continue;

    if (keep) {
      // Clear both marks: text that survives is no longer a pending change.
      if (insertType) tr.removeMark(from, to, insertType);
      if (deleteType) tr.removeMark(from, to, deleteType);
    } else {
      tr.delete(from, to);
    }
  }

  if (!tr.steps.length) return;
  // Exempt from tracking, or the plugin would treat this resolution as a new
  // authored edit and undo it.
  editor.view.dispatch(tr.setMeta(TRACK_CHANGES_INTERNAL, true));
}

export function acceptAllTrackChanges(editor: Editor) {
  resolve(editor, trackedRanges(editor), true);
}

export function rejectAllTrackChanges(editor: Editor) {
  resolve(editor, trackedRanges(editor), false);
}

export async function acceptTrackChangeInSelection(editor: Editor) {
  const ranges = selectedTrackedRanges(editor);
  if (!ranges.length) {
    await uiAlert('Place the cursor in a tracked change or select tracked text.');
    return;
  }
  resolve(editor, ranges, true);
}

export async function rejectTrackChangeInSelection(editor: Editor) {
  const ranges = selectedTrackedRanges(editor);
  if (!ranges.length) {
    await uiAlert('Place the cursor in a tracked change or select tracked text.');
    return;
  }
  resolve(editor, ranges, false);
}

/**
 * Tracked change counts, for the status bar and the Review tab.
 *
 * Adjacent ranges of the same kind are one change. The mark records the time it
 * was made, so every keystroke produces a separate mark instance and its own
 * text node - counting those raw would report a ten-character word as ten
 * changes. The contiguous run counts as one revision, and so does Accept.
 */
export function countTrackChanges(editor: Editor): { insertions: number; deletions: number } {
  let insertions = 0;
  let deletions = 0;
  let previous: TrackedRange | null = null;

  for (const range of trackedRanges(editor)) {
    const continues = previous && previous.mark === range.mark && previous.to === range.from;
    if (!continues) {
      if (range.mark === 'trackInsert') insertions += 1;
      else deletions += 1;
    }
    previous = range;
  }

  return { insertions, deletions };
}
