import type { Editor } from '@tiptap/react';
import { uiPrompt } from './uiPrompt';

/**
 * Ask for a URL and link the current selection, or clear the link if empty.
 *
 * Shared so Insert > Link and Ctrl+K are the same command rather than two
 * implementations that drift apart.
 */
export async function promptForLink(editor: Editor) {
  const current = String(editor.getAttributes('link').href ?? '');
  const url = await uiPrompt('Enter URL', current || 'https://');
  if (url === null) return;

  const chain = editor.chain().focus().extendMarkRange('link');
  if (url === '') chain.unsetLink().run();
  else chain.setLink({ href: url }).run();
}
