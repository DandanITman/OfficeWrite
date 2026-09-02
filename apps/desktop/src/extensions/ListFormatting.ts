import { Extension } from '@tiptap/core';

/**
 * The Bullets, Numbering and Multilevel List galleries.
 *
 * The marker style lives on the list node so nested levels can differ, and so
 * the choice survives a save: `list-style-type` is what both the editor and the
 * HTML export read.
 */

export const BULLET_STYLES = [
  { id: 'disc', label: '•', css: 'disc' },
  { id: 'circle', label: '◦', css: 'circle' },
  { id: 'square', label: '▪', css: 'square' },
  { id: 'dash', label: '–', css: '"–  "' },
  { id: 'arrow', label: '➤', css: '"➤  "' },
  { id: 'check', label: '✓', css: '"✓  "' },
] as const;

export const NUMBER_STYLES = [
  { id: 'decimal', label: '1. 2. 3.', css: 'decimal' },
  { id: 'lower-alpha', label: 'a. b. c.', css: 'lower-alpha' },
  { id: 'upper-alpha', label: 'A. B. C.', css: 'upper-alpha' },
  { id: 'lower-roman', label: 'i. ii. iii.', css: 'lower-roman' },
  { id: 'upper-roman', label: 'I. II. III.', css: 'upper-roman' },
  { id: 'decimal-leading-zero', label: '01. 02. 03.', css: 'decimal-leading-zero' },
] as const;

/** Multilevel list schemes: the marker to use at each nesting depth. */
export const MULTILEVEL_SCHEMES = [
  { id: 'bulleted', label: 'Bulleted', levels: ['disc', 'circle', 'square'] },
  { id: 'numbered', label: '1. a. i.', levels: ['decimal', 'lower-alpha', 'lower-roman'] },
  { id: 'legal', label: '1. 1.1 1.1.1', levels: ['decimal', 'decimal', 'decimal'] },
  { id: 'articles', label: 'Article I. Section 1.01', levels: ['upper-roman', 'decimal', 'lower-alpha'] },
] as const;

const CSS_FOR_STYLE = new Map<string, string>([
  ...BULLET_STYLES.map((style) => [style.id, style.css] as [string, string]),
  ...NUMBER_STYLES.map((style) => [style.id, style.css] as [string, string]),
]);

export const ListFormatting = Extension.create({
  name: 'listFormatting',

  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          listStyle: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-list-style') || null,
            renderHTML: (attributes) => {
              if (!attributes.listStyle) return {};
              const css = CSS_FOR_STYLE.get(attributes.listStyle as string);
              return {
                'data-list-style': attributes.listStyle,
                ...(css ? { style: `list-style-type: ${css}` } : {}),
              };
            },
          },
          /** The multilevel scheme, so nested levels pick their own marker. */
          scheme: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-list-scheme') || null,
            renderHTML: (attributes) =>
              attributes.scheme ? { 'data-list-scheme': attributes.scheme } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setListStyle:
        (style: string) =>
        ({ editor, commands }) => {
          const type = editor.isActive('orderedList') ? 'orderedList' : 'bulletList';
          return commands.updateAttributes(type, { listStyle: style });
        },
      applyBulletStyle:
        (style: string) =>
        ({ editor, chain }) => {
          const alreadyBulleted = editor.isActive('bulletList');
          const run = chain().focus();
          if (!alreadyBulleted) run.toggleBulletList();
          return run.updateAttributes('bulletList', { listStyle: style, scheme: null }).run();
        },
      applyNumberStyle:
        (style: string) =>
        ({ editor, chain }) => {
          const alreadyNumbered = editor.isActive('orderedList');
          const run = chain().focus();
          if (!alreadyNumbered) run.toggleOrderedList();
          return run.updateAttributes('orderedList', { listStyle: style, scheme: null }).run();
        },
      applyMultilevelScheme:
        (schemeId: string) =>
        ({ editor, chain }) => {
          const scheme = MULTILEVEL_SCHEMES.find((entry) => entry.id === schemeId);
          if (!scheme) return false;
          const bulleted = scheme.id === 'bulleted';
          const type = bulleted ? 'bulletList' : 'orderedList';
          const run = chain().focus();
          if (!editor.isActive(type)) {
            run[bulleted ? 'toggleBulletList' : 'toggleOrderedList']();
          }
          return run
            .updateAttributes(type, { listStyle: scheme.levels[0], scheme: scheme.id })
            .run();
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    listFormatting: {
      setListStyle: (style: string) => ReturnType;
      applyBulletStyle: (style: string) => ReturnType;
      applyNumberStyle: (style: string) => ReturnType;
      applyMultilevelScheme: (schemeId: string) => ReturnType;
    };
  }
}
