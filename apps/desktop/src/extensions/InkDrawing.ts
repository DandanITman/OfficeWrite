import { Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { InkDrawingView } from '../components/InkDrawingView';

/** Draw tab tools. "select" leaves the canvas alone so it can be moved. */
export type InkTool = 'select' | 'pen' | 'highlighter' | 'eraser';

export interface InkStroke {
  /** Flattened x,y pairs, in canvas coordinates. */
  points: number[];
  color: string;
  width: number;
  tool: 'pen' | 'highlighter';
}

export const INK_COLORS = [
  '#000000',
  '#e02b2b',
  '#1c6fd0',
  '#1d8a4a',
  '#e0a800',
  '#8a3ffc',
  '#ff7ac6',
  '#7a7a7a',
];

export const INK_WIDTHS = [1, 2, 4, 8, 14];

/**
 * Draw > Drawing Canvas: freehand ink stored as point lists.
 *
 * Strokes are vectors rather than a bitmap so they scale with zoom and survive
 * a save at full fidelity, and so the eraser can remove a whole stroke the way
 * a stroke eraser does.
 */
export const InkDrawing = Node.create({
  name: 'inkDrawing',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      width: { default: 560 },
      height: { default: 240 },
      strokes: { default: [] as InkStroke[] },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-ink-drawing]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          let strokes: InkStroke[] = [];
          try {
            strokes = JSON.parse(el.dataset.strokes ?? '[]') as InkStroke[];
          } catch {
            strokes = [];
          }
          return {
            width: Number(el.dataset.width ?? 560),
            height: Number(el.dataset.height ?? 240),
            strokes,
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const strokes = (node.attrs.strokes as InkStroke[]) ?? [];
    const width = Number(node.attrs.width);
    const height = Number(node.attrs.height);

    // Also emit the strokes as an inline SVG so exported HTML and print show the
    // drawing rather than an empty box.
    const paths = strokes.map((stroke) => {
      const d = stroke.points.reduce((acc, value, index) => {
        if (index % 2 === 1) return acc;
        const command = index === 0 ? 'M' : 'L';
        return `${acc}${command}${value} ${stroke.points[index + 1]} `;
      }, '');
      return [
        'path',
        {
          d: d.trim(),
          fill: 'none',
          stroke: stroke.color,
          'stroke-width': String(stroke.width),
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          ...(stroke.tool === 'highlighter' ? { opacity: '0.35' } : {}),
        },
      ] as [string, Record<string, string>];
    });

    return [
      'div',
      mergeAttributes(
        {},
        {
          'data-ink-drawing': 'true',
          'data-width': String(width),
          'data-height': String(height),
          'data-strokes': JSON.stringify(strokes),
          class: 'doc-ink',
        },
      ),
      ['svg', { width: String(width), height: String(height), viewBox: `0 0 ${width} ${height}` }, ...paths],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InkDrawingView);
  },

  addCommands() {
    return {
      insertDrawingCanvas:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { width: 560, height: 240, strokes: [] } })
            // insertContent leaves the caret past the atom, which is not a node
            // selection - so the contextual Draw tab would never open on insert.
            // Step back onto the canvas and select it.
            .command(({ tr, dispatch }) => {
              const pos = tr.selection.from - 1;
              if (pos < 0) return true;
              if (tr.doc.nodeAt(pos)?.type.name !== this.name) return true;
              if (dispatch) tr.setSelection(NodeSelection.create(tr.doc, pos));
              return true;
            })
            .run(),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inkDrawing: {
      insertDrawingCanvas: () => ReturnType;
    };
  }
}
