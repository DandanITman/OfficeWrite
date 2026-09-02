import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  HeadingLevel,
  AlignmentType,
  UnderlineType,
  Table,
  TableRow,
  HeightRule,
  TableCell,
  WidthType,
  ImageRun,
  FootnoteReferenceRun,
  PageBreak,
  ColumnBreak,
  PageOrientation,
  BorderStyle,
  ShadingType,
  HighlightColor,
  Header,
  Footer,
  PageNumber,
  Tab,
  TabStopType,
  TabStopPosition,
  LevelFormat,
  InsertedTextRun,
  DeletedTextRun,
  CommentRangeStart,
  CommentRangeEnd,
  CommentReference,
  type ICommentOptions,
  type ISectionPropertiesOptions,
  type ParagraphChild,
} from 'docx';
import type {
  DocumentComment,
  DocumentFootnote,
  DocumentStyle,
  HeaderFooter,
  HeaderFooterZones,
  PageSetup,
  Watermark,
} from '@officewrite/core';
import { PAGE_DIMENSIONS, footerZonesOf, headerZonesOf, zonesEmpty, mergeFieldLabel } from '@officewrite/core';
import type { MergeFieldAttrs } from '@officewrite/core';

type TipTapNode = {
  type?: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};

export interface DocxExportOptions {
  title?: string;
  pageSetup?: PageSetup;
  headerFooter?: HeaderFooter;
  footnotes?: DocumentFootnote[];
  watermark?: Watermark;
  customStyles?: DocumentStyle[];
  /** Review comments, anchored by the `commentAnchor` mark in the content. */
  comments?: DocumentComment[];
}

const BULLET_REFERENCE = 'officewrite-bullet';
const ORDERED_REFERENCE = 'officewrite-ordered';
const MAX_LIST_DEPTH = 5;

function pxToDxa(px: number) {
  return Math.round(px * 15);
}

function hex(color: unknown): string | undefined {
  const raw = String(color ?? '').trim();
  if (!raw) return undefined;
  const match = raw.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!match) return undefined;
  const value = match[1];
  return (value.length === 3 ? value.replace(/./g, (c) => c + c) : value).toUpperCase();
}

/**
 * Word's highlight attribute only accepts a fixed palette. Map the swatches the
 * app offers onto it and fall back to run shading for anything else, so the
 * chosen colour survives instead of every highlight exporting as yellow.
 */
const HIGHLIGHT_BY_HEX: Record<string, (typeof HighlightColor)[keyof typeof HighlightColor]> = {
  FFFF00: HighlightColor.YELLOW,
  FEF08A: HighlightColor.YELLOW,
  '00FF00': HighlightColor.GREEN,
  BBF7D0: HighlightColor.GREEN,
  '00FFFF': HighlightColor.CYAN,
  A5F3FC: HighlightColor.CYAN,
  FF00FF: HighlightColor.MAGENTA,
  F5D0FE: HighlightColor.MAGENTA,
  '0000FF': HighlightColor.BLUE,
  BFDBFE: HighlightColor.BLUE,
  FF0000: HighlightColor.RED,
  FECACA: HighlightColor.RED,
  C0C0C0: HighlightColor.LIGHT_GRAY,
  E5E7EB: HighlightColor.LIGHT_GRAY,
  808080: HighlightColor.DARK_GRAY,
};

function decodeBase64Image(src: string): { data: Uint8Array; type: 'png' | 'jpg' | 'gif' } | null {
  const match = src.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i);
  if (!match) return null;
  const binary = atob(match[2]);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
  const type = match[1].toLowerCase();
  if (type === 'jpeg' || type === 'jpg') return { data, type: 'jpg' };
  if (type === 'gif') return { data, type: 'gif' };
  return { data, type: 'png' };
}

function shapeSvgData(attrs: Record<string, unknown>): Uint8Array {
  const shapeType = String(attrs.shapeType ?? 'rect');
  const width = Number(attrs.width ?? 160);
  const height = Number(attrs.height ?? 100);
  const fill = String(attrs.fill ?? '#3b82f6');
  const stroke = String(attrs.stroke ?? '#1e40af');
  const sw = Number(attrs.strokeWidth ?? 2);
  let body = '';
  switch (shapeType) {
    case 'circle':
      body = `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2 - sw}" ry="${height / 2 - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      break;
    case 'line':
      body = `<line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="${stroke}" stroke-width="${sw + 1}"/>`;
      break;
    case 'arrow':
      body = `<line x1="8" y1="${height / 2}" x2="${width - 16}" y2="${height / 2}" stroke="${stroke}" stroke-width="${sw + 1}"/><polygon points="${width - 16},${height / 2 - 10} ${width},${height / 2} ${width - 16},${height / 2 + 10}" fill="${stroke}"/>`;
      break;
    default:
      body = `<rect x="${sw / 2}" y="${sw / 2}" width="${width - sw}" height="${height - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="4"/>`;
  }
  // Carry the shape's own attributes on the root element so reopening the file
  // restores an editable shape rather than a flat picture.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` data-officewrite-shape="${shapeType}" data-fill="${fill}" data-stroke="${stroke}"` +
    ` data-stroke-width="${sw}">${body}</svg>`;
  return new TextEncoder().encode(svg);
}

function buildFootnoteIndex(footnotes: DocumentFootnote[]) {
  const idToNumber = new Map<string, number>();
  const docxFootnotes: Record<string, { children: Paragraph[] }> = {};
  footnotes.forEach((fn, i) => {
    const num = i + 1;
    idToNumber.set(fn.id, num);
    docxFootnotes[String(num)] = {
      children: [new Paragraph({ children: [new TextRun(fn.text)] })],
    };
  });
  return { idToNumber, docxFootnotes };
}

function headingLevel(level: number) {
  switch (level) {
    case 1:
      return HeadingLevel.HEADING_1;
    case 2:
      return HeadingLevel.HEADING_2;
    case 3:
      return HeadingLevel.HEADING_3;
    default:
      return HeadingLevel.HEADING_4;
  }
}

function runOptionsFromMarks(marks: TipTapNode['marks']): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        options.bold = true;
        break;
      case 'italic':
        options.italics = true;
        break;
      case 'underline':
        options.underline = { type: UnderlineType.SINGLE };
        break;
      case 'strike':
        options.strike = true;
        break;
      case 'code':
        options.font = 'Consolas';
        break;
      case 'textStyle': {
        const color = hex(mark.attrs?.color);
        if (color) options.color = color;
        if (mark.attrs?.fontFamily) options.font = String(mark.attrs.fontFamily);
        if (mark.attrs?.fontSize) {
          const size = parseFloat(String(mark.attrs.fontSize));
          // docx sizes are half-points.
          if (!Number.isNaN(size)) options.size = Math.round(size * 2);
        }
        break;
      }
      case 'highlight': {
        const fill = hex(mark.attrs?.color) ?? 'FFFF00';
        const named = HIGHLIGHT_BY_HEX[fill];
        if (named) options.highlight = named;
        else options.shading = { type: ShadingType.CLEAR, fill };
        break;
      }
      case 'superscript':
        options.superScript = true;
        break;
      case 'subscript':
        options.subScript = true;
        break;
    }
  }
  return options;
}

/** Stable numeric ids for comments, which OOXML requires. */
type CommentIndex = Map<string, number>;

/**
 * Inline children of a block.
 *
 * Hyperlinks become real `ExternalHyperlink` runs, tracked changes become real
 * `w:ins`/`w:del` revisions, and comment anchors open and close real comment
 * ranges - so a document reviewed in Officewrite arrives in Word with its links,
 * pending changes and comments intact. All three used to be dropped silently.
 */
function inlineChildren(
  node: TipTapNode,
  idToNumber: Map<string, number>,
  commentIds: CommentIndex = new Map(),
): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  // Comment ranges opened in this block, closed when the anchor run ends.
  const openComments = new Set<number>();

  const closeComments = () => {
    for (const id of openComments) {
      out.push(new CommentRangeEnd(id));
      out.push(new CommentReference(id));
    }
    openComments.clear();
  };

  for (const child of node.content ?? []) {
    if (child.type === 'hardBreak') {
      closeComments();
      out.push(new TextRun({ break: 1 }));
      continue;
    }
    if (child.type === 'image') {
      closeComments();
      const run = imageRun(child);
      if (run) out.push(run);
      continue;
    }
    /**
     * A mail-merge field exports as its own «FieldName» text.
     *
     * Without this branch the guard below dropped it entirely, because a merge
     * field is an inline atom with no `.text` - so saving a merge main document
     * as .docx silently lost every field in it. Word writes these as real MERGE
     * fields; the visible text is what it shows, and it is legible rather than
     * corrupt anywhere that has never heard of a merge.
     */
    if (child.type === 'mergeField') {
      closeComments();
      out.push(
        new TextRun({
          text: mergeFieldLabel(child.attrs as unknown as MergeFieldAttrs),
          ...runOptionsFromMarks(child.marks ?? []),
        }),
      );
      continue;
    }
    if (child.type !== 'text' || !child.text) continue;

    const marks = child.marks ?? [];

    const footnote = marks.find((m) => m.type === 'footnoteRef');
    if (footnote) {
      closeComments();
      const id = String(footnote.attrs?.id ?? '');
      const num = idToNumber.get(id) ?? Number(footnote.attrs?.number ?? 1);
      out.push(new FootnoteReferenceRun(num));
      continue;
    }

    // Open a comment range when the anchor mark starts, close it when it ends,
    // so a reviewer sees the comment attached to the same words in Word.
    const anchor = marks.find((m) => m.type === 'commentAnchor');
    const anchorNumber = anchor ? commentIds.get(String(anchor.attrs?.commentId ?? '')) : undefined;
    if (anchorNumber !== undefined && !openComments.has(anchorNumber)) {
      closeComments();
      out.push(new CommentRangeStart(anchorNumber));
      openComments.add(anchorNumber);
    } else if (anchorNumber === undefined) {
      closeComments();
    }

    const options = runOptionsFromMarks(marks);
    const link = marks.find((m) => m.type === 'link');
    const insertion = marks.find((m) => m.type === 'trackInsert');
    const deletion = marks.find((m) => m.type === 'trackDelete');

    // Tracked changes become real revisions so Word shows them in its own
    // review pane and its Accept/Reject applies to them.
    let run: ParagraphChild;
    if (deletion) {
      run = new DeletedTextRun({
        ...options,
        text: child.text,
        id: out.length + 1,
        author: String(deletion.attrs?.author ?? 'Unknown'),
        date: String(deletion.attrs?.at ?? new Date().toISOString()),
      } as ConstructorParameters<typeof DeletedTextRun>[0]);
    } else if (insertion) {
      run = new InsertedTextRun({
        ...options,
        text: child.text,
        id: out.length + 1,
        author: String(insertion.attrs?.author ?? 'Unknown'),
        date: String(insertion.attrs?.at ?? new Date().toISOString()),
      } as ConstructorParameters<typeof InsertedTextRun>[0]);
    } else {
      run = new TextRun({
        ...options,
        text: child.text,
      } as ConstructorParameters<typeof TextRun>[0]);
    }

    if (link?.attrs?.href && !deletion && !insertion) {
      out.push(
        new ExternalHyperlink({ children: [run as TextRun], link: String(link.attrs.href) }),
      );
    } else {
      out.push(run);
    }
  }

  closeComments();
  return out;
}

/** Build the `word/comments.xml` payload and the anchor-id lookup. */
function buildCommentIndex(comments: DocumentComment[] | undefined) {
  const commentIds: CommentIndex = new Map();
  const docxComments: ICommentOptions[] = [];

  (comments ?? []).forEach((comment, i) => {
    commentIds.set(comment.id, i);
    docxComments.push({
      id: i,
      author: comment.author || 'Unknown',
      date: new Date(comment.created),
      children: [new Paragraph({ children: [new TextRun(comment.text)] })],
    });
  });

  return { commentIds, docxComments };
}

function paragraphFormattingOptions(attrs: Record<string, unknown> = {}) {
  const options: Record<string, unknown> = {};
  const indentLevel = Number(attrs.indentLevel ?? 0);
  if (indentLevel > 0) {
    options.indent = { left: pxToDxa(indentLevel * 36) };
  }
  if (attrs.lineHeight || attrs.spaceBefore || attrs.spaceAfter) {
    options.spacing = {
      ...(attrs.spaceBefore ? { before: pxToDxa(Number(attrs.spaceBefore)) } : {}),
      ...(attrs.spaceAfter ? { after: pxToDxa(Number(attrs.spaceAfter)) } : {}),
      ...(attrs.lineHeight ? { line: Math.round(Number(attrs.lineHeight) * 240) } : {}),
    };
  }
  const borderColor = hex(attrs.borderColor);
  if (borderColor) {
    options.border = {
      left: { style: BorderStyle.SINGLE, color: borderColor, size: 8 },
    };
  }
  const shading = hex(attrs.shading);
  if (shading) {
    options.shading = { type: ShadingType.CLEAR, fill: shading };
  }
  return options;
}

function alignmentOf(attrs: Record<string, unknown> = {}) {
  switch (attrs.textAlign) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return undefined;
  }
}

function paragraphFromNode(
  node: TipTapNode,
  idToNumber: Map<string, number>,
  extra: Record<string, unknown> = {},
  commentIds: CommentIndex = new Map(),
): Paragraph {
  const children = inlineChildren(node, idToNumber, commentIds);
  const attrs = node.attrs ?? {};
  return new Paragraph({
    ...paragraphFormattingOptions(attrs),
    alignment: alignmentOf(attrs),
    ...extra,
    children: children.length ? children : [new TextRun('')],
  } as ConstructorParameters<typeof Paragraph>[0]);
}

function imageRun(node: TipTapNode): ImageRun | null {
  const src = String(node.attrs?.src ?? '');
  const decoded = decodeBase64Image(src);
  if (!decoded) return null;

  const width = Number(node.attrs?.width ?? 320);
  const rawHeight = Number(node.attrs?.height);
  // Use the real height when the document has one. Previously this was always
  // `width * 0.75`, which distorted every non-4:3 image on export.
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : Math.round(width * 0.75);

  return new ImageRun({
    type: decoded.type,
    data: decoded.data,
    transformation: { width, height },
  });
}

function imageParagraph(node: TipTapNode): Paragraph | null {
  const run = imageRun(node);
  if (!run) return null;
  return new Paragraph({
    alignment:
      node.attrs?.align === 'center'
        ? AlignmentType.CENTER
        : node.attrs?.align === 'right'
          ? AlignmentType.RIGHT
          : AlignmentType.LEFT,
    children: [run],
  });
}

function shapeParagraph(node: TipTapNode): Paragraph {
  const width = Number(node.attrs?.width ?? 160);
  const height = Number(node.attrs?.height ?? 100);
  const svg = shapeSvgData(node.attrs ?? {});
  const fallbackPng = decodeBase64Image(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  )!;
  return new Paragraph({
    children: [
      new ImageRun({
        type: 'svg',
        data: svg,
        fallback: { type: fallbackPng.type, data: fallbackPng.data },
        transformation: { width, height },
      }),
    ],
  });
}

/**
 * Flatten a list into numbered paragraphs.
 *
 * Both list types used to collapse to `bullet: { level: 0 }`, so ordered lists
 * exported as bullets, nesting was lost, and list text was rebuilt by joining
 * raw `.text` - dropping every inline mark inside a list item.
 */
function listBlocks(
  node: TipTapNode,
  idToNumber: Map<string, number>,
  depth: number,
  commentIds: CommentIndex = new Map(),
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];
  const ordered = node.type === 'orderedList';
  const level = Math.min(depth, MAX_LIST_DEPTH - 1);

  for (const item of node.content ?? []) {
    for (const inner of item.content ?? []) {
      if (inner.type === 'bulletList' || inner.type === 'orderedList') {
        blocks.push(...listBlocks(inner, idToNumber, depth + 1, commentIds));
        continue;
      }
      if (inner.type === 'paragraph' || inner.type === 'heading') {
        blocks.push(
          paragraphFromNode(
            inner,
            idToNumber,
            { numbering: { reference: ordered ? ORDERED_REFERENCE : BULLET_REFERENCE, level } },
            commentIds,
          ),
        );
        continue;
      }
      blocks.push(...blocksFromNodes([inner], idToNumber, depth, commentIds));
    }
  }

  return blocks;
}

/**
 * A checklist. Nested task lists indent like any other list, and a checked item
 * exports as a filled box so the state survives the round trip through Word.
 */
function taskListBlocks(
  node: TipTapNode,
  idToNumber: Map<string, number>,
  depth: number,
  commentIds: CommentIndex = new Map(),
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];

  for (const item of node.content ?? []) {
    const box = item.attrs?.checked ? '☒ ' : '☐ ';
    let marked = false;

    for (const inner of item.content ?? []) {
      if (inner.type === 'taskList') {
        blocks.push(...taskListBlocks(inner, idToNumber, depth + 1, commentIds));
        continue;
      }
      if (inner.type === 'paragraph' || inner.type === 'heading') {
        // The box belongs on the item's first line only, not on a wrapped
        // second paragraph inside the same item.
        const prefixed = marked
          ? inner
          : { ...inner, content: [{ type: 'text', text: box }, ...(inner.content ?? [])] };
        marked = true;
        blocks.push(
          paragraphFromNode(
            prefixed,
            idToNumber,
            { indent: { left: pxToDxa(24 + depth * 24) } },
            commentIds,
          ),
        );
        continue;
      }
      blocks.push(...blocksFromNodes([inner], idToNumber, depth, commentIds));
    }
  }

  return blocks;
}

function tableBlock(
  node: TipTapNode,
  idToNumber: Map<string, number>,
  commentIds: CommentIndex = new Map(),
): Table {
  const rows: TableRow[] = [];

  for (const rowNode of node.content ?? []) {
    const cells: TableCell[] = [];
    let isHeaderRow = false;

    for (const cellNode of rowNode.content ?? []) {
      if (cellNode.type === 'tableHeader') isHeaderRow = true;
      const attrs = cellNode.attrs ?? {};

      // Cells may hold lists, images and nested tables - not just paragraphs.
      const cellChildren = blocksFromNodes(cellNode.content ?? [], idToNumber, 0, commentIds);
      const shading = hex(attrs.backgroundColor);
      const colwidth = Array.isArray(attrs.colwidth) ? Number(attrs.colwidth[0]) : undefined;

      cells.push(
        new TableCell({
          children: cellChildren.length ? cellChildren : [new Paragraph('')],
          columnSpan: Number(attrs.colspan ?? 1) > 1 ? Number(attrs.colspan) : undefined,
          rowSpan: Number(attrs.rowspan ?? 1) > 1 ? Number(attrs.rowspan) : undefined,
          ...(colwidth && Number.isFinite(colwidth)
            ? { width: { size: pxToDxa(colwidth), type: WidthType.DXA } }
            : {}),
          ...(shading ? { shading: { type: ShadingType.CLEAR, fill: shading } } : {}),
        }),
      );
    }

    // A dragged row height is "at least this tall", which is Word's ATLEAST
    // rule - EXACT would clip text that no longer fits.
    const rowHeight = Number(rowNode.attrs?.height);
    rows.push(
      new TableRow({
        children: cells,
        tableHeader: isHeaderRow || undefined,
        ...(Number.isFinite(rowHeight) && rowHeight > 0
          ? { height: { value: pxToDxa(rowHeight), rule: HeightRule.ATLEAST } }
          : {}),
      }),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: tableColumnWidths(node),
    rows,
  });
}

/** US Letter less one-inch margins, in twips - the width a table spans by default. */
const TEXT_WIDTH_DXA = 9360;

/**
 * The column widths for `w:tblGrid`.
 *
 * Word lays a table out from its grid, so the grid has to carry the real
 * widths. Left to itself `docx` wrote every column as 100 twips - about
 * 0.07in - which threw away any column the user had resized.
 */
function tableColumnWidths(node: TipTapNode): number[] {
  const widths: number[] = [];

  for (const cell of node.content?.[0]?.content ?? []) {
    const span = Math.max(1, Number(cell.attrs?.colspan ?? 1));
    const declared = Array.isArray(cell.attrs?.colwidth) ? cell.attrs.colwidth : undefined;
    for (let index = 0; index < span; index += 1) {
      const px = Number(declared?.[index]);
      // 0 marks "not set yet" so the leftover space can be shared out below.
      widths.push(Number.isFinite(px) && px > 0 ? pxToDxa(px) : 0);
    }
  }

  const unset = widths.filter((width) => width === 0).length;
  if (!unset) return widths;

  const claimed = widths.reduce((total, width) => total + width, 0);
  const share = Math.max(1, Math.round((TEXT_WIDTH_DXA - claimed) / unset));
  return widths.map((width) => width || share);
}

function blocksFromNodes(
  nodes: TipTapNode[],
  idToNumber: Map<string, number>,
  depth = 0,
  commentIds: CommentIndex = new Map(),
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        blocks.push(paragraphFromNode(node, idToNumber, {}, commentIds));
        break;

      case 'heading':
        blocks.push(
          paragraphFromNode(
            node,
            idToNumber,
            { heading: headingLevel(Number(node.attrs?.level ?? 1)) },
            commentIds,
          ),
        );
        break;

      case 'bulletList':
      case 'orderedList':
        blocks.push(...listBlocks(node, idToNumber, depth, commentIds));
        break;

      case 'table':
        blocks.push(tableBlock(node, idToNumber, commentIds));
        break;

      case 'blockquote': {
        // Rendered as indented paragraphs with a left rule, matching the editor.
        for (const inner of node.content ?? []) {
          blocks.push(
            paragraphFromNode(
              inner,
              idToNumber,
              {
                indent: { left: pxToDxa(36) },
                border: { left: { style: BorderStyle.SINGLE, color: 'CBD5E1', size: 12 } },
              },
              commentIds,
            ),
          );
        }
        break;
      }

      case 'codeBlock': {
        const text = (node.content ?? []).map((c) => c.text ?? '').join('');
        for (const line of text.split('\n')) {
          blocks.push(
            new Paragraph({
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' },
              children: [new TextRun({ text: line, font: 'Consolas' })],
            }),
          );
        }
        break;
      }

      case 'tableOfContents':
        // The live TOC is a node view in the editor; export a readable snapshot
        // rather than dropping the block entirely.
        blocks.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('Table of Contents')],
          }),
        );
        break;

      case 'image': {
        const img = imageParagraph(node);
        if (img) blocks.push(img);
        break;
      }

      case 'docShape':
        blocks.push(shapeParagraph(node));
        break;

      case 'pageBreak':
        blocks.push(new Paragraph({ children: [new PageBreak()] }));
        break;

      // columnBreak is an atom with no content, so without its own case the
      // default branch below recursed into nothing and dropped it on save.
      case 'columnBreak':
        blocks.push(new Paragraph({ children: [new ColumnBreak()] }));
        break;

      case 'horizontalRule':
        blocks.push(new Paragraph({ thematicBreak: true }));
        break;

      // Without a case of its own a checklist fell to the default branch, which
      // recurses into the content and emits bare paragraphs - the text survived
      // but every checkbox vanished on save. Word has no checkbox list item, so
      // it does what this does: a ballot-box character in front of the text.
      case 'taskList':
        blocks.push(...taskListBlocks(node, idToNumber, depth, commentIds));
        break;

      default:
        if (node.content?.length)
          blocks.push(...blocksFromNodes(node.content, idToNumber, depth, commentIds));
        break;
    }
  }

  return blocks;
}

function sectionProperties(pageSetup: PageSetup): ISectionPropertiesOptions {
  const dims = PAGE_DIMENSIONS[pageSetup.size];
  const { margins, columns } = pageSetup;

  // `docx` swaps width and height itself when the orientation is landscape, so
  // always hand it the portrait dimensions. Pre-swapping here cancelled that
  // out and produced a landscape-flagged section with portrait page size.
  return {
    page: {
      size: {
        width: pxToDxa(dims.width),
        height: pxToDxa(dims.height),
        orientation:
          pageSetup.orientation === 'landscape'
            ? PageOrientation.LANDSCAPE
            : PageOrientation.PORTRAIT,
      },
      margin: {
        top: pxToDxa(margins.top),
        bottom: pxToDxa(margins.bottom),
        left: pxToDxa(margins.left),
        right: pxToDxa(margins.right),
      },
    },
    ...(columns.count > 1
      ? { column: { count: columns.count, space: pxToDxa(columns.gap), equalWidth: true } }
      : {}),
  };
}

/** Numbering definitions backing bulleted and numbered lists at every depth. */
function numberingConfig() {
  const levels = (format: (typeof LevelFormat)[keyof typeof LevelFormat], text: (i: number) => string) =>
    Array.from({ length: MAX_LIST_DEPTH }, (_, level) => ({
      level,
      format,
      text: text(level),
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: pxToDxa(36 * (level + 1)), hanging: pxToDxa(18) } } },
    }));

  return {
    config: [
      {
        reference: BULLET_REFERENCE,
        levels: levels(LevelFormat.BULLET, () => '•'),
      },
      {
        reference: ORDERED_REFERENCE,
        levels: levels(LevelFormat.DECIMAL, (level) => `%${level + 1}.`),
      },
    ],
  };
}

/** Named paragraph styles carried from the document's custom style set. */
function styleDefinitions(customStyles: DocumentStyle[] | undefined) {
  if (!customStyles?.length) return undefined;
  // DocumentStyle.fontSize is a CSS length such as '11pt'; docx wants half-points.
  const halfPoints = (size: string | undefined) => {
    const pt = parseFloat(String(size ?? ''));
    return Number.isFinite(pt) && pt > 0 ? Math.round(pt * 2) : undefined;
  };

  // The document's Normal style is the body font. Emitting it as the document
  // default is what makes the app's default font real: without this every run
  // exported in Word's own Calibri 11 no matter what the document said, so
  // changing the default font changed the screen and nothing else.
  const normal = customStyles.find((style) => style.id === 'normal');
  const normalRun = {
    ...(normal?.fontFamily ? { font: normal.fontFamily } : {}),
    ...(halfPoints(normal?.fontSize) ? { size: halfPoints(normal?.fontSize) } : {}),
  };

  return {
    default: Object.keys(normalRun).length ? { document: { run: normalRun } } : undefined,
    paragraphStyles: customStyles.map((style) => ({
      id: style.id,
      name: style.name,
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: {
        ...(style.fontFamily ? { font: style.fontFamily } : {}),
        ...(halfPoints(style.fontSize) ? { size: halfPoints(style.fontSize) } : {}),
        ...(style.bold ? { bold: true } : {}),
        ...(style.italic ? { italics: true } : {}),
        ...(style.underline ? { underline: { type: UnderlineType.SINGLE } } : {}),
        ...(hex(style.color) ? { color: hex(style.color) } : {}),
      },
    })),
  };
}

/** A faint centred line of text standing in for Word's WordArt watermark. */
function watermarkHeaderChildren(watermark: Watermark | undefined): Paragraph[] {
  if (!watermark?.enabled || !watermark.text) return [];
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: watermark.text,
          color: 'D9D9D9',
          size: 96,
          bold: true,
        }),
      ],
    }),
  ];
}

export async function exportToDocx(
  content: unknown,
  options: DocxExportOptions | string = {},
): Promise<Blob> {
  const opts: DocxExportOptions = typeof options === 'string' ? { title: options } : options;
  const docNode = content as TipTapNode;
  const { idToNumber, docxFootnotes } = buildFootnoteIndex(opts.footnotes ?? []);
  const { commentIds, docxComments } = buildCommentIndex(opts.comments);

  const body = blocksFromNodes(docNode.content ?? [], idToNumber, 0, commentIds);

  const section: {
    properties?: ISectionPropertiesOptions;
    headers?: { default?: Header };
    footers?: { default?: Footer };
    children: Array<Paragraph | Table>;
  } = {
    children: body.length ? body : [new Paragraph('')],
  };

  if (opts.pageSetup) section.properties = sectionProperties(opts.pageSetup);

  /**
   * Word lays header and footer zones out against a centre and a right tab
   * stop in a single paragraph. Writing them that way is what makes a title
   * on the left and a page number on the right survive the round trip - the
   * previous single centred run could not express it.
   *
   * `%p` and `%P` are expanded into real page-number fields.
   */
  const zoneRuns = (text: string): (TextRun | string)[] => {
    if (!text.trim()) return [];
    return text
      .split(/(%p|%P)/g)
      .filter(Boolean)
      .map((piece) =>
        piece === '%p'
          ? new TextRun({ children: [PageNumber.CURRENT] })
          : piece === '%P'
            ? new TextRun({ children: [PageNumber.TOTAL_PAGES] })
            : new TextRun(piece),
      );
  };

  const zoneParagraph = (zones: HeaderFooterZones, trailing: TextRun[] = []) => {
    const children: (TextRun | Tab)[] = [];
    children.push(...(zoneRuns(zones.left) as TextRun[]));
    children.push(new TextRun({ children: [new Tab()] }));
    children.push(...(zoneRuns(zones.center) as TextRun[]), ...trailing);
    children.push(new TextRun({ children: [new Tab()] }));
    children.push(...(zoneRuns(zones.right) as TextRun[]));
    return new Paragraph({
      tabStops: [
        { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
        { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
      ],
      children,
    });
  };

  const headerZones = headerZonesOf(opts.headerFooter);
  const footerZones = footerZonesOf(opts.headerFooter);

  const headerChildren: Paragraph[] = [...watermarkHeaderChildren(opts.watermark)];
  if (!zonesEmpty(headerZones)) headerChildren.push(zoneParagraph(headerZones));
  if (headerChildren.length) {
    section.headers = { default: new Header({ children: headerChildren }) };
  }

  const pageNumberRuns = opts.headerFooter?.showPageNumbers
    ? [
        new TextRun({
          children: [
            headerZones.center ? '  ' : '',
            'Page ',
            PageNumber.CURRENT,
            ' of ',
            PageNumber.TOTAL_PAGES,
          ],
        }),
      ]
    : [];

  if (!zonesEmpty(footerZones) || pageNumberRuns.length) {
    section.footers = {
      default: new Footer({ children: [zoneParagraph(footerZones, pageNumberRuns)] }),
    };
  }

  const doc = new Document({
    title: opts.title ?? 'Document',
    footnotes: Object.keys(docxFootnotes).length ? docxFootnotes : undefined,
    comments: docxComments.length ? { children: docxComments } : undefined,
    numbering: numberingConfig(),
    styles: styleDefinitions(opts.customStyles),
    sections: [section],
  });

  return Packer.toBlob(doc);
}
