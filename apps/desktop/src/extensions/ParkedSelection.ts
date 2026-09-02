import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Keeps the selection visible while focus is elsewhere.
 *
 * A browser paints `::selection` only in the focused element, so clicking into
 * a ribbon box made the highlight vanish - you could not see what you were
 * about to format, which is exactly when you most want to. A ribbon should keep showing
 * the selection, greyed, so this decorates the range whenever the editor is
 * blurred and a selection exists.
 */
const key = new PluginKey<boolean>('parkedSelection');

export const ParkedSelection = Extension.create({
  name: 'parkedSelection',

  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key,
        state: {
          init: () => true,
          apply(tr, focused) {
            const next = tr.getMeta(key);
            return typeof next === 'boolean' ? next : focused;
          },
        },
        props: {
          handleDOMEvents: {
            focus: (view) => {
              view.dispatch(view.state.tr.setMeta(key, true));
              return false;
            },
            blur: (view) => {
              view.dispatch(view.state.tr.setMeta(key, false));
              return false;
            },
          },
          decorations(state) {
            const { from, to, empty } = state.selection;
            if (empty || key.getState(state) !== false) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.inline(from, to, { class: 'pm-selection-parked' }),
            ]);
          },
        },
      }),
    ];
  },
});
