import { Extension } from '@tiptap/core';

/**
 * The run-level formatting the Font group offers beyond bold and italic:
 * point size, underline style, capitalisation and text effects.
 *
 * These all live on the `textStyle` mark so they compose with each other and
 * survive copy/paste, and so a single "Clear All Formatting" removes them.
 */

export type UnderlineStyle = 'single' | 'double' | 'thick' | 'dotted' | 'dashed' | 'wavy';
export type CapsMode = 'none' | 'small' | 'all';
export type TextEffect = 'none' | 'shadow' | 'outline' | 'glow' | 'reflection';

export const UNDERLINE_STYLES: Array<{ id: UnderlineStyle; label: string }> = [
  { id: 'single', label: 'Single' },
  { id: 'double', label: 'Double' },
  { id: 'thick', label: 'Thick' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'wavy', label: 'Wavy' },
];

export const TEXT_EFFECTS: Array<{ id: TextEffect; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'outline', label: 'Outline' },
  { id: 'glow', label: 'Glow' },
  { id: 'reflection', label: 'Reflection' },
];

/** The font size list, plus the sizes its Grow/Shrink buttons step through. */
export const FONT_SIZES = [
  '8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72',
];

export function nextFontSize(current: number, direction: 1 | -1): number {
  const ladder = FONT_SIZES.map(Number);
  if (direction === 1) return ladder.find((size) => size > current) ?? Math.min(409, current + 10);
  return [...ladder].reverse().find((size) => size < current) ?? Math.max(1, current - 1);
}

const UNDERLINE_CSS: Record<UnderlineStyle, string> = {
  single: 'underline',
  double: 'underline double',
  thick: 'underline solid 3px',
  dotted: 'underline dotted',
  dashed: 'underline dashed',
  wavy: 'underline wavy',
};

export const CharacterFormatting = Extension.create({
  name: 'characterFormatting',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, '') || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
          underlineStyle: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-underline') || null,
            renderHTML: (attributes) => {
              const style = attributes.underlineStyle as UnderlineStyle | null;
              if (!style || style === 'single') return {};
              return {
                'data-underline': style,
                style: `text-decoration: ${UNDERLINE_CSS[style] ?? 'underline'}`,
              };
            },
          },
          caps: {
            default: null,
            parseHTML: (element) => {
              const variant = element.style.fontVariantCaps || element.style.fontVariant;
              if (variant?.includes('small-caps')) return 'small';
              if (element.style.textTransform === 'uppercase') return 'all';
              return null;
            },
            renderHTML: (attributes) => {
              if (attributes.caps === 'small') return { style: 'font-variant-caps: small-caps' };
              if (attributes.caps === 'all') return { style: 'text-transform: uppercase' };
              return {};
            },
          },
          textEffect: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-text-effect') || null,
            renderHTML: (attributes) => {
              const effect = attributes.textEffect as TextEffect | null;
              if (!effect || effect === 'none') return {};
              return { 'data-text-effect': effect, class: `text-effect-${effect}` };
            },
          },
          /** The inline equation runs: serif italic, like its linear format. */
          equation: {
            default: null,
            parseHTML: (element) => (element.getAttribute('data-equation') ? 'true' : null),
            renderHTML: (attributes) =>
              attributes.equation ? { 'data-equation': 'true', class: 'doc-equation' } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ editor, commands }) =>
          commands.setMark('textStyle', { ...editor.getAttributes('textStyle'), fontSize: size }),
      stepFontSize:
        (direction: 1 | -1) =>
        ({ editor, commands }) => {
          const current = Number(String(editor.getAttributes('textStyle').fontSize ?? '11pt').replace('pt', '')) || 11;
          return commands.setMark('textStyle', {
            ...editor.getAttributes('textStyle'),
            fontSize: `${nextFontSize(current, direction)}pt`,
          });
        },
      setUnderlineStyle:
        (style: UnderlineStyle) =>
        ({ editor, chain }) =>
          chain()
            .setMark('textStyle', { ...editor.getAttributes('textStyle'), underlineStyle: style })
            .setUnderline()
            .run(),
      setCaps:
        (mode: CapsMode) =>
        ({ editor, commands }) =>
          commands.setMark('textStyle', {
            ...editor.getAttributes('textStyle'),
            caps: mode === 'none' ? null : mode,
          }),
      setTextEffect:
        (effect: TextEffect) =>
        ({ editor, commands }) =>
          commands.setMark('textStyle', {
            ...editor.getAttributes('textStyle'),
            textEffect: effect === 'none' ? null : effect,
          }),
      toggleEquationRun:
        () =>
        ({ editor, commands }) => {
          const current = editor.getAttributes('textStyle');
          return commands.setMark('textStyle', {
            ...current,
            equation: current.equation ? null : 'true',
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // The Grow Font / Shrink Font shortcuts.
      'Mod->': () => this.editor.commands.stepFontSize(1),
      'Mod-<': () => this.editor.commands.stepFontSize(-1),
      'Mod-]': () => this.editor.commands.stepFontSize(1),
      'Mod-[': () => this.editor.commands.stepFontSize(-1),
      'Mod-Shift-d': () => this.editor.commands.setUnderlineStyle('double'),
      'Mod-Shift-k': () => this.editor.commands.setCaps('small'),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    characterFormatting: {
      setFontSize: (size: string) => ReturnType;
      stepFontSize: (direction: 1 | -1) => ReturnType;
      setUnderlineStyle: (style: UnderlineStyle) => ReturnType;
      setCaps: (mode: CapsMode) => ReturnType;
      setTextEffect: (effect: TextEffect) => ReturnType;
      toggleEquationRun: () => ReturnType;
    };
  }
}
