import { Node } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { extractHeadingsFromDoc } from '../utils/headings';

function renderTocDom(dom: HTMLElement, doc: ProseMirrorNode, onNavigate: (pos: number) => void) {
  dom.innerHTML = '';
  const title = document.createElement('p');
  title.className = 'doc-toc-title';
  title.textContent = 'Table of Contents';
  dom.appendChild(title);

  const headings = extractHeadingsFromDoc(doc);
  if (!headings.length) {
    const empty = document.createElement('p');
    empty.className = 'doc-toc-empty muted';
    empty.textContent = 'Add headings to populate this table.';
    dom.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'doc-toc-list';
  for (const h of headings) {
    const li = document.createElement('li');
    li.className = `doc-toc-item level-${h.level}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = h.text || '(empty heading)';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onNavigate(h.pos + 1);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
  dom.appendChild(list);
}

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      /**
       * Bumped by References > Update Table.
       *
       * The node view already re-renders on every document change, so the table
       * is always current; changing an attribute is what gives the explicit
       * Update command a transaction to dispatch, and the user visible feedback
       * that it did something.
       */
      generation: { default: 0 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-table-of-contents]' }];
  },
  renderHTML() {
    return ['div', { 'data-table-of-contents': 'true', class: 'doc-toc' }];
  },
  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement('div');
      dom.className = 'doc-toc';
      dom.dataset.tableOfContents = 'true';
      dom.contentEditable = 'false';

      const render = () => {
        renderTocDom(dom, editor.state.doc, (pos) => {
          editor.chain().focus().setTextSelection(pos).run();
        });
      };

      render();
      const onUpdate = () => render();
      editor.on('update', onUpdate);

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'tableOfContents') return false;
          render();
          return true;
        },
        destroy() {
          editor.off('update', onUpdate);
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});
