import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const formattingMarksKey = new PluginKey<boolean>('formattingMarks');

/**
 * Home > ¶ (Show/Hide Formatting Marks).
 *
 * A pilcrow is drawn at the end of every paragraph, a dot for each space, an
 * arrow for each tab and an anchor next to floating objects. These are widget
 * decorations rather than real characters, so they never reach the document,
 * the clipboard or an export.
 */
export const FormattingMarks = Extension.create<{ enabled: boolean }>({
  name: 'formattingMarks',

  addOptions() {
    return { enabled: false };
  },

  addProseMirrorPlugins() {
    const ext = this;

    const widget = (className: string, text: string) => () => {
      const span = document.createElement('span');
      span.className = `fmt-mark ${className}`;
      span.textContent = text;
      span.setAttribute('aria-hidden', 'true');
      return span;
    };

    return [
      new Plugin<boolean>({
        key: formattingMarksKey,
        state: {
          init() {
            return ext.options.enabled;
          },
          apply(tr, value) {
            const meta = tr.getMeta(formattingMarksKey);
            return typeof meta === 'boolean' ? meta : value;
          },
        },
        props: {
          decorations(state) {
            if (!formattingMarksKey.getState(state)) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                decorations.push(
                  Decoration.widget(pos + node.nodeSize - 1, widget('fmt-pilcrow', '¶'), {
                    side: 1,
                  }),
                );
              }
              if (node.isText && node.text) {
                for (let index = 0; index < node.text.length; index += 1) {
                  const char = node.text[index];
                  if (char === ' ') {
                    decorations.push(
                      Decoration.inline(pos + index, pos + index + 1, { class: 'fmt-space' }),
                    );
                  } else if (char === '\t') {
                    decorations.push(
                      Decoration.inline(pos + index, pos + index + 1, { class: 'fmt-tab' }),
                    );
                  }
                }
              }
              if (node.type.name === 'image' || node.type.name === 'textBox' || node.type.name === 'docShape') {
                decorations.push(Decoration.widget(pos, widget('fmt-anchor', '⚓'), { side: -1 }));
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/** Turn the marks on or off on a live editor. */
export function setFormattingMarks(editor: Editor, enabled: boolean) {
  editor.view.dispatch(editor.state.tr.setMeta(formattingMarksKey, enabled));
}
