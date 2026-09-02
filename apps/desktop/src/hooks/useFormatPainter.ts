import { useCallback, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

export interface CopiedFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  superscript: boolean;
  subscript: boolean;
  fontFamily: string | null;
  fontSize: string | null;
  color: string | null;
  highlight: string | null;
  textAlign: string | null;
  indentLevel: number;
  lineHeight: string | null;
  spaceBefore: number | null;
  spaceAfter: number | null;
  borderColor: string | null;
  shading: string | null;
}

export function useFormatPainter(editor: Editor | null) {
  const [active, setActive] = useState(false);
  const copied = useRef<CopiedFormat | null>(null);

  const copyFormat = useCallback(() => {
    if (!editor) return;
    copied.current = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      superscript: editor.isActive('superscript'),
      subscript: editor.isActive('subscript'),
      fontFamily: editor.getAttributes('textStyle').fontFamily ?? null,
      fontSize: editor.getAttributes('textStyle').fontSize ?? null,
      color: editor.getAttributes('textStyle').color ?? null,
      highlight: editor.getAttributes('highlight').color ?? null,
      textAlign: editor.getAttributes('paragraph').textAlign ?? editor.getAttributes('heading').textAlign ?? null,
      indentLevel: Number(editor.getAttributes('paragraph').indentLevel ?? editor.getAttributes('heading').indentLevel ?? 0),
      lineHeight: editor.getAttributes('paragraph').lineHeight ?? editor.getAttributes('heading').lineHeight ?? null,
      spaceBefore: editor.getAttributes('paragraph').spaceBefore ?? editor.getAttributes('heading').spaceBefore ?? null,
      spaceAfter: editor.getAttributes('paragraph').spaceAfter ?? editor.getAttributes('heading').spaceAfter ?? null,
      borderColor: editor.getAttributes('paragraph').borderColor ?? editor.getAttributes('heading').borderColor ?? null,
      shading: editor.getAttributes('paragraph').shading ?? editor.getAttributes('heading').shading ?? null,
    };
    setActive(true);
  }, [editor]);

  const applyFormat = useCallback(() => {
    if (!editor || !copied.current) return;
    const f = copied.current;
    let chain = editor.chain().focus();

    if (f.bold) chain = chain.setMark('bold');
    else chain = chain.unsetMark('bold');
    if (f.italic) chain = chain.setMark('italic');
    else chain = chain.unsetMark('italic');
    if (f.underline) chain = chain.setMark('underline');
    else chain = chain.unsetMark('underline');
    if (f.strike) chain = chain.setMark('strike');
    else chain = chain.unsetMark('strike');
    if (f.superscript) chain = chain.setMark('superscript').unsetMark('subscript');
    else chain = chain.unsetMark('superscript');
    if (f.subscript) chain = chain.setMark('subscript').unsetMark('superscript');
    else chain = chain.unsetMark('subscript');
    if (f.fontFamily) chain = chain.setFontFamily(f.fontFamily);
    if (f.fontSize) chain = chain.setMark('textStyle', { ...editor.getAttributes('textStyle'), fontSize: f.fontSize });
    if (f.color) chain = chain.setColor(f.color);
    if (f.highlight) chain = chain.setHighlight({ color: f.highlight });
    if (f.textAlign) {
      chain = chain.setTextAlign(f.textAlign as 'left' | 'center' | 'right' | 'justify');
    }
    chain = chain.updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', {
      indentLevel: f.indentLevel,
      lineHeight: f.lineHeight,
      spaceBefore: f.spaceBefore,
      spaceAfter: f.spaceAfter,
      borderColor: f.borderColor,
      shading: f.shading,
    });

    chain.run();
    setActive(false);
    copied.current = null;
  }, [editor]);

  return { active, copyFormat, applyFormat };
}
