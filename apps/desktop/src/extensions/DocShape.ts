import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ShapeBlockView } from '../components/ShapeBlockView';

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'line' | 'arrow';

export const DocShape = Node.create({
  name: 'docShape',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      shapeType: { default: 'rect' as ShapeType },
      width: { default: 160 },
      height: { default: 100 },
      fill: { default: '#3b82f6' },
      stroke: { default: '#1e40af' },
      strokeWidth: { default: 2 },
      // A shape had no alignment or wrap, so once inserted there was no way to
      // position it. These mirror the text box's, which the Arrange group on
      // Layout now drives for both.
      align: { default: 'left' },
      wrap: { default: 'inline' },
      z: { default: 0 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-doc-shape]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            align: el.dataset.align ?? 'left',
            wrap: el.dataset.wrap ?? 'inline',
            z: Number(el.dataset.z ?? 0),
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
        'data-doc-shape': 'true',
        'data-align': String(attrs.align),
        'data-wrap': String(attrs.wrap),
        'data-z': String(attrs.z ?? 0),
        class: `doc-shape align-${String(attrs.align)} wrap-${String(attrs.wrap)}`,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ShapeBlockView);
  },

  addCommands() {
    return {
      insertShape:
        (attrs?: Partial<{ shapeType: ShapeType; width: number; height: number }>) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { shapeType: 'rect', width: 160, height: 100, ...attrs },
          }),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docShape: {
      insertShape: (attrs?: Partial<{ shapeType: ShapeType; width: number; height: number }>) => ReturnType;
    };
  }
}
