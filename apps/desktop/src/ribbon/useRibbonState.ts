import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';

export interface RibbonState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  underlineStyle: string;
  strike: boolean;
  superscript: boolean;
  subscript: boolean;
  smallCaps: boolean;
  allCaps: boolean;
  textEffect: string;
  bulletList: boolean;
  orderedList: boolean;
  listStyle: string;
  blockquote: boolean;
  codeBlock: boolean;
  link: boolean;
  linkHref: string;

  align: 'left' | 'center' | 'right' | 'justify' | null;
  /** Home > Paragraph: the block's text direction, 'ltr' unless set. */
  textDirection: 'ltr' | 'rtl';
  headingLevel: number | null;
  /** The Styles gallery entry applied to the current block, if any. */
  styleId: string;

  fontFamily: string;
  fontSize: string;
  color: string | null;
  highlight: string | null;
  lineHeight: string;
  borderColor: string | null;
  shading: string | null;
  indentLevel: number;
  indentRight: number;
  spaceBefore: number;
  spaceAfter: number;
  dropCap: boolean;

  imageActive: boolean;
  imageAlign: string;
  imageWrap: string;
  imageWidth: number | null;
  imageHeight: number | null;
  imageLockAspect: boolean;
  imageRotation: number;
  imageFrame: string;
  imageBorderColor: string | null;
  imageBrightness: number;
  imageContrast: number;
  imageSaturation: number;
  imageAltText: string;

  shapeActive: boolean;
  /** Alignment and wrap of the selected shape or text box. */
  objectAlign: string;
  objectWrap: string;
  inkActive: boolean;
  textBoxActive: boolean;

  inTable: boolean;
  tableHeaderRow: boolean;
  tableStyle: string;

  hasSelection: boolean;
  selectionText: string;
  bookmarkName: string;

  canUndo: boolean;
  canRedo: boolean;
}

const EMPTY: RibbonState = {
  bold: false,
  italic: false,
  underline: false,
  underlineStyle: 'single',
  strike: false,
  superscript: false,
  subscript: false,
  smallCaps: false,
  allCaps: false,
  textEffect: '',
  bulletList: false,
  orderedList: false,
  listStyle: '',
  blockquote: false,
  codeBlock: false,
  link: false,
  linkHref: '',
  align: null,
  textDirection: 'ltr',
  headingLevel: null,
  styleId: '',
  fontFamily: 'Calibri',
  fontSize: '11',
  color: null,
  highlight: null,
  lineHeight: '',
  borderColor: null,
  shading: null,
  indentLevel: 0,
  indentRight: 0,
  spaceBefore: 0,
  spaceAfter: 0,
  dropCap: false,
  imageActive: false,
  imageAlign: 'left',
  imageWrap: 'square',
  imageWidth: null,
  imageHeight: null,
  imageLockAspect: true,
  imageRotation: 0,
  imageFrame: 'none',
  imageBorderColor: null,
  imageBrightness: 100,
  imageContrast: 100,
  imageSaturation: 100,
  imageAltText: '',
  shapeActive: false,
  objectAlign: 'left',
  objectWrap: 'inline',
  inkActive: false,
  textBoxActive: false,
  inTable: false,
  tableHeaderRow: false,
  tableStyle: 'grid',
  hasSelection: false,
  selectionText: '',
  bookmarkName: '',
  canUndo: false,
  canRedo: false,
};

/**
 * Ribbon control state, recomputed on every editor transaction.
 *
 * The ribbon used to call `editor.isActive(...)` directly during App's render.
 * In TipTap v2 `useEditor` re-renders only the component that owns the hook,
 * and App re-rendered only when the document *content* changed - so a
 * selection-only transaction (moving the caret, clicking an image) updated
 * nothing. Bold stayed lit after leaving bold text, the font dropdowns showed
 * whatever was true at the last edit, and the contextual picture group never
 * appeared because selecting an image changes no content.
 *
 * `useEditorState` subscribes to the transaction counter instead, so caret
 * movement refreshes these values, and its equality check keeps unrelated
 * transactions from re-rendering the ribbon.
 */
export function useRibbonState(editor: Editor | null): RibbonState {
  return useEditorState({
    editor,
    selector: ({ editor: instance }): RibbonState => {
      if (!instance) return EMPTY;

      const textStyle = instance.getAttributes('textStyle');
      const paragraph = instance.getAttributes('paragraph');
      const heading = instance.getAttributes('heading');
      const image = instance.getAttributes('image');
      const table = instance.getAttributes('table');
      // Shapes and text boxes share the Arrange group, so the ribbon reads
      // whichever of the two is selected.
      const shape = instance.getAttributes('docShape');
      const textBox = instance.getAttributes('textBox');
      const object = instance.isActive('docShape') ? shape : textBox;
      const bulletList = instance.getAttributes('bulletList');
      const orderedList = instance.getAttributes('orderedList');
      const block = instance.isActive('heading') ? heading : paragraph;

      const headingLevel = instance.isActive('heading') ? Number(heading.level ?? 0) || null : null;

      const align = (['left', 'center', 'right', 'justify'] as const).find((value) =>
        instance.isActive({ textAlign: value }),
      );

      const { from, to, empty } = instance.state.selection;
      const selectionText = empty ? '' : instance.state.doc.textBetween(from, to, ' ');
      const bookmark = instance.getAttributes('bookmark');

      return {
        bold: instance.isActive('bold'),
        italic: instance.isActive('italic'),
        underline: instance.isActive('underline'),
        underlineStyle: String(textStyle.underlineStyle ?? 'single'),
        strike: instance.isActive('strike'),
        superscript: instance.isActive('superscript'),
        subscript: instance.isActive('subscript'),
        smallCaps: textStyle.caps === 'small',
        allCaps: textStyle.caps === 'all',
        textEffect: String(textStyle.textEffect ?? ''),
        bulletList: instance.isActive('bulletList'),
        orderedList: instance.isActive('orderedList'),
        listStyle: String(bulletList.listStyle ?? orderedList.listStyle ?? ''),
        blockquote: instance.isActive('blockquote'),
        codeBlock: instance.isActive('codeBlock'),
        link: instance.isActive('link'),
        linkHref: String(instance.getAttributes('link').href ?? ''),

        align: align ?? null,
        textDirection: block.textDirection === 'rtl' ? 'rtl' : 'ltr',
        headingLevel,
        styleId: String(block.styleId ?? ''),

        fontFamily: String(textStyle.fontFamily ?? 'Calibri'),
        fontSize: String(textStyle.fontSize ?? '11pt').replace('pt', ''),
        color: (textStyle.color as string | undefined) ?? null,
        highlight: (instance.getAttributes('highlight').color as string | undefined) ?? null,
        lineHeight: String(block.lineHeight ?? ''),
        borderColor: (block.borderColor as string | undefined) ?? null,
        shading: (block.shading as string | undefined) ?? null,
        indentLevel: Number(block.indentLevel ?? 0),
        indentRight: Number(block.indentRight ?? 0),
        spaceBefore: Number(block.spaceBefore ?? 0),
        spaceAfter: Number(block.spaceAfter ?? 0),
        dropCap: Boolean(block.dropCap),

        imageActive: instance.isActive('image'),
        imageAlign: String(image.align ?? 'left'),
        imageWrap: String(image.wrap ?? 'square'),
        imageWidth: image.width == null ? null : Number(image.width),
        imageHeight: image.height == null ? null : Number(image.height),
        imageLockAspect: image.lockAspect !== false,
        imageRotation: Number(image.rotation ?? 0),
        imageFrame: String(image.frame ?? 'none'),
        imageBorderColor: (image.borderColor as string | undefined) ?? null,
        imageBrightness: Number(image.brightness ?? 100),
        imageContrast: Number(image.contrast ?? 100),
        imageSaturation: Number(image.saturation ?? 100),
        imageAltText: String(image.alt ?? ''),

        shapeActive: instance.isActive('docShape'),
        objectAlign: String(object.align ?? 'left'),
        objectWrap: String(object.wrap ?? 'inline'),
        inkActive: instance.isActive('inkDrawing'),
        textBoxActive: instance.isActive('textBox'),

        inTable: instance.isActive('table'),
        tableHeaderRow: instance.isActive('tableHeader'),
        tableStyle: String(table.tableStyle ?? 'grid'),

        hasSelection: !empty,
        selectionText,
        bookmarkName: String(bookmark.name ?? ''),

        canUndo: instance.can().undo(),
        canRedo: instance.can().redo(),
      };
    },
  }) ?? EMPTY;
}
