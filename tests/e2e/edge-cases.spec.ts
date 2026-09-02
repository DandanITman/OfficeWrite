import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  openBackstage,
  typeInEditor,
  focusEditor,
  switchRibbonTab,
  acceptAppDialogs,
  saveToPath,
  PATHS,
} from '../helpers/playwright';

test.describe('Edge cases and failure modes', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
  });

  test('saves and reloads empty document', async ({ page }) => {
    await openBlankDocument(page);
    await saveToPath(page, PATHS.savedDocx);
    const b64 = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path),
      PATHS.savedDocx,
    );
    expect(b64).toBeTruthy();
  });

  test('undo restores deleted content', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Delete me');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await expect(page.getByTestId('word-editor')).toContainText('Delete me');
  });

  test('mixed formatting in one paragraph', async ({ page }) => {
    await openBlankDocument(page);
    await page.evaluate(() =>
      window.__OFFICEWRITE_TEST__?.loadEditorContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' ' },
              { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
              { type: 'text', text: ' ' },
              { type: 'text', text: 'underline', marks: [{ type: 'underline' }] },
            ],
          },
        ],
      }),
    );
    await expect(page.getByTestId('word-editor').locator('strong')).toContainText('Bold');
    await expect(page.getByTestId('word-editor').locator('em')).toContainText('italic');
    await expect(page.getByTestId('word-editor').locator('u')).toContainText('underline');
  });

  test('nested bullet inside numbered list', async ({ page }) => {
    await openBlankDocument(page);
    await page.evaluate(() =>
      window.__OFFICEWRITE_TEST__?.loadEditorContent({
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Number item' }] },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [
                          { type: 'paragraph', content: [{ type: 'text', text: 'Nested bullet' }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    await expect(page.getByTestId('word-editor').locator('ol li ul li')).toContainText('Nested bullet');
  });

  test('zoom at minimum and maximum bounds', async ({ page }) => {
    await openBlankDocument(page);
    const slider = page.locator('.status-zoom-slider');
    await slider.fill('50');
    await expect(page.getByTestId('status-zoom-pct')).toHaveText('50%');
    await slider.fill('200');
    await expect(page.getByTestId('status-zoom-pct')).toHaveText('200%');
  });

  test('ribbon tab switching preserves unsaved dirty state', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Unsaved');
    await switchRibbonTab(page, 'insert');
    await switchRibbonTab(page, 'review');
    await expect(page.getByTestId('editor-filename')).toContainText('*');
  });

  test('backstage modal overlay blocks editor interaction', async ({ page }) => {
    await openBlankDocument(page);
    await openBackstage(page);
    await expect(page.getByTestId('backstage')).toBeVisible();
    await expect(page.getByTestId('word-editor')).not.toBeFocused();
  });

  test('filename with unicode saves correctly', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Unicode path');
    const unicodePath = `${PATHS.savedDocx.replace('saved.docx', '文档.docx')}`;
    await saveToPath(page, unicodePath);
    const b64 = await page.evaluate(
      (path) => window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(path),
      unicodePath,
    );
    expect(b64).toBeTruthy();
  });

  test('very long paragraph increases word count', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'one two three four five six seven eight');
    await expect(page.getByTestId('status-word-count')).toContainText('8 words');
  });
});
