import type { Editor } from '@tiptap/react';

/**
 * Clipboard actions for the ribbon buttons.
 *
 * These used `document.execCommand('cut' | 'copy' | 'paste')`. Chromium blocks
 * script-initiated `paste` outright, so the Paste button was a silent no-op -
 * no error, no clipboard read, no fallback. Cut and copy happened to work, but
 * only as a side effect of the editor keeping the DOM selection.
 */

function selectedSlice(editor: Editor): { text: string; html: string } {
  const { state } = editor;
  const { from, to } = state.selection;
  if (from === to) return { text: '', html: '' };

  const text = state.doc.textBetween(from, to, '\n');
  // Serialise the selected slice so formatting survives a copy.
  const container = document.createElement('div');
  const fragment = editor.view.serializeForClipboard
    ? editor.view.serializeForClipboard(state.selection.content()).dom
    : null;
  if (fragment) container.appendChild(fragment.cloneNode(true));
  return { text, html: container.innerHTML };
}

async function writeClipboard(editor: Editor): Promise<boolean> {
  const { text, html } = selectedSlice(editor);
  if (!text && !html) return false;

  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copySelection(editor: Editor): Promise<boolean> {
  editor.view.focus();
  return writeClipboard(editor);
}

export async function cutSelection(editor: Editor): Promise<boolean> {
  editor.view.focus();
  const copied = await writeClipboard(editor);
  if (copied) editor.commands.deleteSelection();
  return copied;
}

/**
 * Paste, honouring the Paste Options.
 *
 * `default` keeps the source formatting, `text` is Keep Text Only (Ctrl+Shift+V)
 * and `match` merges into the surrounding formatting by stripping the pasted
 * marks and letting the caret's own formatting apply.
 */
export async function pasteFromClipboard(
  editor: Editor,
  mode: 'default' | 'text' | 'match' = 'default',
): Promise<boolean> {
  editor.view.focus();
  try {
    if (mode !== 'default') {
      const plain = await navigator.clipboard.readText();
      if (!plain) return false;
      editor.commands.insertContent(plain);
      return true;
    }
    // Prefer the rich payload so pasted formatting is preserved.
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const html = await (await item.getType('text/html')).text();
          editor.commands.insertContent(html);
          return true;
        }
      }
    }
    const text = await navigator.clipboard.readText();
    if (!text) return false;
    editor.commands.insertContent(text);
    return true;
  } catch {
    return false;
  }
}
