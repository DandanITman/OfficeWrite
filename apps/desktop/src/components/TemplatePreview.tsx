import type { Template } from '@officewrite/core';

/**
 * A real miniature of a template's first page.
 *
 * The previous thumbnails drew each block as a grey bar. That told you a
 * template had a heading and four paragraphs, but not whether it was an invoice
 * or a wedding invitation - which is the only question anybody asks of a template
 * gallery. These render the template's own words, at the template's own
 * alignment and emphasis, so the card shows what you are about to get.
 *
 * Rendered at two sizes from one component: `thumb` for the cards and `page` for
 * the preview dialog. Sharing the renderer is the point - a card that disagreed
 * with the preview beside it would be worse than no card at all.
 */

/** The node shapes a template can hold. Read defensively: TEMPLATES is wide. */
type PreviewNode = {
  type?: string;
  text?: string;
  attrs?: { level?: number; textAlign?: string; checked?: boolean; styleId?: string };
  marks?: Array<{ type: string }>;
  content?: readonly PreviewNode[];
};

/** How many top-level blocks a thumbnail shows before the page is full. */
const THUMB_BLOCK_LIMIT = 14;
/** The preview dialog shows a whole page's worth. */
const PAGE_BLOCK_LIMIT = 60;

function alignmentOf(node: PreviewNode): React.CSSProperties {
  const align = node.attrs?.textAlign;
  if (align === 'center' || align === 'right' || align === 'justify') return { textAlign: align };
  return {};
}

/** Inline runs, keeping bold and italic - the memo and invoice lean on them. */
function renderInline(nodes: readonly PreviewNode[] | undefined): React.ReactNode[] {
  if (!nodes) return [];
  return nodes.map((node, index) => {
    if (node.type === 'hardBreak') return <br key={index} />;
    const text = node.text ?? '';
    if (!text) return null;

    const marks = new Set((node.marks ?? []).map((mark) => mark.type));
    let element: React.ReactNode = text;
    if (marks.has('bold')) element = <strong key="b">{element}</strong>;
    if (marks.has('italic')) element = <em key="i">{element}</em>;
    if (marks.has('underline')) element = <u key="u">{element}</u>;
    return <span key={index}>{element}</span>;
  });
}

function renderBlock(node: PreviewNode, key: number): React.ReactNode {
  const type = node.type;

  if (type === 'heading') {
    const level = node.attrs?.level ?? 1;
    return (
      <div key={key} className={`tp-h tp-h${level}`} style={alignmentOf(node)}>
        {renderInline(node.content)}
      </div>
    );
  }

  if (type === 'bulletList' || type === 'orderedList' || type === 'taskList') {
    const marker = type === 'orderedList' ? 'tp-ol' : type === 'taskList' ? 'tp-tasks' : 'tp-ul';
    return (
      <div key={key} className={`tp-list ${marker}`}>
        {(node.content ?? []).map((item, index) => (
          <div className="tp-li" key={index}>
            <span className="tp-marker" aria-hidden>
              {type === 'orderedList' ? `${index + 1}.` : type === 'taskList' ? '☐' : '•'}
            </span>
            <span className="tp-li-text">
              {(item.content ?? []).map((child, childIndex) => (
                <span key={childIndex}>{renderInline(child.content)}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    const rows = node.content ?? [];
    return (
      <table key={key} className="tp-table">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {(row.content ?? []).map((cell, cellIndex) => {
                // A header cell is a different node type, not an attribute, so
                // the miniature can shade it the way the document does.
                const isHead = cell.type === 'tableHeader';
                const text = (cell.content ?? []).map((child, i) => (
                  <span key={i}>{renderInline(child.content)}</span>
                ));
                return isHead ? (
                  <th key={cellIndex}>{text}</th>
                ) : (
                  <td key={cellIndex}>{text}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === 'horizontalRule') return <div key={key} className="tp-rule" />;
  if (type === 'pageBreak') return <div key={key} className="tp-page-break" />;

  const inline = renderInline(node.content);
  // An empty paragraph is spacing in the document, so it is spacing here too.
  if (inline.length === 0) return <div key={key} className="tp-gap" />;

  const subtitle = node.attrs?.styleId === 'subtitle' ? ' tp-subtitle' : '';
  return (
    <div key={key} className={`tp-p${subtitle}`} style={alignmentOf(node)}>
      {inline}
    </div>
  );
}

export function TemplatePreview({
  template,
  variant = 'thumb',
}: {
  template: Template;
  variant?: 'thumb' | 'page';
}) {
  const blocks = (template.content.content ?? []) as readonly PreviewNode[];
  const limit = variant === 'thumb' ? THUMB_BLOCK_LIMIT : PAGE_BLOCK_LIMIT;
  const shown = blocks.slice(0, limit);

  if (shown.length === 0 || shown.every((node) => !node.content)) {
    return (
      <div className={`tp-page tp-${variant} tp-blank`} data-testid={`template-preview-${template.id}`}>
        <span className="tp-blank-label">Blank page</span>
      </div>
    );
  }

  return (
    <div className={`tp-page tp-${variant}`} data-testid={`template-preview-${template.id}`}>
      {shown.map((node, index) => renderBlock(node, index))}
      {blocks.length > limit && <div className="tp-more" aria-hidden />}
    </div>
  );
}
