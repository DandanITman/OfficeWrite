import { Extension } from '@tiptap/core';

/**
 * Table Design: the table style gallery, banded rows and cell shading.
 *
 * The style is one attribute on the table node and the rest is CSS, which is
 * how the table styles behave too - changing the style must not rewrite
 * every cell.
 */

export const TABLE_STYLES = [
  { id: 'grid', label: 'Table Grid' },
  { id: 'plain', label: 'Plain Table' },
  { id: 'listAccent', label: 'List Table Accent' },
  { id: 'gridAccent', label: 'Grid Table Accent' },
  { id: 'bandedRows', label: 'Banded Rows' },
  { id: 'bandedColumns', label: 'Banded Columns' },
  { id: 'borderless', label: 'No Borders' },
] as const;

export const TableFormatting = Extension.create({
  name: 'tableFormatting',

  addGlobalAttributes() {
    return [
      {
        types: ['table'],
        attributes: {
          tableStyle: {
            default: 'grid',
            parseHTML: (element) => element.getAttribute('data-table-style') ?? 'grid',
            renderHTML: (attributes) => ({
              'data-table-style': attributes.tableStyle ?? 'grid',
              class: `doc-table style-${attributes.tableStyle ?? 'grid'}`,
            }),
          },
        },
      },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          shading: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) =>
              attributes.shading ? { style: `background-color: ${attributes.shading}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTableStyle:
        (style: string) =>
        ({ commands }) =>
          commands.updateAttributes('table', { tableStyle: style }),
      setCellShading:
        (color: string | null) =>
        ({ editor, commands }) =>
          commands.updateAttributes(editor.isActive('tableHeader') ? 'tableHeader' : 'tableCell', {
            shading: color,
          }),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableFormatting: {
      setTableStyle: (style: string) => ReturnType;
      setCellShading: (color: string | null) => ReturnType;
    };
  }
}
