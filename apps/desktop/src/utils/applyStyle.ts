import type { DocumentStyle } from '@officewrite/core';
import type { Editor } from '@tiptap/react';

/**
 * Apply a Styles gallery entry.
 *
 * A character style only decorates the run: applying
 * "Emphasis" to a word inside a heading must not turn the heading into a
 * paragraph or reset its spacing. A paragraph style owns the whole block, so it
 * sets the heading level, spacing, quote presentation and shading too.
 */
export function applyDocumentStyle(editor: Editor, style: DocumentStyle) {
  let chain = editor.chain().focus();

  const runAttrs: Record<string, string> = {};
  if (style.fontFamily) runAttrs.fontFamily = style.fontFamily;
  if (style.fontSize) runAttrs.fontSize = style.fontSize;
  if (style.color) runAttrs.color = style.color;
  if (style.uppercase) runAttrs.caps = 'all';

  if (style.kind === 'character') {
    chain = chain.setMark('textStyle', runAttrs);
    if (style.bold) chain = chain.setMark('bold');
    if (style.italic) chain = chain.setMark('italic');
    if (style.underline) chain = chain.setMark('underline');
    chain.run();
    return;
  }

  if (style.headingLevel) {
    chain = chain.setHeading({ level: style.headingLevel });
  } else {
    chain = chain.setParagraph().unsetAllMarks();
  }

  chain = chain.setMark('textStyle', runAttrs);
  chain = style.bold ? chain.setMark('bold') : chain.unsetMark('bold');
  chain = style.italic ? chain.setMark('italic') : chain.unsetMark('italic');
  chain = style.underline ? chain.setMark('underline') : chain.unsetMark('underline');

  chain = chain.setParagraphSpacing(style.spaceBefore ?? 0, style.spaceAfter ?? 0);
  chain = chain.setLineSpacing(style.lineHeight ?? '');
  chain = chain.setParagraphBorder(style.borderColor ?? (style.quote ? '#d0d0d0' : null));
  chain = chain.setParagraphShading(style.shading ?? null);
  chain = chain.setParagraphStyleId(style.id);

  chain.run();
}

/**
 * Re-apply the document's styles everywhere they are already used.
 *
 * Design's style sets and theme pickers change the *definitions*; the app then
 * refreshes every paragraph that carries the style. Without this pass, picking a
 * style set changed the gallery and nothing on the page.
 */
export function restyleDocument(editor: Editor, styles: DocumentStyle[]) {
  const byId = new Map(styles.map((style) => [style.id, style]));
  const targets: Array<{ pos: number; style: DocumentStyle }> = [];

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return;
    const styleId = node.attrs.styleId as string | null;
    // Headings without an explicit style id still follow the heading styles,
    // which is what makes an imported .docx respond to a style set.
    const resolved =
      (styleId && byId.get(styleId)) ||
      (node.type.name === 'heading' ? byId.get(`heading${node.attrs.level}`) : byId.get('normal'));
    if (resolved) targets.push({ pos, style: resolved });
  });

  if (!targets.length) return;

  const tr = editor.state.tr;
  const textStyle = editor.state.schema.marks.textStyle;

  for (const target of targets) {
    const node = tr.doc.nodeAt(target.pos);
    if (!node) continue;

    tr.setNodeMarkup(target.pos, undefined, {
      ...node.attrs,
      styleId: target.style.id,
      spaceBefore: target.style.spaceBefore ?? null,
      spaceAfter: target.style.spaceAfter ?? null,
      lineHeight: target.style.lineHeight ?? null,
      borderColor: target.style.borderColor ?? null,
      shading: target.style.shading ?? null,
    });

    if (!textStyle) continue;
    const from = target.pos + 1;
    const to = target.pos + node.nodeSize - 1;
    if (to <= from) continue;
    tr.removeMark(from, to, textStyle);
    tr.addMark(
      from,
      to,
      textStyle.create({
        ...(target.style.fontFamily ? { fontFamily: target.style.fontFamily } : {}),
        ...(target.style.fontSize ? { fontSize: target.style.fontSize } : {}),
        ...(target.style.color ? { color: target.style.color } : {}),
      }),
    );
  }

  if (tr.steps.length) editor.view.dispatch(tr);
}
