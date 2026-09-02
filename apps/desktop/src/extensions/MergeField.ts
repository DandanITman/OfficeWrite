import { Node, mergeAttributes } from '@tiptap/core';
import {
  DEFAULT_ADDRESS_BLOCK,
  DEFAULT_GREETING_LINE,
  emptyMergeContext,
  mergeFieldLabel,
  resolveMergeField,
  type MergeContext,
  type MergeFieldAttrs,
} from '@officewrite/core';

/**
 * A mail-merge field in the document.
 *
 * One node type carries all four kinds - a data column, Address Block, Greeting
 * Line and the rules - because that is what they all are: fields. Splitting
 * them into four nodes would mean four schema entries, four sets of `.docx`
 * plumbing and four places for Preview Results to forget one.
 *
 * An inline atom, so it behaves like a single character: arrow keys step over
 * it, Backspace removes the whole field, and it can sit mid-sentence. A field
 * whose text the user could edit halfway would no longer be a field.
 */

/** Preview state the node views read. Owned by App, mirrored here like the pen. */
export interface MergePreviewState {
  active: boolean;
  /** The Highlight Merge Fields toggle. */
  highlight: boolean;
  context: MergeContext;
}

export const MERGE_PREVIEW_EVENT = 'officewrite:merge-preview';

export function currentMergePreview(): MergePreviewState {
  return (
    window.__OFFICEWRITE_MERGE__ ?? {
      active: false,
      highlight: false,
      context: emptyMergeContext(),
    }
  );
}

/**
 * Publish the preview state and wake the node views.
 *
 * A ProseMirror decoration would be the other option, but the preview has to
 * replace the field's *text*, not decorate it, and re-running a transaction on
 * every record step would put thirty document edits into the undo stack for
 * clicking Next Record thirty times.
 */
export function setMergePreview(state: MergePreviewState): void {
  window.__OFFICEWRITE_MERGE__ = state;
  window.dispatchEvent(new Event(MERGE_PREVIEW_EVENT));
}

export const MergeField = Node.create({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      kind: { default: 'field' },
      field: { default: '' },
      rule: { default: null },
      name: { default: '' },
      prompt: { default: '' },
      defaultText: { default: '' },
      compareField: { default: '' },
      comparison: { default: 'equal' },
      compareTo: { default: '' },
      trueText: { default: '' },
      falseText: { default: '' },
      addressOptions: { default: DEFAULT_ADDRESS_BLOCK },
      greetingOptions: { default: DEFAULT_GREETING_LINE },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-merge-field]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const raw = el.getAttribute('data-merge-config');
          let config: Record<string, unknown> = {};
          try {
            config = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          } catch {
            // A hand-edited or truncated attribute must not stop the file
            // opening: fall back to a plain field named by the visible text.
            config = {};
          }
          return {
            ...config,
            kind: config.kind ?? 'field',
            field: config.field ?? el.getAttribute('data-merge-field') ?? '',
          };
        },
      },
    ];
  },

  /**
   * Round-trips through HTML, RTF and `.docx` export as its own text.
   *
   * The config rides along in a data attribute so reopening an
   * Officewrite-native file restores real fields, while every other format sees
   * «FieldName» - which is the conventional display, and is legible rather than
   * corrupt when the file is opened somewhere that has never heard of merge
   * fields.
   */
  renderHTML({ node }) {
    const attrs = node.attrs as unknown as MergeFieldAttrs;
    return [
      'span',
      mergeAttributes({
        'data-merge-field': attrs.field ?? '',
        'data-merge-config': JSON.stringify(attrs),
        class: 'doc-merge-field',
      }),
      mergeFieldLabel(attrs),
    ];
  },

  renderText({ node }) {
    return mergeFieldLabel(node.attrs as unknown as MergeFieldAttrs);
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.setAttribute('data-merge-field', String(node.attrs.field ?? ''));
      // Not editable: the field is one unit, so a caret inside it would let the
      // user type into the middle of «FirstName».
      dom.contentEditable = 'false';

      const render = () => {
        const attrs = node.attrs as unknown as MergeFieldAttrs;
        const preview = currentMergePreview();
        const classes = ['doc-merge-field'];
        if (preview.highlight) classes.push('is-highlighted');

        if (preview.active) {
          const value = resolveMergeField(attrs, preview.context);
          classes.push('is-preview');
          // A field that merges to nothing has to stay visible, or the user
          // cannot tell a resolved-empty field from one they forgot to insert.
          if (!value) classes.push('is-empty');
          dom.textContent = value || '(blank)';
          dom.title = `${mergeFieldLabel(attrs)} → ${value || '(blank)'}`;
        } else {
          dom.textContent = mergeFieldLabel(attrs);
          dom.title = describeField(attrs);
        }
        dom.className = classes.join(' ');
      };

      render();
      window.addEventListener(MERGE_PREVIEW_EVENT, render);

      return {
        dom,
        update(updated) {
          if (updated.type.name !== 'mergeField') return false;
          node = updated;
          render();
          return true;
        },
        destroy() {
          window.removeEventListener(MERGE_PREVIEW_EVENT, render);
        },
        // The view owns its own text, so a browser-generated mutation inside it
        // must not be read back into the document.
        ignoreMutation() {
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      insertMergeField:
        (attrs: Partial<MergeFieldAttrs>) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { kind: 'field', ...attrs } }),
    };
  },
});

/** The tooltip an unmerged field carries, so its configuration is inspectable. */
function describeField(attrs: MergeFieldAttrs): string {
  if (attrs.kind === 'field') return `Merge field: ${attrs.field || '(none)'}`;
  if (attrs.kind === 'addressBlock') return 'Address block. Match Fields sets what it reads';
  if (attrs.kind === 'greetingLine') return 'Greeting line. Match Fields sets what it reads';
  if (attrs.rule === 'ifThenElse') {
    return `If «${attrs.compareField}» ${attrs.comparison} "${attrs.compareTo}" then "${attrs.trueText}" else "${attrs.falseText}"`;
  }
  if (attrs.rule === 'skipRecordIf' || attrs.rule === 'nextRecordIf') {
    return `${attrs.rule === 'skipRecordIf' ? 'Skip' : 'Next'} record if «${attrs.compareField}» ${attrs.comparison} "${attrs.compareTo}"`;
  }
  if (attrs.rule === 'ask' || attrs.rule === 'setBookmark') {
    return `${attrs.rule === 'ask' ? 'Ask' : 'Set'} bookmark "${attrs.name}"`;
  }
  if (attrs.rule === 'fillIn') return `Fill-in: ${attrs.prompt}`;
  return 'Mail merge rule';
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeField: {
      insertMergeField: (attrs: Partial<MergeFieldAttrs>) => ReturnType;
    };
  }
}
