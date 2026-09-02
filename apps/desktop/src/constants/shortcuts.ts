/**
 * Every keyboard shortcut Officewrite binds, in one place.
 *
 * Help > Keyboard Shortcuts renders this, and `docs/FEATURES.md` is written
 * from it - so a binding added to `App.tsx` without a line here is a binding the
 * user has no way to discover.
 */
export interface KeyboardShortcut {
  keys: string;
  label: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: KeyboardShortcut[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'File',
    shortcuts: [
      { keys: 'Ctrl+N', label: 'New document' },
      { keys: 'Ctrl+O', label: 'Open' },
      { keys: 'Ctrl+S', label: 'Save' },
      { keys: 'Ctrl+Shift+S', label: 'Save As' },
      { keys: 'Ctrl+P', label: 'Print' },
    ],
  },
  {
    title: 'Editing',
    shortcuts: [
      { keys: 'Ctrl+Z', label: 'Undo' },
      { keys: 'Ctrl+Y', label: 'Redo' },
      { keys: 'Ctrl+F', label: 'Find' },
      { keys: 'Ctrl+H', label: 'Replace' },
      { keys: 'Ctrl+K', label: 'Insert hyperlink' },
      { keys: 'Ctrl+Enter', label: 'Page break' },
      { keys: 'Alt+Q', label: 'Search for a command' },
    ],
  },
  {
    title: 'Font',
    shortcuts: [
      { keys: 'Ctrl+B', label: 'Bold' },
      { keys: 'Ctrl+I', label: 'Italic' },
      { keys: 'Ctrl+U', label: 'Underline' },
      { keys: 'Ctrl+Shift+D', label: 'Double underline' },
      { keys: 'Ctrl+Shift+K', label: 'Small caps' },
      { keys: 'Ctrl+[ / Ctrl+]', label: 'Shrink and grow the font' },
    ],
  },
  {
    title: 'Paragraph',
    shortcuts: [
      { keys: 'Ctrl+L / E / R / J', label: 'Align left, centre, right, justify' },
      { keys: 'Ctrl+1 / 2 / 5', label: 'Single, double and 1.5 line spacing' },
      { keys: 'Ctrl+0', label: 'Add or remove space before' },
      { keys: 'Ctrl+M', label: 'Increase indent' },
      { keys: 'Ctrl+Shift+M', label: 'Decrease indent' },
    ],
  },
  {
    title: 'Review',
    shortcuts: [
      { keys: 'F7', label: 'Spelling & Grammar' },
      { keys: 'Shift+F7', label: 'Thesaurus' },
      { keys: 'Ctrl+Shift+E', label: 'Track changes' },
      { keys: 'Ctrl+Alt+M', label: 'New comment' },
      { keys: 'Ctrl+Alt+F', label: 'Insert footnote' },
      { keys: 'Ctrl+Alt+D', label: 'Insert endnote' },
      { keys: 'Alt+Shift+X', label: 'Mark index entry' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: 'Ctrl+F1', label: 'Collapse or pin the ribbon' },
      { keys: 'Ctrl+Shift+8', label: 'Show or hide formatting marks' },
    ],
  },
];
