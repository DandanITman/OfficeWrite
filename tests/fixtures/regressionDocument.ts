export const REGRESSION_DOC_TITLE = 'Officewrite Regression Test';

export const REGRESSION_PARAGRAPH =
  'This is a normal paragraph used for automated regression testing.';

export const REGRESSION_BOLD = 'This sentence is bold.';
export const REGRESSION_ITALIC = 'This sentence is italic.';
export const REGRESSION_UNDERLINE = 'This sentence is underlined.';

export const REGRESSION_BULLETS = ['First bullet item', 'Second bullet item'];
export const REGRESSION_NUMBERS = ['First numbered item', 'Second numbered item'];

export const REGRESSION_SAVE_PATH = 'C:\\OfficewriteTest\\regression.officewrite';
export const REGRESSION_SECOND_PATH = 'C:\\OfficewriteTest\\second.officewrite';

/** Fixed timestamp for deterministic save/load metadata in unit tests. */
export const REGRESSION_FIXED_ISO = '2026-01-15T12:00:00.000Z';

export function buildRegressionDocumentContent() {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1, textAlign: 'left' },
        content: [{ type: 'text', text: REGRESSION_DOC_TITLE }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: REGRESSION_PARAGRAPH }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: REGRESSION_BOLD,
            marks: [{ type: 'bold' }],
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: REGRESSION_ITALIC,
            marks: [{ type: 'italic' }],
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: REGRESSION_UNDERLINE,
            marks: [{ type: 'underline' }],
          },
        ],
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [
          {
            type: 'text',
            text: 'Center aligned text.',
            marks: [{ type: 'textStyle', attrs: { fontSize: '18pt' } }],
          },
        ],
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [{ type: 'text', text: 'Right aligned text.' }],
      },
      {
        type: 'bulletList',
        content: REGRESSION_BULLETS.map((text) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        })),
      },
      {
        type: 'orderedList',
        content: REGRESSION_NUMBERS.map((text) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        })),
      },
    ],
  };
}
