export type TipTapNode = {
  type?: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};

type Mark = { type: string; attrs?: Record<string, unknown> };

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'DIV']);

function getDomParser(): DOMParser {
  const Ctor = (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
  if (!Ctor) {
    throw new Error('HTML import requires a DOM environment (DOMParser is unavailable).');
  }
  return new Ctor();
}

function styleMarks(el: HTMLElement): Mark[] {
  const textStyle: Record<string, unknown> = {};
  if (el.style.color) textStyle.color = el.style.color;
  if (el.style.fontFamily) textStyle.fontFamily = el.style.fontFamily.replace(/["']/g, '');
  if (el.style.fontSize) textStyle.fontSize = el.style.fontSize;
  return Object.keys(textStyle).length ? [{ type: 'textStyle', attrs: textStyle }] : [];
}

function blockAttrs(el: HTMLElement): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (el.style.textAlign) attrs.textAlign = el.style.textAlign;
  if (el.style.marginLeft) {
    const margin = parseFloat(el.style.marginLeft);
    if (Number.isFinite(margin) && margin > 0) attrs.indentLevel = Math.max(1, Math.round(margin / 36));
  }
  if (el.style.lineHeight) attrs.lineHeight = el.style.lineHeight;
  if (el.style.marginTop) attrs.spaceBefore = parseFloat(el.style.marginTop);
  if (el.style.marginBottom) attrs.spaceAfter = parseFloat(el.style.marginBottom);
  if (el.style.borderLeftColor) attrs.borderColor = el.style.borderLeftColor;
  if (el.style.backgroundColor) attrs.shading = el.style.backgroundColor;
  return attrs;
}

/** Inline content of an element, carrying marks down the tree. */
function inlineOf(node: Node, marks: Mark[]): TipTapNode[] {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const text = node.textContent ?? '';
    if (!text) return [];
    return [{ type: 'text', text, marks: marks.length ? [...marks] : undefined }];
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return [];

  const el = node as HTMLElement;
  const tag = el.tagName;

  if (tag === 'BR') return [{ type: 'hardBreak' }];

  /**
   * A mail-merge field, restored from the configuration the exporter stashed on
   * the element.
   *
   * Without this the span fell through to the generic branch below, which reads
   * an element's *text* - so opening an exported `.html` turned every field into
   * the literal characters «FirstName», and the next merge did nothing. A
   * corrupt or truncated attribute degrades to a plain field named by the
   * `data-merge-field` value rather than failing the whole import.
   */
  if (el.hasAttribute('data-merge-field')) {
    const field = el.getAttribute('data-merge-field') ?? '';
    let config: Record<string, unknown> = {};
    try {
      const raw = el.getAttribute('data-merge-config');
      if (raw) config = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      config = {};
    }
    return [{ type: 'mergeField', attrs: { kind: 'field', ...config, field: config.field ?? field } }];
  }

  if (tag === 'IMG') {
    const src = el.getAttribute('src');
    if (!src) return [];
    const attrs: Record<string, unknown> = { src, alt: el.getAttribute('alt') ?? '' };
    const width = Number(el.getAttribute('width') ?? parseFloat(el.style.width));
    const height = Number(el.getAttribute('height') ?? parseFloat(el.style.height));
    if (Number.isFinite(width) && width > 0) attrs.width = Math.round(width);
    if (Number.isFinite(height) && height > 0) attrs.height = Math.round(height);
    return [{ type: 'image', attrs }];
  }

  const next = [...marks, ...styleMarks(el)];
  if (tag === 'STRONG' || tag === 'B') next.push({ type: 'bold' });
  if (tag === 'EM' || tag === 'I') next.push({ type: 'italic' });
  if (tag === 'U' || tag === 'INS') next.push({ type: 'underline' });
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') next.push({ type: 'strike' });
  if (tag === 'SUP') next.push({ type: 'superscript' });
  if (tag === 'SUB') next.push({ type: 'subscript' });
  if (tag === 'CODE') next.push({ type: 'code' });
  if (tag === 'MARK') {
    next.push({ type: 'highlight', attrs: { color: el.style.backgroundColor || '#fef08a' } });
  }
  if (tag === 'A') {
    const href = el.getAttribute('href');
    if (href) next.push({ type: 'link', attrs: { href } });
  }

  return Array.from(el.childNodes).flatMap((c) => inlineOf(c, next));
}

function listOf(el: HTMLElement): TipTapNode {
  const items: TipTapNode[] = [];
  for (const li of Array.from(el.children)) {
    if (li.tagName !== 'LI') continue;
    const item = li as HTMLElement;
    const content: TipTapNode[] = [];

    // Split direct inline content from nested lists so both survive.
    const inlineNodes: Node[] = [];
    for (const node of Array.from(item.childNodes)) {
      const childEl = node as HTMLElement;
      if (node.nodeType === 1 && (childEl.tagName === 'UL' || childEl.tagName === 'OL')) {
        if (inlineNodes.length) {
          content.push({
            type: 'paragraph',
            content: inlineNodes.flatMap((n) => inlineOf(n, [])),
          });
          inlineNodes.length = 0;
        }
        content.push(listOf(childEl));
      } else {
        inlineNodes.push(node);
      }
    }
    if (inlineNodes.length) {
      const inline = inlineNodes.flatMap((n) => inlineOf(n, []));
      content.push({ type: 'paragraph', content: inline.length ? inline : undefined });
    }
    if (!content.length) content.push({ type: 'paragraph' });
    items.push({ type: 'listItem', content });
  }
  return { type: el.tagName === 'OL' ? 'orderedList' : 'bulletList', content: items };
}

function tableOf(el: HTMLElement): TipTapNode {
  const rows: TipTapNode[] = [];
  const trs = el.querySelectorAll('tr');
  for (const tr of Array.from(trs)) {
    const cells: TipTapNode[] = [];
    for (const cell of Array.from(tr.children)) {
      if (cell.tagName !== 'TD' && cell.tagName !== 'TH') continue;
      const cellEl = cell as HTMLElement;
      const attrs: Record<string, unknown> = {};
      const colspan = Number(cellEl.getAttribute('colspan') ?? 1);
      const rowspan = Number(cellEl.getAttribute('rowspan') ?? 1);
      if (colspan > 1) attrs.colspan = colspan;
      if (rowspan > 1) attrs.rowspan = rowspan;
      if (cellEl.style.backgroundColor) attrs.backgroundColor = cellEl.style.backgroundColor;

      const content = blocksOf(cellEl);
      cells.push({
        type: cell.tagName === 'TH' ? 'tableHeader' : 'tableCell',
        attrs,
        content: content.length ? content : [{ type: 'paragraph' }],
      });
    }
    if (cells.length) rows.push({ type: 'tableRow', content: cells });
  }
  return { type: 'table', content: rows };
}

function blocksOf(parent: HTMLElement): TipTapNode[] {
  const out: TipTapNode[] = [];
  let pendingInline: Node[] = [];

  const flushInline = () => {
    if (!pendingInline.length) return;
    const inline = pendingInline.flatMap((n) => inlineOf(n, []));
    pendingInline = [];
    if (inline.some((n) => n.type !== 'text' || (n.text ?? '').trim())) {
      out.push({ type: 'paragraph', content: inline });
    }
  };

  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType !== 1) {
      pendingInline.push(node);
      continue;
    }
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === 'UL' || tag === 'OL') {
      flushInline();
      out.push(listOf(el));
      continue;
    }
    if (tag === 'TABLE') {
      flushInline();
      out.push(tableOf(el));
      continue;
    }
    if (tag === 'HR') {
      flushInline();
      out.push({ type: 'horizontalRule' });
      continue;
    }
    if (tag === 'SCRIPT' || tag === 'STYLE') continue;

    if (el.hasAttribute('data-page-break')) {
      flushInline();
      out.push({ type: 'pageBreak' });
      continue;
    }

    if (el.hasAttribute('data-column-break')) {
      flushInline();
      out.push({ type: 'columnBreak' });
      continue;
    }

    if (BLOCK_TAGS.has(tag)) {
      flushInline();
      const attrs = blockAttrs(el);

      if (tag === 'DIV') {
        // A plain wrapper: descend rather than flattening its children away.
        out.push(...blocksOf(el));
        continue;
      }
      if (tag === 'PRE') {
        out.push({ type: 'codeBlock', content: [{ type: 'text', text: el.textContent ?? '' }] });
        continue;
      }
      if (tag === 'BLOCKQUOTE') {
        const inner = blocksOf(el);
        out.push({ type: 'blockquote', content: inner.length ? inner : [{ type: 'paragraph' }] });
        continue;
      }

      const inline = inlineOf(el, []).flat();
      if (/^H[1-6]$/.test(tag)) {
        out.push({
          type: 'heading',
          attrs: { ...attrs, level: Math.min(Number(tag[1]), 3) },
          content: inline.length ? inline : undefined,
        });
      } else {
        out.push({ type: 'paragraph', attrs, content: inline.length ? inline : undefined });
      }
      continue;
    }

    pendingInline.push(node);
  }

  flushInline();
  return out;
}

/**
 * Parse an HTML document into the editor's model.
 *
 * `exportToHtml` has existed since the start and the project site advertises
 * "Open & save DOCX, RTF, HTML, TXT", but there was no import path at all -
 * opening a .html file hit the "Unsupported file type" branch.
 */
export function importFromHtml(html: string): TipTapNode {
  const doc = getDomParser().parseFromString(html, 'text/html');
  const content = blocksOf(doc.body);
  if (!content.length) content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}
