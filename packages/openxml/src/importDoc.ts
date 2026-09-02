type TipTapNode = {
  type?: string;
  text?: string;
  content?: TipTapNode[];
};

/** Convert plain text from legacy .doc extraction into TipTap JSON. */
export function importFromDocText(body: string): TipTapNode {
  const normalized = body.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  // Prefer paragraph breaks on blank lines; fall back to single line breaks.
  const chunks = normalized.includes('\n\n')
    ? normalized.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    : normalized.split(/\n/).map((p) => p.trim()).filter(Boolean);

  return {
    type: 'doc',
    content: chunks.map((para) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para.replace(/\n/g, ' ') }],
    })),
  };
}
