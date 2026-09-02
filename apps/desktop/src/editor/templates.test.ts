import { describe, expect, it, afterEach } from 'vitest';
import type { Editor } from '@tiptap/core';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '@officewrite/core';
import { createTestEditor } from './testEditor';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/**
 * Templates are hand-written TipTap JSON. ProseMirror does not throw on a node
 * it cannot place - it silently drops it - so a typo in a table row or a task
 * item would ship as a template that quietly opens half empty. Loading each one
 * through the production schema and comparing the JSON back out is the only
 * check that catches that.
 */
describe('template catalogue', () => {
  it('has unique ids', () => {
    const ids = TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('files every template under a known category', () => {
    for (const template of TEMPLATES) {
      expect(TEMPLATE_CATEGORIES, template.id).toContain(template.category);
    }
  });

  it('gives every template a name, a description and search keywords', () => {
    for (const template of TEMPLATES) {
      expect(template.name.length, template.id).toBeGreaterThan(0);
      expect(template.description.length, template.id).toBeGreaterThan(0);
      // Blank needs no keywords to be findable, but everything else does.
      if (template.id !== 'blank') expect(template.keywords.length, template.id).toBeGreaterThan(0);
    }
  });

  it.each(TEMPLATES.map((template) => [template.id, template] as const))(
    'loads %s into the editor without dropping content',
    (id, template) => {
      editor = createTestEditor(template.content);
      const loaded = editor.getJSON();

      expect(loaded.content, id).toBeDefined();
      // A dropped node shows up as a shorter block list than the template has.
      expect(loaded.content!.length, id).toBe(template.content.content.length);

      const expectedTypes = template.content.content.map((block) => block.type);
      expect(loaded.content!.map((block) => block.type), id).toEqual(expectedTypes);
    },
  );

  it.each(TEMPLATES.filter((t) => t.id !== 'blank').map((t) => [t.id, t] as const))(
    'renders visible text for %s',
    (id, template) => {
      editor = createTestEditor(template.content);
      expect(editor.getText().trim().length, id).toBeGreaterThan(0);
    },
  );
});
