import { CONTRAST_AA_LARGE, CONTRAST_AA_NORMAL, contrastRatio } from './contrast';

/**
 * Review > Check Accessibility.
 *
 * Walks the document JSON and reports the problems that are actually decidable
 * from the document alone. Deliberately conservative: a checker that cries wolf
 * gets switched off, so anything needing human judgement (is this alt text
 * meaningful? is this heading really a heading?) is left out.
 */
export type AccessibilitySeverity = 'error' | 'warning' | 'tip';

export interface AccessibilityIssue {
  /** Stable per rule + position, so the pane can key on it. */
  id: string;
  rule: string;
  severity: AccessibilitySeverity;
  title: string;
  /** What to actually do about it. */
  fix: string;
  /** Document position of the offending node, for select-on-click. */
  pos: number;
}

interface JsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: JsonNode[];
  text?: string;
}

/** Link text that tells a screen-reader user nothing about the destination. */
const MEANINGLESS_LINK_TEXT = new Set([
  'click here',
  'here',
  'link',
  'this link',
  'read more',
  'more',
  'this',
  'go',
]);

export function checkAccessibility(doc: unknown, pageColor?: string | null): AccessibilityIssue[] {
  const root = doc as JsonNode | null;
  if (!root?.content) return [];

  const issues: AccessibilityIssue[] = [];
  const background = pageColor || '#ffffff';
  let lastHeadingLevel = 0;
  let pos = 0;

  const push = (issue: Omit<AccessibilityIssue, 'id'>) =>
    issues.push({ ...issue, id: `${issue.rule}:${issue.pos}` });

  const visit = (node: JsonNode) => {
    const nodePos = pos;
    pos += 1;

    switch (node.type) {
      case 'image': {
        const alt = String(node.attrs?.alt ?? '').trim();
        if (!alt) {
          push({
            rule: 'image-alt',
            severity: 'error',
            title: 'Picture has no alt text',
            fix: 'Select the picture and use Picture Format > Alt Text to describe it.',
            pos: nodePos,
          });
        }
        break;
      }

      case 'inkDrawing':
        push({
          rule: 'drawing-alt',
          severity: 'warning',
          title: 'Drawing has no text alternative',
          fix: 'Describe the drawing in the surrounding text. Ink cannot be read aloud.',
          pos: nodePos,
        });
        break;

      case 'table': {
        const rows = node.content ?? [];
        const firstRow = rows[0];
        const hasHeaderRow = (firstRow?.content ?? []).some((cell) => cell.type === 'tableHeader');
        if (!hasHeaderRow) {
          push({
            rule: 'table-header',
            severity: 'error',
            title: 'Table has no header row',
            fix: 'Turn on Header Row in Table Layout > Alignment so the columns are announced.',
            pos: nodePos,
          });
        }
        // A merged cell breaks the row/column relationship screen readers rely on.
        const merged = rows.some((row) =>
          (row.content ?? []).some(
            (cell) => Number(cell.attrs?.colspan ?? 1) > 1 || Number(cell.attrs?.rowspan ?? 1) > 1,
          ),
        );
        if (merged) {
          push({
            rule: 'table-merged',
            severity: 'warning',
            title: 'Table has merged cells',
            fix: 'Split merged cells, or keep the table simple enough to read row by row.',
            pos: nodePos,
          });
        }
        break;
      }

      case 'heading': {
        const level = Number(node.attrs?.level ?? 1);
        if (lastHeadingLevel && level > lastHeadingLevel + 1) {
          push({
            rule: 'heading-skip',
            severity: 'warning',
            title: `Heading level jumps from ${lastHeadingLevel} to ${level}`,
            fix: `Use Heading ${lastHeadingLevel + 1} instead, so the outline has no gaps.`,
            pos: nodePos,
          });
        }
        lastHeadingLevel = level;
        break;
      }

      default:
        break;
    }

    // Marks live on text nodes, so links and colour are checked here.
    if (node.type === 'text' && node.marks?.length) {
      const link = node.marks.find((mark) => mark.type === 'link');
      if (link) {
        const label = (node.text ?? '').trim().toLowerCase().replace(/[.!?]+$/, '');
        if (!label) {
          push({
            rule: 'link-empty',
            severity: 'error',
            title: 'Link has no text',
            fix: 'Give the link wording that describes where it goes.',
            pos: nodePos,
          });
        } else if (MEANINGLESS_LINK_TEXT.has(label)) {
          push({
            rule: 'link-text',
            severity: 'warning',
            title: `Link text “${node.text}” does not describe the destination`,
            fix: 'Reword the link to name what it links to, rather than “click here”.',
            pos: nodePos,
          });
        }
      }

      const textStyle = node.marks.find((mark) => mark.type === 'textStyle');
      const color = textStyle?.attrs?.color;
      if (typeof color === 'string' && color) {
        const highlight = node.marks.find((mark) => mark.type === 'highlight');
        const behind = (highlight?.attrs?.color as string | undefined) || background;
        const ratio = contrastRatio(color, behind);
        const size = parseFloat(String(textStyle?.attrs?.fontSize ?? '11'));
        const threshold = size >= 18 ? CONTRAST_AA_LARGE : CONTRAST_AA_NORMAL;
        if (ratio !== null && ratio < threshold) {
          push({
            rule: 'contrast',
            severity: 'warning',
            title: `Text contrast is ${ratio.toFixed(1)}:1, below the ${threshold}:1 minimum`,
            fix: 'Darken the font colour, or lighten what is behind it.',
            pos: nodePos,
          });
        }
      }
    }

    for (const child of node.content ?? []) visit(child);
    if (node.type === 'text') pos += Math.max(0, (node.text?.length ?? 1) - 1);
    else pos += 1;
  };

  for (const child of root.content) visit(child);
  return issues;
}
