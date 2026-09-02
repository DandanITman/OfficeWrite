import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TextBoxView } from '../components/TextBoxView';

export type TextBoxStyle = 'simple' | 'sidebar' | 'quote';

/**
 * Insert > Text Box.
 *
 * A block that holds real paragraphs, so everything on the Home tab keeps
 * working inside it, positioned and wrapped like a floating picture.
 */
export const TextBox = Node.create({
  name: 'textBox',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      boxStyle: { default: 'simple' as TextBoxStyle },
      width: { default: 280 },
      height: { default: null as number | null },
      align: { default: 'left' },
      wrap: { default: 'square' },
      z: { default: 0 },
      offsetX: { default: 0 },
      offsetY: { default: 0 },
      fill: { default: '#ffffff' },
      borderColor: { default: '#8faadc' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-text-box]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            boxStyle: el.dataset.boxStyle ?? 'simple',
            width: Number(el.dataset.width ?? 280),
            height: el.dataset.height ? Number(el.dataset.height) : null,
            align: el.dataset.align ?? 'left',
            wrap: el.dataset.wrap ?? 'square',
            z: Number(el.dataset.z ?? 0),
            offsetX: Number(el.dataset.offsetX ?? 0),
            offsetY: Number(el.dataset.offsetY ?? 0),
            fill: el.dataset.fill ?? '#ffffff',
            borderColor: el.dataset.borderColor ?? '#8faadc',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as Record<string, unknown>;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-text-box': 'true',
        'data-box-style': String(attrs.boxStyle),
        'data-width': String(attrs.width),
        'data-align': String(attrs.align),
        'data-wrap': String(attrs.wrap),
        'data-z': String(attrs.z ?? 0),
        class: `doc-text-box style-${String(attrs.boxStyle)}`,
        style: `width:${Number(attrs.width)}px;background:${String(attrs.fill)};border:1px solid ${String(attrs.borderColor)}`,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TextBoxView);
  },

  addCommands() {
    return {
      insertTextBox:
        (style: TextBoxStyle = 'simple') =>
        ({ commands }) => {
          const placeholder =
            style === 'quote'
              ? 'Pull a quote from the document and place it here.'
              : style === 'sidebar'
                ? 'Use a sidebar to call out related information.'
                : 'Type your text here.';
          return commands.insertContent({
            type: this.name,
            attrs: {
              boxStyle: style,
              width: style === 'sidebar' ? 220 : 300,
              align: style === 'sidebar' ? 'right' : 'left',
              wrap: 'square',
              fill: style === 'quote' ? '#f4f7fc' : '#ffffff',
              borderColor: style === 'quote' ? '#2f5496' : '#8faadc',
            },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: placeholder }] }],
          });
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textBox: {
      insertTextBox: (style?: TextBoxStyle) => ReturnType;
    };
  }
}
