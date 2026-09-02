import { Mark, Node, mergeAttributes } from '@tiptap/core';

/**
 * The reference "fields" a word processor inserts into a document: bookmarks, index
 * entries, and the generated blocks (bibliography, index, table of figures).
 *
 * The generated blocks hold a snapshot of their entries, exactly as such a field
 * holds its last-updated result. The ribbon's Update commands recompute them -
 * which is why a word processor makes you press Update Table too.
 */

export const Bookmark = Mark.create({
  name: 'bookmark',
  inclusive: false,

  addAttributes() {
    return {
      name: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-bookmark]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { name, ...rest } = HTMLAttributes;
    return [
      'span',
      mergeAttributes(rest, { 'data-bookmark': name, class: 'doc-bookmark', title: `Bookmark: ${name}` }),
      0,
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (name: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { name }),
      unsetBookmark:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

export const IndexEntry = Mark.create({
  name: 'indexEntry',
  inclusive: false,

  addAttributes() {
    return {
      entry: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-index-entry]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { entry, ...rest } = HTMLAttributes;
    return [
      'span',
      mergeAttributes(rest, {
        'data-index-entry': entry,
        class: 'doc-index-entry',
        title: `Index entry: ${entry}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      markIndexEntry:
        (entry: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { entry }),
    };
  },
});

/** A generated list block: bibliography, index or table of figures. */
function generatedList(name: string, className: string, defaultTitle: string) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,

    addAttributes() {
      return {
        title: { default: defaultTitle },
        entries: { default: [] as string[] },
      };
    },

    parseHTML() {
      return [
        {
          tag: `div[data-${className}]`,
          getAttrs: (element) => {
            const el = element as HTMLElement;
            const entries = Array.from(el.querySelectorAll('li')).map((li) => li.textContent ?? '');
            return { title: el.getAttribute('data-title') ?? defaultTitle, entries };
          },
        },
      ];
    },

    renderHTML({ node }) {
      const entries = (node.attrs.entries as string[]) ?? [];
      return [
        'div',
        {
          [`data-${className}`]: 'true',
          'data-title': node.attrs.title,
          class: `doc-generated ${className}`,
        },
        ['p', { class: 'doc-generated-title' }, node.attrs.title],
        ['ul', {}, ...entries.map((entry) => ['li', {}, entry] as [string, object, string])],
      ];
    },

    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement('div');
        dom.className = `doc-generated ${className}`;
        dom.setAttribute(`data-${className}`, 'true');
        dom.contentEditable = 'false';

        const render = (attrs: Record<string, unknown>) => {
          dom.innerHTML = '';
          const title = document.createElement('p');
          title.className = 'doc-generated-title';
          title.textContent = String(attrs.title ?? defaultTitle);
          dom.appendChild(title);

          const entries = (attrs.entries as string[]) ?? [];
          if (!entries.length) {
            const empty = document.createElement('p');
            empty.className = 'doc-generated-empty muted';
            empty.textContent = 'Nothing to list yet.';
            dom.appendChild(empty);
            return;
          }
          const list = document.createElement('ul');
          for (const entry of entries) {
            const item = document.createElement('li');
            item.textContent = entry;
            list.appendChild(item);
          }
          dom.appendChild(list);
        };

        render(node.attrs);

        return {
          dom,
          update(updated) {
            if (updated.type.name !== name) return false;
            render(updated.attrs);
            return true;
          },
          ignoreMutation() {
            return true;
          },
        };
      };
    },
  });
}

export const Bibliography = generatedList('bibliography', 'doc-bibliography', 'Bibliography');
export const DocumentIndex = generatedList('documentIndex', 'doc-index', 'Index');
export const TableOfFigures = generatedList('tableOfFigures', 'doc-figures', 'Table of Figures');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (name: string) => ReturnType;
      unsetBookmark: () => ReturnType;
    };
    indexEntry: {
      markIndexEntry: (entry: string) => ReturnType;
    };
  }
}
