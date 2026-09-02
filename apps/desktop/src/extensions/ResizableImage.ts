import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { mergeAttributes } from '@tiptap/core';
import { ImageBlockView } from '../components/ImageBlockView';

/** The Wrap Text choices, in the order the menu lists them. */
export type ImageWrap =
  | 'inline'
  | 'square'
  | 'tight'
  | 'through'
  | 'topBottom'
  | 'behind'
  | 'front';

export const IMAGE_WRAPS: Array<{ id: ImageWrap; label: string; hint: string }> = [
  { id: 'inline', label: 'In Line with Text', hint: 'The picture sits in the line of text.' },
  { id: 'square', label: 'Square', hint: 'Text wraps around a rectangle.' },
  { id: 'tight', label: 'Tight', hint: 'Text follows the picture edge closely.' },
  { id: 'through', label: 'Through', hint: 'Text flows through open areas.' },
  { id: 'topBottom', label: 'Top and Bottom', hint: 'Text stops above and resumes below.' },
  { id: 'behind', label: 'Behind Text', hint: 'The picture sits behind the text.' },
  { id: 'front', label: 'In Front of Text', hint: 'The picture covers the text.' },
];

/** Picture Format > Picture Styles. */
export type ImageFrame = 'none' | 'rounded' | 'shadow' | 'border' | 'thick' | 'oval';

export const IMAGE_FRAMES: Array<{ id: ImageFrame; label: string }> = [
  { id: 'none', label: 'No style' },
  { id: 'border', label: 'Simple frame' },
  { id: 'thick', label: 'Thick frame' },
  { id: 'rounded', label: 'Rounded corners' },
  { id: 'shadow', label: 'Drop shadow' },
  { id: 'oval', label: 'Oval' },
];

/** Picture Format > Position: the nine-cell "Position in Text Wrapping". */
export type ImagePosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'middleLeft'
  | 'middleCenter'
  | 'middleRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

export const ResizableImage = Image.extend({
  name: 'image',
  draggable: true,
  selectable: true,
  atom: true,

  addAttributes() {
    const numeric = (name: string, fallback: number) => ({
      default: fallback,
      parseHTML: (el: HTMLElement) => {
        const raw = el.dataset[name];
        const parsed = Number(raw);
        return raw != null && Number.isFinite(parsed) ? parsed : fallback;
      },
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs[name] === fallback ? {} : { [`data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`]: attrs[name] },
    });

    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).getAttribute('width') ?? (el as HTMLElement).style.width;
          if (!w) return null;
          const n = parseInt(String(w), 10);
          return Number.isNaN(n) ? null : n;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width, style: `width:${attrs.width}px` } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const h = (el as HTMLElement).getAttribute('height');
          if (!h) return null;
          const n = parseInt(h, 10);
          return Number.isNaN(n) ? null : n;
        },
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
      align: {
        default: 'left',
        parseHTML: (el) => (el as HTMLElement).dataset.align ?? 'left',
        renderHTML: (attrs) => ({ 'data-align': attrs.align }),
      },
      wrap: {
        default: 'square' as ImageWrap,
        parseHTML: (el) => (el as HTMLElement).dataset.wrap ?? 'square',
        renderHTML: (attrs) => ({ 'data-wrap': attrs.wrap }),
      },
      offsetX: numeric('offsetX', 0),
      offsetY: numeric('offsetY', 0),
      rotation: numeric('rotation', 0),
      // Stacking order for floating objects. Two overlapping floats could be
      // created and then never reordered - Bring Forward / Send Backward.
      z: numeric('z', 0),
      brightness: numeric('brightness', 100),
      contrast: numeric('contrast', 100),
      saturation: numeric('saturation', 100),
      frame: {
        default: 'none' as ImageFrame,
        parseHTML: (el) => (el as HTMLElement).dataset.frame ?? 'none',
        renderHTML: (attrs) => (attrs.frame && attrs.frame !== 'none' ? { 'data-frame': attrs.frame } : {}),
      },
      borderColor: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).dataset.borderColor ?? null,
        renderHTML: (attrs) => (attrs.borderColor ? { 'data-border-color': attrs.borderColor } : {}),
      },
      lockAspect: {
        default: true,
        parseHTML: (el) => (el as HTMLElement).dataset.lockAspect !== 'false',
        renderHTML: (attrs) => (attrs.lockAspect === false ? { 'data-lock-aspect': 'false' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const filters: string[] = [];
    const brightness = Number(HTMLAttributes['data-brightness'] ?? 100);
    const contrast = Number(HTMLAttributes['data-contrast'] ?? 100);
    const saturation = Number(HTMLAttributes['data-saturation'] ?? 100);
    if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
    if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
    if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
    const rotation = Number(HTMLAttributes['data-rotation'] ?? 0);

    const style = [
      HTMLAttributes.width ? `width:${HTMLAttributes.width}px` : '',
      filters.length ? `filter:${filters.join(' ')}` : '',
      rotation ? `transform:rotate(${rotation}deg)` : '',
    ]
      .filter(Boolean)
      .join(';');

    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'doc-image',
        ...(style ? { style } : {}),
      }),
    ];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlign:
        (align: 'left' | 'center' | 'right') =>
        ({ commands }) =>
          commands.updateAttributes('image', { align, offsetX: 0 }),
      setImageWrap:
        (wrap: ImageWrap) =>
        ({ commands }) =>
          commands.updateAttributes('image', { wrap }),
      /** Arrow-key nudging of a selected picture. */
      nudgeImage:
        (dx: number, dy: number) =>
        ({ editor, commands }) => {
          const attrs = editor.getAttributes('image');
          return commands.updateAttributes('image', {
            offsetX: Number(attrs.offsetX ?? 0) + dx,
            offsetY: Number(attrs.offsetY ?? 0) + dy,
          });
        },
      rotateImage:
        (degrees: number) =>
        ({ editor, commands }) => {
          const current = Number(editor.getAttributes('image').rotation ?? 0);
          return commands.updateAttributes('image', { rotation: (current + degrees + 360) % 360 });
        },
      /** Picture Format > Reset Picture. */
      resetImage:
        () =>
        ({ commands }) =>
          commands.updateAttributes('image', {
            rotation: 0,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            frame: 'none',
            borderColor: null,
            offsetX: 0,
            offsetY: 0,
          }),
      /** Picture Format > Position: place the picture in one of nine spots. */
      setImagePosition:
        (position: ImagePosition) =>
        ({ commands }) => {
          const horizontal = position.endsWith('Left')
            ? 'left'
            : position.endsWith('Right')
              ? 'right'
              : 'center';
          const vertical = position.startsWith('top') ? 0 : position.startsWith('middle') ? 120 : 260;
          return commands.updateAttributes('image', {
            align: horizontal,
            offsetX: 0,
            offsetY: vertical,
            wrap: 'square',
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
}).configure({
  allowBase64: true,
  inline: false,
  HTMLAttributes: { class: 'doc-image' },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImageAlign: (align: 'left' | 'center' | 'right') => ReturnType;
      setImageWrap: (wrap: ImageWrap) => ReturnType;
      nudgeImage: (dx: number, dy: number) => ReturnType;
      rotateImage: (degrees: number) => ReturnType;
      resetImage: () => ReturnType;
      setImagePosition: (position: ImagePosition) => ReturnType;
    };
  }
}
