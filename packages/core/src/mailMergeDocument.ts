/**
 * Running a merge over a document.
 *
 * Kept apart from `mailMerge.ts` so that file stays about the data and the
 * rules, while this one is about walking document JSON. Both are editor-free:
 * `executeMerge` takes the document as JSON and hands back JSON, which is what
 * lets the unit tests merge a real template without mounting an editor, and what
 * lets Finish & Merge write a `.docx` without going through the canvas.
 */

import {
  DEFAULT_ADDRESS_BLOCK,
  DEFAULT_GREETING_LINE,
  breaksPerRecord,
  compareMergeValues,
  includedRecipients,
  resolveMergeField,
  type FieldMapping,
  type MergeContext,
  type MergeDataSource,
  type MergeFieldAttrs,
  type MergeRecipient,
  type MergeType,
} from './mailMerge';

/** The node shape this module reads. Deliberately loose: it walks any document. */
export interface DocNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export const MERGE_FIELD_NODE = 'mergeField';

/** Read a merge-field node's attributes back into their typed shape. */
export function mergeFieldAttrsOf(node: DocNode): MergeFieldAttrs {
  const attrs = (node.attrs ?? {}) as Record<string, unknown>;
  return {
    kind: (attrs.kind as MergeFieldAttrs['kind']) ?? 'field',
    field: typeof attrs.field === 'string' ? attrs.field : undefined,
    rule: attrs.rule as MergeFieldAttrs['rule'],
    name: typeof attrs.name === 'string' ? attrs.name : undefined,
    prompt: typeof attrs.prompt === 'string' ? attrs.prompt : undefined,
    defaultText: typeof attrs.defaultText === 'string' ? attrs.defaultText : undefined,
    compareField: typeof attrs.compareField === 'string' ? attrs.compareField : undefined,
    comparison: attrs.comparison as MergeFieldAttrs['comparison'],
    compareTo: typeof attrs.compareTo === 'string' ? attrs.compareTo : undefined,
    trueText: typeof attrs.trueText === 'string' ? attrs.trueText : undefined,
    falseText: typeof attrs.falseText === 'string' ? attrs.falseText : undefined,
    addressOptions:
      (attrs.addressOptions as MergeFieldAttrs['addressOptions']) ?? DEFAULT_ADDRESS_BLOCK,
    greetingOptions:
      (attrs.greetingOptions as MergeFieldAttrs['greetingOptions']) ?? DEFAULT_GREETING_LINE,
  };
}

/** Every merge field in the document, in document order. */
export function collectMergeFields(doc: unknown): MergeFieldAttrs[] {
  const found: MergeFieldAttrs[] = [];
  const walk = (node: DocNode | null | undefined) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === MERGE_FIELD_NODE) found.push(mergeFieldAttrsOf(node));
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc as DocNode);
  return found;
}

/** The data-column names the document references, for Check for Errors. */
export function mergeFieldNames(doc: unknown): string[] {
  return collectMergeFields(doc)
    .filter((attrs) => attrs.kind === 'field' && attrs.field)
    .map((attrs) => attrs.field as string);
}

/** Whether the document uses the two composite blocks, for Check for Errors. */
export function usesCompositeFields(doc: unknown): {
  addressBlock: boolean;
  greetingLine: boolean;
} {
  const fields = collectMergeFields(doc);
  return {
    addressBlock: fields.some((attrs) => attrs.kind === 'addressBlock'),
    greetingLine: fields.some((attrs) => attrs.kind === 'greetingLine'),
  };
}

/** Rule fields that need an answer from the user before the merge can run. */
export function collectMergePrompts(doc: unknown): Array<{
  rule: 'ask' | 'fillIn';
  key: string;
  prompt: string;
  defaultText: string;
}> {
  const prompts: Array<{ rule: 'ask' | 'fillIn'; key: string; prompt: string; defaultText: string }> =
    [];
  const seen = new Set<string>();

  for (const attrs of collectMergeFields(doc)) {
    if (attrs.kind !== 'rule') continue;
    if (attrs.rule !== 'ask' && attrs.rule !== 'fillIn') continue;
    // Ask stores under its bookmark name; Fill-in has no bookmark, so its
    // prompt text is the key - two identically worded
    // Fill-ins are asked once.
    const key = attrs.rule === 'ask' ? (attrs.name ?? '') : (attrs.prompt ?? '');
    if (!key || seen.has(`${attrs.rule}:${key}`)) continue;
    seen.add(`${attrs.rule}:${key}`);
    prompts.push({
      rule: attrs.rule,
      key,
      prompt: attrs.prompt || `Enter a value for ${key}`,
      defaultText: attrs.defaultText ?? '',
    });
  }
  return prompts;
}

/* ------------------------------------------------------------------ *
 * Resolving one copy
 * ------------------------------------------------------------------ */

/** Text with newlines becomes runs separated by hard breaks. */
function textNodes(value: string, marks?: DocNode['marks']): DocNode[] {
  const lines = value.split('\n');
  const out: DocNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) out.push({ type: 'hardBreak' });
    if (line) out.push(marks?.length ? { type: 'text', text: line, marks } : { type: 'text', text: line });
  });
  return out;
}

/**
 * The record pointer for one merged copy.
 *
 * Next Record advances mid-document, which is how one label sheet holds
 * thirty recipients. The cursor therefore has to be shared across the whole
 * walk of a copy rather than fixed at its start.
 */
interface MergeCursor {
  recipients: MergeRecipient[];
  index: number;
  sequenceNumber: number;
  mapping: FieldMapping;
  bookmarks: Record<string, string>;
  answers: Record<string, string>;
  /** Set when a Skip Record If fired, so the caller discards this copy. */
  skipped: boolean;
}

function contextOf(cursor: MergeCursor): MergeContext {
  const recipient = cursor.recipients[cursor.index] ?? null;
  return {
    recipient,
    recordNumber: recipient?.id ?? 0,
    sequenceNumber: cursor.sequenceNumber,
    mapping: cursor.mapping,
    // Fill-in answers are keyed by prompt, Ask answers by bookmark name; both
    // resolve through the same map, so one lookup covers both.
    bookmarks: { ...cursor.answers, ...cursor.bookmarks },
  };
}

/**
 * Apply the steering rules a field carries, then say whether it prints.
 *
 * Returns false for rules that only steer, so the walker drops them from the
 * output instead of leaving an empty text node behind.
 */
function applyRule(attrs: MergeFieldAttrs, cursor: MergeCursor): boolean {
  if (attrs.kind !== 'rule') return true;

  const recipient = cursor.recipients[cursor.index] ?? null;
  const compare = () =>
    compareMergeValues(
      recipient?.values[attrs.compareField ?? ''] ?? '',
      attrs.comparison ?? 'equal',
      attrs.compareTo ?? '',
    );

  switch (attrs.rule) {
    case 'nextRecord':
      cursor.index += 1;
      return false;
    case 'nextRecordIf':
      if (compare()) cursor.index += 1;
      return false;
    case 'skipRecordIf':
      if (compare()) cursor.skipped = true;
      return false;
    case 'setBookmark':
      if (attrs.name) cursor.bookmarks[attrs.name] = attrs.defaultText ?? '';
      return false;
    case 'ask':
      // The answer was collected before the merge; Ask itself prints nothing,
      // as a merge is expected to behave.
      if (attrs.name) {
        cursor.bookmarks[attrs.name] = cursor.answers[attrs.name] ?? attrs.defaultText ?? '';
      }
      return false;
    default:
      return true;
  }
}

/** One copy of the document with every field resolved for the current record. */
function resolveNode(node: DocNode, cursor: MergeCursor): DocNode[] {
  if (node.type === MERGE_FIELD_NODE) {
    const attrs = mergeFieldAttrsOf(node);
    if (!applyRule(attrs, cursor)) return [];
    const value = resolveMergeField(attrs, contextOf(cursor));
    if (!value) return [];
    return textNodes(value, node.marks);
  }

  if (!node.content) return [{ ...node }];

  const content: DocNode[] = [];
  for (const child of node.content) content.push(...resolveNode(child, cursor));

  const resolved: DocNode = { ...node };
  /**
   * A paragraph whose only child was a merge field that resolved to nothing
   * must keep an empty content list rather than a missing one: ProseMirror
   * rejects `content: []` on some node types but a `paragraph` with no content
   * key is fine, while a `tableCell` needs its paragraph. Dropping the key when
   * the list is empty matches how the templates are written.
   */
  if (content.length > 0) resolved.content = content;
  else delete resolved.content;
  return [resolved];
}

/* ------------------------------------------------------------------ *
 * The merge
 * ------------------------------------------------------------------ */

export interface MergeOptions {
  type: MergeType;
  /** 1-based, inclusive, over the ticked recipients. Omit for all of them. */
  from?: number;
  to?: number;
  /** Answers for Ask and Fill-in, keyed as `collectMergePrompts` reports. */
  answers?: Record<string, string>;
}

export interface MergeResult {
  content: { type: 'doc'; content: DocNode[] };
  /** Copies written. */
  merged: number;
  /** Records a Skip Record If rule dropped. */
  skipped: number;
}

/**
 * Merge the document against the ticked recipients.
 *
 * The loop is a cursor rather than a `for` over records because Next Record can
 * consume several rows inside one copy: a label sheet is one copy of the main
 * document holding thirty Next Record rules, and the outer loop must resume
 * after whichever row the sheet reached.
 */
export function executeMerge(
  doc: unknown,
  source: MergeDataSource | null,
  mapping: FieldMapping,
  options: MergeOptions,
): MergeResult {
  const all = includedRecipients(source);
  const from = Math.max(1, options.from ?? 1);
  const to = Math.min(all.length, options.to ?? all.length);
  const recipients = all.slice(from - 1, to);

  const root = doc as DocNode;
  const blocks = root?.content ?? [];
  const out: DocNode[] = [];
  let merged = 0;
  let skipped = 0;

  const cursor: MergeCursor = {
    recipients,
    index: 0,
    sequenceNumber: 0,
    mapping,
    bookmarks: {},
    answers: options.answers ?? {},
    skipped: false,
  };

  // No recipients still produces the document once, with fields blank. That is
  // the expected behaviour, and it beats handing back an empty file.
  if (recipients.length === 0) {
    const copy: DocNode[] = [];
    cursor.sequenceNumber = 1;
    for (const block of blocks) copy.push(...resolveNode(block, cursor));
    return { content: { type: 'doc', content: copy }, merged: 0, skipped: 0 };
  }

  while (cursor.index < recipients.length) {
    cursor.skipped = false;
    cursor.bookmarks = {};
    cursor.sequenceNumber = merged + 1;

    const copy: DocNode[] = [];
    for (const block of blocks) copy.push(...resolveNode(block, cursor));

    /**
     * Step past the last record this copy consumed.
     *
     * Unconditional, and that is the whole subtlety. `cursor.index` now points
     * at the record the copy *finished on*, not at the one after it, so a label
     * sheet whose last Next Record landed on row 2 must resume at row 3. Only
     * forcing this when no Next Record fired - the obvious guard - reused the
     * final record of every sheet as the first of the next one, which silently
     * duplicated one label per sheet and dropped one recipient off the end.
     */
    cursor.index += 1;

    if (cursor.skipped) {
      skipped += 1;
      continue;
    }

    if (merged > 0 && breaksPerRecord(options.type)) out.push({ type: 'pageBreak' });
    out.push(...copy);
    merged += 1;
  }

  return { content: { type: 'doc', content: out }, merged, skipped };
}

/* ------------------------------------------------------------------ *
 * Building label and envelope main documents
 * ------------------------------------------------------------------ */

const addressBlockField = (): DocNode => ({
  type: MERGE_FIELD_NODE,
  attrs: { kind: 'addressBlock', addressOptions: DEFAULT_ADDRESS_BLOCK },
});

const nextRecordField = (): DocNode => ({
  type: MERGE_FIELD_NODE,
  attrs: { kind: 'rule', rule: 'nextRecord' },
});

/**
 * The label sheet Update Labels produces: an address block in the first
 * cell, and every later cell preceded by a Next Record rule so one sheet walks
 * the list.
 */
export function buildLabelSheet(columns: number, rows: number): DocNode {
  const cell = (first: boolean): DocNode => ({
    type: 'tableCell',
    content: [
      {
        type: 'paragraph',
        content: first ? [addressBlockField()] : [nextRecordField(), addressBlockField()],
      },
    ],
  });

  const tableRows: DocNode[] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    const cells: DocNode[] = [];
    for (let column = 0; column < columns; column += 1) {
      cells.push(cell(index === 0));
      index += 1;
    }
    tableRows.push({ type: 'tableRow', content: cells });
  }
  return { type: 'table', content: tableRows };
}

/** The envelope main document: a return address block and a delivery address. */
export function buildEnvelopeDocument(returnAddress: string, deliveryAddress: string): DocNode[] {
  const lines = (value: string): DocNode[] =>
    value
      .split('\n')
      .map((line) => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) }));

  return [
    ...lines(returnAddress || ''),
    { type: 'paragraph' },
    { type: 'paragraph' },
    { type: 'paragraph' },
    ...(deliveryAddress
      ? lines(deliveryAddress)
      : [{ type: 'paragraph', content: [addressBlockField()] }]),
  ];
}
