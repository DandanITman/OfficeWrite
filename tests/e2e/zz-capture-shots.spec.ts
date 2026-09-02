import { test, expect } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  openTemplate,
  switchRibbonTab,
  acceptAppDialogs,
  typeInEditor,
  insertDefaultTable,
  attachRecipientList,
  insertMergeFieldFor,
} from '../helpers/playwright';

/**
 * Generates the screenshots used by the project site in `docs/shots/`.
 *
 * Skipped unless OFFICEWRITE_CAPTURE is set, so it never slows the normal suite
 * or rewrites images on an ordinary run:
 *
 *   OFFICEWRITE_CAPTURE=1 npx playwright test tests/e2e/zz-capture-shots.spec.ts
 *
 * These are real renders of the app, which is the point - the site used to
 * show a hand-drawn mock-up of a window that did not match anything.
 */
const CAPTURE = !!process.env.OFFICEWRITE_CAPTURE;
const SHOTS = 'docs/shots';

test.describe('site screenshots', () => {
  test.skip(!CAPTURE, 'set OFFICEWRITE_CAPTURE=1 to regenerate the site screenshots');

  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('home screen', async ({ page }) => {
    await page.goto('/test.html');
    // A few recents, so the shot shows the screen as it looks in use rather
    // than the empty state a fresh profile sees.
    await page.evaluate(() => {
      const now = Date.now();
      const dir = ['C:', 'Users', 'you', 'Documents'].join(String.fromCharCode(92));
      const at = (name: string) => dir + String.fromCharCode(92) + name;
      window.__OFFICEWRITE_TEST__?.setRecents([
        { path: at('Biology essay.docx'), name: 'Biology essay.docx', lastOpened: now - 6e5, pinned: true },
        { path: at('Club newsletter.officewrite'), name: 'Club newsletter.officewrite', lastOpened: now - 864e5, pinned: false },
        { path: at('Cover letter.docx'), name: 'Cover letter.docx', lastOpened: now - 2592e5, pinned: false },
      ]);
    });
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/home.png` });
  });

  test('editor with a report', async ({ page }) => {
    await openBlankDocument(page);
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.loadEditorContent({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'The Water Cycle' }] },
          { type: 'paragraph', content: [
            { type: 'text', text: 'Water moves between the oceans, the atmosphere and the land in a continuous cycle. ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'Evaporation' },
            { type: 'text', text: ' lifts water into the air, ' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'condensation' },
            { type: 'text', text: ' forms clouds, and precipitation returns it to the ground.' },
          ] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Stages' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Evaporation from oceans, lakes and rivers' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Condensation into cloud droplets' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Precipitation as rain, snow or hail' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Collection in rivers, lakes and groundwater' }] }] },
          ] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why it matters' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'The cycle keeps fresh water available for drinking, farming and habitats. Warming changes how fast each stage happens, which is why rainfall patterns shift.' }] },
        ],
      });
    });
    // loadEditorContent does not fire an update, so the status bar would read
    // "0 words" beside a full page. A no-op edit makes the counters agree.
    await page.getByTestId('word-editor').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' ');
    await page.keyboard.press('Backspace');

    await switchRibbonTab(page, 'home');
    await expect(page.getByTestId('word-editor')).toBeVisible();
    await expect(page.getByTestId('status-word-count')).not.toHaveText('0 words');
    await page.screenshot({ path: `${SHOTS}/editor.png` });
  });

  test('insert tab and a table', async ({ page }) => {
    await openBlankDocument(page);
    await typeInEditor(page, 'Quarterly results');
    await page.keyboard.press('Enter');
    await insertDefaultTable(page);
    await switchRibbonTab(page, 'insert');
    await page.screenshot({ path: `${SHOTS}/insert.png` });
  });

  test('review tab', async ({ page }) => {
    await openTemplate(page, 'letter');
    await switchRibbonTab(page, 'review');
    await page.screenshot({ path: `${SHOTS}/review.png` });
  });

  test('navigation pane', async ({ page }) => {
    await openTemplate(page, 'report');
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-navigation').click();
    await page.screenshot({ path: `${SHOTS}/navigation.png` });
  });

  test('dark mode', async ({ page }) => {
    await openTemplate(page, 'report');
    await switchRibbonTab(page, 'view');
    await page.getByTestId('view-dark-mode').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/dark.png` });
  });

  test('mailings tab mid-merge', async ({ page }) => {
    await openBlankDocument(page);
    // A merge with its list attached and a field previewing, so the shot shows
    // the tab in the state people work in rather than greyed out.
    await attachRecipientList(page);
    await typeInEditor(page, 'Dear ');
    await insertMergeFieldFor(page, 'First Name');
    await page.getByTestId('mailings-preview-results').click();
    await page.screenshot({ path: `${SHOTS}/mailings.png` });
  });

  test('references tab', async ({ page }) => {
    await openTemplate(page, 'report');
    await switchRibbonTab(page, 'references');
    await page.screenshot({ path: `${SHOTS}/references.png` });
  });
});
