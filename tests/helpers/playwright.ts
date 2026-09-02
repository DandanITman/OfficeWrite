import { expect, type Page } from '@playwright/test';
import {
  getHeadingFixtureJson,
  getSampleOfficewrite,
  getSampleDocxBase64,
  getSampleHtml,
  getSampleRtf,
  getSampleTxt,
  PATHS,
  TINY_PNG_BASE64,
} from '../fixtures/fileFixtures';
import { buildRegressionDocumentContent } from '../fixtures/regressionDocument';

export async function resetTestState(page: Page) {
  await page.goto('/test.html');
  await page.evaluate(() => window.__OFFICEWRITE_TEST__?.reset());
}

export async function openBlankDocument(page: Page) {
  await page.getByTestId('home-blank-template').click();
  await page.getByTestId('word-editor').waitFor({ state: 'visible' });
  await page.getByTestId('ribbon').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const json = window.__OFFICEWRITE_TEST__?.getEditorJson() as { type?: string } | null;
    return json?.type === 'doc';
  });
}

export async function openTemplate(page: Page, templateId: 'letter' | 'report' | 'resume') {
  await page.getByTestId(`home-template-${templateId}`).click();
  await page.getByTestId('word-editor').waitFor({ state: 'visible' });
}

export async function goHome(page: Page) {
  await page.getByTestId('editor-titlebar').getByTitle('Home screen').first().click();
  await page.getByTestId('home-screen').waitFor({ state: 'visible' });
}

export async function focusEditor(page: Page) {
  const editor = page.getByTestId('word-editor');
  await editor.click();
  return editor;
}

export async function typeInEditor(page: Page, text: string) {
  const editor = await focusEditor(page);
  await editor.pressSequentially(text, { delay: 10 });
}

export async function grantClipboard(page: Page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
}

export async function insertMockImage(page: Page) {
  await page.evaluate((b64) => {
    window.__OFFICEWRITE_TEST__?.seedBinaryFile('C:\\OfficewriteTest\\photo.png', b64);
  }, TINY_PNG_BASE64);
  await page.evaluate(() =>
    window.__OFFICEWRITE_TEST__?.setOpenImageFileResult('C:\\OfficewriteTest\\photo.png'),
  );
  await switchRibbonTab(page, 'insert');
  await page.getByTestId('ribbon-pictures').click();
  await page.getByTestId('word-editor').locator('img').waitFor({ state: 'visible' });
}

export async function pickColorSwatch(page: Page, hex: string) {
  await page.getByTestId(`color-swatch-${hex}`).click();
}

/**
 * Put the caret inside a specific top-level paragraph of the document.
 *
 * `focusEditor` clicks the middle of the editor, which is fine for typing but
 * not for tests that then navigate with arrow keys: where the caret lands
 * depends on the layout, so the same key presses end up at different positions
 * as content changes. Clicking the paragraph itself is deterministic.
 */
export function editorParagraph(page: Page, index: number) {
  const paragraphs = page.getByTestId('word-editor').locator('> p');
  return index < 0 ? paragraphs.last() : paragraphs.nth(index);
}

export async function selectAllInEditor(page: Page) {
  await focusEditor(page);
  await page.keyboard.press('Control+A');
}

export async function switchRibbonTab(page: Page, tab: string) {
  await page.locator(`.ribbon-tab[data-tab="${tab}"]`).click();
}

/**
 * Click a ribbon control by its test id, switching to the owning tab first.
 *
 * Tests must reach the editor through the controls a user actually clicks.
 * The harness used to expose `runEditorCommand`, which called TipTap chains
 * directly - so tests named "applies heading style from ribbon" never touched
 * the ribbon, and the wiring between the two shipped almost entirely untested.
 */
export async function clickRibbon(page: Page, tab: string, testId: string) {
  await switchRibbonTab(page, tab);
  await page.getByTestId(testId).click();
}

/** Assert a ribbon toggle's active state, which tracks the caret. */
export async function expectRibbonActive(page: Page, testId: string, active: boolean) {
  const button = page.getByTestId(testId);
  if (active) await expect(button).toHaveClass(/active/);
  else await expect(button).not.toHaveClass(/active/);
}

/** Insert the default table through the Insert > Table gallery. */
export async function insertDefaultTable(page: Page) {
  await switchRibbonTab(page, 'insert');
  await page.getByTestId('ribbon-table').click();
  await page.getByTestId('ribbon-insert-table-3x3').click();
}

/** Pick a shape from the Insert > Shapes menu. */
export async function insertShape(page: Page, shape: 'rect' | 'circle' | 'triangle' | 'line' | 'arrow') {
  await switchRibbonTab(page, 'insert');
  await page.getByTestId('ribbon-shapes').click();
  await page.getByTestId(`shape-${shape}`).click();
}

/** Resolve every tracked change at once, through the Accept/Reject split menus. */
export async function resolveAllChanges(page: Page, decision: 'accept' | 'reject') {
  await switchRibbonTab(page, 'review');
  await page.getByTestId(`ribbon-${decision}-more`).click();
  await page.getByTestId(`ribbon-${decision}-all`).click();
}

/** Open a dialog from a ribbon group's corner launcher. */
export async function openRibbonDialog(page: Page, tab: string, launcherTitle: string) {
  await switchRibbonTab(page, tab);
  await page.getByTitle(launcherTitle).click();
}

/**
 * File is a dropdown now, not a ribbon panel, so the Backstage is reached
 * through File > Export rather than a "Save As / Export" button.
 */
export async function openBackstage(page: Page, section?: string) {
  await page.getByTestId('ribbon-tab-file').click();
  await page.getByTestId('file-menu').waitFor({ state: 'visible' });
  await page.getByTestId('file-menu-export').click();
  await page.getByTestId('backstage').waitFor({ state: 'visible' });
  if (section) {
    await page.getByTestId(`backstage-nav-${section}`).click();
  }
}

export async function openFindReplace(page: Page) {
  await page.keyboard.press('Control+f');
  await page.getByTestId('find-replace-bar').waitFor({ state: 'visible' });
}

/**
 * Native dialogs should never appear now that uiPrompt has no test-mode
 * branch. Accept any that do, so a stray one fails the assertion rather than
 * hanging the run.
 */
export function acceptAppDialogs(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
}

/** Answer the in-app prompt (UiPromptHost) that a command opened. */
export async function answerPrompt(page: Page, value: string) {
  const dialog = page.getByTestId('ui-prompt');
  await dialog.waitFor({ state: 'visible' });
  await page.getByTestId('ui-prompt-input').fill(value);
  await page.getByTestId('ui-prompt-ok').click();
  await dialog.waitFor({ state: 'hidden' });
}

/** Answer the in-app confirm dialog. */
export async function answerConfirm(page: Page, accept: boolean) {
  const dialog = page.getByTestId('ui-confirm');
  await dialog.waitFor({ state: 'visible' });
  await page.getByTestId(accept ? 'ui-confirm-ok' : 'ui-confirm-cancel').click();
  await dialog.waitFor({ state: 'hidden' });
}

/** Open the File dropdown and click one of its items. */
export async function fileMenu(page: Page, item: string) {
  await page.getByTestId('ribbon-tab-file').click();
  await page.getByTestId('file-menu').waitFor({ state: 'visible' });
  await page.getByTestId(`file-menu-${item}`).click();
}

/** Open the Alt+Q search box, type a query and run the top result. */
export async function runCommand(page: Page, query: string) {
  await page.keyboard.press('Alt+q');
  await page.getByTestId('command-palette').waitFor({ state: 'visible' });
  await page.getByTestId('command-input').fill(query);
  await page.getByTestId('command-input').press('Enter');
  await page.getByTestId('command-palette').waitFor({ state: 'hidden' });
}

/** Dismiss the in-app alert, asserting its message when given. */
export async function dismissAlert(page: Page, expectedText?: string | RegExp) {
  const dialog = page.getByTestId('ui-alert');
  await dialog.waitFor({ state: 'visible' });
  if (expectedText) await expect(dialog).toContainText(expectedText);
  await page.getByTestId('ui-alert-ok').click();
  await dialog.waitFor({ state: 'hidden' });
}

export async function seedAllSampleFiles(page: Page) {
  const docxB64 = await getSampleDocxBase64();
  const rtf = await getSampleRtf();
  const html = await getSampleHtml();
  await page.evaluate(
    ({ files }) => {
      for (const file of files.text) {
        window.__OFFICEWRITE_TEST__?.seedFile(file.path, file.content);
      }
      for (const file of files.binary) {
        window.__OFFICEWRITE_TEST__?.seedBinaryFile(file.path, file.content);
      }
    },
    {
      files: {
        text: [
          { path: PATHS.txt, content: getSampleTxt() },
          { path: PATHS.rtf, content: rtf },
          { path: PATHS.html, content: html },
          { path: PATHS.officewrite, content: getSampleOfficewrite() },
          { path: PATHS.folderDoc1, content: 'Folder doc one' },
          { path: PATHS.folderDoc2, content: 'Folder doc two' },
        ],
        binary: [
          { path: PATHS.docx, content: docxB64 },
          { path: PATHS.imagePng, content: TINY_PNG_BASE64 },
        ],
      },
    },
  );
}

export async function saveToPath(page: Page, path: string) {
  await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setSaveFileResult(p), path);
  await page.keyboard.press('Control+s');
  await expect
    .poll(async () =>
      page.evaluate(
        (p) =>
          window.__OFFICEWRITE_TEST__?.readStoredBinaryBase64(p) ??
          window.__OFFICEWRITE_TEST__?.readStoredFile(p),
        path,
      ),
    )
    .not.toBeNull();
}

export async function openSeededFile(page: Page, path: string) {
  await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setOpenFileResult(p), path);
  await page.keyboard.press('Control+o');
  await page.getByTestId('word-editor').waitFor({ state: 'visible' });
}

export async function setAutoSaveInterval(page: Page, ms: number) {
  await page.evaluate((interval) => window.__OFFICEWRITE_TEST__?.setSettings({ autoSaveIntervalMs: interval }), ms);
}

export async function loadRegressionFixture(page: Page) {
  await openBlankDocument(page);
  const content = buildRegressionDocumentContent();
  await page.evaluate((docContent) => {
    window.__OFFICEWRITE_TEST__?.loadEditorContent(docContent);
  }, content);
  await page.getByText('Officewrite Regression Test').waitFor({ state: 'visible' });
}

export async function loadHeadingFixture(page: Page) {
  await openBlankDocument(page);
  await page.evaluate((doc) => window.__OFFICEWRITE_TEST__?.loadEditorContent(doc), getHeadingFixtureJson());
}

/**
 * The recipient list the Mailings tests merge against.
 *
 * Deliberately awkward in the ways real exported lists are: a quoted cell with
 * a comma in it, a row with no company, a row with no street, and two
 * countries so the address block's country rule has something to decide.
 */
export const MERGE_CSV = [
  'First Name,Last Name,Company,Address 1,City,State,ZIP,Country,Email,Balance',
  'Ada,Lovelace,Analytical Engines,12 Mill Lane,Cambridge,Cambs,CB1 2AB,United Kingdom,ada@example.com,240',
  'Grace,Hopper,,"1 Navy Yard, Building 3",Arlington,VA,22202,United States,grace@example.com,0',
  'Alan,Turing,Bletchley Park,,Milton Keynes,Bucks,MK3 6EB,United Kingdom,alan@example.com,90',
].join('\n');

export const MERGE_CSV_PATH = 'C:\\OfficewriteTest\\contacts.csv';

/**
 * Attach a recipient list through the ribbon, the way a user does.
 *
 * Through Select Recipients rather than by poking state: the mapping is guessed
 * when the list is attached, so a test that skipped this step would exercise
 * Address Block against a mapping nothing had ever produced.
 */
export async function attachRecipientList(page: Page, csv = MERGE_CSV, path = MERGE_CSV_PATH) {
  await page.evaluate(
    ({ filePath, content }) => {
      window.__OFFICEWRITE_TEST__?.seedFile(filePath, content);
      window.__OFFICEWRITE_TEST__?.setOpenDataFileResult(filePath);
    },
    { filePath: path, content: csv },
  );
  await switchRibbonTab(page, 'mailings');
  await page.getByTestId('mailings-select-recipients').click();
  await page.getByTestId('mailings-existing-list').click();
  // Edit Recipient List is disabled until a list is attached, so its enabled
  // state is the signal that the attach actually landed.
  await expect(page.getByTestId('mailings-edit-recipients')).toBeEnabled();
}

/** Insert one merge field for a column, through the Insert Merge Field menu. */
export async function insertMergeFieldFor(page: Page, field: string) {
  await switchRibbonTab(page, 'mailings');
  await page.getByTestId('mailings-insert-merge-field-more').click();
  await page.getByTestId(`mailings-field-${field}`).click();
}

export const visualMaskSelectors = [
  '[data-testid="status-bar"]',
  '[data-testid="editor-filename"]',
  '.home-user-chip',
];

export function visualMaskLocators(page: Page) {
  return visualMaskSelectors.map((selector) => page.locator(selector));
}

export { PATHS };
