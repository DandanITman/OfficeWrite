import { mergeFieldLabel, type MergeFieldAttrs } from '@officewrite/core';

type TipTapNode = {
  type?: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};

function escapeRtf(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, '\\par ');
}

function nodeToRtf(node: TipTapNode): string {
  /**
   * A merge field is an inline atom with no children, so the recursive
   * fall-through at the end of this function returned nothing for it - an RTF
   * export of a merge main document lost every field. It writes as its own
   * «FieldName» text, which is what Word displays.
   */
  if (node.type === 'mergeField') {
    return escapeRtf(mergeFieldLabel(node.attrs as unknown as MergeFieldAttrs));
  }
  if (node.type === 'text' && node.text) {
    let prefix = '';
    let suffix = '';
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') {
        prefix += '\\b ';
        suffix = '\\b0 ' + suffix;
      }
      if (mark.type === 'italic') {
        prefix += '\\i ';
        suffix = '\\i0 ' + suffix;
      }
      if (mark.type === 'underline') {
        prefix += '\\ul ';
        suffix = '\\ul0 ' + suffix;
      }
      if (mark.type === 'strike') {
        prefix += '\\strike ';
        suffix = '\\strike0 ' + suffix;
      }
      if (mark.type === 'superscript') {
        prefix += '\\super ';
        suffix = '\\nosupersub ' + suffix;
      }
      if (mark.type === 'subscript') {
        prefix += '\\sub ';
        suffix = '\\nosupersub ' + suffix;
      }
    }
    return `${prefix}${escapeRtf(node.text)}${suffix}`;
  }

  if (node.type === 'paragraph') {
    const inner = (node.content ?? []).map(nodeToRtf).join('');
    const indent = Number(node.attrs?.indentLevel ?? 0);
    return `${indent > 0 ? `\\li${indent * 540} ` : ''}${inner}\\par `;
  }

  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 1);
    const inner = (node.content ?? []).map(nodeToRtf).join('');
    return `{\\fs${28 - level * 2}\\b ${inner}}\\par `;
  }

  if (node.type === 'pageBreak') {
    return '\\page ';
  }

  if (node.type === 'columnBreak') {
    return '\\column ';
  }

  if (node.type === 'bulletList') {
    return (node.content ?? [])
      .map((item) => {
        const inner = (item.content ?? []).map(nodeToRtf).join('');
        return `\\bullet ${inner}\\par `;
      })
      .join('');
  }

  if (node.type === 'orderedList') {
    return (node.content ?? [])
      .map((item, i) => {
        const inner = (item.content ?? []).map(nodeToRtf).join('');
        return `${i + 1}. ${inner}\\par `;
      })
      .join('');
  }

  if (node.content) {
    return node.content.map(nodeToRtf).join('');
  }

  return '';
}

export function exportToRtf(content: unknown, title = 'Document'): string {
  const doc = content as TipTapNode;
  const body = (doc.content ?? []).map(nodeToRtf).join('');
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs22{\\info{\\title ${escapeRtf(title)}}}${body}}`;
}

export { importFromRtf } from "./rtfImport";
