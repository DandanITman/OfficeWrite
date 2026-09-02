import {
  DEFAULT_HEADER_FOOTER,
  DEFAULT_PAGE_SETUP,
  PAGE_DIMENSIONS,
  type DocumentComment,
  type DocumentFootnote,
  type HeaderFooter,
  type HeaderFooterZones,
  type PageSetup,
  type PageSizePreset,
} from '@officewrite/core';
import { DocxPackage } from './package';
import {
  attr,
  boolProp,
  child,
  children,
  emuToPx,
  fieldInstructions,
  path,
  textOf,
  twipsToPx,
  val,
  type XmlNode,
} from './xml';

export type TipTapNode = {
  type?: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};

export interface DocxImportResult {
  content: TipTapNode;
  pageSetup: PageSetup;
  headerFooter: HeaderFooter;
  footnotes: DocumentFootnote[];
  comments: DocumentComment[];
}

type Mark = { type: string; attrs?: Record<string, unknown> };

/** numId -> { level -> 'bullet' | 'ordered' } from word/numbering.xml. */
type NumberingMap = Map<string, Map<number, 'bullet' | 'ordered'>>;

const HEADING_STYLE = /^heading\s*([1-9])$/i;

function buildNumbering(numbering: XmlNode | undefined): NumberingMap {
  const map: NumberingMap = new Map();
  if (!numbering) return map;

  // abstractNumId -> level -> format
  const abstract = new Map<string, Map<number, 'bullet' | 'ordered'>>();
  for (const node of children(numbering, 'w:abstractNum')) {
    const id = attr(node, 'w:abstractNumId');
    if (!id) continue;
    const levels = new Map<number, 'bullet' | 'ordered'>();
    for (const lvl of children(node, 'w:lvl')) {
      const ilvl = Number(attr(lvl, 'w:ilvl') ?? 0);
      const fmt = val(lvl, 'w:numFmt') ?? 'bullet';
      levels.set(ilvl, fmt === 'bullet' || fmt === 'none' ? 'bullet' : 'ordered');
    }
    abstract.set(id, levels);
  }

  for (const node of children(numbering, 'w:num')) {
    const numId = attr(node, 'w:numId');
    const abstractId = val(node, 'w:abstractNumId');
    if (!numId) continue;
    map.set(numId, (abstractId && abstract.get(abstractId)) || new Map());
  }
  return map;
}

function runMarks(rPr: XmlNode | undefined): Mark[] {
  if (!rPr) return [];
  const marks: Mark[] = [];

  if (boolProp(rPr, 'w:b')) marks.push({ type: 'bold' });
  if (boolProp(rPr, 'w:i')) marks.push({ type: 'italic' });
  if (boolProp(rPr, 'w:strike')) marks.push({ type: 'strike' });

  const underline = val(rPr, 'w:u');
  if (underline && underline !== 'none') marks.push({ type: 'underline' });

  const vertAlign = val(rPr, 'w:vertAlign');
  if (vertAlign === 'superscript') marks.push({ type: 'superscript' });
  if (vertAlign === 'subscript') marks.push({ type: 'subscript' });

  const highlight = val(rPr, 'w:highlight');
  if (highlight && highlight !== 'none') {
    marks.push({ type: 'highlight', attrs: { color: highlight } });
  } else {
    const shdFill = attr(child(rPr, 'w:shd'), 'w:fill');
    if (shdFill && shdFill !== 'auto' && shdFill !== 'FFFFFF') {
      marks.push({ type: 'highlight', attrs: { color: `#${shdFill}` } });
    }
  }

  // textStyle carries colour, family and size - all previously lost on import.
  const textStyle: Record<string, unknown> = {};
  const color = val(rPr, 'w:color');
  if (color && color !== 'auto') textStyle.color = `#${color}`;

  const fonts = child(rPr, 'w:rFonts');
  const family = attr(fonts, 'w:ascii') ?? attr(fonts, 'w:hAnsi') ?? attr(fonts, 'w:cs');
  if (family) textStyle.fontFamily = family;

  const halfPoints = val(rPr, 'w:sz');
  if (halfPoints) {
    const pt = Number(halfPoints) / 2;
    if (Number.isFinite(pt) && pt > 0) textStyle.fontSize = `${pt}pt`;
  }
  if (Object.keys(textStyle).length) marks.push({ type: 'textStyle', attrs: textStyle });

  return marks;
}

function paragraphAttrs(pPr: XmlNode | undefined): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (!pPr) return attrs;

  const jc = val(pPr, 'w:jc');
  if (jc === 'center' || jc === 'right') attrs.textAlign = jc;
  else if (jc === 'both' || jc === 'distribute') attrs.textAlign = 'justify';
  else if (jc === 'left' || jc === 'start') attrs.textAlign = 'left';

  const ind = child(pPr, 'w:ind');
  const left = attr(ind, 'w:left') ?? attr(ind, 'w:start');
  if (left) {
    // The editor models indent in 36px steps (0.375in), matching its own export.
    const px = twipsToPx(left);
    if (px > 0) attrs.indentLevel = Math.max(1, Math.round(px / 36));
  }

  const spacing = child(pPr, 'w:spacing');
  if (spacing) {
    const before = attr(spacing, 'w:before');
    const after = attr(spacing, 'w:after');
    const line = attr(spacing, 'w:line');
    if (before) attrs.spaceBefore = twipsToPx(before);
    if (after) attrs.spaceAfter = twipsToPx(after);
    // w:line is in 240ths of a line when lineRule is auto.
    if (line && (attr(spacing, 'w:lineRule') ?? 'auto') === 'auto') {
      const ratio = Number(line) / 240;
      if (Number.isFinite(ratio) && ratio > 0) attrs.lineHeight = String(Number(ratio.toFixed(2)));
    }
  }

  const borderColor = attr(path(pPr, 'w:pBdr', 'w:left'), 'w:color');
  if (borderColor && borderColor !== 'auto') attrs.borderColor = `#${borderColor}`;

  const shading = attr(child(pPr, 'w:shd'), 'w:fill');
  if (shading && shading !== 'auto') attrs.shading = `#${shading}`;

  return attrs;
}

/**
 * Rebuild a shape node from an SVG this app exported.
 *
 * `shapeSvgData` stamps the shape's attributes onto the SVG root, so a shape
 * survives a round trip as a shape. Without this the SVG's raster fallback --
 * a 1x1 PNG -- came back instead, turning every shape into a single pixel.
 */
function shapeFromSvg(svgDataUri: string, width: number, height: number): TipTapNode | null {
  const match = svgDataUri.match(/^data:image\/svg\+xml;base64,(.+)$/i);
  if (!match) return null;

  let svg: string;
  try {
    svg = atob(match[1]);
  } catch {
    return null;
  }

  const shapeType = svg.match(/data-officewrite-shape="([^"]+)"/)?.[1];
  if (!shapeType) return null;

  const attrs: Record<string, unknown> = { shapeType };
  if (width > 0) attrs.width = width;
  if (height > 0) attrs.height = height;

  const fill = svg.match(/data-fill="([^"]+)"/)?.[1];
  const stroke = svg.match(/data-stroke="([^"]+)"/)?.[1];
  const strokeWidth = svg.match(/data-stroke-width="([^"]+)"/)?.[1];
  if (fill) attrs.fill = fill;
  if (stroke) attrs.stroke = stroke;
  if (strokeWidth && Number.isFinite(Number(strokeWidth))) attrs.strokeWidth = Number(strokeWidth);

  return { type: 'docShape', attrs };
}

function imageFromDrawing(node: XmlNode, pkg: DocxPackage): TipTapNode | null {
  // a:blip carries r:embed; wp:extent carries the display size in EMUs.
  let embed: string | undefined;
  // asvg:svgBlip carries the vector original when the picture is an SVG; the
  // blip above is then only its raster fallback.
  let svgEmbed: string | undefined;
  let cx: string | undefined;
  let cy: string | undefined;
  let alt = '';

  const walk = (n: XmlNode) => {
    if (n.name === 'a:blip') embed = attr(n, 'r:embed') ?? attr(n, 'r:link');
    if (n.name === 'asvg:svgBlip' || n.name === 'svg:svgBlip') {
      svgEmbed = attr(n, 'r:embed') ?? attr(n, 'r:link');
    }
    if (n.name === 'wp:extent') {
      cx = attr(n, 'cx');
      cy = attr(n, 'cy');
    }
    if (n.name === 'wp:docPr') alt = attr(n, 'descr') ?? attr(n, 'name') ?? alt;
    for (const c of n.children) walk(c);
  };
  walk(node);

  const width = emuToPx(cx);
  const height = emuToPx(cy);

  const svgData = pkg.imageData(svgEmbed);
  if (svgData) {
    const shape = shapeFromSvg(svgData, width, height);
    if (shape) return shape;
  }

  const src = pkg.imageData(embed);
  if (!src) return null;

  const attrs: Record<string, unknown> = { src, alt };
  // Carry the real height so aspect ratio survives, instead of assuming 4:3.
  if (width > 0) attrs.width = width;
  if (height > 0) attrs.height = height;
  return { type: 'image', attrs };
}

interface RunContext {
  pkg: DocxPackage;
  footnoteNumberById: Map<string, number>;
  /** Comment number -> the app's comment id, for rebuilding anchors. */
  commentIdByNumber: Map<string, string>;
  /** Comment ranges currently open at this point in the document. */
  openComments: Set<string>;
}

/** Convert the runs of a paragraph (or hyperlink) into inline nodes. */
function inlineFromRuns(container: XmlNode, ctx: RunContext, inherited: Mark[]): TipTapNode[] {
  const out: TipTapNode[] = [];

  for (const node of container.children) {
    // A comment range covers the runs between these two markers.
    if (node.name === 'w:commentRangeStart') {
      const id = ctx.commentIdByNumber.get(attr(node, 'w:id') ?? '');
      if (id) ctx.openComments.add(id);
      continue;
    }
    if (node.name === 'w:commentRangeEnd') {
      const id = ctx.commentIdByNumber.get(attr(node, 'w:id') ?? '');
      if (id) ctx.openComments.delete(id);
      continue;
    }

    // Tracked revisions wrap the runs they apply to.
    if (node.name === 'w:ins' || node.name === 'w:del') {
      const markType = node.name === 'w:ins' ? 'trackInsert' : 'trackDelete';
      const revision: Mark = {
        type: markType,
        attrs: {
          author: attr(node, 'w:author') ?? 'Unknown',
          at: attr(node, 'w:date') ?? new Date().toISOString(),
        },
      };
      out.push(...inlineFromRuns(node, ctx, [...inherited, revision]));
      continue;
    }

    if (node.name === 'w:hyperlink') {
      const href = ctx.pkg.hyperlink(attr(node, 'r:id'));
      const anchor = attr(node, 'w:anchor');
      const linkMark: Mark[] = href
        ? [{ type: 'link', attrs: { href } }]
        : anchor
          ? [{ type: 'link', attrs: { href: `#${anchor}` } }]
          : [];
      out.push(...inlineFromRuns(node, ctx, [...inherited, ...linkMark]));
      continue;
    }

    if (node.name !== 'w:r') continue;

    const rPr = child(node, 'w:rPr');
    // Any comment ranges open at this point anchor to this run.
    const commentMarks: Mark[] = [...ctx.openComments].map((commentId) => ({
      type: 'commentAnchor',
      attrs: { commentId },
    }));
    const marks = [...inherited, ...runMarks(rPr), ...commentMarks];

    for (const part of node.children) {
      switch (part.name) {
        case 'w:t':
        // Deleted text under track changes lives in w:delText, not w:t. Read it
        // directly here; textOf() deliberately skips it as non-visible content.
        case 'w:delText': {
          let text = '';
          const collect = (n: XmlNode) => {
            if (n.name === '#text') text += n.text ?? '';
            n.children.forEach(collect);
          };
          part.children.forEach(collect);
          if (text) out.push({ type: 'text', text, marks: marks.length ? marks : undefined });
          break;
        }
        case 'w:tab':
          out.push({ type: 'text', text: '\t', marks: marks.length ? marks : undefined });
          break;
        case 'w:br': {
          const breakType = attr(part, 'w:type');
          if (breakType === 'page') out.push({ type: 'pageBreak' });
          else if (breakType === 'column') out.push({ type: 'columnBreak' });
          else out.push({ type: 'hardBreak' });
          break;
        }
        case 'w:drawing':
        case 'w:pict': {
          const image = imageFromDrawing(part, ctx.pkg);
          if (image) out.push(image);
          break;
        }
        case 'w:footnoteReference': {
          const id = attr(part, 'w:id');
          const number = id ? ctx.footnoteNumberById.get(id) : undefined;
          if (id && number !== undefined) {
            out.push({
              type: 'text',
              text: String(number),
              marks: [...marks, { type: 'footnoteRef', attrs: { id: `fn-${id}`, number } }],
            });
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return out;
}

/** Node types that are blocks in the editor schema and must not sit inside a paragraph. */
const BLOCK_INLINE_TYPES = new Set(['image', 'pageBreak', 'columnBreak', 'docShape']);

/**
 * Split a paragraph's inline run into block-level siblings.
 *
 * `image` and `pageBreak` are block nodes in the editor schema, so leaving them
 * nested inside a paragraph produces a document ProseMirror will reject or
 * silently strip on `setContent`.
 */
function explode(paragraph: TipTapNode): TipTapNode[] {
  const inline = paragraph.content ?? [];
  if (!inline.some((n) => n.type && BLOCK_INLINE_TYPES.has(n.type))) {
    return [paragraph];
  }

  const out: TipTapNode[] = [];
  let run: TipTapNode[] = [];
  const flush = () => {
    if (run.length) {
      out.push({ ...paragraph, content: run });
      run = [];
    }
  };

  for (const node of inline) {
    if (node.type && BLOCK_INLINE_TYPES.has(node.type)) {
      flush();
      out.push(node);
    } else {
      run.push(node);
    }
  }
  flush();

  // A paragraph that held nothing but blocks contributes no empty paragraph.
  return out.length ? out : [];
}

function paragraphNode(p: XmlNode, ctx: RunContext, styleName: string | undefined): TipTapNode {
  const pPr = child(p, 'w:pPr');
  const attrs = paragraphAttrs(pPr);
  const content = inlineFromRuns(p, ctx, []);

  const headingMatch = styleName?.match(HEADING_STYLE);
  const outline = val(pPr, 'w:outlineLvl');
  const level = headingMatch
    ? Number(headingMatch[1])
    : outline !== undefined
      ? Number(outline) + 1
      : undefined;

  if (level !== undefined && level >= 1 && level <= 6) {
    return {
      type: 'heading',
      // The editor's schema only registers levels 1-3.
      attrs: { ...attrs, level: Math.min(level, 3) },
      content: content.length ? content : undefined,
    };
  }

  return { type: 'paragraph', attrs, content: content.length ? content : undefined };
}

function tableNode(tbl: XmlNode, ctx: RunContext, styleOf: (p: XmlNode) => string | undefined): TipTapNode {
  const rows: TipTapNode[] = [];

  for (const [rowIndex, tr] of children(tbl, 'w:tr').entries()) {
    const cells: TipTapNode[] = [];
    const isHeaderRow = rowIndex === 0 && !!path(tr, 'w:trPr', 'w:tblHeader');

    for (const tc of children(tr, 'w:tc')) {
      const tcPr = child(tc, 'w:tcPr');
      const span = Number(val(tcPr, 'w:gridSpan') ?? 1);
      // A continuation cell of a vertical merge carries no content of its own.
      if (attr(child(tcPr, 'w:vMerge'), 'w:val') === undefined && child(tcPr, 'w:vMerge')) continue;

      const cellAttrs: Record<string, unknown> = {};
      if (Number.isFinite(span) && span > 1) cellAttrs.colspan = span;

      const width = attr(child(tcPr, 'w:tcW'), 'w:w');
      if (width && attr(child(tcPr, 'w:tcW'), 'w:type') === 'dxa') {
        cellAttrs.colwidth = [twipsToPx(width)];
      }
      const fill = attr(child(tcPr, 'w:shd'), 'w:fill');
      if (fill && fill !== 'auto') cellAttrs.backgroundColor = `#${fill}`;

      const cellContent: TipTapNode[] = [];
      for (const node of tc.children) {
        if (node.name === 'w:p') cellContent.push(...explode(paragraphNode(node, ctx, styleOf(node))));
        else if (node.name === 'w:tbl') cellContent.push(tableNode(node, ctx, styleOf));
      }
      if (!cellContent.length) cellContent.push({ type: 'paragraph' });

      cells.push({
        type: isHeaderRow ? 'tableHeader' : 'tableCell',
        attrs: cellAttrs,
        content: cellContent,
      });
    }

    if (cells.length) rows.push({ type: 'tableRow', content: cells });
  }

  return { type: 'table', content: rows.length ? rows : [{ type: 'tableRow', content: [] }] };
}

function pageSetupFromSectPr(sectPr: XmlNode | undefined): PageSetup {
  if (!sectPr) return { ...DEFAULT_PAGE_SETUP, margins: { ...DEFAULT_PAGE_SETUP.margins } };

  const pgSz = child(sectPr, 'w:pgSz');
  const widthPx = twipsToPx(attr(pgSz, 'w:w'));
  const heightPx = twipsToPx(attr(pgSz, 'w:h'));
  const landscape = attr(pgSz, 'w:orient') === 'landscape' || (widthPx > heightPx && heightPx > 0);

  // Match the closest known preset on the portrait-oriented dimensions.
  const shortSide = landscape ? heightPx : widthPx;
  const longSide = landscape ? widthPx : heightPx;
  let size: PageSizePreset = DEFAULT_PAGE_SETUP.size;
  if (shortSide > 0 && longSide > 0) {
    let best = Number.POSITIVE_INFINITY;
    for (const [preset, dims] of Object.entries(PAGE_DIMENSIONS) as [
      PageSizePreset,
      { width: number; height: number },
    ][]) {
      const delta = Math.abs(dims.width - shortSide) + Math.abs(dims.height - longSide);
      if (delta < best) {
        best = delta;
        size = preset;
      }
    }
  }

  const pgMar = child(sectPr, 'w:pgMar');
  const margins = pgMar
    ? {
        top: twipsToPx(attr(pgMar, 'w:top')) || DEFAULT_PAGE_SETUP.margins.top,
        bottom: twipsToPx(attr(pgMar, 'w:bottom')) || DEFAULT_PAGE_SETUP.margins.bottom,
        left: twipsToPx(attr(pgMar, 'w:left')) || DEFAULT_PAGE_SETUP.margins.left,
        right: twipsToPx(attr(pgMar, 'w:right')) || DEFAULT_PAGE_SETUP.margins.right,
      }
    : { ...DEFAULT_PAGE_SETUP.margins };

  const cols = child(sectPr, 'w:cols');
  const count = Number(attr(cols, 'w:num') ?? 1);
  const space = attr(cols, 'w:space');

  return {
    ...DEFAULT_PAGE_SETUP,
    size,
    orientation: landscape ? 'landscape' : 'portrait',
    margins,
    columns: {
      ...DEFAULT_PAGE_SETUP.columns,
      count: Number.isFinite(count) && count > 1 ? count : 1,
      gap: space ? twipsToPx(space) : DEFAULT_PAGE_SETUP.columns.gap,
      line: attr(cols, 'w:sep') === '1' || attr(cols, 'w:sep') === 'true',
    },
    border: { ...DEFAULT_PAGE_SETUP.border },
  };
}

/** Plain text of a header/footer part, plus whether it contains a PAGE field. */
function headerFooterText(part: XmlNode | undefined): {
  text: string;
  zones: HeaderFooterZones;
  hasPageNumber: boolean;
} {
  const empty: HeaderFooterZones = { left: '', center: '', right: '' };
  if (!part) return { text: '', zones: empty, hasPageNumber: false };
  const body = child(part, 'w:hdr') ?? child(part, 'w:ftr') ?? part;
  const lines: string[] = [];
  const zones: HeaderFooterZones = { ...empty };
  let hasPageNumber = false;
  let readZones = false;

  for (const p of children(body, 'w:p')) {
    // Field instructions (PAGE, NUMPAGES) are machinery, not user-visible text.
    // textOf() already excludes them; surface them as the page-number toggle.
    if (fieldInstructions(p).some((code) => /\bPAGE\b|\bNUMPAGES\b/.test(code))) {
      hasPageNumber = true;
    }
    // Only the runs: `w:pPr` holds the tab-stop *definitions* as `w:tab`
    // elements, and textOf emits a tab for each, so reading the whole
    // paragraph put two phantom separators before the first zone.
    const raw = p.children
      .filter((node) => node.name !== 'w:pPr')
      .map((node) => textOf({ ...node, children: [node] } as XmlNode))
      .join('');
    const text = raw.trim();
    if (text) lines.push(text);

    // Word lays the three zones against a centre and a right tab stop, so the
    // tabs are the separators. Only the first paragraph carrying them is read
    // that way; the flat text still keeps every line.
    if (!readZones && raw.includes('\t')) {
      const parts = raw.split('\t');
      zones.left = (parts[0] ?? '').trim();
      zones.center = (parts[1] ?? '').trim();
      zones.right = parts.slice(2).join(' ').trim();
      readZones = true;
    }
  }

  const text = lines.join('\n');
  return {
    // Without tabs the whole thing was one centred run, which is how headers
    // were written before the zones existed.
    text,
    zones: readZones ? zones : { ...empty, center: text },
    hasPageNumber,
  };
}

/**
 * Read `word/comments.xml`.
 *
 * Nothing read this part before, so a document reviewed in Word arrived in
 * Officewrite with every comment silently missing.
 */
function commentsFrom(commentsXml: XmlNode | undefined): {
  list: DocumentComment[];
  idByNumber: Map<string, string>;
} {
  const list: DocumentComment[] = [];
  const idByNumber = new Map<string, string>();
  if (!commentsXml) return { list, idByNumber };

  const root = child(commentsXml, 'w:comments') ?? commentsXml;
  for (const node of children(root, 'w:comment')) {
    const number = attr(node, 'w:id');
    if (number === undefined) continue;

    const id = `cmt-${number}`;
    idByNumber.set(number, id);

    const created = attr(node, 'w:date');
    list.push({
      id,
      text: textOf(node).trim(),
      author: attr(node, 'w:author') ?? 'Unknown',
      created: created && !Number.isNaN(Date.parse(created)) ? created : new Date().toISOString(),
      resolved: attr(node, 'w:done') === '1',
    });
  }

  return { list, idByNumber };
}

function footnotesFrom(footnotesXml: XmlNode | undefined): {
  list: DocumentFootnote[];
  numberById: Map<string, number>;
} {
  const list: DocumentFootnote[] = [];
  const numberById = new Map<string, number>();
  if (!footnotesXml) return { list, numberById };

  const root = child(footnotesXml, 'w:footnotes') ?? footnotesXml;
  let number = 0;
  for (const fn of children(root, 'w:footnote')) {
    const id = attr(fn, 'w:id');
    // Ids 0 and -1 are the separator/continuation notes, not real footnotes.
    if (!id || Number(id) <= 0) continue;
    number += 1;
    numberById.set(id, number);
    list.push({ id: `fn-${id}`, text: textOf(fn).trim() });
  }
  return { list, numberById };
}

/**
 * Read a .docx into the document model.
 *
 * Replaces the previous mammoth -> HTML -> hand-rolled DOM walk, which had no
 * table, hyperlink or section handling at all: tables collapsed into loose
 * paragraphs, links lost their href, images landed in a schema-invalid
 * position, and page setup, headers, footers and footnotes were discarded.
 */
export async function importDocx(data: ArrayBuffer | Uint8Array): Promise<DocxImportResult> {
  const pkg = await DocxPackage.load(data);

  const numbering = buildNumbering(
    pkg.numbering ? (child(pkg.numbering, 'w:numbering') ?? pkg.numbering) : undefined,
  );

  // styleId -> style name, so Heading 1/2/3 can be recognised.
  const styleNames = new Map<string, string>();
  const stylesRoot = pkg.styles ? (child(pkg.styles, 'w:styles') ?? pkg.styles) : undefined;
  for (const style of children(stylesRoot, 'w:style')) {
    const id = attr(style, 'w:styleId');
    const name = val(style, 'w:name');
    if (id) styleNames.set(id, name ?? id);
  }
  const styleOf = (p: XmlNode) => {
    const id = val(child(p, 'w:pPr'), 'w:pStyle');
    if (!id) return undefined;
    return styleNames.get(id) ?? id;
  };

  const { list: footnotes, numberById } = footnotesFrom(pkg.footnotes);
  const { list: comments, idByNumber: commentIdByNumber } = commentsFrom(pkg.comments);
  const ctx: RunContext = {
    pkg,
    footnoteNumberById: numberById,
    commentIdByNumber,
    openComments: new Set(),
  };

  // pkg.document is already the <w:document> element, not a wrapper around it.
  const body = child(pkg.document, 'w:body');
  const content: TipTapNode[] = [];

  /**
   * Open list levels, outermost first.
   *
   * OOXML expresses nesting as a flat run of paragraphs each carrying a
   * `w:ilvl` depth, so the structure has to be rebuilt. The previous version
   * read `w:ilvl` only to choose bullet-versus-ordered and appended every item
   * to one buffer, which flattened a three-level Word list into a single level.
   */
  const openLists: Array<{ level: number; node: TipTapNode }> = [];
  let listNumId: string | null = null;

  const flushList = () => {
    if (openLists.length) content.push(openLists[0].node);
    openLists.length = 0;
    listNumId = null;
  };

  const appendListItem = (numId: string, level: number, kind: 'bullet' | 'ordered', item: TipTapNode) => {
    const listType = kind === 'ordered' ? 'orderedList' : 'bulletList';

    // A different numbering definition starts a new list outright.
    if (listNumId !== numId) {
      flushList();
      listNumId = numId;
    }

    // Close any levels deeper than this paragraph.
    while (openLists.length && openLists[openLists.length - 1].level > level) {
      openLists.pop();
    }

    let top = openLists[openLists.length - 1];

    // Open levels until we reach this paragraph's depth. A nested list belongs
    // inside the previous item at the level above it.
    while (!top || top.level < level) {
      const nested: TipTapNode = { type: listType, content: [] };
      if (!top) {
        openLists.push({ level, node: nested });
      } else {
        const parentItems = top.node.content ?? [];
        const parentItem = parentItems[parentItems.length - 1];
        if (!parentItem) {
          // Deeper level with no item to hang it on: treat it as this level.
          top.level = level;
          break;
        }
        parentItem.content = [...(parentItem.content ?? []), nested];
        openLists.push({ level, node: nested });
      }
      top = openLists[openLists.length - 1];
    }

    // The same depth may switch between bullet and ordered mid-list.
    if (top.node.type !== listType) top.node.type = listType;
    top.node.content = [...(top.node.content ?? []), item];
  };

  for (const node of body?.children ?? []) {
    if (node.name === 'w:p') {
      const numPr = path(node, 'w:pPr', 'w:numPr');
      const numId = val(numPr, 'w:numId');
      const ilvl = Number(val(numPr, 'w:ilvl') ?? 0);

      if (numId && numId !== '0') {
        const kind = numbering.get(numId)?.get(ilvl) ?? 'bullet';
        const blocks = explode(paragraphNode(node, ctx, undefined));
        appendListItem(numId, ilvl, kind, {
          type: 'listItem',
          content: blocks.length ? blocks : [{ type: 'paragraph' }],
        });
        continue;
      }

      flushList();
      content.push(...explode(paragraphNode(node, ctx, styleOf(node))));
      continue;
    }

    if (node.name === 'w:tbl') {
      flushList();
      content.push(tableNode(node, ctx, styleOf));
      continue;
    }
  }
  flushList();

  if (!content.length) content.push({ type: 'paragraph' });

  const sectPr = child(body, 'w:sectPr');
  const pageSetup = pageSetupFromSectPr(sectPr);

  const headerPart = await pkg.part(attr(child(sectPr, 'w:headerReference'), 'r:id'));
  const footerPart = await pkg.part(attr(child(sectPr, 'w:footerReference'), 'r:id'));
  const header = headerFooterText(headerPart);
  const footer = headerFooterText(footerPart);

  const headerFooter: HeaderFooter = {
    ...DEFAULT_HEADER_FOOTER,
    header: header.zones.center || header.text,
    footer: footer.zones.center || footer.text,
    headerZones: header.zones,
    footerZones: footer.zones,
    showPageNumbers: header.hasPageNumber || footer.hasPageNumber,
  };

  return { content: { type: 'doc', content }, pageSetup, headerFooter, footnotes, comments };
}
