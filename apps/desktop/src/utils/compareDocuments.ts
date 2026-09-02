/**
 * Review > Compare.
 *
 * Compare produces a third document in which every difference is a tracked change.
 * The comparison here is at paragraph level, which is what makes the result
 * readable: a character-level diff of a rewritten paragraph is a thicket of
 * one-letter revisions nobody can accept or reject usefully.
 */

interface ParagraphLike {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<Record<string, unknown>>;
}

function blocksOf(content: unknown): ParagraphLike[] {
  if (!content || typeof content !== 'object') return [];
  const doc = content as { content?: ParagraphLike[] };
  return Array.isArray(doc.content) ? doc.content : [];
}

function textOf(block: ParagraphLike): string {
  const walk = (nodes: Array<Record<string, unknown>> | undefined): string =>
    (nodes ?? [])
      .map((node) =>
        typeof node.text === 'string'
          ? node.text
          : walk(node.content as Array<Record<string, unknown>> | undefined),
      )
      .join('');
  return walk(block.content);
}

/** Longest common subsequence of two string lists, as index pairs. */
function lcsPairs(left: string[], right: string[]): Array<[number, number]> {
  const rows = left.length;
  const cols = right.length;
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] =
        left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (left[i] === right[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/** Wrap every text node in a block with a tracking mark. */
function markBlock(block: ParagraphLike, mark: 'trackInsert' | 'trackDelete', author: string): ParagraphLike {
  const stamp = new Date().toISOString();
  const decorate = (nodes: Array<Record<string, unknown>> | undefined): Array<Record<string, unknown>> =>
    (nodes ?? []).map((node) => {
      if (typeof node.text === 'string') {
        const marks = Array.isArray(node.marks) ? [...(node.marks as unknown[])] : [];
        marks.push({ type: mark, attrs: { author, at: stamp } });
        return { ...node, marks };
      }
      if (node.content) {
        return { ...node, content: decorate(node.content as Array<Record<string, unknown>>) };
      }
      return node;
    });

  return { ...block, content: decorate(block.content) };
}

/**
 * Merge `revised` onto `original`, marking the differences.
 *
 * Paragraphs only in the original become tracked deletions; paragraphs only in
 * the revision become tracked insertions; shared paragraphs are left alone.
 */
export function compareDocuments(
  original: unknown,
  revised: unknown,
  author = 'Comparison',
): { content: unknown; insertions: number; deletions: number } {
  const originalBlocks = blocksOf(original);
  const revisedBlocks = blocksOf(revised);
  const originalText = originalBlocks.map(textOf);
  const revisedText = revisedBlocks.map(textOf);

  const pairs = lcsPairs(originalText, revisedText);
  const merged: ParagraphLike[] = [];
  let insertions = 0;
  let deletions = 0;

  let originalIndex = 0;
  let revisedIndex = 0;

  const flushTo = (originalStop: number, revisedStop: number) => {
    while (originalIndex < originalStop) {
      merged.push(markBlock(originalBlocks[originalIndex], 'trackDelete', author));
      if (originalText[originalIndex].trim()) deletions += 1;
      originalIndex += 1;
    }
    while (revisedIndex < revisedStop) {
      merged.push(markBlock(revisedBlocks[revisedIndex], 'trackInsert', author));
      if (revisedText[revisedIndex].trim()) insertions += 1;
      revisedIndex += 1;
    }
  };

  for (const [left, right] of pairs) {
    flushTo(left, right);
    merged.push(originalBlocks[left]);
    originalIndex = left + 1;
    revisedIndex = right + 1;
  }
  flushTo(originalBlocks.length, revisedBlocks.length);

  return {
    content: { type: 'doc', content: merged.length ? merged : [{ type: 'paragraph' }] },
    insertions,
    deletions,
  };
}
